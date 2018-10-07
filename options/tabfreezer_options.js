var browser = (function () {
    return window.browser || window.chrome;
})();


document.addEventListener("DOMContentLoaded", function () {

    // add click listenr
    document.getElementById('tf-delete-submit').addEventListener('click', resetStorage);

    getNumberOfUrls();
});


/**
 * Print number of stored urls on options page
 */
function getNumberOfUrls() {

    browser.storage.local.get(["urls"], function (result) {
        document.getElementById("tf-counter").innerHTML = result.urls.length.toString();
    });
}

/**
 * Reset urls storage value to empty array
 * Message background script to toggle off all active buttons
 */
function resetStorage() {

    browser.storage.local.set({urls: []}, function () {
        document.getElementById("tf-counter").innerHTML = '0';
        browser.runtime.sendMessage({is: 'reset'});
    });
}