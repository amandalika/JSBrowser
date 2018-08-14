﻿browser.on("init", function () {
    "use strict";

    const EMPTY_FAVICON = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIj8+Cjxzdmcgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogPCEtLSBDcmVhdGVkIHdpdGggU1ZHLWVkaXQgLSBodHRwOi8vc3ZnLWVkaXQuZ29vZ2xlY29kZS5jb20vIC0tPgogPGc+CiAgPHRpdGxlPkxheWVyIDE8L3RpdGxlPgogIDx0ZXh0IHhtbDpzcGFjZT0icHJlc2VydmUiIHk9IjI3LjUiIHg9IjIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBzdHJva2Utd2lkdGg9IjAiIHN0cm9rZS1saW5lam9pbj0ibnVsbCIgc3Ryb2tlLWxpbmVjYXA9Im51bGwiIHN0cm9rZS1kYXNoYXJyYXk9Im51bGwiIHN0cm9rZT0iIzAwMDAwMCIgZmlsbD0iIzAwMDAwMCIgZm9udC1zaXplPSIxNXB4IiBmb250LWZhbWlseT0iU2Vnb2UgTURMMiBBc3NldHMiIGlkPSJzdmdfMyI+7p+DPC90ZXh0PgogPC9nPgo8L3N2Zz4=";
    const LOC_CACHE = new Map;
    const RE_VALIDATE_URL = /^[-:.&#+()[\]$'*;@~!,?%=\/\w]+$/;
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
    var URI, host, path, query;

    if (!isElectron()) {
        URI = Windows.Foundation.Uri;
    }
    else {
        // host = window.location.host;
    }

    let faviconFallback = [];

    // Attempt a function
    function attempt(func) {
        try {
            return func();
        }
        catch (e) {
            return e;
        }
    }

    // Check if a file exists at the specified URL
    function fileExists(url) {
        return new Promise(resolve =>
            Windows.Web.Http.HttpClient()
                .getAsync(new URI(url), Windows.Web.Http.HttpCompletionOption.responseHeadersRead)
                .done(e => resolve(e.isSuccessStatusCode), () => resolve(false))
        );
    }

    // Navigate to the specified absolute URL
    function navigate(webview, url, silent) {
        var result;
        if (isElectron()) {
            let resp = attempt(() => webview.loadURL(url));
            result = !(resp instanceof Error);

            if (!silent && !result) {
                console.error(`Unable to navigate to ${url}: ${resp.message}`);
            }

        }
        else {
            let resp = attempt(() => webview.navigate(url));
            result = !(resp instanceof Error);

            if (!silent && !result) {
                console.error(`Unable to navigate to ${url}: ${resp.message}`);
            }
        }
        return result;
    }

    // Show the favicon if available
    this.getFavicon = loc => {
        let host = new URI(loc).host;

        // Exit for cached ico location
        if (this.faviconLocs.has(host)) {
            loc = this.faviconLocs.get(host);
            if (loc) {
                this.favicon.src = loc;
            }
            else {
                this.hideFavicon();
            }
            return;
        }
        // Asynchronously check for a favicon in the web page markup
        let asyncOp = this.webview.invokeScriptAsync("eval", `
            JSON.stringify(Array.from(document.getElementsByTagName('link'))
                .filter(link => link.rel.includes('icon'))
                .map(link => link.href))
        `);
        asyncOp.oncomplete = e => {
            // Parse result add fallbacks
            faviconFallback = JSON.parse(e.target.result);

            let protocol = loc.split(":")[0];
            if (protocol.startsWith("http") || !host) {
                loc = `${protocol}://${host}/favicon.ico`;
                faviconFallback.push(loc);
            }

            faviconFallback.push(EMPTY_FAVICON);
            this.setFavicon(faviconFallback.shift());
        };
        asyncOp.onerror = e => {
            console.error(`Unable to find favicon in markup: ${e.message}`);
            faviconFallback = [];
            this.setFavicon(EMPTY_FAVICON);
        };
        asyncOp.start();
    };

    // Hide the favicon
    this.hideFavicon = () => {
        this.favicon.src = "";
    };

    // Navigate to the specified location
    this.navigateTo = loc => {
        loc = LOC_CACHE.get(loc) || loc;

        // Check if the input value contains illegal characters
        let isUrl = RE_VALIDATE_URL.test(loc);
        if (isUrl && navigate(this.webview, loc, true)) {
            return;
        }
        let bingLoc = `https://www.bing.com/search?q=${encodeURIComponent(loc)}`;
        let locHTTP = `http://${loc}`;
        let locHTTPS = `https://${loc}`;

        console.log(`Unable to navigate to ${loc}\nAttemping to prepend http(s):// to URI...`);

        let uri = attempt(() => new URI(locHTTP));
        let isErr = uri instanceof Error;

        if (isErr || !isUrl || !uri.domain) {
            let message = isErr ? uri.message : "";
            console.log(`Prepend unsuccessful\nQuerying bing.com... "${loc}": ${message}`);

            LOC_CACHE.set(loc, bingLoc);
            navigate(this.webview, bingLoc);
        }
        else {
            // Check if the site supports https
            fileExists(locHTTPS).then(exists => {
                if (exists) {
                    LOC_CACHE.set(loc, locHTTPS);
                    navigate(this.webview, locHTTPS);
                }
            });

            // Get a head start on loading via http
            LOC_CACHE.set(loc, locHTTP);
            navigate(this.webview, locHTTP);
        }
    };

    // Set the favicon to a specified URL
    this.setFavicon = url => {
        this.favicon.src = url;
    };

    // Show or hide the progress ring
    this.toggleProgressRing = state => {
        let style = this.progressRing.style; // this may not be working
        let isHidden = typeof state == "boolean" ? state : style.display == "none";
        style.display = isHidden ? "block" : "none";
    };

    // Update the address bar with the given text and remove focus
    if (!isElectron()) {
        this.updateAddressBar = text => {
            this.urlInput.value = text;
            this.urlInput.blur();
        };
    }
    else {
        this.webview.updateAddressBar = text => {
            this.urlInput.value = text;
            this.urlInput.blur();
        }
    } 
    

        // Use the fallback list if a favicon fails to load, otherwise hide the favicon
        this.favicon.addEventListener("error", () => {
            if (!this.favicon.src.startsWith("ms-appx://")) {
                if (faviconFallback.length) {
                    this.setFavicon(faviconFallback.shift());
                }
                else {
                    this.hideFavicon();
                }
            }
        });

        // Listen for a successful favicon load
        this.favicon.addEventListener("load", e => {
            faviconFallback.length = 0;
            //this.faviconLocs.set(new URI(this.currentUrl).host, e.target.src);
        });

        // Listen for the tweet button
        this.tweetIcon.addEventListener("click", () => {
            let domain = (this.currentUrl && new URI(this.currentUrl).host) || "microsoft.com";
            let path = "https://twitter.com/intent/tweet";
            let tags = ["Windows", "UWP"].map(encodeURIComponent);
            let text = encodeURIComponent(`I visited ${domain} in a browser built with HTML and JavaScript \u{1F332}. Find out more here:`);
            let url = encodeURIComponent("http://bit.ly/1IDpBVA");
            this.navigateTo(`${path}?hashtags=${tags.join()}&text=${text}&url=${url}`);
        });



        // Listen for the loss of focus on the address bar to unselect the text
        this.urlInput.addEventListener("blur", () => getSelection().removeAllRanges());

        // Listen for focus on the address bar to auto-select the text
        // Use `setImmediate` to prevent the text from being immediately unselected
        this.urlInput.addEventListener("focus", e => setImmediate(() => e.target.select()));

        // Listen for the Enter key in the address bar to navigate to the specified URL
        this.urlInput.addEventListener("keypress", e => {
            if (e.keyCode === 13) {
                this.navigateTo(urlInput.value.trim());
            }
        });
    });
