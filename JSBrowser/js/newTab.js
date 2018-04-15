function firstVisibility() {
    if (document.visibilityState === "visible") {
        Windows.UI.ViewManagement.ApplicationView.getForCurrentView().title = "+";
        if (document.location.search.substr(1) === "first") {
            Windows.UI.ViewManagement.ApplicationViewSwitcher.tryShowAsStandaloneAsync(MSApp.getViewId(window.opener));
        }

        document.removeEventListener("visibilitychange", firstVisibility);
        document.addEventListener("visibilitychange", nextVisibility);
    }
}

function nextVisibility() {
    if (document.visibilityState === "visible") {
        window.opener.postMessage({ newTab: true }, location.origin);
        document.location.assign("default.html");
    }
}

if (document.visibilityState === "visible") {
    firstVisibility();
}
else {
    document.addEventListener("visibilitychange", firstVisibility);
}

