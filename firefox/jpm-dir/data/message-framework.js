"use strict";

/** A unification of the messaging apis for Firefox and Chrome/Opera content
 *  scripts. Takes a name and message handler and sets up the appropriate
 *  ports and messager.  It then returns the function, so that
 *  returnedValue(jsonObject) sends the message to the background/main. */
function emitConnect(name,messageHandler) {
    var ret = function(message) {
	throw "undefined framework";
    };
    if ( typeof(chrome)!=="undefined"
	 && chrome.runtime && chrome.runtime.connect ) {
	console.log("mf.js#chromeBranch");
	var port = chrome.runtime.connect({"name":name});
	port.onMessage.addListener(messageHandler);
	ret = port.postMessage;
    } else if ( typeof(self)!=="undefined"
		&& self.port && self.port.emit && self.port.on ) {
	console.log("mf.js#fireFoxSelfBranch");
	ret = self.port.emit.bind(self.port.emit,"message");
	self.port.on("message",messageHandler);
	self.port.emit("connect",{"name":name});
    } else if ( typeof(addon)!=="undefined"
		&& addon.port && addon.port.emit && addon.port.on ) {
	console.log("mf.js#fireFoxAddonBranch");
	ret = addon.port.emit.bind(addon.port.emit,"message");
	addon.port.on("message",messageHandler);
	addon.port.emit("connect",{"name":name});
    } else {
	console.log("mf.js#noBranch");
    }
    return ret;
}
