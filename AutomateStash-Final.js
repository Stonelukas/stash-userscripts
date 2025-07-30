// ==UserScript==
// @name         AutomateStash Final
// @version      4.4.0
// @description  AutomateStash with GraphQL API integration, real-time status updates, and organize state protection
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

    console.log('🚀 AutomateStash Final v4.4.0 - GraphQL API integration, real-time status updates, organize state protection, and global availability');

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
        STASH_API_KEY: 'stashApiKey'
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
        [CONFIG.STASH_API_KEY]: ''
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
                    console.error('❌ GraphQL errors:', result.errors);
                    throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
                }

                return result.data;
            } catch (error) {
                console.error('❌ GraphQL query failed:', error);
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
            console.log('🔍 Detecting StashDB data...');
            
            // Always try GraphQL first for most accurate results
            try {
                const graphqlResult = await this.validateStashDBGraphQL();
                if (graphqlResult.found) {
                    console.log(`✅ StashDB detected via GraphQL (confidence: 100%)`);
                    return {
                        ...graphqlResult,
                        strategy: 'stashdb_graphql',
                        confidence: 100
                    };
                }
            } catch (error) {
                console.warn('⚠️ GraphQL detection failed, falling back to DOM:', error);
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
                        console.log(`✅ StashDB detected via ${strategy.name} (confidence: ${strategy.confidence}%)`);
                        return result;
                    }
                } catch (error) {
                    console.error(`❌ Error in StashDB detection strategy ${strategy.name}:`, error);
                }
            }
            
            console.log('❌ StashDB data not detected');
            return { found: false, confidence: 0, data: null };
        }

        /**
         * Detect ThePornDB data with confidence scoring
         * @returns {Object} Detection result with confidence level and detected data
         */
        async detectThePornDBData() {
            console.log('🔍 Detecting ThePornDB data...');
            
            // Always try GraphQL first for most accurate results
            try {
                const graphqlResult = await this.validateThePornDBGraphQL();
                if (graphqlResult.found) {
                    console.log(`✅ ThePornDB detected via GraphQL (confidence: 100%)`);
                    return {
                        ...graphqlResult,
                        strategy: 'theporndb_graphql',
                        confidence: 100
                    };
                }
            } catch (error) {
                console.warn('⚠️ GraphQL detection failed, falling back to DOM:', error);
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
                        console.log(`✅ ThePornDB detected via ${strategy.name} (confidence: ${strategy.confidence}%)`);
                        return result;
                    }
                } catch (error) {
                    console.error(`❌ Error in ThePornDB detection strategy ${strategy.name}:`, error);
                }
            }
            
            console.log('❌ ThePornDB data not detected');
            return { found: false, confidence: 0, data: null };
        }

        /**
         * Detect organized status
         * @returns {Object} Detection result with confidence level
         */
        async detectOrganizedStatus() {
            console.log('🔍 Detecting organized status...');
            
            // Always try GraphQL first for most accurate results
            try {
                const graphqlResult = await this.validateOrganizedGraphQL();
                if (graphqlResult.found) {
                    console.log(`✅ Organized status detected via GraphQL (confidence: 100%): ${graphqlResult.organized}`);
                    return {
                        ...graphqlResult,
                        strategy: 'organized_graphql',
                        confidence: 100
                    };
                }
            } catch (error) {
                console.warn('⚠️ GraphQL detection failed, falling back to DOM:', error);
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
                        console.log(`✅ Organized status detected via ${strategy.name} (confidence: ${strategy.confidence}%): ${result.organized}`);
                        return result;
                    }
                } catch (error) {
                    console.error(`❌ Error in organized status detection strategy ${strategy.name}:`, error);
                }
            }
            
            console.log('❌ Organized status not detected');
            return { found: false, confidence: 0, organized: false };
        }

        /**
         * Scan page for available scraping sources
         * @returns {Array} List of available scraping options
         */
        async scanAvailableSources() {
            console.log('🔍 Scanning for available scraping sources...');
            
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
            
            console.log(`📊 Found ${sources.length} available scraping sources:`, sources);
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
                console.error('❌ GraphQL StashDB validation failed:', error);
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
                console.error('❌ GraphQL ThePornDB validation failed:', error);
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
                console.error('❌ GraphQL organized validation failed:', error);
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
            console.log('📊 Detecting current scene status...');
            
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

                console.log('✅ Scene status detection completed:', this.currentStatus);
                
                // Notify callbacks of status update
                this.notifyStatusUpdate();
                
                return this.currentStatus;
            } catch (error) {
                console.error('❌ Error detecting scene status:', error);
                return this.currentStatus;
            }
        }

        /**
         * Update status for specific source
         * @param {string} source - Source name (stashdb, theporndb, organized)
         * @param {Object} data - Update data
         */
        updateStatus(source, data) {
            console.log(`📝 Updating ${source} status:`, data);
            
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
                    console.error('❌ Error in status update callback:', error);
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
            console.log(`💾 Saving automation history for scene ${sceneId}:`, data);
            
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
                    console.log(`🧹 Trimmed history to ${this.maxHistoryEntries} entries`);
                }
                
                // Save to persistent storage
                GM_setValue(this.storageKey, JSON.stringify(history));
                
                console.log('✅ Automation history saved successfully');
                return historyEntry;
            } catch (error) {
                console.error('❌ Error saving automation history:', error);
                return null;
            }
        }

        /**
         * Get automation history for a specific scene
         * @param {string} sceneId - Scene identifier
         * @returns {Array} Array of history entries for the scene
         */
        async getSceneHistory(sceneId) {
            console.log(`📖 Retrieving history for scene ${sceneId}`);
            
            try {
                const allHistory = await this.getAllHistory();
                const sceneHistory = allHistory.filter(entry => entry.sceneId === sceneId);
                
                console.log(`📊 Found ${sceneHistory.length} history entries for scene ${sceneId}`);
                return sceneHistory;
            } catch (error) {
                console.error('❌ Error retrieving scene history:', error);
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
                    console.log(`🧹 Cleaned up ${history.length - validHistory.length} invalid history entries`);
                    GM_setValue(this.storageKey, JSON.stringify(validHistory));
                }
                
                return validHistory;
            } catch (error) {
                console.error('❌ Error parsing history from storage:', error);
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
            console.log('📊 Calculating automation statistics...');
            
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
                
                console.log('📈 Automation statistics:', stats);
                return stats;
            } catch (error) {
                console.error('❌ Error calculating statistics:', error);
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
            console.log('🗑️ Clearing all automation history...');
            
            try {
                GM_setValue(this.storageKey, '[]');
                console.log('✅ All automation history cleared');
                return true;
            } catch (error) {
                console.error('❌ Error clearing history:', error);
                return false;
            }
        }

        /**
         * Clear history older than specified days
         * @param {number} days - Number of days to keep
         */
        async clearOldHistory(days = 30) {
            console.log(`🧹 Clearing history older than ${days} days...`);
            
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
                
                console.log(`✅ Removed ${removedCount} old history entries, kept ${recentHistory.length} recent entries`);
                return removedCount;
            } catch (error) {
                console.error('❌ Error clearing old history:', error);
                return 0;
            }
        }

        /**
         * Export history data
         * @returns {string} JSON string of all history data
         */
        async exportHistory() {
            console.log('📤 Exporting automation history...');
            
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
                console.log(`✅ Exported ${history.length} history entries`);
                
                return exportJson;
            } catch (error) {
                console.error('❌ Error exporting history:', error);
                return null;
            }
        }

        /**
         * Import history data (with validation)
         * @param {string} jsonData - JSON string of history data
         * @returns {boolean} Success status
         */
        async importHistory(jsonData) {
            console.log('📥 Importing automation history...');
            
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
                
                console.log(`✅ Successfully imported ${validEntries.length} history entries`);
                console.log(`📊 Total history entries: ${mergedHistory.length}`);
                
                return true;
            } catch (error) {
                console.error('❌ Error importing history:', error);
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
                console.error('❌ Error getting storage info:', error);
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

    // ===== UI MANAGER =====
    class UIManager {
        constructor() {
            this.panel = null;
            this.minimizedButton = null;
            this.isMinimized = false;
            this.statusElement = null;
            
            // Initialize enhanced status tracking components
            this.sourceDetector = new SourceDetector();
            this.statusTracker = new StatusTracker(this.sourceDetector);
            this.historyManager = new HistoryManager();
            
            // Status display elements
            this.statusSummaryElement = null;
            this.debugPanelElement = null;
            
            // DOM mutation observer for real-time updates
            this.mutationObserver = null;
            this.lastStatusUpdate = Date.now();
            
            // Initialize mutation observer
            this.initializeMutationObserver();
            
            console.log('✅ Enhanced status tracking system initialized');
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
                            console.log('📊 Organize button state changed');
                            shouldUpdate = true;
                        }
                    }

                    // Check for input value changes (scraper data)
                    if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                        const target = mutation.target;
                        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                            console.log('📊 Input value changed, potential scraper data update');
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
                                    console.log('📊 Scraper-related content added to DOM');
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
                console.log('👁️ DOM mutation observer initialized');
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
                console.log('📊 Updating scene status from DOM mutations...');
                
                // Update the status tracker with current status
                await this.statusTracker.detectCurrentStatus();
                
                // Update the status summary widget if it exists
                if (this.statusSummaryElement) {
                    this.updateStatusSummaryContent(this.statusSummaryElement);
                }
                
                // Keep the main status element simple
                this.updateSceneStatus('⚡ Ready');
                
                console.log('📊 Status tracking updated from DOM');
            } catch (error) {
                console.warn('⚠️ Error updating scene status from DOM:', error);
            }
        }

        createPanel() {
            console.log('📱 Creating AutomateStash panel');
            this.cleanup();
            
            // Check if we're on a scene page
            const isScenePage = window.location.href.includes('/scenes/') && !window.location.href.includes('/scenes/markers');

            this.panel = document.createElement('div');
            this.panel.id = 'stash-automation-panel';
            this.panel.style.cssText = `
                position: fixed;
                top: 50px;
                right: 10px;
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
            const content = this.createContent();
            const buttons = this.createButtons();

            this.panel.appendChild(header);
            this.panel.appendChild(content);
            this.panel.appendChild(buttons);

            document.body.appendChild(this.panel);
            this.isMinimized = false;
            
            // Initialize status tracking after panel is created
            this.initializeStatusTracking();
            
            console.log('✅ Panel created successfully');
        }

        createHeader() {
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            `;

            const title = document.createElement('h3');
            title.textContent = 'AutomateStash v4.2.0';
            title.style.cssText = `
                color: white;
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            `;

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

            header.appendChild(title);
            header.appendChild(minimizeBtn);
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
            return content;
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
                startBtn.textContent = '🚀 Start Automation';
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
                `;
                startBtn.addEventListener('click', () => this.startAutomation());
                buttons.appendChild(startBtn);
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
            configBtn.addEventListener('click', () => this.showConfigDialog());

            const debugBtn = document.createElement('button');
            debugBtn.textContent = '🔍 Debug';
            debugBtn.style.cssText = `
                background: #6f42c1;
                color: white;
                border: none;
                padding: 10px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                transition: all 0.2s ease;
            `;
            debugBtn.addEventListener('click', () => {
                console.log('🔍 Debug functionality has been removed for cleaner output');
            });

            buttons.appendChild(configBtn);
            buttons.appendChild(debugBtn);
            return buttons;
        }
        minimize() {
            console.log('📱 Minimizing panel');
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
            this.minimizedButton.style.cssText = `
                position: fixed;
                top: 50px;
                right: 10px;
                z-index: 10000;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 20px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                transition: all 0.2s ease;
            `;

            this.minimizedButton.addEventListener('click', () => this.expand());
            document.body.appendChild(this.minimizedButton);
        }

        expand() {
            console.log('📱 Expanding panel');
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
            console.log('📊 Status:', status);
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
                { key: CONFIG.ENABLE_CROSS_SCENE_INTELLIGENCE, label: '🧠 Enable cross-scene intelligence (GraphQL)' }
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

            // Enhanced Status Tracking & Debug section
            const debugSection = document.createElement('div');
            debugSection.style.cssText = `
                margin: 20px 0;
                padding: 15px;
                background: rgba(46, 204, 113, 0.1);
                border-radius: 8px;
                border: 1px solid rgba(46, 204, 113, 0.3);
            `;

            const debugTitle = document.createElement('h3');
            debugTitle.textContent = '📊 Enhanced Status Tracking & Diagnostics';
            debugTitle.style.cssText = `
                margin: 0 0 10px 0;
                color: #2ecc71;
                font-size: 16px;
            `;

            const debugDesc = document.createElement('p');
            debugDesc.textContent = 'Advanced debugging and status tracking tools';
            debugDesc.style.cssText = `
                margin: 0 0 15px 0;
                font-size: 13px;
                color: #bdc3c7;
            `;

            const debugButtonsContainer = document.createElement('div');
            debugButtonsContainer.style.cssText = `
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                justify-content: center;
                margin-bottom: 15px;
            `;

            const debugButtons = [
                { id: 'debug-status', text: '📊 Current Status', color: '#2ecc71' },
                { id: 'debug-sources', text: '🔍 Scan Sources', color: '#3498db' },
                { id: 'debug-history', text: '📚 View History', color: '#9b59b6' },
                { id: 'debug-export', text: '📤 Export Data', color: '#f39c12' },
                { id: 'debug-clear', text: '🗑️ Clear History', color: '#e74c3c' }
            ];

            debugButtons.forEach(btn => {
                const button = document.createElement('button');
                button.id = btn.id;
                button.textContent = btn.text;
                button.style.cssText = `
                    background: ${btn.color};
                    color: white;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                `;
                debugButtonsContainer.appendChild(button);
            });

            // Debug output area
            const debugOutput = document.createElement('div');
            debugOutput.id = 'debug-output';
            debugOutput.style.cssText = `
                background: rgba(0,0,0,0.3);
                border-radius: 4px;
                padding: 10px;
                max-height: 200px;
                overflow-y: auto;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                color: #ecf0f1;
                border: 1px solid rgba(255,255,255,0.1);
                white-space: pre-wrap;
                display: none;
            `;
            debugOutput.textContent = 'Debug output will appear here...';

            debugSection.appendChild(debugTitle);
            debugSection.appendChild(debugDesc);
            debugSection.appendChild(debugButtonsContainer);
            debugSection.appendChild(debugOutput);

            // Testing section
            const testingSection = document.createElement('div');
            testingSection.style.cssText = `
                margin: 20px 0;
                padding: 15px;
                background: rgba(52, 152, 219, 0.1);
                border-radius: 8px;
                border: 1px solid rgba(52, 152, 219, 0.3);
            `;

            const testingTitle = document.createElement('h3');
            testingTitle.textContent = '🧪 Testing & Validation';
            testingTitle.style.cssText = `
                margin: 0 0 10px 0;
                color: #3498db;
                font-size: 16px;
            `;

            const testingDesc = document.createElement('p');
            testingDesc.textContent = 'Test functionality and validate performance';
            testingDesc.style.cssText = `
                margin: 0 0 15px 0;
                font-size: 13px;
                color: #bdc3c7;
            `;

            const testButtonsContainer = document.createElement('div');
            testButtonsContainer.style.cssText = `
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                justify-content: center;
            `;

            const testButtons = [
                { id: 'test-minimize', text: '🧪 Test Minimize', color: '#3498db' },
                { id: 'test-context', text: '🔍 Context Check', color: '#9b59b6' },
                { id: 'test-buttons', text: '🔘 List Buttons', color: '#f39c12' },
                { id: 'test-forms', text: '📋 Analyze Forms', color: '#e67e22' }
            ];

            testButtons.forEach(btn => {
                const button = document.createElement('button');
                button.id = btn.id;
                button.textContent = btn.text;
                button.style.cssText = `
                    background: ${btn.color};
                    color: white;
                    border: none;
                    padding: 10px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                `;
                testButtonsContainer.appendChild(button);
            });

            testingSection.appendChild(testingTitle);
            testingSection.appendChild(testingDesc);
            testingSection.appendChild(testButtonsContainer);

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
            dialog.appendChild(debugSection);
            dialog.appendChild(testingSection);
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

            // Debug button handlers
            const debugOutputArea = dialog.querySelector('#debug-output');
            
            const showDebugOutput = (content) => {
                debugOutputArea.style.display = 'block';
                debugOutputArea.textContent = content;
                debugOutputArea.scrollTop = debugOutputArea.scrollHeight;
            };

            dialog.querySelector('#debug-status').addEventListener('click', async () => {
                const status = this.statusTracker.getStatusSummary();
                const completion = this.statusTracker.getCompletionStatus();
                
                const output = `📊 CURRENT SCENE STATUS
Scene ID: ${status.scene.id || 'Unknown'}
URL: ${status.scene.url}

📋 SOURCE STATUS:
StashDB: ${status.sources.stashdb.status} (${status.sources.stashdb.confidence}% confidence)
  Strategy: ${status.sources.stashdb.strategy || 'None'}
  Timestamp: ${status.sources.stashdb.timestamp || 'Never'}

ThePornDB: ${status.sources.theporndb.status} (${status.sources.theporndb.confidence}% confidence)
  Strategy: ${status.sources.theporndb.strategy || 'None'}
  Timestamp: ${status.sources.theporndb.timestamp || 'Never'}

🗂️ ORGANIZATION:
Status: ${status.organized.status}

📈 COMPLETION:
Progress: ${completion.percentage}% (${completion.completedItems}/${completion.totalItems})
Status: ${completion.status}

Recommendations:
${completion.recommendations.map(r => `• ${r}`).join('\n')}

🕒 Last Update: ${status.lastUpdate || 'Never'}`;
                
                showDebugOutput(output);
            });

            dialog.querySelector('#debug-sources').addEventListener('click', async () => {
                const sources = await this.sourceDetector.scanAvailableSources();
                
                const output = `🔍 AVAILABLE SCRAPING SOURCES

Found ${sources.length} sources:

${sources.map(source => `
• ${source.name}
  Value: ${source.value}
  Available: ${source.available ? 'Yes' : 'No'}
  Element: ${source.element.tagName}`).join('')}

${sources.length === 0 ? 'No scraping sources detected on this page.' : ''}`;
                
                showDebugOutput(output);
            });

            dialog.querySelector('#debug-history').addEventListener('click', async () => {
                const sceneId = this.statusTracker.extractSceneId();
                const sceneHistory = await this.historyManager.getSceneHistory(sceneId);
                const stats = await this.historyManager.getStatistics();
                
                const currentSceneName = this.statusTracker.extractSceneName();
                const output = `📚 AUTOMATION HISTORY

Current Scene: ${currentSceneName} (ID: ${sceneId})
History: ${sceneHistory.length} entries

${sceneHistory.slice(0, 5).map(entry => `
• ${entry.sceneName || `Scene ${entry.sceneId}`}
  ${new Date(entry.timestamp).toLocaleString()}
  Success: ${entry.success ? '✅ Yes' : '❌ No'}
  Sources: ${entry.sourcesUsed.join(', ') || 'None'}
  ${entry.errors.length > 0 ? '⚠️ Errors: ' + entry.errors.join(', ') : ''}`).join('')}

📊 GLOBAL STATISTICS:
Total Automations: ${stats.totalAutomations}
Success Rate: ${stats.successRate}%
Unique Scenes: ${stats.uniqueScenes}
StashDB Uses: ${stats.sourcesUsed.stashdb}
ThePornDB Uses: ${stats.sourcesUsed.theporndb}
Total Errors: ${stats.errorsCount}`;
                
                showDebugOutput(output);
            });

            dialog.querySelector('#debug-export').addEventListener('click', async () => {
                const exportData = await this.historyManager.exportHistory();
                if (exportData) {
                    const blob = new Blob([exportData], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `automatestash-history-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    
                    showDebugOutput('📤 HISTORY EXPORTED\n\nHistory data has been downloaded as JSON file.');
                } else {
                    showDebugOutput('❌ EXPORT FAILED\n\nCould not export history data.');
                }
            });

            dialog.querySelector('#debug-clear').addEventListener('click', async () => {
                if (confirm('Clear all automation history? This cannot be undone.')) {
                    const success = await this.historyManager.clearHistory();
                    if (success) {
                        showDebugOutput('🗑️ HISTORY CLEARED\n\nAll automation history has been deleted.');
                    } else {
                        showDebugOutput('❌ CLEAR FAILED\n\nCould not clear history data.');
                    }
                }
            });

            // Test button handlers
            dialog.querySelector('#test-minimize').addEventListener('click', () => {
                closeDialog();
                this.testMinimizeFunction();
            });

            dialog.querySelector('#test-context').addEventListener('click', () => {
                this.validateContext();
            });

            dialog.querySelector('#test-buttons').addEventListener('click', () => {
                console.log('🔍 Debug functionality has been removed for cleaner output');
            });

            dialog.querySelector('#test-forms').addEventListener('click', () => {
                console.log('🔍 Debug functionality has been removed for cleaner output');
            });
        }

        testMinimizeFunction() {
            console.log('🧪 Testing minimize functionality...');
            notifications.show('🧪 Testing minimize/expand cycle...', 'info');

            setTimeout(() => {
                this.minimize();
                setTimeout(() => {
                    this.expand();
                    notifications.show('✅ Minimize test completed!', 'success');
                }, 2000);
            }, 1000);
        }

        validateContext() {
            console.log('🔍 Validating context...');
            const tests = [
                { name: 'UIManager Instance', test: () => typeof this !== 'undefined' },
                { name: 'Panel Element', test: () => !!this.panel },
                { name: 'Minimize Method', test: () => typeof this.minimize === 'function' },
                { name: 'DOM Ready', test: () => document.readyState === 'complete' }
            ];

            tests.forEach(test => {
                const result = test.test();
                console.log(`${result ? '✅' : '❌'} ${test.name}: ${result ? 'PASS' : 'FAIL'}`);
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
                console.log('👁️ DOM mutation observer disconnected');
            }
            
            this.panel = null;
            this.minimizedButton = null;
        }


        // ===== ENHANCED STATUS TRACKING =====
        
        /**
         * Initialize status tracking after panel creation
         */
        async initializeStatusTracking() {
            console.log('🔄 Initializing enhanced status tracking...');
            
            try {
                // Set up status update callback
                this.statusTracker.onStatusUpdate(this.updateStatusDisplay.bind(this));
                
                // Detect current scene status
                await this.statusTracker.detectCurrentStatus();
                
                // Create status summary display
                this.createStatusSummary();
                
                // Initialize status widget with current scene status
                await this.initializeStatusWidget();
                
                console.log('✅ Status tracking initialized successfully');
            } catch (error) {
                console.error('❌ Error initializing status tracking:', error);
            }
        }

        async initializeStatusWidget() {
            try {
                console.log('📊 Initializing status display with current scene status...');
                
                // Trigger initial status update
                await this.updateStatusFromDOM();
                
                console.log('📊 Status display initialized');
            } catch (error) {
                console.warn('⚠️ Error initializing status display:', error);
            }
        }

        /**
         * Create and add status summary display to the panel
         */
        createStatusSummary() {
            if (!this.panel) return;
            
            // Remove existing status summary if it exists
            const existing = this.panel.querySelector('#status-summary');
            if (existing) existing.remove();
            
            const statusSummary = document.createElement('div');
            statusSummary.id = 'status-summary';
            statusSummary.style.cssText = `
                background: rgba(255,255,255,0.1);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 15px;
                border: 1px solid rgba(255,255,255,0.2);
            `;
            
            // Initial status display
            this.updateStatusSummaryContent(statusSummary);
            
            // Insert after header but before content
            const header = this.panel.querySelector('h3').closest('div');
            header.parentNode.insertBefore(statusSummary, header.nextSibling);
            
            this.statusSummaryElement = statusSummary;
        }

        /**
         * Update status summary content
         */
        updateStatusSummaryContent(summaryElement) {
            const summary = this.statusTracker.getStatusSummary();
            const completion = this.statusTracker.getCompletionStatus();
            
            summaryElement.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div style="font-weight: 600; font-size: 13px;">${summary.scene.name}</div>
                    <div style="font-size: 12px; opacity: 0.8;">${completion.status}</div>
                </div>
                
                <div style="display: flex; gap: 8px; margin-bottom: 8px;">
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
                
                <div style="background: rgba(255,255,255,0.05); height: 4px; border-radius: 2px; overflow: hidden;">
                    <div style="background: ${completion.color}; height: 100%; width: ${completion.percentage}%; transition: width 0.3s ease;"></div>
                </div>
            `;
        }

        /**
         * Callback for status updates
         */
        updateStatusDisplay(statusSummary) {
            console.log('🔄 Updating status display:', statusSummary);
            
            if (this.statusSummaryElement) {
                this.updateStatusSummaryContent(this.statusSummaryElement);
            }
        }

        /**
         * Save automation result to history
         */
        async saveAutomationResult(result) {
            const sceneId = this.statusTracker.extractSceneId();
            if (!sceneId) {
                console.warn('⚠️ Cannot save automation history: no scene ID found');
                return;
            }

            try {
                const sceneName = this.statusTracker.extractSceneName();
                await this.historyManager.saveAutomationHistory(sceneId, {
                    ...result,
                    sceneName: sceneName,
                    url: window.location.href
                });
                console.log('✅ Automation history saved');
            } catch (error) {
                console.error('❌ Failed to save automation history:', error);
            }
        }

        // ===== AUTOMATION ENGINE =====
        async startAutomation() {
            console.log('🚀 Starting automation...');
            this.updateSceneStatus('🚀 Starting automation...');

            try {
                // Check what's already scraped
                let alreadyScraped = { stashdb: false, theporndb: false };
                if (getConfig(CONFIG.SKIP_ALREADY_SCRAPED)) {
                    alreadyScraped = await this.checkAlreadyScraped();
                    console.log('📋 Already scraped status:', alreadyScraped);
                }

                const needsStashDB = getConfig(CONFIG.AUTO_SCRAPE_STASHDB) && !alreadyScraped.stashdb;
                const needsThePornDB = getConfig(CONFIG.AUTO_SCRAPE_THEPORNDB) && !alreadyScraped.theporndb;

                console.log(`📋 Scraping plan: StashDB=${needsStashDB}, ThePornDB=${needsThePornDB}`);

                if (!needsStashDB && !needsThePornDB) {
                    this.updateSceneStatus('✅ All sources already scraped, organizing...');
                } else {
                    this.updateSceneStatus('🚀 Starting automation workflow...');
                }

                // Run automation steps
                if (needsStashDB) {
                    await this.scrapeStashDB();
                    if (getConfig(CONFIG.AUTO_CREATE_PERFORMERS)) {
                        await this.createNewPerformers();
                    }
                    await this.applyScrapedData();
                }

                if (needsThePornDB) {
                    await this.scrapeThePornDB();
                    if (getConfig(CONFIG.AUTO_CREATE_PERFORMERS)) {
                        await this.createNewPerformers();
                    }
                    await this.applyScrapedData();
                }

                // Save scraped data first
                await this.saveScene();

                // Check organize status before attempting organization
                if (getConfig(CONFIG.AUTO_ORGANIZE)) {
                    // Check current organized status first
                    const isCurrentlyOrganized = await this.checkOrganizedStatus();
                    console.log(`📊 Current organized status: ${isCurrentlyOrganized}`);
                    
                    if (isCurrentlyOrganized) {
                        console.log('✅ Scene is already organized, skipping organization step');
                        this.updateSceneStatus('✅ Already organized');
                    } else {
                        const hasStashDB = alreadyScraped.stashdb || needsStashDB;
                        const hasThePornDB = alreadyScraped.theporndb || needsThePornDB;

                        console.log(`📋 Final scraping status - StashDB: ${hasStashDB}, ThePornDB: ${hasThePornDB}`);

                        if (hasStashDB && hasThePornDB) {
                            console.log('✅ Both sources available, proceeding with organization');
                            
                            // Organize the scene
                            await this.organizeScene();
                            
                            // Save again after organizing
                            await this.saveScene();
                        } else if (hasStashDB || hasThePornDB) {
                            console.log('⚠️ Only one source available, skipping organization');
                            this.updateSceneStatus('⚠️ Skipping organization - need both sources');
                        } else {
                            console.log('❌ No sources available, skipping organization');
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
                        ...(needsStashDB ? ['stashdb'] : []),
                        ...(needsThePornDB ? ['theporndb'] : [])
                    ],
                    stashdb: alreadyScraped.stashdb || needsStashDB,
                    theporndb: alreadyScraped.theporndb || needsThePornDB,
                    organized: getConfig(CONFIG.AUTO_ORGANIZE)
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
                        console.log('🔄 Cleared GraphQL cache after automation');
                    }
                    
                    await this.updateStatusFromDOM();
                    // Update status summary widget
                    if (this.statusSummaryElement) {
                        this.updateStatusSummaryContent(this.statusSummaryElement);
                    }
                    notifications.show('✅ Automation complete!', 'success');
                }, 4000);

            } catch (error) {
                console.error('❌ Automation error:', error);
                this.updateSceneStatus('❌ Automation failed');
                notifications.show('❌ Automation failed: ' + error.message, 'error');

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
            }
        }

        async checkAlreadyScraped() {
            console.log('🔍 Checking already scraped sources...');
            this.updateSceneStatus('🔍 Checking already scraped sources...');

            const result = { stashdb: false, theporndb: false };

            try {
                await this.wait(1000);

                // Enhanced GraphQL-powered detection (highest confidence)
                if (getConfig(CONFIG.ENABLE_CROSS_SCENE_INTELLIGENCE)) {
                    console.log('🧠 Using GraphQL cross-scene intelligence...');
                    
                    try {
                        // Check StashDB via GraphQL
                        const stashdbStatus = await this.sourceDetector.detectStashDBData();
                        if (stashdbStatus.found && stashdbStatus.confidence >= 100) {
                            result.stashdb = true;
                            console.log(`✅ StashDB data detected via GraphQL (${stashdbStatus.confidence}% confidence)`);
                            this.updateSceneStatus('✅ Source detected');
                        }

                        // Check ThePornDB via GraphQL
                        const theporndbStatus = await this.sourceDetector.detectThePornDBData();
                        if (theporndbStatus.found && theporndbStatus.confidence >= 100) {
                            result.theporndb = true;
                            console.log(`✅ ThePornDB data detected via GraphQL (${theporndbStatus.confidence}% confidence)`);
                            this.updateSceneStatus('✅ Source detected');
                        }

                        // If GraphQL detection found sources, return early
                        if (result.stashdb || result.theporndb) {
                            console.log('📊 GraphQL detection complete, skipping DOM fallback');
                            return result;
                        }
                    } catch (graphqlError) {
                        console.warn('⚠️ GraphQL detection failed, falling back to DOM:', graphqlError.message);
                        this.updateSceneStatus('⚠️ GraphQL failed, using DOM fallback...');
                    }
                }

                // Fallback to DOM-based detection (original method)
                console.log('🔍 Using DOM-based source detection...');
                
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
                            console.log('✅ StashDB data detected via DOM');
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
                            console.log('✅ ThePornDB data detected via DOM');
                            break;
                        }
                    }
                    if (result.theporndb) break;
                }

            } catch (error) {
                console.error('❌ Error checking scraped sources:', error);
            }

            console.log('📋 Check complete - StashDB:', result.stashdb, 'ThePornDB:', result.theporndb);
            return result;
        }

        async scrapeStashDB() {
            console.log('🔍 Scraping StashDB...');
            this.updateSceneStatus('🔍 Scraping...');

            const scrapeBtn = this.findScrapeButton();
            if (!scrapeBtn) {
                throw new Error('Scrape button not found');
            }

            scrapeBtn.click();
            await this.wait(1000);

            // Look for StashDB option
            const options = document.querySelectorAll('.dropdown-menu .dropdown-item, a.dropdown-item');
            for (const option of options) {
                if (option.textContent.toLowerCase().includes('stashdb') ||
                    option.textContent.toLowerCase().includes('stash-box')) {
                    console.log('✅ Found StashDB option');
                    option.click();
                    await this.wait(3000);
                    return;
                }
            }

            console.log('⚠️ No StashDB option found');
        }

        async scrapeThePornDB() {
            console.log('🔍 Scraping ThePornDB...');
            this.updateSceneStatus('🔍 Scraping...');

            const scrapeBtn = this.findScrapeButton();
            if (!scrapeBtn) {
                throw new Error('Scrape button not found');
            }

            scrapeBtn.click();
            await this.wait(1000);

            // Look for ThePornDB option
            const options = document.querySelectorAll('.dropdown-menu .dropdown-item, a.dropdown-item');
            for (const option of options) {
                if (option.textContent.toLowerCase().includes('theporndb') ||
                    option.textContent.toLowerCase().includes('tpdb')) {
                    console.log('✅ Found ThePornDB option');
                    option.click();
                    await this.wait(3000);
                    return;
                }
            }

            console.log('⚠️ No ThePornDB option found');
        }

        findScrapeButton() {
            console.log('🔍 Looking for scrape button...');

            const buttons = document.querySelectorAll('button');
            for (const button of buttons) {
                if (button.textContent.toLowerCase().includes('scrape')) {
                    console.log('✅ Found scrape button:', button.textContent.trim());
                    return button;
                }
            }

            console.log('❌ No scrape button found');
            return null;
        }

        async applyScrapedData() {
            console.log('💾 Applying scraped data...');
            this.updateSceneStatus('💾 Applying scraped data...');

            await this.wait(2000);

            const allButtons = document.querySelectorAll('button, .btn, input[type="button"], input[type="submit"]');
            for (const btn of allButtons) {
                const text = btn.textContent || btn.value || '';
                if (text.toLowerCase().includes('apply')) {
                    console.log('✅ Found Apply button:', text.trim());
                    if (!btn.disabled) {
                        btn.click();
                        await this.wait(1500);
                        console.log('✅ Applied scraped data');
                        return;
                    }
                }
            }

            console.log('⚠️ No Apply button found or button disabled');
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
                        console.error('Error creating new entry:', error);
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
                console.log('✅ Scene is already organized, skipping organize click');
                this.updateSceneStatus('✅ Scene already organized');
                return;
            }

            // Find organize button
            const organizedToggle = this.findOrganizedCheckbox();
            if (!organizedToggle) {
                console.error('❌ Could not find organize button');
                this.updateSceneStatus('❌ Organize button not found');
                return;
            }

            // Check button state and only click if not already organized
            if (!organizedToggle.checked) {
                console.log('📁 Clicking organize button...');
                organizedToggle.click();
                await this.wait(1500); // Wait for UI update
                
                // Verify the organization was successful
                const newStatus = await this.checkOrganizedStatus();
                if (newStatus) {
                    console.log('✅ Scene successfully organized');
                    this.updateSceneStatus('✅ Organized');
                } else {
                    console.warn('⚠️ Organization may have failed - status unchanged');
                    this.updateSceneStatus('⚠️ Organization status unclear');
                }
                
                // Update status widget after organize change
                console.log('📊 Updating status widget after organize...');
                await this.updateStatusAfterOrganize();
            } else {
                console.log('✅ Organize button already active');
                this.updateSceneStatus('✅ Scene already organized');
                
                // Still update widget to ensure accuracy
                await this.updateStatusAfterOrganize();
            }
        }

        async updateStatusAfterOrganize() {
            try {
                // Wait longer for organize state to fully update in backend
                console.log('⏳ Waiting for organize state to update in backend...');
                await this.wait(3000);
                
                // Clear GraphQL cache to ensure fresh data
                if (this.sourceDetector && this.sourceDetector.cache) {
                    this.sourceDetector.cache.clear();
                    console.log('🔄 Cleared GraphQL cache');
                }
                
                // Trigger status update from DOM
                await this.updateStatusFromDOM();
                console.log('📊 Status updated after organize');
            } catch (error) {
                console.warn('⚠️ Error updating status after organize:', error);
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
                    console.log('📊 Updating status widget after save...');
                    await this.updateStatusAfterSave();
                    return;
                }
            }
        }

        async updateStatusAfterSave() {
            try {
                // Wait longer for save to fully complete and backend to update
                console.log('⏳ Waiting for save to complete in backend...');
                await this.wait(3000);
                
                // Clear GraphQL cache to ensure fresh data
                if (this.sourceDetector && this.sourceDetector.cache) {
                    this.sourceDetector.cache.clear();
                    console.log('🔄 Cleared GraphQL cache');
                }
                
                // Trigger status update from DOM (will be handled by mutation observer or manually)
                await this.updateStatusFromDOM();
                console.log('📊 Status updated after save');
            } catch (error) {
                console.warn('⚠️ Error updating status after save:', error);
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
                        console.log(`📊 Organized status from GraphQL: ${organizedStatus.organized}`);
                        return organizedStatus.organized;
                    }
                } catch (error) {
                    console.warn('⚠️ GraphQL organized status check failed:', error.message);
                }
            }
            
            // Fallback to DOM-based detection
            const checkbox = this.findOrganizedCheckbox();
            const domStatus = checkbox ? checkbox.checked : false;
            console.log(`📊 Organized status from DOM: ${domStatus}`);
            return domStatus;
        }

        wait(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        async waitForPageRerender() {
            console.log('⏳ Waiting for page re-render after save...');
            
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
                            console.log('📸 Detected thumbnail/image changes');
                            rerenderDetected = true;
                        }
                    }
                    
                    // Look for attribute changes on images (src changes)
                    if (mutation.type === 'attributes' && 
                        mutation.target.tagName === 'IMG' && 
                        mutation.attributeName === 'src') {
                        console.log('🖼️ Detected image src change');
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
                    console.log('📋 No loading indicators found, assuming render complete');
                    break;
                }
            }
            
            // Cleanup observer
            observer.disconnect();
            
            if (rerenderDetected) {
                console.log('✅ Page re-render detected, waiting additional time for completion...');
                await this.wait(1500); // Additional wait for render to complete
            } else if (waitTime >= maxWaitTime) {
                console.log('⏰ Re-render wait timeout reached, proceeding...');
            } else {
                console.log('✅ Page appears stable, proceeding...');
            }
            
            console.log(`⏱️ Total re-render wait time: ${waitTime + (rerenderDetected ? 1500 : 0)}ms`);
        }
    }

    // ===== INITIALIZATION =====
    const uiManager = new UIManager();

    // Initialize UI after DOM is ready
    async function initializeUI() {
        const isScenePage = window.location.href.includes('/scenes/') && !window.location.href.includes('/scenes/markers');
        
        if (isScenePage) {
            // Check if scene is already organized
            await uiManager.wait(1000); // Wait for page to load
            const isOrganized = await uiManager.checkOrganizedStatus();
            
            if (isOrganized) {
                console.log('📁 Scene is already organized, starting minimized');
                uiManager.createMinimizedButton();
                uiManager.isMinimized = true;
            } else {
                console.log('📁 Scene is not organized, showing full panel');
                uiManager.createPanel();
            }
        } else {
            // On non-scene pages, always show minimized button
            console.log('🔧 Non-scene page, showing minimized settings button');
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

    // Global access for debugging
    window.uiManager = uiManager;
    window.expandAutomateStash = () => uiManager.expand();

    console.log('✅ AutomateStash Final initialized successfully');

})();
