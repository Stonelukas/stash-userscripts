// ==UserScript==
// @name         AutomateStash Final Enhanced
// @version      5.0.0
// @description  AutomateStash with integrated performance monitoring and UI/UX enhancements
// @author       AutomateStash Team
// @match        http://localhost:9998/*
// @exclude      http://localhost:9998/scenes/markers?*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_notification
// @require      file:///home/stonelukas/tools/privat/stash-userscripts/scripts/lib/performance-enhancer.js
// @require      file:///home/stonelukas/tools/privat/stash-userscripts/scripts/lib/cache-manager.js
// @require      file:///home/stonelukas/tools/privat/stash-userscripts/scripts/config/performance-config.js
// ==/UserScript==

(function () {
    'use strict';

    // ===== PERFORMANCE INITIALIZATION =====
    // Initialize performance monitoring if enabled
    const initializePerformance = () => {
        if (window.PerformanceEnhancer && window.performanceConfig.get('enableMonitoring')) {
            console.log('🚀 Performance monitoring enabled for AutomateStash');

            // Listen for performance metrics
            document.addEventListener('performanceMetric', (e) => {
                const metric = e.detail;
                if (metric.executionTime > 100) {
                    console.warn(`⚡ Slow operation detected: ${metric.name} (${metric.executionTime.toFixed(2)}ms)`);
                }
            });

            // Schedule periodic memory cleanup
            setInterval(() => {
                if (window.PerformanceEnhancer) {
                    window.PerformanceEnhancer.cleanupMemory();
                }
            }, 300000); // Every 5 minutes
        }
    };

    // ===== STASH API CONFIGURATION =====
    const STASH_API = {
        endpoint: '/graphql',
        address: GM_getValue('stash_address', 'http://localhost:9998'),
        apiKey: GM_getValue('stash_api_key', ''),
        timeout: 10000
    };

    // Instrument fetch once for GraphQL eventing (used for post-save waits)
    if (!window.__stashFetchInstrumented) {
        window.__stashFetchInstrumented = true;
        const __originalFetch = window.fetch.bind(window);
        window.fetch = async (input, init = {}) => {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            const isGraphQL = url.endsWith(STASH_API.endpoint) || url.includes('/graphql');
            const bodyString = (init && typeof init.body === 'string') ? init.body : null;
            const method = (init && init.method) || 'GET';
            let isMutation = false;
            try {
                if (isGraphQL && method === 'POST' && bodyString) {
                    const payload = JSON.parse(bodyString);
                    const q = (payload && payload.query) || '';
                    isMutation = typeof q === 'string' && q.trim().toLowerCase().startsWith('mutation');
                }
            } catch (_) { }

            // Track GraphQL performance
            const startTime = performance.now();

            try {
                const res = await __originalFetch(input, init);

                // Record performance metric
                if (isGraphQL && window.performanceMonitor) {
                    const duration = performance.now() - startTime;
                    window.performanceMonitor.addMetric({
                        name: isMutation ? 'GraphQL Mutation' : 'GraphQL Query',
                        executionTime: duration,
                        timestamp: Date.now(),
                        type: 'network'
                    });
                }

                if (isGraphQL) {
                    const eventName = isMutation ? 'stash:graphql-mutation' : 'stash:graphql';
                    window.dispatchEvent(new CustomEvent(eventName));
                }
                return res;
            } catch (err) {
                if (isGraphQL) {
                    const eventName = isMutation ? 'stash:graphql-mutation' : 'stash:graphql';
                    window.dispatchEvent(new CustomEvent(eventName));
                }
                throw err;
            }
        };
    }

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
        PREFER_HIGHER_RES_THUMBNAILS: 'preferHigherResThumbnails',
        // Diagnostics
        DEBUG: 'debugMode',
        // Fast click + waits
        FAST_CLICK_SCROLL: 'fastClickScroll',
        VISIBLE_WAIT_TIMEOUT_MS: 'visibleWaitTimeoutMs',
        SCRAPER_OUTCOME_TIMEOUT_MS: 'scraperOutcomeTimeoutMs',
        PREVENT_BACKGROUND_THROTTLING: 'preventBackgroundThrottling',
        NEW_TAB_CONCURRENCY: 'newTabConcurrency',
        // Keyboard shortcuts
        ENABLE_KEYBOARD_SHORTCUTS: 'enableKeyboardShortcuts',
        SHORTCUT_MAP: 'shortcutMap',
        // Performance options
        ENABLE_PERFORMANCE_MONITORING: 'enablePerformanceMonitoring',
        ENABLE_BATCHED_DOM: 'enableBatchedDOM',
        ENABLE_ADVANCED_CACHING: 'enableAdvancedCaching',
        CACHE_TTL_MS: 'cacheTTLMs',
        CACHE_MAX_SIZE: 'cacheMaxSize'
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
        [CONFIG.ENABLE_CROSS_SCENE_INTELLIGENCE]: true,
        [CONFIG.STASH_ADDRESS]: 'http://localhost:9998',
        [CONFIG.STASH_API_KEY]: '',
        [CONFIG.PREFER_HIGHER_RES_THUMBNAILS]: true,
        [CONFIG.DEBUG]: false,
        [CONFIG.FAST_CLICK_SCROLL]: true,
        [CONFIG.VISIBLE_WAIT_TIMEOUT_MS]: 4000,
        [CONFIG.SCRAPER_OUTCOME_TIMEOUT_MS]: 8000,
        [CONFIG.PREVENT_BACKGROUND_THROTTLING]: true,
        [CONFIG.NEW_TAB_CONCURRENCY]: 4,
        [CONFIG.ENABLE_KEYBOARD_SHORTCUTS]: true,
        [CONFIG.SHORTCUT_MAP]: {
            apply: 'Alt+a',
            save: 'Alt+s',
            organize: 'Alt+o',
            toggle: 'Alt+m',
            help: 'Alt+h',
            startRunConfirm: 'Alt+r',
            startRunAuto: 'Alt+Shift+r'
        },
        // Performance defaults
        [CONFIG.ENABLE_PERFORMANCE_MONITORING]: true,
        [CONFIG.ENABLE_BATCHED_DOM]: true,
        [CONFIG.ENABLE_ADVANCED_CACHING]: true,
        [CONFIG.CACHE_TTL_MS]: 300000, // 5 minutes
        [CONFIG.CACHE_MAX_SIZE]: 100
    };

    function getConfig(key) {
        const value = GM_getValue(key);
        return value !== undefined ? value : DEFAULTS[key];
    }

    function setConfig(key, value) {
        GM_setValue(key, value);
    }

    // Initialize performance after config is loaded
    initializePerformance();

    // Attempt to keep timers responsive in background tabs (best effort)
    if (!window.__stashTimerBoost && getConfig(CONFIG.PREVENT_BACKGROUND_THROTTLING)) {
        window.__stashTimerBoost = true;
        try {
            const raf = window.requestAnimationFrame || function (cb) { return setTimeout(cb, 50); };
            const tick = () => { raf(tick); };
            raf(tick);
        } catch (_) { }
    }

    // ===== NOTIFICATION SYSTEM WITH PERFORMANCE TRACKING =====
    class NotificationManager {
        static _recent = new Map(); // message -> timestamp
        static _dedupeMs = 5000;

        async show(message, type = 'info', duration = 4000) {
            if (!getConfig(CONFIG.SHOW_NOTIFICATIONS)) return;

            // Performance tracking for notification rendering
            if (window.PerformanceEnhancer) {
                return await window.PerformanceEnhancer.measure('NotificationRender', async () => {
                    return this._showInternal(message, type, duration);
                });
            } else {
                return this._showInternal(message, type, duration);
            }
        }

        _showInternal(message, type, duration) {
            // Dedupe non-error messages in a short window
            if (type !== 'error') {
                const last = NotificationManager._recent.get(message);
                const now = Date.now();
                if (last && now - last < NotificationManager._dedupeMs) {
                    return;
                }
                NotificationManager._recent.set(message, now);
            }

            // Use batched DOM operations if available
            if (window.domBatch && getConfig(CONFIG.ENABLE_BATCHED_DOM)) {
                window.domBatch.write(() => {
                    this._createNotificationElement(message, type, duration);
                });
            } else {
                this._createNotificationElement(message, type, duration);
            }
        }

        _createNotificationElement(message, type, duration) {
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

            // Use requestAnimationFrame for smooth animations
            requestAnimationFrame(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateX(0)';
            });

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

    // ===== ENHANCED GRAPHQL CLIENT WITH PERFORMANCE MONITORING =====
    class GraphQLClient {
        constructor() {
            this.baseUrl = getConfig(CONFIG.STASH_ADDRESS);
            this.apiKey = getConfig(CONFIG.STASH_API_KEY);
            this.endpoint = `${this.baseUrl}${STASH_API.endpoint}`;

            // Initialize advanced caching if available
            if (window.CacheManager && getConfig(CONFIG.ENABLE_ADVANCED_CACHING)) {
                this.cache = new window.CacheManager({
                    maxSize: getConfig(CONFIG.CACHE_MAX_SIZE),
                    ttl: getConfig(CONFIG.CACHE_TTL_MS),
                    strategy: 'lru'
                });
                console.log('🚀 Advanced caching enabled for GraphQL');
            } else {
                // Fallback to simple cache
                this._inflight = new Map();
                this._cache = new Map();
            }

            this._schemaWatcher = null;
        }

        /**
         * Clear all internal caches
         */
        clear() {
            try {
                if (this.cache && this.cache.clear) {
                    this.cache.clear();
                } else {
                    this._cache.clear();
                    this._inflight.clear();
                }
            } catch (_) { }
        }

        /**
         * Execute GraphQL query with performance monitoring
         */
        async query(query, variables = {}) {
            const queryName = this._extractQueryName(query);

            // Use performance monitoring if available
            if (window.PerformanceEnhancer && getConfig(CONFIG.ENABLE_PERFORMANCE_MONITORING)) {
                return await window.PerformanceEnhancer.measure(`GraphQL:${queryName}`, async () => {
                    return this._executeQuery(query, variables);
                });
            } else {
                return this._executeQuery(query, variables);
            }
        }

        async _executeQuery(query, variables) {
            try {
                const headers = {
                    'Content-Type': 'application/json'
                };

                if (this.apiKey && this.apiKey.length > 0) {
                    headers['ApiKey'] = this.apiKey;
                }

                const controller = new AbortController();
                const timeoutMs = STASH_API.timeout || 10000;
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                let response;
                try {
                    response = await fetch(this.endpoint, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({ query, variables }),
                        signal: controller.signal
                    });
                } finally {
                    clearTimeout(timeoutId);
                }

                if (!response.ok) {
                    throw new Error(`GraphQL request failed: ${response.status}`);
                }

                const result = await response.json();

                if (result.errors) {
                    const message = result.errors.map(e => e.message).join(', ');
                    if (window.schemaWatcher && typeof window.schemaWatcher.analyzeError === 'function') {
                        try { window.schemaWatcher.analyzeError({ message }, query); } catch (_) { }
                    }
                    throw new Error(`GraphQL errors: ${message}`);
                }

                return result.data;
            } catch (error) {
                throw error;
            }
        }

        /**
         * Cached scene details with advanced caching
         */
        async getSceneDetailsCached(sceneId, ttlMs = 5000) {
            if (!sceneId) return null;
            const key = `scene_${sceneId}`;

            // Use advanced cache if available
            if (this.cache && this.cache.get) {
                const cached = await this.cache.get(key);
                if (cached) {
                    return cached;
                }

                const data = await this.getSceneDetails(sceneId);
                await this.cache.set(key, data, { ttl: ttlMs });
                return data;
            }

            // Fallback to simple cache
            const cached = this._cache.get(key);
            const now = Date.now();
            if (cached && cached.expiresAt > now) {
                return cached.data;
            }

            if (this._inflight.has(key)) {
                return this._inflight.get(key);
            }

            const p = (async () => {
                try {
                    const data = await this.getSceneDetails(sceneId);
                    this._cache.set(key, { data, expiresAt: now + ttlMs });
                    return data;
                } finally {
                    this._inflight.delete(key);
                }
            })();

            this._inflight.set(key, p);
            return p;
        }

        /**
         * Extract query name for performance tracking
         */
        _extractQueryName(query) {
            const match = query.match(/(?:query|mutation)\s+(\w+)/);
            return match ? match[1] : 'Unknown';
        }

        // ... (rest of the GraphQLClient methods remain the same)
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

        async findDuplicateScenes({ distance = 0, durationDiff = -1 } = {}) {
            // Use advanced cache for duplicate detection
            const cacheKey = `duplicates_${distance}_${durationDiff}`;

            if (this.cache && this.cache.get) {
                const cached = await this.cache.get(cacheKey);
                if (cached) return cached;
            }

            const query = `
                query FindDuplicateScenes($distance: Int, $duration_diff: Float) {
                  findDuplicateScenes(distance: $distance, duration_diff: $duration_diff) {
                    id
                    title
                    paths { sprite screenshot }
                    studio { name }
                    organized
                    tags { id name }
                    performers { id name }
                    files { id size width height bit_rate video_codec duration path }
                  }
                }
            `;

            const variables = { distance, duration_diff: durationDiff };
            const data = await this.query(query, variables);
            const result = data?.findDuplicateScenes ?? [];

            if (this.cache && this.cache.set) {
                await this.cache.set(cacheKey, result, { ttl: 30000 });
            }

            return result;
        }

        async getSceneForMerge(id) {
            const query = `
                query($id: ID!){
                  findScene(id:$id){
                    id
                    title
                    code
                    details
                    director
                    urls
                    date
                    rating100
                    organized
                    studio { id }
                    performers { id }
                    tags { id }
                    groups { group { id } scene_index }
                    galleries { id }
                    files { id size width height duration path }
                  }
                }
            `;
            const res = await this.query(query, { id });
            return res?.findScene || null;
        }

        async sceneMerge({ destination, source, values = null, play_history = true, o_history = true }) {
            const mutation = `
                mutation($input: SceneMergeInput!){
                  sceneMerge(input:$input){ id }
                }
            `;
            const input = { destination, source, play_history, o_history };
            if (values) {
                if (!values.id) values.id = String(destination);
                input.values = values;
            }
            const res = await this.query(mutation, { input });

            // Clear cache after merge
            if (this.cache && this.cache.clear) {
                this.cache.clear();
            } else if (this._dupeCache) {
                this._dupeCache.clear();
            }

            return res?.sceneMerge?.id || null;
        }

        getCurrentSceneId() {
            const url = window.location.href;
            const match = url.match(/\/scenes\/(\d+)/);
            return match ? match[1] : null;
        }
    }

    const graphqlClient = new GraphQLClient();

    // ===== STATUS TRACKING INITIALIZATION =====
    const sourceDetector = new SourceDetector();
    const statusTracker = new StatusTracker(sourceDetector);
    const historyManager = new HistoryManager();
    const summaryWidget = new AutomationSummaryWidget();

    // ===== ENHANCED UI MANAGER WITH PERFORMANCE =====
    class UIManager {
        constructor() {
            this.panel = null;
            this.minimizedButton = null;
            this.isMinimized = false;
            this.statusElement = null;
            this.automationInProgress = false;
            this.automationCancelled = false;
            this.rescrapeOptions = {
                forceRescrape: false,
                rescrapeStashDB: false,
                rescrapeThePornDB: false
            };
            this.sourceDetector = sourceDetector;
            this.statusTracker = statusTracker;
            this.historyManager = historyManager;
            this.summaryWidget = summaryWidget;
        }

        async initialize() {
            // Performance-enhanced initialization
            if (window.PerformanceEnhancer && getConfig(CONFIG.ENABLE_PERFORMANCE_MONITORING)) {
                await window.PerformanceEnhancer.measure('UIInitialization', async () => {
                    this.createPanel();
                    await this.statusTracker.detectCurrentStatus();
                });
            } else {
                this.createPanel();
                await this.statusTracker.detectCurrentStatus();
            }
        }

        createPanel() {
            if (this.panel) return;

            // Use batched DOM operations if available
            const createPanelDOM = () => {
                this.panel = document.createElement('div');
                this.panel.id = 'stash-automation-panel';
                this.panel.style.cssText = `
                    position: fixed;
                    top: 50px;
                    right: 20px;
                    width: 320px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    border-radius: 15px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                    z-index: 10000;
                    font-family: 'Segoe UI', sans-serif;
                    backdrop-filter: blur(10px);
                    border: 2px solid rgba(255,255,255,0.1);
                `;

                const header = this.createHeader();
                const content = this.createContent();
                const buttons = this.createButtons();

                this.panel.appendChild(header);
                this.panel.appendChild(content);
                this.panel.appendChild(buttons);

                document.body.appendChild(this.panel);
            };

            if (window.domBatch && getConfig(CONFIG.ENABLE_BATCHED_DOM)) {
                window.domBatch.write(createPanelDOM);
            } else {
                createPanelDOM();
            }
        }

        createHeader() {
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                cursor: move;
            `;

            const title = document.createElement('h3');
            title.textContent = 'AutomateStash Enhanced v5.0.0 🚀';
            title.style.cssText = `
                color: white;
                margin: 0;
                font-size: 16px;
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
            `;
            minimizeBtn.addEventListener('click', () => this.minimize());

            header.appendChild(title);
            header.appendChild(minimizeBtn);
            return header;
        }

        createContent() {
            const content = document.createElement('div');

            this.statusElement = document.createElement('div');
            this.statusElement.style.cssText = `
                background: rgba(255,255,255,0.1);
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 15px;
                text-align: center;
            `;
            this.statusElement.textContent = '⚡ Ready (Performance Mode)';

            content.appendChild(this.statusElement);
            return content;
        }

        createButtons() {
            const buttons = document.createElement('div');
            buttons.style.cssText = `
                display: flex;
                gap: 10px;
                justify-content: center;
            `;

            const startBtn = document.createElement('button');
            startBtn.innerHTML = '🚀 Start Enhanced Automation';
            startBtn.style.cssText = `
                background: #27ae60;
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                flex: 1;
            `;
            startBtn.addEventListener('click', () => this.startAutomation());

            buttons.appendChild(startBtn);
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
            if (this.minimizedButton) return;

            this.minimizedButton = document.createElement('button');
            this.minimizedButton.innerHTML = '🚀';
            this.minimizedButton.style.cssText = `
                position: fixed;
                top: 50px;
                right: 20px;
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
            `;
            this.minimizedButton.addEventListener('click', () => this.expand());
            document.body.appendChild(this.minimizedButton);
        }

        expand() {
            if (this.minimizedButton) {
                this.minimizedButton.remove();
                this.minimizedButton = null;
            }
            if (this.panel) {
                this.panel.style.display = 'block';
            }
            this.isMinimized = false;
        }

        async startAutomation() {
            if (this.automationInProgress) return;

            this.automationInProgress = true;
            this.automationCancelled = false;

            // Show cancel button
            this.showCancelButton();

            const startTime = performance.now();

            try {
                // Track with performance monitoring
                if (window.PerformanceEnhancer) {
                    await window.PerformanceEnhancer.measure('FullAutomation', async () => {
                        await this.runAutomationSteps();
                    });
                } else {
                    await this.runAutomationSteps();
                }

                const duration = performance.now() - startTime;
                
                // Record performance metric
                if (window.performanceMonitor) {
                    window.performanceMonitor.addMetric({
                        name: 'AutomationComplete',
                        executionTime: duration,
                        timestamp: Date.now(),
                        type: 'automation'
                    });
                }

                if (!this.automationCancelled) {
                    notifications.show(`✅ Automation completed in ${(duration/1000).toFixed(2)}s`, 'success');
                }
                
                // Save to history
                await this.historyManager.saveAutomationHistory(
                    graphqlClient.getCurrentSceneId(),
                    {
                        success: !this.automationCancelled,
                        duration: duration,
                        sourcesUsed: ['enhanced'],
                        sceneName: 'Current Scene'
                    }
                );

            } catch (error) {
                if (!this.automationCancelled) {
                    notifications.show(`❌ Automation failed: ${error.message}`, 'error');
                }
                
                await this.historyManager.saveAutomationHistory(
                    graphqlClient.getCurrentSceneId(),
                    {
                        success: false,
                        errors: [error.message],
                        sceneName: 'Current Scene'
                    }
                );
            } finally {
                this.automationInProgress = false;
                this.hideCancelButton();
                this.updateStatus('⚡ Ready');
            }
        }
        
        showCancelButton() {
            if (this.cancelButton) return;
            
            this.cancelButton = document.createElement('button');
            this.cancelButton.innerHTML = '⛔ Cancel Automation';
            this.cancelButton.style.cssText = `
                position: fixed;
                top: 110px;
                right: 20px;
                z-index: 10001;
                background: #e74c3c;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-family: 'Segoe UI', sans-serif;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            `;
            
            this.cancelButton.addEventListener('click', () => {
                this.automationCancelled = true;
                notifications.show('🛑 Automation cancelled', 'warning');
                this.hideCancelButton();
            });
            
            document.body.appendChild(this.cancelButton);
        }
        
        hideCancelButton() {
            if (this.cancelButton) {
                this.cancelButton.remove();
                this.cancelButton = null;
            }
        }

        async runAutomationSteps() {
            // Full automation workflow with performance monitoring
            const sceneId = graphqlClient.getCurrentSceneId();
            const sceneName = document.querySelector('.scene-header h3')?.textContent || 'Scene';
            
            // Start tracking
            this.summaryWidget.startTracking(sceneName, sceneId);
            
            try {
                // Step 1: Check if already scraped
                if (getConfig(CONFIG.SKIP_ALREADY_SCRAPED) && !this.rescrapeOptions.forceRescrape) {
                    this.updateStatus('🔍 Checking existing data...');
                    const alreadyScraped = await this.checkAlreadyScraped();
                    
                    if (alreadyScraped.stashdb && alreadyScraped.theporndb) {
                        this.updateStatus('✅ Scene already fully scraped');
                        notifications.show('Scene already has data from both sources', 'info');
                        
                        // Show re-scrape UI
                        await this.showRescrapeOptions(alreadyScraped);
                        
                        if (!this.rescrapeOptions.forceRescrape) {
                            return;
                        }
                    }
                }
                
                // Step 2: Open edit panel if needed
                if (!document.querySelector('.entity-edit-panel, .scene-edit-details')) {
                    this.updateStatus('📝 Opening edit panel...');
                    const opened = await this.openEditPanel();
                    if (!opened) {
                        throw new Error('Failed to open edit panel');
                    }
                    await this.sleep(500);
                }
                
                // Step 3: Scrape from StashDB
                if (getConfig(CONFIG.AUTO_SCRAPE_STASHDB)) {
                    if (!this.rescrapeOptions.forceRescrape || this.rescrapeOptions.rescrapeStashDB) {
                        const stashResult = await this.scrapeStashDB();
                        if (stashResult.found) {
                            await this.sleep(1000);
                            
                            // Apply if auto-apply is enabled
                            if (getConfig(CONFIG.AUTO_APPLY_CHANGES)) {
                                await this.applyScrapedData();
                                await this.sleep(500);
                            }
                        }
                    }
                }
                
                if (this.automationCancelled) throw new Error('Automation cancelled');
                
                // Step 4: Scrape from ThePornDB
                if (getConfig(CONFIG.AUTO_SCRAPE_THEPORNDB)) {
                    if (!this.rescrapeOptions.forceRescrape || this.rescrapeOptions.rescrapeThePornDB) {
                        const porndbResult = await this.scrapeThePornDB();
                        if (porndbResult.found) {
                            await this.sleep(1000);
                            
                            // Apply if auto-apply is enabled
                            if (getConfig(CONFIG.AUTO_APPLY_CHANGES)) {
                                await this.applyScrapedData();
                                await this.sleep(500);
                            }
                        }
                    }
                }
                
                if (this.automationCancelled) throw new Error('Automation cancelled');
                
                // Step 5: Create new performers/studios/tags
                if (getConfig(CONFIG.AUTO_CREATE_PERFORMERS)) {
                    await this.createNewPerformers();
                    await this.sleep(500);
                }
                
                if (this.automationCancelled) throw new Error('Automation cancelled');
                
                // Step 6: Organize scene
                if (getConfig(CONFIG.AUTO_ORGANIZE)) {
                    await this.organizeScene();
                    await this.sleep(500);
                }
                
                if (this.automationCancelled) throw new Error('Automation cancelled');
                
                // Step 7: Save scene
                await this.saveScene();
                await this.sleep(1000);
                
                // Step 8: Update status tracking
                await this.statusTracker.detectCurrentStatus();
                
                this.updateStatus('✅ Automation complete!');
                this.summaryWidget.finishTracking(true);
                
                // Reset re-scrape options
                this.rescrapeOptions = {
                    forceRescrape: false,
                    rescrapeStashDB: false,
                    rescrapeThePornDB: false
                };
                
                // Minimize if configured
                if (getConfig(CONFIG.MINIMIZE_WHEN_COMPLETE)) {
                    setTimeout(() => this.minimize(), 2000);
                }
                
            } catch (error) {
                this.updateStatus('❌ Automation failed');
                this.summaryWidget.finishTracking(false);
                throw error;
            }
        }
        
        async showRescrapeOptions(alreadyScraped) {
            // Create re-scrape dialog
            return new Promise((resolve) => {
                const dialog = document.createElement('div');
                dialog.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    border-radius: 10px;
                    z-index: 10001;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                    min-width: 300px;
                `;
                
                dialog.innerHTML = `
                    <h4>Scene Already Scraped</h4>
                    <p>This scene has data from:</p>
                    <div style="margin: 10px 0;">
                        ${alreadyScraped.stashdb ? '✅ StashDB' : '❌ StashDB'}<br>
                        ${alreadyScraped.theporndb ? '✅ ThePornDB' : '❌ ThePornDB'}
                    </div>
                    <p>Do you want to re-scrape?</p>
                    <div style="margin: 15px 0;">
                        <label style="display: block; margin: 5px 0;">
                            <input type="checkbox" id="rescrape-stashdb" ${!alreadyScraped.stashdb ? 'checked' : ''}>
                            Re-scrape StashDB
                        </label>
                        <label style="display: block; margin: 5px 0;">
                            <input type="checkbox" id="rescrape-theporndb" ${!alreadyScraped.theporndb ? 'checked' : ''}>
                            Re-scrape ThePornDB
                        </label>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button id="rescrape-continue" style="padding: 8px 16px; background: #27ae60; border: none; color: white; border-radius: 5px; cursor: pointer;">
                            Continue
                        </button>
                        <button id="rescrape-skip" style="padding: 8px 16px; background: #e74c3c; border: none; color: white; border-radius: 5px; cursor: pointer;">
                            Skip
                        </button>
                    </div>
                `;
                
                document.body.appendChild(dialog);
                
                document.getElementById('rescrape-continue').addEventListener('click', () => {
                    this.rescrapeOptions.forceRescrape = true;
                    this.rescrapeOptions.rescrapeStashDB = document.getElementById('rescrape-stashdb').checked;
                    this.rescrapeOptions.rescrapeThePornDB = document.getElementById('rescrape-theporndb').checked;
                    dialog.remove();
                    resolve();
                });
                
                document.getElementById('rescrape-skip').addEventListener('click', () => {
                    this.rescrapeOptions.forceRescrape = false;
                    dialog.remove();
                    resolve();
                });
            });
        }

        updateStatus(status) {
            if (this.statusElement) {
                this.statusElement.textContent = status;
            }
        }

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        // ===== CORE AUTOMATION METHODS (From AutomateStash-Final.js) =====
        // These methods are wrapped with performance monitoring

        /**
         * Wait for element with performance tracking
         * @param {string[]} selectors
         * @param {{timeout?: number, root?: Element}} opts
         */
        async waitForElement(selectors, opts = {}) {
            if (window.PerformanceEnhancer && getConfig(CONFIG.ENABLE_PERFORMANCE_MONITORING)) {
                return await window.PerformanceEnhancer.measure('WaitForElement', async () => {
                    return this._waitForElementInternal(selectors, opts);
                });
            }
            return this._waitForElementInternal(selectors, opts);
        }

        async _waitForElementInternal(selectors, opts = {}) {
            const timeout = opts.timeout ?? 5000;
            const root = opts.root ?? document;

            const find = () => {
                for (const sel of selectors) {
                    const el = root.querySelector(sel);
                    if (el) return el;
                }
                return null;
            };

            const immediate = find();
            if (immediate) return immediate;

            return new Promise((resolve, reject) => {
                let settled = false;
                let to;
                const cleanup = () => {
                    try { observer.disconnect(); } catch (_) { }
                    if (to) { clearTimeout(to); to = undefined; }
                };
                const observer = new MutationObserver(() => {
                    if (this && (this.automationCancelled || this.skipCurrentSourceRequested)) {
                        if (!settled) {
                            settled = true;
                            cleanup();
                            const reason = this.skipCurrentSourceRequested ? 'skip requested' : 'Automation cancelled';
                            reject(new Error(reason));
                        }
                        return;
                    }
                    const el = find();
                    if (el && !settled) {
                        settled = true;
                        cleanup();
                        resolve(el);
                    }
                });
                observer.observe(root === document ? document.documentElement : root, {
                    childList: true,
                    subtree: true
                });

                to = setTimeout(() => {
                    if (!settled) {
                        settled = true;
                        cleanup();
                        reject(new Error('waitForElement timeout'));
                    }
                }, timeout);
            });
        }

        /**
         * Wait for visible element
         */
        async waitForVisibleElement(selectors, opts = {}) {
            const timeout = opts.timeout ?? getConfig(CONFIG.VISIBLE_WAIT_TIMEOUT_MS);
            const root = opts.root ?? document;
            
            const found = await this.waitForElement(selectors, { timeout, root });
            if (!found) throw new Error('Element not found');
            
            // Check if visible
            const rect = found.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                return found;
            }
            
            // Wait for visibility
            const start = Date.now();
            while (Date.now() - start < 2000) {
                const rect = found.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    return found;
                }
                await this.sleep(100);
            }
            
            return found; // Return even if not visible
        }

        /**
         * Fast click with performance tracking
         */
        async clickFast(selectorsOrElement, opts = {}) {
            if (window.PerformanceEnhancer && getConfig(CONFIG.ENABLE_PERFORMANCE_MONITORING)) {
                return await window.PerformanceEnhancer.measure('ClickFast', async () => {
                    return this._clickFastInternal(selectorsOrElement, opts);
                });
            }
            return this._clickFastInternal(selectorsOrElement, opts);
        }

        async _clickFastInternal(selectorsOrElement, opts = {}) {
            const el = (selectorsOrElement instanceof Element)
                ? selectorsOrElement
                : await this.waitForVisibleElement([].concat(selectorsOrElement), opts);
            if (!el) throw new Error('clickFast: element not found');
            el.focus({ preventScroll: true });
            el.click();
            return el;
        }

        /**
         * Detect scraper outcome
         */
        async detectScraperOutcome(timeoutMs = 8000) {
            if (window.PerformanceEnhancer && getConfig(CONFIG.ENABLE_PERFORMANCE_MONITORING)) {
                return await window.PerformanceEnhancer.measure('DetectScraperOutcome', async () => {
                    return this._detectScraperOutcomeInternal(timeoutMs);
                });
            }
            return this._detectScraperOutcomeInternal(timeoutMs);
        }

        async _detectScraperOutcomeInternal(timeoutMs) {
            const start = Date.now();
            const endBy = start + timeoutMs;

            const negativeSelectors = [
                '.toast.show, .Toastify__toast, .alert, .notification',
                '.modal.show .modal-body',
                '.empty, .no-results, .text-muted, .text-warning'
            ];
            const negativeTexts = [
                'no results', 'no matches', 'not found', 'nothing found',
                'failed', 'error', 'could not', 'unable to', 'empty'
            ];

            const positiveSelectors = [
                '.modal.show .modal-dialog',
                '.entity-edit-panel', '.scene-edit-details', '.edit-panel'
            ];

            // Quick positive check
            for (const sel of positiveSelectors) {
                if (document.querySelector(sel)) return { found: true };
            }

            // Poll for outcome
            while (Date.now() < endBy) {
                if (this.skipCurrentSourceRequested) {
                    return { found: false, reason: 'user skipped' };
                }
                
                // Positive signals
                for (const sel of positiveSelectors) {
                    if (document.querySelector(sel)) return { found: true };
                }
                
                // Negative signals
                for (const sel of negativeSelectors) {
                    const nodes = document.querySelectorAll(sel);
                    for (const n of nodes) {
                        const text = (n.textContent || '').toLowerCase();
                        if (!text) continue;
                        if (negativeTexts.some(t => text.includes(t))) {
                            return { found: false, reason: text.slice(0, 200) };
                        }
                    }
                }
                await this.sleep(150);
            }
            
            return { found: false, reason: 'timeout waiting for scraper outcome' };
        }

        /**
         * Check if scene already scraped
         */
        async checkAlreadyScraped() {
            if (window.PerformanceEnhancer && getConfig(CONFIG.ENABLE_PERFORMANCE_MONITORING)) {
                return await window.PerformanceEnhancer.measure('CheckAlreadyScraped', async () => {
                    return this._checkAlreadyScrapedInternal();
                });
            }
            return this._checkAlreadyScrapedInternal();
        }

        async _checkAlreadyScrapedInternal() {
            // Check for existing metadata in the edit panel
            const hasStashDB = await this._checkForStashDBData();
            const hasThePornDB = await this._checkForThePornDBData();
            
            return { 
                stashdb: hasStashDB, 
                theporndb: hasThePornDB 
            };
        }
        
        async _checkForStashDBData() {
            // Check for StashDB data indicators
            try {
                // Check for stash IDs in the scene
                const sceneId = graphqlClient.getCurrentSceneId();
                if (sceneId) {
                    const scene = await graphqlClient.getSceneDetailsCached(sceneId);
                    if (scene && scene.stash_ids && scene.stash_ids.length > 0) {
                        for (const stashId of scene.stash_ids) {
                            if (stashId.endpoint && stashId.endpoint.includes('stashdb')) {
                                return true;
                            }
                        }
                    }
                }
                
                // Check for StashDB indicator in UI
                const indicators = document.querySelectorAll('.scene-stash-id, .stashdb-link, [data-source="stashdb"]');
                if (indicators.length > 0) {
                    return true;
                }
                
                // Check for filled metadata that typically comes from StashDB
                const titleInput = document.querySelector('input[name="title"], input[placeholder*="Title"]');
                const studioInput = document.querySelector('.studio-select, input[placeholder*="Studio"]');
                const performersInput = document.querySelector('.performer-select, input[placeholder*="Performer"]');
                
                if (titleInput && titleInput.value && studioInput && performersInput) {
                    // If we have a title, studio, and performers, likely scraped
                    const hasStudio = studioInput.value || studioInput.textContent;
                    const hasPerformers = performersInput.value || document.querySelectorAll('.performer-tag').length > 0;
                    
                    if (hasStudio && hasPerformers) {
                        return true;
                    }
                }
                
            } catch (error) {
                console.log('Error checking StashDB data:', error);
            }
            
            return false;
        }
        
        async _checkForThePornDBData() {
            // Check for ThePornDB data indicators
            try {
                // Check for specific ThePornDB metadata patterns
                const sceneId = graphqlClient.getCurrentSceneId();
                if (sceneId) {
                    const scene = await graphqlClient.getSceneDetailsCached(sceneId);
                    if (scene && scene.details) {
                        // ThePornDB often includes specific formatting in details
                        if (scene.details.includes('theporndb') || 
                            scene.details.includes('metadataapi') ||
                            scene.details.includes('TPDB')) {
                            return true;
                        }
                    }
                }
                
                // Check for ThePornDB indicator in UI
                const indicators = document.querySelectorAll('.theporndb-link, [data-source="theporndb"], [data-source="metadataapi"]');
                if (indicators.length > 0) {
                    return true;
                }
                
                // Check for typical ThePornDB metadata patterns
                const codeInput = document.querySelector('input[name="code"], input[placeholder*="Code"]');
                const directorInput = document.querySelector('input[name="director"], input[placeholder*="Director"]');
                
                if (codeInput && codeInput.value) {
                    // Scene code is often from ThePornDB
                    return true;
                }
                
                if (directorInput && directorInput.value) {
                    // Director field is often from ThePornDB
                    return true;
                }
                
            } catch (error) {
                console.log('Error checking ThePornDB data:', error);
            }
            
            return false;
        }

        /**
         * Scrape from StashDB
         */
        async scrapeStashDB() {
            if (window.PerformanceEnhancer && getConfig(CONFIG.ENABLE_PERFORMANCE_MONITORING)) {
                return await window.PerformanceEnhancer.measure('ScrapeStashDB', async () => {
                    return this._scrapeStashDBInternal();
                });
            }
            return this._scrapeStashDBInternal();
        }

        async _scrapeStashDBInternal() {
            this.updateStatus('🔍 Scraping StashDB...');

            if (this.automationCancelled) throw new Error('Automation cancelled');

            const scrapeBtn = this.findScrapeButton();
            if (!scrapeBtn) throw new Error('Scrape button not found');

            await this.clickFast(scrapeBtn);

            // Wait for dropdown
            try {
                await this.waitForElement(['.dropdown-menu.show .dropdown-item', '.dropdown-menu .dropdown-item'], { timeout: 3000 });
            } catch (_) {
                // Continue
            }

            if (this.automationCancelled) throw new Error('Automation cancelled');

            const options = document.querySelectorAll('.dropdown-menu .dropdown-item, a.dropdown-item');
            for (const option of options) {
                const t = option.textContent.toLowerCase();
                if (t.includes('stashdb') || t.includes('stash-box')) {
                    await this.clickFast(option);
                    break;
                }
            }

            // Wait for modal/edit form
            try {
                await this.waitForElement(['.modal.show .modal-dialog', '.entity-edit-panel', '.scene-edit-details'], { timeout: 7000 });
            } catch (_) {
                // Continue
            }

            // Detect outcome
            const outcome = await this.detectScraperOutcome();
            if (!outcome.found) {
                notifications.show(`StashDB scraper found no scene`, 'warning');
                return { found: false };
            }
            return { found: true };
        }

        /**
         * Scrape from ThePornDB
         */
        async scrapeThePornDB() {
            if (window.PerformanceEnhancer && getConfig(CONFIG.ENABLE_PERFORMANCE_MONITORING)) {
                return await window.PerformanceEnhancer.measure('ScrapeThePornDB', async () => {
                    return this._scrapeThePornDBInternal();
                });
            }
            return this._scrapeThePornDBInternal();
        }

        async _scrapeThePornDBInternal() {
            this.updateStatus('🔍 Scraping ThePornDB...');

            if (this.automationCancelled) throw new Error('Automation cancelled');

            const scrapeBtn = this.findScrapeButton();
            if (!scrapeBtn) throw new Error('Scrape button not found');

            await this.clickFast(scrapeBtn);

            // Wait for dropdown
            try {
                await this.waitForElement(['.dropdown-menu.show .dropdown-item', '.dropdown-menu .dropdown-item'], { timeout: 3000 });
            } catch (_) {
                // Continue
            }

            if (this.automationCancelled) throw new Error('Automation cancelled');

            const options = document.querySelectorAll('.dropdown-menu .dropdown-item, a.dropdown-item');
            for (const option of options) {
                const t = option.textContent.toLowerCase();
                if (t.includes('porndb') || t.includes('theporndb') || t.includes('metadataapi')) {
                    await this.clickFast(option);
                    break;
                }
            }

            // Wait for modal/edit form
            try {
                await this.waitForElement(['.modal.show .modal-dialog', '.entity-edit-panel', '.scene-edit-details'], { timeout: 7000 });
            } catch (_) {
                // Continue
            }

            // Detect outcome
            const outcome = await this.detectScraperOutcome();
            if (!outcome.found) {
                notifications.show(`ThePornDB scraper found no scene`, 'warning');
                return { found: false };
            }
            return { found: true };
        }

        /**
         * Find scrape button
         */
        findScrapeButton() {
            const selectors = [
                'button[title*="Scrape"]',
                'button[data-rb-event-key*="scrape"]',
                '.scene-toolbar button:has(.fa-search)',
                'button:has(.fa-search)'
            ];

            for (const sel of selectors) {
                const btn = document.querySelector(sel);
                if (btn && !btn.disabled) return btn;
            }
            return null;
        }

        /**
         * Find apply button
         */
        findApplyButton() {
            const selectors = [
                '.modal.show button.btn-primary',
                '.modal.show button:contains("Apply")',
                '.edit-panel button.btn-primary',
                'button.ml-2.btn.btn-primary'
            ];

            for (const sel of selectors) {
                try {
                    const btn = document.querySelector(sel);
                    if (btn && !btn.disabled) {
                        const text = btn.textContent.toLowerCase();
                        if (text.includes('apply') || text.includes('save')) {
                            return btn;
                        }
                    }
                } catch (_) {
                    // Continue
                }
            }
            return null;
        }

        /**
         * Open edit panel
         */
        async openEditPanel() {
            if (window.PerformanceEnhancer && getConfig(CONFIG.ENABLE_PERFORMANCE_MONITORING)) {
                return await window.PerformanceEnhancer.measure('OpenEditPanel', async () => {
                    return this._openEditPanelInternal();
                });
            }
            return this._openEditPanelInternal();
        }

        async _openEditPanelInternal() {
            // Check if already open
            if (document.querySelector('.entity-edit-panel, .scene-edit-details')) {
                return true;
            }

            // Find edit button
            const editBtn = document.querySelector('button[title="Edit"], .scene-toolbar button:has(.fa-edit)');
            if (!editBtn) return false;

            await this.clickFast(editBtn);
            
            // Wait for panel
            try {
                await this.waitForElement(['.entity-edit-panel', '.scene-edit-details'], { timeout: 3000 });
                return true;
            } catch (_) {
                return false;
            }
        }

        /**
         * Apply scraped data
         */
        async applyScrapedData() {
            if (window.PerformanceEnhancer && getConfig(CONFIG.ENABLE_PERFORMANCE_MONITORING)) {
                return await window.PerformanceEnhancer.measure('ApplyScrapedData', async () => {
                    return this._applyScrapedDataInternal();
                });
            }
            return this._applyScrapedDataInternal();
        }

        async _applyScrapedDataInternal() {
            this.updateStatus('💾 Applying scraped data...');

            const applyBtn = this.findApplyButton();
            if (!applyBtn) {
                notifications.show('Apply button not found', 'warning');
                return false;
            }

            await this.clickFast(applyBtn);
            await this.sleep(1000); // Wait for data to apply

            return true;
        }

        /**
         * Create new performers/studios/tags
         */
        async createNewPerformers() {
            if (window.PerformanceEnhancer && getConfig(CONFIG.ENABLE_PERFORMANCE_MONITORING)) {
                return await window.PerformanceEnhancer.measure('CreateNewPerformers', async () => {
                    return this._createNewPerformersInternal();
                });
            }
            return this._createNewPerformersInternal();
        }

        async _createNewPerformersInternal() {
            if (!getConfig(CONFIG.AUTO_CREATE_PERFORMERS)) return;

            this.updateStatus('👥 Creating new performers/studios/tags...');

            // Find all create buttons (plus icons)
            const createButtons = document.querySelectorAll('.entity-edit-panel button:has(.fa-plus), .scene-edit-details button:has(.fa-plus)');
            
            for (const btn of createButtons) {
                if (btn.disabled) continue;
                await this.clickFast(btn);
                await this.sleep(500);
            }

            return true;
        }

        /**
         * Organize scene
         */
        async organizeScene() {
            if (window.PerformanceEnhancer && getConfig(CONFIG.ENABLE_PERFORMANCE_MONITORING)) {
                return await window.PerformanceEnhancer.measure('OrganizeScene', async () => {
                    return this._organizeSceneInternal();
                });
            }
            return this._organizeSceneInternal();
        }

        async _organizeSceneInternal() {
            if (!getConfig(CONFIG.AUTO_ORGANIZE)) return false;

            this.updateStatus('📁 Organizing scene...');

            // Find organize button
            const organizeBtn = document.querySelector('button[title="Organized"]');
            if (!organizeBtn) {
                console.log('Organize button not found');
                return false;
            }

            // Check if already organized
            const isActive = organizeBtn.classList.contains('active') || organizeBtn.classList.contains('btn-primary');
            if (!isActive) {
                await this.clickFast(organizeBtn);
            }

            return true;
        }

        /**
         * Save scene
         */
        async saveScene() {
            if (window.PerformanceEnhancer && getConfig(CONFIG.ENABLE_PERFORMANCE_MONITORING)) {
                return await window.PerformanceEnhancer.measure('SaveScene', async () => {
                    return this._saveSceneInternal();
                });
            }
            return this._saveSceneInternal();
        }

        async _saveSceneInternal() {
            this.updateStatus('💾 Saving scene...');

            // Find save button
            const saveSelectors = [
                '.edit-panel button.btn-primary',
                'button.ml-2.btn.btn-primary',
                '.entity-edit-panel button.btn-primary',
                'button:contains("Save")'
            ];

            let saveBtn = null;
            for (const sel of saveSelectors) {
                try {
                    const btn = document.querySelector(sel);
                    if (btn && !btn.disabled) {
                        const text = btn.textContent.toLowerCase();
                        if (text.includes('save')) {
                            saveBtn = btn;
                            break;
                        }
                    }
                } catch (_) {
                    // Continue
                }
            }

            if (!saveBtn) {
                notifications.show('Save button not found', 'warning');
                return false;
            }

            await this.clickFast(saveBtn);
            await this.sleep(1500); // Wait for save

            return true;
        }
    }

    // ===== KEYBOARD SHORTCUTS =====
    class KeyboardShortcuts {
        constructor(uiManager) {
            this.uiManager = uiManager;
            this.shortcuts = getConfig(CONFIG.SHORTCUT_MAP);
            this.enabled = getConfig(CONFIG.ENABLE_KEYBOARD_SHORTCUTS);
            
            if (this.enabled) {
                this.initialize();
            }
        }

        initialize() {
            document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        }

        handleKeyPress(e) {
            if (!this.enabled) return;

            // Check for Alt+R (start automation)
            if (e.altKey && e.key === 'r') {
                e.preventDefault();
                this.uiManager.startAutomation();
            }
            
            // Check for Alt+M (minimize/maximize)
            if (e.altKey && e.key === 'm') {
                e.preventDefault();
                if (this.uiManager.isMinimized) {
                    this.uiManager.expand();
                } else {
                    this.uiManager.minimize();
                }
            }
        }
    }

    // ===== INITIALIZATION =====
    async function initialize() {
        console.log('🚀 AutomateStash Enhanced v5.0.0 initializing...');

        // Initialize performance monitoring
        initializePerformance();

        // Create UI Manager
        const uiManager = new UIManager();
        window.stashUIManager = uiManager;

        // Initialize keyboard shortcuts
        const shortcuts = new KeyboardShortcuts(uiManager);

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                uiManager.initialize();
            });
        } else {
            await uiManager.initialize();
        }

        // Initialize schema watcher
        if (window.schemaWatcher) {
            await window.schemaWatcher.init();
        }

        console.log('✅ AutomateStash Enhanced initialized with performance monitoring');

        // Export version info
        window.AUTOMATESTASH_ENHANCED = true;
        window.AUTOMATESTASH_VERSION = '5.0.0';
        window.AUTOMATESTASH_PERFORMANCE = {
            enabled: getConfig(CONFIG.ENABLE_PERFORMANCE_MONITORING),
            caching: getConfig(CONFIG.ENABLE_ADVANCED_CACHING),
            batching: getConfig(CONFIG.ENABLE_BATCHED_DOM)
        };
    }

    // ===== CLASSES FROM ORIGINAL (STUBS FOR NOW) =====
    // These would be the full implementations from AutomateStash-Final.js
    // but adapted with performance monitoring integration

    class SourceDetector {
        async detectStashDBData() {
            return { found: false, confidence: 0, data: null };
        }
        async detectThePornDBData() {
            return { found: false, confidence: 0, data: null };
        }
        async detectOrganizedStatus() {
            return { found: false, confidence: 0, organized: false };
        }
    }

    class StatusTracker {
        constructor(sourceDetector) {
            this.sourceDetector = sourceDetector;
            this.currentStatus = {};
        }
        async detectCurrentStatus() {
            return this.currentStatus;
        }
    }

    class HistoryManager {
        async saveAutomationHistory(sceneId, data) {
            // Save with performance metrics included
            const enhanced = { ...data, performanceMetrics: window.performanceMonitor?.getMetrics() };
            GM_setValue('automation_history_enhanced', JSON.stringify(enhanced));
        }
        async getStatistics() {
            return {};
        }
    }

    class AutomationSummaryWidget {
        constructor() {
            this.widget = null;
        }
        startTracking(sceneName, sceneId) {}
        finishTracking(success) {}
        showSummary() {}
    }

    class SchemaWatcher {
        constructor(client) {
            this.client = client;
        }
        async init() {}
        async refreshCache() {}
    }

    // Attach schema watcher
    window.schemaWatcher = new SchemaWatcher(graphqlClient);

    // Start the application
    initialize().catch(error => {
        console.error('❌ Failed to initialize AutomateStash Enhanced:', error);
    });

})();
