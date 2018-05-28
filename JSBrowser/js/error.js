// Our contract for the error page is to provide information about the error and the failing URI in the
// query. We load the error page over ms-appx-web and don't provide it special abilities, so its OK that
// anyone can navigate us to our own error page with incorrect error information. Instead one could directly
// navigate to the error page, search page, etc.

// Parse the query property of the URI into name value pairs as properties on a JavaScript object.
const query = document.location.
    search. // ?a%23b=c%23d&x=y
    substr(1). // a%23b=c%23d&x=y
    split("&"). // a%23b=c%23d, x=y
    map(nameValueString => { // a%23b=c%23d
        return nameValueString.
            split("="). // a%23b, c%23d
            map(decodeURIComponent) // a#b, c#d
    }). // [[a#b, c#d], [x, y]]
    reduce((prev, cur) => {
        prev[cur[0]] = cur[1];
        return prev;
    }, {});

// Create a map from the element IDs to the properties to change on those IDs. Properties can either be
// 'uri' which sets the href attribute on the element or 'content' which sets the textContent of the element.
const idToUri = {
    errorUri: { uri: query.uri, content: query.uri },
    webErrorStatus: { content: query.webErrorStatus },
    retryUri: { uri: query.uri },
    searchUri: { uri: "https://www.bing.com/search?q=" + encodeURIComponent(query.uri) },
    archiveUri: { uri: "https://web.archive.org/web/*/" + query.uri },
};

// Now actually apply the idToUri map to elements.
Object.keys(idToUri).forEach(name => {
    const element = document.getElementById(name);
    if (idToUri[name].uri) {
        element.setAttribute("href", idToUri[name].uri);
    }
    if (idToUri[name].content) {
        element.textContent = idToUri[name].content;
    }
})

// Handle the common case of losing and gaining network access.
// If we start the error page with no network access, then its very likely we are on the error page because
// we have no network access. In that case, listen for the online event to tell us when we reconnect.
if (!window.navigator.onLine) {
    document.body.addEventListener("online", () => {
        // When we reconnect, try the failed URI again.
        document.location.href = query.uri;
    });
}