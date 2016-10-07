// min ff version: 34

//var ToggleButton = require('sdk/ui/button/toggle').ToggleButton;
var { ToggleButton } = require('sdk/ui/button/toggle');
var pageMod = require("sdk/page-mod");
var panels = require("sdk/panel");
var tabs = require('sdk/tabs');

/** {tabid:port} for each port opened by the content scripts. */
var ports = { "blackboard":{}, "campusConnection":{}, "popup":null };

/** One of ports, picked by #bestPort(portsarray). */
var bbPort, ccPort;

/** Toggling screen reader mode is a page navigation, which causes the content
 *  script to reboot.  By setting this, when blackboard.js reconnects its port,
 *  background.js will remind blackboard.js what it's supposed to be doing. */
var bbState = undefined;

require("sdk/simple-prefs").on("practice",function() {
    require("sdk/tabs").open( {
	"url": "./practice.html",
	"onReady": function(tab) {
	    tab.attach({
		"contentScriptFile": [
		    "./message-framework.js",
		    "./campusConnect.js",
		    "./practice.js"
		]
	    });
	}
    });
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
	popupMessage({"action":"getState"});
    }
}

var panel = panels.Panel({
    "contentURL": "./popup.html",
    "onHide": handleHide,
    "onMessage": popupMessage
//    , "onShow": popupMessage.bind(undefined,{"action":"getState"})
});
ports.popup = panel.port;
function handleHide() {
    button.state('window',{"checked": false});
}
/*
panel.port.on("connect",function() {
    console.log("index.js#connectingPopup");
    ports.popup = panel.port;
});
*/
function popupMessage(message) {
    console.log("index.js#popupMessage");
    console.log(message);
    console.log("arguments length:"+arguments.length);
    if ( message.action === "getState" ) {
	console.log("index.js#popupMessage/getState");
	console.log(ports);
	bbPort = bestPort(ports.blackboard);
	ccPort = bestPort(ports.campusConnection);
	ports.popup.emit("message",{"bbPort":Boolean(bbPort),
				    "ccPort":Boolean(ccPort)});
    } else if ( message.dest === "campusConnection" ) {
	ccPort.emit("message",message);
    } else if ( message.dest === "blackboard" ) {
	if ( message.action ) {
	    bbState = message.action;
	}
	bbPort.emit("message",message);
    } else if ( message.action === "openPractice" ) {
	tabs.open("./practice.html");
    } else {
	throw message;
    }
}

pageMod.PageMod({
    "include": "https://studentadmin.connectnd.us/*",
    "contentScriptFile": ["./message-framework.js","./campusConnect.js"],
    "attachTo": ["existing", "top", "frame"],
    "onAttach": register("campusConnection")
});

pageMod.PageMod({
    "include": [
	"https://online.und.edu/*",
	"https://bb.ndsu.nodak.edu/*",
	"https://bb.vcsu.edu/*",
	"https://minotstateu.blackboard.com/*"
    ],
    "contentScriptFile": ["./message-framework.js","./blackboard.js"],
    "attachTo": ["existing", "top", "frame"],
    "onAttach": register("blackboard")
});

function register(site) {
    return function(worker) {
	console.log("registering:"+site);
	worker.port.on('connect',function() {
	    ports[site][worker.tab.id] = worker;
	});
	if ( site === "blackboard" ) {
	    worker.port.on('message',blackboardMessage);
	    if ( bbState ) {
		worker.port.emit("message",
				 {"action":bbState,"exitScreenReader":true});
		bbState = undefined;
	    }
	}
    };
}

function blackboardMessage(message) {
    if ( message.upload ) {
	ccPort.emit("message",message);
    } else {
	throw message;
    }
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
	    if ( ports[tabId].tab === tabs.activeTab ) {
		highlightedPorts.push(ports[tabId]);
	    }
	} else {
	    delete ports[tabId];
	}
    }
    if ( definedPorts.length === 1 ) {
	return definedPorts[0].port;
    }
    if ( highlightedPorts.length === 1 ) {
	return highlightedPorts[0].port;
    }
    return false;
}

/* // the default stuff
var self = require('sdk/self');

// a dummy function, to show how tests work.
// to see how to test this function, look at test/test-index.js
function dummy(text, callback) {
  callback(text);
}

exports.dummy = dummy;
*/
