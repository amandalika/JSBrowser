browser.on("init", function () {
    "use strict";
    const webview = document.querySelector('webview');
    webview.addEventListener('dom-ready', () => {
        webview.openDevTools();
    })

    var electron, app;

    function isElectron() {

        if (typeof require !== 'function') return false;
        if (typeof window !== 'object') return false;
        try {
            electron = require('electron');
            app = electron.remote.app;
        } catch (e) {
            return false;
        }
        if (typeof electron !== 'object') return false;
        return true;

    }

    // Show the refresh button
    this.showRefresh = () => {
        this.stopButton.classList.remove("stopButton");
        this.stopButton.classList.add("refreshButton");
        this.stopButton.title = "Refresh the page";
    };

    // Show the stop button
    this.showStop = () => {
        this.stopButton.classList.add("stopButton");
        this.stopButton.classList.remove("refreshButton");
        this.stopButton.title = "Stop loading";
    };

    // Listen for the stop/refresh button to stop navigation/refresh the page
    this.stopButton.addEventListener("click", () => {
        if (!isElectron()) {
            if (this.loading) {
                this.webview.stop(); // WWA-only API
                this.toggleProgressRing(false);
                this.showRefresh();
            }
            else {
                this.webview.refesh(); // WWA-only API
            }
        }
        else {
            if (this.webview.isLoading()) {
                this.stop();
                this.toggleProgressRing(false);
                this.showRefresh();
            }
            else {
                this.webview.reload();
            }
        }
    });



    // Update the navigation state
    if (!isElectron()) {
        this.updateNavState = () => {
            this.backButton.disabled = !this.webview.canGoBack; // WWA-only API
            this.forwardButton.disabled = !this.webview.canGoForward; // WWA-only API 
        };
    }
    else {
        this.updateNavState = () => {
            this.backButton.disabled = !this.webview.canGoBack();
            console.log("updating Nav");
            this.forwardButton.disabled= !this.webview.canGoForward();
        }
    }

    // Listen for the back button to navigate backwards
    if (!isElectron()) {
        this.backButton.addEventListener("click", () => this.webview.goBack()); // WWA-only API
    }
    else {
        this.backButton.addEventListener("click", () => this.webview.goBack());
    }
    // Listen for the forward button to navigate forwards
    if (!isElectron()) {
        this.forwardButton.addEventListener("click", () => this.webview.goForward()); // WWA-only API
    }
    else {
        this.forwardButton.addEventListener("click", () => this.webview.goForward());
    }
});
