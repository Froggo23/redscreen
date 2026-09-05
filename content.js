class PageModifier {
    constructor() {
        this.overlay = null;
        this.focusWall = null;
        this.currentLevel = 0;
        // REMINDER_MESSAGES object is removed, will use window.REMINDER_LIBRARY

        this.init();
    }

    init() {
        if (document.getElementById('productivity-overlay')) return;
        this.createOverlay();
        this.setupMessageListener();
        console.log("Productivity Protector content script loaded.");
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'productivity-overlay';
        document.body.appendChild(this.overlay);
    }

    setupMessageListener() {
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) return;
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'UPDATE_STATE':
                    this.updateState(message.level, message.showReminder);
                    break;
                case 'RESET_STATE':
                    this.resetState();
                    break;
            }
        });
    }

    updateState(level, showReminder) {
        this.currentLevel = level;

        if (this.focusWall && level < 8) this.focusWall.style.display = 'none';

        if (this.overlay) {
            this.overlay.style.display = 'block';
            this.overlay.style.opacity = level >= 8 ? 0 : level * 0.1;
        }

        if (level === 8) {
            this.showFocusWall();
        } else if (showReminder && level > 0) {
            this.showReminder(level);
        }
    }

    resetState() {
        if (this.overlay) this.overlay.remove();
        if (this.focusWall) this.focusWall.remove();
        document.querySelectorAll('.productivity-reminder').forEach(el => el.remove());
        window.pageModifierInstance = null;
    }

    showReminder(level) {
        const reminder = document.createElement('div');
        reminder.className = 'productivity-reminder';

        let tier;
        if (level <= 2) tier = 'mild';
        else if (level <= 5) tier = 'moderate';
        else tier = 'harsh';
        reminder.classList.add(`reminder-${tier}`);

        const papers = ['assets/paper-torn-a.webp', 'assets/paper-torn-c.webp'];
        const paperPath = papers[Math.floor(Math.random() * papers.length)];
        reminder.style.setProperty('--pp-paper', `url("${this.extensionUrl(paperPath)}")`);
        reminder.style.setProperty('--pp-tilt', `${(Math.random() * 2.6 - 1.3).toFixed(2)}deg`);

        // Select a random message from the library
        const messagesForLevel = window.REMINDER_LIBRARY[level];
        const messageText = messagesForLevel[Math.floor(Math.random() * messagesForLevel.length)];

        const message = document.createElement('p');
        message.textContent = messageText;

        const closeButton = document.createElement('button');
        closeButton.className = 'close-btn';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => reminder.remove();
        closeButton.addEventListener('mousedown', (e) => e.stopPropagation());

        reminder.appendChild(closeButton);
        reminder.appendChild(message);

        this.makeElementDraggable(reminder);
        document.body.appendChild(reminder);

        const width = reminder.offsetWidth || 320;
        const height = reminder.offsetHeight || 160;
        const margin = 12;
        const maxLeft = Math.max(margin, window.innerWidth - width - margin);
        const maxTop = Math.max(margin, window.innerHeight - height - margin);
        reminder.style.top = `${margin + Math.random() * Math.max(0, maxTop - margin)}px`;
        reminder.style.left = `${margin + Math.random() * Math.max(0, maxLeft - margin)}px`;
    }

    extensionUrl(path) {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
            return chrome.runtime.getURL(path);
        }
        return path;
    }

    showFocusWall() {
        document.querySelectorAll('.productivity-reminder').forEach(el => el.remove());
        if (this.overlay) this.overlay.style.display = 'none';

        if (!this.focusWall) {
            this.focusWall = document.createElement('div');
            this.focusWall.id = 'productivity-focus-wall';
            const content = document.createElement('h1');
            content.textContent = "TIME'S UP. CLOSE THIS TAB.";
            this.focusWall.appendChild(content);
            document.body.appendChild(this.focusWall);
        }

        this.focusWall.style.display = 'flex';
    }

    makeElementDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        const dragMouseDown = (e) => {
            e = e || window.event;
            e.preventDefault();
            // Get the mouse cursor position at startup:
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            // Call a function whenever the cursor moves:
            document.onmousemove = elementDrag;
        };

        element.onmousedown = dragMouseDown;

        const elementDrag = (e) => {
            e = e || window.event;
            e.preventDefault();
            // Calculate the new cursor position:
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            // Set the element's new position:
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        };

        const closeDragElement = () => {
            // Stop moving when mouse button is released:
            document.onmouseup = null;
            document.onmousemove = null;
        };
    }
}

if (typeof window.pageModifierInstance === 'undefined' || window.pageModifierInstance === null) {
    window.pageModifierInstance = new PageModifier();
}