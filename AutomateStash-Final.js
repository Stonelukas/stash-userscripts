// ==UserScript==
// @name         AutomateStash Final
// @version      4.19.1
// @description  AutomateStash - with post-automation summary widget
// @author       You
// @match        http://localhost:9998/*
// @exclude      http://localhost:9998/scenes/markers?*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_notification
// ==/UserScript==

(function () {
    'use strict';


    // ===== STASH API CONFIGURATION =====
    const STASH_API = {
        endpoint: '/graphql',
        address: GM_getValue('stash_address', 'http://localhost:9998'),
        apiKey: GM_getValue('stash_api_key', ''),
        timeout: 10000
    };

    // ===== CONFIGURATION SYSTEM =====
    const CONFIG = {
        AUTO_SCRAPE_STASHDB: 'autoScrapeStashDB',
        AUTO_SCRAPE_THEPORNDB: 'autoScrapeThePornDB',
        AUTO_ORGANIZE: 'autoOrganize',
        AUTO_CREATE_PERFORMERS: 'autoCreatePerformers',
        SHOW_NOTIFICATIONS: 'showNotifications',
        MINIMIZE_WHEN_COMPLETE: 'minimizeWhenComplete',
        AUTO_APPLY_CHANGES: 'autoApplyChanges',
        SKIP_ALREADY_SCRAPED: 'skipAlreadyScraped',
        // New GraphQL-based options
        ENABLE_CROSS_SCENE_INTELLIGENCE: 'enableCrossSceneIntelligence',
        STASH_ADDRESS: 'stashAddress',
        STASH_API_KEY: 'stashApiKey',
        // Thumbnail comparison options
        PREFER_HIGHER_RES_THUMBNAILS: 'preferHigherResThumbnails'
    };

    const DEFAULTS = {
        [CONFIG.AUTO_SCRAPE_STASHDB]: true,
        [CONFIG.AUTO_SCRAPE_THEPORNDB]: true,
        [CONFIG.AUTO_ORGANIZE]: true,
        [CONFIG.AUTO_CREATE_PERFORMERS]: true,
        [CONFIG.SHOW_NOTIFICATIONS]: true,
        [CONFIG.MINIMIZE_WHEN_COMPLETE]: true,
        [CONFIG.AUTO_APPLY_CHANGES]: false,
        [CONFIG.SKIP_ALREADY_SCRAPED]: true,
        // New defaults for GraphQL features
        [CONFIG.ENABLE_CROSS_SCENE_INTELLIGENCE]: true,
        [CONFIG.STASH_ADDRESS]: 'http://localhost:9998',
        [CONFIG.STASH_API_KEY]: '',
        // Thumbnail comparison defaults
        [CONFIG.PREFER_HIGHER_RES_THUMBNAILS]: true
    };

    function getConfig(key) {
        const value = GM_getValue(key);
        return value !== undefined ? value : DEFAULTS[key];
    }

    function setConfig(key, value) {
        GM_setValue(key, value);
    }

    // ===== NOTIFICATION SYSTEM =====
    class NotificationManager {
        show(message, type = 'info', duration = 4000) {
            if (!getConfig(CONFIG.SHOW_NOTIFICATIONS)) return;

            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10001;
                background: ${this.getColor(type)};
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                max-width: 400px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                font-family: 'Segoe UI', sans-serif;
                font-size: 14px;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
                cursor: pointer;
            `;

            notification.innerHTML = `${this.getIcon(type)} ${message}`;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateX(0)';
            }, 100);

            if (duration > 0) {
                setTimeout(() => {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(() => notification.remove(), 300);
                }, duration);
            }

            notification.addEventListener('click', () => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            });
        }

        getColor(type) {
            const colors = {
                success: '#28a745',
                error: '#dc3545',
                warning: '#ffc107',
                info: '#17a2b8'
            };
            return colors[type] || colors.info;
        }

        getIcon(type) {
            const icons = {
                success: '✅',
                error: '❌',
                warning: '⚠️',
                info: 'ℹ️'
            };
            return icons[type] || icons.info;
        }
    }

    const notifications = new NotificationManager();

    // ===== GRAPHQL API CLIENT =====
    
    /**
     * GraphQLClient - Direct GraphQL communication with Stash API
     * Inspired by stashdb-extension patterns for scene lookup and status detection
     */
    class GraphQLClient {
        constructor() {
            this.baseUrl = getConfig(CONFIG.STASH_ADDRESS);
            this.apiKey = getConfig(CONFIG.STASH_API_KEY);
            this.endpoint = `${this.baseUrl}${STASH_API.endpoint}`;
        }

        /**
         * Execute GraphQL query against Stash API
         * @param {string} query - GraphQL query string
         * @param {Object} variables - Query variables
         * @returns {Promise<Object>} Query results
         */
        async query(query, variables = {}) {
            try {
                const headers = {
                    'Content-Type': 'application/json'
                };

                // Add API key if configured (following extension pattern)
                if (this.apiKey && this.apiKey.length > 0) {
                    headers['ApiKey'] = this.apiKey;
                }

                const response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ query, variables })
                });

                if (!response.ok) {
                    throw new Error(`GraphQL request failed: ${response.status}`);
                }

                const result = await response.json();
                
                if (result.errors) {
                    throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
                }

                return result.data;
            } catch (error) {
                throw error;
            }
        }

        /**
         * Find scene by StashDB ID (from extension pattern)
         * @param {string} stashId - StashDB scene ID
         * @returns {Promise<Array>} Array of matching scenes
         */
        async findSceneByStashId(stashId) {
            const query = `
                query FindSceneByStashId($id: String!) {
                    findScenes(scene_filter: {stash_id: {value: $id, modifier: EQUALS}}) {
                        scenes {
                            id
                            title
                            stash_ids {
                                endpoint
                                stash_id
                            }
                            organized
                            created_at
                            updated_at
                        }
                    }
                }
            `;

            const result = await this.query(query, { id: stashId });
            return result.findScenes.scenes;
        }

        /**
         * Get current scene details
         * @param {string} sceneId - Stash scene ID
         * @returns {Promise<Object>} Scene details
         */
        async getSceneDetails(sceneId) {
            const query = `
                query GetScene($id: ID!) {
                    findScene(id: $id) {
                        id
                        title
                        details
                        organized
                        stash_ids {
                            endpoint
                            stash_id
                        }
                        performers {
                            id
                            name
                        }
                        studio {
                            id
                            name
                        }
                        tags {
                            id
                            name
                        }
                        created_at
                        updated_at
                    }
                }
            `;

            const result = await this.query(query, { id: sceneId });
            return result.findScene;
        }

        /**
         * Search for scenes with metadata patterns
         * @param {Object} filters - Search filters
         * @returns {Promise<Array>} Matching scenes
         */
        async searchScenes(filters = {}) {
            const query = `
                query SearchScenes($filter: SceneFilterType) {
                    findScenes(scene_filter: $filter) {
                        count
                        scenes {
                            id
                            title
                            stash_ids {
                                endpoint
                                stash_id
                            }
                            organized
                            performers {
                                name
                            }
                            studio {
                                name
                            }
                        }
                    }
                }
            `;

            const result = await this.query(query, { filter: filters });
            return result.findScenes;
        }

        /**
         * Extract scene ID from current URL
         * @returns {string|null} Scene ID if on scene page
         */
        getCurrentSceneId() {
            const url = window.location.href;
            const match = url.match(/\/scenes\/(\d+)/);
            return match ? match[1] : null;
        }
    }

    const graphqlClient = new GraphQLClient();

    // ===== ENHANCED STATUS TRACKING SYSTEM =====
    
    /**
     * SourceDetector - Advanced detection of scraping sources and metadata
     * Implements intelligent detection strategies for StashDB, ThePornDB, and organization status
     */
    class SourceDetector {
        constructor() {
            this.detectionStrategies = {
                stashdb: [
                    { name: 'stashdb_graphql', validator: this.validateStashDBGraphQL.bind(this), confidence: 100 },
                    { name: 'stashdb_url', selector: '[data-source="stashdb"]', confidence: 95 },
                    { name: 'stashdb_id', selector: '[data-stashdb-id]', confidence: 90 },
                    { name: 'stashdb_reference', selector: '.scraper-result[data-scraper*="stashdb"]', confidence: 85 },
                    { name: 'stashdb_metadata', validator: this.validateStashDBMetadata.bind(this), confidence: 75 }
                ],
                theporndb: [
                    { name: 'theporndb_graphql', validator: this.validateThePornDBGraphQL.bind(this), confidence: 100 },
                    { name: 'theporndb_url', selector: '[data-source="theporndb"]', confidence: 95 },
                    { name: 'theporndb_id', selector: '[data-theporndb-id]', confidence: 90 },
                    { name: 'theporndb_reference', selector: '.scraper-result[data-scraper*="theporndb"]', confidence: 85 },
                    { name: 'theporndb_metadata', validator: this.validateThePornDBMetadata.bind(this), confidence: 75 }
                ],
                organized: [
                    { name: 'organized_graphql', validator: this.validateOrganizedGraphQL.bind(this), confidence: 100 },
                    { name: 'organized_button_primary', selector: 'button[title="Organized"].organized-button', confidence: 100 },
                    { name: 'organized_button_title', selector: 'button[title="Organized"]', confidence: 95 },
                    { name: 'organized_button_class', selector: 'button.organized-button', confidence: 90 },
                    { name: 'organized_button_minimal', selector: 'button.minimal.organized-button', confidence: 95 },
                    { name: 'organized_checkbox', selector: 'input[type="checkbox"][name*="organized"]', confidence: 85 },
                    { name: 'organized_indicator', validator: this.validateOrganizedStatus.bind(this), confidence: 75 }
                ]
            };
            this.cache = new Map(); // Cache GraphQL results
        }

        /**
         * Detect StashDB data with confidence scoring
         * @returns {Object} Detection result with confidence level and detected data
         */
        async detectStashDBData() {
            
            // Always try GraphQL first for most accurate results
            try {
                const graphqlResult = await this.validateStashDBGraphQL();
                if (graphqlResult.found) {
                    return {
                        ...graphqlResult,
                        strategy: 'stashdb_graphql',
                        confidence: 100
                    };
                }
            } catch (error) {
            }
            
            // Fall back to DOM-based detection if GraphQL fails
            for (const strategy of this.detectionStrategies.stashdb.filter(s => s.name !== 'stashdb_graphql')) {
                try {
                    let result = null;
                    
                    if (strategy.selector) {
                        const element = document.querySelector(strategy.selector);
                        if (element) {
                            result = {
                                found: true,
                                strategy: strategy.name,
                                confidence: strategy.confidence,
                                element: element,
                                data: this.extractStashDBData(element)
                            };
                        }
                    } else if (strategy.validator) {
                        result = await strategy.validator();
                        if (result && result.found) {
                            result.strategy = strategy.name;
                            result.confidence = strategy.confidence;
                        }
                    }
                    
                    if (result && result.found) {
                        return result;
                    }
                } catch (error) {
                }
            }
            
            return { found: false, confidence: 0, data: null };
        }

        /**
         * Detect ThePornDB data with confidence scoring
         * @returns {Object} Detection result with confidence level and detected data
         */
        async detectThePornDBData() {
            
            // Always try GraphQL first for most accurate results
            try {
                const graphqlResult = await this.validateThePornDBGraphQL();
                if (graphqlResult.found) {
                    return {
                        ...graphqlResult,
                        strategy: 'theporndb_graphql',
                        confidence: 100
                    };
                }
            } catch (error) {
            }
            
            // Fall back to DOM-based detection if GraphQL fails
            for (const strategy of this.detectionStrategies.theporndb.filter(s => s.name !== 'theporndb_graphql')) {
                try {
                    let result = null;
                    
                    if (strategy.selector) {
                        const element = document.querySelector(strategy.selector);
                        if (element) {
                            result = {
                                found: true,
                                strategy: strategy.name,
                                confidence: strategy.confidence,
                                element: element,
                                data: this.extractThePornDBData(element)
                            };
                        }
                    } else if (strategy.validator) {
                        result = await strategy.validator();
                        if (result && result.found) {
                            result.strategy = strategy.name;
                            result.confidence = strategy.confidence;
                        }
                    }
                    
                    if (result && result.found) {
                        return result;
                    }
                } catch (error) {
                }
            }
            
            return { found: false, confidence: 0, data: null };
        }

        /**
         * Detect organized status
         * @returns {Object} Detection result with confidence level
         */
        async detectOrganizedStatus() {
            
            // Always try GraphQL first for most accurate results
            try {
                const graphqlResult = await this.validateOrganizedGraphQL();
                if (graphqlResult.found) {
                    return {
                        ...graphqlResult,
                        strategy: 'organized_graphql',
                        confidence: 100
                    };
                }
            } catch (error) {
            }
            
            // Fall back to DOM-based detection if GraphQL fails
            for (const strategy of this.detectionStrategies.organized.filter(s => s.name !== 'organized_graphql')) {
                try {
                    let result = null;
                    
                    if (strategy.selector) {
                        const element = document.querySelector(strategy.selector);
                        if (element) {
                            const isOrganized = this.isElementOrganized(element);
                            result = {
                                found: true,
                                strategy: strategy.name,
                                confidence: strategy.confidence,
                                element: element,
                                organized: isOrganized
                            };
                        }
                    } else if (strategy.validator) {
                        result = await strategy.validator();
                        if (result && result.found !== false) {
                            result.strategy = strategy.name;
                            result.confidence = strategy.confidence;
                        }
                    }
                    
                    if (result && result.found) {
                        return result;
                    }
                } catch (error) {
                }
            }
            
            return { found: false, confidence: 0, organized: false };
        }

        /**
         * Scan page for available scraping sources
         * @returns {Array} List of available scraping options
         */
        async scanAvailableSources() {
            
            const sources = [];
            
            // Look for scraper dropdown options based on Stash UI structure
            const scraperSelectors = [
                // Stash uses React-Bootstrap ButtonGroup with ScraperMenu
                '.scraper-group .btn-group .dropdown-item',
                '.scraper-group .dropdown-menu .dropdown-item',
                // Alternative scraper UI patterns
                '.btn-group .dropdown-item[data-scraper]',
                '.scraper-dropdown option',
                'select[data-scraper] option',
                // StashBox scrapers
                '.dropdown-menu .dropdown-item',
                // Fragment scrapers and query scrapers
                '.scraper-menu .dropdown-item'
            ];
            
            for (const selector of scraperSelectors) {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    const text = element.textContent.trim();
                    const value = element.value || 
                                 element.getAttribute('data-scraper') || 
                                 element.getAttribute('data-value') ||
                                 text; // Use text as fallback value
                    
                    if (text && text.length > 0 && !sources.some(s => s.name === text)) {
                        sources.push({
                            name: text,
                            value: value || text,
                            available: !element.disabled && !element.classList.contains('disabled'),
                            element: element,
                            selector: selector
                        });
                    }
                });
            }
            
            // Also look for any scraper-related buttons or menu toggles
            const allButtons = document.querySelectorAll('button, [data-toggle="dropdown"]');
            allButtons.forEach(button => {
                const text = button.textContent.trim().toLowerCase();
                if (text.includes('scrape') && !sources.some(s => s.name === button.textContent.trim())) {
                    sources.push({
                        name: button.textContent.trim(),
                        value: 'scraper-button',
                        available: !button.disabled,
                        element: button,
                        selector: 'button'
                    });
                }
            });
            
            return sources;
        }

        /**
         * Extract StashDB-specific data from element
         */
        extractStashDBData(element) {
            const data = {
                title: null,
                performers: [],
                studio: null,
                tags: [],
                metadata: {}
            };
            
            // Try to extract data from various element structures
            if (element.dataset.stashdbId) {
                data.metadata.stashdb_id = element.dataset.stashdbId;
            }
            
            // Look for nearby data fields
            const container = element.closest('.scraper-result, .scene-edit-details, .form-container');
            if (container) {
                // Extract title
                const titleField = container.querySelector('input[data-field="title"], input[name="title"]');
                if (titleField) data.title = titleField.value;
                
                // Extract performers
                const performerFields = container.querySelectorAll('[data-field*="performer"], [name*="performer"]');
                performerFields.forEach(field => {
                    if (field.value) data.performers.push(field.value);
                });
                
                // Extract studio
                const studioField = container.querySelector('input[data-field="studio"], input[name="studio"]');
                if (studioField) data.studio = studioField.value;
                
                // Extract tags
                const tagFields = container.querySelectorAll('[data-field*="tag"], [name*="tag"]');
                tagFields.forEach(field => {
                    if (field.value) data.tags.push(field.value);
                });
            }
            
            return data;
        }

        /**
         * Extract ThePornDB-specific data from element
         */
        extractThePornDBData(element) {
            const data = {
                title: null,
                performers: [],
                studio: null,
                tags: [],
                metadata: {}
            };
            
            // Try to extract data from various element structures
            if (element.dataset.theporndbId) {
                data.metadata.theporndb_id = element.dataset.theporndbId;
            }
            
            // Look for nearby data fields (similar to StashDB but with ThePornDB-specific patterns)
            const container = element.closest('.scraper-result, .scene-edit-details, .form-container');
            if (container) {
                // Extract title
                const titleField = container.querySelector('input[data-field="title"], input[name="title"]');
                if (titleField) data.title = titleField.value;
                
                // Extract performers
                const performerFields = container.querySelectorAll('[data-field*="performer"], [name*="performer"]');
                performerFields.forEach(field => {
                    if (field.value) data.performers.push(field.value);
                });
                
                // Extract studio
                const studioField = container.querySelector('input[data-field="studio"], input[name="studio"]');
                if (studioField) data.studio = studioField.value;
                
                // Extract tags
                const tagFields = container.querySelectorAll('[data-field*="tag"], [name*="tag"]');
                tagFields.forEach(field => {
                    if (field.value) data.tags.push(field.value);
                });
            }
            
            return data;
        }

        /**
         * Check if element indicates organized status
         */
        isElementOrganized(element) {
            if (element.type === 'checkbox') {
                return element.checked;
            } else if (element.tagName === 'BUTTON') {
                // Based on Stash OrganizedButton.tsx - organized state is indicated by 'organized' class
                return element.classList.contains('organized') || 
                       element.getAttribute('aria-pressed') === 'true' ||
                       element.dataset.organized === 'true';
            }
            return false;
        }

        /**
         * Validate StashDB data through GraphQL API (highest confidence)
         */
        async validateStashDBGraphQL() {
            // Always use GraphQL for accurate detection

            try {
                const sceneId = graphqlClient.getCurrentSceneId();
                if (!sceneId) {
                    return { found: false, reason: 'Not on scene page' };
                }

                // Check cache first
                const cacheKey = `stashdb_${sceneId}`;
                if (this.cache.has(cacheKey)) {
                    return this.cache.get(cacheKey);
                }

                const sceneDetails = await graphqlClient.getSceneDetails(sceneId);
                if (!sceneDetails) {
                    return { found: false, reason: 'Scene not found' };
                }

                // Check for StashDB identifiers
                const stashdbIds = sceneDetails.stash_ids?.filter(id => 
                    id.endpoint && id.endpoint.includes('stashdb.org')
                ) || [];

                const result = {
                    found: stashdbIds.length > 0,
                    data: {
                        stash_ids: stashdbIds,
                        scene_id: sceneId,
                        scene_title: sceneDetails.title,
                        last_updated: sceneDetails.updated_at
                    },
                    confidence: 100
                };

                // Cache result
                this.cache.set(cacheKey, result);
                return result;

            } catch (error) {
                return { found: false, reason: `GraphQL error: ${error.message}` };
            }
        }

        /**
         * Validate ThePornDB data through GraphQL API (highest confidence)
         */
        async validateThePornDBGraphQL() {
            // Always use GraphQL for accurate detection

            try {
                const sceneId = graphqlClient.getCurrentSceneId();
                if (!sceneId) {
                    return { found: false, reason: 'Not on scene page' };
                }

                // Check cache first
                const cacheKey = `theporndb_${sceneId}`;
                if (this.cache.has(cacheKey)) {
                    return this.cache.get(cacheKey);
                }

                const sceneDetails = await graphqlClient.getSceneDetails(sceneId);
                if (!sceneDetails) {
                    return { found: false, reason: 'Scene not found' };
                }

                // Check for ThePornDB identifiers
                const theporndbIds = sceneDetails.stash_ids?.filter(id => 
                    id.endpoint && (
                        id.endpoint.includes('metadataapi.net') ||
                        id.endpoint.includes('theporndb') ||
                        id.endpoint.includes('tpdb')
                    )
                ) || [];

                const result = {
                    found: theporndbIds.length > 0,
                    data: {
                        stash_ids: theporndbIds,
                        scene_id: sceneId,
                        scene_title: sceneDetails.title,
                        last_updated: sceneDetails.updated_at
                    },
                    confidence: 100
                };

                // Cache result
                this.cache.set(cacheKey, result);
                return result;

            } catch (error) {
                return { found: false, reason: `GraphQL error: ${error.message}` };
            }
        }

        /**
         * Validate organized status through GraphQL API (highest confidence)
         */
        async validateOrganizedGraphQL() {
            // Always use GraphQL for accurate detection

            try {
                const sceneId = graphqlClient.getCurrentSceneId();
                if (!sceneId) {
                    return { found: false, reason: 'Not on scene page' };
                }

                // Check cache first
                const cacheKey = `organized_${sceneId}`;
                if (this.cache.has(cacheKey)) {
                    return this.cache.get(cacheKey);
                }

                const sceneDetails = await graphqlClient.getSceneDetails(sceneId);
                if (!sceneDetails) {
                    return { found: false, reason: 'Scene not found' };
                }

                const result = {
                    found: true,
                    organized: sceneDetails.organized || false,
                    data: {
                        scene_id: sceneId,
                        scene_title: sceneDetails.title,
                        organized: sceneDetails.organized,
                        last_updated: sceneDetails.updated_at
                    },
                    confidence: 100
                };

                // Cache result
                this.cache.set(cacheKey, result);
                return result;

            } catch (error) {
                return { found: false, reason: `GraphQL error: ${error.message}` };
            }
        }

        /**
         * Validate StashDB metadata through content analysis
         */
        async validateStashDBMetadata() {
            // Look for StashDB-specific patterns in metadata
            const indicators = [
                'stashdb.org',
                'StashDB ID',
                'stash-db',
                /stashdb[_-]?id/i
            ];
            
            const allText = document.body.textContent;
            const foundIndicators = indicators.filter(indicator => {
                if (typeof indicator === 'string') {
                    return allText.includes(indicator);
                } else if (indicator instanceof RegExp) {
                    return indicator.test(allText);
                }
                return false;
            });
            
            if (foundIndicators.length > 0) {
                return {
                    found: true,
                    indicators: foundIndicators,
                    data: { detected_patterns: foundIndicators }
                };
            }
            
            return { found: false };
        }

        /**
         * Validate ThePornDB metadata through content analysis
         */
        async validateThePornDBMetadata() {
            // Look for ThePornDB-specific patterns in metadata inputs only
            const metadataInputs = document.querySelectorAll('input[type="text"], input[type="url"], textarea');
            
            const indicators = [
                'theporndb.net',
                'metadataapi.net',
                /theporndb[_-]?id[:=]\s*\d+/i,
                /tpdb[_-]?id[:=]\s*\d+/i
            ];
            
            for (const input of metadataInputs) {
                const value = input.value || '';
                // Skip empty inputs and our own script elements
                if (!value.trim() || input.closest('#stash-automation-panel')) continue;
                
                const foundIndicator = indicators.some(indicator => {
                    if (typeof indicator === 'string') {
                        return value.includes(indicator);
                    } else if (indicator instanceof RegExp) {
                        return indicator.test(value);
                    }
                    return false;
                });
                
                if (foundIndicator) {
                    return {
                        found: true,
                        data: { source: 'metadata_input', value: value }
                    };
                }
            }
            
            return { found: false };
        }

        /**
         * Validate organized status through UI analysis
         */
        async validateOrganizedStatus() {
            // Look for organized-related UI elements and patterns
            const organizedElements = document.querySelectorAll('*');
            let organizedFound = false;
            
            for (const element of organizedElements) {
                const text = element.textContent || '';
                const attributes = element.getAttributeNames();
                
                // Check text content
                if (text.toLowerCase().includes('organized') && element.children.length === 0) {
                    const parentInput = element.closest('label')?.querySelector('input[type="checkbox"]') ||
                                      element.parentElement?.querySelector('input[type="checkbox"]');
                    
                    if (parentInput) {
                        return {
                            found: true,
                            organized: parentInput.checked,
                            element: parentInput
                        };
                    }
                }
                
                // Check attributes
                for (const attr of attributes) {
                    const value = element.getAttribute(attr);
                    if ((attr.toLowerCase().includes('organized') || value.toLowerCase().includes('organized')) &&
                        (element.type === 'checkbox' || element.tagName === 'BUTTON')) {
                        return {
                            found: true,
                            organized: this.isElementOrganized(element),
                            element: element
                        };
                    }
                }
            }
            
            return { found: false };
        }
    }

    /**
     * StatusTracker - Manages scene status detection and history
     * Provides comprehensive status tracking and real-time updates
     */
    class StatusTracker {
        constructor(sourceDetector) {
            this.sourceDetector = sourceDetector;
            this.currentStatus = {
                sceneId: null,
                url: window.location.href,
                stashdb: { scraped: false, timestamp: null, confidence: 0, data: null },
                theporndb: { scraped: false, timestamp: null, confidence: 0, data: null },
                organized: false,
                lastAutomation: null,
                lastUpdate: null
            };
            this.statusUpdateCallbacks = [];
        }

        /**
         * Detect and update current scene status
         * @returns {Object} Complete status object
         */
        async detectCurrentStatus() {
            
            try {
                // Extract scene ID from URL
                this.currentStatus.sceneId = this.extractSceneId();
                this.currentStatus.url = window.location.href;
                this.currentStatus.lastUpdate = new Date();

                // Detect StashDB status
                const stashdbResult = await this.sourceDetector.detectStashDBData();
                this.currentStatus.stashdb = {
                    scraped: stashdbResult.found,
                    timestamp: stashdbResult.found ? new Date() : null,
                    confidence: stashdbResult.confidence,
                    data: stashdbResult.data,
                    strategy: stashdbResult.strategy
                };

                // Detect ThePornDB status
                const theporndbResult = await this.sourceDetector.detectThePornDBData();
                this.currentStatus.theporndb = {
                    scraped: theporndbResult.found,
                    timestamp: theporndbResult.found ? new Date() : null,
                    confidence: theporndbResult.confidence,
                    data: theporndbResult.data,
                    strategy: theporndbResult.strategy
                };

                // Detect organized status
                const organizedResult = await this.sourceDetector.detectOrganizedStatus();
                this.currentStatus.organized = organizedResult.organized || false;

                
                // Notify callbacks of status update
                this.notifyStatusUpdate();
                
                return this.currentStatus;
            } catch (error) {
                return this.currentStatus;
            }
        }

        /**
         * Update status for specific source
         * @param {string} source - Source name (stashdb, theporndb, organized)
         * @param {Object} data - Update data
         */
        updateStatus(source, data) {
            
            switch (source) {
                case 'stashdb':
                    this.currentStatus.stashdb = {
                        ...this.currentStatus.stashdb,
                        ...data,
                        timestamp: new Date()
                    };
                    break;
                case 'theporndb':
                    this.currentStatus.theporndb = {
                        ...this.currentStatus.theporndb,
                        ...data,
                        timestamp: new Date()
                    };
                    break;
                case 'organized':
                    this.currentStatus.organized = data.organized || false;
                    break;
                case 'automation':
                    this.currentStatus.lastAutomation = {
                        timestamp: new Date(),
                        success: data.success,
                        sourcesUsed: data.sourcesUsed || [],
                        errors: data.errors || [],
                        ...data
                    };
                    break;
            }
            
            this.currentStatus.lastUpdate = new Date();
            this.notifyStatusUpdate();
        }

        /**
         * Get formatted status summary
         * @returns {Object} Formatted status summary for display
         */
        getStatusSummary() {
            const summary = {
                scene: {
                    id: this.currentStatus.sceneId,
                    name: this.extractSceneName() || 'Unknown Scene',
                    url: this.currentStatus.url
                },
                sources: {
                    stashdb: {
                        status: this.currentStatus.stashdb.scraped ? 'Scraped' : 'Not scraped',
                        confidence: this.currentStatus.stashdb.confidence,
                        strategy: this.currentStatus.stashdb.strategy,
                        timestamp: this.currentStatus.stashdb.timestamp,
                        icon: this.currentStatus.stashdb.scraped ? '✅' : '❌',
                        color: this.currentStatus.stashdb.scraped ? '#28a745' : '#6c757d'
                    },
                    theporndb: {
                        status: this.currentStatus.theporndb.scraped ? 'Scraped' : 'Not scraped',
                        confidence: this.currentStatus.theporndb.confidence,
                        strategy: this.currentStatus.theporndb.strategy,
                        timestamp: this.currentStatus.theporndb.timestamp,
                        icon: this.currentStatus.theporndb.scraped ? '✅' : '❌',
                        color: this.currentStatus.theporndb.scraped ? '#28a745' : '#6c757d'
                    }
                },
                organized: {
                    status: this.currentStatus.organized ? 'Organized' : 'Not organized',
                    icon: this.currentStatus.organized ? '✅' : '⚠️',
                    color: this.currentStatus.organized ? '#28a745' : '#ffc107'
                },
                automation: {
                    lastRun: this.currentStatus.lastAutomation?.timestamp,
                    success: this.currentStatus.lastAutomation?.success,
                    sourcesUsed: this.currentStatus.lastAutomation?.sourcesUsed || [],
                    errors: this.currentStatus.lastAutomation?.errors || []
                },
                lastUpdate: this.currentStatus.lastUpdate
            };
            
            return summary;
        }

        /**
         * Get overall completion status
         * @returns {Object} Overall status with percentage and recommendations
         */
        getCompletionStatus() {
            let completedItems = 0;
            let totalItems = 3; // stashdb, theporndb, organized
            
            if (this.currentStatus.stashdb.scraped) completedItems++;
            if (this.currentStatus.theporndb.scraped) completedItems++;
            if (this.currentStatus.organized) completedItems++;
            
            const percentage = Math.round((completedItems / totalItems) * 100);
            
            const recommendations = [];
            if (!this.currentStatus.stashdb.scraped) {
                recommendations.push('Scrape StashDB for metadata');
            }
            if (!this.currentStatus.theporndb.scraped) {
                recommendations.push('Scrape ThePornDB for additional metadata');
            }
            if (!this.currentStatus.organized) {
                recommendations.push('Mark scene as organized');
            }
            
            return {
                percentage,
                completedItems,
                totalItems,
                status: percentage === 100 ? 'Complete' : `${completedItems}/${totalItems} completed`,
                recommendations,
                color: percentage === 100 ? '#28a745' : percentage >= 66 ? '#ffc107' : '#dc3545'
            };
        }

        /**
         * Register callback for status updates
         * @param {Function} callback - Function to call on status updates
         */
        onStatusUpdate(callback) {
            this.statusUpdateCallbacks.push(callback);
        }

        /**
         * Remove status update callback
         * @param {Function} callback - Callback to remove
         */
        removeStatusUpdateCallback(callback) {
            const index = this.statusUpdateCallbacks.indexOf(callback);
            if (index > -1) {
                this.statusUpdateCallbacks.splice(index, 1);
            }
        }

        /**
         * Notify all callbacks of status updates
         */
        notifyStatusUpdate() {
            const summary = this.getStatusSummary();
            this.statusUpdateCallbacks.forEach(callback => {
                try {
                    callback(summary);
                } catch (error) {
                }
            });
        }

        /**
         * Extract scene ID from current URL
         * @returns {string|null} Scene ID or null if not found
         */
        extractSceneId() {
            const urlMatch = window.location.href.match(/\/scenes\/(\d+)/);
            return urlMatch ? urlMatch[1] : null;
        }

        /**
         * Extract scene name from the current page
         * @returns {string|null} Scene name or null if not found
         */
        extractSceneName() {
            // Strategy 1: Try to get from title input field in edit form
            const titleField = document.querySelector('input[data-field="title"], input[name="title"], input[placeholder*="title" i]');
            if (titleField && titleField.value.trim()) {
                return titleField.value.trim();
            }

            // Strategy 2: Try to get from h1 or main title elements
            const titleElements = [
                'h1.scene-title',
                'h1[data-testid="scene-title"]', 
                '.scene-header h1',
                'h1',
                '.title',
                '[data-testid="title"]'
            ];

            for (const selector of titleElements) {
                const element = document.querySelector(selector);
                if (element && element.textContent.trim()) {
                    const title = element.textContent.trim();
                    // Filter out common navigation text
                    if (!title.includes('Scenes') && !title.includes('Edit') && title.length > 3) {
                        return title;
                    }
                }
            }

            // Strategy 3: Try to get from document title
            if (document.title && !document.title.includes('Stash') && !document.title.includes('localhost')) {
                return document.title.trim();
            }

            // Strategy 4: Fallback to scene ID
            const sceneId = this.extractSceneId();
            return sceneId ? `Scene ${sceneId}` : 'Unknown Scene';
        }

        /**
         * Reset status to initial state
         */
        reset() {
            this.currentStatus = {
                sceneId: null,
                url: window.location.href,
                stashdb: { scraped: false, timestamp: null, confidence: 0, data: null },
                theporndb: { scraped: false, timestamp: null, confidence: 0, data: null },
                organized: false,
                lastAutomation: null,
                lastUpdate: null
            };
            this.notifyStatusUpdate();
        }

        /**
         * Get current status (read-only)
         * @returns {Object} Current status object
         */
        getCurrentStatus() {
            return { ...this.currentStatus };
        }
    }

    /**
     * HistoryManager - Persistent storage and retrieval of automation history
     * Manages automation history using GM_setValue for cross-session persistence
     */
    class HistoryManager {
        constructor() {
            this.storageKey = '🚀automateStash_history';
            this.maxHistoryEntries = 1000; // Limit to prevent storage bloat
        }

        /**
         * Save automation history for a scene
         * @param {string} sceneId - Scene identifier
         * @param {Object} data - Automation data to save
         */
        async saveAutomationHistory(sceneId, data) {
            
            try {
                const history = await this.getAllHistory();
                const timestamp = new Date().toISOString();
                
                const historyEntry = {
                    sceneId: sceneId,
                    sceneName: data.sceneName || `Scene ${sceneId}`,
                    url: data.url || window.location.href,
                    timestamp: timestamp,
                    success: data.success || false,
                    sourcesUsed: data.sourcesUsed || [],
                    errors: data.errors || [],
                    duration: data.duration || null,
                    metadata: {
                        stashdb: data.stashdb || null,
                        theporndb: data.theporndb || null,
                        organized: data.organized || false,
                        performersCreated: data.performersCreated || 0,
                        studiosCreated: data.studiosCreated || 0,
                        tagsCreated: data.tagsCreated || 0
                    },
                    userAgent: navigator.userAgent.substring(0, 100), // Truncated for storage efficiency
                    version: '4.2.0-complete'
                };
                
                // Add to history array
                history.unshift(historyEntry); // Add to beginning for chronological order
                
                // Limit history size
                if (history.length > this.maxHistoryEntries) {
                    history.splice(this.maxHistoryEntries);
                }
                
                // Save to persistent storage
                GM_setValue(this.storageKey, JSON.stringify(history));
                
                return historyEntry;
            } catch (error) {
                return null;
            }
        }

        /**
         * Get automation history for a specific scene
         * @param {string} sceneId - Scene identifier
         * @returns {Array} Array of history entries for the scene
         */
        async getSceneHistory(sceneId) {
            
            try {
                const allHistory = await this.getAllHistory();
                const sceneHistory = allHistory.filter(entry => entry.sceneId === sceneId);
                
                return sceneHistory;
            } catch (error) {
                return [];
            }
        }

        /**
         * Get complete automation history
         * @returns {Array} Complete history array
         */
        async getAllHistory() {
            try {
                const historyJson = GM_getValue(this.storageKey, '[]');
                const history = JSON.parse(historyJson);
                
                // Validate history structure and clean up if needed
                const validHistory = history.filter(entry => {
                    return entry && 
                           entry.sceneId && 
                           entry.timestamp && 
                           typeof entry.success === 'boolean';
                });
                
                if (validHistory.length !== history.length) {
                    GM_setValue(this.storageKey, JSON.stringify(validHistory));
                }
                
                return validHistory;
            } catch (error) {
                // Reset to empty history if corrupted
                GM_setValue(this.storageKey, '[]');
                return [];
            }
        }

        /**
         * Get the most recent automation entry for a scene
         * @param {string} sceneId - Scene identifier
         * @returns {Object|null} Most recent history entry or null
         */
        async getLastAutomation(sceneId) {
            const sceneHistory = await this.getSceneHistory(sceneId);
            return sceneHistory.length > 0 ? sceneHistory[0] : null;
        }

        /**
         * Get automation statistics
         * @returns {Object} Statistics about automation history
         */
        async getStatistics() {
            
            try {
                const history = await this.getAllHistory();
                
                const stats = {
                    totalAutomations: history.length,
                    successfulAutomations: history.filter(h => h.success).length,
                    failedAutomations: history.filter(h => !h.success).length,
                    uniqueScenes: new Set(history.map(h => h.sceneId)).size,
                    sourcesUsed: {
                        stashdb: history.filter(h => h.sourcesUsed.includes('stashdb')).length,
                        theporndb: history.filter(h => h.sourcesUsed.includes('theporndb')).length
                    },
                    averageDuration: 0,
                    totalDuration: 0,
                    oldestEntry: null,
                    newestEntry: null,
                    errorsCount: history.reduce((sum, h) => sum + (h.errors?.length || 0), 0)
                };
                
                // Calculate duration statistics from entries that have duration data
                const entriesWithDuration = history.filter(h => h.duration && h.duration > 0);
                if (entriesWithDuration.length > 0) {
                    stats.totalDuration = entriesWithDuration.reduce((sum, h) => sum + h.duration, 0);
                    stats.averageDuration = Math.round(stats.totalDuration / entriesWithDuration.length);
                }
                
                // Find oldest and newest entries
                if (history.length > 0) {
                    const sortedByDate = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    stats.oldestEntry = sortedByDate[0];
                    stats.newestEntry = sortedByDate[sortedByDate.length - 1];
                }
                
                // Calculate success rate
                stats.successRate = stats.totalAutomations > 0 ? 
                    Math.round((stats.successfulAutomations / stats.totalAutomations) * 100) : 0;
                
                return stats;
            } catch (error) {
                return {
                    totalAutomations: 0,
                    successfulAutomations: 0,
                    failedAutomations: 0,
                    uniqueScenes: 0,
                    sourcesUsed: { stashdb: 0, theporndb: 0 },
                    averageDuration: 0,
                    totalDuration: 0,
                    successRate: 0,
                    errorsCount: 0
                };
            }
        }

        /**
         * Clear all automation history
         */
        async clearHistory() {
            
            try {
                GM_setValue(this.storageKey, '[]');
                return true;
            } catch (error) {
                return false;
            }
        }

        /**
         * Clear history older than specified days
         * @param {number} days - Number of days to keep
         */
        async clearOldHistory(days = 30) {
            
            try {
                const history = await this.getAllHistory();
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - days);
                
                const recentHistory = history.filter(entry => {
                    const entryDate = new Date(entry.timestamp);
                    return entryDate >= cutoffDate;
                });
                
                const removedCount = history.length - recentHistory.length;
                
                GM_setValue(this.storageKey, JSON.stringify(recentHistory));
                
                return removedCount;
            } catch (error) {
                return 0;
            }
        }

        /**
         * Export history data
         * @returns {string} JSON string of all history data
         */
        async exportHistory() {
            
            try {
                const history = await this.getAllHistory();
                const stats = await this.getStatistics();
                
                const exportData = {
                    exportDate: new Date().toISOString(),
                    version: '4.2.0-complete',
                    statistics: stats,
                    history: history
                };
                
                const exportJson = JSON.stringify(exportData, null, 2);
                
                return exportJson;
            } catch (error) {
                return null;
            }
        }

        /**
         * Import history data (with validation)
         * @param {string} jsonData - JSON string of history data
         * @returns {boolean} Success status
         */
        async importHistory(jsonData) {
            
            try {
                const importData = JSON.parse(jsonData);
                
                // Validate import data structure
                if (!importData.history || !Array.isArray(importData.history)) {
                    throw new Error('Invalid import data: missing history array');
                }
                
                // Validate each history entry
                const validEntries = importData.history.filter(entry => {
                    return entry && 
                           entry.sceneId && 
                           entry.timestamp && 
                           typeof entry.success === 'boolean';
                });
                
                if (validEntries.length === 0) {
                    throw new Error('No valid history entries found in import data');
                }
                
                // Merge with existing history (avoiding duplicates by timestamp + sceneId)
                const existingHistory = await this.getAllHistory();
                const mergedHistory = [...validEntries];
                
                // Add existing entries that aren't duplicates
                for (const existingEntry of existingHistory) {
                    const isDuplicate = validEntries.some(newEntry => 
                        newEntry.sceneId === existingEntry.sceneId && 
                        newEntry.timestamp === existingEntry.timestamp
                    );
                    
                    if (!isDuplicate) {
                        mergedHistory.push(existingEntry);
                    }
                }
                
                // Sort by timestamp (newest first) and limit size
                mergedHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                if (mergedHistory.length > this.maxHistoryEntries) {
                    mergedHistory.splice(this.maxHistoryEntries);
                }
                
                // Save merged history
                GM_setValue(this.storageKey, JSON.stringify(mergedHistory));
                
                
                return true;
            } catch (error) {
                return false;
            }
        }

        /**
         * Get storage usage information
         * @returns {Object} Storage usage statistics
         */
        async getStorageInfo() {
            try {
                const historyJson = GM_getValue(this.storageKey, '[]');
                const sizeInBytes = new Blob([historyJson]).size;
                const sizeInKB = Math.round(sizeInBytes / 1024);
                const history = await this.getAllHistory();
                
                return {
                    entries: history.length,
                    sizeBytes: sizeInBytes,
                    sizeKB: sizeInKB,
                    maxEntries: this.maxHistoryEntries,
                    storageKey: this.storageKey
                };
            } catch (error) {
                return {
                    entries: 0,
                    sizeBytes: 0,
                    sizeKB: 0,
                    maxEntries: this.maxHistoryEntries,
                    storageKey: this.storageKey
                };
            }
        }
    }

    // ===== AUTOMATION SUMMARY WIDGET =====
    class AutomationSummaryWidget {
        constructor() {
            this.summaryData = {
                startTime: null,
                endTime: null,
                sceneName: '',
                sceneId: '',
                actions: [],
                sourcesUsed: [],
                fieldsUpdated: [],
                errors: [],
                warnings: [],
                success: false
            };
            
            this.widget = null;
            this.isMinimized = true;
            
            // Delay widget creation to ensure DOM is ready
            setTimeout(() => {
                this.createMinimizedWidget();
            }, 1000);
        }
        
        createMinimizedWidget() {
            // Check if widget already exists to avoid duplicates
            if (document.querySelector('#automation-summary-widget')) {
                return;
            }
            
            // Create minimized widget at bottom right
            this.widget = document.createElement('div');
            this.widget.id = 'automation-summary-widget';
            this.widget.style.cssText = `
                position: fixed !important;
                bottom: 20px !important;
                right: 20px !important;
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%) !important;
                border-radius: 10px !important;
                padding: 10px 15px !important;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3) !important;
                z-index: 10000 !important;
                color: white !important;
                font-family: 'Segoe UI', sans-serif !important;
                display: none !important;
                align-items: center !important;
                gap: 10px !important;
                cursor: pointer !important;
                transition: all 0.3s ease !important;
                border: 1px solid rgba(255,255,255,0.1);
                opacity: 0.8;
                min-width: 200px;
            `;
            
            this.widget.innerHTML = `
                <span style="font-size: 16px;">📊</span>
                <span style="font-size: 13px;">Summary Ready</span>
            `;
            
            // Store click handler reference so we can remove it later
            this.expandHandler = (e) => {
                // Don't expand if clicking close button
                if (e.target.tagName === 'BUTTON') return;
                if (this.isMinimized && this.summaryData.endTime) {
                    this.expandWidget();
                }
            };
            
            // Add click handler
            this.widget.addEventListener('click', this.expandHandler);
            
            // Add hover effect
            this.widget.addEventListener('mouseenter', () => {
                this.widget.style.opacity = '1';
                this.widget.style.transform = 'scale(1.05)';
            });
            
            this.widget.addEventListener('mouseleave', () => {
                if (this.isMinimized) {
                    this.widget.style.opacity = '0.8';
                    this.widget.style.transform = 'scale(1)';
                }
            });
            
            // Add CSS animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 0.8;
                    }
                }
            `;
            document.head.appendChild(style);
            
            // Append to body
            if (document.body) {
                document.body.appendChild(this.widget);
            } else {
            }
        }

        reset() {
            this.summaryData = {
                startTime: null,
                endTime: null,
                sceneName: '',
                sceneId: '',
                actions: [],
                sourcesUsed: [],
                fieldsUpdated: [],
                errors: [],
                warnings: [],
                success: false
            };
        }

        startTracking(sceneName, sceneId) {
            this.reset();
            this.summaryData.startTime = new Date();
            this.summaryData.sceneName = sceneName;
            this.summaryData.sceneId = sceneId;
            
            // Hide widget at start
            if (this.widget) {
                this.widget.style.display = 'none';
                this.isMinimized = true;
            }
            
        }

        addAction(action, status = 'success', details = '') {
            this.summaryData.actions.push({
                action,
                status,
                details,
                timestamp: new Date()
            });
        }

        addSource(source) {
            if (!this.summaryData.sourcesUsed.includes(source)) {
                this.summaryData.sourcesUsed.push(source);
            }
        }

        addFieldUpdate(field, oldValue, newValue) {
            this.summaryData.fieldsUpdated.push({
                field,
                oldValue: oldValue || 'empty',
                newValue: newValue || 'empty'
            });
        }

        addError(error) {
            this.summaryData.errors.push(error);
        }

        addWarning(warning) {
            this.summaryData.warnings.push(warning);
        }

        finishTracking(success) {
            this.summaryData.endTime = new Date();
            this.summaryData.success = success;
            const duration = (this.summaryData.endTime - this.summaryData.startTime) / 1000;
        }

        expandWidget() {
            try {
                const { startTime, endTime, sceneName, actions, sourcesUsed, fieldsUpdated, errors, warnings, success } = this.summaryData;
                const duration = endTime && startTime ? ((endTime - startTime) / 1000).toFixed(1) : '0';
                

                // Clear minimized content and expand
                this.widget.innerHTML = '';
                this.isMinimized = false;
                
                // Load saved position or use default
                const savedPosition = GM_getValue('summary_widget_position', null);
                const left = savedPosition ? savedPosition.left : 'auto';
                const top = savedPosition ? savedPosition.top : 'auto';
                const right = savedPosition ? 'auto' : '20px';
                const bottom = savedPosition ? 'auto' : '20px';
                
                // Update widget styles for expanded state
                this.widget.style.cssText = `
                    position: fixed !important;
                    ${savedPosition ? `left: ${left}px !important;` : ''}
                    ${savedPosition ? `top: ${top}px !important;` : ''}
                    ${!savedPosition ? `bottom: ${bottom} !important;` : ''}
                    ${!savedPosition ? `right: ${right} !important;` : ''}
                    background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%) !important;
                    border-radius: 15px !important;
                    padding: 20px !important;
                    width: 350px !important;
                    max-height: 500px !important;
                    overflow-y: auto !important;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
                    z-index: 10000 !important;
                    color: white !important;
                    font-family: 'Segoe UI', sans-serif !important;
                    display: block !important;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255,255,255,0.1);
                    cursor: default !important;
                    opacity: 1 !important;
                    transform: scale(1) !important;
                    transition: all 0.3s ease !important;
                `;

            // Header with close button
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 2px solid rgba(255,255,255,0.1);
            `;

            const title = document.createElement('div');
            title.innerHTML = `
                <h3 style="margin: 0 0 5px 0; font-size: 18px; color: ${success ? '#2ecc71' : '#f39c12'};">
                    ${success ? '✅ Automation Complete' : '⚠️ Automation Finished'}
                </h3>
                <div style="font-size: 12px; opacity: 0.7;">
                    ${sceneName || 'Scene'} • ${duration}s
                </div>
            `;

            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '✖';
            closeBtn.style.cssText = `
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 25px;
                height: 25px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 16px;
                transition: all 0.2s ease;
            `;
            closeBtn.addEventListener('click', () => {
                this.minimizeWidget();
            });

            header.appendChild(title);
            header.appendChild(closeBtn);

            // Scene info
            const sceneInfo = document.createElement('div');
            sceneInfo.style.cssText = `
                background: rgba(255,255,255,0.05);
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 15px;
            `;
            sceneInfo.innerHTML = `
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">📹 ${sceneName || 'Scene'}</div>
                <div style="font-size: 13px; opacity: 0.8;">⏱️ Duration: ${duration}s</div>
            `;

            // Sources used
            let sourcesSection = null;
            if (sourcesUsed.length > 0) {
                sourcesSection = document.createElement('div');
                sourcesSection.style.cssText = `
                    background: rgba(52, 152, 219, 0.1);
                    padding: 12px;
                    border-radius: 8px;
                    margin-bottom: 15px;
                    border: 1px solid rgba(52, 152, 219, 0.3);
                `;
                sourcesSection.innerHTML = `
                    <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">🔍 Sources Used</div>
                    <div style="font-size: 13px;">
                        ${sourcesUsed.map(s => `<span style="display: inline-block; background: rgba(52, 152, 219, 0.2); padding: 3px 8px; border-radius: 4px; margin: 2px;">${s}</span>`).join('')}
                    </div>
                `;
            }

            // Actions performed
            const actionsSection = document.createElement('div');
            actionsSection.style.cssText = `
                background: rgba(46, 204, 113, 0.1);
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 15px;
                border: 1px solid rgba(46, 204, 113, 0.3);
            `;
            
            const successActions = actions.filter(a => a.status === 'success');
            const skippedActions = actions.filter(a => a.status === 'skip');
            
            actionsSection.innerHTML = `
                <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">📋 Actions Performed</div>
                <div style="font-size: 12px; max-height: 150px; overflow-y: auto;">
                    ${successActions.map(a => `<div style="margin: 3px 0;">✅ ${a.action} ${a.details ? `- ${a.details}` : ''}</div>`).join('')}
                    ${skippedActions.length > 0 ? `<div style="opacity: 0.6; margin-top: 5px;">${skippedActions.map(a => `<div>⏭️ ${a.action} (skipped)</div>`).join('')}</div>` : ''}
                </div>
            `;

            // Fields updated
            let fieldsSection = null;
            if (fieldsUpdated.length > 0) {
                fieldsSection = document.createElement('div');
                fieldsSection.style.cssText = `
                    background: rgba(155, 89, 182, 0.1);
                    padding: 12px;
                    border-radius: 8px;
                    margin-bottom: 15px;
                    border: 1px solid rgba(155, 89, 182, 0.3);
                `;
                fieldsSection.innerHTML = `
                    <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">📝 Fields Updated</div>
                    <div style="font-size: 12px; max-height: 150px; overflow-y: auto;">
                        ${fieldsUpdated.map(f => `
                            <div style="margin: 5px 0; padding: 5px; background: rgba(0,0,0,0.2); border-radius: 4px;">
                                <strong>${f.field}:</strong><br>
                                <span style="opacity: 0.6;">From: ${f.oldValue}</span><br>
                                <span style="color: #2ecc71;">To: ${f.newValue}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            // Errors and warnings
            let issuesSection = null;
            if (errors.length > 0 || warnings.length > 0) {
                issuesSection = document.createElement('div');
                issuesSection.style.cssText = `
                    background: rgba(231, 76, 60, 0.1);
                    padding: 12px;
                    border-radius: 8px;
                    margin-bottom: 15px;
                    border: 1px solid rgba(231, 76, 60, 0.3);
                `;
                issuesSection.innerHTML = `
                    <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">⚠️ Issues</div>
                    <div style="font-size: 12px;">
                        ${errors.map(e => `<div style="color: #e74c3c; margin: 3px 0;">❌ ${e}</div>`).join('')}
                        ${warnings.map(w => `<div style="color: #f39c12; margin: 3px 0;">⚠️ ${w}</div>`).join('')}
                    </div>
                `;
            }

            // Summary stats
            const stats = document.createElement('div');
            stats.style.cssText = `
                display: flex;
                justify-content: space-around;
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px solid rgba(255,255,255,0.1);
                text-align: center;
            `;
            stats.innerHTML = `
                <div>
                    <div style="font-size: 24px; font-weight: bold; color: #3498db;">${successActions.length}</div>
                    <div style="font-size: 11px; opacity: 0.7;">Actions</div>
                </div>
                <div>
                    <div style="font-size: 24px; font-weight: bold; color: #9b59b6;">${fieldsUpdated.length}</div>
                    <div style="font-size: 11px; opacity: 0.7;">Fields</div>
                </div>
                <div>
                    <div style="font-size: 24px; font-weight: bold; color: ${errors.length > 0 ? '#e74c3c' : '#2ecc71'};">${errors.length}</div>
                    <div style="font-size: 11px; opacity: 0.7;">Errors</div>
                </div>
            `;

            // Assemble dialog
            this.widget.appendChild(header);
            this.widget.appendChild(sceneInfo);
            
            if (sourcesSection) {
                this.widget.appendChild(sourcesSection);
            }
            
            this.widget.appendChild(actionsSection);
            
            if (fieldsSection) {
                this.widget.appendChild(fieldsSection);
            }
            
            if (issuesSection) {
                this.widget.appendChild(issuesSection);
            }
            
            this.widget.appendChild(stats);

            // Make widget draggable
            this.makeDraggable(this.widget);
            } catch (error) {
            }
        }

        minimizeWidget() {
            this.isMinimized = true;
            
            // Update to minimized state
            this.widget.style.cssText = `
                position: fixed !important;
                bottom: 20px !important;
                right: 20px !important;
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%) !important;
                border-radius: 10px !important;
                padding: 10px 15px !important;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3) !important;
                z-index: 10000 !important;
                color: white !important;
                font-family: 'Segoe UI', sans-serif !important;
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
                cursor: pointer !important;
                transition: all 0.3s ease !important;
                border: 1px solid rgba(255,255,255,0.1);
                opacity: 0.8;
                min-width: 200px;
            `;
            
            const success = this.summaryData.success;
            this.widget.innerHTML = `
                <span style="font-size: 16px;">${success ? '✅' : '❌'}</span>
                <span style="font-size: 13px;">${success ? 'Automation Complete' : 'Automation Failed'}</span>
            `;
            
            // Re-add click handler
            this.widget.removeEventListener('click', this.expandHandler);
            this.widget.addEventListener('click', this.expandHandler);
        }
        
        showSummary() {
            
            if (!this.widget) {
                this.createMinimizedWidget();
            }
            
            if (this.summaryData.endTime && this.widget) {
                
                // Update content for minimized state
                const success = this.summaryData.success;
                this.widget.innerHTML = `
                    <span style="font-size: 16px;">${success ? '✅' : '❌'}</span>
                    <span style="font-size: 13px;">${success ? 'Automation Complete' : 'Automation Failed'}</span>
                `;
                
                // Show the widget
                this.widget.style.display = 'flex';
                
                // Re-add click handler since innerHTML was replaced
                this.widget.addEventListener('click', this.expandHandler);
                
                // Add animation
                this.widget.style.animation = 'slideInRight 0.3s ease';
                
                
                // Auto-expand after a short delay
                setTimeout(() => {
                    if (this.isMinimized) {
                        this.expandWidget();
                    }
                }, 1000);
            }
        }
        
        makeDraggable(element) {
            // Find or create header element to use as drag handle
            const header = element.querySelector('div');
            if (!header) return;
            
            let isDragging = false;
            let startX, startY, initialX, initialY;
            
            const dragStart = (e) => {
                if (e.button !== 0) return; // Only left mouse button
                
                // Prevent dragging when clicking on buttons
                if (e.target.tagName === 'BUTTON') {
                    return;
                }
                
                isDragging = true;
                
                // Get initial mouse position
                startX = e.clientX;
                startY = e.clientY;
                
                // Get initial element position
                const rect = element.getBoundingClientRect();
                initialX = rect.left;
                initialY = rect.top;
                
                // Prevent text selection
                e.preventDefault();
                
                // Change cursor
                document.body.style.cursor = 'move';
                
                // Add active dragging style
                element.style.transition = 'none';
                element.style.opacity = '0.9';
            };
            
            const dragMove = (e) => {
                if (!isDragging) return;
                
                e.preventDefault();
                
                // Calculate new position
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                let newX = initialX + deltaX;
                let newY = initialY + deltaY;
                
                // Boundary checking
                const maxX = window.innerWidth - element.offsetWidth;
                const maxY = window.innerHeight - element.offsetHeight;
                
                newX = Math.max(0, Math.min(newX, maxX));
                newY = Math.max(0, Math.min(newY, maxY));
                
                // Apply new position
                element.style.left = newX + 'px';
                element.style.top = newY + 'px';
                element.style.right = 'auto';
                element.style.bottom = 'auto';
            };
            
            const dragEnd = () => {
                if (!isDragging) return;
                
                isDragging = false;
                
                // Restore cursor
                document.body.style.cursor = '';
                
                // Restore element style
                element.style.transition = '';
                element.style.opacity = '';
                
                // Save position
                const position = {
                    left: element.offsetLeft,
                    top: element.offsetTop
                };
                GM_setValue('summary_widget_position', position);
            };
            
            // Set cursor style on header
            header.style.cursor = 'move';
            header.style.userSelect = 'none';
            
            // Add event listeners
            header.addEventListener('mousedown', dragStart);
            document.addEventListener('mousemove', dragMove);
            document.addEventListener('mouseup', dragEnd);
        }
    }

    // ===== UI MANAGER =====
    class UIManager {
        constructor() {
            this.panel = null;
            this.minimizedButton = null;
            this.isMinimized = false;
            this.statusElement = null;
            
            // Automation state flags
            this.automationInProgress = false;
            this.automationCancelled = false;
            this.cancelButton = null;
            
            // Re-scrape state
            this.rescrapeOptions = {
                forceRescrape: false,
                rescrapeStashDB: false,
                rescrapeThePornDB: false
            };
            
            // Initialize enhanced status tracking components
            this.sourceDetector = new SourceDetector();
            this.statusTracker = new StatusTracker(this.sourceDetector);
            this.historyManager = new HistoryManager();
            
            // Initialize automation summary widget (will be created when DOM is ready)
            this.summaryWidget = null;
            
            // DOM mutation observer for real-time updates
            this.mutationObserver = null;
            this.lastStatusUpdate = Date.now();
            
            // Draggable state
            this.isDragging = false;
            this.dragStartX = 0;
            this.dragStartY = 0;
            this.dragElementStartX = 0;
            this.dragElementStartY = 0;
            
            // Load saved positions
            this.savedPanelPosition = GM_getValue('panel_position', { top: 50, right: 10 });
            this.savedButtonPosition = GM_getValue('button_position', { top: 50, right: 10 });
            
            // Initialize mutation observer
            this.initializeMutationObserver();
            
        }

        /**
         * Make an element draggable
         * @param {HTMLElement} dragHandle - Element to use as drag handle
         * @param {HTMLElement} elementToDrag - Element that will be moved
         * @param {string} saveKey - 'panel' or 'button' for saving position
         */
        makeDraggable(dragHandle, elementToDrag, saveKey) {
            let isDragging = false;
            let startX, startY, initialX, initialY;
            
            const dragStart = (e) => {
                if (e.button !== 0) return; // Only left mouse button
                
                // Prevent dragging when clicking on buttons
                if (e.target.tagName === 'BUTTON' && e.target !== dragHandle) {
                    return;
                }
                
                isDragging = true;
                
                // Get initial mouse position
                startX = e.clientX;
                startY = e.clientY;
                
                // Get initial element position
                const rect = elementToDrag.getBoundingClientRect();
                initialX = rect.left;
                initialY = rect.top;
                
                // Prevent text selection
                e.preventDefault();
                
                // Change cursor
                document.body.style.cursor = 'move';
                
                // Add active dragging style
                elementToDrag.style.transition = 'none';
                elementToDrag.style.opacity = '0.9';
            };
            
            const dragMove = (e) => {
                if (!isDragging) return;
                
                e.preventDefault();
                
                // Calculate new position
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                let newX = initialX + deltaX;
                let newY = initialY + deltaY;
                
                // Boundary checking
                const maxX = window.innerWidth - elementToDrag.offsetWidth;
                const maxY = window.innerHeight - elementToDrag.offsetHeight;
                
                newX = Math.max(0, Math.min(newX, maxX));
                newY = Math.max(0, Math.min(newY, maxY));
                
                // Apply new position
                elementToDrag.style.left = newX + 'px';
                elementToDrag.style.top = newY + 'px';
                elementToDrag.style.right = 'auto';
                elementToDrag.style.bottom = 'auto';
            };
            
            const dragEnd = (e) => {
                if (!isDragging) return;
                
                isDragging = false;
                
                // Reset cursor
                document.body.style.cursor = 'auto';
                
                // Restore opacity and transition
                elementToDrag.style.opacity = '1';
                elementToDrag.style.transition = 'all 0.2s ease';
                
                // Save position
                const rect = elementToDrag.getBoundingClientRect();
                const position = {
                    top: rect.top,
                    right: window.innerWidth - rect.right
                };
                
                if (saveKey === 'panel') {
                    GM_setValue('panel_position', position);
                    this.savedPanelPosition = position;
                } else if (saveKey === 'button') {
                    GM_setValue('button_position', position);
                    this.savedButtonPosition = position;
                }
                
            };
            
            // Add event listeners
            dragHandle.addEventListener('mousedown', dragStart);
            document.addEventListener('mousemove', dragMove);
            document.addEventListener('mouseup', dragEnd);
            
            // Clean up on element removal
            const observer = new MutationObserver((mutations) => {
                if (!document.body.contains(elementToDrag)) {
                    document.removeEventListener('mousemove', dragMove);
                    document.removeEventListener('mouseup', dragEnd);
                    observer.disconnect();
                }
            });
            
            observer.observe(document.body, { childList: true, subtree: true });
        }

        initializeMutationObserver() {
            // Create debounced update function to avoid excessive updates
            const debouncedUpdate = this.debounce(() => {
                this.updateStatusFromDOM();
            }, 1000); // Update at most once per second

            // Observe changes in form inputs and buttons that might indicate scraper/organize changes
            this.mutationObserver = new MutationObserver((mutations) => {
                let shouldUpdate = false;

                mutations.forEach((mutation) => {
                    // Check for attribute changes on organize buttons
                    if (mutation.type === 'attributes' && 
                        (mutation.attributeName === 'class' || 
                         mutation.attributeName === 'aria-pressed' || 
                         mutation.attributeName === 'data-organized')) {
                        const target = mutation.target;
                        if (target.title === 'Organized' || 
                            target.classList.contains('organized-button') ||
                            target.textContent.toLowerCase().includes('organize')) {
                            shouldUpdate = true;
                        }
                    }

                    // Check for input value changes (scraper data)
                    if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                        const target = mutation.target;
                        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                            shouldUpdate = true;
                        }
                    }

                    // Check for added/removed elements that might be scraper results
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                // Check if added element contains scraper-related content
                                if (node.querySelector && (
                                    node.querySelector('input[placeholder*="stash" i]') ||
                                    node.querySelector('input[placeholder*="porndb" i]') ||
                                    node.querySelector('button[title="Organized"]') ||
                                    node.textContent.includes('StashDB') ||
                                    node.textContent.includes('ThePornDB')
                                )) {
                                    shouldUpdate = true;
                                }
                            }
                        });
                    }
                });

                if (shouldUpdate) {
                    debouncedUpdate();
                }
            });

            // Start observing
            if (document.body) {
                this.mutationObserver.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'aria-pressed', 'value', 'data-organized']
                });
            } else {
                // Wait for DOM to be ready
                setTimeout(() => this.initializeMutationObserver(), 100);
            }
        }

        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        async updateStatusFromDOM() {
            // Avoid too frequent updates
            const now = Date.now();
            if (now - this.lastStatusUpdate < 500) return;
            this.lastStatusUpdate = now;

            try {
                
                // Update the status tracker with current status
                await this.statusTracker.detectCurrentStatus();
                
                // Keep the main status element simple
                this.updateSceneStatus('⚡ Ready');
                
            } catch (error) {
            }
        }

        createPanel() {
            this.cleanup();
            
            // Initialize summary widget if not already created
            if (!this.summaryWidget) {
                this.summaryWidget = new AutomationSummaryWidget();
            }
            
            // Check if we're on a scene page
            const isScenePage = window.location.href.includes('/scenes/') && !window.location.href.includes('/scenes/markers');

            this.panel = document.createElement('div');
            this.panel.id = 'stash-automation-panel';
            
            // Use saved position or default
            const position = this.savedPanelPosition;
            this.panel.style.cssText = `
                position: fixed;
                top: ${position.top}px;
                right: ${position.right}px;
                z-index: 10000;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 15px;
                padding: 20px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.2);
                backdrop-filter: blur(15px);
                font-family: 'Segoe UI', sans-serif;
                min-width: 320px;
                max-width: 450px;
                color: white;
            `;

            const header = this.createHeader();
            const statusSummary = this.createStatusSummary();
            const content = this.createContent();
            
            this.panel.appendChild(header);
            if (statusSummary) {
                this.panel.appendChild(statusSummary);
            }
            this.panel.appendChild(content);
            
            // Add re-scrape UI if on scene page and sources are already scraped
            if (isScenePage) {
                this.createRescrapeUI().then(rescrapeUI => {
                    if (rescrapeUI) {
                        this.panel.insertBefore(rescrapeUI, this.panel.lastChild);
                    }
                });
            }
            
            const buttons = this.createButtons();
            this.panel.appendChild(buttons);

            document.body.appendChild(this.panel);
            this.isMinimized = false;
            
            // Initialize status tracking after panel is created
            this.initializeStatusTracking();
            
        }

        createHeader() {
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                cursor: move;
                user-select: none;
                padding: 5px;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
            `;
            
            // Make header draggable
            this.makeDraggable(header, this.panel, 'panel');

            const title = document.createElement('h3');
            title.textContent = 'AutomateStash v4.19.1 🔀';
            title.style.cssText = `
                color: white;
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                user-select: none;
            `;
            title.title = 'Drag to move';

            const minimizeBtn = document.createElement('button');
            minimizeBtn.innerHTML = '−';
            minimizeBtn.style.cssText = `
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            `;

            minimizeBtn.addEventListener('mouseenter', () => {
                minimizeBtn.style.background = 'rgba(255,255,255,0.3)';
            });

            minimizeBtn.addEventListener('mouseleave', () => {
                minimizeBtn.style.background = 'rgba(255,255,255,0.2)';
            });

            minimizeBtn.addEventListener('click', () => this.minimize());

            const buttonsContainer = document.createElement('div');
            buttonsContainer.style.cssText = `
                display: flex;
                gap: 5px;
                align-items: center;
            `;
            
            buttonsContainer.appendChild(minimizeBtn);
            
            header.appendChild(title);
            header.appendChild(buttonsContainer);
            return header;
        }

        createContent() {
            const content = document.createElement('div');

            // Status display
            this.statusElement = document.createElement('div');
            this.statusElement.style.cssText = `
                background: rgba(255,255,255,0.1);
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 15px;
                font-size: 13px;
                text-align: center;
                min-height: 20px;
            `;
            this.statusElement.textContent = '⚡ Ready to automate';

            // Info section
            const infoSection = document.createElement('div');
            infoSection.style.cssText = `
                background: rgba(255,255,255,0.05);
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 15px;
                text-align: center;
            `;

            const infoText = document.createElement('div');
            infoText.innerHTML = `
                <div style="font-size: 13px; margin-bottom: 8px; opacity: 0.9;">
                    🎯 Automated scene metadata scraping & organization
                </div>
                <div style="font-size: 12px; opacity: 0.7;">
                    Use ⚙️ Settings to configure automation options
                </div>
            `;

            infoSection.appendChild(infoText);

            content.appendChild(this.statusElement);
            content.appendChild(infoSection);
            
            // Add queue status display
            const queueDisplay = document.createElement('div');
            queueDisplay.id = 'stash-queue-display';
            queueDisplay.style.cssText = `
                margin-top: 15px;
                border-top: 1px solid rgba(255,255,255,0.1);
                padding-top: 15px;
            `;
            content.appendChild(queueDisplay);
            
            // Initial queue status update
            return content;
        }

        async createRescrapeUI() {
            // Check if sources are already scraped
            const alreadyScraped = await this.checkAlreadyScraped();
            const hasScrapedSources = alreadyScraped.stashdb || alreadyScraped.theporndb;
            
            if (!hasScrapedSources) {
                return null; // No need for re-scrape UI if nothing is scraped
            }
            
            const rescrapeContainer = document.createElement('div');
            rescrapeContainer.style.cssText = `
                background: rgba(255,255,255,0.08);
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 15px;
                border: 1px solid rgba(255,255,255,0.15);
            `;
            
            const rescrapeTitle = document.createElement('div');
            rescrapeTitle.style.cssText = `
                font-size: 13px;
                font-weight: 600;
                margin-bottom: 10px;
                color: rgba(255,255,255,0.95);
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            rescrapeTitle.innerHTML = `🔄 Re-scrape Options`;
            
            const rescrapeInfo = document.createElement('div');
            rescrapeInfo.style.cssText = `
                font-size: 11px;
                color: rgba(255,255,255,0.7);
                margin-bottom: 10px;
            `;
            rescrapeInfo.innerHTML = `Detected existing scrapes: ${alreadyScraped.stashdb ? 'StashDB ✓' : ''} ${alreadyScraped.theporndb ? 'ThePornDB ✓' : ''}`;
            
            const checkboxContainer = document.createElement('div');
            checkboxContainer.style.cssText = `
                display: flex;
                gap: 15px;
                margin-bottom: 10px;
                flex-wrap: wrap;
            `;
            
            // StashDB checkbox
            if (alreadyScraped.stashdb) {
                const stashCheckLabel = document.createElement('label');
                stashCheckLabel.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 12px;
                    cursor: pointer;
                    color: rgba(255,255,255,0.9);
                `;
                
                const stashCheck = document.createElement('input');
                stashCheck.type = 'checkbox';
                stashCheck.id = 'rescrape-stashdb';
                stashCheck.style.cssText = `cursor: pointer;`;
                stashCheck.addEventListener('change', (e) => {
                    this.rescrapeOptions.rescrapeStashDB = e.target.checked;
                });
                
                stashCheckLabel.appendChild(stashCheck);
                stashCheckLabel.appendChild(document.createTextNode(' Force StashDB'));
                checkboxContainer.appendChild(stashCheckLabel);
            }
            
            // ThePornDB checkbox
            if (alreadyScraped.theporndb) {
                const pornCheckLabel = document.createElement('label');
                pornCheckLabel.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 12px;
                    cursor: pointer;
                    color: rgba(255,255,255,0.9);
                `;
                
                const pornCheck = document.createElement('input');
                pornCheck.type = 'checkbox';
                pornCheck.id = 'rescrape-theporndb';
                pornCheck.style.cssText = `cursor: pointer;`;
                pornCheck.addEventListener('change', (e) => {
                    this.rescrapeOptions.rescrapeThePornDB = e.target.checked;
                });
                
                pornCheckLabel.appendChild(pornCheck);
                pornCheckLabel.appendChild(document.createTextNode(' Force ThePornDB'));
                checkboxContainer.appendChild(pornCheckLabel);
            }
            
            rescrapeContainer.appendChild(rescrapeTitle);
            rescrapeContainer.appendChild(rescrapeInfo);
            rescrapeContainer.appendChild(checkboxContainer);
            
            return rescrapeContainer;
        }

        createButtons() {
            const buttons = document.createElement('div');
            buttons.style.cssText = `
                display: flex;
                gap: 10px;
                justify-content: center;
                flex-wrap: wrap;
            `;

            const isScenePage = window.location.href.includes('/scenes/') && !window.location.href.includes('/scenes/markers');

            if (isScenePage) {
                const startBtn = document.createElement('button');
                startBtn.innerHTML = '<strong>🚀 Start Automation</strong>';
                startBtn.style.cssText = `
                    background: #27ae60;
                    color: white;
                    border: none;
                    padding: 12px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    flex: 1;
                    min-width: 140px;
                    transition: all 0.2s ease;
                    line-height: 1.2;
                `;
                startBtn.addEventListener('click', (event) => {
                    if (!this.automationInProgress) {
                        // Normal click runs immediately
                        this.startAutomation();
                        // Update button state
                        startBtn.disabled = true;
                        startBtn.innerHTML = '<strong>🔄 Automation in progress...</strong>';
                        startBtn.style.background = '#95a5a6';
                        startBtn.style.cursor = 'not-allowed';
                    }
                });
                buttons.appendChild(startBtn);
                
                // Store reference to button for later updates
                this.startButton = startBtn;
            } else {
                // Show a message for non-scene pages
                const infoText = document.createElement('div');
                infoText.textContent = '⚙️ Configure AutomateStash settings';
                infoText.style.cssText = `
                    font-size: 14px;
                    color: rgba(255,255,255,0.9);
                    margin-bottom: 10px;
                    text-align: center;
                    width: 100%;
                `;
                buttons.appendChild(infoText);
            }

            const configBtn = document.createElement('button');
            configBtn.textContent = '⚙️ Settings';
            configBtn.style.cssText = `
                background: #3498db;
                color: white;
                border: none;
                padding: 10px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                transition: all 0.2s ease;
            `;
            configBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showConfigDialog();
            });

            buttons.appendChild(configBtn);
            return buttons;
        }
        minimize() {
            if (this.panel) {
                this.panel.style.display = 'none';
            }
            this.createMinimizedButton();
            this.isMinimized = true;
        }

        createMinimizedButton() {
            if (this.minimizedButton) {
                this.minimizedButton.remove();
            }

            this.minimizedButton = document.createElement('button');
            this.minimizedButton.innerHTML = '🤖';
            
            // Use saved position or default
            const position = this.savedButtonPosition;
            this.minimizedButton.style.cssText = `
                position: fixed;
                top: ${position.top}px;
                right: ${position.right}px;
                z-index: 10000;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                cursor: move;
                font-size: 20px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                transition: opacity 0.2s ease;
                user-select: none;
            `;
            
            // Make button draggable
            this.makeDraggable(this.minimizedButton, this.minimizedButton, 'button');
            
            // Double-click to expand
            this.minimizedButton.addEventListener('dblclick', () => this.expand());
            
            // Add tooltip
            this.minimizedButton.title = 'Double-click to open, drag to move';

            document.body.appendChild(this.minimizedButton);
        }

        expand() {
            if (this.minimizedButton) {
                this.minimizedButton.remove();
                this.minimizedButton = null;
            }
            if (this.panel) {
                this.panel.style.display = 'block';
            } else {
                this.createPanel();
            }
            this.isMinimized = false;
        }

        updateSceneStatus(status) {
            if (this.statusElement) {
                this.statusElement.textContent = status;
            }
        }
        
        showNotification(message, type = 'info', duration = 4000) {
            const notificationManager = new NotificationManager();
            return notificationManager.show(message, type, duration);
        }

        showConfigDialog() {
            // Remove existing dialog
            const existing = document.querySelector('#stash-config-dialog');
            if (existing) existing.remove();
            const existingBackdrop = document.querySelector('#stash-config-backdrop');
            if (existingBackdrop) existingBackdrop.remove();

            const backdrop = document.createElement('div');
            backdrop.id = 'stash-config-backdrop';
            backdrop.style = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                z-index: 10001;
                backdrop-filter: blur(5px);
            `;

            const dialog = document.createElement('div');
            dialog.id = 'stash-config-dialog';
            dialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10002;
                background: #2c3e50;
                color: white;
                padding: 30px;
                border-radius: 15px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                font-family: 'Segoe UI', sans-serif;
                border: 2px solid rgba(255,255,255,0.1);
            `;

            const title = document.createElement('h2');
            title.textContent = '⚙️ AutomateStash Configuration';
            title.style.cssText = `
                margin-top: 0;
                color: #3498db;
                text-align: center;
                font-size: 20px;
            `;

            const configOptions = [
                { key: CONFIG.AUTO_SCRAPE_STASHDB, label: 'Auto-scrape StashDB' },
                { key: CONFIG.AUTO_SCRAPE_THEPORNDB, label: 'Auto-scrape ThePornDB' },
                { key: CONFIG.AUTO_CREATE_PERFORMERS, label: 'Auto-create new performers/studios/tags' },
                { key: CONFIG.AUTO_ORGANIZE, label: 'Auto-organize scenes' },
                { key: CONFIG.SHOW_NOTIFICATIONS, label: 'Show notifications' },
                { key: CONFIG.MINIMIZE_WHEN_COMPLETE, label: 'Minimize UI when complete' },
                { key: CONFIG.AUTO_APPLY_CHANGES, label: 'Auto-apply changes (no confirmation)' },
                { key: CONFIG.SKIP_ALREADY_SCRAPED, label: 'Skip already scraped sources' },
                { key: CONFIG.ENABLE_CROSS_SCENE_INTELLIGENCE, label: '🧠 Enable cross-scene intelligence (GraphQL)' },
                { key: CONFIG.PREFER_HIGHER_RES_THUMBNAILS, label: '🖼️ Prefer higher resolution thumbnails' }
            ];

            const optionsContainer = document.createElement('div');
            optionsContainer.style.cssText = 'margin-bottom: 20px;';

            configOptions.forEach(option => {
                const label = document.createElement('label');
                label.style.cssText = `
                    display: block;
                    margin-bottom: 15px;
                    cursor: pointer;
                    padding: 10px;
                    border-radius: 8px;
                    background: rgba(255,255,255,0.05);
                    transition: background 0.2s ease;
                `;

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = getConfig(option.key);
                checkbox.style.cssText = 'margin-right: 10px; transform: scale(1.2);';
                checkbox.setAttribute('data-config-key', option.key);

                const text = document.createElement('span');
                text.textContent = option.label;
                text.style.cssText = 'font-size: 14px;';

                label.appendChild(checkbox);
                label.appendChild(text);
                optionsContainer.appendChild(label);
            });


            // GraphQL API Configuration section
            const graphqlSection = document.createElement('div');
            graphqlSection.style.cssText = `
                margin: 20px 0;
                padding: 15px;
                background: rgba(52, 152, 219, 0.1);
                border-radius: 8px;
                border: 1px solid rgba(52, 152, 219, 0.3);
            `;

            const graphqlTitle = document.createElement('h3');
            graphqlTitle.textContent = '🔗 GraphQL API Configuration';
            graphqlTitle.style.cssText = `
                margin: 0 0 10px 0;
                color: #3498db;
                font-size: 16px;
            `;

            const graphqlDesc = document.createElement('p');
            graphqlDesc.textContent = 'Configure Stash API settings for cross-scene intelligence';
            graphqlDesc.style.cssText = `
                margin: 0 0 15px 0;
                font-size: 13px;
                color: #bdc3c7;
            `;

            // Stash Address input
            const addressLabel = document.createElement('label');
            addressLabel.textContent = 'Stash Server Address:';
            addressLabel.style.cssText = `
                display: block;
                margin-bottom: 5px;
                font-size: 14px;
                color: #ecf0f1;
            `;

            const addressInput = document.createElement('input');
            addressInput.type = 'text';
            addressInput.value = getConfig(CONFIG.STASH_ADDRESS);
            addressInput.placeholder = 'http://localhost:9998';
            addressInput.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                margin-bottom: 15px;
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 6px;
                background: rgba(255,255,255,0.1);
                color: white;
                font-size: 14px;
                box-sizing: border-box;
            `;
            addressInput.setAttribute('data-config-key', CONFIG.STASH_ADDRESS);

            // API Key input
            const apiKeyLabel = document.createElement('label');
            apiKeyLabel.textContent = 'API Key (optional):';
            apiKeyLabel.style.cssText = `
                display: block;
                margin-bottom: 5px;
                font-size: 14px;
                color: #ecf0f1;
            `;

            const apiKeyInput = document.createElement('input');
            apiKeyInput.type = 'password';
            apiKeyInput.value = getConfig(CONFIG.STASH_API_KEY);
            apiKeyInput.placeholder = 'Enter API key if required';
            apiKeyInput.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                margin-bottom: 15px;
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 6px;
                background: rgba(255,255,255,0.1);
                color: white;
                font-size: 14px;
                box-sizing: border-box;
            `;
            apiKeyInput.setAttribute('data-config-key', CONFIG.STASH_API_KEY);

            // Test connection button
            const testConnectionBtn = document.createElement('button');
            testConnectionBtn.textContent = '🔌 Test Connection';
            testConnectionBtn.style.cssText = `
                background: #3498db;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                transition: all 0.2s ease;
                margin-right: 10px;
            `;
            testConnectionBtn.addEventListener('click', async () => {
                try {
                    testConnectionBtn.textContent = '🔄 Testing...';
                    testConnectionBtn.disabled = true;
                    
                    // Update config with current values
                    setConfig(CONFIG.STASH_ADDRESS, addressInput.value);
                    setConfig(CONFIG.STASH_API_KEY, apiKeyInput.value);
                    
                    // Create new client with updated config
                    const testClient = new GraphQLClient();
                    const sceneId = testClient.getCurrentSceneId();
                    
                    if (sceneId) {
                        const result = await testClient.getSceneDetails(sceneId);
                        testConnectionBtn.textContent = '✅ Connected';
                        testConnectionBtn.style.background = '#27ae60';
                        notifications.show('GraphQL connection successful!', 'success');
                    } else {
                        testConnectionBtn.textContent = '⚠️ No Scene';
                        testConnectionBtn.style.background = '#f39c12';
                        notifications.show('Connection works, but not on a scene page', 'warning');
                    }
                } catch (error) {
                    testConnectionBtn.textContent = '❌ Failed';
                    testConnectionBtn.style.background = '#e74c3c';
                    notifications.show(`Connection failed: ${error.message}`, 'error');
                } finally {
                    setTimeout(() => {
                        testConnectionBtn.textContent = '🔌 Test Connection';
                        testConnectionBtn.style.background = '#3498db';
                        testConnectionBtn.disabled = false;
                    }, 3000);
                }
            });

            graphqlSection.appendChild(graphqlTitle);
            graphqlSection.appendChild(graphqlDesc);
            graphqlSection.appendChild(addressLabel);
            graphqlSection.appendChild(addressInput);
            graphqlSection.appendChild(apiKeyLabel);
            graphqlSection.appendChild(apiKeyInput);
            graphqlSection.appendChild(testConnectionBtn);



            // Action buttons
            const actionsContainer = document.createElement('div');
            actionsContainer.style.cssText = `
                text-align: center;
                gap: 15px;
                display: flex;
                justify-content: center;
                flex-wrap: wrap;
            `;

            const actionButtons = [
                { id: 'save-config', text: '💾 Save Settings', color: '#27ae60' },
                { id: 'reset-config', text: '🔄 Reset to Defaults', color: '#e74c3c' },
                { id: 'close-config', text: '✖️ Close', color: '#95a5a6' }
            ];

            actionButtons.forEach(btn => {
                const button = document.createElement('button');
                button.id = btn.id;
                button.textContent = btn.text;
                button.style.cssText = `
                    background: ${btn.color};
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                `;
                actionsContainer.appendChild(button);
            });

            dialog.appendChild(title);
            dialog.appendChild(optionsContainer);
            dialog.appendChild(graphqlSection);
            dialog.appendChild(actionsContainer);

            backdrop.appendChild(dialog);
            document.body.appendChild(backdrop);

            // Event listeners
            const closeDialog = () => {
                backdrop.remove();
            };

            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) closeDialog();
            });

            dialog.querySelector('#close-config').addEventListener('click', closeDialog);

            dialog.querySelector('#save-config').addEventListener('click', () => {
                // Save checkbox options
                configOptions.forEach(option => {
                    const checkbox = dialog.querySelector(`[data-config-key="${option.key}"]`);
                    if (checkbox) {
                        setConfig(option.key, checkbox.checked);
                    }
                });
                
                // Save GraphQL configuration inputs
                const addressInput = dialog.querySelector(`[data-config-key="${CONFIG.STASH_ADDRESS}"]`);
                const apiKeyInput = dialog.querySelector(`[data-config-key="${CONFIG.STASH_API_KEY}"]`);
                
                if (addressInput) {
                    setConfig(CONFIG.STASH_ADDRESS, addressInput.value.trim());
                }
                if (apiKeyInput) {
                    setConfig(CONFIG.STASH_API_KEY, apiKeyInput.value.trim());
                }
                
                notifications.show('✅ Configuration saved successfully!', 'success');
                closeDialog();
            });

            dialog.querySelector('#reset-config').addEventListener('click', () => {
                if (confirm('Reset all settings to defaults?')) {
                    Object.keys(CONFIG).forEach(key => {
                        setConfig(CONFIG[key], DEFAULTS[CONFIG[key]]);
                    });
                    notifications.show('🔄 Settings reset to defaults', 'info');
                    closeDialog();
                }
            });


        }

        validateContext() {
            const tests = [
                { name: 'UIManager Instance', test: () => typeof this !== 'undefined' },
                { name: 'Panel Element', test: () => !!this.panel },
                { name: 'Minimize Method', test: () => typeof this.minimize === 'function' },
                { name: 'DOM Ready', test: () => document.readyState === 'complete' }
            ];

            tests.forEach(test => {
                const result = test.test();
            });

            notifications.show('🔍 Context validation completed - check console', 'info');
        }

        cleanup() {
            if (this.panel && this.panel.parentNode) {
                this.panel.remove();
            }
            if (this.minimizedButton && this.minimizedButton.parentNode) {
                this.minimizedButton.remove();
            }
            
            // Clean up mutation observer
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
                this.mutationObserver = null;
            }
            
            this.panel = null;
            this.minimizedButton = null;
        }


        // ===== ENHANCED STATUS TRACKING =====
        
        /**
         * Initialize status tracking after panel creation
         */
        async initializeStatusTracking() {
            
            try {
                // Set up status update callback
                this.statusTracker.onStatusUpdate(this.updateStatusDisplay.bind(this));
                
                // Detect current scene status
                await this.statusTracker.detectCurrentStatus();
                
                // Update the status summary display with initial data
                this.updateStatusSummaryDisplay();
                
                // Initialize status widget with current scene status
                await this.initializeStatusWidget();
                
            } catch (error) {
            }
        }

        async initializeStatusWidget() {
            try {
                
                // Trigger initial status update
                await this.updateStatusFromDOM();
                
            } catch (error) {
            }
        }

        /**
         * Create status summary display for the main panel
         */
        createStatusSummary() {
            // Only show on scene pages
            if (!window.location.href.includes('/scenes/') || window.location.href.includes('/scenes/markers')) {
                return null;
            }
            
            const statusContainer = document.createElement('div');
            statusContainer.id = 'scene-status-summary';
            statusContainer.style.cssText = `
                background: rgba(255,255,255,0.1);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 15px;
                border: 1px solid rgba(255,255,255,0.2);
            `;
            
            // Will be populated by updateStatusDisplay
            this.statusSummaryContainer = statusContainer;
            return statusContainer;
        }
        
        /**
         * Update the status summary display
         */
        updateStatusSummaryDisplay() {
            if (!this.statusSummaryContainer || !this.statusTracker) return;
            
            const summary = this.statusTracker.getStatusSummary();
            const completion = this.statusTracker.getCompletionStatus();
            
            this.statusSummaryContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div style="font-weight: 600; font-size: 13px;">${summary.scene.name}</div>
                    <div style="font-size: 12px; opacity: 0.8;">${completion.percentage}% Complete</div>
                </div>
                
                <div style="display: flex; gap: 8px;">
                    <div style="flex: 1; background: rgba(255,255,255,0.05); padding: 6px 8px; border-radius: 4px; font-size: 11px;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>${summary.sources.stashdb.icon}</span>
                            <span>StashDB</span>
                        </div>
                        <div style="opacity: 0.7; margin-top: 2px;">${summary.sources.stashdb.status}</div>
                    </div>
                    
                    <div style="flex: 1; background: rgba(255,255,255,0.05); padding: 6px 8px; border-radius: 4px; font-size: 11px;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>${summary.sources.theporndb.icon}</span>
                            <span>ThePornDB</span>
                        </div>
                        <div style="opacity: 0.7; margin-top: 2px;">${summary.sources.theporndb.status}</div>
                    </div>
                    
                    <div style="flex: 1; background: rgba(255,255,255,0.05); padding: 6px 8px; border-radius: 4px; font-size: 11px;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span>${summary.organized.icon}</span>
                            <span>Organized</span>
                        </div>
                        <div style="opacity: 0.7; margin-top: 2px;">${summary.organized.status}</div>
                    </div>
                </div>
            `;
        }

        /**
         * Callback for status updates
         */
        updateStatusDisplay(statusSummary) {
            this.updateStatusSummaryDisplay();
        }

        /**
         * Save automation result to history
         */
        async saveAutomationResult(result) {
            const sceneId = this.statusTracker.extractSceneId();
            if (!sceneId) {
                return;
            }

            try {
                const sceneName = this.statusTracker.extractSceneName();
                await this.historyManager.saveAutomationHistory(sceneId, {
                    ...result,
                    sceneName: sceneName,
                    url: window.location.href
                });
            } catch (error) {
            }
        }

        // ===== AUTOMATION ENGINE =====
        async startAutomation() {
            this.updateSceneStatus('🚀 Starting automation...');
            
            // Start tracking automation for summary
            const sceneName = this.statusTracker.extractSceneName() || 'Unknown Scene';
            const sceneId = this.statusTracker.extractSceneId() || '';
            this.summaryWidget.startTracking(sceneName, sceneId);
            
            // Reset and set automation state
            this.automationCancelled = false;
            this.automationInProgress = true;
            
            // Check if we're in re-scrape mode
            this.rescrapeOptions.forceRescrape = this.rescrapeOptions.rescrapeStashDB || this.rescrapeOptions.rescrapeThePornDB;
            
            // Show cancel button
            this.showCancelButton();

            try {
                // Check what's already scraped
                let alreadyScraped = { stashdb: false, theporndb: false };
                if (getConfig(CONFIG.SKIP_ALREADY_SCRAPED) && !this.rescrapeOptions.forceRescrape) {
                    alreadyScraped = await this.checkAlreadyScraped();
                }

                // Handle re-scrape options
                let needsStashDB, needsThePornDB;
                if (this.rescrapeOptions.forceRescrape) {
                    // Force re-scrape based on checkbox selections
                    needsStashDB = this.rescrapeOptions.rescrapeStashDB;
                    needsThePornDB = this.rescrapeOptions.rescrapeThePornDB;
                    this.updateSceneStatus('🔄 Force re-scraping selected sources...');
                } else {
                    // Normal scraping logic
                    needsStashDB = getConfig(CONFIG.AUTO_SCRAPE_STASHDB) && !alreadyScraped.stashdb;
                    needsThePornDB = getConfig(CONFIG.AUTO_SCRAPE_THEPORNDB) && !alreadyScraped.theporndb;
                }


                if (!needsStashDB && !needsThePornDB) {
                    this.updateSceneStatus('✅ All sources already scraped, organizing...');
                } else {
                    this.updateSceneStatus('🚀 Starting automation workflow...');
                }

                // Run automation steps
                let stashDBResult = 'skip';
                let thePornDBResult = 'skip';

                if (needsStashDB) {
                    // Check for cancellation before scraping
                    if (this.automationCancelled) {
                        this.updateSceneStatus('⚠️ Automation cancelled');
                        this.summaryWidget.addAction('StashDB Scraping', 'cancelled');
                        return;
                    }
                    
                    this.summaryWidget.addSource('StashDB');
                    await this.scrapeStashDB();
                    this.summaryWidget.addAction('Scraped StashDB', 'success');
                    
                    // Check for cancellation after scraping
                    if (this.automationCancelled) {
                        this.updateSceneStatus('⚠️ Automation cancelled');
                        return;
                    }
                    
                    if (getConfig(CONFIG.AUTO_CREATE_PERFORMERS)) {
                        await this.createNewPerformers();
                        this.summaryWidget.addAction('Created new performers/tags', 'success');
                        
                        // Check for cancellation after creating performers
                        if (this.automationCancelled) {
                            this.updateSceneStatus('⚠️ Automation cancelled');
                            return;
                        }
                    }
                    
                    stashDBResult = await this.applyScrapedData();
                    if (stashDBResult === 'cancel') {
                        // User cancelled entire automation
                        this.updateSceneStatus('⚠️ Automation cancelled by user');
                        return;
                    } else if (stashDBResult === 'skip') {
                    }
                }

                if (needsThePornDB) {
                    // Check for cancellation before scraping
                    if (this.automationCancelled) {
                        this.updateSceneStatus('⚠️ Automation cancelled');
                        this.summaryWidget.addAction('ThePornDB Scraping', 'cancelled');
                        return;
                    }
                    
                    this.summaryWidget.addSource('ThePornDB');
                    await this.scrapeThePornDB();
                    this.summaryWidget.addAction('Scraped ThePornDB', 'success');
                    
                    // Check for cancellation after scraping
                    if (this.automationCancelled) {
                        this.updateSceneStatus('⚠️ Automation cancelled');
                        return;
                    }
                    
                    if (getConfig(CONFIG.AUTO_CREATE_PERFORMERS)) {
                        await this.createNewPerformers();
                        this.summaryWidget.addAction('Created new performers/tags', 'success');
                        
                        // Check for cancellation after creating performers
                        if (this.automationCancelled) {
                            this.updateSceneStatus('⚠️ Automation cancelled');
                            return;
                        }
                    }
                    
                    thePornDBResult = await this.applyScrapedData();
                    if (thePornDBResult === 'cancel') {
                        // User cancelled entire automation
                        this.updateSceneStatus('⚠️ Automation cancelled by user');
                        return;
                    } else if (thePornDBResult === 'skip') {
                    }
                }

                // Check for cancellation before saving
                if (this.automationCancelled) {
                    this.updateSceneStatus('⚠️ Automation cancelled');
                    return;
                }
                
                // Save scraped data first
                await this.saveScene();
                
                // Check for cancellation after saving
                if (this.automationCancelled) {
                    this.updateSceneStatus('⚠️ Automation cancelled');
                    return;
                }

                // Check organize status before attempting organization
                if (getConfig(CONFIG.AUTO_ORGANIZE)) {
                    // Check current organized status first
                    const isCurrentlyOrganized = await this.checkOrganizedStatus();
                    
                    if (isCurrentlyOrganized) {
                        this.updateSceneStatus('✅ Already organized');
                        this.summaryWidget.addAction('Mark as organized', 'skip', 'Already organized');
                    } else {
                        const hasStashDB = alreadyScraped.stashdb || needsStashDB;
                        const hasThePornDB = alreadyScraped.theporndb || needsThePornDB;


                        if (hasStashDB && hasThePornDB) {
                            
                            // Organize the scene
                            await this.organizeScene();
                            this.summaryWidget.addAction('Marked as organized', 'success');
                            
                            // Save again after organizing
                            await this.saveScene();
                            this.summaryWidget.addAction('Saved scene', 'success');
                        } else if (hasStashDB || hasThePornDB) {
                            this.updateSceneStatus('⚠️ Skipping organization - need both sources');
                        } else {
                            this.updateSceneStatus('❌ No sources found');
                        }
                    }
                }

                this.updateSceneStatus('✅ Automation complete!');
                notifications.show('✅ Automation completed successfully!', 'success');

                // Save successful automation history
                await this.saveAutomationResult({
                    success: true,
                    sourcesUsed: [
                        ...(stashDBResult === 'apply' ? ['stashdb'] : []),
                        ...(thePornDBResult === 'apply' ? ['theporndb'] : [])
                    ],
                    stashdb: alreadyScraped.stashdb || stashDBResult === 'apply',
                    theporndb: alreadyScraped.theporndb || thePornDBResult === 'apply',
                    organized: getConfig(CONFIG.AUTO_ORGANIZE),
                    skippedSources: [
                        ...(stashDBResult === 'skip' && needsStashDB ? ['stashdb'] : []),
                        ...(thePornDBResult === 'skip' && needsThePornDB ? ['theporndb'] : [])
                    ]
                });

                // Update status tracking
                this.statusTracker.updateStatus('automation', {
                    success: true,
                    sourcesUsed: [
                        ...(needsStashDB ? ['stashdb'] : []),
                        ...(needsThePornDB ? ['theporndb'] : [])
                    ]
                });

                // Show status instead of minimizing after automation completes
                setTimeout(async () => {
                    // Clear GraphQL cache to ensure fresh data
                    if (this.sourceDetector && this.sourceDetector.cache) {
                        this.sourceDetector.cache.clear();
                    }
                    
                    await this.updateStatusFromDOM();
                    notifications.show('✅ Automation complete!', 'success');
                }, 4000);

            } catch (error) {
                this.updateSceneStatus('❌ Automation failed');
                notifications.show('❌ Automation failed: ' + error.message, 'error');
                
                // Track error in summary widget
                this.summaryWidget.addError(error.message);

                // Save failed automation history
                await this.saveAutomationResult({
                    success: false,
                    errors: [error.message],
                    sourcesUsed: []
                });

                // Update status tracking
                this.statusTracker.updateStatus('automation', {
                    success: false,
                    errors: [error.message]
                });
            } finally {
                // Always cleanup automation state
                this.automationInProgress = false;
                this.hideCancelButton();
                
                // Finish tracking and show summary
                if (this.summaryWidget) {
                    const success = !this.automationCancelled && !this.summaryWidget.summaryData.errors.length;
                    this.summaryWidget.finishTracking(success);
                    
                    // Show summary dialog after ALL other UI updates are complete (after 5 seconds)
                    // This ensures the status update at 4000ms doesn't interfere
                    setTimeout(() => {
                        this.summaryWidget.showSummary();
                    }, 5000);
                }
                
                // Reset re-scrape options
                this.rescrapeOptions = {
                    forceRescrape: false,
                    rescrapeStashDB: false,
                    rescrapeThePornDB: false
                };
                
                // Uncheck re-scrape checkboxes if they exist
                const stashCheckbox = document.querySelector('#rescrape-stashdb');
                const pornCheckbox = document.querySelector('#rescrape-theporndb');
                if (stashCheckbox) stashCheckbox.checked = false;
                if (pornCheckbox) pornCheckbox.checked = false;
                
                // Reset start button if it exists
                if (this.startButton) {
                    this.startButton.disabled = false;
                    this.startButton.textContent = '🚀 Start Automation';
                    this.startButton.style.background = '#27ae60';
                    this.startButton.style.cursor = 'pointer';
                }
            }
        }
        
        showCancelButton() {
            // Remove any existing cancel button
            this.hideCancelButton();
            
            // Create cancel button overlay
            this.cancelButton = document.createElement('div');
            this.cancelButton.id = 'automation-cancel-overlay';
            this.cancelButton.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                z-index: 10003;
                background: linear-gradient(135deg, #ff4444, #cc0000);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(255, 0, 0, 0.3);
                cursor: pointer;
                font-family: 'Segoe UI', sans-serif;
                font-size: 14px;
                font-weight: bold;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.3s ease;
                animation: slideIn 0.3s ease;
            `;
            
            this.cancelButton.innerHTML = `
                <span style="font-size: 18px;">🛑</span>
                <span>Cancel Automation</span>
            `;
            
            // Add hover effect
            this.cancelButton.onmouseenter = () => {
                this.cancelButton.style.background = 'linear-gradient(135deg, #ff6666, #dd0000)';
                this.cancelButton.style.transform = 'scale(1.05)';
            };
            
            this.cancelButton.onmouseleave = () => {
                this.cancelButton.style.background = 'linear-gradient(135deg, #ff4444, #cc0000)';
                this.cancelButton.style.transform = 'scale(1)';
            };
            
            // Handle cancel click
            this.cancelButton.onclick = () => {
                if (confirm('Are you sure you want to cancel the automation?')) {
                    this.automationCancelled = true;
                    this.summaryWidget.addWarning('Automation cancelled by user');
                    this.updateSceneStatus('🛑 Cancelling automation...');
                    notifications.show('🛑 Automation cancelled by user', 'warning');
                }
            };
            
            // Add animation keyframes
            if (!document.querySelector('#cancel-button-animations')) {
                const style = document.createElement('style');
                style.id = 'cancel-button-animations';
                style.textContent = `
                    @keyframes slideIn {
                        from {
                            opacity: 0;
                            transform: translateX(100%);
                        }
                        to {
                            opacity: 1;
                            transform: translateX(0);
                        }
                    }
                `;
                document.head.appendChild(style);
            }
            
            document.body.appendChild(this.cancelButton);
        }
        
        hideCancelButton() {
            if (this.cancelButton) {
                this.cancelButton.remove();
                this.cancelButton = null;
            }
        }

        async checkAlreadyScraped() {
            this.updateSceneStatus('🔍 Checking already scraped sources...');

            const result = { stashdb: false, theporndb: false };

            try {
                await this.wait(1000);

                // Enhanced GraphQL-powered detection (highest confidence)
                if (getConfig(CONFIG.ENABLE_CROSS_SCENE_INTELLIGENCE)) {
                    
                    try {
                        // Check StashDB via GraphQL
                        const stashdbStatus = await this.sourceDetector.detectStashDBData();
                        if (stashdbStatus.found && stashdbStatus.confidence >= 100) {
                            result.stashdb = true;
                            this.updateSceneStatus('✅ Source detected');
                        }

                        // Check ThePornDB via GraphQL
                        const theporndbStatus = await this.sourceDetector.detectThePornDBData();
                        if (theporndbStatus.found && theporndbStatus.confidence >= 100) {
                            result.theporndb = true;
                            this.updateSceneStatus('✅ Source detected');
                        }

                        // If GraphQL detection found sources, return early
                        if (result.stashdb || result.theporndb) {
                            return result;
                        }
                    } catch (graphqlError) {
                        this.updateSceneStatus('⚠️ GraphQL failed, using DOM fallback...');
                    }
                }

                // Fallback to DOM-based detection (original method)
                
                // Check for StashDB indicators
                const stashdbSelectors = [
                    'input[placeholder*="stash" i]',
                    'input[id*="stash" i]',
                    'input[name*="stash" i]'
                ];

                for (const selector of stashdbSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        if (element && element.value && element.value.trim()) {
                            result.stashdb = true;
                            break;
                        }
                    }
                    if (result.stashdb) break;
                }

                // Check for ThePornDB indicators
                const theporndbSelectors = [
                    'input[placeholder*="porndb" i]',
                    'input[placeholder*="tpdb" i]',
                    'input[id*="tpdb" i]'
                ];

                for (const selector of theporndbSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        if (element && element.value && element.value.trim()) {
                            result.theporndb = true;
                            break;
                        }
                    }
                    if (result.theporndb) break;
                }

            } catch (error) {
            }

            return result;
        }

        async scrapeStashDB() {
            this.updateSceneStatus('🔍 Scraping...');
            
            // Check for cancellation
            if (this.automationCancelled) {
                throw new Error('Automation cancelled');
            }

            const scrapeBtn = this.findScrapeButton();
            if (!scrapeBtn) {
                throw new Error('Scrape button not found');
            }

            scrapeBtn.click();
            await this.wait(1000).catch(err => {
                if (err.message === 'Automation cancelled') throw err;
            });
            
            // Check for cancellation again
            if (this.automationCancelled) {
                throw new Error('Automation cancelled');
            }

            // Look for StashDB option
            const options = document.querySelectorAll('.dropdown-menu .dropdown-item, a.dropdown-item');
            for (const option of options) {
                if (option.textContent.toLowerCase().includes('stashdb') ||
                    option.textContent.toLowerCase().includes('stash-box')) {
                    option.click();
                    await this.wait(3000).catch(err => {
                        if (err.message === 'Automation cancelled') throw err;
                    });
                    return;
                }
            }

        }

        async scrapeThePornDB() {
            this.updateSceneStatus('🔍 Scraping...');
            
            // Check for cancellation
            if (this.automationCancelled) {
                throw new Error('Automation cancelled');
            }

            const scrapeBtn = this.findScrapeButton();
            if (!scrapeBtn) {
                throw new Error('Scrape button not found');
            }

            scrapeBtn.click();
            await this.wait(1000).catch(err => {
                if (err.message === 'Automation cancelled') throw err;
            });
            
            // Check for cancellation again
            if (this.automationCancelled) {
                throw new Error('Automation cancelled');
            }

            // Look for ThePornDB option
            const options = document.querySelectorAll('.dropdown-menu .dropdown-item, a.dropdown-item');
            for (const option of options) {
                if (option.textContent.toLowerCase().includes('theporndb') ||
                    option.textContent.toLowerCase().includes('tpdb')) {
                    option.click();
                    await this.wait(3000).catch(err => {
                        if (err.message === 'Automation cancelled') throw err;
                    });
                    return;
                }
            }

        }

        findScrapeButton() {

            const buttons = document.querySelectorAll('button');
            for (const button of buttons) {
                if (button.textContent.toLowerCase().includes('scrape')) {
                    return button;
                }
            }

            return null;
        }

        
        async collectScrapedData() {
            const scrapedData = {
                title: null,
                performers: [],
                studio: null,
                tags: [],
                date: null,
                details: null,
                url: null,
                studioCode: null,
                group: null,
                thumbnail: null
            };

            try {
                // Wait a bit for the scraper results to fully render
                await this.wait(1000);
                
                // IMPORTANT: After scraping, Stash shows a comparison modal with TWO columns:
                // LEFT column: Current/existing data (old)
                // RIGHT column: Newly scraped data (NEW - what we want!)
                
                let scrapedColumn = null;
                
                // First, try to find the scraper modal OR the edit form
                // After scraping, Stash may show the edit form directly rather than a modal
                const scraperModal = document.querySelector('.modal.show .modal-dialog, .modal-dialog.scrape-dialog, .ModalContainer .modal-dialog');
                const editForm = document.querySelector('.entity-edit-panel, .scene-edit-details, .edit-panel, form[class*="edit"]');
                
                if (scraperModal) {
                    
                    const modalBody = scraperModal.querySelector('.modal-body');
                    if (modalBody) {
                    }
                    
                    // Strategy 1: Look for the "Scraped" label in the header row
                    const headerLabels = modalBody ? modalBody.querySelectorAll('label.form-label') : [];
                    let scrapedColumnIndex = -1;
                    headerLabels.forEach((label, idx) => {
                        if (label.textContent.trim().toLowerCase() === 'scraped') {
                            // This is the scraped header - it's in position 1 (second column)
                            scrapedColumnIndex = 1;
                        }
                    });
                    
                    // Strategy 2: Collect all the right-side (scraped) col-6 divs
                    if (scrapedColumnIndex === 1 && modalBody) {
                        // We know the structure: each row has col-lg-9 containing a row with two col-6
                        // The second col-6 in each row is the scraped data
                        const allRows = modalBody.querySelectorAll('.row');
                        const scrapedFields = [];
                        
                        allRows.forEach(row => {
                            // Skip the header row
                            if (row.querySelector('label.col-6')) return;
                            
                            // Find the col-lg-9 that contains the data columns
                            const dataContainer = row.querySelector('.col-lg-9');
                            if (dataContainer) {
                                const innerRow = dataContainer.querySelector('.row');
                                if (innerRow) {
                                    const columns = innerRow.querySelectorAll('.col-6');
                                    if (columns.length === 2) {
                                        // The second column (index 1) is the scraped data
                                        scrapedFields.push(columns[1]);
                                    }
                                }
                            }
                        });
                        
                        if (scrapedFields.length > 0) {
                            // Create a virtual container for all scraped fields
                            scrapedColumn = document.createElement('div');
                            scrapedColumn.id = 'scraped-data-virtual-container';
                            scrapedFields.forEach(field => {
                                // Clone the elements to avoid modifying the DOM
                                scrapedColumn.appendChild(field.cloneNode(true));
                            });
                        }
                    }
                    
                    // Strategy 3: Look for column with checkmarks next to fields (fallback)
                    if (!scrapedColumn) {
                        const row = scraperModal.querySelector('.row');
                        if (row) {
                            const columns = row.querySelectorAll('.col, .col-6, .col-md-6, .col-lg-6, [class*="col-"]');
                            
                            // Check each column for checkmarks
                            let maxCheckmarks = 0;
                            let checkmarkColumn = null;
                            
                            columns.forEach((col, idx) => {
                                // Look for various types of checkmarks
                                const checkmarks = col.querySelectorAll('.fa-check, .fa-check-circle, .fa-check-square, .bi-check, .bi-check-circle, [class*="check"]:not(input), svg[class*="check"], input[type="checkbox"]:checked, span:has(svg), .text-success');
                                const inputs = col.querySelectorAll('input[type="text"], input[type="date"], textarea, select');
                                
                                
                                // The column with the most checkmarks AND has input fields is likely the scraped data
                                if (checkmarks.length > maxCheckmarks && inputs.length > 0) {
                                    maxCheckmarks = checkmarks.length;
                                    checkmarkColumn = col;
                                }
                            });
                            
                            if (checkmarkColumn) {
                                scrapedColumn = checkmarkColumn;
                            }
                            
                            // Strategy 3: Look for the column that is NOT disabled/readonly
                            if (!scrapedColumn && columns.length >= 2) {
                                // The scraped data column typically has editable fields
                                // while the existing data column has readonly/disabled fields
                                for (let i = columns.length - 1; i >= 0; i--) {
                                    const inputs = columns[i].querySelectorAll('input, textarea, select');
                                    const editableInputs = Array.from(inputs).filter(input => 
                                        !input.disabled && 
                                        !input.readOnly && 
                                        input.type !== 'hidden'
                                    );
                                    
                                    if (editableInputs.length > 0) {
                                        scrapedColumn = columns[i];
                                        break;
                                    }
                                }
                            }
                            
                            // Strategy 4: If still no column, use rightmost with actual data
                            if (!scrapedColumn && columns.length >= 2) {
                                // Check from right to left for column with actual data
                                for (let i = columns.length - 1; i >= 0; i--) {
                                    const inputs = columns[i].querySelectorAll('input[type="text"], input[type="date"], textarea');
                                    const hasValues = Array.from(inputs).some(input => input.value && input.value.trim() !== '');
                                    
                                    if (hasValues) {
                                        scrapedColumn = columns[i];
                                        break;
                                    }
                                }
                            }
                            
                            // Final fallback: if we have multiple columns, never use the first one (that's old data)
                            if (!scrapedColumn && columns.length >= 2) {
                                scrapedColumn = columns[columns.length - 1];
                            } else if (!scrapedColumn && columns.length === 1) {
                                scrapedColumn = columns[0];
                            }
                        }
                    }
                } else if (editForm) {
                    // No modal found, but we have an edit form - the data is already applied
                    scrapedColumn = editForm;
                }
                
                // If no clear columns found, look for form containers
                if (!scrapedColumn && scraperModal) {
                    const forms = scraperModal.querySelectorAll('form, .form-container');
                    if (forms.length >= 2) {
                        // Use the second form (new data)
                        scrapedColumn = forms[1];
                    } else if (forms.length === 1) {
                        scrapedColumn = forms[0];
                    }
                }
                
                // Last resort - use the whole modal or edit form
                if (!scrapedColumn) {
                    if (scraperModal) {
                        scrapedColumn = scraperModal;
                    } else if (editForm) {
                        scrapedColumn = editForm;
                    } else {
                        // No modal or form found - fall back to document
                        scrapedColumn = document;
                    }
                }
                
                // Now collect data from the scraped column
                
                // Enhanced collection strategy - look in the scraped column first, then fallback to document
                const searchScope = scrapedColumn || document;
                
                // Title - look for input with Title placeholder or by label
                // Try multiple strategies to find the title
                let titleInput = searchScope.querySelector('input[placeholder="Title"]');
                if (!titleInput) {
                    // Try finding by label
                    const labels = Array.from(searchScope.querySelectorAll('label'));
                    const titleLabel = labels.find(l => l.textContent.trim() === 'Title');
                    if (titleLabel) {
                        // Find the input in the same form-group
                        const formGroup = titleLabel.closest('.form-group, .form-control-group, div');
                        if (formGroup) {
                            titleInput = formGroup.querySelector('input[type="text"], input:not([type])');
                        }
                    }
                }
                if (!titleInput) {
                    // Try by name attribute
                    titleInput = searchScope.querySelector('input[name="title"], input[name="Title"], input[id*="title"]');
                }
                if (!titleInput) {
                    // Last resort - find any text input with a title-like value
                    const allInputs = searchScope.querySelectorAll('input[type="text"], input:not([type])');
                    titleInput = Array.from(allInputs).find(input => 
                        input.placeholder === 'Title' || 
                        (input.value && input.value.length > 10 && !input.placeholder?.includes('URL') && !input.placeholder?.includes('Code') && !input.placeholder?.includes('Date'))
                    );
                }
                if (titleInput && titleInput.value) {
                    scrapedData.title = titleInput.value;
                }
                
                // URL - look for input with URLs placeholder
                let urlInput = searchScope.querySelector('input[placeholder="URLs"], input[placeholder="URL"]');
                if (!urlInput) {
                    // Try finding by label
                    const urlLabel = Array.from(searchScope.querySelectorAll('label')).find(l => 
                        l.textContent.trim() === 'URLs' || l.textContent.trim() === 'URL'
                    );
                    if (urlLabel) {
                        const formGroup = urlLabel.closest('.form-group, .form-control-group, div');
                        if (formGroup) {
                            urlInput = formGroup.querySelector('input');
                        }
                    }
                }
                if (!urlInput) {
                    // Try by name/id attributes
                    urlInput = searchScope.querySelector('input[name*="url" i], input[id*="url" i]');
                }
                if (urlInput && urlInput.value) {
                    scrapedData.url = urlInput.value;
                }
                
                // Date
                const dateInput = searchScope.querySelector('input[type="date"], input[placeholder*="YYYY-MM-DD"], input[name*="date" i]');
                if (dateInput && dateInput.value) {
                    scrapedData.date = dateInput.value;
                }
                
                // Studio Code
                const studioCodeInput = searchScope.querySelector('input[placeholder="Studio Code"], input[name*="code" i]');
                if (studioCodeInput && studioCodeInput.value) {
                    scrapedData.studioCode = studioCodeInput.value;
                }
                
                // Details - look for textarea
                let detailsTextarea = searchScope.querySelector('textarea[placeholder="Details"], textarea[placeholder="Description"]');
                if (!detailsTextarea) {
                    // Try finding by label
                    const detailsLabel = Array.from(searchScope.querySelectorAll('label')).find(l => 
                        l.textContent.trim() === 'Details' || l.textContent.trim() === 'Description'
                    );
                    if (detailsLabel) {
                        const formGroup = detailsLabel.closest('.form-group, .form-control-group, div');
                        if (formGroup) {
                            detailsTextarea = formGroup.querySelector('textarea');
                        }
                    }
                }
                if (!detailsTextarea) {
                    // Try by name/id attributes
                    detailsTextarea = searchScope.querySelector('textarea[name*="details" i], textarea[name*="description" i], textarea[id*="details" i], textarea[id*="description" i]');
                }
                if (detailsTextarea && detailsTextarea.value) {
                    scrapedData.details = detailsTextarea.value;
                }
                
                // Group/Movie - look for these specific fields
                const groupSelects = searchScope.querySelectorAll('.react-select__value-container');
                groupSelects.forEach(container => {
                    const label = container.closest('.form-group')?.querySelector('label');
                    if (label && (label.textContent.toLowerCase().includes('group') || label.textContent.toLowerCase().includes('movie'))) {
                        const value = container.querySelector('.react-select__single-value');
                        if (value && value.textContent) {
                            scrapedData.group = value.textContent.trim();
                        }
                    }
                });
                
                // Thumbnail - look for scene cover image
                const thumbnailImg = searchScope.querySelector('.scene-cover img, .SceneCover img, img[alt*="scene" i], img[alt*="cover" i]');
                if (thumbnailImg) {
                    scrapedData.thumbnail = thumbnailImg.src || thumbnailImg.getAttribute('data-src');
                }

                // Performers - look for performer select components
                // Find by label first
                const labels = Array.from(searchScope.querySelectorAll('label'));
                const performerLabel = labels.find(l => 
                    l.textContent.trim() === 'Performers' || l.textContent.trim() === 'Performer(s)'
                );
                if (performerLabel) {
                    const formGroup = performerLabel.closest('.form-group, .form-control-group, div');
                    if (formGroup) {
                        const performerSelect = formGroup.querySelector('.react-select');
                        if (performerSelect) {
                            const performerValues = performerSelect.querySelectorAll('.react-select__multi-value__label');
                            performerValues.forEach(el => {
                                const text = el.textContent?.trim();
                                if (text && !text.includes('×') && !scrapedData.performers.includes(text)) {
                                    scrapedData.performers.push(text);
                                }
                            });
                        }
                    }
                }
                
                // If we didn't find performers by label, look for multi-select with performer-like values
                if (scrapedData.performers.length === 0) {
                    // Find multi-selects that have name-like values (not tags)
                    const multiSelects = searchScope.querySelectorAll('.react-select__value-container--is-multi');
                    multiSelects.forEach(container => {
                        const values = container.querySelectorAll('.react-select__multi-value__label');
                        const valueTexts = Array.from(values).map(v => v.textContent?.trim()).filter(t => t);
                        // If values look like names (short, capitalized), they're likely performers
                        if (valueTexts.length > 0 && valueTexts.every(t => t.length < 30 && /^[A-Z]/.test(t))) {
                            valueTexts.forEach(text => {
                                if (!scrapedData.performers.includes(text) && !text.includes('×')) {
                                    scrapedData.performers.push(text);
                                }
                            });
                            return; // Stop after finding the first performer-like multi-select
                        }
                    });
                }
                
                if (scrapedData.performers.length > 0) {
                }

                // Studio - look for React Select single value
                const studioLabel = Array.from(searchScope.querySelectorAll('label')).find(l => 
                    l.textContent.trim() === 'Studio'
                );
                if (studioLabel) {
                    const studioSelect = studioLabel.parentElement.querySelector('.react-select');
                    if (studioSelect) {
                        const studioValue = studioSelect.querySelector('.react-select__single-value');
                        if (studioValue && studioValue.textContent) {
                            scrapedData.studio = studioValue.textContent.trim();
                        }
                    }
                }
                
                // If not found by label, try by class
                if (!scrapedData.studio) {
                    const studioSelects = searchScope.querySelectorAll('.react-select.studio-select, [class*="studio"] .react-select');
                    studioSelects.forEach(select => {
                        const studioValue = select.querySelector('.react-select__single-value');
                        if (studioValue && studioValue.textContent && !scrapedData.studio) {
                            scrapedData.studio = studioValue.textContent.trim();
                        }
                    });
                }

                // Tags - look for tag select components
                const tagLabel = Array.from(searchScope.querySelectorAll('label')).find(l => 
                    l.textContent.trim() === 'Tags' || l.textContent.trim() === 'Tag(s)'
                );
                if (tagLabel) {
                    const tagSelect = tagLabel.parentElement.querySelector('.react-select');
                    if (tagSelect) {
                        const tagValues = tagSelect.querySelectorAll('.react-select__multi-value__label');
                        tagValues.forEach(el => {
                            const text = el.textContent?.trim();
                            if (text && !text.includes('×') && !scrapedData.tags.includes(text)) {
                                scrapedData.tags.push(text);
                            }
                        });
                    }
                }
                
                // If not found by label, try by class
                if (scrapedData.tags.length === 0) {
                    const tagSelects = searchScope.querySelectorAll('.react-select.tag-select, [class*="tag"] .react-select');
                    tagSelects.forEach(select => {
                        const tagValues = select.querySelectorAll('.react-select__multi-value__label');
                        tagValues.forEach(el => {
                            const text = el.textContent?.trim();
                            // Make sure it's not already in performers and not a duplicate
                            if (text && !text.includes('×') && !scrapedData.performers.includes(text) && !scrapedData.tags.includes(text)) {
                                scrapedData.tags.push(text);
                            }
                        });
                    });
                }
                
                if (scrapedData.tags.length > 0) {
                }

                if (!scrapedData.title && !scrapedData.studio && scrapedData.performers.length === 0) {
                    
                    // Fallback: Try to collect from ALL visible inputs in the document
                    const allVisibleInputs = Array.from(document.querySelectorAll('input[type="text"]:not([type="hidden"]), input[type="date"]:not([type="hidden"]), textarea')).filter(i => i.offsetParent !== null);
                    
                    allVisibleInputs.forEach(input => {
                        if (input.value) {
                            // Try to identify the field by label
                            const formGroup = input.closest('.form-group, .form-control-group, [class*="form"]');
                            const label = formGroup?.querySelector('label')?.textContent?.trim() || '';
                            
                            if ((label === 'Title' || input.placeholder === 'Title') && !scrapedData.title) {
                                scrapedData.title = input.value;
                            } else if ((label === 'URLs' || label === 'URL' || input.placeholder === 'URLs') && !scrapedData.url) {
                                scrapedData.url = input.value;
                            } else if ((label === 'Studio Code' || input.placeholder === 'Studio Code') && !scrapedData.studioCode) {
                                scrapedData.studioCode = input.value;
                            } else if ((label === 'Details' || label === 'Description') && !scrapedData.details) {
                                scrapedData.details = input.value;
                            }
                        }
                    });
                    
                    // Fallback for React Select components
                    document.querySelectorAll('.react-select__value-container').forEach(container => {
                        const formGroup = container.closest('.form-group, .form-control-group, [class*="form"]');
                        const label = formGroup?.querySelector('label')?.textContent?.trim() || '';
                        
                        if (label === 'Studio' && !scrapedData.studio) {
                            const studioValue = container.querySelector('.react-select__single-value');
                            if (studioValue?.textContent) {
                                scrapedData.studio = studioValue.textContent.trim();
                            }
                        } else if (label === 'Performers' && scrapedData.performers.length === 0) {
                            const performerValues = container.querySelectorAll('.react-select__multi-value__label');
                            performerValues.forEach(el => {
                                const text = el.textContent?.trim();
                                if (text && !text.includes('×')) {
                                    scrapedData.performers.push(text);
                                }
                            });
                            if (scrapedData.performers.length > 0) {
                            }
                        } else if (label === 'Tags' && scrapedData.tags.length === 0) {
                            const tagValues = container.querySelectorAll('.react-select__multi-value__label');
                            tagValues.forEach(el => {
                                const text = el.textContent?.trim();
                                if (text && !text.includes('×') && !scrapedData.performers.includes(text)) {
                                    scrapedData.tags.push(text);
                                }
                            });
                            if (scrapedData.tags.length > 0) {
                            }
                        }
                    });
                    
                    
                    // Log all visible text inputs with values
                    const visibleInputs = Array.from(document.querySelectorAll('input[type="text"]:not([type="hidden"]), input[type="date"]:not([type="hidden"])')).filter(i => i.offsetParent !== null);
                    visibleInputs.forEach(input => {
                        if (input.value) {
                            const label = input.closest('.form-group')?.querySelector('label')?.textContent || 'No label';
                        }
                    });
                    
                    // Log all React Select components with values
                    document.querySelectorAll('.react-select__value-container').forEach(container => {
                        const label = container.closest('.form-group')?.querySelector('label')?.textContent || 'No label';
                        const singleValue = container.querySelector('.react-select__single-value')?.textContent;
                        const multiValues = Array.from(container.querySelectorAll('.react-select__multi-value__label')).map(el => el.textContent);
                        if (singleValue || multiValues.length > 0) {
                        }
                    });
                    
                    // Check if we're in the right context
                }
                
                return scrapedData;
            } catch (error) {
                return scrapedData;
            }
        }

        /**
         * Get image resolution from URL
         * @param {string} url - Image URL to analyze
         * @returns {Promise<Object>} Resolution object with width, height, and total pixels
         */
        async getImageResolution(url) {
            return new Promise((resolve) => {
                if (!url) {
                    resolve({ width: 0, height: 0, pixels: 0 });
                    return;
                }
                
                const img = new Image();
                img.crossOrigin = 'anonymous'; // Handle CORS if needed
                
                img.onload = () => {
                    const resolution = {
                        width: img.width,
                        height: img.height,
                        pixels: img.width * img.height
                    };
                    resolve(resolution);
                };
                
                img.onerror = () => {
                    resolve({ width: 0, height: 0, pixels: 0 });
                };
                
                img.src = url;
            });
        }

        /**
         * Compare current and scraped thumbnail resolutions
         * @param {string} currentUrl - Current thumbnail URL
         * @param {string} scrapedUrl - Scraped thumbnail URL
         * @returns {Promise<Object>} Comparison result with recommendation
         */
        async compareThumbnails(currentUrl, scrapedUrl) {
            
            if (!scrapedUrl) {
                return {
                    shouldUpdate: false,
                    reason: 'No scraped thumbnail available',
                    currentRes: null,
                    scrapedRes: null
                };
            }
            
            try {
                // Get both resolutions in parallel
                const [currentRes, scrapedRes] = await Promise.all([
                    this.getImageResolution(currentUrl),
                    this.getImageResolution(scrapedUrl)
                ]);
                
                const improvementPixels = scrapedRes.pixels - currentRes.pixels;
                const improvementPercent = currentRes.pixels > 0 
                    ? ((improvementPixels / currentRes.pixels) * 100).toFixed(1)
                    : 100;
                
                const result = {
                    shouldUpdate: scrapedRes.pixels > currentRes.pixels,
                    currentRes: currentRes,
                    scrapedRes: scrapedRes,
                    improvementPixels: improvementPixels,
                    improvementPercent: improvementPercent,
                    reason: ''
                };
                
                if (result.shouldUpdate) {
                    result.reason = `Scraped thumbnail is ${improvementPercent}% larger (${scrapedRes.width}x${scrapedRes.height} vs ${currentRes.width}x${currentRes.height})`;
                } else if (scrapedRes.pixels === currentRes.pixels) {
                    result.reason = 'Thumbnails have the same resolution';
                } else {
                    result.reason = `Current thumbnail is higher resolution (${currentRes.width}x${currentRes.height} vs ${scrapedRes.width}x${scrapedRes.height})`;
                }
                
                return result;
            } catch (error) {
                return {
                    shouldUpdate: false,
                    reason: 'Error comparing thumbnails',
                    currentRes: null,
                    scrapedRes: null,
                    error: error.message
                };
            }
        }

        /**
         * Get current scene thumbnail URL
         * @returns {string|null} Current thumbnail URL or null if not found
         */
        getCurrentThumbnail() {
            
            // Try multiple selectors to find the current thumbnail
            const selectors = [
                '.scene-cover img',
                '.SceneCover img',
                '.scene-card-preview img',
                '.scene-details img.scene-cover',
                'img[alt*="scene" i][src*="image"]',
                'img[alt*="cover" i]',
                '.detail-header img',
                '.detail-container img[src*="/scene/"]'
            ];
            
            for (const selector of selectors) {
                const img = document.querySelector(selector);
                if (img && img.src) {
                    return img.src;
                }
            }
            
            return null;
        }

// Clean version of showScrapedDataConfirmation method
// This replaces the broken method starting at line 3601 and ending at line 4087

async showScrapedDataConfirmation(scrapedData, hasScrapedSource = false) {
    
    return new Promise(async (resolve) => {
        // Create action widget (no backdrop or dialog)
        const actionWidget = document.createElement('div');
        actionWidget.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            z-index: 10004;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            min-width: 350px;
            max-width: 450px;
            border: 2px solid rgba(255,255,255,0.2);
            animation: slideIn 0.3s ease-out;
        `;

        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
        `;
        document.head.appendChild(style);

        // Check if we have data
        const hasData = scrapedData && (
            scrapedData.title || scrapedData.date || scrapedData.studio || 
            (scrapedData.performers && scrapedData.performers.length > 0) || 
            (scrapedData.tags && scrapedData.tags.length > 0) || 
            scrapedData.details || scrapedData.url || scrapedData.studioCode ||
            scrapedData.group || scrapedData.thumbnail
        );

        // Count the amount of data found
        let dataCount = 0;
        if (scrapedData) {
            if (scrapedData.title) dataCount++;
            if (scrapedData.date) dataCount++;
            if (scrapedData.studio) dataCount++;
            if (scrapedData.performers && scrapedData.performers.length > 0) dataCount += scrapedData.performers.length;
            if (scrapedData.tags && scrapedData.tags.length > 0) dataCount += scrapedData.tags.length;
            if (scrapedData.details) dataCount++;
            if (scrapedData.url) dataCount++;
            if (scrapedData.studioCode) dataCount++;
            if (scrapedData.group) dataCount++;
            if (scrapedData.thumbnail) dataCount++;
        }

        // Check thumbnail resolution only if at least one source has been scraped
        let thumbnailComparison = null;
        let thumbnailMessage = null;
        if (hasScrapedSource && scrapedData && scrapedData.thumbnail) {
            const currentThumbnail = this.getCurrentThumbnail();
            thumbnailComparison = await this.compareThumbnails(currentThumbnail, scrapedData.thumbnail);
            
            // Store the comparison message for display
            if (thumbnailComparison.shouldUpdate) {
                thumbnailMessage = `✅ Thumbnail: ${thumbnailComparison.improvementPercent}% larger (${thumbnailComparison.scrapedRes.width}x${thumbnailComparison.scrapedRes.height})`;
            } else {
                thumbnailMessage = `⚠️ Thumbnail: Current is better (${thumbnailComparison.currentRes.width}x${thumbnailComparison.currentRes.height} vs ${thumbnailComparison.scrapedRes.width}x${thumbnailComparison.scrapedRes.height})`;
                // Optionally filter out thumbnail if current is better
                if (getConfig('PREFER_HIGHER_RES_THUMBNAILS')) {
                    delete scrapedData.thumbnail;
                    dataCount--;
                }
            }
        } else if (scrapedData && scrapedData.thumbnail && !hasScrapedSource) {
            thumbnailMessage = `🖼️ Thumbnail: New thumbnail available`;
        }

        // Create widget content with just the action buttons
        if (!hasData) {
            actionWidget.innerHTML = `
                <div>
                    <h4 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">⚠️ No Metadata Found</h4>
                    <p style="margin: 0 0 15px 0; font-size: 13px; opacity: 0.9;">The scraper didn't return any data for this scene.</p>
                    <div style="display: flex; gap: 10px;">
                        <button id="skip-scraped-data" style="
                            flex: 1;
                            background: #f39c12;
                            color: white;
                            border: none;
                            padding: 8px 12px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: bold;
                        ">⏩ Skip</button>
                        <button id="cancel-scraped-data" style="
                            flex: 1;
                            background: #e74c3c;
                            color: white;
                            border: none;
                            padding: 8px 12px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: bold;
                        ">❌ Cancel</button>
                    </div>
                </div>
            `;
        } else {
            // Build a summary of what was found
            let summaryText = [];
            if (scrapedData.title) summaryText.push('Title');
            if (scrapedData.studio) summaryText.push('Studio');
            if (scrapedData.date) summaryText.push('Date');
            if (scrapedData.performers && scrapedData.performers.length > 0) {
                summaryText.push(`${scrapedData.performers.length} Performer${scrapedData.performers.length > 1 ? 's' : ''}`);
            }
            if (scrapedData.tags && scrapedData.tags.length > 0) {
                summaryText.push(`${scrapedData.tags.length} Tag${scrapedData.tags.length > 1 ? 's' : ''}`);
            }
            if (scrapedData.details) summaryText.push('Details');
            if (scrapedData.thumbnail && thumbnailComparison && thumbnailComparison.shouldUpdate) {
                summaryText.push(`Thumbnail (${thumbnailComparison.improvementPercent}% larger)`);
            } else if (scrapedData.thumbnail) {
                summaryText.push('Thumbnail');
            }
            
            const summaryString = summaryText.length > 0 ? summaryText.join(', ') : 'Metadata';
            
            actionWidget.innerHTML = `
                <div>
                    <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">✨ Metadata Found!</h4>
                    <p style="margin: 0 0 5px 0; font-size: 13px; opacity: 0.9;">Found: ${summaryString}</p>
                    ${thumbnailMessage ? `<p style="margin: 0 0 5px 0; font-size: 12px; opacity: 0.85;">${thumbnailMessage}</p>` : ''}
                    <p style="margin: 0 0 15px 0; font-size: 12px; opacity: 0.7;">Review the changes and choose an action:</p>
                    <div style="display: flex; gap: 10px;">
                        <button id="apply-scraped-data" style="
                            flex: 1;
                            background: #27ae60;
                            color: white;
                            border: none;
                            padding: 8px 12px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: bold;
                        ">✅ Apply</button>
                        <button id="skip-scraped-data" style="
                            flex: 1;
                            background: #f39c12;
                            color: white;
                            border: none;
                            padding: 8px 12px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: bold;
                        ">⏩ Skip</button>
                        <button id="cancel-scraped-data" style="
                            flex: 1;
                            background: #e74c3c;
                            color: white;
                            border: none;
                            padding: 8px 12px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: bold;
                        ">❌ Cancel</button>
                    </div>
                </div>
            `;
        }

        // Setup event handlers
        const applyBtn = actionWidget.querySelector('#apply-scraped-data');
        if (applyBtn) {
            applyBtn.onclick = () => {
                actionWidget.remove();
                resolve('apply');
            };
        }

        const skipBtn = actionWidget.querySelector('#skip-scraped-data');
        if (skipBtn) {
            skipBtn.onclick = () => {
                actionWidget.remove();
                resolve('skip');
            };
        }

        const cancelBtn = actionWidget.querySelector('#cancel-scraped-data');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                actionWidget.remove();
                resolve('cancel');
            };
        }

        // Add widget to page
        document.body.appendChild(actionWidget);
    });
}

        async applyScrapedData() {
            this.updateSceneStatus('📊 Analyzing scraped metadata...');

            await this.wait(2000);

            // Check current scene status to see if any source has been scraped
            const currentStatus = await this.statusTracker.detectCurrentStatus();
            const hasScrapedSource = currentStatus.stashdb.scraped || currentStatus.theporndb.scraped;

            // Check if auto-apply is disabled
            if (!getConfig(CONFIG.AUTO_APPLY_CHANGES)) {
                
                // Collect the scraped data
                const scrapedData = await this.collectScrapedData();
                
                // Show confirmation dialog (pass scraping status for thumbnail check)
                const userChoice = await this.showScrapedDataConfirmation(scrapedData, hasScrapedSource);
                
                if (userChoice === 'cancel') {
                    this.updateSceneStatus('❌ Cancelled by user');
                    notifications.show('❌ Automation cancelled', 'warning');
                    return 'cancel';
                } else if (userChoice === 'skip') {
                    this.updateSceneStatus('⏩ Skipped source');
                    notifications.show('⏩ Skipped scraper source', 'info');
                    return 'skip';
                }
                
            } else {
            }

            this.updateSceneStatus('✅ Applying metadata changes...');

            const allButtons = document.querySelectorAll('button, .btn, input[type="button"], input[type="submit"]');
            for (const btn of allButtons) {
                const text = btn.textContent || btn.value || '';
                if (text.toLowerCase().includes('apply')) {
                    if (!btn.disabled) {
                        btn.click();
                        await this.wait(1500);
                        notifications.show('✅ Metadata applied successfully', 'success');
                        return 'apply';
                    }
                }
            }

            return 'skip';
        }

        async createNewPerformers() {
            this.updateSceneStatus('👥 Creating new performers...');
            await this.wait(2500);

            // Find plus buttons for new performers, studios, tags, etc.
            const plusButtonSelectors = [
                'button.minimal.ml-2.btn.btn-primary svg[data-prefix="fas"][data-icon="plus"]',
                'button.minimal.ml-2.btn.btn-primary svg[data-icon="plus"]',
                '.scraper-result button svg[data-icon="plus"]',
                'button.btn-primary svg.fa-plus'
            ];

            let plusButtons = [];
            for (const selector of plusButtonSelectors) {
                plusButtons = document.querySelectorAll(selector);
                if (plusButtons.length > 0) {
                    break;
                }
            }

            if (plusButtons.length > 0) {
                this.updateSceneStatus(`👥 Creating ${plusButtons.length} new entries...`);
                
                for (let i = 0; i < plusButtons.length; i++) {
                    try {
                        const button = plusButtons[i].closest('button');
                        if (button && !button.disabled) {
                            button.click();
                            
                            // Wait between clicks, longer for the last one
                            if (i < plusButtons.length - 1) {
                                await this.wait(2000);
                            } else {
                                await this.wait(3000);
                            }
                        }
                    } catch (error) {
                    }
                }
            }
        }

        async organizeScene() {
            this.updateSceneStatus('📁 Organizing scene...');
            await this.wait(1000);

            // Double-check if already organized before proceeding
            const isAlreadyOrganized = await this.checkOrganizedStatus();
            if (isAlreadyOrganized) {
                this.updateSceneStatus('✅ Scene already organized');
                return;
            }

            // Find organize button
            const organizedToggle = this.findOrganizedCheckbox();
            if (!organizedToggle) {
                this.updateSceneStatus('❌ Organize button not found');
                return;
            }

            // Check button state and only click if not already organized
            if (!organizedToggle.checked) {
                organizedToggle.click();
                await this.wait(1500); // Wait for UI update
                
                // Verify the organization was successful
                const newStatus = await this.checkOrganizedStatus();
                if (newStatus) {
                    this.updateSceneStatus('✅ Organized');
                } else {
                    this.updateSceneStatus('⚠️ Organization status unclear');
                }
                
                // Update status widget after organize change
                await this.updateStatusAfterOrganize();
            } else {
                this.updateSceneStatus('✅ Scene already organized');
                
                // Still update widget to ensure accuracy
                await this.updateStatusAfterOrganize();
            }
        }

        async updateStatusAfterOrganize() {
            try {
                // Wait longer for organize state to fully update in backend
                await this.wait(3000);
                
                // Clear GraphQL cache to ensure fresh data
                if (this.sourceDetector && this.sourceDetector.cache) {
                    this.sourceDetector.cache.clear();
                }
                
                // Trigger status update from DOM
                await this.updateStatusFromDOM();
            } catch (error) {
            }
        }

        async saveScene() {
            this.updateSceneStatus('💾 Saving...');
            await this.wait(1000);

            const allButtons = document.querySelectorAll('button, .btn, input[type="button"], input[type="submit"]');
            for (const btn of allButtons) {
                const text = btn.textContent || btn.value || '';
                if (text.toLowerCase().includes('save') && !btn.disabled) {
                    btn.click();
                    await this.wait(2000);
                    
                    // Update status widget after save
                    await this.updateStatusAfterSave();
                    return;
                }
            }
        }

        async updateStatusAfterSave() {
            try {
                // Wait longer for save to fully complete and backend to update
                await this.wait(3000);
                
                // Clear GraphQL cache to ensure fresh data
                if (this.sourceDetector && this.sourceDetector.cache) {
                    this.sourceDetector.cache.clear();
                }
                
                // Trigger status update from DOM (will be handled by mutation observer or manually)
                await this.updateStatusFromDOM();
            } catch (error) {
            }
        }

        findOrganizedCheckbox() {
            // Find the organize button (Stash uses a button with title="Organized")
            const organizeButtonSelectors = [
                'button[title="Organized"]',
                'button[title*="organized" i]'
            ];
            
            for (const selector of organizeButtonSelectors) {
                const button = document.querySelector(selector);
                if (button) {
                    // Create a checkbox-like interface for the button
                    return {
                        element: button,
                        get checked() { 
                            return button.classList.contains('active') || 
                                   button.getAttribute('aria-pressed') === 'true' ||
                                   button.dataset.organized === 'true';
                        },
                        click() {
                            button.click();
                            button.dataset.organized = 'true';
                        }
                    };
                }
            }
            
            // Fallback: Look for actual checkboxes with "organized" in nearby text
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            for (const checkbox of checkboxes) {
                const parent = checkbox.closest('.form-check, .form-group, div');
                if (parent && parent.textContent.toLowerCase().includes('organized')) {
                    return checkbox;
                }
            }
            
            return null;
        }

        async checkOrganizedStatus() {
            // Try GraphQL first for most accurate status
            if (getConfig(CONFIG.ENABLE_CROSS_SCENE_INTELLIGENCE)) {
                try {
                    const organizedStatus = await this.sourceDetector.detectOrganizedStatus();
                    if (organizedStatus.found && organizedStatus.confidence >= 100) {
                        return organizedStatus.organized;
                    }
                } catch (error) {
                }
            }
            
            // Fallback to DOM-based detection
            const checkbox = this.findOrganizedCheckbox();
            const domStatus = checkbox ? checkbox.checked : false;
            return domStatus;
        }

        wait(ms) {
            return new Promise((resolve, reject) => {
                const checkInterval = 100; // Check for cancellation every 100ms
                let elapsed = 0;
                
                const interval = setInterval(() => {
                    if (this.automationCancelled) {
                        clearInterval(interval);
                        reject(new Error('Automation cancelled'));
                        return;
                    }
                    
                    elapsed += checkInterval;
                    if (elapsed >= ms) {
                        clearInterval(interval);
                        resolve();
                    }
                }, checkInterval);
            });
        }

        async waitForPageRerender() {
            
            // Initial wait for save to complete
            await this.wait(2000);
            
            // Look for signs that the page is re-rendering:
            // 1. DOM mutations (new elements being added)
            // 2. Image loading (thumbnails changing)
            // 3. React component updates
            
            let rerenderDetected = false;
            let waitTime = 0;
            const maxWaitTime = 10000; // Maximum 10 seconds
            const checkInterval = 500; // Check every 500ms
            
            // Set up mutation observer to detect DOM changes
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    // Look for thumbnail/image changes
                    if (mutation.type === 'childList') {
                        const addedNodes = Array.from(mutation.addedNodes);
                        const hasImageChanges = addedNodes.some(node => 
                            node.tagName === 'IMG' || 
                            (node.querySelector && node.querySelector('img')) ||
                            (node.className && node.className.includes('thumbnail'))
                        );
                        
                        if (hasImageChanges) {
                            rerenderDetected = true;
                        }
                    }
                    
                    // Look for attribute changes on images (src changes)
                    if (mutation.type === 'attributes' && 
                        mutation.target.tagName === 'IMG' && 
                        mutation.attributeName === 'src') {
                        rerenderDetected = true;
                    }
                }
            });
            
            // Start observing
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src', 'class']
            });
            
            // Wait for changes or timeout
            while (!rerenderDetected && waitTime < maxWaitTime) {
                await this.wait(checkInterval);
                waitTime += checkInterval;
                
                // Also check for any loading indicators disappearing
                const loadingElements = document.querySelectorAll('.loading, .spinner, [class*="loading"]');
                if (loadingElements.length === 0 && waitTime > 3000) {
                    break;
                }
            }
            
            // Cleanup observer
            observer.disconnect();
            
            if (rerenderDetected) {
                await this.wait(1500); // Additional wait for render to complete
            } else if (waitTime >= maxWaitTime) {
            } else {
            }
            
        }
    }

    // ===== INITIALIZATION =====
    const uiManager = new UIManager();
    
    window.stashUIManager = uiManager;

    // Initialize UI after DOM is ready
    async function initializeUI() {
        const isScenePage = window.location.href.includes('/scenes/') && !window.location.href.includes('/scenes/markers');
        
        if (isScenePage) {
            // Check if scene is already organized
            await uiManager.wait(1000); // Wait for page to load
            const isOrganized = await uiManager.checkOrganizedStatus();
            
            if (isOrganized) {
                uiManager.createMinimizedButton();
                uiManager.isMinimized = true;
            } else {
                uiManager.createPanel();
            }
        } else {
            // On non-scene pages, always show minimized button
            uiManager.createMinimizedButton();
            uiManager.isMinimized = true;
        }
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initializeUI, 1000);
        });
    } else {
        setTimeout(initializeUI, 1000);
    }

    window.uiManager = uiManager;
    window.expandAutomateStash = () => uiManager.expand();


})();
