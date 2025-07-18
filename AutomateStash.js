// ==UserScript==
// @name         OptimizedStash
// @version      2.2.0
// @description  Smart Stash Scene Automation - Auto-detects scraped sources, prevents button reappearance, enhanced organized detection
// @author       You
// @match        http://localhost:9998/scenes/*
// @exclude      http://localhost:9998/scenes/markers?*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('🚀 AutomateStash v2.2.0 - Smart automation with completion tracking');
    console.log('🔧 New features: Button reappearance prevention, enhanced organized detection');

    // Performance Optimizations based on Stash Architecture Research
    const STASH_CONFIG = {
        // React SPA optimization - based on Stash's React architecture
        REACT_RENDER_DELAY: 200,        // Wait for React component lifecycle
        GRAPHQL_MUTATION_DELAY: 500,    // GraphQL mutations need processing time
        UI_TRANSITION_DELAY: 300,       // UI transitions in Stash
        SCRAPER_OPERATION_DELAY: 1000,  // Scraper system response time
        
        // Stash Entity Edit Panel selectors - based on architecture documentation
        SELECTORS: {
            entityEditPanel: '.entity-edit-panel, .edit-panel, [data-testid="edit-panel"]',
            sceneEditForm: '.scene-edit-form, [data-testid="scene-form"]',
            scraperDropdown: '.scraper-dropdown, .dropdown-menu, [data-testid="scraper-dropdown"]',
            submitButton: '[type="submit"], .btn-primary:contains("Save"), [data-testid="submit"]',
            applyButton: '.btn:contains("Apply"), [data-testid="apply-button"]',
            organizedToggle: '.organized-toggle, [data-testid="organized"]'
        }
    };

    // Global state to prevent button recreation after successful completion
    let automationCompleted = false;

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Optimized element waiting with React lifecycle awareness
    async function waitForElement(selector, timeout = 10000, reactAware = true) {
        const startTime = Date.now();
        
        // For React components, wait for initial render cycle
        if (reactAware) {
            await sleep(STASH_CONFIG.REACT_RENDER_DELAY);
        }
        
        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) { // Ensure element is visible
                return element;
            }
            await sleep(100);
        }
        throw new Error(`Element ${selector} not found within ${timeout}ms`);
    }

    // Enhanced element waiting with multiple fallback strategies
    async function waitForElementAdvanced(selectors, timeout = 10000) {
        const selectorsArray = Array.isArray(selectors) ? selectors : [selectors];
        const startTime = Date.now();
        
        await sleep(STASH_CONFIG.REACT_RENDER_DELAY);
        
        while (Date.now() - startTime < timeout) {
            for (const selector of selectorsArray) {
                const element = document.querySelector(selector);
                if (element && element.offsetParent !== null) {
                    console.log(`Found element with selector: ${selector}`);
                    return element;
                }
            }
            await sleep(100);
        }
        throw new Error(`None of the selectors found: ${selectorsArray.join(', ')}`);
    }

    // Optimized click function with GraphQL mutation awareness
    async function clickElementOptimized(selectors, description = '', waitForMutation = false) {
        try {
            console.log(`🔍 Looking for element: ${description}`);
            const element = await waitForElementAdvanced(selectors, 8000);
            
            // Pre-click validation
            if (!element.offsetParent) {
                throw new Error('Element is not visible');
            }
            
            // Scroll element into view for better interaction
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(100);
            
            // Click with focus for better React event handling
            element.focus();
            await sleep(50);
            element.click();
            
            console.log(`✅ Successfully clicked: ${description}`);
            
            // Wait for GraphQL mutations if needed (Stash uses GraphQL extensively)
            if (waitForMutation) {
                await sleep(STASH_CONFIG.GRAPHQL_MUTATION_DELAY);
            }
            
            return true;
        } catch (error) {
            console.error(`❌ Failed to click ${description}:`, error);
            await debugElementsInArea(selectors);
            return false;
        }
    }

    // Enhanced debugging with Stash-specific component inspection
    async function debugElementsInArea(selectors) {
        console.log('🔧 DEBUG: Analyzing page structure...');
        
        // Check for Stash Entity Edit Panel
        const editPanel = document.querySelector(STASH_CONFIG.SELECTORS.entityEditPanel);
        if (editPanel) {
            console.log('📝 Found Entity Edit Panel');
        } else {
            console.log('❌ No Entity Edit Panel found');
        }
        
        // Check for React components
        const reactRoots = document.querySelectorAll('[data-reactroot], [data-react-class]');
        console.log(`⚛️ Found ${reactRoots.length} React components`);
        
        // Debug buttons in context
        const contextButtons = document.querySelectorAll('button');
        console.log(`🔘 Found ${contextButtons.length} buttons:`);
        contextButtons.forEach((btn, index) => {
            if (index < 15) { // Show more buttons for better debugging
                const rect = btn.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0 && btn.offsetParent !== null;
                console.log(`  ${index}: "${btn.textContent.trim()}" | Classes: ${btn.className} | Visible: ${isVisible}`);
            }
        });
    }

    // Optimized Apply Button Detection - Based on Stash Entity Edit Panel patterns
    async function findApplyButton() {
        console.log('🔍 Searching for Apply button using optimized Stash patterns...');
        
        const applySelectors = [
            // Stash-specific Entity Edit Panel patterns
            '.edit-panel button.btn-primary',
            '.scene-edit-form button[type="submit"]',
            '.entity-edit-panel button.btn-primary',
            
            // Generic but targeted patterns
            'button.ml-2.btn.btn-primary',
            'button.btn.btn-primary', 
            '.modal-footer button',
            '.form-actions button',
            
            // Fallback patterns
            'button',
            '[data-testid*="apply"]',
            '[aria-label*="pply"]'
        ];
        
        // Search through selectors and filter by text content
        for (const selector of applySelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                const text = element.textContent.toLowerCase().trim();
                if (text === 'apply' || text.includes('apply')) {
                    console.log(`✅ Found Apply button: ${selector} - "${element.textContent.trim()}"`);
                    return element;
                }
            }
        }
        
        console.log('❌ Apply button not found with optimized patterns');
        return null;
    }

    // Optimized Save Button Detection - Based on Stash Entity Edit Panel patterns  
    async function findSaveButton() {
        console.log('🔍 Searching for Save button using optimized Stash patterns...');
        
        const saveSelectors = [
            // Stash-specific Entity Edit Panel patterns
            '.edit-panel .edit-button.btn.btn-primary',
            '.scene-edit-form .edit-button',
            '.entity-edit-panel .edit-button',
            
            // Form submission patterns
            'form button[type="submit"]',
            '.edit-form button.btn-primary',
            
            // Generic but targeted patterns
            'button.edit-button.btn.btn-primary',
            'button.btn.btn-primary',
            '.modal-footer button',
            
            // Fallback patterns
            'button',
            '[data-testid*="save"]',
            '.edit-button'
        ];
        
        // Search through selectors and filter by text content
        for (const selector of saveSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                const text = element.textContent.toLowerCase().trim();
                if (text === 'save' || text.includes('save')) {
                    console.log(`✅ Found Save button: ${selector} - "${element.textContent.trim()}"`);
                    return element;
                }
            }
        }
        
        console.log('❌ Save button not found with optimized patterns');
        return null;
    }

    async function findScrapeButton() {
        // Try multiple strategies to find the scrape button
        const strategies = [
            // Strategy 1: Look for buttons containing "scrape" text
            () => {
                const buttons = document.querySelectorAll('button');
                for (const button of buttons) {
                    if (button.textContent.toLowerCase().includes('scrape')) {
                        console.log('Found scrape button via text search:', button.textContent.trim());
                        return button;
                    }
                }
                return null;
            },
            
            // Strategy 2: Look in edit buttons container
            () => {
                const container = document.querySelector('.edit-buttons-container');
                if (container) {
                    const buttons = container.querySelectorAll('button');
                    console.log(`Found ${buttons.length} buttons in edit container`);
                    for (const button of buttons) {
                        console.log('Button text:', button.textContent.trim());
                        if (button.textContent.toLowerCase().includes('scrape')) {
                            return button;
                        }
                    }
                }
                return null;
            },
            
            // Strategy 3: Look for specific button patterns
            () => {
                const selectors = [
                    '#scene-edit-details button',
                    '.btn.btn-secondary',
                    'button[class*="btn"]'
                ];
                
                for (const selector of selectors) {
                    const buttons = document.querySelectorAll(selector);
                    for (const button of buttons) {
                        if (button.textContent.toLowerCase().includes('scrape')) {
                            return button;
                        }
                    }
                }
                return null;
            }
        ];
        
        for (let i = 0; i < strategies.length; i++) {
            console.log(`Trying strategy ${i + 1} to find scrape button...`);
            const button = strategies[i]();
            if (button) {
                return button;
            }
        }
        
        return null;
    }

    async function findOrganizedButton() {
        // Try multiple strategies to find the organized button based on Stash architecture
        const strategies = [
            // Strategy 1: Look for the exact Stash structure - button with box icon in scene toolbar
            () => {
                const toolbarButtons = document.querySelectorAll('.scene-toolbar button.minimal.btn.btn-primary, .toolbar button.minimal.btn.btn-primary');
                for (const button of toolbarButtons) {
                    const boxIcon = button.querySelector('svg[data-icon="box"]');
                    if (boxIcon) {
                        console.log('Found organized button via scene toolbar + box icon:', button.outerHTML.substring(0, 100));
                        return button;
                    }
                }
                return null;
            },
            
            // Strategy 2: Look for buttons with box icon (faBox) anywhere
            () => {
                const buttons = document.querySelectorAll('button');
                for (const button of buttons) {
                    const boxIcons = button.querySelectorAll('svg[data-icon="box"]');
                    if (boxIcons.length > 0) {
                        console.log('Found organized button via box icon:', button.outerHTML.substring(0, 100));
                        return button;
                    }
                }
                return null;
            },
            
            // Strategy 3: Look for buttons with "organized" title or aria-label
            () => {
                const buttons = document.querySelectorAll('button[title*="rganized"], button[aria-label*="rganized"]');
                if (buttons.length > 0) {
                    console.log('Found organized button via title/aria-label:', buttons[0].outerHTML.substring(0, 100));
                    return buttons[0];
                }
                return null;
            },
            
            // Strategy 4: Look for buttons containing "organized" text
            () => {
                const buttons = document.querySelectorAll('button');
                for (const button of buttons) {
                    const text = button.textContent.toLowerCase().trim();
                    if (text === 'organized' || text.includes('organized')) {
                        console.log('Found organized button via text search:', button.textContent.trim());
                        return button;
                    }
                }
                return null;
            },
            
            // Strategy 5: Look for specific CSS classes combination that might be used
            () => {
                const selectors = [
                    'button.minimal.organized-button.organized.btn.btn-secondary',
                    'button.organized-button',
                    'button.organized',
                    'button[class*="organized"]',
                    'button.btn.btn-secondary[title*="organized"]',
                    'button.minimal.btn.btn-primary' // Generic fallback for Stash buttons
                ];
                
                for (const selector of selectors) {
                    const button = document.querySelector(selector);
                    if (button) {
                        // Additional validation for generic selector
                        if (selector === 'button.minimal.btn.btn-primary') {
                            const boxIcon = button.querySelector('svg[data-icon="box"]');
                            if (!boxIcon) continue; // Skip if no box icon
                        }
                        console.log('Found organized button via CSS selector:', selector);
                        return button;
                    }
                }
                return null;
            }
        ];
        
        for (let i = 0; i < strategies.length; i++) {
            console.log(`Trying strategy ${i + 1} to find organized button...`);
            const button = strategies[i]();
            if (button) {
                return button;
            }
        }
        
        return null;
    }

    // Enhanced Scraper Dropdown Detection - Based on comprehensive Stash architecture research
    async function findScraperDropdownOptimized(targetScraper = 'stashdb') {
        console.log(`🔍 Enhanced search for ${targetScraper} scraper dropdown based on SceneEditPanel research...`);
        
        // Wait for React components to render (critical for ScraperMenu)
        await sleep(STASH_CONFIG.REACT_RENDER_DELAY);
        
        // Comprehensive dropdown selectors based on SceneEditPanel.tsx and ScraperMenu component research
        const dropdownSelectors = [
            // Primary ScraperMenu dropdown patterns (from SceneEditPanel.tsx)
            '.edit-buttons-container .btn-group .dropdown-menu.show .dropdown-item',
            '.edit-buttons-container .btn-group .dropdown-menu .dropdown-item',
            
            // Scene edit specific patterns
            '.scene-edit-panel .btn-group .dropdown-menu.show .dropdown-item',
            '.scene-edit-panel .btn-group .dropdown-menu .dropdown-item',
            
            // Bootstrap dropdown patterns (standard implementation)
            '.dropdown-menu.show .dropdown-item',
            '.dropdown-menu .dropdown-item',
            
            // Entity edit panel patterns
            '.entity-edit-panel .dropdown-menu .dropdown-item',
            '.edit-panel .dropdown-menu .dropdown-item',
            
            // Button group patterns (ScraperMenu is in ButtonGroup)
            '.btn-group .dropdown-menu.show a',
            '.btn-group .dropdown-menu a',
            '.btn-group .dropdown-menu .dropdown-item',
            
            // Scraper-specific patterns
            '.scraper-dropdown .dropdown-menu .dropdown-item',
            '.scraper-menu .dropdown-menu .dropdown-item',
            
            // Generic menu patterns with role attributes
            '[role="menu"] [role="menuitem"]',
            '[role="menuitem"]',
            
            // Fallback patterns
            '.dropdown-item',
            'a.dropdown-item',
            '.menu-item'
        ];
        
        console.log('🔍 Checking for dropdown visibility and options...');
        
        for (const selector of dropdownSelectors) {
            const options = document.querySelectorAll(selector);
            if (options.length > 0) {
                console.log(`✅ Found ${options.length} dropdown options with selector: ${selector}`);
                
                // Verify these are actually scraper options by checking content
                const validOptions = Array.from(options).filter(option => {
                    const text = option.textContent?.trim() || '';
                    // Check if this looks like a scraper name (not empty, has meaningful content)
                    return text.length > 0 && !text.match(/^[\s\-_\.]*$/);
                });
                
                if (validOptions.length > 0) {
                    console.log(`✅ Found ${validOptions.length} valid scraper options`);
                    
                    // Log all found options for debugging
                    validOptions.forEach((option, index) => {
                        const text = option.textContent?.trim() || '';
                        console.log(`  Option ${index}: "${text}"`);
                    });
                    
                    return validOptions;
                }
            }
        }
        
        // If no options found, check if dropdown is actually open
        const openDropdowns = document.querySelectorAll('.dropdown-menu.show, .dropdown.show, .btn-group.show');
        console.log(`📋 Found ${openDropdowns.length} open dropdown(s)`);
        
        if (openDropdowns.length === 0) {
            console.log('⚠️ No open dropdowns detected. The dropdown may need to be opened first.');
        } else {
            console.log('🔧 Dropdown appears to be open but no valid options found');
            
            // Debug all elements in open dropdowns
            openDropdowns.forEach((dropdown, index) => {
                const allElements = dropdown.querySelectorAll('*');
                console.log(`Dropdown ${index} contains ${allElements.length} elements:`);
                allElements.forEach((el, elIndex) => {
                    if (el.textContent?.trim() && elIndex < 10) { // Limit to first 10 for readability
                        console.log(`  Element ${elIndex}: ${el.tagName} "${el.textContent.trim()}"`);
                    }
                });
            });
        }
        
        console.log('❌ No valid scraper dropdown options found with any selector');
        return [];
    }

    // Enhanced ThePornDB Selection - Using improved detection based on Stash architecture research
    async function selectThePornDBOption() {
        console.log('🎯 Enhanced ThePornDB selection process based on Stash architecture...');
        
        // First, wait for any React components to render
        await sleep(STASH_CONFIG.REACT_RENDER_DELAY);
        
        // Enhanced dropdown selectors based on SceneEditPanel.tsx research
        const dropdownSelectors = [
            // Primary: Bootstrap dropdown for scraper menus (most specific first)
            '.btn-group .dropdown-menu.show .dropdown-item',
            '.btn-group .dropdown-menu .dropdown-item',
            
            // ScraperMenu specific selectors
            '.scraper-menu .dropdown-menu .dropdown-item',
            '.edit-buttons-container .btn-group .dropdown-menu .dropdown-item',
            
            // Fragment scraper dropdown (first ScraperMenu instance)
            '.edit-buttons-container .btn-group .dropdown-menu.show .dropdown-item',
            
            // Queryable scraper dropdown (second ScraperMenu instance)  
            '.scene-edit-panel .btn-group .dropdown-menu .dropdown-item',
            '.scene-edit-panel .btn-group .dropdown-menu.show .dropdown-item',
            
            // More specific Bootstrap dropdown patterns
            '.dropdown-menu.show .dropdown-item:not([role="menuitem"])', // Exclude video controls
            '.dropdown-menu .dropdown-item:not([role="menuitem"])', // Exclude video controls
            
            // Generic fallbacks (but exclude video controls)
            'a.dropdown-item:not([role="menuitem"])',
            '.dropdown-item:not([role="menuitem"])'
        ];
        
        let dropdownOptions = [];
        let maxRetries = 5;
        let retryCount = 0;
        
        // Try each selector until we find dropdown options, with retries for React rendering
        while (dropdownOptions.length === 0 && retryCount < maxRetries) {
            for (const selector of dropdownSelectors) {
                const foundOptions = Array.from(document.querySelectorAll(selector));
                if (foundOptions.length > 0) {
                    console.log(`✅ Found ${foundOptions.length} dropdown options with selector: ${selector}`);
                    
                    // Filter out video player controls and other non-scraper options
                    dropdownOptions = foundOptions.filter(option => {
                        const text = option.textContent?.trim() || '';
                        const isVideoControl = text.includes('captions') || 
                                              text.includes('settings') || 
                                              text.includes('subtitles') ||
                                              text.includes('audio') ||
                                              text.includes('video') ||
                                              text.includes('quality') ||
                                              text.includes('speed') ||
                                              text.includes('fullscreen');
                        
                        return !isVideoControl && text.length > 0 && text.length < 50; // Reasonable scraper name length
                    });
                    
                    if (dropdownOptions.length > 0) {
                        console.log(`✅ After filtering, found ${dropdownOptions.length} valid scraper options`);
                        break;
                    }
                }
            }
            
            if (dropdownOptions.length === 0) {
                retryCount++;
                console.log(`⏳ Retry ${retryCount}/${maxRetries} - waiting for scraper dropdown to appear...`);
                await sleep(500); // Wait before retrying
            }
        }
        
        if (dropdownOptions.length === 0) {
            console.error('❌ No dropdown options found with any selector');
            return false;
        }

        // Log all available options for debugging
        console.log('📋 Available scraper options:');
        dropdownOptions.forEach((option, index) => {
            const text = option.textContent?.trim() || '';
            const href = option.href || option.getAttribute('href') || '';
            console.log(`  ${index}: "${text}" | href: "${href}"`);
        });

        // Strategy 1: Exact match for "ThePornDB" (most reliable based on config research)
        for (const option of dropdownOptions) {
            const optionText = option.textContent?.trim() || '';
            if (optionText === 'ThePornDB') {
                console.log(`✅ Exact match found: "${optionText}"`);
                option.click();
                await sleep(100); // Brief pause after click
                return true;
            }
        }

        // Strategy 2: Case-insensitive exact match  
        for (const option of dropdownOptions) {
            const optionText = option.textContent?.trim() || '';
            if (optionText.toLowerCase() === 'theporndb') {
                console.log(`✅ Case-insensitive exact match: "${optionText}"`);
                option.click();
                await sleep(100);
                return true;
            }
        }

        // Strategy 3: Positional selection (find StashDB, select next)
        for (let i = 0; i < dropdownOptions.length; i++) {
            const option = dropdownOptions[i];
            const optionText = option.textContent?.trim().toLowerCase() || '';
            
            if (optionText.includes('stashdb') && i + 1 < dropdownOptions.length) {
                const nextOption = dropdownOptions[i + 1];
                const nextText = nextOption.textContent?.trim() || '';
                console.log(`✅ Positional selection: Found StashDB at ${i}, selecting next option "${nextText}"`);
                nextOption.click();
                await sleep(100);
                return true;
            }
        }
        
        // Strategy 4: Enhanced text pattern matching for ThePornDB variants
        const thePornDBPatterns = [
            /^theporndb$/i,
            /^the\s*porn\s*db$/i,
            /^tpdb$/i,
            /porndb/i,
            /the.*porn.*db/i,
            /tpdb\.tv/i,
            /tp.*db/i,
            /metadataapi/i  // Based on the API URL from config
        ];
        
        for (const option of dropdownOptions) {
            const optionText = option.textContent?.trim() || '';
            
            for (const pattern of thePornDBPatterns) {
                if (pattern.test(optionText)) {
                    console.log(`✅ Pattern match found: "${optionText}" matches ${pattern}`);
                    option.click();
                    await sleep(100);
                    return true;
                }
            }
        }
        
        // Strategy 5: Domain/URL-based detection
        for (const option of dropdownOptions) {
            const href = option.href || option.getAttribute('href') || '';
            const title = option.title || option.getAttribute('title') || '';
            
            if (href.includes('porndb') || href.includes('tpdb') || href.includes('metadataapi') ||
                title.includes('porndb') || title.includes('tpdb') || title.includes('ThePornDB')) {
                console.log(`✅ URL/attribute match found: href="${href}" title="${title}"`);
                option.click();
                await sleep(100);
                return true;
            }
        }

        // Strategy 6: Fallback - look for any option that might be ThePornDB
        const suspiciousOptions = dropdownOptions.filter(option => {
            const text = option.textContent?.trim().toLowerCase() || '';
            return text.includes('porn') || text.includes('tpdb') || text.includes('metadata');
        });

        if (suspiciousOptions.length > 0) {
            console.log(`⚠️ Found ${suspiciousOptions.length} potentially matching options:`);
            suspiciousOptions.forEach((option, index) => {
                console.log(`  Suspicious ${index}: "${option.textContent?.trim()}"`);
            });
            
            // Select the first suspicious option as a last resort
            const selectedOption = suspiciousOptions[0];
            console.log(`🤔 Attempting fallback selection: "${selectedOption.textContent?.trim()}"`);
            selectedOption.click();
            await sleep(100);
            return true;
        }
        
        console.error('❌ ThePornDB option not found with any strategy');
        console.log('💡 Available options were:', dropdownOptions.map(opt => opt.textContent?.trim()).join(', '));
        return false;
    }

    // Detect which scrapers have already been used on this scene
    async function detectAlreadyScrapedSources() {
        console.log('🔍 Detecting which scrapers have already been used...');
        
        const scrapedSources = {
            stashdb: false,
            theporndb: false
        };
        
        try {
            // Strategy 1: Check for StashDB indicators
            // Look for StashDB-specific data patterns in the scene info
            const stashdbIndicators = [
                // StashDB scene ID pattern
                () => {
                    const sceneInfo = document.querySelector('.scene-info, .detail-group, .scene-details');
                    if (sceneInfo) {
                        const text = sceneInfo.textContent || '';
                        // StashDB IDs are typically UUIDs
                        return /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text);
                    }
                    return false;
                },
                
                // Look for StashDB URLs in scene details
                () => {
                    const links = document.querySelectorAll('a[href*="stashdb"]');
                    return links.length > 0;
                },
                
                // Check for populated fields that suggest StashDB scraping
                () => {
                    // Look for studio, performers, or tags that have been populated
                    const studioField = document.querySelector('.studio, [data-testid*="studio"]');
                    const performerFields = document.querySelectorAll('.performer, [data-testid*="performer"]');
                    const tagFields = document.querySelectorAll('.tag, [data-testid*="tag"]');
                    
                    return (studioField?.textContent?.trim()?.length > 0) || 
                           (performerFields.length > 0) || 
                           (tagFields.length > 5); // More than 5 tags suggests scraping
                }
            ];
            
            // Strategy 2: Check for ThePornDB indicators
            const theporndbIndicators = [
                // Look for ThePornDB-specific data patterns
                () => {
                    const sceneInfo = document.querySelector('.scene-info, .detail-group, .scene-details');
                    if (sceneInfo) {
                        const text = sceneInfo.textContent || '';
                        // ThePornDB tends to have specific naming patterns
                        return text.includes('ThePornDB') || text.includes('TPDB');
                    }
                    return false;
                },
                
                // Look for ThePornDB URLs
                () => {
                    const links = document.querySelectorAll('a[href*="theporndb"], a[href*="tpdb"]');
                    return links.length > 0;
                },
                
                // Check for ThePornDB-style metadata
                () => {
                    // ThePornDB often provides more detailed scene descriptions
                    const description = document.querySelector('.scene-description, [data-testid*="description"]');
                    if (description) {
                        const text = description.textContent || '';
                        // Long descriptions (>200 chars) often indicate ThePornDB scraping
                        return text.length > 200;
                    }
                    return false;
                }
            ];
            
            // Test StashDB indicators
            for (const indicator of stashdbIndicators) {
                if (indicator()) {
                    scrapedSources.stashdb = true;
                    console.log('✅ StashDB data detected');
                    break;
                }
            }
            
            // Test ThePornDB indicators
            for (const indicator of theporndbIndicators) {
                if (indicator()) {
                    scrapedSources.theporndb = true;
                    console.log('✅ ThePornDB data detected');
                    break;
                }
            }
            
            // Strategy 3: Check URL or page metadata for scraper history
            // Look for any data attributes or hidden fields that might indicate scraper usage
            const sceneContainer = document.querySelector('.scene-details, .scene-page, .detail-group');
            if (sceneContainer) {
                const dataAttrs = sceneContainer.attributes;
                for (let attr of dataAttrs) {
                    if (attr.name.includes('stash') || attr.value.includes('stash')) {
                        scrapedSources.stashdb = true;
                    }
                    if (attr.name.includes('porn') || attr.value.includes('porn')) {
                        scrapedSources.theporndb = true;
                    }
                }
            }
            
            console.log('🔍 Scraper detection results:', scrapedSources);
            return scrapedSources;
            
        } catch (error) {
            console.log('⚠️ Error detecting scraped sources:', error.message);
            // Return false for both to be safe and allow re-scraping
            return { stashdb: false, theporndb: false };
        }
    }

    // Enhanced organized detection using multiple detection strategies
    async function checkIfAlreadyOrganized() {
        console.log('🔍 Comprehensive organized status check...');
        
        try {
            // Strategy 1: Look for explicit organized status indicators
            const organizedIndicators = [
                // Direct organized div (most reliable)
                'div.organized',
                '.scene-organized',
                '.organized-indicator',
                '.organized-badge',
                '.status-organized',
                
                // Badge or label indicators
                '.badge:contains("Organized")',
                '.label:contains("Organized")',
                '.tag:contains("Organized")',
                '[title*="organized" i]',
                '[aria-label*="organized" i]'
            ];
            
            for (const selector of organizedIndicators) {
                const element = document.querySelector(selector);
                if (element) {
                    console.log('✅ Scene is organized - found indicator:', selector);
                    return true;
                }
            }
            
            // Strategy 2: Check form fields and inputs
            const formIndicators = [
                // Checkbox-based organized toggle
                'input[type="checkbox"][checked]:not([type="radio"])',
                '.form-check-input[checked]',
                '.organized-toggle input:checked',
                '.organized-checkbox input:checked',
                
                // Toggle switch indicators  
                '.toggle-switch.active',
                '.switch-input:checked',
                '.toggle.on'
            ];
            
            for (const selector of formIndicators) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    // Verify this is actually the organized field by checking context
                    const context = element.closest('.form-group, .form-field, .input-group, .field, fieldset, label');
                    if (context && context.textContent.toLowerCase().includes('organized')) {
                        console.log('✅ Scene is organized - found checked organized toggle');
                        return true;
                    }
                }
            }
            
            // Strategy 3: Check organized button state using enhanced detection
            const organizedButton = await Promise.race([
                findOrganizedButton(),
                new Promise((resolve) => setTimeout(() => resolve(null), 2000)) // 2 second timeout
            ]);
            
            if (organizedButton) {
                try {
                    const computedStyle = window.getComputedStyle(organizedButton);
                    const backgroundColor = computedStyle.backgroundColor;
                    const color = computedStyle.color;
                    const classes = organizedButton.className;
                    
                    console.log('📊 Organized button analysis:');
                    console.log('  Classes:', classes);
                    console.log('  Background:', backgroundColor);
                    console.log('  Text color:', color);
                    
                    // Enhanced active state detection
                    const isActive = (
                        // CSS class indicators
                        classes.includes('active') ||
                        classes.includes('pressed') ||
                        classes.includes('selected') ||
                        classes.includes('btn-warning') ||
                        classes.includes('btn-orange') ||
                        classes.includes('btn-primary') ||
                        
                        // Background color analysis (orange/yellow indicates organized)
                        backgroundColor.includes('rgb(255, 193, 7)') ||  // Bootstrap warning
                        backgroundColor.includes('rgb(245, 158, 11)') ||  // Tailwind orange
                        backgroundColor.includes('rgb(251, 146, 60)') ||  // Light orange
                        backgroundColor.includes('rgb(217, 119, 6)') ||   // Dark orange
                        backgroundColor.includes('rgb(180, 83, 9)') ||    // Brown-orange
                        backgroundColor.includes('rgb(146, 64, 14)') ||   // Brown
                        backgroundColor.includes('rgb(255, 235, 59)') ||  // Yellow
                        
                        // Intelligent color detection for orange/yellow hues
                        (() => {
                            try {
                                const rgbMatch = backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                                if (rgbMatch) {
                                    const [, r, g, b] = rgbMatch.map(Number);
                                    // Orange/amber detection: high red, moderate green, low blue
                                    const isOrange = r > 200 && g > 100 && g < 220 && b < 100;
                                    // Yellow detection: high red, high green, low blue
                                    const isYellow = r > 200 && g > 200 && b < 150;
                                    
                                    if (isOrange || isYellow) {
                                        console.log(`🎯 Detected ${isOrange ? 'orange' : 'yellow'} button color (organized)`);
                                        return true;
                                    }
                                }
                                return false;
                            } catch (colorError) {
                                return false;
                            }
                        })()
                    );
                    
                    if (isActive) {
                        console.log('✅ Scene is organized - button shows active state');
                        return true;
                    }
                    
                    // Additional check: if button is in a container marked as organized
                    const organizedContainer = organizedButton.closest('.organized, .scene-organized');
                    if (organizedContainer) {
                        console.log('✅ Scene is organized - button in organized container');
                        return true;
                    }
                    
                } catch (styleError) {
                    console.log('⚠️ Error analyzing button style:', styleError.message);
                }
            }
            
            // Strategy 4: Check URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('organized') === 'true') {
                console.log('✅ Scene is organized - URL parameter indicates organized');
                return true;
            }
            
            // Strategy 5: Check for data attributes or metadata
            const sceneContainer = document.querySelector('.scene-details, .scene-page, .detail-group, .scene-tabs');
            if (sceneContainer) {
                const dataAttrs = Array.from(sceneContainer.attributes);
                for (const attr of dataAttrs) {
                    if ((attr.name.includes('organized') || attr.value.includes('organized')) && 
                        (attr.value === 'true' || attr.value === '1')) {
                        console.log('✅ Scene is organized - found data attribute');
                        return true;
                    }
                }
            }
            
            console.log('ℹ️ Scene not organized - proceeding with automation');
            return false;
            
        } catch (error) {
            console.warn('⚠️ Error checking organized status:', error.message);
            // Default to not organized to allow automation
            return false;
        }
    }

    async function waitForUserApply() {
        return new Promise((resolve) => {
            console.log('⏳ WAITING FOR USER: Please review the scraped data and click APPLY when ready...');
            
            // Create a visual indicator
            const indicator = document.createElement('div');
            indicator.id = 'user-apply-indicator';
            indicator.style.position = 'fixed';
            indicator.style.top = '20px';
            indicator.style.right = '20px';
            indicator.style.transform = 'none';
            indicator.style.backgroundColor = '#ff6b35';
            indicator.style.color = 'white';
            indicator.style.padding = '20px 30px';
            indicator.style.borderRadius = '10px';
            indicator.style.fontSize = '18px';
            indicator.style.fontWeight = 'bold';
            indicator.style.zIndex = '99999';
            indicator.style.textAlign = 'center';
            indicator.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
            indicator.style.maxWidth = '400px';
            indicator.innerHTML = `
                <div>⏳ Please review the scraped data</div>
                <div style="margin-top: 10px; font-size: 16px;">Click APPLY when ready, automation will continue automatically</div>
                <div style="margin-top: 15px;">
                    <button id="continue-automation" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px;">
                        Skip Wait - Continue Now
                    </button>
                </div>
            `;
            document.body.appendChild(indicator);
            
            // Function to clean up and resolve
            const cleanup = () => {
                if (indicator && indicator.parentNode) {
                    indicator.remove();
                }
                if (clickListener) {
                    document.removeEventListener('click', clickListener, true);
                }
                console.log('✅ Apply button was clicked, continuing automation...');
                resolve();
            };
            
            // Listen for clicks on ANY button that might be an Apply button
            const clickListener = (event) => {
                const target = event.target;
                
                // Check if clicked element is a button or inside a button
                const button = target.closest ? target.closest('button') : null;
                if (button) {
                    const buttonText = button.textContent.toLowerCase().trim();
                    
                    // Check if this looks like an Apply button
                    if (buttonText === 'apply' || buttonText.includes('apply')) {
                        console.log('🎯 Detected Apply button click:', buttonText);
                        // Wait a moment for the action to process, then continue
                        setTimeout(cleanup, 1500);
                        return;
                    }
                }
            };
            
            // Add click listener to capture Apply button clicks
            document.addEventListener('click', clickListener, true);
            
            // Also listen for the manual continue button
            document.getElementById('continue-automation').addEventListener('click', cleanup);
            
            // Fallback: auto-continue after 60 seconds
            setTimeout(() => {
                console.log('⚠️ Auto-continuing after timeout...');
                cleanup();
            }, 60000);
        });
    }

    async function askForThePornDB() {
        return new Promise((resolve) => {
            console.log('🎬 Asking user about ThePornDB scraping...');
            
            // Create a choice dialog
            const dialog = document.createElement('div');
            dialog.id = 'theporndb-choice-dialog';
            dialog.style.position = 'fixed';
            dialog.style.top = '80px';
            dialog.style.right = '20px';
            dialog.style.transform = 'none';
            dialog.style.backgroundColor = '#2c3e50';
            dialog.style.color = 'white';
            dialog.style.padding = '25px 35px';
            dialog.style.borderRadius = '12px';
            dialog.style.fontSize = '18px';
            dialog.style.fontWeight = 'bold';
            dialog.style.zIndex = '99999';
            dialog.style.textAlign = 'center';
            dialog.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
            dialog.style.border = '2px solid #3498db';
            dialog.innerHTML = `
                <div style="margin-bottom: 20px;">🎬 StashDB scraping complete!</div>
                <div style="margin-bottom: 25px; font-size: 16px; font-weight: normal;">
                    Would you like to also scrape from ThePornDB?
                </div>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="scrape-theporndb" style="background: #e74c3c; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold;">
                        Yes, Scrape ThePornDB
                    </button>
                    <button id="skip-theporndb" style="background: #95a5a6; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold;">
                        No, Skip ThePornDB
                    </button>
                </div>
            `;
            document.body.appendChild(dialog);
            
            // Function to clean up dialog
            const cleanup = (choice) => {
                if (dialog && dialog.parentNode) {
                    dialog.remove();
                }
                console.log(`User chose: ${choice ? 'Scrape ThePornDB' : 'Skip ThePornDB'}`);
                resolve(choice);
            };
            
            // Listen for button clicks
            document.getElementById('scrape-theporndb').addEventListener('click', () => cleanup(true));
            document.getElementById('skip-theporndb').addEventListener('click', () => cleanup(false));
            
            // Auto-skip after 30 seconds
            setTimeout(() => {
                console.log('⚠️ Auto-skipping ThePornDB after timeout...');
                cleanup(false);
            }, 30000);
        });
    }

    // Remove automation panel after successful completion
    async function removeAutomationPanel() {
        console.log('🧹 Removing automation panel after successful completion...');
        
        // Set the completion flag to prevent button recreation
        automationCompleted = true;
        console.log('✅ Automation marked as completed - button recreation disabled');
        
        const panel = document.getElementById('stash-automation-panel');
        if (panel) {
            // Add a fade-out animation
            panel.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
            panel.style.opacity = '0';
            panel.style.transform = 'translateY(-20px)';
            
            // Remove after animation completes
            setTimeout(() => {
                if (panel.parentNode) {
                    panel.remove();
                    console.log('✅ Automation panel removed successfully');
                }
            }, 500);
        }
        
        // Also clean up any other dialogs that might be lingering
        const dialogs = document.querySelectorAll('#user-apply-indicator, #theporndb-choice-dialog');
        dialogs.forEach(dialog => {
            if (dialog.parentNode) {
                dialog.remove();
            }
        });
    }

    async function automateComplete() {
        try {
            console.log('🚀 Starting Smart Automation (detects already scraped sources)...');
            
            // === PHASE 0: Detect already scraped sources ===
            console.log('🔍 PHASE 0: Detecting already scraped sources...');
            const alreadyScraped = await detectAlreadyScrapedSources();
            
            let needsStashDB = !alreadyScraped.stashdb;
            let needsThePornDB = !alreadyScraped.theporndb;
            
            if (!needsStashDB && !needsThePornDB) {
                console.log('✅ Both StashDB and ThePornDB data already detected - skipping automation');
                
                // Check if organized, if not, just mark as organized
                const alreadyOrganized = await checkIfAlreadyOrganized();
                if (!alreadyOrganized) {
                    console.log('📦 Scene not organized - marking as organized...');
                    const organizedButton = await findOrganizedButton();
                    if (organizedButton) {
                        organizedButton.click();
                        console.log('✅ Marked scene as organized');
                        await sleep(1000);
                    }
                }
                
                console.log('🎉 Automation complete - removing panel...');
                await removeAutomationPanel();
                return;
            }
            
            console.log(`📋 Scraping plan: StashDB=${needsStashDB ? 'NEEDED' : 'SKIP'}, ThePornDB=${needsThePornDB ? 'NEEDED' : 'SKIP'}`);
            
            // Click the "Edit" button only if we need to scrape something
            const editSuccess = await clickElementOptimized(['a[data-rb-event-key="scene-edit-panel"]'], 'Edit button');
            if (!editSuccess) {
                await removeAutomationPanel();
                return;
            }
            await sleep(1000);

            // === PHASE 1: StashDB Automation (only if needed) ===
            if (needsStashDB) {
                console.log('📋 PHASE 1: StashDB Automation (missing data detected)');
                
                // Wait for edit panel to load and find scrape button
                console.log('Looking for scrape button...');
                let scrapeButton = null;
                let attempts = 0;
                const maxAttempts = 10;
                
                while (!scrapeButton && attempts < maxAttempts) {
                    scrapeButton = await findScrapeButton();
                    if (!scrapeButton) {
                        console.log(`Scrape button not found, attempt ${attempts + 1}/${maxAttempts}`);
                        await sleep(500);
                        attempts++;
                    }
                }
                
                if (!scrapeButton) {
                    console.error('Could not find Scrape button after all attempts');
                    await removeAutomationPanel();
                    return;
                }
                
                scrapeButton.click();
                console.log('Successfully clicked scrape button');
                await sleep(1000);

                // Click on the dropdown option with the text "stashdb.org"
                const dropdownOptions = document.querySelectorAll('.dropdown-menu.show a.dropdown-item');
                for (const option of dropdownOptions) {
                    if (option.textContent.trim() === 'stashdb.org') {
                        option.click();
                        console.log("Clicking StashDB");
                        break;
                    }
                }
                await sleep(2500);

                // Find and select all + tags (studios, performers, tags, etc) from StashDB
                let plusButtons = document.querySelectorAll('button.minimal.ml-2.btn.btn-primary svg[data-prefix="fas"][data-icon="plus"]');
                if (plusButtons.length > 0) {
                    const totalButtons = plusButtons.length;
                    console.log(`Total StashDB entries found: ${totalButtons}`);
                    
                    for (let i = 0; i < plusButtons.length; i++) {
                        try {
                            const button = plusButtons[i].closest('button');
                            if (button) {
                                button.click();
                                console.log(`Clicking StashDB + Button ${i + 1}/${totalButtons}`);
                                
                                if (i < totalButtons - 1) {
                                    await sleep(2000);
                                } else {
                                    console.log("Waiting a bit longer for the last StashDB tag");
                                    await sleep(3000);
                                }
                            }
                        } catch (error) {
                            console.error('Error clicking StashDB + button:', error);
                            await sleep(2000);
                        }
                    }
                } else {
                    console.log('No new entries found from StashDB');
                }
                
                // === PHASE 2: Wait for user to click Apply ===
                console.log('🛑 PHASE 2: Waiting for user to click APPLY...');
                await waitForUserApply();
            } else {
                console.log('⏭️ PHASE 1: Skipping StashDB (data already present)');
            }
            
            // === PHASE 3: ThePornDB scraping (only if needed) ===
            if (needsThePornDB) {
                console.log('🎬 PHASE 3: ThePornDB scraping (missing data detected)...');
                
                // Find scrape button again
                let scrapeButton = await findScrapeButton();
                if (scrapeButton) {
                    // Direct click since we already have the element
                    scrapeButton.click();
                    console.log('Successfully clicked scrape button for ThePornDB');
                    
                    // Wait for React component to render dropdown
                    await sleep(STASH_CONFIG.REACT_RENDER_DELAY);
                    
                    // Check if scrape button has a dropdown that needs explicit opening
                    const dropdownToggle = scrapeButton.querySelector('.dropdown-toggle') || 
                                         scrapeButton.parentElement?.querySelector('[data-toggle="dropdown"]');
                    if (dropdownToggle) {
                        console.log('🔽 Opening scraper dropdown...');
                        dropdownToggle.click();
                        await sleep(STASH_CONFIG.UI_TRANSITION_DELAY);
                    }
                    
                    // Wait a bit more for dropdown to fully render
                    await sleep(500);
                    
                    // Use optimized ThePornDB selection
                    const thePornDBSelected = await selectThePornDBOption();
                    
                    if (thePornDBSelected) {
                        // Wait for scraper operation to complete
                        await sleep(STASH_CONFIG.SCRAPER_OPERATION_DELAY);
                        
                        // Find and select all + tags from ThePornDB using optimized detection
                        console.log('🔍 Searching for ThePornDB entries...');
                        const plusButtonSelectors = [
                            'button.minimal.ml-2.btn.btn-primary svg[data-icon="plus"]',
                            '.scraper-result button svg[data-icon="plus"]',
                            '.entity-result button.btn-primary',
                            'button.btn-primary svg.fa-plus'
                        ];
                        
                        let plusButtons = [];
                        for (const selector of plusButtonSelectors) {
                            plusButtons = document.querySelectorAll(selector);
                            if (plusButtons.length > 0) {
                                console.log(`✅ Found ${plusButtons.length} ThePornDB entries with selector: ${selector}`);
                                break;
                            }
                        }
                        if (plusButtons.length > 0) {
                            const totalButtons = plusButtons.length;
                            console.log(`Total ThePornDB entries found: ${totalButtons}`);
                            
                            for (let i = 0; i < plusButtons.length; i++) {
                                try {
                                    const button = plusButtons[i].closest('button');
                                    if (button) {
                                        button.click();
                                        console.log(`Clicking ThePornDB + Button ${i + 1}/${totalButtons}`);
                                        
                                        if (i < totalButtons - 1) {
                                            await sleep(2000);
                                        } else {
                                            console.log("Waiting a bit longer for the last ThePornDB tag");
                                            await sleep(3000);
                                        }
                                    }
                                } catch (error) {
                                    console.error('Error clicking ThePornDB + button:', error);
                                    await sleep(2000);
                                }
                            }
                        } else {
                            console.log('No new entries found from ThePornDB');
                        }
                        
                        // Wait for user to apply ThePornDB changes
                        console.log('🛑 Waiting for user to click APPLY for ThePornDB changes...');
                        await waitForUserApply();
                    }
                } else {
                    console.warn('Could not find scrape button for ThePornDB');
                }
            } else {
                console.log('⏭️ PHASE 3: Skipping ThePornDB (data already present)');
            }
            
            // === PHASE 4: Save and mark as organized ===
            console.log('💾 PHASE 4: Save and mark as organized');
            
            // Click the "Save" button
            console.log('Looking for Save button...');
            let saveButton = await findSaveButton();
            if (!saveButton) {
                console.error('Could not find Save button');
                await removeAutomationPanel();
                return;
            }
            saveButton.click();
            console.log('Successfully clicked Save button');
            await sleep(1000);

            // Check if already organized before trying to click
            const alreadyOrganized = await checkIfAlreadyOrganized();
            if (alreadyOrganized) {
                console.log('🎯 Scene is already marked as organized - skipping organized button click');
            } else {
                // Click the "Organized" button
                console.log('Looking for Organized button...');
                let organizedButton = await findOrganizedButton();
                if (!organizedButton) {
                    console.log('Could not find Organized button - scene may already be organized');
                } else {
                    organizedButton.click();
                    console.log('Successfully clicked Organized button');
                    await sleep(1000);
                }
            }
            
            // === PHASE 5: Cleanup and completion ===
            console.log('🎉 Smart automation finished successfully!');
            console.log('🧹 Removing automation panel...');
            
            // Wait a moment for everything to settle, then remove the panel
            await sleep(2000);
            await removeAutomationPanel();
            
        } catch (error) {
            console.error('❌ Error in smart automation:', error);
            await removeAutomationPanel();
        }
    }

    // Keep the old functions for backward compatibility
    async function automateStashDB() {
        try {
            console.log('Starting automateStashDB...');
            
            // Click the "Edit" button
            const editSuccess = await clickElementOptimized(['a[data-rb-event-key="scene-edit-panel"]'], 'Edit button');
            if (!editSuccess) return;
            await sleep(1000);

            // Wait for edit panel to load and find scrape button
            console.log('Looking for scrape button...');
            let scrapeButton = null;
            let attempts = 0;
            const maxAttempts = 10;
            
            while (!scrapeButton && attempts < maxAttempts) {
                scrapeButton = await findScrapeButton();
                if (!scrapeButton) {
                    console.log(`Scrape button not found, attempt ${attempts + 1}/${maxAttempts}`);
                    await sleep(500);
                    attempts++;
                }
            }
            
            if (!scrapeButton) {
                console.error('Could not find Scrape button after all attempts');
                // Log all buttons for debugging
                const allButtons = document.querySelectorAll('button');
                console.log('All buttons on page:');
                allButtons.forEach((btn, index) => {
                    console.log(`Button ${index}: "${btn.textContent.trim()}" - classes: ${btn.className}`);
                });
                return;
            }
            
            scrapeButton.click();
            console.log('Successfully clicked scrape button');
            await sleep(1000);

            // Click on the dropdown option with the text "stashdb.org"
            const dropdownOptions = document.querySelectorAll('.dropdown-menu.show a.dropdown-item');
            for (const option of dropdownOptions) {
                if (option.textContent.trim() === 'stashdb.org') {
                    option.click();
                    console.log("Clicking StashDB");
                    break;
                }
            }
            await sleep(2500);

            // Find and select all + tags (studios, performers, tags, etc)
            const plusButtons = document.querySelectorAll('button.minimal.ml-2.btn.btn-primary svg[data-prefix="fas"][data-icon="plus"]');
            if (plusButtons.length > 0) {
                const totalButtons = plusButtons.length;
                console.log(`Total new entries found: ${totalButtons}`);
                
                for (let i = 0; i < plusButtons.length; i++) {
                    try {
                        const button = plusButtons[i].closest('button');
                        if (button) {
                            button.click();
                            console.log(`Clicking + Button ${i + 1}/${totalButtons}`);
                            
                            if (i < totalButtons - 1) {
                                await sleep(2000);
                            } else {
                                console.log("Waiting a bit longer for the last tag");
                                await sleep(5000);
                            }
                        }
                    } catch (error) {
                        console.error('Error clicking + button:', error);
                        await sleep(2000);
                    }
                }
            }
            
            await sleep(2000);
        } catch (error) {
            console.error('Error in automateStashDB:', error);
        }
    }

    async function AutomateThePornDB() {
        try {
            console.log('Starting AutomateThePornDB...');
            
            // Click the "Apply" button with robust detection
            console.log('Looking for Apply button...');
            let applyButton = await findApplyButton();
            if (!applyButton) {
                console.error('Could not find Apply button');
                // Log all buttons for debugging
                const allButtons = document.querySelectorAll('button');
                console.log('All buttons on page:');
                allButtons.forEach((btn, index) => {
                    if (index < 15) { // Show more buttons for debugging
                        console.log(`Button ${index}: "${btn.textContent.trim()}" - classes: ${btn.className}`);
                    }
                });
                return;
            }
            applyButton.click();
            console.log('Successfully clicked Apply button');
            await sleep(300);

            // Click the "Save" button with robust detection
            console.log('Looking for Save button...');
            let saveButton = await findSaveButton();
            if (!saveButton) {
                console.error('Could not find Save button');
                return;
            }
            saveButton.click();
            console.log('Successfully clicked Save button');

            // Click the "Edit" button
            console.log('Looking for Edit button...');
            const editSuccess = await clickElementOptimized(['a[data-rb-event-key="scene-edit-panel"]'], 'Edit button');
            if (!editSuccess) return;
            await sleep(500);

            // Wait for edit panel to load and find scrape button
            console.log('Looking for scrape button...');
            let scrapeButton = null;
            let attempts = 0;
            const maxAttempts = 10;
            
            while (!scrapeButton && attempts < maxAttempts) {
                scrapeButton = await findScrapeButton();
                if (!scrapeButton) {
                    console.log(`Scrape button not found, attempt ${attempts + 1}/${maxAttempts}`);
                    await sleep(500);
                    attempts++;
                }
            }
            
            if (!scrapeButton) {
                console.error('Could not find Scrape button after all attempts');
                return;
            }
            
            scrapeButton.click();
            console.log('Successfully clicked scrape button');
            await sleep(500);

            // Click on the dropdown option with the text "stashdb.org"
            const dropdownOptions = document.querySelectorAll('.dropdown-menu.show a.dropdown-item');
            for (const option of dropdownOptions) {
                if (option.textContent.trim() === 'stashdb.org') {
                    option.click();
                    console.log("Clicking StashDB");
                    break;
                }
            }
            await sleep(2500);

            // Find and select all + tags (studios, performers, tags, etc)
            const plusButtons = document.querySelectorAll('button.minimal.ml-2.btn.btn-primary svg[data-prefix="fas"][data-icon="plus"]');
            if (plusButtons.length > 0) {
                const totalButtons = plusButtons.length;
                console.log(`Total new entries found: ${totalButtons}`);
                
                for (let i = 0; i < plusButtons.length; i++) {
                    try {
                        const button = plusButtons[i].closest('button');
                        if (button) {
                            button.click();
                            console.log(`Clicking + Button ${i + 1}/${totalButtons}`);
                            
                            if (i < totalButtons - 1) {
                                await sleep(2000);
                            } else {
                                console.log("Waiting a bit longer for the last tag");
                                await sleep(5000);
                            }
                        }
                    } catch (error) {
                        console.error('Error clicking + button:', error);
                        await sleep(2000);
                    }
                }
            }

            // Final Apply and Save with robust detection
            console.log('Looking for final Apply button...');
            let finalApplyButton = await findApplyButton();
            if (finalApplyButton) {
                finalApplyButton.click();
                console.log('Successfully clicked final Apply button');
                await sleep(300);
            } else {
                console.warn('Final Apply button not found');
            }
            
            console.log('Looking for final Save button...');
            let finalSaveButton = await findSaveButton();
            if (finalSaveButton) {
                finalSaveButton.click();
                console.log('Successfully clicked final Save button');
            } else {
                console.warn('Final Save button not found');
            }
            
        } catch (error) {
            console.error('Error in AutomateThePornDB:', error);
        }
    }

    // Enhanced Button Creation with Stash-optimized styling and intelligent display logic
    async function createOptimizedButtons() {
        // Prevent infinite loops with a cooldown mechanism
        const now = Date.now();
        if (window.lastButtonCreationAttempt && (now - window.lastButtonCreationAttempt) < 5000) {
            console.log('🕒 Button creation cooldown active, skipping...');
            return;
        }
        window.lastButtonCreationAttempt = now;

        // Remove existing panel if it exists
        const existingPanel = document.querySelector('#stash-automation-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        // Check if we're on a scene page
        const isScenePage = window.location.pathname.includes('/scenes/') && 
                           !window.location.pathname.includes('/scenes/new') &&
                           !window.location.pathname.includes('/scenes/edit');
        
        if (!isScenePage) {
            console.log('🚫 Not on a scene page, skipping button creation');
            return;
        }

        // Check if the scene is already organized with timeout and proper error handling
        let alreadyOrganized = false;
        let organizedCheckFailed = false;
        
        try {
            // Set a timeout for the organized check to prevent hanging
            const organizedCheckPromise = checkIfAlreadyOrganized();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Organized check timeout')), 3000)
            );
            
            alreadyOrganized = await Promise.race([organizedCheckPromise, timeoutPromise]);
            
            if (alreadyOrganized) {
                console.log('✅ Scene is already organized, skipping button creation');
                return;
            }
        } catch (error) {
            console.log('⚠️ Could not reliably check organized status:', error.message);
            organizedCheckFailed = true;
            
            // If we can't check organized status, look for obvious indicators before showing button
            const obviousOrganizedIndicators = document.querySelectorAll('div.organized, .scene-toolbar .btn-warning, .scene-toolbar .btn-orange');
            if (obviousOrganizedIndicators.length > 0) {
                console.log('✅ Found obvious organized indicators, skipping button creation');
                return;
            }
        }

        console.log('🎯 Scene page detected and appears not organized - creating automation button');
        
        // Add a flag to prevent multiple button creation attempts
        if (window.buttonCreationInProgress) {
            console.log('🔄 Button creation already in progress, skipping...');
            return;
        }
        window.buttonCreationInProgress = true;

        try {
            const panel = document.createElement('div');
            panel.id = 'stash-automation-panel';
            panel.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 10000;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 12px;
                padding: 15px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.2);
                backdrop-filter: blur(10px);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            `;

            const title = document.createElement('div');
            title.textContent = '🚀 Optimized Stash Automation';
            title.style.cssText = `
                color: white;
                font-weight: bold;
                font-size: 16px;
                margin-bottom: 12px;
                text-align: center;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;
            
            const completeButton = document.createElement('button');
            completeButton.textContent = '⚡ Complete Automation';
            completeButton.style.cssText = `
                width: 100%;
                padding: 12px 20px;
                background: linear-gradient(45deg, #28a745, #20c997);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                transition: transform 0.2s, box-shadow 0.2s;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            `;
            
            completeButton.addEventListener('mouseenter', () => {
                completeButton.style.transform = 'translateY(-2px)';
                completeButton.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
            });
            
            completeButton.addEventListener('mouseleave', () => {
                completeButton.style.transform = 'translateY(0)';
                completeButton.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
            });
            
            completeButton.addEventListener('click', automateComplete);

            const info = document.createElement('div');
            info.textContent = 'StashDB + ThePornDB + Auto-organize';
            info.style.cssText = `
                color: rgba(255,255,255,0.8);
                font-size: 12px;
                text-align: center;
                margin-top: 8px;
            `;

            panel.appendChild(title);
            panel.appendChild(completeButton);
            panel.appendChild(info);
            document.body.appendChild(panel);
            
            console.log('🎨 Optimized automation panel created with enhanced UI');
            
        } catch (panelError) {
            console.error('❌ Error creating automation panel:', panelError);
        } finally {
            // Always reset the flag
            window.buttonCreationInProgress = false;
        }
    }

    // Wait for DOM to be ready and create optimized buttons
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => createOptimizedButtons());
    } else {
        createOptimizedButtons();
    }

    // Reduced frequency for button creation to prevent loops
    setTimeout(() => createOptimizedButtons(), 2000);
    setTimeout(() => createOptimizedButtons(), 5000);

    // Enhanced MutationObserver with React SPA awareness and debouncing
    let mutationTimeout;
    const observer = new MutationObserver((mutations) => {
        // Debounce mutations to prevent excessive calls
        clearTimeout(mutationTimeout);
        mutationTimeout = setTimeout(() => {
            const isScenePage = window.location.pathname.includes('/scenes/');
            const hasAutomationPanel = document.querySelector('#stash-automation-panel');
            
            // Only create buttons if on scene page, no panel exists, and automation not completed
            if (isScenePage && !hasAutomationPanel && !automationCompleted) {
                console.log('🔄 DOM mutation detected on scene page, checking for button creation...');
                createOptimizedButtons();
            } else if (automationCompleted) {
                console.log('✅ Automation completed - skipping button recreation');
            }
        }, 1000); // 1 second debounce
    });

    // Enhanced navigation observer for SPA route changes with debouncing
    let currentPath = window.location.pathname;
    let navigationTimeout;
    const checkForNavigation = () => {
        if (window.location.pathname !== currentPath) {
            currentPath = window.location.pathname;
            console.log('🔄 Page navigation detected:', currentPath);
            
            // Reset completion flag on navigation to new scene
            if (window.location.pathname.includes('/scenes/') && currentPath !== window.location.pathname) {
                automationCompleted = false;
                console.log('🔄 New scene detected - resetting automation flag');
            }
            
            // Debounce navigation changes
            clearTimeout(navigationTimeout);
            navigationTimeout = setTimeout(() => {
                if (!automationCompleted) {
                    createOptimizedButtons();
                }
            }, 1000);
        }
    };

    // Check for navigation changes less frequently
    setInterval(checkForNavigation, 2000);

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();