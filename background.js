class ProductivityTracker {
    constructor() {
        this.settings = { isEnabled: true, websites: [] };
        this.trackedTabs = {}; // { tabId: { elapsedTime: 0, level: 0, intervalId: null } }
        // Seconds spent at the previous level before advancing.
        // The old `5` was a leftover test value (originally a flat 225s).
        // Mild notes arrive after a real "quick look"; the wall is ~20 min in.
        this.LEVEL_INTERVALS_SECONDS = [
            120, // →1  2:00   10% red, mild
            150, // →2  4:30   20% red, mild
            180, // →3  7:30   30% red, moderate
            180, // →4 10:30   40% red, moderate
            210, // →5 14:00   50% red, moderate
            150, // →6 16:30   60% red, harsh
            120, // →7 18:30   70% red, last warning
             90, // →8 20:00   focus wall
        ];
        this.levelThresholds = this.LEVEL_INTERVALS_SECONDS.reduce((acc, interval) => {
            acc.push((acc.length ? acc[acc.length - 1] : 0) + interval);
            return acc;
        }, []);
        this.MAX_LEVEL = 8;
        this.TICK_INTERVAL_MS = 1000;

        this.loadSettings().then(() => this.initialize());
    }

    async loadSettings() {
        const data = await chrome.storage.local.get(['isEnabled', 'websites']);
        this.settings.isEnabled = data.isEnabled !== false;
        this.settings.websites = data.websites || [];
    }

    initialize() {
        this.setupListeners();
        this.recheckAllTabs();
    }

    setupListeners() {
        chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));
        chrome.tabs.onActivated.addListener(this.handleTabActivation.bind(this));
        chrome.tabs.onRemoved.addListener(this.handleTabRemoval.bind(this));
        chrome.storage.onChanged.addListener(this.handleStorageChange.bind(this));
    }

    handleTabUpdate(tabId, changeInfo, tab) {
        if (changeInfo.status !== 'complete' || !tab.url) return;
        this.evaluateTab(tab);
    }

    handleTabActivation(activeInfo) {
        this.pauseAllTimers();
        if (this.trackedTabs[activeInfo.tabId]) {
            this.resumeTimer(activeInfo.tabId);
        }
    }


    handleTabRemoval(tabId) {
        this.stopTracking(tabId);
    }

    handleStorageChange(changes) {
        const oldStatus = this.settings.isEnabled;
        this.loadSettings().then(() => {
            if (oldStatus !== this.settings.isEnabled) {
                this.recheckAllTabs();
            } else {
                this.recheckAllTabs();
            }
        });
    }

    async recheckAllTabs() {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            this.evaluateTab(tab);
        }
    }

    evaluateTab(tab) {
        if (!tab || !tab.id || !tab.url) return;

        const isDistracting = this.isDistractingUrl(tab.url);

        if (this.settings.isEnabled && isDistracting) {
            this.startTracking(tab);
        } else {
            this.stopTracking(tab.id);
        }
    }

    isDistractingUrl(url) {
        if (!url) return false;
        return this.settings.websites.some(site => url.includes(site));
    }

    async startTracking(tab) {
        if (this.trackedTabs[tab.id]) return;

        console.log(`Starting to track tab: ${tab.id}`);
        this.trackedTabs[tab.id] = { elapsedTime: 0, level: 0, intervalId: null };

        try {
            await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['content.css'],
            });
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                // Inject messages first, then the main content script
                files: ['messages.js', 'content.js'],
            });
            // Send initial state
            this.updateTabState(tab.id, false);
        } catch (err) {
            console.error(`Failed to inject script into tab ${tab.id}:`, err);
            delete this.trackedTabs[tab.id]; // Clean up if injection fails
            return;
        }

        if (tab.active) {
            this.resumeTimer(tab.id);
        }
    }

    stopTracking(tabId) {
        if (!this.trackedTabs[tabId]) return;

        console.log(`Stopping tracking for tab: ${tabId}`);
        clearInterval(this.trackedTabs[tabId].intervalId);
        delete this.trackedTabs[tabId];

        // Send message to content script to clean up UI
        chrome.tabs.sendMessage(tabId, { type: 'RESET_STATE' }).catch(err => {
            // This error is expected if the tab was closed or navigated away.
        });
    }

    pauseAllTimers() {
        for (const tabId in this.trackedTabs) {
            if (this.trackedTabs[tabId].intervalId) {
                clearInterval(this.trackedTabs[tabId].intervalId);
                this.trackedTabs[tabId].intervalId = null;
            }
        }
    }

    resumeTimer(tabId) {
        if (!this.trackedTabs[tabId] || this.trackedTabs[tabId].intervalId) return;

        this.trackedTabs[tabId].intervalId = setInterval(() => {
            this.tick(tabId);
        }, this.TICK_INTERVAL_MS);
    }

    tick(tabId) {
        const tabData = this.trackedTabs[tabId];
        if (!tabData) {
            this.stopTracking(tabId);
            return;
        }

        tabData.elapsedTime++;

        const oldLevel = tabData.level;
        let newLevel = 0;
        for (let i = 0; i < this.levelThresholds.length; i++) {
            if (tabData.elapsedTime >= this.levelThresholds[i]) {
                newLevel = i + 1;
            }
        }
        newLevel = Math.min(this.MAX_LEVEL, newLevel);

        if (newLevel > oldLevel) {
            tabData.level = newLevel;
            this.updateTabState(tabId, true);
        }
    }

    updateTabState(tabId, showReminder) {
        const tabData = this.trackedTabs[tabId];
        if (!tabData) return;

        const payload = {
            type: 'UPDATE_STATE',
            level: tabData.level,
            showReminder: showReminder
        };
        chrome.tabs.sendMessage(tabId, payload).catch(err => {
            console.error(`Could not send state update to tab ${tabId}:`, err);
        });
    }
}

new ProductivityTracker();