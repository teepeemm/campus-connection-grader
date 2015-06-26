chrome.runtime.onConnect.addListener(function(port) {
    chrome.pageAction.show(port.sender.tab.id);
});
