/* global chrome */

"use strict";

/** {tabid:port} for each port opened by the content scripts. */
var ports = { "blackboard":{}, "campusConnection":{} };

/** Port to campus connection.  One of ccPorts, picked by popup.js. */
var ccPort;

/** Tracks if Blackboard had to change to screen reader mode so that this can
 *  remind Blackboard what it was doing. Changed by popup.js. */
var bbState = undefined;

/** Takes the data from Blackboard and creates the file for downloading.
 *  Created in popup.js, because it can get the data easily and has already
 *  loaded Papa. */
var createDownload;

/** Turns things over to #register(port).  But first it may need to set
 *  port.sender.tab
 *  @param port The port registering the connection */
chrome.runtime.onConnect.addListener(function(port) {
    // the new options_ui doesn't have port.sender.tab
    if ( port.sender.tab && port.sender.tab.id ) {
	register(port);
    } else {
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

/** Puts port into the appropriate spot in ports.
 *  @param port The port to register */
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
	port.onMessage.addListener(function(message) {
	    if ( message.upload ) {
		ccPort.postMessage(message);
	    } else {
		createDownload(message);
	    }
	});
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
