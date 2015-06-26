"use strict";

/** {tabid:port} for each port opened by the content scripts. */
var ports = { "blackboard":{}, "campusConnection":{}, "popup":null };

/** One of ports, picked by #bestPort(portsarray). */
var bbPort, ccPort;

/** Toggling screen reader mode is a page navigation, which causes the content
 *  script to reboot.  By setting this, when blackboard.js reconnects its port,
 *  background.js will remind blackboard.js what it's supposed to be doing. */
var bbState = undefined;

/** Turns things over to #register(port).  But first it may need to set
 *  port.sender.tab */
chrome.runtime.onConnect.addListener(function(port) {
    if ( port.sender.tab && port.sender.tab.id ) {
	register(port);
    } else if ( port.name === "popup" ) {
	ports.popup = port;
	port.onMessage.addListener(popupMessage);
	port.onDisconnect.addListener(function() {
	    ports.popup = null;
	});
    } else { // port.name === "campusConnection"
	// the new options_ui doesn't have port.sender.tab
	// so we specifically look for that tab
	chrome.tabs.query({
	    "url":'chrome://extensions/*?*options*=*'+chrome.runtime.id+'*'
	},function(tabs) {
	    var count = 0;
	    tabs.forEach(function(tab) {
		count++;
		// set port.sender.tab manually
		port.sender.tab = tab;
	    });
	    if ( count === 1 ) {
		// and make sure there's only one possibility
		register(port);
	    }
	});
    }
});

/** Puts port into the appropriate spot in ports. */
function register(port) {
    var name = port.name,
	tabId = port.sender.tab.id;
    ports[name][tabId] = port;
    port.onDisconnect.addListener(function() {
	chrome.tabs.get(tabId,function(tab) {
	    if ( ! chrome.runtime.lastError ) {
		chrome.pageAction.hide(tabId);
	    } // else, the tab is already closed
	});
	delete ports[name][tabId];
    });
    if ( name === "blackboard" ) {
	port.onMessage.addListener(blackboardMessage);
	if ( bbState ) {
	    // Blackboard was doing something when it had to switch to
	    // screen reader mode
	    port.postMessage({"action":bbState,"exitScreenReader":true});
	    bbState = undefined;
	}
    }
    // cc doesn't post messages, so we don't need onMessage.addListener
    chrome.pageAction.show(tabId);
}

function popupMessage(message) {
    if ( message.action === "getState" ) {
	bbPort = bestPort(ports.blackboard);
	ccPort = bestPort(ports.campusConnection);
	ports.popup.postMessage({"bbPort":Boolean(bbPort),
				 "ccPort":Boolean(ccPort)});
    } else if ( message.dest === "campusConnection" ) {
	ccPort.postMessage(message);
    } else if ( message.dest === "blackboard" ) {
	if ( message.action ) {
	    bbState = message.action;
	}
	bbPort.postMessage(message);
    } else {
	throw message;
    }
}

function blackboardMessage(message) {
    if ( message.upload ) {
	ccPort.postMessage(message);
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
