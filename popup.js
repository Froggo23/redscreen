document.addEventListener('DOMContentLoaded', () => {
    const toggleSwitch = document.getElementById('toggle-switch');
    const websitesTextarea = document.getElementById('websites');
    const saveButton = document.getElementById('save-button');
    const saveConfirm = document.getElementById('save-confirm');

    // Load saved settings from chrome.storage
    chrome.storage.local.get(['isEnabled', 'websites'], (result) => {
        toggleSwitch.checked = result.isEnabled !== false; // default to true
        if (result.websites && Array.isArray(result.websites)) {
            websitesTextarea.value = result.websites.join('\n');
        }
    });

    // Save settings to chrome.storage
    saveButton.addEventListener('click', () => {
        const isEnabled = toggleSwitch.checked;
        const websites = websitesTextarea.value
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean); // Remove empty lines

        chrome.storage.local.set({ isEnabled, websites }, () => {
            // Show confirmation message
            saveConfirm.classList.remove('save-confirm-hidden');
            setTimeout(() => {
                saveConfirm.classList.add('save-confirm-hidden');
            }, 2000);
        });
    });
});