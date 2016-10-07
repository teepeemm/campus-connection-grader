"use strict";

/** An object with keys "mailto:username@" or "Student ID #" and
 *  values "grade". */
var grade;

/** Column header in the csv that holds pertinent information. */
var gradeColName, studentIdColName;

/** We could call chrome.extension.getBackgroundPage() to do this
 *  synchronously, but Firefox can't.  So we'll do this asynchronously to help
 *  make the versions more similar. */
var poster = emitConnect("popup",messageHandler);

document.getElementById("download_button")
    .addEventListener("click",function() {
	console.log("dest:blackboard, action:download");
	poster({"dest":"blackboard","action":"download"});
    });
//		      poster.bind(undefined,{"dest":"blackboard",
//					    "action":"download"}));
document.getElementById("transfer_button")
    .addEventListener("click",function() {
	console.log("dest:blackboard, action:transfer");
	poster({"dest":"blackboard","action":"transfer"});
    });
//		      poster.bind(undefined,{"dest":"blackboard",
//						     "action":"transfer"}));
document.getElementById("upload_input").addEventListener("change",loadFile);

var openPractice;
if ( typeof(chrome)!=="undefined" && chrome.runtime ) {
    if ( chrome.runtime.openOptionsPage ) {
	console.log("chrome new open");
	openPractice = function() {
	    chrome.runtime.openOptionsPage();
	};
	// can't use chrome.runtime.openOptionsPage instead of anonymous
	// function, because Chrome passes the Event object and Chrome expects
	// a callback.  It's longer to use
	// chrome.runtime.openOptionsPage.bind(chrome.runtime,function(){})
    } else {
	console.log("chrome old open");
	openPractice = open.bind(undefined,
				 chrome.runtime.getURL('practice.html'));
    }
} else { // Firefox
    console.log("firefox open");
    openPractice = poster.bind(undefined,{"action":"openPractice"});
}
document.getElementById("practice").addEventListener("click",
						     function() {console.log("openpractice");openPractice();});

function messageHandler(message) {
    console.log("popup.js");
    console.log(message);
    // popup is initialized once by Firefox,
    // so the display has to be reset everytime
    document.getElementById("upload").style.display = "none";
    document.getElementById("download").style.display = "none";
    document.getElementById("transfer").style.display = "none";
    if ( message.ccPort ) {
	document.getElementById("upload").style.display = "inline";
    }
    if ( message.bbPort ) {
	document.getElementById("download").style.display = "inline";
    }
    if ( message.ccPort && message.bbPort ) {
	document.getElementById("transfer").style.display = "inline";
    }
}

/** The only reason this script is running is because the popup was opened.
 *  We need to determine which of the buttons to show. */
poster({"action":"getState"});

function loadFile(event) {
    Papa.parse(event.target.files[0],
	       {
		   "header":         true,
		   "error":          onError,
		   "complete":       loadGrades,
		   "skipemptylines": true
	       }); // no need to stream, file is 50b/student
}

function onError(err,file,inputElem) {
    console.log(err);
    console.log(file);
    if ( inputElem ) {
	console.log(inputElem);
    }
    myalert("Error loading: "+err.name);
}

function loadGrades(results) {
    try {
	if ( results.errors ) {
	    removeErrors(results);
	}
	grade = {}; // remove existing grades
	getIdColumn(results);
	gradeColName = firstMatch(results.meta.fields,/External ?Grade/i);
	if ( gradeColName ) {
	    parseRows(results);
	} else if ( /[\x00-\x08\x0E-\x1F]/.test(results.meta.fields[0]) ) {
	    throw 'This appears to be a binary file. '
		+'Please save as a "comma separated value" file.';
	} else {
	    selectGradeColName(results);
	}
    } catch (e) {
	myalert(e);
    }
}

/** Delete empty rows (and their corresponding errors).
 *  Reversing the arrays should mean we go through them backward,
 *  allowing us to delete entries without messing up later parsing.
 *  This could all be in a results.errors.reverse().forEach(),
 *  but that assumes Papa puts the errors in order. */
function removeErrors(results) {
    results.errors.reverse().map(function(error,index) {
	if ( error.type === "FieldMismatch" && error.code === "TooFewFields"
	     && error.message.endsWith("but parsed 1")
	     && results.data[error.row][results.meta.fields[0]].trim() === ''
	   ) {
	    results.errors.splice(index,1); // remove the error from the list
	    return error.row;
	} else {
	    return -1;
	}
    }).filter(function(row) {
	return row >= 0;
    }).sort().reverse().forEach(function(row) {
	results.data.splice(row,1); // remove the blank row
    });
}

function getIdColumn(results) {
    studentIdColName = firstMatch(results.meta.fields,/Student ?ID/i)
	|| firstMatch(results.meta.fields,/Username/i);
    if ( ! studentIdColName ) {
	if ( results.meta.fields.join('').trim() === '' ) {
	    throw 'The csv must begin with the column headers, '
		+'not empty lines.';
	} else {
	    throw 'There was no column with "Student ID" or "Username" '
		+'in the first row.';
	}
    }
}

/** If the csv didn't have an "External Grade" column, ask the user to pick
 *  which column to use for the grade. */
function selectGradeColName(results) {
    var select = document.getElementById("select");
    results.meta.fields.forEach(function(colTitle) {
	var option = document.createElement("option");
	option.setAttribute("value",colTitle);
	option.textContent = colTitle;
	select.appendChild(option);
    });
    select.addEventListener("change",function() {
	gradeColName = select.value;
	parseRows(results);
    });
    select.style.display = "block";
}

/** Take the parsed csv and build the grade object to post to campusConnect.js.
 */
function parseRows(results) {
    results.data.forEach(function(row) {
	if ( /^[ABCDFISU][+-]?$/.test(row[gradeColName].trim()) ) {
	    grade[getRowKey(row)] = row[gradeColName].trim();
	}
    });
    if ( results.errors.length ) {
	showErrorCount(results.errors.length,results.data.length);
    }
    poster({"dest":"campusConnection","action":"upload","upload":grade});
}

/** If we're using EmplIds as keys, we need to make sure they're 0 padded. */
function getRowKey(row) {
    var rowKey = row[ studentIdColName ];
    if ( /Student ?ID/i.test(studentIdColName) ) {
	rowKey = ("0000000"+rowKey).slice(-7);
    }
    return rowKey;
}

function showErrorCount(numErrors,numRows) {
    myalert("There were "+numRows+" rows that were processed "
	  +"(resulting in "+Object.keys(grade).length+" grades), and "
	  +"an additional "+numErrors+" rows that were not processed.");
}

/** The first element in the array that matches the given regular expression.
 */
function firstMatch(array,regex) {
    return array.filter(RegExp.prototype.test.bind(regex))[0];
}

/** Javascript's usual alert is modal.  That steals the focus from the popup.
 *  When the popup looses focus, it closes.  When the popup closes, the script
 *  that triggered the alert is gone, so the alert closes.  All of this
 *  happens in less than a second, and there's no time to read the message. */
function myalert(message) {
    var out = document.createElement("p");
    out.setAttribute("style","color:red");
    out.textContent = message;
    document.body.appendChild(out);
}
