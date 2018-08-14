browser.on("newWebview", function () {
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
    var URI, host;

    if (!isElectron()) {
        URI = Windows.Foundation.Uri;
    }
    else {
         host = window.location.host;
    }

    // At times knowing only the current navigation event firing from the webview is not enough.
    // It is sometimes useful to know all of the navigation events that have fired for the current navigation.
    // This class aims to keep track of all the navigation events for the current navigation. It holds on to
    // the event args for all the following:
    //      MSWebViewNavigationStarting
    //      MSWebViewContentLoading
    //      MSWebViewDOMContentLoaded
    //      MSWebViewNavigationCompleted
    // Because of a peculiarity of webview navigation events, it is possible to get 2 NavigationCompleted
    // events. In the case of a navigation failure in which the HTTP server still returns web content, for
    // instance, we navigate to a page that doesn't exist on an HTTP server and it returns a fancy 404 page,
    // we will see the following navigation events:
    //      MSWebViewNavigationStarting
    //      MSWebViewNavigationCompleted { isSuccess: false, webErrorStatus: 404 }
    //      MSWebViewContentLoading
    //      MSWebViewDOMContentLoaded
    //      MSWebViewNavigationCompleted { isSuccess: true }
    // But in the case of a navigation to a URI that contains a hostname for a server that doesn't exist
    // we will only get one NavigationCompleted error:
    //      MSWebViewNavigationStarting
    //      MSWebViewNavigationCompleted { isSuccess: false, webErrorStatus: 404 }
    // Note that its also weird that we get a 404 when there is no server.
    // This class additionally exposes an aggregateNavigationCompleted event that fires after the last
    // NavigationCompleted event.
    function NavigationEventState(webview) {
        const eventNameToHandlersMap = {};
        this.addEventListener = (name, handler) => {
            if (!eventNameToHandlersMap.hasOwnProperty(name)) {
                eventNameToHandlersMap[name] = [handler];
            }
            else {
                eventNameToHandlersMap[name].push(handler);
            }
        };
        this.removeEventListener = (name, handler) => {
            const handlersList = eventNameToHandlersMap[name];
            handlersList.splice(handlersList.indexOf(handler), 1);
        };
        const dispatch = (name, args) => {
            eventNameToHandlersMap[name].forEach(handler => handler.call(null, args));
        };

        this.id = 0;
        const init = () => {
            ++this.id;
            this.navigationStarting = null;
            this.contentLoading = null;
            this.domContentLoaded = null;
            this.navigationCompleted1 = null;
            this.navigationCompleted2 = null;
        };
        init();

        webview.addEventListener("MSWebViewNavigationStarting", e => {
            init();
            this.navigationStarting = e;
        });

        webview.addEventListener("MSWebViewContentLoading", e => {
            this.contentLoading = e;
        })

        webview.addEventListener("MSWebViewDOMContentLoaded", e => {
            this.domContentLoaded = e;
        });

        webview.addEventListener("MSWebViewNavigationCompleted", e => {
            const matchId = this.id;
            if (!this.navigationCompleted1) {
                this.navigationCompleted1 = e;
                // In the case of failure and no content loading we don't know if this is because we failed
                // to navigate before getting content or because webview is firing the completed event for the
                // first time before getting the web content of the web server's error message. So we wait
                // a moment for the webview to fire ContentLoading.
                if (!e.isSuccess && !this.contentLoading) {
                    setTimeout(() => {
                        if (matchId === this.id && !this.contentLoading) {
                            // Now we trust the navigation completed event
                            dispatch("aggregateNavigationCompleted", {
                                uri: this.navigationCompleted1.uri,
                                isSuccess: this.navigationCompleted1.isSuccess,
                                webErrorStatus: this.navigationCompleted1.webErrorStatus,
                                hasContent: false
                            });
                        }
                    }, 100);
                }
                else {
                    dispatch("aggregateNavigationCompleted", {
                        uri: e.uri,
                        isSuccess: e.isSuccess,
                        webErrorStatus: e.webErrorStatus,
                        hasContent: !!this.contentLoading
                    });
                }
            }
            else {
                this.navigationCompleted2 = e;
                dispatch("aggregateNavigationCompleted", {
                    uri: this.navigationCompleted1.uri,
                    isSuccess: this.navigationCompleted1.isSuccess,
                    webErrorStatus: e.webErrorStatus,
                    hasContent: !!this.contentLoading
                });
            }
        });
    }

    this.navigationEventState = new NavigationEventState(this.webview);

    // Listen for the navigation start
    if (!isElectron()) {
        this.webview.addEventListener("MSWebViewNavigationStarting", e => { // run similar code for electron event listener
            this.loading = true;

            // Update the address bar
            this.currentUrl = e.uri;
            this.updateAddressBar(this.currentUrl);

            console.log(`Navigating to ${this.currentUrl}`);

            this.hideFavicon();
            this.toggleProgressRing(true);

            // Show the stop button
            this.showStop();

            // Create the C++ Windows Runtime Component
            let winRTObject = new NativeListener.KeyHandler();

            // Listen for an app notification from the WinRT object
            winRTObject.onnotifyappevent = e => this.handleShortcuts(e.target);

            // Expose the native WinRT object on the page's global object
            this.webview.addWebAllowedObject("NotifyApp", winRTObject);
        });
    }
    else {
        this.webview.addEventListener("did-start-loading", e => {
            
            // TODO: Uncomment after fixing address-bar.js
            //this.hideFavicon();
            //this.toggleProgressRing(true);

            // Show the stop button
            this.showStop();


        });
    }

    this.webview.addEventListener("dom-ready", e => {

        // Update the address bar
        this.currentUrl = webview.getURL();

        // TODO: Uncomment after fixing address-bar.js
        this.webview.updateAddressBar(this.currentUrl);

        console.log(`Navigating to ${this.currentUrl}`);

    })
    // Inject fullscreen mode hot key listener into the WebView with every page load
    this.webview.addEventListener("MSWebViewDOMContentLoaded", () => {
        let asyncOp = this.webview.invokeScriptAsync("eval", `
            addEventListener("keydown", e => {
                let k = e.keyCode;
                if (k === ${this.KEYS.ESC} || k === ${this.KEYS.F11} || (e.ctrlKey && k === ${this.KEYS.L})) {
                    NotifyApp.setKeyCombination(k);
                }
            });
        `);
        asyncOp.onerror = e => console.error(`Unable to listen for fullscreen hot keys: ${e.message}`);
        asyncOp.start();
    });

    // Listen for the navigation completion
    if (!isElectron()) {
        this.webview.addEventListener("MSWebViewNavigationCompleted", e => { // run similar code for electron event listener
            this.loading = false;
            this.toggleProgressRing(false);
            this.getFavicon(e.uri);

            // Update the page title
            this.title = webview.getURL();
            this.appView.title = this.webview.documentTitle;

            // Show the refresh button
            this.showRefresh();

            //Update the Navigation State
            this.updateNavState();

        });
    }
    else {
        this.webview.addEventListener("did-finish-load", e => {
            // TODO: Uncomment after fixing address-bar.js
            //this.toggleProgressRing(false);
            //this.getFavicon(e.uri);

            //Update the page title
            //this.appView.title = this.webview.documentTitle;

            //show the refresh button
            this.showRefresh();

            // Update the navigation state
            this.updateNavState();

        })
    }


    this.navigationEventState.addEventListener("aggregateNavigationCompleted", e => {
        if (!e.isSuccess && !e.hasContent) {
            this.webview.navigate("ms-appx-web:///error.html?" +
                "uri=" + encodeURIComponent(e.uri) + "&" +
                "webErrorStatus=" + encodeURIComponent(e.webErrorStatus));
        }
    });

    // Listen for unviewable content
    this.webview.addEventListener("MSWebViewUnviewableContentIdentified", e => {
        console.error(`Unviewable content: ${e.message}`);
        if (e.mediaType === "application/pdf") {
            Windows.System.Launcher.launchURIAsync(new URI(e.uri));
        }
    });

    // Listen for an unsupported URI scheme
    this.webview.addEventListener("MSWebViewUnsupportedURISchemeIdentified",
        e => console.error(`Unsupported URI scheme: ${e.message}`));

    // Listen for a new window
    this.webview.addEventListener("MSWebViewNewWindowRequested", e => {
        console.log("New window requested");
        e.preventDefault();
        window.open(e.uri);
    });

    // Listen for a permission request
    this.webview.addEventListener("MSWebViewPermissionRequested", e => {
        console.log("Permission requested");
        if (e.permissionRequest.type === "geolocation") {
            e.permissionRequest.allow();
        }
    });
});


