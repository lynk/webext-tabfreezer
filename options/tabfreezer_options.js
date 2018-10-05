var browser = (function () {
    return window.browser || window.chrome;
})();


document.addEventListener("DOMContentLoaded", function () {

    document.getElementById('tf-delete-submit').addEventListener('click', resetStorage);

    getNumberOfUrls();
});


function getNumberOfUrls() {

    browser.storage.local.get(["urls"], function (result) {
        document.getElementById("tf-counter").innerHTML = result.urls.length.toString();
    });
}

function resetStorage() {

    browser.storage.local.set({urls: []}, function () {
        document.getElementById("tf-counter").innerHTML = '0';
    });

    browser.runtime.sendMessage({is: 'reset'});

}