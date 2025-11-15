// Create a DevTools panel for network inspection
chrome.devtools.panels.create(
  "Network Debugger Plus",
  "", // No icon for now
  "panel.html",
  function(panel) {
    console.log("Network Debugger Plus panel created");
  }
);

