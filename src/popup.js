/* global chrome, Papa */

"use strict";

/** An object with keys "mailto:username@" or "Student ID #" and
 *  values "grade". */
var grade;

/** Column header in the csv that holds pertinent information. */
var gradeColName, studentIdColName;

var backgroundWindow = chrome.extension.getBackgroundPage();

/** Message port to content script. */
var bbPort = bestPort(backgroundWindow.ports.blackboard),
    ccPort = bestPort(backgroundWindow.ports.campusConnection);

backgroundWindow.ccPort = ccPort;

/** This script already has access to Papa, so we have blackboard.js message
 *  the information and build the download file here. */
backgroundWindow.createDownload = function(message) {
    var outputString
	= escape(Papa.unparse(Array.prototype.slice.call(message.download,0),
			      {"quotes":true}));
    // apparently, message.download isn't treated as an array without the slice
    var downloader = document.createElement("a");
    downloader.setAttribute("download",message.filename);
    downloader.setAttribute("style","display:none");
    downloader.setAttribute("href",
			    "data:text/csv;charset=utf-8,"+outputString);
    document.body.appendChild(downloader);
    downloader.click();
    document.body.removeChild(downloader);
}

/* Toggling screen reader mode is a page navigation, which causes the content
 * script to reboot.  By setting background.js#bbState, when blackboard.js
 * reconnects its port, background.js will remind blackboard.js what it's
 * supposed to be doing. */
document.getElementById("download_button")
    .addEventListener("click",function() {
	backgroundWindow.bbState = "download";
	bbPort.postMessage({"action":"download"});
});
document.getElementById("transfer_button")
    .addEventListener("click",function() {
	backgroundWindow.bbState = "transfer";
	bbPort.postMessage({"action":"transfer"});
});
document.getElementById("upload_input").addEventListener("change",loadFile);

if ( ! chrome.runtime.openOptionsPage ) {
    chrome.runtime.openOptionsPage
	= open.bind(undefined,chrome.runtime.getURL('practice.html'));
}
document.getElementById("practice").addEventListener("click",function() {
    chrome.runtime.openOptionsPage();
    // can't just use chrome.runtime.openOptionsPage instead of the anonymous
    // function, because Chrome passes the Event object and Chrome expects
    // to get a function callback.  To get around that, we'd have to
    // bind(chrome.runtime,function(){}), which is longer than what we have.
});

/** The button/inputs are initially display:none. */
if ( ccPort ) {
    document.getElementById("upload").style.display = "inline";
    document.getElementById("cantupload").style.display = "none";
}
if ( bbPort ) {
    document.getElementById("download").style.display = "inline";
}
if ( ccPort && bbPort ) {
    document.getElementById("transfer").style.display = "inline";
}

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
	    results.errors.splice(index,1);
	    return error.row;
	} else {
	    return -1;
	}
    }).filter(function(row) {
	return row >= 0;
    }).sort().reverse().forEach(function(row) {
	results.data.splice(row,1);
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
    ccPort.postMessage({"action":"upload","upload":grade});
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

/** If there's only one port, that's the best one.  If there's more than one,
 *  we hope that one is highlighted.  Otherwise, we don't know which to use
 *  and return false.  We also use this time to remove undefined ports
 *  (but so do background.js, so maybe this is unnecessary?). */
function bestPort(ports) {
    var highlightedPorts = [],
	definedPorts = [];
    for ( var tabId in ports ) {
	if ( ports[tabId] ) {
	    definedPorts.push(ports[tabId]);
	    if ( ports[tabId].sender.tab.highlighted ) {
		highlightedPorts.push(ports[tabId]);
	    }
	} else {
	    delete ports[tabId];
	}
    }
    if ( definedPorts.length === 1 ) {
	return definedPorts[0];
    }
    if ( highlightedPorts.length === 1 ) {
	return highlightedPorts[0];
    }
    return false;
}

/** The first element in the array that matches the given regular expression. */
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
