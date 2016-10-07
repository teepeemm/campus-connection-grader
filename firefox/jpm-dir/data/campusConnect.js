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

var poster;

initialize();

if ( unassignedBox && table && table.querySelector('select') ) {
    // assignment only for debugging purposes
    poster = emitConnect("campusConnection",prepareToGrade);
    console.log("registered campusConnection");
    console.log(poster);
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

function inOrder() {
    if ( arguments.length > 0 ) {
	arguments[0]();
	funcStaller(Array.prototype.slice.call(arguments,1));
	// this boxes arguments into an array,
	// so they're no longer individual items
    }
}

function funcStaller(funcArray) {
    if ( document.getElementById("WAIT_win0").style.display === "none" ) {
	// funcArray is an array, so we need apply, not call
	inOrder.apply(undefined,funcArray);
    } else {
	setTimeout(funcStaller,100,funcArray);
    }
}

function showAll() {
    initialize();
    var viewAll = document.getElementById("GRADE_ROSTER$fviewall$0");
    if ( /View ?(All|100)/i.test(viewAll.textContent) ) {
	viewAll.click();
    }
}

function toggleUnassigned() {
    initialize();
    unassignedBox.click();
}

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
	&& /Mid.?Term ?Grade/i.test(gradeOptions.textContent);
    successes = 0;
    entries = 0;
    Array.prototype.slice.call(table.rows,1,-1).forEach(setGrade);
    warnings(entries,successes,Object.keys(grade).length);
}

/** Overriden in practice.js. */
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

function warnings(entries,successes,gradesAvailable) {
    var manyBlanks = (entries-successes) > ( successes/4 );
    var manyUnused = ( (gradesAvailable-successes) > ( successes/4 ) )
	|| ( gradesAvailable < entries );
    var message;
    if ( manyUnused && manyBlanks ) {
	message = "There were discrepancies between the grade rosters.  "
	    +"This may mean that you loaded the wrong course.  "
	    +'Click "Ok" to keep the grades, or '
	    +'"Cancel" to remove all grades.';
	if ( ! confirm(message) ) {
	    table.querySelectorAll("select").forEach(blankRow);
	}
    } else if ( manyUnused || manyBlanks ) {
	if ( manyUnused ) {
	    message = "There were grades in the file that were not "
		+"uploaded. This may mean that you are only viewing a "
		+"portion of your students in Campus Connection.  "
		+"When you are viewing more "
		+'students, click the button "Reload Grades".';
	} else {
	    message = "There are grades in Campus Connection left to fill "
		+"in.  This may mean that you only uploaded a portion of "
		+"your entire course.";
	}
	alert(message);
    }
}

function blankRow(selector) {
    selector.selectedIndex = 0;
}
