/* global chrome */

"use strict";

/** A boolean flag. */
var midtermGrades, useEmplId;

/** A counter. */
var successes, entries;

/** A DOM element. */
var pageContainer, table, unassignedBox;

/** An object with keys "mailto:username@" or "Student ID #" and
 *  values "grade". */
var grade;

initialize();

if ( unassignedBox && table && table.querySelector('select') ) {
    chrome.runtime.connect({"name":"campusConnection"})
	.onMessage.addListener(prepareToGrade);
}


/** Sets up the page's variables. */
function initialize() {
    pageContainer = document.querySelector("form");
    table = pageContainer
	&& pageContainer.querySelector('table[id^="GRADE_ROSTER"]');
    unassignedBox = pageContainer
	&& pageContainer.querySelector("#DERIVED_SR_RSTR_DSP_UNGRD_ONLY\\$0");
}

function prepareToGrade(message) {
    grade = message.upload;
    useEmplId = Object.keys(grade)
	.map(RegExp.prototype.test.bind(/^\d{7}$/))
	.reduce(function(prev,curr,index) {
	    if ( prev !== curr ) {
		throw new Exception("Changing key at:"+index);
	    }
	    return prev;
	});
    if ( unassignedBox.checked ) {
	inOrder(showAll,setGrades,save);
    } else {
	inOrder(showAll,toggleUnassigned,setGrades,toggleUnassigned,save);
    }
}

/** Executes the functions it's been given in the order they were given.
 *  Uses {@link #funcStaller(array)} to waits for Campus Connection to be ready
 *  before running each function. */
function inOrder() {
    if ( arguments.length > 0 ) {
	arguments[0]();
	funcStaller(Array.prototype.slice.call(arguments,1));
	// this boxes arguments into an array,
	// so they're not longer individual items
    }
}

/** Calls itself until Campus Connection is ready, at which point it returns to
 *  {@link #inOrder()}.
 *  @param {Array[function]} funcArray The functions to call, in order. */
function funcStaller(funcArray) {
    if ( document.getElementById("WAIT_win0").style.display === "none" ) {
	// funcArray is an array, so we need apply, not call
	inOrder.apply(undefined,funcArray);
    } else {
	setTimeout(funcStaller,100,funcArray);
    }
}

/** Clicks the "show all" button. */
function showAll() {
    initialize();
    var viewAll = document.getElementById("GRADE_ROSTER$fviewall$0");
    if ( /View ?(All|100)/i.test(viewAll.textContent) ) {
	viewAll.click();
    }
}

/** Toggles the "Show Only Unassigned" box. */
function toggleUnassigned() {
    initialize();
    unassignedBox.click();
}

/** Clicks the "Save" button, to remove the warning that nothing has been saved.
 */
function save() {
    initialize();
    document.getElementById("DERIVED_AA2_SAVE_PB").click();
}

/** Enters the course grades.  Public so that {@link practice.js} can
 *  list the grades, instead of enter them. */
function setGrades() {
    initialize();
    // if final grades are available, don't enter failling grades
    var gradeOptions = pageContainer
	.querySelectorAll('select#DERIVED_SR_GRD_RSTR_TYPE_SEQ option');
    midtermGrades = gradeOptions.length === 1
	&& /Mid.?Term ?Grade/i.test(gradeOptions[0].textContent);
    successes = 0;
    entries = 0;
    Array.prototype.slice.call(table.rows,1,-1).forEach(setGrade);
    warnings(entries,successes,Object.keys(grade).length);
}

/** Overriden in practice.js.
 *  @param trow The html row that we want to set. */
function setGrade(trow) {
    var selector = trow.querySelector("select");
    if ( selector ) {
	entries++;
	var key = useEmplId
	    ? trow.querySelector('span[id*="GRADE_ROSTER_EMPLID"]').textContent
	    : trow.querySelector('a[href^="mailto:"]').href
	    .replace(/^mailto:/,"").replace(/@.*$/,"");
	if ( key in grade ) {
	    grade[key] = grade[key].charAt(0);
	    // if final grades are available, don't enter failling grades
	    if ( midtermGrades || ! /U|F/.test(grade[key]) ) {
		selector.value = grade[key];
	    }
	    successes++;
	}
    }
}

/** Displays a warning if the number of grades doesn't seem right.
 * 
 * @param {int} entries The number of entries in the grade roster
 * @param {int} successes The number of grades (that could be) entered into the grade roster
 * @param {int} gradesAvailable The number of grades found in the csv. */
function warnings(entries,successes,gradesAvailable) {
    var manyBlanks = (entries-successes) > ( successes/4 );
    var manyUnused = ( (gradesAvailable-successes) > ( successes/4 ) )
	|| ( gradesAvailable < entries/4 );
    var message;
    if ( manyUnused && manyBlanks ) {
	message = "There were many discrepancies between the grade rosters.  "
	    +"This may mean that you loaded the wrong course.  "
	    +'Click "Ok" to keep the grades, or '
	    +'"Cancel" to remove all grades.';
	if ( ! confirm(message) ) {
	    table.querySelectorAll("select").forEach(blankRow);
	}
    } else if ( manyUnused || manyBlanks ) {
	if ( manyUnused ) {
	    message = "There were many grades in the file that were not "
		+"uploaded. This may mean that you are only viewing a "
		+"portion of your students in Campus Connection.  "
		+"When you are viewing more "
		+'students, click the button "Reload Grades".';
	} else {
	    message = "There are many grades in Campus Connection left to fill "
		+"in.  This may mean that you only uploaded a portion of "
		+"your entire course.";
	}
	alert(message);
    }
}

/** Removes any grade from a row in the grade roster.
 * @param selector The select widget for entering grades. */
function blankRow(selector) {
    selector.selectedIndex = 0;
}
