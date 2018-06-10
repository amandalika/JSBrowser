browser.on("init", () => {
    function Deferral() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    function openDatabaseAsync(name, version, createFn) {
        const deferral = new Deferral();
        const openRequest = indexedDB.open(name, version);

        openRequest.onerror = error => deferral.reject(error);
        openRequest.onsuccess = db => deferral.resolve(db.target.result);
        openRequest.onupgradeneeded = upgradeDbEventArgs => {
            createFn(upgradeDbEventArgs, deferral);
        }

        return deferral.promise;
    }

    const dbAsync = openDatabaseAsync("uri-db", 1, (upgradeDbEventArgs, deferral) => {
        const db = upgradeDbEventArgs.target.result;
        db.onerror = errorEventArgs => deferral.reject(errorEventArgs);

        // Create an objectStore for this database
        const objectStore = db.createObjectStore("uris", { keyPath: "uri" });

        // define what data items the objectStore will contain
        objectStore.createIndex("title", "title", { unique: false });
        objectStore.createIndex("text", "text", { unique: false });
        objectStore.createIndex("isFavorite", "isFavorite", { unique: false });
        objectStore.createIndex("lastAccessDate", "lastAccessDate", { unique: false });
        objectStore.createIndex("visitCount", "visitCount", { unique: false });
        objectStore.createIndex("outgoingLinks", "outgoingLinks", { unique: false });
        objectStore.createIndex("incomingLinks", "incomingLinks", { unique: false });
    });

    browser.getUriInfoAsync = function (uri) {
        return dbAsync.then(db => {
            const deferral = new Deferral();
            const objectStore = db.transaction("uris", "readonly").objectStore('uris');
            const request = objectStore.get(uri);
            request.onerror = function (event) {
                deferral.reject(event);
            };
            request.onsuccess = function (event) {
                const entry = event.target.result || { uri };
                deferral.resolve(entry);
            };
            return deferral.promise;
        });
    }

    browser.updateUriInfoAsync = function (uri, partialEntry) {
        return dbAsync.then(db => {
            const deferral = new Deferral();
            const objectStore = db.transaction("uris", "readwrite").objectStore('uris');
            const request = objectStore.get(uri);
            request.onerror = function (event) {
                deferral.reject(event);
            };
            request.onsuccess = function (event) {
                // Get the old value that we want to update
                var entry = event.target.result || {};

                ["title", "text", "isFavorite", "lastAccessDate", "visitCount", "outgoingLinks", "incomingLinks"].forEach(name => {
                    if (partialEntry.hasOwnProperty(name)) {
                        entry[name] = partialEntry[name];
                    }
                });

                if (partialEntry.incrementVisitCount) {
                    if (entry.hasOwnProperty("visitCount")) {
                        ++entry["visitCount"];
                    }
                    else {
                        entry["visitCount"] = 1;
                    }
                }

                // Put this updated object back into the database.
                const requestUpdate = objectStore.put(entry);
                requestUpdate.onerror = function (event) {
                    deferral.reject(event);
                };
                requestUpdate.onsuccess = function (event) {
                    deferral.resolve();
                };
            };
            return deferral.promise;
        });
    }

    // text: partial text match for title, text, uri
    // isFavorite: true - only favorites, false - only non-fav, undefined - either
    // minDate/maxDate: only entries with lastAccessDate in specified range
    // queryId: only one query per ID. Cancels in progress query with same id.
    let queryIds = {};
    browser.queryUriInfosAsync = function (options, entryCallback) {
        return dbAsync.then(db => {
            options = options || {};
            options.queryId = options.queryId || Math.random();

            const deferral = new Deferral();
            let entries = [];

            let queryIdCount;
            if (queryIds[options.queryId]) {
                queryIdCount = ++queryIds[options.queryId];
            }
            else {
                queryIdCount = queryIds[options.queryId] = 1;
            }

            function filterByOptions(entry, options) {
                options = options || {};

                let match = true;
                if (match && options.hasOwnProperty("text")) {
                    match = entry.title.indexOf(options.text) >= 0 ||
                        entry.uri.indexOf(options.text) >= 0 ||
                        entry.text.indexOf(options.text) >= 0;
                }
                if (match && options.hasOwnProperty("isFavorite")) {
                    match = entry.isFavorite == options.isFavorite;
                }
                if (match && options.hasOwnProperty("minDate")) {
                    match = entry.minDate >= options.minDate;
                }
                if (match && options.hasOwnProperty("maxDate")) {
                    match = entry.maxDate <= options.maxDate;
                }
                return match;
            }
            const objectStore = db.transaction('uris').objectStore('uris');
            const cursor = objectStore.openCursor();

            cursor.onsuccess = function (event) {
                const cursor = event.target.result;
                let complete = false;

                if (cursor) {
                    if (filterByOptions(cursor.value, options)) {
                        if (entryCallback) {
                            entryCallback(cursor.value);
                        }
                        entries.push(cursor.value);
                    }

                    if (queryIds[options.queryId] === queryIdCount) {
                        cursor.continue();
                    }
                    else {
                        complete = true;
                    }
                }
                else {
                    complete = true;
                }

                if (complete) {
                    if (entryCallback) {
                        entryCallback(null);
                    }
                    deferral.resolve(entries);
                }
            };

            cursor.onerror = error => deferral.reject(error);

            return deferral.promise;
        });
    }
});