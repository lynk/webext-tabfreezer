'use strict';


var browser = (function () {
    return window.browser || window.chrome;
})();

var TF = {
    activeTabId: 0,
    freezerOverrideActive: false,
    browserButtonStates: {
        defaultState: 'off',
        on: {
            icon: {
                32: "/icons/tabfreezer_icon_blue_32.png",
                64: "/icons/tabfreezer_icon_blue_64.png"
            },
            title: 'TURN OFF Freezing',
            action: 'addUrl',
            nextState: 'off'
        },
        off: {
            icon: {
                32: '/icons/tabfreezer_icon_off.png',
                64: '/icons/tabfreezer_icon_off.png',
            },
            title: 'TURN ON Freezing',
            action: 'removeUrl',
            nextState: 'on'
        },
        override: {
            icon: {
                32: '/icons/tabfreezer_icon_green.png',
                64: '/icons/tabfreezer_icon_green.png',
            },
            title: 'Freezing ON HOLD'
        }
    },

    /**
     *
     *
     * @param tabId
     * @param changeInfo
     * @param tabInfo
     */
    onUpdatedTab: function (tabId, changeInfo = '', tabInfo = '') {

        // TODO: I want this to run only once
        //check if host is in storage
        browser.storage.local.get(["urls"], function (result) {

            const currentHost = TF.getHostFromUrl(tabInfo.url);

            if (result.urls !== undefined && result.urls.includes(currentHost)) {
                // Toggle button state on
                TF.toggleBrowserButton(tabId, TF.browserButtonStates.off.nextState);
                TF.startTabListening();
            }
            else {
                TF.toggleBrowserButton(tabId, TF.browserButtonStates.on.nextState);
            }
        })
    },

    /**
     * This handles the click on the browser button.
     * The title of the button acts as state
     *
     * @param tab
     */
    handleBrowserClick: function (tab) {

        browser.browserAction.getTitle({tabId: tab.id}, function (result) {

            const defaultState = TF.browserButtonStates.defaultState;

            // get next state
            let nextState;

            if (result == TF.browserButtonStates[defaultState].title) {
                nextState = TF.browserButtonStates[defaultState].nextState;
            }
            else {
                nextState = defaultState;
            }

            // Toogle buttons
            TF.updateBrowserButtons(TF.getHostFromUrl(tab.url), nextState);

            // Call add or remove url function
            TF[TF.browserButtonStates[nextState].action](tab);

            // Toggle listening for new tabs
            if (nextState != defaultState) {
                TF.startTabListening();
            }
        })
    },

    /**
     * TODO
     *
     * @param host
     * @param nextState
     */
    updateBrowserButtons: function (host, nextState) {

        // query for all tabs
        let queryObj = {};

        // query for tabs with this url
        if (host != 'reset') {
            queryObj = {url: "*://" + host + "/*"};
        }

        // Get all tabs with this query
        browser.tabs.query(queryObj, function (tabs) {
            // Toggle plugin icon on all tabs
            Object.keys(tabs).forEach(function (key) {
                TF.toggleBrowserButton(tabs[key].id, nextState)
            });
        })
    },

    toggleBrowserButton: function (tabId, nextState) {

        // toggle icon
        browser.browserAction.setIcon({
            tabId: tabId,
            path: TF.browserButtonStates[nextState].icon
        });

        // toggle title
        browser.browserAction.setTitle({
            tabId: tabId,
            title: TF.browserButtonStates[nextState].title
        });

        // toggle badge text
        browser.browserAction.setBadgeText({
            tabId: tabId,
            text: ''
        });

    },

    startTabListening: function () {
        browser.tabs.onCreated.addListener(TF.catchCreated);
    },

    /**
     * On key press toogle override feature, that lets you open the next
     * click in a new tab
     * -- beta
     * @param command
     */
    onKeyCommand: function (command) {


        if (command == 'freezer-override') {

            // Reset override flag if pressed again without opening a new tab
            if (TF.freezerOverrideActive === true) {
                TF.endOverride();
            } else {
                TF.startOverride();
            }
        }
    },

    startOverride: function () {

        TF.freezerOverrideActive = true;
    },

    endOverride: function () {

        TF.freezerOverrideActive = false;
    },

    catchCreated: function (tabs) {

        // Don't close tab if override active
        if (TF.freezerOverrideActive === true) {
            TF.endOverride();
        }
        else {
            // Check if the opener tab of the new tab is freezed (by the icon title)
            browser.browserAction.getTitle({tabId: tabs.openerTabId}, function (title) {
                if (title == TF.browserButtonStates.on.title) {

                    // Remove listener temporarily to prevent core errors
                    //browser.tabs.onUpdated.removeListener(TF.onUpdatedTab);
                    TF.closeTab(tabs.id);

                    TF.incremBadge(tabs.openerTabId);
                }
            })
        }


    },

    incremBadge: function (tabId) {

        browser.browserAction.getBadgeText({tabId: tabId}, function (text) {
            if (text !== '') {
                browser.browserAction.setBadgeText({tabId: tabId, text: (++text).toString()});
            } else {
                browser.browserAction.setBadgeText({tabId: tabId, text: '1'});
            }
        })
    },

    closeTab: function (tabId) {

        browser.tabs.remove(tabId, TF.onError);
        //re-add listener
        //browser.tabs.onUpdated.addListener(TF.onUpdatedTab);
    },

    onActivatedTab: function (tabs) {
        TF.activeTabId = tabs.tabId;
        TF.endOverride();
    },

    handleMessage: function (message) {

        switch (message.is) {
            case 'reset':
                TF.updateBrowserButtons('reset', 'off');
                break;
        }
    },

    addUrl: function (tab) {

        browser.storage.local.get(["urls"], function (result) {
            const host = TF.getHostFromUrl(tab.url);

            result.urls.push(host);
            const newUrls = [...new Set(result.urls.map(a => a))];

            browser.storage.local.set({urls: newUrls});
        });
    },

    removeUrl: function (tab) {

        browser.storage.local.get(["urls"], function (result) {
            const currentHost = TF.getHostFromUrl(tab.url);
            const newUrls = result.urls.filter(host => host != currentHost);
            browser.storage.local.set({urls: newUrls});

        });
    },

    /**
     * Some stackoverflow magic: get hostname of URL with
     * the location hostname property
     *
     * @param fullUrl
     * @returns {string}
     */
    getHostFromUrl: function (fullUrl) {
        const a = document.createElement('a');
        a.href = fullUrl;
        return a.hostname;
    },

    /**
     * On install: set up storage, counter
     * counter currently unused
     */
    onInstall: function (details) {

        switch (details.reason) {
            case 'install':

                browser.storage.local.get(['urls'], function (results) {

                    if (Object.keys(results).length === 0) {
                        browser.storage.local.set({
                            urls: [],
                            counter: 0
                        });
                    }
                });
                break;
        }
    },

    onError: function (error) {

        if (browser.runtime.lastError) {
            console.log(browser.runtime.lastError);

        }
    }
};

// Listeners

// Browser startup listener
browser.runtime.onInstalled.addListener(TF.onInstall);

// Tab being updated listener
browser.tabs.onUpdated.addListener(TF.onUpdatedTab);

// Tab activated/focused
browser.tabs.onActivated.addListener(TF.onActivatedTab);

// Browser button listener
browser.browserAction.onClicked.addListener(TF.handleBrowserClick);

// Key press listener
browser.commands.onCommand.addListener(TF.onKeyCommand);

// Listen for message
browser.runtime.onMessage.addListener(TF.handleMessage);

