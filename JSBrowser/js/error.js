// read uri and webErrorStatus for query
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

const idToUri = {
    errorUri: { uri: query.uri, content: query.uri },
    webErrorStatus: { content: query.webErrorStatus },
    retryUri: { uri: query.uri },
    searchUri: { uri: "https://www.bing.com/search?q=" + encodeURIComponent(query.uri) },
    archiveUri: { uri: "https://web.archive.org/web/*/" + query.uri },
};

Object.keys(idToUri).forEach(name => {
    const element = document.getElementById(name);
    if (idToUri[name].uri) {
        element.setAttribute("href", idToUri[name].uri);
    }
    if (idToUri[name].content) {
        element.textContent = idToUri[name].content;
    }
})