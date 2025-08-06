/**
 * Debug script to help identify edit panel elements in Stash
 * Run this in the browser console when the edit panel is open
 */

console.log('=== Stash Edit Panel Debug ===');

// Check for various form elements
const formSelectors = [
    'form',
    '.form',
    '.edit-form',
    '.scene-form',
    '.scene-edit-form',
    '.entity-edit-panel',
    '.edit-panel',
    '[class*="edit"]',
    '[class*="form"]',
    '#scene-edit-details'
];

console.log('\n1. Form/Panel Elements Found:');
formSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
        console.log(`✅ ${selector}: ${elements.length} found`);
        elements.forEach(el => {
            console.log('  - Classes:', el.className);
            console.log('  - ID:', el.id || '(no id)');
        });
    }
});

// Check for input fields
console.log('\n2. Input Fields:');
const inputs = document.querySelectorAll('input[type="text"], textarea, select');
console.log(`Found ${inputs.length} input elements`);
inputs.forEach(input => {
    console.log(`- ${input.tagName}:`, {
        name: input.name,
        placeholder: input.placeholder,
        'data-field': input.getAttribute('data-field'),
        value: input.value ? '(has value)' : '(empty)'
    });
});

// Check for buttons
console.log('\n3. Buttons in Edit Panel:');
const buttons = document.querySelectorAll('button');
console.log(`Found ${buttons.length} buttons`);
buttons.forEach(btn => {
    if (btn.textContent.trim()) {
        console.log(`- "${btn.textContent.trim()}"`, {
            title: btn.title,
            classes: btn.className,
            disabled: btn.disabled
        });
    }
});

// Check parent containers
console.log('\n4. Parent Container Structure:');
const titleInput = document.querySelector('input[name="title"], input[placeholder*="Title"]');
if (titleInput) {
    let parent = titleInput;
    let depth = 0;
    console.log('Starting from title input...');
    while (parent && depth < 5) {
        parent = parent.parentElement;
        if (parent) {
            console.log(`  ${'  '.repeat(depth)}└─ ${parent.tagName}${parent.className ? '.' + parent.className.split(' ').join('.') : ''}${parent.id ? '#' + parent.id : ''}`);
        }
        depth++;
    }
}

console.log('\n=== End Debug ===');