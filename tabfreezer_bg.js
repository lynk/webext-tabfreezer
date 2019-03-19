'use strict';


var browser = (function () {
    return window.browser || window.chrome;
})();

var TF = {
    freezeHosts: [],
    ranOnce: false,
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

        const currentHost = TF.getHostFromUrl(tabInfo.url);

        if (TF.freezeHosts !== undefined && TF.freezeHosts.includes(currentHost)) {
            // Toggle button state on
            TF.toggleBrowserButton(tabId, TF.browserButtonStates.off.nextState);
            TF.startTabListening();
        }
        else {
            TF.toggleBrowserButton(tabId, TF.browserButtonStates.on.nextState);
        }
    },

    updateHosts: () => {

        browser.storage.local.get(["urls"], function (result) {
            TF.freezeHosts = result.urls;
        });
    },

    /**
     * This handles the click on the browser button.
     * The current title of the browser button represents the state
     *
     * @param tab
     */
    handleBrowserClick: function (tab) {

        // never activate for firefox and chrome internal pages
        if (!tab.url.includes('about:') && !tab.url.includes('chrome:')) {

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

                // Toggle buttons on all taby
                TF.updateBrowserButtons(TF.getHostFromUrl(tab.url), nextState);

                // Call add or remove url function
                TF[TF.browserButtonStates[nextState].action](tab);

                // Toggle listening for new tabs
                if (nextState != defaultState) {
                    TF.startTabListening();
                }
            });
        }
    },

    updateBrowserButtons: function (host, nextState) {

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

        // catch All
        // If Listener is active
        if (browser.webNavigation.onCreatedNavigationTarget.hasListener(TF.catchCreatedAny) === true) {

        }
        else {
            browser.webNavigation.onCreatedNavigationTarget.addListener(TF.catchCreatedAny);
        }

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

        // TODO: check and end
        setTimeout(()=> {
            TF.endOverride();
        }, 6000)
    },

    endOverride: function () {
        TF.freezerOverrideActive = false;
    },

    catchCreatedTab: function (tabwindow) {

        if (tabwindow.hasOwnProperty('alwaysOnTop')) {

            browser.tabs.query({
                windowId: tabwindow.id
            }, function (res) {

            });


        }
        else {

            var tabs = tabwindow;

            // TODO: chrome: chrome runs this multi tab for evey new tab
            // TODO: the override flag is reset to early for chrome

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
        }

    },

    catchCreatedAny: function (details) {

        // Don't close popup if override active
        if (TF.freezerOverrideActive == true) {
            TF.endOverride();
        }
        else {
            // Check if the opener tab of the new popup is freezed (by the icon title)
            browser.browserAction.getTitle({tabId: details.sourceTabId}, function (title) {
                if (title == TF.browserButtonStates.on.title) {

                    // Remove listener temporarily to prevent core errors
                    //browser.tabs.onUpdated.removeListener(TF.onUpdatedTab);
                    TF.closeTab(details.tabId);
                    TF.incremBadge(details.sourceTabId);
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

    /**
     * Handle incoming messages
     *
     * @param message
     */
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

            TF.setUrls(newUrls);
        });
    },

    removeUrl: function (tab) {

        browser.storage.local.get(["urls"], function (result) {

            const currentHost = TF.getHostFromUrl(tab.url);
            const newUrls = result.urls.filter(host => host != currentHost);

            TF.setUrls(newUrls);
        });
    },

    setUrls: (newUrls) => {

        browser.storage.local.set({urls: newUrls}, () => {

            // Update context menu host pattern
            TF.updateContextMenus();

            // Update freeze hostlist
            TF.updateHosts();
        });
    },

    getHostFromUrl: function (fullUrl) {
        /**
         * Some stackoverflow magic: get hostname of URL with
         * the location hostname property
         *
         * @param fullUrl
         * @returns {string}
         */
        const a = document.createElement('a');
        a.href = fullUrl;
        return a.hostname;
    },

    onInstall: function (details) {
        /**
         * On install: set up storage
         */
        switch (details.reason) {

            case 'install':
                browser.storage.local.get(['urls'], function (results) {

                    if (Object.keys(results).length == 0) {
                        browser.storage.local.set({
                            urls: []
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
    },

    updateContextMenus: () => {

        // get urls
        browser.storage.local.get(["urls"], function (result) {

            if (result.urls !== undefined) {

                let hostlist = [];

                // Iterate result obj and build array
                for (const [key, value] of Object.entries(result.urls)) {
                    hostlist.push('*://' + value + '/*');
                }

                // if hostlist is empty, set visi to 0, menu would show otherwise
                let visibility = (hostlist.length == 0 ? false : true);

                browser.contextMenus.update(
                    "open-link-in-tab",
                    {
                        documentUrlPatterns: hostlist,
                        visible: visibility
                    });
            }
        });
    },

    clickedContextMenu: (info, tab) => {

        switch (info.menuItemId) {

            case "open-link-in-tab":
                browser.tabs.create({
                    url: info.linkUrl,
                    index: tab.index + 1
                });

                break;
        }
    },

    init: () => {

        // Initialize context menus, hide it
        browser.contextMenus.create({
            id: "open-link-in-tab",
            title: "Open link in new tab",
            contexts: ["link"],
            onclick: TF.clickedContextMenu
        }, ()=> {
            //callback; update with url patterns
            TF.updateContextMenus();
        });

        TF.updateHosts();
    }

};


// Initialize stuff
TF.init();


// Browser startup listener
browser.runtime.onInstalled.addListener(TF.onInstall);

// Tab being updated listener
browser.tabs.onUpdated.addListener(TF.onUpdatedTab);

// Browser button listener
browser.browserAction.onClicked.addListener(TF.handleBrowserClick);

// Key press listener
browser.commands.onCommand.addListener(TF.onKeyCommand);

// Listen for message
browser.runtime.onMessage.addListener(TF.handleMessage);