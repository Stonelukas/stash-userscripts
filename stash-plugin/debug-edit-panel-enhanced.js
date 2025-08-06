/**
 * Enhanced Debug Script for Stash Edit Panel Detection
 * Run this in the browser console when the edit panel is open
 * This will help identify the exact structure of your Stash version
 */

console.log('=== Enhanced Stash Edit Panel Debug ===');
console.log('Page URL:', window.location.href);
console.log('Page Title:', document.title);
console.log('Timestamp:', new Date().toISOString());

// 1. Find ALL input fields
console.log('\n1. ALL Input Fields:');
const inputs = document.querySelectorAll('input');
console.log(`Found ${inputs.length} input elements:`);
inputs.forEach((input, index) => {
    if (input.type !== 'hidden' && input.offsetParent !== null) { // Only visible inputs
        console.log(`Input #${index}:`, {
            type: input.type,
            name: input.name || '(no name)',
            id: input.id || '(no id)',
            placeholder: input.placeholder || '(no placeholder)',
            value: input.value ? '(has value)' : '(empty)',
            className: input.className || '(no class)',
            visible: input.offsetParent !== null
        });
    }
});

// 2. Find ALL textareas
console.log('\n2. ALL Textarea Fields:');
const textareas = document.querySelectorAll('textarea');
console.log(`Found ${textareas.length} textarea elements:`);
textareas.forEach((textarea, index) => {
    console.log(`Textarea #${index}:`, {
        name: textarea.name || '(no name)',
        id: textarea.id || '(no id)',
        placeholder: textarea.placeholder || '(no placeholder)',
        value: textarea.value ? '(has value)' : '(empty)',
        className: textarea.className || '(no class)',
        rows: textarea.rows,
        visible: textarea.offsetParent !== null
    });
});

// 3. Find ALL forms
console.log('\n3. ALL Forms:');
const forms = document.querySelectorAll('form');
console.log(`Found ${forms.length} form elements:`);
forms.forEach((form, index) => {
    console.log(`Form #${index}:`, {
        id: form.id || '(no id)',
        className: form.className || '(no class)',
        action: form.action || '(no action)',
        method: form.method || '(no method)',
        childInputs: form.querySelectorAll('input').length,
        childTextareas: form.querySelectorAll('textarea').length,
        childSelects: form.querySelectorAll('select').length
    });
});

// 4. Find containers with class names containing 'edit' or 'form'
console.log('\n4. Containers with edit/form in class:');
const allElements = document.querySelectorAll('*');
const editContainers = [];
allElements.forEach(elem => {
    const className = elem.className;
    if (typeof className === 'string' && 
        (className.toLowerCase().includes('edit') || 
         className.toLowerCase().includes('form') ||
         className.toLowerCase().includes('scene'))) {
        // Only include if it has form elements inside
        if (elem.querySelector('input, textarea, select')) {
            editContainers.push({
                tagName: elem.tagName,
                className: elem.className,
                id: elem.id || '(no id)',
                hasInputs: !!elem.querySelector('input'),
                hasTextareas: !!elem.querySelector('textarea'),
                hasButtons: !!elem.querySelector('button')
            });
        }
    }
});
console.log('Found', editContainers.length, 'edit/form containers:');
editContainers.forEach(container => console.log(container));

// 5. Find all buttons and their text
console.log('\n5. ALL Buttons:');
const buttons = document.querySelectorAll('button');
const buttonInfo = [];
buttons.forEach(btn => {
    const text = btn.textContent.trim();
    if (text) {
        buttonInfo.push({
            text: text,
            className: btn.className || '(no class)',
            title: btn.title || '(no title)',
            disabled: btn.disabled,
            type: btn.type
        });
    }
});
console.log(`Found ${buttonInfo.length} buttons with text:`);
buttonInfo.forEach(info => console.log(info));

// 6. Check for specific field patterns
console.log('\n6. Specific Field Checks:');
const fieldChecks = [
    { selector: 'input[name="title"]', description: 'Title input by name' },
    { selector: 'input[placeholder*="Title"]', description: 'Title input by placeholder' },
    { selector: 'input[placeholder*="title"]', description: 'Title input by placeholder (lowercase)' },
    { selector: 'textarea[name="details"]', description: 'Details textarea by name' },
    { selector: 'textarea[placeholder*="Details"]', description: 'Details textarea by placeholder' },
    { selector: 'input[type="date"]', description: 'Date input' },
    { selector: 'input[name="date"]', description: 'Date input by name' },
    { selector: 'input[name="url"]', description: 'URL input' },
    { selector: 'button[title*="Save"]', description: 'Save button' },
    { selector: 'button[title*="Cancel"]', description: 'Cancel button' }
];

fieldChecks.forEach(check => {
    const element = document.querySelector(check.selector);
    console.log(`${element ? '✅' : '❌'} ${check.description} - ${check.selector}`);
    if (element) {
        console.log('   Found:', {
            tagName: element.tagName,
            name: element.name,
            type: element.type,
            placeholder: element.placeholder,
            title: element.title
        });
    }
});

// 7. Generate suggested selectors
console.log('\n7. SUGGESTED SELECTORS FOR YOUR STASH VERSION:');
const suggestions = [];

// Find the most likely title input
const titleInputs = Array.from(inputs).filter(input => {
    const name = (input.name || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    return name.includes('title') || placeholder.includes('title');
});
if (titleInputs.length > 0) {
    const titleInput = titleInputs[0];
    if (titleInput.name) suggestions.push(`input[name="${titleInput.name}"]`);
    if (titleInput.placeholder) suggestions.push(`input[placeholder="${titleInput.placeholder}"]`);
}

// Find the most likely form container
if (forms.length > 0) {
    const form = forms[0];
    if (form.className) suggestions.push(`form.${form.className.split(' ').join('.')}`);
    if (form.id) suggestions.push(`#${form.id}`);
}

// Find edit containers
editContainers.slice(0, 3).forEach(container => {
    if (container.className) {
        const classes = container.className.split(' ').filter(c => c.length > 0);
        if (classes.length > 0) {
            suggestions.push(`.${classes.join('.')}`);
        }
    }
});

console.log('Add these selectors to the formIndicators array:');
suggestions.forEach(s => console.log(`'${s}',`));

console.log('\n=== End Enhanced Debug ===');
console.log('Copy the suggested selectors above and add them to the plugin!');