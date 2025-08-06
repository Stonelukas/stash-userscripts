/**
 * Debug script for AutomateStash
 * Run this in the console on a Stash scene page to help debug selector issues
 */

console.log('=== AutomateStash Debug Script ===');

// Check if on scene page
console.log('1. Page Check:');
console.log('- Current URL:', window.location.href);
console.log('- Is scene page:', window.location.pathname.match(/^\/scenes\/\d+/) && !window.location.pathname.includes('/markers'));

// Look for edit buttons
console.log('\n2. Edit Button Search:');
const editSelectors = [
    'a[data-rb-event-key="scene-edit-panel"]',
    'button[title="Edit"]',
    '.scene-toolbar a[href*="edit"]',
    'a[href*="/edit"]',
    'button.btn-secondary',
    '.scene-toolbar button',
    '.scene-toolbar a',
    '[data-testid*="edit"]'
];

editSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
        console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
        elements.forEach(el => {
            console.log('  - Element:', el);
            console.log('    Text:', el.textContent?.trim());
            console.log('    Title:', el.title);
            console.log('    Href:', el.href);
        });
    }
});

// Look for all buttons with "edit" in text
console.log('\n3. All buttons/links with "edit" text:');
const allElements = document.querySelectorAll('button, a');
allElements.forEach(el => {
    const text = el.textContent?.toLowerCase() || '';
    const title = el.title?.toLowerCase() || '';
    if (text.includes('edit') || title.includes('edit')) {
        console.log('Found element with edit:', el);
        console.log('- Tag:', el.tagName);
        console.log('- Text:', el.textContent?.trim());
        console.log('- Title:', el.title);
        console.log('- Classes:', el.className);
        console.log('- Parent classes:', el.parentElement?.className);
    }
});

// Check for edit panel
console.log('\n4. Edit Panel Check:');
const panelSelectors = [
    '.entity-edit-panel',
    '.scene-edit-form',
    'form[class*="edit"]',
    '.edit-buttons',
    '[data-testid*="edit"]'
];

panelSelectors.forEach(selector => {
    const panel = document.querySelector(selector);
    if (panel) {
        console.log(`✅ Found edit panel with selector: ${selector}`, panel);
    }
});

// Check for scrape button
console.log('\n5. Scrape Button Check:');
const scrapeButtons = document.querySelectorAll('button');
scrapeButtons.forEach(btn => {
    if (btn.textContent?.toLowerCase().includes('scrape')) {
        console.log('Found scrape button:', btn);
        console.log('- Text:', btn.textContent?.trim());
        console.log('- Classes:', btn.className);
        console.log('- Disabled:', btn.disabled);
    }
});

// Check AutomateStash initialization
console.log('\n6. AutomateStash Status:');
console.log('- window.automateStash exists:', !!window.automateStash);
if (window.automateStash) {
    console.log('- initialized:', window.automateStash.initialized);
    console.log('- uiManager:', !!window.automateStash.uiManager);
    console.log('- sourceDetector:', !!window.automateStash.sourceDetector);
}

console.log('\n=== End Debug Script ===');