(function () {
    "use strict";

    // Enable nodelists to work with the spread operator
    NodeList.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];

    // The event symbol used to store event data
    const EVENT_SYMBOL = Symbol("events");

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

    // Browser constructor
    function Browser() {
        this[EVENT_SYMBOL] = {};
        this.currentUrl = "";
        this.lastCrashUrl = "";
        this.lastCrashUrlCrashCount = 0;
        this.faviconLocs = new Map;
        this.favorites = new Map;
        this.loading = false;
        this.isFullscreen = false;

        //If running on Electron, build Electron-specific files
        if (isElectron()) {

            this.roamingFolder = app.getPath("userData");
            this.appView = app.getPath("appData");

        }
        //Else create windows specific files and run code which doesn't involve electron or windows. 
        else {

            this.roamingFolder = Windows.Storage.ApplicationData.current.roamingFolder;
            this.appView = Windows.UI.ViewManagement.ApplicationView.getForCurrentView();

        }
        this.startPage = "https://microsoftedge.github.io/JSBrowser/";
    }

    Browser.prototype = {
        constructor: Browser,

        // Simple event management - listen for a particular event
        on(type, listener) {
            let listeners = this[EVENT_SYMBOL][type] || (this[EVENT_SYMBOL][type] = []);

            if (listeners.indexOf(listener) < 0) {
                listeners.push(listener);
            }
            return this;
        },

        // Simple event management - stop listening for a particular event
        off(type, listener) {
            let listeners = this[EVENT_SYMBOL][type],
                index = listeners ? listeners.indexOf(listener) : -1;

            if (index > -1) {
                listeners.splice(index, 1);
            }
            return this;
        },

        // Simple event management - trigger a particular event
        trigger(type) {
            let event = { type };
            let listeners = this[EVENT_SYMBOL][type] || [];
            listeners.forEach(listener => listener.call(this, event));
            return this;
        }
    };

    // Create browser instance
    let browser = new Browser;

    // Holds the fullscreen message timeout ID
    let fullscreenMessageTimeoutId;

    addEventListener("DOMContentLoaded", function () {
        // Get the UI elements

        // The normal webview created via HTML is in proc.
        // Replace it with a webview created via new MSWebView for an out of proc webview.



        Object.assign(this, {
            "addFavButton": document.querySelector("#addFavButton"),
            "backButton": document.querySelector("#backButton"),
            "citation": document.querySelector("#citation"),
            "clearCacheButton": document.querySelector("#clearCacheButton"),
            "clearFavButton": document.querySelector("#clearFavButton"),
            "container": document.querySelector(".container"),
            "element": document.querySelector("#browser"),
            "favButton": document.querySelector("#favButton"),
            "favicon": document.querySelector("#favicon"),
            "favList": document.querySelector("#favorites"),
            "favMenu": document.querySelector("#favMenu"),
            "forwardButton": document.querySelector("#forwardButton"),
            "fullscreenButton": document.querySelector("#goFullscreen"),
            "fullscreenMessage": document.querySelector("#fullscreenMessage"),
            "hideFullscreenLink": document.querySelector("#hideFullscreen"),
            "newTabSetting": document.querySelector("#newTabSetting"),
            "progressRing": document.querySelector(".ring"),
            "settingsButton": document.querySelector("#settingsButton"),
            "settingsMenu": document.querySelector("#settingsMenu"),
            "stopButton": document.querySelector("#stopButton"),
            "tweetIcon": document.querySelector("#tweet"),
            "urlInput": document.querySelector("#urlInput"),
            "webview": document.querySelector("#WebView"),
            "webviewZoom": document.querySelector("#webviewZoom")
        });

        this.applyWebviewZoom = state => {
            const minValue = this.webviewZoom.getAttribute("min");
            const maxValue = this.webviewZoom.getAttribute("max");
            const scaleValue = Math.max(Math.min(parseInt(this.webviewZoom.value, 10), maxValue), minValue) / 100;

            // Use setAttribute so they all change together to avoid weird visual glitches
            this.webview.setAttribute("style", [
                ["width", (100 / scaleValue) + "%"],
                ["height", "calc(" + (-40 / scaleValue) + "px + " + (100 / scaleValue) + "%)"],
                ["transform", "scale(" + scaleValue + ")"]
            ].map(pair => pair[0] + ": " + pair[1]).join("; "));
        };

        try {
            if (JSON.parse(localStorage["newTabSetting"])) {
                let newTab = window.open("newTab.html?first", null, "msHideView=yes");
                if (!isElectron()) {
                    Windows.UI.ViewManagement.ApplicationViewSwitcher.tryShowAsStandaloneAsync(MSApp.getViewId(newTab))
                }
                window.addEventListener("message", messageEvent => {
                    if (messageEvent.data.newTab) {
                        let newTab = window.open("newTab.html", null, "msHideView=yes");
                        if (!isElectron()) {
                            Windows.UI.ViewManagement.ApplicationViewSwitcher.tryShowAsStandaloneAsync(MSApp.getViewId(newTab)).then(() => {
                                Windows.UI.ViewManagement.ApplicationViewSwitcher.tryShowAsStandaloneAsync(MSApp.getViewId(messageEvent.source));
                            });
                        }
                    }
                });
            }
        }
        catch (e) { }

        this.replaceWebView = () => {
            let webview = document.querySelector("#WebView");
            // Cannot access webview.src - anything that would need to communicate with the webview process may fail
            let oldSrc = browser.currentUrl;
            const webviewParent = webview.parentElement;
            webviewParent.removeChild(webview);
            if (!isElectron()) {
                webview = new MSWebView();
            }
            Object.assign(this, {
                "webview": webview
            });
            webview.setAttribute("id", "WebView");

            // During startup our currentUrl field is blank. If the WebView has crashed 
            // and we were on a URI then we may obtain it from this property.
            if (browser.currentUrl && browser.currentUrl != "") {
                this.trigger("newWebview");
                this.navigateTo(browser.currentUrl);
            }
            webviewParent.appendChild(webview);

            // Replace the webview with a new instance if the old one crashes.
            webview.addEventListener("MSWebViewProcessExited", () => {
                if (browser.currentUrl === browser.lastCrashUrl) {
                    ++browser.lastCrashUrlCrashCount;
                }
                else {
                    browser.lastCrashUrl = browser.currentUrl;
                    browser.lastCrashUrlCrashCount = 1;
                }
                // If we crash again and again on the same URI, maybe stop trying to load that URI.
                if (browser.lastCrashUrlCrashCount >= 3) {
                    browser.lastCrashUrl = "";
                    browser.lastCrashUrlCrashCount = 0;
                    browser.currentUrl = browser.startPage;
                }
                this.replaceWebView();
            });

            // Apply the webview zoom immediately so we don't have to worry about duplicating CSS properties.
            this.applyWebviewZoom();
        };

        // Call this immediately to switch to out of proc webview.
        if (!isElectron()) {
            this.replaceWebView();
        }

        // Apply the fullscreen mode
        this.applyFullscreenMode = state => {
            let mode = state;
            if (typeof state != "boolean") {
                mode = this.appView.isFullScreenMode;
                if (mode === this.isFullscreen) {
                    return;
                }
            }
            this.isFullscreen = mode;
            if (this.isFullscreen) {
                // Go fullscreen
                this.element.classList.add("fullscreen");
                this.fullscreenMessage.style.display = "block";
                this.fullscreenMessage.classList.add("show");
                this.fullscreenButton.textContent = "Exit full screen (F11)";

                // Clear the timeout again to ensure there are no race conditions
                clearTimeout(fullscreenMessageTimeoutId);
                fullscreenMessageTimeoutId = setTimeout(this.hideFullscreenMessage, 4e3);
            }
            else {
                // Hide fullscreen
                this.element.classList.remove("fullscreen");
                this.fullscreenMessage.style.display = "none";
                this.fullscreenButton.textContent = "Go full screen (F11)";
                this.hideFullscreenMessage();
            }
        };

        // Close the menu
        this.closeMenu = () => {
            if (!this.element.className.includes("animate")) {
                return;
            }
            let onTransitionEnd = () => {
                this.element.removeEventListener("transitionend", onTransitionEnd);
                this.togglePerspective();
                this.toggleFavMenu(true);
                this.scrollFavoritesToTop();
                this.toggleSettingsMenu(true);
            };

            this.element.addEventListener("transitionend", onTransitionEnd);
            this.togglePerspectiveAnimation();

            // Reset the title bar colors
            this.setDefaultAppBarColors();
        };

        // Handle keyboard shortcuts
        this.handleShortcuts = keyCode => {
            switch (keyCode) {
                case this.KEYS.ESC:
                    if (this.isFullscreen) {
                        this.appView.exitFullScreenMode();
                    }
                    break;

                case this.KEYS.F11:
                    this.appView[this.isFullscreen ? "exitFullScreenMode" : "tryEnterFullScreenMode"]();
                    break;

                case this.KEYS.L:
                    if (!this.isFullscreen) {
                        this.urlInput.focus();
                        this.urlInput.select();
                    }
                    break;
            }
        };

        // Hide the fullscreen message
        this.hideFullscreenMessage = () => {
            clearTimeout(fullscreenMessageTimeoutId);
            this.fullscreenMessage.classList.remove("show");
        };

        // Open the menu
        this.openMenu = () => {
            this.togglePerspective();

            setImmediate(() => {
                this.togglePerspectiveAnimation();

                // Adjust AppBar colors to match new background color
                this.setOpenMenuAppBarColors();

            });
        };

        // Apply CSS transitions when opening and closing the menus
        this.togglePerspective = () => {
            this.element.classList.toggle("modalview");
        };
        this.togglePerspectiveAnimation = () => {
            this.element.classList.toggle("animate");
        };

        // Hot key codes
        this.KEYS = { "ESC": 27, "L": 76, "F11": 122 };

        // Set the initial states
        this.backButton.disabled = true;
        this.forwardButton.disabled = true;

        if (!isElectron()) {
            // Use a proxy to workaround a WinRT issue with Object.assign
            this.titleBar = new Proxy(this.appView.titleBar, {
                "get": (target, key) => target[key],
                "set": (target, key, value) => (target[key] = value, true)
            });
        }

        // Listen for fullscreen mode hot keys
        addEventListener("keydown", e => {
            let k = e.keyCode;
            if (k === this.KEYS.ESC || k === this.KEYS.F11 || (e.ctrlKey && k === this.KEYS.L)) {
                this.handleShortcuts(k);
            }
        });

        if (!isElectron()) {
            // Listen for a change in fullscreen mode
            this.appView.addEventListener("visibleboundschanged", () => this.applyFullscreenMode());
        }

        // Listen for the webview zoom control changes.
        this.webviewZoom.addEventListener("change", () => this.applyWebviewZoom());

        // Listen for a click on the skewed container to close the menu
        this.container.addEventListener("click", () => this.closeMenu());

        // Listen for the hide fullscreen link
        this.hideFullscreenLink.addEventListener("click", () => this.appView.exitFullScreenMode());

        // Initialize fullscreen mode
        this.applyFullscreenMode(false);

        // Fire event
        this.trigger("init");
        this.trigger("newWebview");

        // Navigate to the start page

        this.navigateTo(this.startPage);

    }.bind(browser));

    // Export `browser`
    window.browser = browser;

})();
