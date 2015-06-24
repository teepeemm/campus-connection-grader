var ToggleButton = require('sdk/ui/button/toggle').ToggleButton;
//var { ToggleButton } = require('sdk/ui/button/toggle');
var pageMod = require("sdk/page-mod");
var panels = require("sdk/panel");

var ports = { "blackboard":{}, "campusConnection":{} };

var ccPort;

var bbState = undefined;

var createDownload;

require("sdk/simple-prefs").on("practice",function() {
    require("sdk/tabs").open("./practice.html");
});

var button = ToggleButton({
    "id": "popup-button",
    "label": "Course Grades",
    "icon": {
	"16": "./images/icon-16.png",
	"32": "./images/icon-32.png",
	"64": "./images/icon-64.png"
    },
    "onChange": handleChange
});
function handleChange(state) {
    if ( state.checked ) {
	panel.show({"position": button});
    }
}

var panel = panels.Panel({
    "contentURL": "./popup.html",
    "onHide": handleHide
});
function handleHide() {
    button.state('window',{"checked": false});
}

pageMod.PageMod({
    "include": "https://studentadmin.connectnd.us/*",
    "contentScriptFile": ["./campusConnect.js"],
    "attachTo": ["existing", "frame"],
    "onAttach": register("campusConnection")
});

pageMod.PageMod({
    "include": [
	"https://online.und.edu/*",
	"https://bb.ndsu.nodak.edu/*",
	"https://bb.vcsu.edu/*",
	"https://minotstateu.blackboard.com/*"
    ],
    "contentScriptFile": ["./blackboard.js"],
    "attachTo": ["existing", "frame"],
    "onAttach": register("blackboard")
});

function register(site) {
    return function(worker) {
	worker.port.on('hello',function() {
	    ports[site][worker.tab.id] = worker;
	});
	if ( site === "blackboard" ) {
	    worker.port.on('upload',ccPort.emit);
	    worker.port.on('download',createDownload);
	    if ( bbState ) {
		worker.port.emit({"action":bbState,"exitScreenReader":true});
		bbState = undefined;
	    }
	}
    };
}
