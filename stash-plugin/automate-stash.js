/**
 * AutomateStash Plugin for Stash
 * Version: 4.4.0
 * Description: Automated metadata scraping and scene organization for Stash
 * 
 * Converted from userscript to native Stash plugin format
 */

(function () {
    'use strict';

    console.log('🚀 AutomateStash Plugin v4.4.0 - Native Stash plugin with GraphQL API integration');

    // ===== STORAGE HELPER FUNCTIONS =====
    // Replace GM_getValue/GM_setValue with localStorage
    const storage = {
        getValue: function(key, defaultValue) {
            try {
                const value = localStorage.getItem(`automateStash_${key}`);
                if (value === null) return defaultValue;
                return JSON.parse(value);
            } catch (e) {
                return defaultValue;
            }
        },
        setValue: function(key, value) {
            try {
                localStorage.setItem(`automateStash_${key}`, JSON.stringify(value));
            } catch (e) {
                console.error('Failed to save to localStorage:', e);
            }
        },
        deleteValue: function(key) {
            try {
                localStorage.removeItem(`automateStash_${key}`);
            } catch (e) {
                console.error('Failed to delete from localStorage:', e);
            }
        }
    };

    // ===== STASH API CONFIGURATION =====
    const STASH_API = {
        endpoint: '/graphql',
        address: storage.getValue('stash_address', 'http://localhost:9998'),
        apiKey: storage.getValue('stash_api_key', ''),
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
        const value = storage.getValue(key);
        return value !== undefined ? value : DEFAULTS[key];
    }

    function setConfig(key, value) {
        storage.setValue(key, value);
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
            
            return data;
        }