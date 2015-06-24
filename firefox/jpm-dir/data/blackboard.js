"use strict";

/** A boolean flag. */
var useMarked, usePrimary;

/** A mapping from the column's descriptive header to its index in that row. */
var colKey;

/** The students' data that will be exported. */
var tableData;

/** The columns' descriptive headers that Blackboard uses. */
var info = ["Last Name","First Name","Username","Student ID (EMPLID)"];

/** Port to send and receive messages with background.js and popup.js. */
var backgroundPort;

if ( /Grade Center/.test(document.title) ) {
    backgroundPort = chrome.runtime.connect({"name":"blackboard"});
    backgroundPort.onMessage.addListener(downloadGrades);
}

/** A message kicks blackboard.js into action. */
function downloadGrades(message) {
    if ( /Screen Reader Mode Active/.test(document.title) ) {
	whenReady(message);
    } else {
	toggleScreenReaderMode()
    }
}

function whenReady(message) {
    if ( document.getElementById("loadstatus").style.display === "none" ) {
	try {
	    getHeaderData();
	    checkColumns();
	    getTableData();
	    determineExtGradeCol();
	    getLetterGrade();
	    window["create_"+message.action]();
	    // create_download() or create_transfer()
	} catch (e) {
	    alert(e);
	} finally {
	    if ( message.exitScreenReader ) {
		toggleScreenReaderMode()
	    }
	}
    } else {
	setTimeout(whenReady,100,message);
    }
}

function toggleScreenReaderMode() {
    var screenReaderAccess
	= document.getElementById("pageTitleBar").querySelector("span a");
    screenReaderAccess.dispatchEvent(new Event("mouseover"));
    // Blackboard requires a mouseover in order to work
    screenReaderAccess.click();
    document.getElementById("accessible_menu_item").parentElement.click();
    // initiates a page navigation, so the content script exits
    // if there's more to do, background.js will remind blackboard.js when it
    // reconnects the port.
}

/** We look for the columns mentioned in {@link #info}, one named
 *  "External Grade", and one marked as the external grade. */
function getHeaderData() {
    colKey = {};
    var headRow = document.getElementById("table1_accessible").tHead.rows[0];
    // .cells is a HTMLCollection, not an array
    Array.prototype.slice.call(headRow.cells,0).forEach(function(th,index) {
	if ( info.indexOf( th.textContent.trim() ) >= 0 ) {
	    colKey[ th.textContent.trim() ] = index;
	}
	if ( /External ?Grade/i.test( th.textContent.trim() ) ) {
	    colKey.extGradeNamed = index;
	}
	if ( th.querySelector('img[alt="External Grade"]') ) {
	    colKey.extGradeMarked = index;
	} // the first column is the check box, so we don't need to worry
    });   // that any of these are 0 == false
}

/** Ensures that the needed columns are present. */
function checkColumns() {
    if ( ! ( colKey["Student ID (EMPLID)"] || colKey["Username"] ) ) {
	throw 'The columns "Username" or "Student ID (EMPLID)" must be '
	    +'in this view in order to download grades.\n'
	    +'The columns "Last Name" and "First Name" will also be '
	    +'included, if possible.';
    }
    if ( ! ( colKey["extGradeNamed"] || colKey["extGradeMarked"] ) ) {
	throw 'There needs to be a column marked as the "External Grade" '
	    +'(or one named as such) in order to download grades.';
    }
}

/** Grabs the data from Blackboard's table. */
function getTableData() {
    tableData = [];
    var tBody = document.getElementById("table1_accessible").tBodies[0];
    // again, .rows is a HTMLCollection, not an array
    Array.prototype.slice.call(tBody.rows,0).forEach(function(tr) {
	var studentInfo = {};
	Object.keys(colKey).forEach(function(key) {
	    studentInfo[key] = tr.cells[ colKey[key] ].textContent.trim();
	});
	tableData.push(studentInfo);
    });
}

/** We prefer a column that was marked as the external grade to one that
 *  was named "External Grade". If there are ties, we prefer a primary grade
 *  over a secondary grade, although it would be tricky to get the two to
 *  disagree. */
function determineExtGradeCol() {
    var colNames = [ "extGradeMarked", "extGradeNamed" ];
    for ( var name = 0 ; name < colNames.length ; name++ ) {
	if ( colKey[colNames[name]] ) {
	    var colEntries = tableData.map(function(studentInfo) {
		return studentInfo[colNames[name]];
	    });
	    if ( colEntries.every(RegExp.prototype.test
				  .bind(/^[ABCDFISU][+-]?(\s.*)?$/)) ) {
		usePrimary = true;
		useMarked = colNames[name]==="extGradeMarked";
		return;
	    }
	    if ( colEntries.every(RegExp.prototype.test
				  .bind(/.+\s\([ABCDFISU][+-]?\)$/)) ) {
		usePrimary = false;
		useMarked = colNames[name]==="extGradeMarked";
		return;
	    }
	}
    }
    throw "A letter grade could not be found from the external grade.";
}

/** Transforms Blackboard's "primary (secondary)" into just the letter grade.
 *  That information is no longer needed, and deleted from the object. */
function getLetterGrade() {
    tableData.forEach(function(studentInfo) {
	var grade = studentInfo[useMarked?"extGradeMarked":"extGradeNamed"];
	studentInfo["External Grade"] = usePrimary ?
	    grade.split(" ",2)[0] :
	    grade.replace(/^.+\s\(([^()]+)\)$/,"$1");
	delete studentInfo[useMarked?"extGradeMarked":"extGradeNamed"];
    });
}

/** For transferring to Campus Connection, we build a smaller object that just
 *  has the needed information. */
function create_transfer() {
    var grade = {},
	key = colKey["Student ID (EMPLID)"] ?
	"Student ID (EMPLID)" : "Username";
    tableData.forEach(function(studentInfo) {
	grade[ studentInfo[key] ] = studentInfo["External Grade"];
    });
    backgroundPort.postMessage({"upload":grade});
}

/** If the user requested the information for download, we construct the
 *  file's name and send everything to background.js, which has access to
 *  Papa to build the csv. */
function create_download() {
    backgroundPort
	.postMessage({"download":tableData,"filename":getFileName()});
}

function getFileName() {
    //   gc_TERM-COURSE(-SECTIONID)_extgrade_YYYY-MM-DD-HH-MM-SS.csv
    // eg: gc_1430-MATH103(-11388?)_extgrade_2014-02-01-10-55-02.csv
    var fileName = "gc_";
    fileName += document.getElementById("courseMenu_link").textContent
	.replace(/.*\(/g,"").replace(")","");
    fileName = fileName.replace(' ','-');
    fileName = fileName.replace(/ .*$/,'');
    fileName += "_extgrade_";
    var today = new Date();
    fileName += today.getFullYear() + "-";
    fileName += twoDigits(today.getMonth()+1) + "-";
    fileName += twoDigits(today.getDate()) + "-";
    fileName += twoDigits(today.getHours()) + "-";
    fileName += twoDigits(today.getMinutes()) + "-";
    fileName += twoDigits(today.getSeconds()) + ".csv";
    return fileName;
}

/** Make sure a one digit input has a leading zero.  This would be harder if
 *  input or output needed to be arbitrarily big. */
function twoDigits(input) {
    return ("0"+input).slice(-2);
}
