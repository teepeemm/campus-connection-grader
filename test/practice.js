/** Override campusConnect.js#setGrade(trow) */
function setGrade(trow,index) {
    var table = trow.parentElement;
    // only do this on the last pass through the table
    if ( index !== table.rows.length-3 ) {
	return;
    }
    document.getElementById("GRADE_ROSTER_plus_other_stuff").rows[0].cells[1]
	.textContent = "Student " + useEmplId ? "ID#" : "email";
    for ( var i = table.rows.length-2 ; i > 0 ; i-- ) {
	table.removeChild(table.rows[i]);
    }
    var lastRow = table.rows[1];
    Object.keys(grade).sort().forEach(function(key,index) {
	successes++;
	entries++;
	var row = document.createElement("tr"),
	    withIndex = document.createElement("td"),
	    withKey = document.createElement("td"),
	    withVal = document.createElement("td");
	withIndex.textContent = index+1;
	withKey.textContent = key + ( useEmplId ? "" : "@..." );
	withVal.textContent = parenUF(grade[key]);
	row.appendChild(withIndex);
	row.appendChild(withKey);
	row.appendChild(withVal);
	table.insertBefore(row,lastRow);
    });
}

function parenUF(gradeIn) {
    return (!midtermGrades && /U|F/.test(gradeIn)) ? '('+gradeIn+')' : gradeIn;
}

function wait() {
    document.getElementById("WAIT_win0").style.display = "block";
    setTimeout(function() {
	document.getElementById("WAIT_win0").style.display = "none";
    },500);
}

document.getElementById("DERIVED_AA2_SAVE_PB").addEventListener("click",wait);
document.getElementById("DERIVED_SR_RSTR_DSP_UNGRD_ONLY$0")
    .addEventListener("change",wait);
document.getElementById("GRADE_ROSTER$fviewall$0")
    .addEventListener("click",wait);

/* Opera specific directions. */
if ( /OPR/.test(navigator.userAgent) ) {
    document.getElementById("operaOnly").style.display = "list-item";
    document.getElementById("bbPreface").textContent = "Choose";
}
