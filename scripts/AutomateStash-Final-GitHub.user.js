// ==UserScript==
// @name         AutomateStash Final Enhanced
// @namespace    https://github.com/Stonelukas/stash-userscripts
// @version      5.6.0
// @description  AutomateStash - with performance enhancements and post-automation summary widget
// @author       AutomateStash Team
// @match        http://localhost:9998/*
// @exclude      http://localhost:9998/scenes/markers?*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_notification
// @updateURL    https://raw.githubusercontent.com/Stonelukas/stash-userscripts/main/scripts/AutomateStash-Final-GitHub.user.js
// @downloadURL  https://raw.githubusercontent.com/Stonelukas/stash-userscripts/main/scripts/AutomateStash-Final-GitHub.user.js
// @homepageURL  https://github.com/Stonelukas/stash-userscripts
// @supportURL   https://github.com/Stonelukas/stash-userscripts/issues
// @require      https://raw.githubusercontent.com/Stonelukas/stash-userscripts/main/scripts/config/performance-config.js
// @require      https://raw.githubusercontent.com/Stonelukas/stash-userscripts/main/scripts/config/ui-config.js
// @require      https://raw.githubusercontent.com/Stonelukas/stash-userscripts/main/scripts/lib/cache-manager.js
// @require      https://raw.githubusercontent.com/Stonelukas/stash-userscripts/main/scripts/lib/performance-enhancer.js
// @require      https://raw.githubusercontent.com/Stonelukas/stash-userscripts/main/scripts/lib/ui-theme-manager.js
// @require      https://raw.githubusercontent.com/Stonelukas/stash-userscripts/main/scripts/lib/animation-controller.js
// @require      https://raw.githubusercontent.com/Stonelukas/stash-userscripts/main/scripts/lib/keyboard-shortcuts.js
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
            try {
                const res = await __originalFetch(input, init);
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

    // (moved background timer boost after configuration is initialized)

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
        // Canonicalization (removed)
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
        [CONFIG.PREFER_HIGHER_RES_THUMBNAILS]: true,
        // Diagnostics
        [CONFIG.DEBUG]: true,
        // Fast click + waits
        [CONFIG.FAST_CLICK_SCROLL]: true,
        [CONFIG.VISIBLE_WAIT_TIMEOUT_MS]: 4000,
        [CONFIG.SCRAPER_OUTCOME_TIMEOUT_MS]: 8000,
        // Keep timers active in background (best-effort)
        [CONFIG.PREVENT_BACKGROUND_THROTTLING]: true,
        // Multi-scene open-in-tabs
        [CONFIG.NEW_TAB_CONCURRENCY]: 4,
        // Keyboard shortcuts (now managed by keyboard-shortcuts.js library)
        [CONFIG.ENABLE_KEYBOARD_SHORTCUTS]: true,

    };

    function getConfig(key) {
        const value = GM_getValue(key);
        return value !== undefined ? value : DEFAULTS[key];
    }

    function setConfig(key, value) {
        GM_setValue(key, value);
    }
    // Attempt to keep timers responsive in background tabs (best effort)
    if (!window.__stashTimerBoost && getConfig(CONFIG.PREVENT_BACKGROUND_THROTTLING)) {
        window.__stashTimerBoost = true;
        try {
            const raf = window.requestAnimationFrame || function (cb) { return setTimeout(cb, 50); };
            const tick = () => { raf(tick); };
            raf(tick);
        } catch (_) { }
    }

    // ===== NOTIFICATION SYSTEM =====
    class NotificationManager {
        static _recent = new Map(); // message -> timestamp
        static _dedupeMs = 5000;
        show(message, type = 'info', duration = 4000) {
            if (!getConfig(CONFIG.SHOW_NOTIFICATIONS)) return;

            // Dedupe non-error messages in a short window
            if (type !== 'error') {
                const last = NotificationManager._recent.get(message);
                const now = Date.now();
                if (last && now - last < NotificationManager._dedupeMs) {
                    return;
                }
                NotificationManager._recent.set(message, now);
            }

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

        showProfileManager() {
            const key = 'automation_profiles';
            const existing = JSON.parse(GM_getValue(key, '{}'));
            const names = Object.keys(existing).sort();

            const wrap = document.createElement('div');
            wrap.style.cssText = `position:fixed; inset:0; z-index:10010; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.55); backdrop-filter: blur(4px);`;
            const card = document.createElement('div');
            card.style.cssText = `width: 540px; max-height: 80vh; overflow:auto; background:#263645; color:#ecf0f1; border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,0.5); padding:18px; border:1px solid rgba(255,255,255,0.08);`;
            card.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                    <h3 style="margin:0; color:#1abc9c;">Profile Manager</h3>
                    <button id="pm-close" style="background:#7f8c8d;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;">Close</button>
                </div>
                <div style="display:flex; gap:10px; align-items:center; margin-bottom:12px;">
                    <input id="pm-filter" placeholder="Filter profiles..." style="flex:1;padding:8px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#ecf0f1;">
                    <button id="pm-new" style="background:#f1c40f;color:#000;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-weight:600;">New</button>
                </div>
                <div id="pm-list" style="display:flex; flex-direction:column; gap:8px;"></div>
            `;

            const list = card.querySelector('#pm-list');
            const render = (filter = '') => {
                list.innerHTML = '';
                const filtered = names.filter(n => n.toLowerCase().includes(filter.toLowerCase()));
                if (filtered.length === 0) {
                    list.innerHTML = '<div style="opacity:.7; font-size:13px;">No profiles found</div>';
                    return;
                }
                filtered.forEach(name => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.08)';
                    const label = document.createElement('div');
                    label.textContent = name;
                    label.style.cssText = 'flex:1; font-weight:600;';
                    const btnLoad = document.createElement('button');
                    const btnInspect = document.createElement('button');
                    const btnDelete = document.createElement('button');
                    const btnRename = document.createElement('button');
                    const style = (el, bg) => { el.style.cssText = `background:${bg};color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;`; };
                    btnLoad.textContent = 'Load'; style(btnLoad, '#3498db');
                    btnInspect.textContent = 'Inspect'; style(btnInspect, '#7f8c8d');
                    btnDelete.textContent = 'Delete'; style(btnDelete, '#e74c3c');
                    btnRename.textContent = 'Rename'; style(btnRename, '#9b59b6');

                    btnLoad.onclick = () => {
                        const cfg = existing[name]; if (!cfg) return;
                        // cfg keys are GM keys
                        Object.entries(cfg).forEach(([gmKey, val]) => setConfig(gmKey, val));
                        this.activeProfileName = name; GM_setValue('ACTIVE_PROFILE_NAME', name);
                        notifications.show(`✅ Profile '${name}' loaded`, 'success');
                        // Refresh both settings dialog (if open) and manager labels
                        this.updateConfigDialogControls();
                        // Update Active profile input in settings if visible
                        const settingsDialog = document.querySelector('#stash-config-dialog');
                        if (settingsDialog) {
                            const profileInput = settingsDialog.querySelector('#activeProfileName');
                            if (profileInput) profileInput.value = name;
                        }
                    };
                    btnInspect.onclick = async () => {
                        try { await navigator.clipboard.writeText(JSON.stringify(existing[name], null, 2)); notifications.show('📋 Copied profile JSON', 'success'); } catch (_) { notifications.show('❌ Copy failed', 'error'); }
                    };
                    btnDelete.onclick = () => {
                        if (!confirm(`Delete profile '${name}'?`)) return;
                        delete existing[name]; GM_setValue(key, JSON.stringify(existing));
                        const idx = names.indexOf(name); if (idx >= 0) names.splice(idx, 1);
                        render(card.querySelector('#pm-filter').value);
                        notifications.show('🗑️ Profile deleted', 'info');
                    };
                    btnRename.onclick = () => {
                        const newName = prompt('New profile name:', name) || '';
                        if (!newName || newName === name) return;
                        if (existing[newName]) { notifications.show('❌ Name already exists', 'error'); return; }
                        existing[newName] = existing[name]; delete existing[name]; GM_setValue(key, JSON.stringify(existing));
                        const idx = names.indexOf(name); if (idx >= 0) names[idx] = newName; else names.push(newName);
                        names.sort(); this.activeProfileName = newName; GM_setValue('ACTIVE_PROFILE_NAME', newName);
                        render(card.querySelector('#pm-filter').value);
                        notifications.show('✏️ Profile renamed', 'success');
                    };
                    row.appendChild(label);
                    row.appendChild(btnLoad);
                    row.appendChild(btnInspect);
                    row.appendChild(btnRename);
                    row.appendChild(btnDelete);
                    list.appendChild(row);
                });
            };

            wrap.appendChild(card);
            document.body.appendChild(wrap);
            render('');
            card.querySelector('#pm-close').onclick = () => wrap.remove();
            card.querySelector('#pm-filter').oninput = (e) => render(e.target.value);
            card.querySelector('#pm-new').onclick = () => {
                const name = prompt('Profile name:', this.activeProfileName || 'default');
                if (!name) return;
                const existingProfiles = JSON.parse(GM_getValue(key, '{}'));
                if (existingProfiles[name]) { notifications.show('❌ Name already exists', 'error'); return; }
                existingProfiles[name] = Object.fromEntries(Object.keys(CONFIG).map(k => [k, getConfig(CONFIG[k])]));
                GM_setValue(key, JSON.stringify(existingProfiles));
                names.push(name); names.sort();
                render(card.querySelector('#pm-filter').value);
                notifications.show('🆕 Profile created', 'success');
            };
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
    // ===== GraphQL Schema Watcher (lightweight) =====
    class SchemaWatcher {
        constructor(client) {
            this.client = client;
            this.introspectionKey = 'schema_introspection';
        }
        async fetchIntrospection() {
            const INTROSPECTION = `query { __schema { types { name fields { name } } } }`;
            try { return await this.client.query(INTROSPECTION, {}); } catch (_) { return null; }
        }
        async init() {
            const cached = GM_getValue(this.introspectionKey, '{}');
            this.last = null;
            try { this.last = JSON.parse(cached); } catch (_) { this.last = null; }
        }
        analyzeError(err, query) {
            const msg = String(err?.message || err).toLowerCase();
            if (/unknown field|cannot query field|unknown argument/.test(msg)) {
                notifications.show('⚠️ GraphQL schema change detected', 'warning');
            }
        }
        async refreshCache() {
            const data = await this.fetchIntrospection();
            if (data) GM_setValue(this.introspectionKey, JSON.stringify(data));
        }
    }

    /**
     * TaskQueue - simple rate-limited queue with retries and backoff
     */
    class TaskQueue {
        constructor({ concurrency = 1, baseDelayMs = 500, maxRetries = 2 } = {}) {
            this.concurrency = Math.max(1, concurrency);
            this.baseDelayMs = baseDelayMs;
            this.maxRetries = maxRetries;
            this.queue = [];
            this.active = 0;
        }

        enqueue(taskFn, metadata = {}) {
            this.queue.push({ taskFn, metadata, retries: 0 });
            this.#drain();
        }

        #drain() {
            while (this.active < this.concurrency && this.queue.length > 0) {
                const task = this.queue.shift();
                this.#run(task);
            }
        }

        async #run(task) {
            this.active++;
            try {
                await task.taskFn();
            } catch (err) {
                if (task.retries < this.maxRetries) {
                    const delay = this.baseDelayMs * Math.pow(2, task.retries);
                    task.retries++;
                    setTimeout(() => {
                        this.queue.unshift(task);
                        this.#drain();
                    }, delay);
                }
            } finally {
                this.active--;
                this.#drain();
            }
        }
    }

    function debugLog(...args) {
        try {
            if (getConfig(CONFIG.DEBUG)) {
                console.debug('[AutomateStash]', ...args);
            }
        } catch (_) { }
    }
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
            // In-flight request coalescing and short TTL cache
            this._inflight = new Map(); // key -> Promise
            this._cache = new Map(); // key -> { data, expiresAt }
            this._schemaWatcher = null;
        }

        /**
         * Clear all internal caches (TTL and inflight). Call after mutations like save/organize.
         */
        clear() {
            try {
                this._cache.clear();
                this._inflight.clear();
            } catch (_) { }
        }

        /**
         * Execute GraphQL query against Stash API
         * @param {string} query - GraphQL query string
         * @param {Object} variables - Query variables
         * @returns {Promise<Object>} Query results
         */
        async query(query, variables = {}) {
            try {
                // Check cache if available and this is a query (not mutation)
                const isQuery = query.trim().toLowerCase().startsWith('query');
                if (isQuery && window.graphQLCache) {
                    const cached = window.graphQLCache.get(query, variables);
                    if (cached) {
                        debugLog('📦 Cache hit for GraphQL query');
                        return cached;
                    }
                } else if (isQuery && window.cacheManager) {
                    // Fallback to basic cache if graphQLCache not available
                    const cacheKey = `gql:${query}:${JSON.stringify(variables)}`;
                    const cached = window.cacheManager.get('graphql', cacheKey);
                    if (cached) {
                        debugLog('📦 Cache hit for GraphQL query');
                        return cached;
                    }
                }

                // Track performance if available
                const startTime = performance.now();

                const headers = {
                    'Content-Type': 'application/json'
                };

                // Add API key if configured (following extension pattern)
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
                    // Pass to schema watcher if attached
                    if (window.schemaWatcher && typeof window.schemaWatcher.analyzeError === 'function') {
                        try { window.schemaWatcher.analyzeError({ message }, query); } catch (_) { }
                    }
                    throw new Error(`GraphQL errors: ${message}`);
                }

                // Track performance if available
                if (window.performanceMonitor && window.performanceMonitor.addMetric) {
                    const duration = performance.now() - startTime;
                    window.performanceMonitor.addMetric({
                        type: 'graphql',
                        name: 'query',
                        duration: duration,
                        timestamp: Date.now()
                    });
                }

                // Cache the result if it's a query
                if (isQuery && window.graphQLCache) {
                    window.graphQLCache.set(query, variables, result.data, 30000); // 30 second TTL
                } else if (isQuery && window.cacheManager) {
                    // Fallback to basic cache if graphQLCache not available
                    const cacheKey = `gql:${query}:${JSON.stringify(variables)}`;
                    window.cacheManager.set('graphql', cacheKey, result.data, 30000); // 30 second TTL
                }

                return result.data;
            } catch (error) {
                throw error;
            }
        }

        /**
         * Cached scene details with coalescing and TTL
         * @param {string} sceneId
         * @param {number} ttlMs default 5000ms
         */
        async getSceneDetailsCached(sceneId, ttlMs = 5000) {
            if (!sceneId) return null;
            const key = `scene_${sceneId}`;

            // Fresh cache?
            const cached = this._cache.get(key);
            const now = Date.now();
            if (cached && cached.expiresAt > now) {
                return cached.data;
            }

            // In-flight?
            if (this._inflight.has(key)) {
                return this._inflight.get(key);
            }

            const p = (async () => {
                try {
                    const data = await this.getSceneDetails(sceneId);
                    this._cache.set(key, { data, expiresAt: now + ttlMs });
                    return data;
                } finally {
                    // Clear inflight regardless of success/failure to avoid leaks
                    this._inflight.delete(key);
                }
            })();

            this._inflight.set(key, p);
            return p;
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
         * Find duplicate scenes using server-side pHash
         * @param {{distance?: number, durationDiff?: number}} opts
         * @returns {Promise<Array<Array<Object>>>}
         */
        async findDuplicateScenes({ distance = 0, durationDiff = -1 } = {}) {
            // TTL cache by distance/duration to avoid expensive rerenders
            if (!this._dupeCache) this._dupeCache = new Map();
            const cacheKey = `${distance}:${durationDiff}`;
            const cached = this._dupeCache.get(cacheKey);
            const now = Date.now();
            if (cached && (now - cached.ts) < 30000) {
                return cached.data;
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
            this._dupeCache.set(cacheKey, { ts: now, data: result });
            return result;
        }

        /**
         * Fetch detailed scene data suitable for merge/metadata assessment
         */
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

        /**
         * Merge scenes: merge each source into destination. Optionally override destination values.
         */
        async sceneMerge({ destination, source, values = null, play_history = true, o_history = true }) {
            const mutation = `
                mutation($input: SceneMergeInput!){
                  sceneMerge(input:$input){ id }
                }
            `;
            const input = { destination, source, play_history, o_history };
            if (values) {
                // SceneUpdateInput requires id
                if (!values.id) values.id = String(destination);
                input.values = values;
            }
            const res = await this.query(mutation, { input });
            // clear dupe cache after merge to force fresh results
            try { this._dupeCache?.clear(); } catch (_) { }
            return res?.sceneMerge?.id || null;
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
    // Expose backup helpers
    function buildBackupObject() { return HistoryManager.buildBackupObject(); }
    async function restoreAllExtended(payload) {
        try {
            const parsed = JSON.parse(payload);
            const d = parsed.data || {};
            GM_setValue('automation_profiles', JSON.stringify(d.profiles || {}));
            GM_setValue('🚀automateStash_history', JSON.stringify(d.history || []));
            GM_setValue('automation_health', JSON.stringify(d.health || {}));
            GM_setValue('community_rules', JSON.stringify(d.rules || {}));
            GM_setValue('schema_introspection', JSON.stringify(d.schema || {}));
            GM_setValue('duplicate_hashes', JSON.stringify(d.duplicates || {}));
            if (d.config && typeof d.config === 'object') {
                Object.keys(d.config).forEach(k => setConfig(k, d.config[k]));
            }
            return true;
        } catch (_) { return false; }
    }
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
        async detectStashDBData(sceneDetails) {

            // Always try GraphQL first for most accurate results
            try {
                const graphqlResult = sceneDetails
                    ? await (async () => {
                        // Derive without refetching when sceneDetails provided
                        const stashdbIds = sceneDetails.stash_ids?.filter(id => id.endpoint && id.endpoint.includes('stashdb.org')) || [];
                        return {
                            found: stashdbIds.length > 0,
                            data: {
                                stash_ids: stashdbIds,
                                scene_id: sceneDetails.id,
                                scene_title: sceneDetails.title,
                                last_updated: sceneDetails.updated_at
                            }
                        };
                    })()
                    : await this.validateStashDBGraphQL();
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
        async detectThePornDBData(sceneDetails) {

            // Always try GraphQL first for most accurate results
            try {
                const graphqlResult = sceneDetails
                    ? await (async () => {
                        const theporndbIds = sceneDetails.stash_ids?.filter(id =>
                            id.endpoint && (
                                id.endpoint.includes('metadataapi.net') ||
                                id.endpoint.includes('theporndb') ||
                                id.endpoint.includes('tpdb')
                            )
                        ) || [];
                        return {
                            found: theporndbIds.length > 0,
                            data: {
                                stash_ids: theporndbIds,
                                scene_id: sceneDetails.id,
                                scene_title: sceneDetails.title,
                                last_updated: sceneDetails.updated_at
                            }
                        };
                    })()
                    : await this.validateThePornDBGraphQL();
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
        async detectOrganizedStatus(sceneDetails) {

            // Always try GraphQL first for most accurate results
            try {
                const graphqlResult = sceneDetails
                    ? { found: true, organized: !!sceneDetails.organized, data: { scene_id: sceneDetails.id, scene_title: sceneDetails.title, organized: !!sceneDetails.organized, last_updated: sceneDetails.updated_at } }
                    : await this.validateOrganizedGraphQL();
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

                const sceneDetails = await graphqlClient.getSceneDetailsCached(sceneId);
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

                const sceneDetails = await graphqlClient.getSceneDetailsCached(sceneId);
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

                const sceneDetails = await graphqlClient.getSceneDetailsCached(sceneId);
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
            // Targeted selectors only; avoid full DOM scan
            const selectors = [
                'button[title="Organized"].organized-button',
                'button[title="Organized"]',
                'button.organized-button',
                'input[type="checkbox"][name*="organized" i]'
            ];

            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) {
                    return {
                        found: true,
                        organized: this.isElementOrganized(el),
                        element: el
                    };
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

                // Prefer a single cached GraphQL scene fetch to derive status fast
                const sceneId = this.currentStatus.sceneId;
                let sceneDetails = null;
                if (sceneId) {
                    try {
                        sceneDetails = await graphqlClient.getSceneDetailsCached(sceneId);
                    } catch (e) {
                        // Fallback is handled by detectors
                    }
                }

                // Detect StashDB status
                const stashdbResult = await this.sourceDetector.detectStashDBData(sceneDetails);
                this.currentStatus.stashdb = {
                    scraped: stashdbResult.found,
                    timestamp: stashdbResult.found ? new Date() : null,
                    confidence: stashdbResult.confidence,
                    data: stashdbResult.data,
                    strategy: stashdbResult.strategy
                };

                // Detect ThePornDB status
                const theporndbResult = await this.sourceDetector.detectThePornDBData(sceneDetails);
                this.currentStatus.theporndb = {
                    scraped: theporndbResult.found,
                    timestamp: theporndbResult.found ? new Date() : null,
                    confidence: theporndbResult.confidence,
                    data: theporndbResult.data,
                    strategy: theporndbResult.strategy
                };

                // Detect organized status
                const organizedResult = await this.sourceDetector.detectOrganizedStatus(sceneDetails);
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
        static buildBackupObject() {
            const cfg = Object.fromEntries(Object.keys(CONFIG).map(k => [k, getConfig(CONFIG[k])]))
            return {
                version: 2,
                createdAt: new Date().toISOString(),
                data: {
                    config: cfg,
                    profiles: JSON.parse(GM_getValue('automation_profiles', '{}')),
                    history: JSON.parse(GM_getValue('🚀automateStash_history', '[]')),
                    health: JSON.parse(GM_getValue('automation_health', '{}')),
                    rules: JSON.parse(GM_getValue('community_rules', '{}')),
                    schema: JSON.parse(GM_getValue('schema_introspection', '{}')),
                    duplicates: JSON.parse(GM_getValue('duplicate_hashes', '{}')),
                }
            };
        }

        // Prefer idle time for non-urgent persistence
        _scheduleIdle(callback) {
            const ric = window.requestIdleCallback || function (cb, opts) {
                return setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 50);
            };
            try {
                ric(callback, { timeout: 1000 });
            } catch (_) {
                // Fallback if requestIdleCallback is not usable
                setTimeout(callback, 50);
            }
        }

        _truncateString(val, max = 200) {
            try {
                const s = typeof val === 'string' ? val : (val && val.message) ? String(val.message) : JSON.stringify(val);
                return s && s.length > max ? s.slice(0, max) + '…' : s;
            } catch (_) {
                return String(val).slice(0, max);
            }
        }

        _unique(arr) {
            return Array.from(new Set(arr));
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
                // Sanitize incoming payload to keep storage small and stable
                const sourcesUsed = this._unique((data.sourcesUsed || []).map(String)).slice(0, 5);
                const errors = (data.errors || []).slice(0, 10).map(e => this._truncateString(e, 200));
                const duration = typeof data.duration === 'number' ? Math.max(0, Math.round(data.duration)) : null;

                const historyEntry = {
                    sceneId: sceneId,
                    sceneName: this._truncateString(data.sceneName || `Scene ${sceneId}`, 140),
                    url: data.url || window.location.href,
                    timestamp: timestamp,
                    success: !!data.success,
                    sourcesUsed,
                    errors,
                    duration,
                    retryCount: Number.isFinite(data.retryCount) ? data.retryCount : 0,
                    rateLimitHits: Number.isFinite(data.rateLimitHits) ? data.rateLimitHits : 0,
                    // Lightweight summary fields for quick UI display
                    summary: {
                        actionsCount: Array.isArray(data.actions) ? data.actions.length : (data.actionsCount ?? 0),
                        fieldsUpdatedCount: Array.isArray(data.fieldsUpdated) ? data.fieldsUpdated.length : (data.fieldsUpdatedCount ?? 0),
                        warningsCount: Array.isArray(data.warnings) ? data.warnings.length : (data.warningsCount ?? 0),
                        lastSource: sourcesUsed[0] || undefined,
                        lastError: errors[0] || undefined
                    },
                    metadata: {
                        // Store presence flags instead of heavy objects to avoid bloat
                        stashdb: !!data.stashdb || null,
                        theporndb: !!data.theporndb || null,
                        organized: data.organized || false,
                        performersCreated: data.performersCreated || 0,
                        studiosCreated: data.studiosCreated || 0,
                        tagsCreated: data.tagsCreated || 0
                    },
                    timings: {
                        scrapeMs: Math.max(0, Math.round((data.timings?.scrapeMs ?? data.scrapeMs) || 0)) || 0,
                        applyMs: Math.max(0, Math.round((data.timings?.applyMs ?? data.applyMs) || 0)) || 0,
                        saveMs: Math.max(0, Math.round((data.timings?.saveMs ?? data.saveMs) || 0)) || 0,
                        organizeMs: Math.max(0, Math.round((data.timings?.organizeMs ?? data.organizeMs) || 0)) || 0,
                    },
                    sourceTimings: data.sourceTimings && typeof data.sourceTimings === 'object' ? data.sourceTimings : undefined,
                    userAgent: navigator.userAgent.substring(0, 100), // Truncated for storage efficiency
                    version: '4.2.0-complete'
                };

                // Add to history array
                history.unshift(historyEntry); // Add to beginning for chronological order

                // Limit history size
                if (history.length > this.maxHistoryEntries) {
                    history.splice(this.maxHistoryEntries);
                }

                // Save to persistent storage during idle time to reduce jank
                this._scheduleIdle(() => {
                    try {
                        GM_setValue(this.storageKey, JSON.stringify(history));
                    } catch (_) { }
                });

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
                    averageDurationMs: 0,
                    oldestEntry: null,
                    newestEntry: null,
                    errorsCount: history.reduce((sum, h) => sum + (h.errors?.length || 0), 0),
                    bySource: {
                        stashdb: { runs: 0, durationTotal: 0, avgMs: 0 },
                        theporndb: { runs: 0, durationTotal: 0, avgMs: 0 }
                    },
                    last20SuccessRate: 0,
                    last7dSuccessRate: 0,
                    last30dSuccessRate: 0,
                    topErrors: [],
                    timeOfDay: Array.from({ length: 24 }, () => ({ total: 0, ok: 0 }))
                };

                // Calculate duration statistics from entries that have duration data
                const entriesWithDuration = history.filter(h => h.duration && h.duration > 0);
                if (entriesWithDuration.length > 0) {
                    stats.totalDuration = entriesWithDuration.reduce((sum, h) => sum + h.duration, 0);
                    stats.averageDuration = Math.round(stats.totalDuration / entriesWithDuration.length);
                    stats.averageDurationMs = stats.averageDuration;
                }

                // Per-source average durations and runs
                entriesWithDuration.forEach(h => {
                    if (h.sourcesUsed?.includes('stashdb')) {
                        stats.bySource.stashdb.runs += 1;
                        stats.bySource.stashdb.durationTotal += h.duration;
                    }
                    if (h.sourcesUsed?.includes('theporndb')) {
                        stats.bySource.theporndb.runs += 1;
                        stats.bySource.theporndb.durationTotal += h.duration;
                    }
                });
                Object.keys(stats.bySource).forEach(k => {
                    const s = stats.bySource[k];
                    s.avgMs = s.runs ? Math.round(s.durationTotal / s.runs) : 0;
                });

                // Find oldest and newest entries
                if (history.length > 0) {
                    const sortedByDate = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    stats.oldestEntry = sortedByDate[0];
                    stats.newestEntry = sortedByDate[sortedByDate.length - 1];
                }

                // Calculate success rate
                stats.successRate = stats.totalAutomations > 0 ?
                    Math.round((stats.successfulAutomations / stats.totalAutomations) * 100) : 0;

                // Last-N and time windows
                const last20 = history.slice(0, 20);
                if (last20.length) {
                    const ok = last20.filter(h => h.success).length;
                    stats.last20SuccessRate = Math.round((ok / last20.length) * 100);
                }
                const now = Date.now();
                const withinDays = (h, d) => {
                    const t = Date.parse(h.timestamp);
                    return isNaN(t) ? false : (now - t) <= d * 24 * 60 * 60 * 1000;
                };
                const last7 = history.filter(h => withinDays(h, 7));
                if (last7.length) {
                    stats.last7dSuccessRate = Math.round((last7.filter(h => h.success).length / last7.length) * 100);
                }
                const last30 = history.filter(h => withinDays(h, 30));
                if (last30.length) {
                    stats.last30dSuccessRate = Math.round((last30.filter(h => h.success).length / last30.length) * 100);
                }

                // Top errors
                const errMap = new Map();
                history.forEach(h => (h.errors || []).forEach(e => {
                    const key = String(e).toLowerCase().slice(0, 120);
                    errMap.set(key, (errMap.get(key) || 0) + 1);
                }));
                stats.topErrors = Array.from(errMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([message, count]) => ({ message, count }));

                // Time of day distribution
                history.forEach(h => {
                    const t = Date.parse(h.timestamp);
                    if (isNaN(t)) return;
                    const hour = new Date(t).getHours();
                    const bucket = stats.timeOfDay[hour];
                    bucket.total += 1; if (h.success) bucket.ok += 1;
                });

                return stats;
            } catch (error) {
                return {
                    totalAutomations: 0,
                    successfulAutomations: 0,
                    failedAutomations: 0,
                    uniqueScenes: 0,
                    sourcesUsed: { stashdb: 0, theporndb: 0 },
                    averageDuration: 0,
                    averageDurationMs: 0,
                    totalDuration: 0,
                    successRate: 0,
                    errorsCount: 0,
                    bySource: { stashdb: { runs: 0, durationTotal: 0, avgMs: 0 }, theporndb: { runs: 0, durationTotal: 0, avgMs: 0 } },
                    last20SuccessRate: 0,
                    last7dSuccessRate: 0,
                    last30dSuccessRate: 0,
                    topErrors: [],
                    timeOfDay: Array.from({ length: 24 }, () => ({ total: 0, ok: 0 }))
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
            this._pendingRender = null;

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
            this._scheduleRender();
        }

        addSource(source) {
            if (!this.summaryData.sourcesUsed.includes(source)) {
                this.summaryData.sourcesUsed.push(source);
            }
            this._scheduleRender();
        }

        addFieldUpdate(field, oldValue, newValue) {
            this.summaryData.fieldsUpdated.push({
                field,
                oldValue: oldValue || 'empty',
                newValue: newValue || 'empty'
            });
            this._scheduleRender();
        }

        addError(error) {
            this.summaryData.errors.push(error);
            this._scheduleRender();
        }

        addWarning(warning) {
            this.summaryData.warnings.push(warning);
            this._scheduleRender();
        }

        finishTracking(success) {
            this.summaryData.endTime = new Date();
            this.summaryData.success = success;
            const duration = (this.summaryData.endTime - this.summaryData.startTime) / 1000;
            this._scheduleRender();
        }

        _scheduleRender() {
            // Debounce frequent updates to avoid layout thrash
            if (this._pendingRender) {
                clearTimeout(this._pendingRender);
            }
            this._pendingRender = setTimeout(() => {
                if (this.summaryData.endTime) {
                    this.showSummary();
                }
                this._pendingRender = null;
            }, 300);
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

                // Quick actions
                const actionsBar = document.createElement('div');
                actionsBar.style.cssText = `
                display: flex; gap: 10px; margin-top: 12px; justify-content: flex-end;
            `;
                const retryBtn = document.createElement('button');
                retryBtn.textContent = '↻ Retry';
                retryBtn.style.cssText = 'background:#2980b9;color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;';
                const copyBtn = document.createElement('button');
                copyBtn.textContent = '📋 Copy JSON';
                copyBtn.style.cssText = 'background:#7f8c8d;color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;';
                const quickFixBtn = document.createElement('button');
                quickFixBtn.textContent = '🛠️ Quick Fix';
                quickFixBtn.style.cssText = 'background:#27ae60;color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;';
                actionsBar.appendChild(copyBtn);
                actionsBar.appendChild(retryBtn);
                actionsBar.appendChild(quickFixBtn);

                copyBtn.addEventListener('click', async () => {
                    try {
                        const compact = {
                            scene: sceneName,
                            duration: Number(duration),
                            success,
                            sourcesUsed,
                            actions: successActions.map(a => a.action),
                            skipped: skippedActions.map(a => a.action),
                            fieldsUpdated: fieldsUpdated.map(f => f.field),
                            errors,
                            warnings
                        };
                        await navigator.clipboard.writeText(JSON.stringify(compact, null, 2));
                        copyBtn.textContent = '✅ Copied';
                        setTimeout(() => (copyBtn.textContent = '📋 Copy JSON'), 1500);
                    } catch (_) {
                        copyBtn.textContent = '❌ Failed';
                        setTimeout(() => (copyBtn.textContent = '📋 Copy JSON'), 1500);
                    }
                });
                retryBtn.addEventListener('click', () => {
                    try { window.expandAutomateStash && window.expandAutomateStash(); } catch (_) { }
                    try { window.stashUIManager && window.stashUIManager.startAutomation(); } catch (_) { }
                });

                quickFixBtn.addEventListener('click', async () => {
                    try {
                        // Heuristic: if a source was skipped or we saw errors mentioning a source,
                        // toggle re-scrape for that source and re-run.
                        const skipped = actions.filter(a => a.status === 'skip').map(a => a.action.toLowerCase());
                        const hadStashIssues = skipped.some(t => t.includes('stashdb')) || errors.some(e => /stashdb|stash-box/i.test(e)) || warnings.some(w => /stashdb|stash-box/i.test(w));
                        const hadTpdbIssues = skipped.some(t => t.includes('theporndb') || t.includes('tpdb')) || errors.some(e => /theporndb|tpdb/i.test(e)) || warnings.some(w => /theporndb|tpdb/i.test(w));

                        const ui = window.stashUIManager;
                        if (!ui) return;

                        // Expand panel if minimized
                        try { window.expandAutomateStash && window.expandAutomateStash(); } catch (_) { }

                        // Set re-scrape options to focus on problematic sources
                        ui.rescrapeOptions.forceRescrape = true;
                        ui.rescrapeOptions.rescrapeStashDB = !!hadStashIssues;
                        ui.rescrapeOptions.rescrapeThePornDB = !!hadTpdbIssues;

                        // If no specific issues detected, default to re-running both if there were any issues at all
                        if (!ui.rescrapeOptions.rescrapeStashDB && !ui.rescrapeOptions.rescrapeThePornDB && (errors.length || warnings.length || skipped.length)) {
                            ui.rescrapeOptions.rescrapeStashDB = true;
                            ui.rescrapeOptions.rescrapeThePornDB = true;
                        }

                        // Start automation again
                        await ui.startAutomation();
                    } catch (_) {
                    }
                });

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
                this.widget.appendChild(actionsBar);

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
                // Do not auto-expand; keep minimized until user clicks
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

            // Add event listeners (non-passive for mousemove to allow preventDefault)
            header.addEventListener('mousedown', dragStart);
            document.addEventListener('mousemove', dragMove, { passive: false });
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
            this.skipButton = null;
            this.skipCurrentSourceRequested = false;

            // Re-scrape state
            this.rescrapeOptions = {
                forceRescrape: false,
                rescrapeStashDB: false,
                rescrapeThePornDB: false
            };
            
            // Z-index management for widgets
            this.baseZIndex = 10000;
            this.topZIndex = 10000;
            this.widgets = new Map();

            // Initialize enhanced status tracking components
            // Use global instances if available, otherwise create new ones
            this.sourceDetector = window.sourceDetector || new SourceDetector();
            this.statusTracker = window.statusTracker || new StatusTracker(this.sourceDetector);
            this.historyManager = window.historyManager || new HistoryManager();

            // Initialize automation summary widget (will be created when DOM is ready)
            this.summaryWidget = null;
            this._organizedAfterSave = false;

            // Profiles
            this.activeProfileName = GM_getValue('ACTIVE_PROFILE_NAME', '');

            // DOM mutation observer for real-time updates
            this.mutationObserver = null;
            this.lastStatusUpdate = Date.now();
            this.observerRoot = null; // Scoped root for mutation observation
            this.editRoot = null; // Cached root for scoped queries

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

            // Keyboard shortcuts
            this.initializeShortcuts();

            // Schema watcher (lightweight)
            try {
                window.schemaWatcher = new SchemaWatcher(graphqlClient);
                window.schemaWatcher.init();
                setTimeout(() => { try { window.schemaWatcher.refreshCache(); } catch (_) { } }, 8000);
            } catch (_) { }

        }
        saveAllEnhancedSettings() {
            // Save keyboard shortcuts
            const shortcuts = window.keyboardShortcuts ? window.keyboardShortcuts.exportConfig() : {};
            GM_setValue('keyboard_shortcuts', JSON.stringify(shortcuts));
            
            // Save performance configuration
            if (window.performanceConfigManager) {
                const perfConfig = window.performanceConfigManager.export();
                GM_setValue('performance_config', perfConfig);
            }
            
            // Save theme settings
            if (window.themeManager) {
                GM_setValue('ui_theme', window.themeManager.currentTheme);
            }
            
            // Save animation settings (already saved individually in the UI)
            // Animation settings are saved when the Save button is clicked
            
            console.log('✅ All enhanced settings saved');
        }
        
        showEnhancedSettings() {
            // Close any existing dialog
            const existing = document.getElementById('enhanced-settings-dialog');
            if (existing) existing.remove();

            const dialog = document.createElement('div');
            dialog.id = 'enhanced-settings-dialog';
            dialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #1e2936 0%, #2c3e50 100%);
                border-radius: 12px;
                padding: 0;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                z-index: 10001;
                width: 800px;
                max-width: 90vw;
                max-height: 80vh;
                overflow: hidden;
                border: 1px solid rgba(255,255,255,0.1);
            `;

            // Header with tabs
            const header = document.createElement('div');
            header.style.cssText = `
                padding: 20px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                background: rgba(0,0,0,0.2);
            `;

            const title = document.createElement('h2');
            title.textContent = '🚀 Enhanced Settings';
            title.style.cssText = `
                margin: 0 0 15px 0;
                color: #ecf0f1;
                font-size: 20px;
                font-weight: 600;
            `;
            header.appendChild(title);

            // Tab navigation
            const tabs = document.createElement('div');
            tabs.style.cssText = `
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            `;

            const tabButtons = [];
            const tabContents = [];

            const createTab = (name, icon, content) => {
                const button = document.createElement('button');
                button.textContent = `${icon} ${name}`;
                button.style.cssText = `
                    padding: 8px 16px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: #ecf0f1;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-size: 13px;
                `;
                
                button.addEventListener('click', () => {
                    // Reset all tabs
                    tabButtons.forEach(b => {
                        b.style.background = 'rgba(255,255,255,0.1)';
                        b.style.borderColor = 'rgba(255,255,255,0.2)';
                    });
                    tabContents.forEach(c => c.style.display = 'none');
                    
                    // Activate this tab
                    button.style.background = '#3498db';
                    button.style.borderColor = '#3498db';
                    content.style.display = 'block';
                });

                tabButtons.push(button);
                tabContents.push(content);
                tabs.appendChild(button);
                
                return content;
            };

            header.appendChild(tabs);
            dialog.appendChild(header);

            // Content container
            const contentContainer = document.createElement('div');
            contentContainer.style.cssText = `
                padding: 20px;
                overflow-y: auto;
                max-height: calc(80vh - 120px);
            `;
            dialog.appendChild(contentContainer);

            // Create tab contents
            const performanceContent = this.createPerformanceTab();
            const themeContent = this.createThemeTab();
            const cacheContent = this.createCacheTab();
            const keyboardContent = this.createKeyboardTab();
            const animationContent = this.createAnimationTab();
            const configContent = this.createConfigTab();

            // Add tabs
            createTab('Performance', '📊', performanceContent);
            createTab('Themes', '🎨', themeContent);
            createTab('Cache', '💾', cacheContent);
            createTab('Keyboard', '⌨️', keyboardContent);
            createTab('Animations', '✨', animationContent);
            createTab('Config', '⚙️', configContent);

            // Add all contents to container
            [performanceContent, themeContent, cacheContent, keyboardContent, animationContent, configContent].forEach(content => {
                content.style.display = 'none';
                contentContainer.appendChild(content);
            });

            // Show first tab by default
            tabButtons[0].click();

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '✕';
            closeBtn.style.cssText = `
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 18px;
                transition: all 0.2s;
            `;
            closeBtn.addEventListener('click', () => {
                // Save all settings before closing
                this.saveAllEnhancedSettings();
                dialog.remove();
            });
            dialog.appendChild(closeBtn);

            // Register widget for z-index management
            this.registerWidget(dialog);
            
            // Add animation if available
            document.body.appendChild(dialog);
            if (window.animationController && window.animationController.animate) {
                window.animationController.animate(dialog, 'fadeInScale', {
                    duration: 300,
                    easing: 'ease-out'
                });
            }
        }

        createPerformanceTab() {
            const container = document.createElement('div');
            
            const title = document.createElement('h3');
            title.textContent = 'Performance Metrics';
            title.style.cssText = 'color: #ecf0f1; margin-bottom: 15px;';
            container.appendChild(title);

            // Performance score
            const scoreDiv = document.createElement('div');
            scoreDiv.style.cssText = `
                background: rgba(0,0,0,0.3);
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 15px;
            `;
            
            const updateScore = () => {
                const score = window.performanceConfigManager ? 
                    window.performanceConfigManager.getPerformanceScore() : 'N/A';
                const metrics = window.performanceMonitor ? 
                    window.performanceMonitor.getSummary() : {};
                
                scoreDiv.innerHTML = `
                    <div style="font-size: 24px; color: #3498db; margin-bottom: 10px;">
                        Performance Score: ${score}/100
                    </div>
                    <div style="color: #95a5a6; font-size: 13px;">
                        <div>Average Execution Time: ${metrics.averageExecutionTime?.toFixed(2) || 'N/A'} ms</div>
                        <div>Total Operations: ${metrics.totalOperations || 0}</div>
                        <div>Cache Hit Rate: ${metrics.cacheHitRate || 'N/A'}%</div>
                        <div>Memory Usage: ${metrics.memoryUsage ? (metrics.memoryUsage / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}</div>
                    </div>
                `;
            };
            
            updateScore();
            setInterval(updateScore, 2000);
            container.appendChild(scoreDiv);

            // Performance profile selector
            const profileDiv = document.createElement('div');
            profileDiv.style.cssText = 'margin-bottom: 15px;';
            profileDiv.innerHTML = `
                <label style="color: #ecf0f1; display: block; margin-bottom: 5px;">Performance Profile:</label>
                <select id="perf-profile" style="
                    width: 100%;
                    padding: 8px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: white;
                    border-radius: 4px;
                ">
                    <option value="balanced">Balanced</option>
                    <option value="performance">Performance</option>
                    <option value="lowResource">Low Resource</option>
                    <option value="debug">Debug</option>
                </select>
            `;
            
            const profileSelect = profileDiv.querySelector('select');
            profileSelect.addEventListener('change', (e) => {
                if (window.performanceConfigManager) {
                    window.performanceConfigManager.applyProfile(e.target.value);
                    notifications.show(`Applied ${e.target.value} profile`, 'success');
                    updateScore();
                }
            });
            
            container.appendChild(profileDiv);

            // Clear metrics button
            const clearBtn = document.createElement('button');
            clearBtn.textContent = 'Clear Metrics';
            clearBtn.style.cssText = `
                background: #e74c3c;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                margin-top: 10px;
            `;
            clearBtn.addEventListener('click', () => {
                if (window.performanceMonitor && window.performanceMonitor.clear) {
                    window.performanceMonitor.clear();
                    notifications.show('Performance metrics cleared', 'success');
                    updateScore();
                }
            });
            container.appendChild(clearBtn);

            return container;
        }

        createThemeTab() {
            const container = document.createElement('div');
            
            const title = document.createElement('h3');
            title.textContent = 'Theme Settings';
            title.style.cssText = 'color: #ecf0f1; margin-bottom: 15px;';
            container.appendChild(title);

            const themes = ['dark', 'light', 'midnight', 'ocean'];
            const themeGrid = document.createElement('div');
            themeGrid.style.cssText = `
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
                margin-bottom: 20px;
            `;

            themes.forEach(themeName => {
                const themeCard = document.createElement('div');
                themeCard.style.cssText = `
                    background: rgba(0,0,0,0.3);
                    padding: 15px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 2px solid transparent;
                `;
                
                themeCard.innerHTML = `
                    <div style="font-weight: bold; color: #ecf0f1; margin-bottom: 5px;">
                        ${themeName.charAt(0).toUpperCase() + themeName.slice(1)}
                    </div>
                    <div style="color: #95a5a6; font-size: 12px;">
                        ${themeName === 'dark' ? 'Default dark theme' :
                          themeName === 'light' ? 'Bright light theme' :
                          themeName === 'midnight' ? 'Deep blue theme' :
                          'Ocean blue theme'}
                    </div>
                `;
                
                themeCard.addEventListener('click', () => {
                    if (window.themeManager && window.themeManager.applyTheme) {
                        window.themeManager.applyTheme(themeName);
                        notifications.show(`Applied ${themeName} theme`, 'success');
                        
                        // Update selection
                        themeGrid.querySelectorAll('div').forEach(card => {
                            card.style.borderColor = 'transparent';
                        });
                        themeCard.style.borderColor = '#3498db';
                    }
                });
                
                themeGrid.appendChild(themeCard);
            });
            
            container.appendChild(themeGrid);

            // Custom CSS input
            const customDiv = document.createElement('div');
            customDiv.innerHTML = `
                <label style="color: #ecf0f1; display: block; margin-bottom: 5px;">Custom CSS:</label>
                <textarea id="custom-css" style="
                    width: 100%;
                    height: 100px;
                    padding: 10px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: white;
                    border-radius: 4px;
                    font-family: monospace;
                " placeholder="Enter custom CSS here..."></textarea>
            `;
            
            const applyCustomBtn = document.createElement('button');
            applyCustomBtn.textContent = 'Apply Custom CSS';
            applyCustomBtn.style.cssText = `
                background: #3498db;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                margin-top: 10px;
            `;
            applyCustomBtn.addEventListener('click', () => {
                const css = customDiv.querySelector('textarea').value;
                if (css && window.themeManager && window.themeManager.applyCustomCSS) {
                    window.themeManager.applyCustomCSS(css);
                    notifications.show('Custom CSS applied', 'success');
                }
            });
            
            customDiv.appendChild(applyCustomBtn);
            container.appendChild(customDiv);

            return container;
        }

        createCacheTab() {
            const container = document.createElement('div');
            
            const title = document.createElement('h3');
            title.textContent = 'Cache Statistics';
            title.style.cssText = 'color: #ecf0f1; margin-bottom: 15px;';
            container.appendChild(title);

            const statsDiv = document.createElement('div');
            statsDiv.style.cssText = `
                background: rgba(0,0,0,0.3);
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 15px;
            `;
            
            const updateStats = () => {
                const stats = window.cacheManager ? 
                    window.cacheManager.getAllStats() : {};
                
                let html = '<div style="color: #ecf0f1;">';
                
                if (stats.global) {
                    html += `
                        <h4 style="margin-bottom: 10px;">Global Statistics</h4>
                        <div style="color: #95a5a6; font-size: 13px;">
                            <div>Total Requests: ${stats.global.requests || 0}</div>
                            <div>Cache Hits: ${stats.global.hits || 0}</div>
                            <div>Hit Rate: ${stats.global.hitRate || '0'}%</div>
                            <div>Total Size: ${stats.global.totalSize ? (stats.global.totalSize / 1024).toFixed(2) + ' KB' : 'N/A'}</div>
                        </div>
                    `;
                }
                
                if (stats.stores) {
                    html += '<h4 style="margin-top: 15px; margin-bottom: 10px;">Store Statistics</h4>';
                    Object.entries(stats.stores).forEach(([name, store]) => {
                        html += `
                            <div style="margin-bottom: 10px;">
                                <strong>${name}:</strong>
                                <div style="color: #95a5a6; font-size: 12px; margin-left: 10px;">
                                    Size: ${store.size || 0} | Hits: ${store.hits || 0} | Misses: ${store.misses || 0}
                                </div>
                            </div>
                        `;
                    });
                }
                
                html += '</div>';
                statsDiv.innerHTML = html;
            };
            
            updateStats();
            setInterval(updateStats, 2000);
            container.appendChild(statsDiv);

            // Cache control buttons
            const buttonsDiv = document.createElement('div');
            buttonsDiv.style.cssText = 'display: flex; gap: 10px;';
            
            const clearCacheBtn = document.createElement('button');
            clearCacheBtn.textContent = 'Clear All Cache';
            clearCacheBtn.style.cssText = `
                background: #e74c3c;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
            `;
            clearCacheBtn.addEventListener('click', () => {
                if (window.cacheManager) {
                    window.cacheManager.cleanup();
                    if (window.graphQLCache) {
                        window.graphQLCache.invalidate();
                    }
                    notifications.show('Cache cleared', 'success');
                    updateStats();
                }
            });
            
            const warmupBtn = document.createElement('button');
            warmupBtn.textContent = 'Warm Cache';
            warmupBtn.style.cssText = `
                background: #27ae60;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
            `;
            warmupBtn.addEventListener('click', () => {
                if (window.graphQLCache && window.graphQLCache.warmup) {
                    window.graphQLCache.warmup();
                    notifications.show('Cache warmed up', 'success');
                    updateStats();
                }
            });
            
            buttonsDiv.appendChild(clearCacheBtn);
            buttonsDiv.appendChild(warmupBtn);
            container.appendChild(buttonsDiv);

            return container;
        }

        createKeyboardTab() {
            const container = document.createElement('div');
            
            const title = document.createElement('h3');
            title.textContent = 'Keyboard Shortcuts';
            title.style.cssText = 'color: #ecf0f1; margin-bottom: 15px;';
            container.appendChild(title);

            // Get actual shortcuts from the library
            let shortcuts = [];
            if (window.keyboardShortcuts && window.keyboardShortcuts.getShortcuts) {
                shortcuts = window.keyboardShortcuts.getShortcuts();
            } else if (window.KeyboardShortcutsManager) {
                // Use the library's default shortcuts directly
                const manager = new window.KeyboardShortcutsManager();
                shortcuts = Object.entries(manager.defaultShortcuts).map(([key, info]) => ({
                    key,
                    originalKey: key,
                    action: info.action,
                    description: info.description,
                    context: info.context
                }));
            } else {
                // Fallback
                shortcuts = [
                    { key: 'Alt+r', originalKey: 'Alt+r', action: 'startAutomation', description: 'Start automation', context: 'global' },
                    { key: 'Alt+Shift+r', originalKey: 'Alt+Shift+r', action: 'startAutomationSilent', description: 'Start silent automation', context: 'global' },
                    { key: 'Alt+m', originalKey: 'Alt+m', action: 'toggleMinimize', description: 'Toggle minimize panel', context: 'global' },
                    { key: 'Alt+c', originalKey: 'Alt+c', action: 'openConfig', description: 'Open configuration', context: 'global' },
                    { key: 'Alt+h', originalKey: 'Alt+h', action: 'showHelp', description: 'Show help', context: 'global' },
                    { key: 'Escape', originalKey: 'Escape', action: 'cancelAutomation', description: 'Cancel automation', context: 'automation' },
                    { key: 'Alt+a', originalKey: 'Alt+a', action: 'applyScrapedData', description: 'Apply scraped data', context: 'edit' },
                    { key: 'Alt+s', originalKey: 'Alt+s', action: 'saveScene', description: 'Save scene', context: 'edit' },
                    { key: 'Alt+o', originalKey: 'Alt+o', action: 'organizeScene', description: 'Mark as organized', context: 'edit' },
                    { key: 'Alt+1', originalKey: 'Alt+1', action: 'scrapeStashDB', description: 'Scrape StashDB', context: 'edit' },
                    { key: 'Alt+2', originalKey: 'Alt+2', action: 'scrapeThePornDB', description: 'Scrape ThePornDB', context: 'edit' },
                    { key: 'Alt+Left', originalKey: 'Alt+Left', action: 'previousScene', description: 'Previous scene', context: 'global' },
                    { key: 'Alt+Right', originalKey: 'Alt+Right', action: 'nextScene', description: 'Next scene', context: 'global' },
                    { key: 'Alt+e', originalKey: 'Alt+e', action: 'openEditPanel', description: 'Open edit panel', context: 'global' },
                    { key: 'Alt+q', originalKey: 'Alt+q', action: 'closeEditPanel', description: 'Close edit panel', context: 'edit' },
                    { key: 'Alt+p', originalKey: 'Alt+p', action: 'togglePerformanceMonitor', description: 'Toggle performance monitor', context: 'global' },
                    { key: 'Alt+d', originalKey: 'Alt+d', action: 'toggleDebugMode', description: 'Toggle debug mode', context: 'global' },
                    { key: 'Alt+t', originalKey: 'Alt+t', action: 'toggleTheme', description: 'Toggle theme', context: 'global' }
                ];
            }

            // Add and Edit buttons
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'margin-bottom: 15px; display: flex; gap: 10px;';
            
            const addBtn = document.createElement('button');
            addBtn.textContent = '+ Add Shortcut';
            addBtn.style.cssText = `
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
            `;
            
            const resetBtn = document.createElement('button');
            resetBtn.textContent = 'Reset to Defaults';
            resetBtn.style.cssText = `
                background: rgba(255,255,255,0.2);
                color: white;
                border: 1px solid rgba(255,255,255,0.3);
                padding: 8px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
            `;
            
            buttonContainer.appendChild(addBtn);
            buttonContainer.appendChild(resetBtn);
            container.appendChild(buttonContainer);

            const table = document.createElement('table');
            table.style.cssText = `
                width: 100%;
                border-collapse: collapse;
            `;
            
            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.2);">
                    <th style="text-align: left; padding: 10px; color: #ecf0f1;">Shortcut</th>
                    <th style="text-align: left; padding: 10px; color: #ecf0f1;">Action</th>
                    <th style="text-align: left; padding: 10px; color: #ecf0f1;">Context</th>
                    <th style="text-align: center; padding: 10px; color: #ecf0f1;">Actions</th>
                </tr>
            `;
            table.appendChild(thead);
            
            const tbody = document.createElement('tbody');
            tbody.id = 'keyboard-shortcuts-tbody';
            
            // Function to render shortcuts
            const renderShortcuts = () => {
                tbody.innerHTML = '';
                shortcuts.forEach((shortcut, index) => {
                    const row = document.createElement('tr');
                    row.style.cssText = 'border-bottom: 1px solid rgba(255,255,255,0.1);';
                    row.innerHTML = `
                        <td style="padding: 10px;">
                            <input type="text" value="${shortcut.key}" 
                                data-index="${index}"
                                class="shortcut-key-input"
                                style="
                                    background: rgba(255,255,255,0.1);
                                    border: 1px solid rgba(255,255,255,0.2);
                                    color: #ecf0f1;
                                    padding: 4px 8px;
                                    border-radius: 4px;
                                    font-family: monospace;
                                    width: 120px;
                                " />
                        </td>
                        <td style="padding: 10px; color: #95a5a6;">${shortcut.description || shortcut.action}</td>
                        <td style="padding: 10px; color: #95a5a6;">${shortcut.context || 'global'}</td>
                        <td style="padding: 10px; text-align: center;">
                            <button class="edit-shortcut-btn" data-index="${index}" style="
                                background: rgba(255,255,255,0.2);
                                border: none;
                                color: white;
                                padding: 4px 8px;
                                border-radius: 4px;
                                cursor: pointer;
                                margin-right: 5px;
                            ">Save</button>
                            <button class="delete-shortcut-btn" data-index="${index}" style="
                                background: rgba(231, 76, 60, 0.8);
                                border: none;
                                color: white;
                                padding: 4px 8px;
                                border-radius: 4px;
                                cursor: pointer;
                            ">×</button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
                
                // Add event listeners for edit buttons
                tbody.querySelectorAll('.edit-shortcut-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const index = parseInt(e.target.dataset.index);
                        const input = tbody.querySelector(`.shortcut-key-input[data-index="${index}"]`);
                        const newKey = input.value.trim();
                        
                        if (newKey && window.keyboardShortcuts) {
                            const shortcut = shortcuts[index];
                            // Unregister old shortcut
                            if (window.keyboardShortcuts.unregisterShortcut) {
                                window.keyboardShortcuts.unregisterShortcut(shortcut.originalKey || shortcut.key);
                            }
                            // Register new shortcut
                            if (window.keyboardShortcuts.registerShortcut) {
                                window.keyboardShortcuts.registerShortcut(newKey, shortcut.action, shortcut.description, shortcut.context);
                                shortcut.key = newKey;
                                shortcut.originalKey = newKey;
                            }
                            notifications.show(`Shortcut updated: ${newKey}`, 'success');
                        }
                    });
                });
                
                // Add event listeners for delete buttons
                tbody.querySelectorAll('.delete-shortcut-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const index = parseInt(e.target.dataset.index);
                        const shortcut = shortcuts[index];
                        
                        if (window.keyboardShortcuts && window.keyboardShortcuts.unregisterShortcut) {
                            window.keyboardShortcuts.unregisterShortcut(shortcut.originalKey || shortcut.key);
                        }
                        
                        shortcuts.splice(index, 1);
                        renderShortcuts();
                        notifications.show('Shortcut removed', 'info');
                    });
                });
            };
            
            // Initial render
            renderShortcuts();
            
            // Add button event listener
            addBtn.addEventListener('click', () => {
                // Show dialog to select action
                const actionDialog = document.createElement('div');
                actionDialog.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: #2c3e50;
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 8px;
                    padding: 20px;
                    z-index: 100001;
                    min-width: 400px;
                    max-height: 80vh;
                    overflow-y: auto;
                `;
                
                // Get already assigned actions
                const assignedActions = new Set(shortcuts.map(s => s.action));
                
                // Available actions - comprehensive list
                const allActions = [
                    // Automation Actions
                    { action: 'startAutomation', description: 'Start automation', category: 'Automation' },
                    { action: 'startAutomationSilent', description: 'Start silent automation', category: 'Automation' },
                    { action: 'cancelAutomation', description: 'Cancel automation', category: 'Automation' },
                    { action: 'pauseAutomation', description: 'Pause automation', category: 'Automation' },
                    { action: 'resumeAutomation', description: 'Resume automation', category: 'Automation' },
                    { action: 'skipCurrentSource', description: 'Skip current scraper source', category: 'Automation' },
                    
                    // UI Actions
                    { action: 'toggleMinimize', description: 'Toggle minimize panel', category: 'UI' },
                    { action: 'openConfig', description: 'Open configuration', category: 'UI' },
                    { action: 'openEnhancedSettings', description: 'Open enhanced settings', category: 'UI' },
                    { action: 'showHelp', description: 'Show help', category: 'UI' },
                    { action: 'toggleTheme', description: 'Toggle theme', category: 'UI' },
                    { action: 'togglePerformanceMonitor', description: 'Toggle performance monitor', category: 'UI' },
                    { action: 'toggleSummaryWidget', description: 'Toggle summary widget', category: 'UI' },
                    { action: 'toggleDebugMode', description: 'Toggle debug mode', category: 'UI' },
                    { action: 'toggleNotifications', description: 'Toggle notifications', category: 'UI' },
                    { action: 'clearNotifications', description: 'Clear all notifications', category: 'UI' },
                    { action: 'refreshUI', description: 'Refresh UI elements', category: 'UI' },
                    
                    // Scene Actions
                    { action: 'applyScrapedData', description: 'Apply scraped data', category: 'Scene' },
                    { action: 'saveScene', description: 'Save scene', category: 'Scene' },
                    { action: 'organizeScene', description: 'Mark as organized', category: 'Scene' },
                    { action: 'deleteScene', description: 'Delete current scene', category: 'Scene' },
                    { action: 'duplicateScene', description: 'Duplicate scene', category: 'Scene' },
                    { action: 'generatePreview', description: 'Generate preview', category: 'Scene' },
                    { action: 'playScene', description: 'Play scene', category: 'Scene' },
                    { action: 'editScene', description: 'Edit scene details', category: 'Scene' },
                    
                    // Scraping Actions
                    { action: 'scrapeStashDB', description: 'Scrape StashDB', category: 'Scraping' },
                    { action: 'scrapeThePornDB', description: 'Scrape ThePornDB', category: 'Scraping' },
                    { action: 'scrapeAll', description: 'Scrape all sources', category: 'Scraping' },
                    { action: 'rescrapeScene', description: 'Re-scrape current scene', category: 'Scraping' },
                    { action: 'forceRescrape', description: 'Force re-scrape (ignore cache)', category: 'Scraping' },
                    { action: 'createPerformers', description: 'Create new performers', category: 'Scraping' },
                    { action: 'createStudios', description: 'Create new studios', category: 'Scraping' },
                    { action: 'createTags', description: 'Create new tags', category: 'Scraping' },
                    
                    // Navigation Actions
                    { action: 'previousScene', description: 'Previous scene', category: 'Navigation' },
                    { action: 'nextScene', description: 'Next scene', category: 'Navigation' },
                    { action: 'firstScene', description: 'First scene', category: 'Navigation' },
                    { action: 'lastScene', description: 'Last scene', category: 'Navigation' },
                    { action: 'openEditPanel', description: 'Open edit panel', category: 'Navigation' },
                    { action: 'closeEditPanel', description: 'Close edit panel', category: 'Navigation' },
                    { action: 'goToScenes', description: 'Go to scenes page', category: 'Navigation' },
                    { action: 'goToPerformers', description: 'Go to performers page', category: 'Navigation' },
                    { action: 'goToStudios', description: 'Go to studios page', category: 'Navigation' },
                    { action: 'goToTags', description: 'Go to tags page', category: 'Navigation' },
                    { action: 'goToSettings', description: 'Go to settings page', category: 'Navigation' },
                    
                    // Performance Actions
                    { action: 'clearCache', description: 'Clear all caches', category: 'Performance' },
                    { action: 'clearGraphQLCache', description: 'Clear GraphQL cache', category: 'Performance' },
                    { action: 'clearDOMCache', description: 'Clear DOM cache', category: 'Performance' },
                    { action: 'runPerformanceTest', description: 'Run performance test', category: 'Performance' },
                    { action: 'exportPerformanceData', description: 'Export performance data', category: 'Performance' },
                    { action: 'optimizePerformance', description: 'Auto-optimize performance', category: 'Performance' },
                    { action: 'toggleCaching', description: 'Toggle caching on/off', category: 'Performance' },
                    
                    // Data Actions
                    { action: 'exportData', description: 'Export current data', category: 'Data' },
                    { action: 'importData', description: 'Import data', category: 'Data' },
                    { action: 'backupSettings', description: 'Backup all settings', category: 'Data' },
                    { action: 'restoreSettings', description: 'Restore settings', category: 'Data' },
                    { action: 'resetSettings', description: 'Reset to defaults', category: 'Data' },
                    { action: 'exportShortcuts', description: 'Export shortcuts', category: 'Data' },
                    { action: 'importShortcuts', description: 'Import shortcuts', category: 'Data' },
                    
                    // Batch Actions
                    { action: 'selectAll', description: 'Select all scenes', category: 'Batch' },
                    { action: 'deselectAll', description: 'Deselect all scenes', category: 'Batch' },
                    { action: 'invertSelection', description: 'Invert selection', category: 'Batch' },
                    { action: 'bulkOrganize', description: 'Organize selected scenes', category: 'Batch' },
                    { action: 'bulkScrape', description: 'Scrape selected scenes', category: 'Batch' },
                    { action: 'bulkTag', description: 'Tag selected scenes', category: 'Batch' },
                    { action: 'bulkDelete', description: 'Delete selected scenes', category: 'Batch' },
                    
                    // Custom Actions
                    { action: 'customAction1', description: 'Custom Action 1', category: 'Custom' },
                    { action: 'customAction2', description: 'Custom Action 2', category: 'Custom' },
                    { action: 'customAction3', description: 'Custom Action 3', category: 'Custom' },
                    { action: 'runMacro', description: 'Run saved macro', category: 'Custom' },
                    { action: 'recordMacro', description: 'Record macro', category: 'Custom' },
                    { action: 'stopMacro', description: 'Stop macro recording', category: 'Custom' }
                ];
                
                // Filter out already assigned actions
                const availableActions = allActions.filter(action => !assignedActions.has(action.action));
                
                // Check if there are any available actions
                if (availableActions.length === 0) {
                    notifications.show('All actions already have shortcuts assigned!', 'warning');
                    return;
                }
                
                // Group actions by category
                const groupedActions = {};
                availableActions.forEach(action => {
                    if (!groupedActions[action.category]) {
                        groupedActions[action.category] = [];
                    }
                    groupedActions[action.category].push(action);
                });
                
                // Create options HTML with optgroups
                let optionsHTML = '';
                Object.keys(groupedActions).sort().forEach(category => {
                    optionsHTML += `<optgroup label="${category}">`;
                    groupedActions[category].forEach(action => {
                        optionsHTML += `<option value="${action.action}">${action.description}</option>`;
                    });
                    optionsHTML += '</optgroup>';
                });
                
                actionDialog.innerHTML = `
                    <h4 style="color: #ecf0f1; margin-bottom: 15px;">Add New Keyboard Shortcut</h4>
                    <div style="margin-bottom: 15px;">
                        <label style="color: #ecf0f1; display: block; margin-bottom: 5px;">Key Combination:</label>
                        <input type="text" id="new-shortcut-key" value="Ctrl+Shift+?" 
                               placeholder="e.g., Ctrl+Alt+X, Shift+F1, Alt+5"
                               style="width: 100%; padding: 8px; background: #34495e; color: white; border: 1px solid #556d7f; border-radius: 4px;">
                        <small style="color: #95a5a6; display: block; margin-top: 5px;">
                            Use Ctrl, Alt, Shift, Meta as modifiers. Examples: Ctrl+S, Alt+Shift+R, F5
                        </small>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="color: #ecf0f1; display: block; margin-bottom: 5px;">Action:</label>
                        <select id="new-shortcut-action" style="width: 100%; padding: 8px; background: #34495e; color: white; border: 1px solid #556d7f; border-radius: 4px; max-height: 200px;">
                            ${optionsHTML}
                        </select>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="color: #ecf0f1; display: block; margin-bottom: 5px;">Context:</label>
                        <select id="new-shortcut-context" style="width: 100%; padding: 8px; background: #34495e; color: white; border: 1px solid #556d7f; border-radius: 4px;">
                            <option value="global">Global (Works everywhere)</option>
                            <option value="edit">Edit Panel (Only in edit mode)</option>
                            <option value="automation">During Automation</option>
                            <option value="modal">Modal Dialog</option>
                            <option value="scenes">Scenes Page</option>
                            <option value="performers">Performers Page</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="color: #ecf0f1; display: block; margin-bottom: 5px;">Custom Description (Optional):</label>
                        <input type="text" id="new-shortcut-description" 
                               placeholder="Leave empty to use default description"
                               style="width: 100%; padding: 8px; background: #34495e; color: white; border: 1px solid #556d7f; border-radius: 4px;">
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button id="cancel-new-shortcut" style="background: #7f8c8d; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                            Cancel
                        </button>
                        <button id="confirm-new-shortcut" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                            Add Shortcut
                        </button>
                    </div>
                `;
                
                document.body.appendChild(actionDialog);
                
                // Focus on key input
                actionDialog.querySelector('#new-shortcut-key').focus();
                
                // Event listeners for dialog buttons
                actionDialog.querySelector('#cancel-new-shortcut').addEventListener('click', () => {
                    actionDialog.remove();
                });
                
                actionDialog.querySelector('#confirm-new-shortcut').addEventListener('click', () => {
                    const keyInput = actionDialog.querySelector('#new-shortcut-key');
                    const actionSelect = actionDialog.querySelector('#new-shortcut-action');
                    const contextSelect = actionDialog.querySelector('#new-shortcut-context');
                    const descriptionInput = actionDialog.querySelector('#new-shortcut-description');
                    
                    const selectedAction = availableActions.find(a => a.action === actionSelect.value);
                    const newShortcut = {
                        key: keyInput.value.trim(),
                        originalKey: keyInput.value.trim(),
                        action: actionSelect.value,
                        description: descriptionInput.value.trim() || (selectedAction ? selectedAction.description : 'Custom Action'),
                        context: contextSelect.value
                    };
                    
                    // Validate key combination
                    if (!newShortcut.key || newShortcut.key === '') {
                        notifications.show('Please enter a valid key combination', 'error');
                        return;
                    }
                    
                    // Check for duplicate shortcuts
                    const duplicate = shortcuts.find(s => s.key === newShortcut.key && s.context === newShortcut.context);
                    if (duplicate) {
                        notifications.show(`Shortcut ${newShortcut.key} already exists in ${newShortcut.context} context`, 'error');
                        return;
                    }
                    
                    // Register the new shortcut
                    if (window.keyboardShortcuts && window.keyboardShortcuts.registerShortcut) {
                        window.keyboardShortcuts.registerShortcut(
                            newShortcut.key,
                            newShortcut.action,
                            newShortcut.description,
                            newShortcut.context
                        );
                    }
                    
                    shortcuts.push(newShortcut);
                    renderShortcuts();
                    actionDialog.remove();
                    notifications.show(`New shortcut added: ${newShortcut.key} → ${newShortcut.description}`, 'success');
                });
                
                // Add Enter key support for quick add
                actionDialog.querySelector('#new-shortcut-key').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        actionDialog.querySelector('#confirm-new-shortcut').click();
                    }
                });
            });
            
            // Reset button event listener
            resetBtn.addEventListener('click', () => {
                if (window.keyboardShortcuts && window.KeyboardShortcutsManager) {
                    // Clear all current shortcuts
                    shortcuts.forEach(s => {
                        if (window.keyboardShortcuts.unregisterShortcut) {
                            window.keyboardShortcuts.unregisterShortcut(s.originalKey || s.key);
                        }
                    });
                    
                    // Re-initialize with defaults
                    const manager = new window.KeyboardShortcutsManager();
                    shortcuts = Object.entries(manager.defaultShortcuts).map(([key, info]) => {
                        // Register the default shortcut
                        if (window.keyboardShortcuts.registerShortcut) {
                            window.keyboardShortcuts.registerShortcut(key, info.action, info.description, info.context);
                        }
                        return {
                            key,
                            originalKey: key,
                            action: info.action,
                            description: info.description,
                            context: info.context
                        };
                    });
                    renderShortcuts();
                    notifications.show('Shortcuts reset to defaults', 'success');
                }
            });
            
            table.appendChild(tbody);
            container.appendChild(table);

            return container;
        }

        createAnimationTab() {
            const container = document.createElement('div');
            
            const title = document.createElement('h3');
            title.textContent = 'Animation Settings';
            title.style.cssText = 'color: #ecf0f1; margin-bottom: 15px;';
            container.appendChild(title);

            // Animation toggle
            const toggleDiv = document.createElement('div');
            toggleDiv.style.cssText = 'margin-bottom: 20px;';
            toggleDiv.innerHTML = `
                <label style="display: flex; align-items: center; color: #ecf0f1;">
                    <input type="checkbox" id="animations-enabled" checked style="margin-right: 10px;">
                    Enable Animations
                </label>
            `;
            
            const animToggle = toggleDiv.querySelector('input');
            animToggle.addEventListener('change', (e) => {
                if (window.animationController) {
                    if (e.target.checked) {
                        window.animationController.enable();
                    } else {
                        window.animationController.disable();
                    }
                    notifications.show(`Animations ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');
                }
            });
            container.appendChild(toggleDiv);

            // Animation speed
            const speedDiv = document.createElement('div');
            speedDiv.style.cssText = 'margin-bottom: 20px;';
            speedDiv.innerHTML = `
                <label style="color: #ecf0f1; display: block; margin-bottom: 5px;">Animation Speed:</label>
                <input type="range" id="anim-speed" min="0.5" max="2" step="0.1" value="1" style="width: 100%;">
                <div style="display: flex; justify-content: space-between; color: #95a5a6; font-size: 12px;">
                    <span>Slow</span>
                    <span id="speed-value">1x</span>
                    <span>Fast</span>
                </div>
            `;
            
            const speedSlider = speedDiv.querySelector('input');
            const speedValue = speedDiv.querySelector('#speed-value');
            speedSlider.addEventListener('input', (e) => {
                const speed = parseFloat(e.target.value);
                speedValue.textContent = `${speed}x`;
                if (window.animationController && window.animationController.setSpeed) {
                    window.animationController.setSpeed(speed);
                }
            });
            container.appendChild(speedDiv);

            // Widget Animation Settings
            const widgetAnimDiv = document.createElement('div');
            widgetAnimDiv.style.cssText = 'margin-bottom: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 8px;';
            widgetAnimDiv.innerHTML = `
                <h4 style="color: #ecf0f1; margin-bottom: 15px;">Widget Animations</h4>
            `;
            
            // Available animations from animation-controller.js
            const availableAnimations = [
                'fadeIn', 'fadeOut', 'slideInRight', 'slideInLeft', 'slideInUp', 
                'slideOutRight', 'slideOutLeft', 'slideOutDown', 'scaleIn', 'scaleOut',
                'rotateIn', 'shake', 'pulse', 'bounce', 'spin', 'shimmer'
            ];
            
            const easingOptions = [
                'linear', 'ease', 'easeIn', 'easeOut', 'easeInOut',
                'spring', 'bounce', 'easeInQuad', 'easeOutQuad', 'easeInOutQuad'
            ];
            
            // Load saved animation settings
            const savedAnimSettings = GM_getValue('widget_animations', null);
            const animSettings = savedAnimSettings ? JSON.parse(savedAnimSettings) : {};
            
            // Widget animation configurations with saved or default values
            const widgetConfigs = [
                { id: 'main-panel', name: 'Main Panel', defaultAnim: 'fadeIn', defaultDuration: 300 },
                { id: 'enhanced-settings', name: 'Enhanced Settings', defaultAnim: 'scaleIn', defaultDuration: 400 },
                { id: 'performance-widget', name: 'Performance Widget', defaultAnim: 'slideInRight', defaultDuration: 350 },
                { id: 'summary-widget', name: 'Summary Widget', defaultAnim: 'slideInLeft', defaultDuration: 350 },
                { id: 'notifications', name: 'Notifications', defaultAnim: 'slideInUp', defaultDuration: 250 },
                { id: 'minimized-button', name: 'Minimized Button', defaultAnim: 'bounce', defaultDuration: 500 }
            ].map(config => ({
                ...config,
                defaultAnim: animSettings[config.id]?.animation || config.defaultAnim,
                defaultDuration: animSettings[config.id]?.duration || config.defaultDuration,
                defaultEasing: animSettings[config.id]?.easing || 'ease'
            }));
            
            widgetConfigs.forEach(widget => {
                const widgetRow = document.createElement('div');
                widgetRow.style.cssText = 'margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px;';
                
                widgetRow.innerHTML = `
                    <div style="display: grid; grid-template-columns: 150px 1fr 100px 120px 80px; gap: 10px; align-items: center;">
                        <label style="color: #ecf0f1; font-size: 13px;">${widget.name}:</label>
                        <select class="anim-select" data-widget="${widget.id}" style="background: #34495e; color: white; border: 1px solid #556d7f; padding: 5px; border-radius: 4px;">
                            ${availableAnimations.map(anim => 
                                `<option value="${anim}" ${anim === widget.defaultAnim ? 'selected' : ''}>${anim}</option>`
                            ).join('')}
                        </select>
                        <input type="number" class="duration-input" data-widget="${widget.id}" 
                               value="${widget.defaultDuration}" min="100" max="2000" step="50"
                               style="background: #34495e; color: white; border: 1px solid #556d7f; padding: 5px; border-radius: 4px;"
                               placeholder="Duration (ms)">
                        <select class="easing-select" data-widget="${widget.id}" style="background: #34495e; color: white; border: 1px solid #556d7f; padding: 5px; border-radius: 4px;">
                            ${easingOptions.map(easing => 
                                `<option value="${easing}" ${easing === widget.defaultEasing ? 'selected' : ''}>${easing}</option>`
                            ).join('')}
                        </select>
                        <button class="preview-btn" data-widget="${widget.id}" style="background: #667eea; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                            Preview
                        </button>
                    </div>
                `;
                
                widgetAnimDiv.appendChild(widgetRow);
            });
            
            // Save animations button
            const saveAnimBtn = document.createElement('button');
            saveAnimBtn.textContent = 'Save Animation Settings';
            saveAnimBtn.style.cssText = `
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                margin-top: 15px;
                width: 100%;
            `;
            saveAnimBtn.addEventListener('click', () => {
                const animSettings = {};
                widgetConfigs.forEach(widget => {
                    const animSelect = widgetAnimDiv.querySelector(`.anim-select[data-widget="${widget.id}"]`);
                    const durationInput = widgetAnimDiv.querySelector(`.duration-input[data-widget="${widget.id}"]`);
                    const easingSelect = widgetAnimDiv.querySelector(`.easing-select[data-widget="${widget.id}"]`);
                    
                    animSettings[widget.id] = {
                        animation: animSelect.value,
                        duration: parseInt(durationInput.value),
                        easing: easingSelect.value
                    };
                });
                
                GM_setValue('widget_animations', JSON.stringify(animSettings));
                notifications.show('Animation settings saved!', 'success');
            });
            widgetAnimDiv.appendChild(saveAnimBtn);
            
            container.appendChild(widgetAnimDiv);

            // Animation preview
            const previewDiv = document.createElement('div');
            previewDiv.innerHTML = `
                <h4 style="color: #ecf0f1; margin-bottom: 10px;">Quick Animation Preview</h4>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
            `;
            
            const quickAnimations = ['fadeIn', 'slideInRight', 'bounce', 'pulse', 'shake', 'scaleIn', 'rotateIn', 'shimmer'];
            quickAnimations.forEach(anim => {
                const btn = document.createElement('button');
                btn.textContent = anim;
                btn.style.cssText = `
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: white;
                    padding: 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                `;
                btn.addEventListener('mouseenter', () => {
                    btn.style.background = 'rgba(255,255,255,0.2)';
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.background = 'rgba(255,255,255,0.1)';
                });
                btn.addEventListener('click', () => {
                    if (window.animationController && window.animationController.animate) {
                        window.animationController.animate(btn, anim, {
                            duration: 500
                        });
                    }
                });
                previewDiv.querySelector('div').appendChild(btn);
            });
            
            container.appendChild(previewDiv);
            
            // Add event listeners for preview buttons
            widgetAnimDiv.querySelectorAll('.preview-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const widgetId = e.target.dataset.widget;
                    const animSelect = widgetAnimDiv.querySelector(`.anim-select[data-widget="${widgetId}"]`);
                    const durationInput = widgetAnimDiv.querySelector(`.duration-input[data-widget="${widgetId}"]`);
                    const easingSelect = widgetAnimDiv.querySelector(`.easing-select[data-widget="${widgetId}"]`);
                    
                    // Find the corresponding widget or use the button itself as preview
                    let targetElement = document.querySelector(`#${widgetId}`);
                    if (!targetElement) {
                        targetElement = e.target;
                    }
                    
                    if (window.animationController && window.animationController.animate) {
                        window.animationController.animate(targetElement, animSelect.value, {
                            duration: parseInt(durationInput.value),
                            easing: easingSelect.value
                        });
                    }
                });
            });

            return container;
        }

        createConfigTab() {
            const container = document.createElement('div');
            container.style.cssText = 'max-height: 500px; overflow-y: auto;';
            
            const title = document.createElement('h3');
            title.textContent = 'Advanced Configuration';
            title.style.cssText = 'color: #ecf0f1; margin-bottom: 15px;';
            container.appendChild(title);

            // Configuration sections
            const sections = [
                {
                    title: '⚡ Performance Monitoring',
                    settings: [
                        { path: 'monitoring.enabled', label: 'Enable Monitoring', type: 'checkbox' },
                        { path: 'monitoring.sampleRate', label: 'Sample Rate', type: 'slider', min: 0, max: 1, step: 0.1 },
                        { path: 'monitoring.reportingInterval', label: 'Reporting Interval (ms)', type: 'number', min: 1000, max: 60000 },
                        { path: 'monitoring.longTaskThreshold', label: 'Long Task Threshold (ms)', type: 'number', min: 10, max: 200 },
                        { path: 'monitoring.warnThreshold', label: 'Warning Threshold (ms)', type: 'number', min: 50, max: 500 },
                        { path: 'monitoring.criticalThreshold', label: 'Critical Threshold (ms)', type: 'number', min: 100, max: 1000 }
                    ]
                },
                {
                    title: '💾 Cache Configuration',
                    settings: [
                        { path: 'cache.enabled', label: 'Enable Caching', type: 'checkbox' },
                        { path: 'cache.graphql.maxSize', label: 'GraphQL Cache Size', type: 'number', min: 50, max: 500 },
                        { path: 'cache.graphql.ttl', label: 'GraphQL TTL (ms)', type: 'number', min: 60000, max: 3600000 },
                        { path: 'cache.dom.maxSize', label: 'DOM Cache Size', type: 'number', min: 10, max: 100 },
                        { path: 'cache.dom.ttl', label: 'DOM TTL (ms)', type: 'number', min: 5000, max: 60000 },
                        { path: 'cache.warmupEnabled', label: 'Enable Cache Warmup', type: 'checkbox' },
                        { path: 'cache.cleanupInterval', label: 'Cleanup Interval (ms)', type: 'number', min: 60000, max: 600000 }
                    ]
                },
                {
                    title: '🎯 DOM Operations',
                    settings: [
                        { path: 'dom.batchingEnabled', label: 'Enable DOM Batching', type: 'checkbox' },
                        { path: 'dom.batchFlushDelay', label: 'Batch Flush Delay (ms)', type: 'number', min: 0, max: 100 },
                        { path: 'dom.mutationObserverDelay', label: 'Mutation Observer Delay (ms)', type: 'number', min: 100, max: 2000 },
                        { path: 'dom.scrollThrottle', label: 'Scroll Throttle (ms)', type: 'number', min: 16, max: 500 },
                        { path: 'dom.resizeThrottle', label: 'Resize Throttle (ms)', type: 'number', min: 50, max: 1000 },
                        { path: 'dom.lazyLoadOffset', label: 'Lazy Load Offset (px)', type: 'number', min: 0, max: 500 }
                    ]
                },
                {
                    title: '📊 Task Queue',
                    settings: [
                        { path: 'taskQueue.enabled', label: 'Enable Task Queue', type: 'checkbox' },
                        { path: 'taskQueue.defaultConcurrency', label: 'Default Concurrency', type: 'number', min: 1, max: 10 },
                        { path: 'taskQueue.maxConcurrency', label: 'Max Concurrency', type: 'number', min: 1, max: 20 },
                        { path: 'taskQueue.defaultTimeout', label: 'Default Timeout (ms)', type: 'number', min: 5000, max: 60000 },
                        { path: 'taskQueue.retryEnabled', label: 'Enable Retries', type: 'checkbox' },
                        { path: 'taskQueue.maxRetries', label: 'Max Retries', type: 'number', min: 0, max: 10 },
                        { path: 'taskQueue.retryDelay', label: 'Retry Delay (ms)', type: 'number', min: 100, max: 5000 }
                    ]
                },
                {
                    title: '🧠 Memory Management',
                    settings: [
                        { path: 'memory.monitoringEnabled', label: 'Enable Memory Monitoring', type: 'checkbox' },
                        { path: 'memory.checkInterval', label: 'Check Interval (ms)', type: 'number', min: 10000, max: 120000 },
                        { path: 'memory.warningThreshold', label: 'Warning Threshold (bytes)', type: 'number', min: 10485760, max: 209715200 },
                        { path: 'memory.criticalThreshold', label: 'Critical Threshold (bytes)', type: 'number', min: 52428800, max: 524288000 },
                        { path: 'memory.autoCleanup', label: 'Auto Cleanup', type: 'checkbox' },
                        { path: 'memory.gcSuggestion', label: 'GC Suggestions', type: 'checkbox' }
                    ]
                },
                {
                    title: '🌐 Network Optimization',
                    settings: [
                        { path: 'network.requestDeduplication', label: 'Request Deduplication', type: 'checkbox' },
                        { path: 'network.requestBatching', label: 'Request Batching', type: 'checkbox' },
                        { path: 'network.batchWindowSize', label: 'Batch Window (ms)', type: 'number', min: 10, max: 200 },
                        { path: 'network.maxBatchSize', label: 'Max Batch Size', type: 'number', min: 1, max: 50 },
                        { path: 'network.cacheFirstStrategy', label: 'Cache First Strategy', type: 'checkbox' },
                        { path: 'network.maxConcurrentRequests', label: 'Max Concurrent Requests', type: 'number', min: 1, max: 20 }
                    ]
                },
                {
                    title: '🔍 Debug Options',
                    settings: [
                        { path: 'debug.enabled', label: 'Enable Debug Mode', type: 'checkbox' },
                        { path: 'debug.verboseLogging', label: 'Verbose Logging', type: 'checkbox' },
                        { path: 'debug.performanceMarks', label: 'Performance Marks', type: 'checkbox' },
                        { path: 'debug.cacheLogging', label: 'Cache Logging', type: 'checkbox' },
                        { path: 'debug.networkLogging', label: 'Network Logging', type: 'checkbox' },
                        { path: 'debug.domLogging', label: 'DOM Logging', type: 'checkbox' },
                        { path: 'debug.showMetricsOverlay', label: 'Show Metrics Overlay', type: 'checkbox' }
                    ]
                }
            ];

            // Create sections
            sections.forEach(section => {
                const sectionDiv = document.createElement('div');
                sectionDiv.style.cssText = 'margin-bottom: 25px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px;';
                
                const sectionTitle = document.createElement('h4');
                sectionTitle.textContent = section.title;
                sectionTitle.style.cssText = 'color: #ecf0f1; margin-bottom: 15px; font-size: 14px;';
                sectionDiv.appendChild(sectionTitle);
                
                section.settings.forEach(setting => {
                    const settingDiv = document.createElement('div');
                    settingDiv.style.cssText = 'margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;';
                    
                    const label = document.createElement('label');
                    label.textContent = setting.label;
                    label.style.cssText = 'color: #bdc3c7; font-size: 12px; flex: 1;';
                    
                    let input;
                    const currentValue = window.performanceConfigManager?.get(setting.path);
                    
                    if (setting.type === 'checkbox') {
                        input = document.createElement('input');
                        input.type = 'checkbox';
                        input.checked = currentValue || false;
                        input.style.cssText = 'cursor: pointer;';
                        
                        input.addEventListener('change', (e) => {
                            if (window.performanceConfigManager) {
                                window.performanceConfigManager.set(setting.path, e.target.checked);
                                notifications.show(`${setting.label}: ${e.target.checked ? 'Enabled' : 'Disabled'}`, 'success');
                            }
                        });
                    } else if (setting.type === 'slider') {
                        const sliderContainer = document.createElement('div');
                        sliderContainer.style.cssText = 'display: flex; align-items: center; gap: 10px;';
                        
                        input = document.createElement('input');
                        input.type = 'range';
                        input.min = setting.min;
                        input.max = setting.max;
                        input.step = setting.step;
                        input.value = currentValue || setting.min;
                        input.style.cssText = 'width: 100px;';
                        
                        const valueDisplay = document.createElement('span');
                        valueDisplay.textContent = input.value;
                        valueDisplay.style.cssText = 'color: #ecf0f1; min-width: 40px; text-align: right;';
                        
                        input.addEventListener('input', (e) => {
                            valueDisplay.textContent = e.target.value;
                            if (window.performanceConfigManager) {
                                window.performanceConfigManager.set(setting.path, parseFloat(e.target.value));
                            }
                        });
                        
                        sliderContainer.appendChild(input);
                        sliderContainer.appendChild(valueDisplay);
                        input = sliderContainer;
                    } else if (setting.type === 'number') {
                        input = document.createElement('input');
                        input.type = 'number';
                        input.min = setting.min;
                        input.max = setting.max;
                        input.value = currentValue || setting.min;
                        input.style.cssText = 'width: 80px; padding: 4px; background: #34495e; color: white; border: 1px solid #556d7f; border-radius: 4px;';
                        
                        input.addEventListener('change', (e) => {
                            const value = parseInt(e.target.value);
                            if (window.performanceConfigManager && !isNaN(value)) {
                                window.performanceConfigManager.set(setting.path, value);
                                notifications.show(`${setting.label} set to ${value}`, 'success');
                            }
                        });
                    }
                    
                    settingDiv.appendChild(label);
                    settingDiv.appendChild(input);
                    sectionDiv.appendChild(settingDiv);
                });
                
                container.appendChild(sectionDiv);
            });

            // Add performance profiles section
            const profilesDiv = document.createElement('div');
            profilesDiv.style.cssText = 'margin-bottom: 25px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px;';
            
            const profilesTitle = document.createElement('h4');
            profilesTitle.textContent = '🎯 Performance Profiles';
            profilesTitle.style.cssText = 'color: #ecf0f1; margin-bottom: 15px;';
            profilesDiv.appendChild(profilesTitle);
            
            const profiles = [
                { name: 'balanced', label: 'Balanced', description: 'Good mix of performance and features' },
                { name: 'performance', label: 'High Performance', description: 'Maximum performance, all optimizations' },
                { name: 'lowResource', label: 'Low Resource', description: 'Minimal resource usage' },
                { name: 'debug', label: 'Debug Mode', description: 'Enable all logging and debugging' }
            ];
            
            profiles.forEach(profile => {
                const profileBtn = document.createElement('button');
                profileBtn.style.cssText = `
                    display: block;
                    width: 100%;
                    margin-bottom: 8px;
                    padding: 10px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    text-align: left;
                `;
                profileBtn.innerHTML = `
                    <div style="font-weight: bold;">${profile.label}</div>
                    <div style="font-size: 11px; opacity: 0.9; margin-top: 4px;">${profile.description}</div>
                `;
                
                profileBtn.addEventListener('click', () => {
                    if (window.performanceConfigManager) {
                        window.performanceConfigManager.applyProfile(profile.name);
                        notifications.show(`Applied ${profile.label} profile`, 'success');
                    }
                });
                
                profilesDiv.appendChild(profileBtn);
            });
            
            container.appendChild(profilesDiv);

            // Export/Import config
            const backupDiv = document.createElement('div');
            backupDiv.style.cssText = 'margin-bottom: 20px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 8px;';
            backupDiv.innerHTML = `
                <h4 style="color: #ecf0f1; margin-bottom: 10px;">🔧 Configuration Backup</h4>
                <div style="display: flex; gap: 10px;">
            `;
            
            const exportBtn = document.createElement('button');
            exportBtn.textContent = 'Export Config';
            exportBtn.style.cssText = `
                background: #27ae60;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                flex: 1;
            `;
            exportBtn.addEventListener('click', () => {
                if (window.performanceConfigManager) {
                    const config = window.performanceConfigManager.export();
                    const blob = new Blob([config], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `stash-performance-config-${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    notifications.show('Configuration exported', 'success');
                }
            });
            
            const importBtn = document.createElement('button');
            importBtn.textContent = 'Import Config';
            importBtn.style.cssText = `
                background: #3498db;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                flex: 1;
            `;
            importBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'application/json';
                input.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (file && window.performanceConfigManager) {
                        const text = await file.text();
                        if (window.performanceConfigManager.import(text)) {
                            notifications.show('Configuration imported', 'success');
                        } else {
                            notifications.show('Import failed', 'error');
                        }
                    }
                });
                input.click();
            });
            
            const resetBtn = document.createElement('button');
            resetBtn.textContent = 'Reset to Defaults';
            resetBtn.style.cssText = `
                background: #e74c3c;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                flex: 1;
            `;
            resetBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to reset all performance settings to defaults?')) {
                    if (window.performanceConfigManager) {
                        window.performanceConfigManager.reset();
                        notifications.show('Configuration reset to defaults', 'success');
                        // Refresh the tab to show new values
                        const event = new Event('click');
                        document.querySelector('[data-tab="config"]')?.dispatchEvent(event);
                    }
                }
            });
            
            const buttonsDiv = document.createElement('div');
            buttonsDiv.style.cssText = 'display: flex; gap: 10px;';
            buttonsDiv.appendChild(exportBtn);
            buttonsDiv.appendChild(importBtn);
            buttonsDiv.appendChild(resetBtn);
            
            backupDiv.appendChild(buttonsDiv);
            container.appendChild(backupDiv);

            // Optimization suggestions
            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.style.cssText = `
                background: rgba(0,0,0,0.3);
                padding: 15px;
                border-radius: 8px;
            `;
            
            const updateSuggestions = () => {
                const suggestions = window.performanceConfigManager ? 
                    window.performanceConfigManager.getOptimizationSuggestions() : [];
                
                suggestionsDiv.innerHTML = '<h4 style="color: #ecf0f1; margin-bottom: 10px;">Optimization Suggestions</h4>';
                
                if (suggestions.length > 0) {
                    suggestions.forEach((suggestion, index) => {
                        const color = suggestion.priority === 'high' ? '#e74c3c' : 
                                     suggestion.priority === 'medium' ? '#f39c12' : '#95a5a6';
                        
                        const suggestionDiv = document.createElement('div');
                        suggestionDiv.style.cssText = 'margin-bottom: 10px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 4px;';
                        
                        // Create apply button for each suggestion
                        let applyButton = '';
                        let actionFunction = null;
                        
                        if (suggestion.message.includes('Low cache hit rate')) {
                            applyButton = `<button class="apply-suggestion-btn" data-action="increase-cache" style="
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                border: none;
                                padding: 6px 12px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 12px;
                                margin-top: 8px;
                            ">Apply Cache Optimization</button>`;
                        } else if (suggestion.message.includes('High memory usage')) {
                            applyButton = `<button class="apply-suggestion-btn" data-action="reduce-memory" style="
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                border: none;
                                padding: 6px 12px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 12px;
                                margin-top: 8px;
                            ">Apply Memory Optimization</button>`;
                        } else if (suggestion.message.includes('High execution times')) {
                            applyButton = `<button class="apply-suggestion-btn" data-action="enable-batching" style="
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                border: none;
                                padding: 6px 12px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 12px;
                                margin-top: 8px;
                            ">Enable Performance Mode</button>`;
                        }
                        
                        suggestionDiv.innerHTML = `
                            <div style="color: ${color}; font-weight: bold;">${suggestion.message}</div>
                            <div style="color: #95a5a6; font-size: 12px; margin-top: 5px;">${suggestion.action}</div>
                            ${applyButton}
                        `;
                        
                        suggestionsDiv.appendChild(suggestionDiv);
                        
                        // Add event listeners to apply buttons
                        const btn = suggestionDiv.querySelector('.apply-suggestion-btn');
                        if (btn) {
                            btn.addEventListener('click', (e) => {
                                const action = e.target.dataset.action;
                                
                                if (action === 'increase-cache' && window.performanceConfigManager) {
                                    // Increase cache sizes
                                    window.performanceConfigManager.set('cache.graphql.maxSize', 400);
                                    window.performanceConfigManager.set('cache.graphql.ttl', 900000);
                                    window.performanceConfigManager.set('cache.scraper.maxSize', 200);
                                    window.performanceConfigManager.set('cache.general.maxSize', 200);
                                    
                                    // Also adjust cache manager if available
                                    if (window.cacheManager) {
                                        window.cacheManager.stores.forEach((store, name) => {
                                            store.maxSize = Math.min(store.maxSize * 1.5, 500);
                                        });
                                    }
                                    
                                    notifications.show('Cache sizes increased and TTL values adjusted', 'success');
                                    updateSuggestions();
                                } else if (action === 'reduce-memory' && window.performanceConfigManager) {
                                    // Enable memory optimizations
                                    window.performanceConfigManager.set('memory.autoCleanup', true);
                                    window.performanceConfigManager.set('memory.cleanupThreshold', 50 * 1024 * 1024);
                                    window.performanceConfigManager.set('cache.graphql.maxSize', 100);
                                    window.performanceConfigManager.set('cache.dom.maxSize', 25);
                                    
                                    // Trigger immediate cleanup
                                    if (window.cacheManager) {
                                        window.cacheManager.cleanup();
                                    }
                                    
                                    notifications.show('Memory optimization enabled and cache sizes reduced', 'success');
                                    updateSuggestions();
                                } else if (action === 'enable-batching' && window.performanceConfigManager) {
                                    // Enable performance optimizations
                                    window.performanceConfigManager.set('dom.batchingEnabled', true);
                                    window.performanceConfigManager.set('taskQueue.enabled', true);
                                    window.performanceConfigManager.set('taskQueue.defaultConcurrency', 5);
                                    window.performanceConfigManager.set('network.requestBatching', true);
                                    
                                    // Apply performance profile
                                    window.performanceConfigManager.applyProfile('performance');
                                    
                                    notifications.show('Performance optimizations enabled', 'success');
                                    updateSuggestions();
                                }
                            });
                        }
                    });
                } else {
                    const successDiv = document.createElement('div');
                    successDiv.style.cssText = 'color: #27ae60;';
                    successDiv.innerHTML = '✅ No optimization needed - performance is optimal!';
                    suggestionsDiv.appendChild(successDiv);
                }
            };
            
            updateSuggestions();
            setInterval(updateSuggestions, 5000);
            container.appendChild(suggestionsDiv);

            return container;
        }

        /**
         * Create floating performance metrics widget
         */
        createPerformanceWidget() {
            // Remove existing widget if any
            const existing = document.getElementById('stash-performance-widget');
            if (existing) existing.remove();

            const widget = document.createElement('div');
            widget.id = 'stash-performance-widget';
            widget.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                z-index: 9998;
                background: linear-gradient(135deg, #1e1e2e 0%, #2a2a3e 100%);
                border: 2px solid rgba(255,255,255,0.1);
                border-radius: 12px;
                padding: 12px;
                min-width: 200px;
                max-width: 300px;
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 11px;
                color: rgba(255,255,255,0.9);
                transition: all 0.3s ease;
                cursor: move;
            `;

            // Header
            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                padding-bottom: 8px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            `;

            const title = document.createElement('div');
            title.innerHTML = '⚡ <strong>Performance</strong>';
            title.style.cssText = `
                font-size: 12px;
                color: #667eea;
            `;

            const toggleBtn = document.createElement('button');
            toggleBtn.textContent = '−';
            toggleBtn.style.cssText = `
                background: transparent;
                border: none;
                color: rgba(255,255,255,0.6);
                cursor: pointer;
                font-size: 16px;
                padding: 0;
                width: 20px;
                height: 20px;
            `;

            header.appendChild(title);
            header.appendChild(toggleBtn);

            // Metrics container
            const metrics = document.createElement('div');
            metrics.id = 'performance-metrics-content';
            metrics.style.cssText = `
                display: grid;
                gap: 6px;
            `;

            widget.appendChild(header);
            widget.appendChild(metrics);
            document.body.appendChild(widget);

            // Make widget draggable
            this.makePerformanceWidgetDraggable(widget, header);

            // Toggle expand/collapse
            let expanded = true;
            toggleBtn.addEventListener('click', () => {
                expanded = !expanded;
                metrics.style.display = expanded ? 'grid' : 'none';
                toggleBtn.textContent = expanded ? '−' : '+';
                widget.style.minWidth = expanded ? '200px' : '120px';
            });

            // Start updating metrics
            this.updatePerformanceMetrics();
            setInterval(() => this.updatePerformanceMetrics(), 2000);

            // Register widget for z-index management
            this.registerWidget(widget);
            
            // Apply entrance animation
            if (window.animationController) {
                window.animationController.animate(widget, 'fadeIn', {
                    duration: 500
                });
            }
        }

        makePerformanceWidgetDraggable(widget, handle) {
            let isDragging = false;
            let currentX;
            let currentY;
            let initialX;
            let initialY;

            handle.addEventListener('mousedown', (e) => {
                isDragging = true;
                initialX = e.clientX - widget.offsetLeft;
                initialY = e.clientY - widget.offsetTop;
                widget.style.transition = 'none';
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                widget.style.left = currentX + 'px';
                widget.style.top = 'auto';
                widget.style.bottom = (window.innerHeight - currentY - widget.offsetHeight) + 'px';
            }, { passive: false });

            document.addEventListener('mouseup', () => {
                isDragging = false;
                widget.style.transition = 'all 0.3s ease';
            });
        }

        /**
         * Bring widget to front when clicked
         */
        bringToFront(widgetElement) {
            this.topZIndex++;
            widgetElement.style.zIndex = this.topZIndex;
        }
        
        /**
         * Register widget for z-index management
         */
        registerWidget(widgetElement, name) {
            this.widgets.set(name, widgetElement);
            
            // Add click handler to bring to front
            widgetElement.addEventListener('mousedown', () => {
                this.bringToFront(widgetElement);
            });
        }

        updatePerformanceMetrics() {
            const container = document.getElementById('performance-metrics-content');
            if (!container) return;

            const metrics = [];

            // Get performance stats
            if (window.performanceMonitor) {
                const summary = window.performanceMonitor.getSummary();
                
                // Check if we have actual metrics
                const hasMetrics = summary.totalMetrics > 0;
                
                metrics.push({
                    label: 'Avg Execution',
                    value: hasMetrics && summary.averageExecutionTime ? 
                        `${summary.averageExecutionTime.toFixed(1)}ms` : 'N/A',
                    color: !hasMetrics ? '#95a5a6' : 
                        summary.averageExecutionTime > 100 ? '#e74c3c' : '#27ae60'
                });
                
                metrics.push({
                    label: 'DOM Ops',
                    value: summary.totalDOMOperations || 0,
                    color: summary.totalDOMOperations > 50 ? '#e67e22' : '#27ae60'
                });
                
                // Add total operations metric
                metrics.push({
                    label: 'Total Ops',
                    value: summary.totalMetrics || 0,
                    color: '#3498db'
                });
            }

            // Get cache stats
            if (window.cacheManager) {
                const stats = window.cacheManager.getAllStats();
                if (stats.global) {
                    metrics.push({
                        label: 'Cache Hit Rate',
                        value: stats.global.hitRate || '0%',
                        color: parseFloat(stats.global.hitRate) > 70 ? '#27ae60' : '#e67e22'
                    });
                }
            }

            // Memory usage
            if (performance.memory) {
                const mb = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
                metrics.push({
                    label: 'Memory',
                    value: `${mb}MB`,
                    color: performance.memory.usedJSHeapSize > 100 * 1024 * 1024 ? '#e74c3c' : '#27ae60'
                });
            }

            // Performance score
            if (window.performanceConfigManager) {
                const score = window.performanceConfigManager.getPerformanceScore();
                metrics.push({
                    label: 'Score',
                    value: `${score}/100`,
                    color: score > 80 ? '#27ae60' : score > 60 ? '#e67e22' : '#e74c3c'
                });
            }

            // Render metrics
            container.innerHTML = metrics.map(m => `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: rgba(255,255,255,0.6);">${m.label}:</span>
                    <span style="color: ${m.color}; font-weight: 600;">${m.value}</span>
                </div>
            `).join('');
        }

        async showHealthDashboard() {
            // Remove existing
            const existing = document.querySelector('#as-health-wrap');
            if (existing) existing.remove();

            const wrap = document.createElement('div');
            wrap.id = 'as-health-wrap';
            wrap.style.cssText = 'position:fixed; inset:0; z-index:10020; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.55); backdrop-filter: blur(4px)';
            const card = document.createElement('div');
            card.style.cssText = 'width:860px; max-height:85vh; overflow:auto; background:#263645; color:#ecf0f1; border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,0.5); padding:18px; border:1px solid rgba(255,255,255,0.08)';
            card.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                    <h3 style="margin:0; color:#1abc9c;">Automation Health</h3>
                    <div style="display:flex; gap:8px;">
                        <button id="as-health-refresh" style="background:#1abc9c;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-weight:600;">Refresh</button>
                        <button id="as-health-close" style="background:#7f8c8d;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;">Close</button>
                    </div>
                </div>
                <div id="as-health-kpis" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:12px;"></div>
                <div id="as-health-trend" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; margin-bottom:12px;"></div>
                <div id="as-health-errors" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px;"></div>
            `;

            wrap.appendChild(card);
            document.body.appendChild(wrap);

            const render = async () => {
                const stats = await this.historyManager.getStatistics();
                const history = await this.historyManager.getAllHistory();

                // KPIs
                const kpis = document.querySelector('#as-health-kpis');
                const pct = stats.totalAutomations ? Math.round((stats.successfulAutomations / stats.totalAutomations) * 100) : 0;
                const avgMs = stats.averageDurationMs || 0;
                kpis.innerHTML = '';
                const mk = (title, value) => `<div style="background:rgba(26,188,156,0.08); border:1px solid rgba(26,188,156,0.25); border-radius:8px; padding:10px;"><div style=\"font-size:12px; opacity:.8\">${title}</div><div style=\"font-size:18px; font-weight:700;\">${value}</div></div>`;
                kpis.innerHTML = [
                    mk('Total runs', stats.totalAutomations),
                    mk('Success rate', `${pct}%`),
                    mk('Avg duration', `${Math.round(avgMs)} ms`),
                    mk('Errors', stats.errorsCount)
                ].join('');

                // Trend (group by day)
                const byDay = new Map();
                history.forEach(h => {
                    const d = new Date(h.timestamp);
                    const key = isNaN(d) ? 'unknown' : d.toISOString().slice(0, 10);
                    const t = byDay.get(key) || { total: 0, ok: 0 };
                    t.total += 1; if (h.success) t.ok += 1; byDay.set(key, t);
                });
                const trend = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
                const trendEl = card.querySelector('#as-health-trend');
                const bars = trend.map(([day, t]) => {
                    const rate = t.total ? Math.round((t.ok / t.total) * 100) : 0;
                    return `<div style=\"display:flex; align-items:center; gap:8px; margin:6px 0;\"><div style=\"width:85px; opacity:.8; font-size:12px;\">${day}</div><div style=\"flex:1; background:rgba(255,255,255,0.08); height:10px; border-radius:6px; overflow:hidden;\"><div style=\"width:${rate}%; background:#1abc9c; height:100%\"></div></div><div style=\"width:40px; text-align:right; font-size:12px; opacity:.8;\">${rate}%</div></div>`;
                }).join('');
                trendEl.innerHTML = `<div style=\"font-weight:600; margin-bottom:6px;\">Daily success rate</div>${bars || '<div style="opacity:.7; font-size:12px;">No data yet</div>'}`;

                // Recent errors
                const errorsEl = card.querySelector('#as-health-errors');
                const fails = history.filter(h => !h.success).slice(0, 10);
                errorsEl.innerHTML = `<div style=\"font-weight:600; margin-bottom:6px;\">Recent failures</div>` + (fails.length ? fails.map(h => {
                    const when = new Date(h.timestamp).toLocaleString();
                    const msg = (h.errors && h.errors.join('; ')) || 'Unknown error';
                    return `<div style=\"padding:8px; border-radius:6px; background:rgba(231,76,60,0.08); border:1px solid rgba(231,76,60,0.25); margin-bottom:6px;\"><div style=\"font-size:12px; opacity:.8\">${when} • Scene ${h.sceneId || '?'} • ${h.sourcesUsed?.join(', ') || ''}</div><div style=\"font-size:13px;\">${msg}</div></div>`;
                }).join('') : '<div style="opacity:.7; font-size:12px;">No failures</div>');
            };

            await render();
            card.querySelector('#as-health-refresh').onclick = render;
            card.querySelector('#as-health-close').onclick = () => wrap.remove();
        }
        getEditRoot() {
            return this.observerRoot || this.findObserverRoot() || document;
        }

        async waitForGraphQLMutation(fallbackMs = 1200) {
            return new Promise((resolve) => {
                let settled = false;
                const handler = () => {
                    if (settled) return;
                    settled = true;
                    window.removeEventListener('stash:graphql-mutation', handler);
                    resolve();
                };
                window.addEventListener('stash:graphql-mutation', handler, { once: true });
                setTimeout(() => {
                    if (settled) return;
                    settled = true;
                    window.removeEventListener('stash:graphql-mutation', handler);
                    resolve();
                }, fallbackMs);
            });
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

            // Add event listeners (passive only where safe - not for mousemove since we need preventDefault)
            dragHandle.addEventListener('mousedown', dragStart, { passive: true });
            document.addEventListener('mousemove', dragMove, { passive: false });
            document.addEventListener('mouseup', dragEnd, { passive: true });
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
            // Adaptive debounce based on recent churn
            let currentDelay = 800;
            const debouncedUpdate = (...args) => {
                // Recreate debounce with currentDelay dynamically
                if (this._debouncedObserverFn) {
                    this._debouncedObserverFn.cancel && this._debouncedObserverFn.cancel();
                }
                this._debouncedObserverFn = this.debounce(() => {
                    this.updateStatusFromDOM();
                    currentDelay = Math.max(400, Math.floor(currentDelay * 0.9));
                }, currentDelay);
                this._debouncedObserverFn(...args);
            };

            // (Re)create observer
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
            }

            this.mutationObserver = new MutationObserver((mutations) => {
                let shouldUpdate = false;
                // Increase delay if we see heavy churn in a single batch
                if (mutations && mutations.length > 50) {
                    currentDelay = Math.min(1200, Math.floor(currentDelay * 1.2));
                }

                for (const mutation of mutations) {
                    // Attribute changes mostly for organized button
                    if (mutation.type === 'attributes' && (mutation.attributeName === 'class' || mutation.attributeName === 'aria-pressed' || mutation.attributeName === 'data-organized')) {
                        const target = mutation.target;
                        if (target && (target.title === 'Organized' || target.classList?.contains('organized-button'))) {
                            shouldUpdate = true;
                            break;
                        }
                    }

                    // Added nodes that might contain scraper UI or edit fields
                    if (mutation.type === 'childList' && mutation.addedNodes && mutation.addedNodes.length) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === Node.ELEMENT_NODE && node.querySelector) {
                                if (
                                    node.querySelector('button[title="Organized"], button.organized-button') ||
                                    node.querySelector('input[placeholder*="stash" i], input[id*="stash" i]') ||
                                    node.querySelector('input[placeholder*="porndb" i], input[id*="tpdb" i]') ||
                                    node.querySelector('.dropdown-menu .dropdown-item')
                                ) {
                                    shouldUpdate = true;
                                    break;
                                }
                            }
                        }
                        if (shouldUpdate) break;
                    }
                }

                if (shouldUpdate) debouncedUpdate();
            });

            // Try to scope to scene/edit containers first
            const root = this.findObserverRoot() || document.body;
            this.observerRoot = root;
            this.editRoot = root;

            if (root) {
                this.mutationObserver.observe(root, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'aria-pressed', 'data-organized']
                });
            } else {
                setTimeout(() => this.initializeMutationObserver(), 100);
            }
        }

        initializeShortcuts() {
            // Store reference to UIManager for library callbacks
            window.stashUIManager = this;
            
            // Initialize the keyboard shortcuts library if not already initialized
            if (window.KeyboardShortcutsManager && !window.keyboardShortcuts) {
                // Load saved shortcuts or use defaults
                const savedShortcuts = GM_getValue('keyboard_shortcuts', null);
                const config = savedShortcuts ? { shortcuts: JSON.parse(savedShortcuts) } : {};
                
                window.keyboardShortcuts = new window.KeyboardShortcutsManager(config);
                console.log('🎹 Keyboard shortcuts library initialized');
            }
            
            // Set up action callbacks for the keyboard library
            if (window.keyboardShortcuts) {
                // Register all action callbacks
                window.keyboardShortcuts.onAction('startAutomation', () => {
                    if (!this.automationInProgress) {
                        this.startAutomation();
                    }
                });
                
                window.keyboardShortcuts.onAction('startAutomationSilent', () => {
                    if (!this.automationInProgress) {
                        this.startAutomation(true);
                    }
                });
                
                window.keyboardShortcuts.onAction('toggleMinimize', () => {
                    if (this.isMinimized) {
                        this.expand();
                    } else {
                        this.minimize();
                    }
                });
                
                window.keyboardShortcuts.onAction('cancelAutomation', () => {
                    if (this.automationInProgress) {
                        this.cancelAutomation();
                    }
                });
                
                window.keyboardShortcuts.onAction('openConfig', () => {
                    this.openConfigDialog();
                });
                
                window.keyboardShortcuts.onAction('showHelp', () => {
                    if (window.keyboardShortcuts.showHelpDialog) {
                        window.keyboardShortcuts.showHelpDialog();
                    }
                });
                
                window.keyboardShortcuts.onAction('applyScrapedData', () => {
                    const applyBtn = document.querySelector('.btn-primary[title*="Apply"]');
                    if (applyBtn) applyBtn.click();
                });
                
                window.keyboardShortcuts.onAction('saveScene', () => {
                    const saveBtn = document.querySelector('.btn-primary[title*="Save"]');
                    if (saveBtn) saveBtn.click();
                });
                
                window.keyboardShortcuts.onAction('organizeScene', () => {
                    const organizeBtn = document.querySelector('button[title="Organized"]');
                    if (organizeBtn) organizeBtn.click();
                });
                
                window.keyboardShortcuts.onAction('scrapeStashDB', async () => {
                    if (this.automator) {
                        await this.automator.scrapeStashDB();
                    }
                });
                
                window.keyboardShortcuts.onAction('scrapeThePornDB', async () => {
                    if (this.automator) {
                        await this.automator.scrapeThePornDB();
                    }
                });
                
                window.keyboardShortcuts.onAction('toggleTheme', () => {
                    if (window.themeManager) {
                        const allThemes = window.themeManager.getAllThemes();
                        const themeNames = Object.keys(allThemes).filter(name => name !== 'system');
                        const currentIndex = themeNames.indexOf(window.themeManager.currentTheme);
                        const nextIndex = (currentIndex + 1) % themeNames.length;
                        const nextTheme = themeNames[nextIndex];
                        window.themeManager.applyTheme(nextTheme);
                        notifications.show(`Theme switched to ${allThemes[nextTheme].name}`, 'success');
                    }
                });
                
                window.keyboardShortcuts.onAction('togglePerformanceMonitor', () => {
                    const perfWidget = document.getElementById('performance-widget');
                    if (perfWidget) {
                        perfWidget.style.display = perfWidget.style.display === 'none' ? 'block' : 'none';
                    }
                });
                
                window.keyboardShortcuts.onAction('toggleDebugMode', () => {
                    const currentDebug = GM_getValue('debugMode', false);
                    GM_setValue('debugMode', !currentDebug);
                    notifications.show(`Debug mode ${!currentDebug ? 'enabled' : 'disabled'}`, 'success');
                });
                
                // Additional UI Actions
                window.keyboardShortcuts.onAction('openEnhancedSettings', () => {
                    this.showEnhancedSettings();
                });
                
                window.keyboardShortcuts.onAction('toggleSummaryWidget', () => {
                    const widget = document.getElementById('automation-summary-widget');
                    if (widget) {
                        widget.style.display = widget.style.display === 'none' ? 'block' : 'none';
                    }
                });
                
                window.keyboardShortcuts.onAction('toggleNotifications', () => {
                    const enabled = !GM_getValue('notifications_enabled', true);
                    GM_setValue('notifications_enabled', enabled);
                    notifications.show(`Notifications ${enabled ? 'enabled' : 'disabled'}`, 'success');
                });
                
                window.keyboardShortcuts.onAction('clearNotifications', () => {
                    const notifs = document.querySelectorAll('.stash-notification');
                    notifs.forEach(n => n.remove());
                    notifications.show('All notifications cleared', 'success');
                });
                
                // Performance Actions
                window.keyboardShortcuts.onAction('clearCache', () => {
                    if (window.cacheManager) {
                        window.cacheManager.clear();
                        notifications.show('All caches cleared', 'success');
                    }
                });
                
                window.keyboardShortcuts.onAction('clearGraphQLCache', () => {
                    if (window.cacheManager) {
                        window.cacheManager.clear('graphql');
                        notifications.show('GraphQL cache cleared', 'success');
                    }
                });
                
                window.keyboardShortcuts.onAction('clearDOMCache', () => {
                    if (window.cacheManager) {
                        window.cacheManager.clear('dom');
                        notifications.show('DOM cache cleared', 'success');
                    }
                });
                
                window.keyboardShortcuts.onAction('exportPerformanceData', () => {
                    if (window.performanceMonitor) {
                        const data = window.performanceMonitor.exportMetrics();
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `performance-data-${Date.now()}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        notifications.show('Performance data exported', 'success');
                    }
                });
                
                window.keyboardShortcuts.onAction('optimizePerformance', () => {
                    if (window.performanceConfigManager) {
                        window.performanceConfigManager.applyProfile('performance');
                        notifications.show('Performance optimizations applied', 'success');
                    }
                });
                
                // Navigation Actions
                window.keyboardShortcuts.onAction('previousScene', () => {
                    const prevBtn = document.querySelector('a[title="Previous"]');
                    if (prevBtn) prevBtn.click();
                });
                
                window.keyboardShortcuts.onAction('nextScene', () => {
                    const nextBtn = document.querySelector('a[title="Next"]');
                    if (nextBtn) nextBtn.click();
                });
                
                window.keyboardShortcuts.onAction('goToScenes', () => {
                    window.location.href = '/scenes';
                });
                
                window.keyboardShortcuts.onAction('goToPerformers', () => {
                    window.location.href = '/performers';
                });
                
                window.keyboardShortcuts.onAction('goToStudios', () => {
                    window.location.href = '/studios';
                });
                
                window.keyboardShortcuts.onAction('goToTags', () => {
                    window.location.href = '/tags';
                });
                
                window.keyboardShortcuts.onAction('goToSettings', () => {
                    window.location.href = '/settings';
                });
                
                // Data Actions
                window.keyboardShortcuts.onAction('backupSettings', () => {
                    const settings = {
                        config: getAllConfig(),
                        shortcuts: window.keyboardShortcuts ? window.keyboardShortcuts.exportConfig() : {},
                        performance: window.performanceConfigManager ? window.performanceConfigManager.export() : {},
                        theme: GM_getValue('ui_theme', 'dark'),
                        animations: GM_getValue('widget_animations', '{}')
                    };
                    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `stash-settings-backup-${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    notifications.show('Settings backed up successfully', 'success');
                });
                
                window.keyboardShortcuts.onAction('restoreSettings', () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'application/json';
                    input.addEventListener('change', async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            try {
                                const text = await file.text();
                                const settings = JSON.parse(text);
                                
                                // Restore each setting type
                                if (settings.config) {
                                    Object.entries(settings.config).forEach(([key, value]) => {
                                        setConfig(key, value);
                                    });
                                }
                                if (settings.shortcuts && window.keyboardShortcuts) {
                                    window.keyboardShortcuts.importConfig(settings.shortcuts);
                                }
                                if (settings.performance && window.performanceConfigManager) {
                                    window.performanceConfigManager.import(settings.performance);
                                }
                                if (settings.theme) {
                                    GM_setValue('ui_theme', settings.theme);
                                    if (window.themeManager) {
                                        window.themeManager.applyTheme(settings.theme);
                                    }
                                }
                                if (settings.animations) {
                                    GM_setValue('widget_animations', settings.animations);
                                }
                                
                                notifications.show('Settings restored successfully! Refresh page to apply all changes.', 'success');
                            } catch (error) {
                                notifications.show('Failed to restore settings: ' + error.message, 'error');
                            }
                        }
                    });
                    input.click();
                });
                
                window.keyboardShortcuts.onAction('resetSettings', () => {
                    if (confirm('Are you sure you want to reset all settings to defaults?')) {
                        // Reset all configs
                        Object.keys(CONFIG).forEach(key => {
                            GM_deleteValue(CONFIG[key]);
                        });
                        // Reset other settings
                        GM_deleteValue('ui_theme');
                        GM_deleteValue('widget_animations');
                        GM_deleteValue('keyboard_shortcuts');
                        GM_deleteValue('performance_config');
                        
                        notifications.show('Settings reset to defaults! Refresh page to apply.', 'success');
                    }
                });
                
                // Scraping Actions
                window.keyboardShortcuts.onAction('scrapeAll', async () => {
                    if (this.automator) {
                        await this.automator.scrapeStashDB();
                        await this.automator.scrapeThePornDB();
                        notifications.show('Scraped all sources', 'success');
                    }
                });
                
                window.keyboardShortcuts.onAction('rescrapeScene', async () => {
                    if (this.automator) {
                        // Force re-scrape by clearing status
                        this.statusTracker.clearStatus();
                        await this.automator.scrapeStashDB();
                        await this.automator.scrapeThePornDB();
                        notifications.show('Re-scraped current scene', 'success');
                    }
                });
                
                window.keyboardShortcuts.onAction('createPerformers', async () => {
                    if (this.automator) {
                        await this.automator.createNewPerformers();
                        notifications.show('Created new performers', 'success');
                    }
                });
                
                // Batch Actions
                window.keyboardShortcuts.onAction('selectAll', () => {
                    const checkboxes = document.querySelectorAll('.scene-card input[type="checkbox"]');
                    checkboxes.forEach(cb => cb.checked = true);
                    notifications.show('All scenes selected', 'success');
                });
                
                window.keyboardShortcuts.onAction('deselectAll', () => {
                    const checkboxes = document.querySelectorAll('.scene-card input[type="checkbox"]');
                    checkboxes.forEach(cb => cb.checked = false);
                    notifications.show('All scenes deselected', 'success');
                });
                
                window.keyboardShortcuts.onAction('invertSelection', () => {
                    const checkboxes = document.querySelectorAll('.scene-card input[type="checkbox"]');
                    checkboxes.forEach(cb => cb.checked = !cb.checked);
                    notifications.show('Selection inverted', 'success');
                });
                
                // Automation control actions
                window.keyboardShortcuts.onAction('pauseAutomation', () => {
                    if (this.automationInProgress) {
                        this.automationPaused = true;
                        notifications.show('Automation paused', 'info');
                    }
                });
                
                window.keyboardShortcuts.onAction('resumeAutomation', () => {
                    if (this.automationPaused) {
                        this.automationPaused = false;
                        notifications.show('Automation resumed', 'success');
                    }
                });
                
                window.keyboardShortcuts.onAction('skipCurrentSource', () => {
                    if (this.automator) {
                        this.automator.skipCurrentSourceRequested = true;
                        notifications.show('Skipping current source', 'info');
                    }
                });
            } else {
                console.warn('Keyboard shortcuts library not available, using basic fallback');
                window.addEventListener('keydown', (e) => {
                    if (!getConfig(CONFIG.ENABLE_KEYBOARD_SHORTCUTS)) return;
                    const t = e.target;
                    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
                    if (typing) return;
                    
                    // Only handle ESC for cancel as a fallback
                    if (e.key === 'Escape' && this.automationInProgress) {
                        e.preventDefault();
                        this.cancelAutomation();
                    }
                }, true);
            }
        }

        showShortcutHelp() {
            const map = { ...DEFAULTS[CONFIG.SHORTCUT_MAP], ...(getConfig(CONFIG.SHORTCUT_MAP) || {}) };
            const wrap = document.createElement('div');
            wrap.style.cssText = 'position:fixed; inset:0; z-index:10030; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.55)';
            const card = document.createElement('div');
            card.style.cssText = 'min-width:360px; background:#263645; color:#ecf0f1; border-radius:12px; padding:16px; border:1px solid rgba(255,255,255,0.08)';
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                  <h3 style="margin:0;color:#1abc9c;">Keyboard Shortcuts</h3>
                  <button id="ks-close" style="background:#7f8c8d;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;">Close</button>
                </div>
                <div style="font-size:13px;line-height:1.6">
                  <div>Apply scraped data: <strong>${map.apply}</strong></div>
                  <div>Save: <strong>${map.save}</strong></div>
                  <div>Organize: <strong>${map.organize}</strong></div>
                  <div>Toggle panel: <strong>${map.toggle}</strong></div>
                  <div>Help: <strong>${map.help}</strong></div>
                  <div>Start automation (confirm): <strong>${map.startRunConfirm}</strong></div>
                  <div>Start automation (auto-confirm): <strong>${map.startRunAuto}</strong></div>
                </div>
            `;
            wrap.appendChild(card);
            document.body.appendChild(wrap);
            card.querySelector('#ks-close').onclick = () => wrap.remove();
            wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
        }

        findObserverRoot() {
            return (
                document.querySelector('.entity-edit-panel') ||
                document.querySelector('.scene-edit-details') ||
                document.querySelector('.edit-panel') ||
                document.querySelector('form[class*="edit" i]') ||
                document.querySelector('#root') ||
                null
            );
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
        /**
         * Wait for any selector to appear within the given root
         * @param {string[]} selectors
         * @param {{timeout?: number, root?: Element}} opts
         */
        async waitForElement(selectors, opts = {}) {
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
                    // Respect automation cancellation if available in this context
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
         * Wait until an element matching selectors exists AND is visible in viewport
         * Visibility means: present, display not none, within viewport bounds (with margin)
         */
        async waitForVisibleElement(selectors, opts = {}) {
            const timeout = opts.timeout ?? getConfig(CONFIG.VISIBLE_WAIT_TIMEOUT_MS);
            const root = opts.root ?? document;
            const margin = opts.margin ?? 8;

            const isVisible = (el) => {
                if (!el || !el.isConnected) return false;
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return false;
                return (
                    rect.bottom > margin &&
                    rect.right > margin &&
                    rect.top < (window.innerHeight - margin) &&
                    rect.left < (window.innerWidth - margin)
                );
            };

            // Try immediate match
            for (const sel of selectors) {
                const el = root.querySelector(sel);
                if (el && isVisible(el)) return el;
            }

            // Otherwise observe mutations and scroll into view when found
            const found = await this.waitForElement(selectors, { timeout, root });
            if (!found) throw new Error('waitForVisibleElement: element not found');

            if (!isVisible(found) && getConfig(CONFIG.FAST_CLICK_SCROLL)) {
                try { found.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' }); } catch (_) {
                    try { found.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' }); } catch (_) { }
                }
            }
            return found;
        }

        /**
         * Fast click: wait for visibility, focus, click with minimal delay
         */
        async clickFast(selectorsOrElement, opts = {}) {
            const el = (selectorsOrElement instanceof Element)
                ? selectorsOrElement
                : await this.waitForVisibleElement([].concat(selectorsOrElement), opts);
            if (!el) throw new Error('clickFast: element not found');
            el.focus({ preventScroll: true });
            el.click();
            return el;
        }

        /**
         * Detect outcome of a scraper run by watching UI signals (toast/modals/empty lists)
         * Returns { found: boolean, reason?: string }
         */
        async detectScraperOutcome(timeoutMs = getConfig(CONFIG.SCRAPER_OUTCOME_TIMEOUT_MS)) {
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

            // Poll lightweight rather than heavy observers for outcome window
            while (Date.now() < endBy) {
                // If user asked to skip current source, exit immediately as not found
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
                await this.wait(150);
            }
            // Timeout: ambiguous, assume not found to be safe
            return { found: false, reason: 'timeout waiting for scraper outcome' };
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

            // Use global summary widget if available, otherwise create local one
            if (!this.summaryWidget) {
                if (window.globalSummaryWidget) {
                    this.summaryWidget = window.globalSummaryWidget;
                } else {
                    this.summaryWidget = new AutomationSummaryWidget();
                }
            }

            // Check if we're on a scene page
            const urlObj = new URL(window.location.href);
            const pathname = urlObj.pathname;
            const isSceneDetail = /\/scenes\/(\d+)/.test(pathname);
            const isScenesBrowse = pathname.startsWith('/scenes') && !isSceneDetail && !pathname.includes('/scenes/markers');

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

            // Add re-scrape UI if on scene detail page and sources are already scraped
            if (isSceneDetail) {
                this.createRescrapeUI().then(rescrapeUI => {
                    if (rescrapeUI) {
                        this.panel.insertBefore(rescrapeUI, this.panel.lastChild);
                    }
                });
            }

            const buttons = this.createButtons();
            this.panel.appendChild(buttons);

            document.body.appendChild(this.panel);
            
            // Apply animation if available
            if (window.animationController && window.animationController.animate) {
                window.animationController.animate(this.panel, 'fadeInUp', {
                    duration: 300,
                    easing: 'ease-out'
                });
            }
            
            this.isMinimized = false;

            // Initialize status tracking after panel is created
            this.initializeStatusTracking();
            
            // Create performance widget if libraries are available
            if (window.performanceMonitor && window.cacheManager) {
                this.createPerformanceWidget();
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

            // Quick settings (inline checkboxes)
            const quick = document.createElement('div');
            quick.style.cssText = 'background: rgba(255,255,255,0.06); padding: 10px; border-radius: 8px; margin-bottom: 12px;';
            const rows = [
                { key: CONFIG.ENABLE_KEYBOARD_SHORTCUTS, label: 'Keyboard shortcuts' },
                { key: CONFIG.AUTO_CREATE_PERFORMERS, label: 'Auto create entities' },
                { key: CONFIG.AUTO_ORGANIZE, label: 'Auto organize after save' },
                { key: CONFIG.AUTO_APPLY_CHANGES, label: 'Auto-apply changes (no confirmation)' },
                { key: CONFIG.DEBUG, label: 'Debug mode' },
            ];
            rows.forEach(r => {
                const row = document.createElement('label');
                row.style.cssText = 'display:flex; align-items:center; gap:8px; font-size:12px; margin:4px 0;';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = !!getConfig(r.key);
                cb.addEventListener('change', () => setConfig(r.key, cb.checked));
                const span = document.createElement('span'); span.textContent = r.label;
                row.appendChild(cb); row.appendChild(span);
                quick.appendChild(row);
            });
            content.appendChild(quick);

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

            const urlObj = new URL(window.location.href);
            const pathname = urlObj.pathname;
            const isSceneDetail = /\/scenes\/(\d+)/.test(pathname);
            const isScenesBrowse = pathname.startsWith('/scenes') && !isSceneDetail && !pathname.includes('/scenes/markers');

            if (isSceneDetail) {
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
                // Removed "Run Selected" on scene detail per user request
            } else {
                if (!isScenesBrowse) {
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
            const healthBtn = document.createElement('button');
            healthBtn.textContent = '📊 Health';
            healthBtn.style.cssText = `
                background: #1abc9c;
                color: white;
                border: none;
                padding: 10px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                transition: all 0.2s ease;
            `;
            healthBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showHealthDashboard();
            });

            // Add Enhanced Settings button for performance libraries
            const enhancedBtn = document.createElement('button');
            enhancedBtn.textContent = '🚀 Enhanced';
            enhancedBtn.style.cssText = `
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 10px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                transition: all 0.2s ease;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            `;
            enhancedBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showEnhancedSettings();
            });

            buttons.appendChild(configBtn);
            buttons.appendChild(enhancedBtn);
            buttons.appendChild(healthBtn);
            return buttons;
        }

        // Selection UI removed
        minimize() {
            if (this.panel) {
                this.panel.style.display = 'none';
            }
            this.createMinimizedButton();
            this.isMinimized = true;
            // Pause observer to save cycles
            if (this.mutationObserver) this.mutationObserver.disconnect();
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
            // Resume observer
            this.initializeMutationObserver();
        }

        // Selection UI removed (toolbar, checkboxes, helpers)

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
                max-width: 760px;
                width: 92%;
                max-height: 86vh;
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
                { key: CONFIG.PREFER_HIGHER_RES_THUMBNAILS, label: '🖼️ Prefer higher resolution thumbnails' },
                { key: CONFIG.ENABLE_KEYBOARD_SHORTCUTS, label: '⌨️ Enable keyboard shortcuts' },
                { key: CONFIG.DEBUG, label: '🐞 Enable debug logging' }
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
            // Additional preferences (Dry-run, Profiles)
            const extraSection = document.createElement('div');
            extraSection.style.cssText = 'margin: 20px 0; padding: 15px; background: rgba(52,152,219,0.08); border: 1px solid rgba(52,152,219,0.2); border-radius: 8px;';
            extraSection.innerHTML = `
                <h3 style="margin:0 0 10px 0; color:#3498db; font-size:16px;">Profiles</h3>
                <div style="display:flex; gap:10px; align-items:center; margin:8px 0;">
                    <label style="min-width:120px;">Active profile:</label>
                    <input type="text" id="activeProfileName" value="${this.activeProfileName}" placeholder="e.g., Aggressive TPDB" style="flex:1; padding:8px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.08); color:#ecf0f1;">
                    <button id="saveProfileBtn">Save Profile</button>
                </div>
                <div style="display:flex; gap:10px; align-items:center; margin:8px 0;">
                    <button id="loadProfileBtn">Load Profile</button>
                    <button id="deleteProfileBtn">Delete Profile</button>
                    <button id="inspectProfileBtn">Inspect Profile</button>
                    <button id="manageProfilesBtn">Manage Profiles</button>
                </div>
            `;

            // (canonical editor removed)

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

            // Append sections together
            optionsContainer.appendChild(extraSection);
            optionsContainer.appendChild(graphqlSection);



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
            // Storage info section
            const storageSection = document.createElement('div');
            storageSection.style.cssText = `
                margin: 20px 0;
                padding: 15px;
                background: rgba(155, 89, 182, 0.08);
                border-radius: 8px;
                border: 1px solid rgba(155, 89, 182, 0.3);
            `;

            const storageTitle = document.createElement('h3');
            storageTitle.textContent = '💾 Storage Info';
            storageTitle.style.cssText = `
                margin: 0 0 10px 0;
                color: #9b59b6;
                font-size: 16px;
            `;

            const storageBody = document.createElement('div');
            storageBody.style.cssText = 'font-size: 13px; color: #bdc3c7; margin-bottom: 10px; white-space: pre-line;';
            storageBody.textContent = 'Loading...';

            const storageStats = document.createElement('div');
            storageStats.style.cssText = 'font-size: 13px; color: #ecf0f1; margin: 8px 0; white-space: pre-line;';

            const recentList = document.createElement('div');
            recentList.style.cssText = 'margin-top: 8px; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 8px;';

            const storageActions = document.createElement('div');
            storageActions.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap;';
            const refreshBtn = document.createElement('button');
            refreshBtn.textContent = '🔄 Refresh';
            refreshBtn.style.cssText = 'background: #8e44ad; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;';
            const clearBtn = document.createElement('button');
            clearBtn.textContent = '🧹 Clear History';
            clearBtn.style.cssText = 'background: #c0392b; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;';
            const clearOldBtn = document.createElement('button');
            clearOldBtn.textContent = '🗑️ Clear >30 days';
            clearOldBtn.style.cssText = 'background: #d35400; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;';
            const exportBtn = document.createElement('button');
            exportBtn.textContent = '📤 Export';
            exportBtn.style.cssText = 'background: #16a085; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;';
            const importBtn = document.createElement('button');
            importBtn.textContent = '📥 Import';
            importBtn.style.cssText = 'background: #2ecc71; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;';
            const backupBtn = document.createElement('button');
            backupBtn.textContent = '🧰 Backup (extended)';
            backupBtn.style.cssText = 'background: #1abc9c; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;';
            const restoreBtn = document.createElement('button');
            restoreBtn.textContent = '📦 Restore (extended)';
            restoreBtn.style.cssText = 'background: #2980b9; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;';
            const importInput = document.createElement('input');
            importInput.type = 'file';
            importInput.accept = 'application/json';
            importInput.style.display = 'none';
            storageActions.appendChild(refreshBtn);
            storageActions.appendChild(clearBtn);
            storageActions.appendChild(clearOldBtn);
            storageActions.appendChild(exportBtn);
            storageActions.appendChild(importBtn);
            storageActions.appendChild(backupBtn);
            storageActions.appendChild(restoreBtn);
            storageActions.appendChild(importInput);

            storageSection.appendChild(storageTitle);
            storageSection.appendChild(storageBody);
            storageSection.appendChild(storageStats);
            storageSection.appendChild(recentList);
            storageSection.appendChild(storageActions);

            const updateStorageInfo = async () => {
                try {
                    const info = await this.historyManager.getStorageInfo();
                    const stats = await this.historyManager.getStatistics();
                    storageBody.textContent = `Entries: ${info.entries}\nSize: ${info.sizeKB} KB\nKey: ${info.storageKey}\nMax Entries: ${info.maxEntries}`;
                    storageStats.textContent = `Success: ${stats.successfulAutomations}/${stats.totalAutomations} (${stats.successRate || 0}%)\nErrors: ${stats.errorsCount}\nSources: StashDB ${stats.sourcesUsed.stashdb}, ThePornDB ${stats.sourcesUsed.theporndb}`;
                    // Recent history preview (up to 5)
                    const all = await this.historyManager.getAllHistory();
                    const recent = all.slice(0, 5);
                    recentList.innerHTML = recent.length ? recent.map(h => {
                        const ok = h.success ? '✅' : '❌';
                        const counts = h.summary ? ` • A:${h.summary.actionsCount || 0} F:${h.summary.fieldsUpdatedCount || 0} W:${h.summary.warningsCount || 0}` : '';
                        const when = new Date(h.timestamp).toLocaleString();
                        return `<div style="font-size:12px; opacity:.9; margin:4px 0;">${ok} [${when}] ${h.sceneName || 'Scene ' + h.sceneId}${counts}</div>`;
                    }).join('') : '<div style="opacity:.7; font-size:12px;">No history yet</div>';
                } catch (err) {
                    storageBody.textContent = 'Failed to load storage info';
                    storageStats.textContent = '';
                    recentList.textContent = '';
                }
            };
            refreshBtn.addEventListener('click', updateStorageInfo);
            clearBtn.addEventListener('click', async () => {
                if (confirm('Clear all automation history? This cannot be undone.')) {
                    const ok = await this.historyManager.clearHistory();
                    notifications.show(ok ? 'History cleared' : 'Failed to clear history', ok ? 'success' : 'error');
                    updateStorageInfo();
                }
            });
            clearOldBtn.addEventListener('click', async () => {
                const removed = await this.historyManager.clearOldHistory(30);
                notifications.show(`Removed ${removed} entries older than 30 days`, 'info');
                updateStorageInfo();
            });
            exportBtn.addEventListener('click', async () => {
                const data = await this.historyManager.exportHistory();
                if (!data) {
                    notifications.show('Export failed', 'error');
                    return;
                }
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `automateStash-history-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 0);
            });
            backupBtn.addEventListener('click', async () => {
                try {
                    const payload = JSON.stringify(buildBackupObject(), null, 2);
                    const blob = new Blob([payload], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `automateStash-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
                } catch (_) {
                    notifications.show('Backup failed', 'error');
                }
            });
            restoreBtn.addEventListener('click', async () => {
                try {
                    const input = document.createElement('input');
                    input.type = 'file'; input.accept = 'application/json'; input.style.display = 'none';
                    document.body.appendChild(input);
                    input.onchange = async (e) => {
                        const file = e.target.files && e.target.files[0]; if (!file) return;
                        try {
                            const text = await file.text();
                            await restoreAllExtended(text);
                            notifications.show('Restore complete', 'success');
                            updateStorageInfo();
                        } catch (_) { notifications.show('Restore failed', 'error'); }
                        finally { input.remove(); }
                    };
                    input.click();
                } catch (_) { notifications.show('Restore failed', 'error'); }
            });
            importBtn.addEventListener('click', () => importInput.click());
            importInput.addEventListener('change', async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    const ok = await this.historyManager.importHistory(text);
                    notifications.show(ok ? 'Import successful' : 'Import failed', ok ? 'success' : 'error');
                    updateStorageInfo();
                } catch (_) {
                    notifications.show('Import failed', 'error');
                } finally {
                    importInput.value = '';
                }
            });
            // initial load
            updateStorageInfo();

            // Raw data viewer section
            const rawSection = document.createElement('div');
            rawSection.style.cssText = `
                margin: 20px 0;
                padding: 15px;
                background: rgba(44, 62, 80, 0.6);
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.12);
            `;
            rawSection.innerHTML = `
                <h3 style="margin:0 0 10px 0; color:#e67e22; font-size:16px; display:flex; align-items:center; gap:8px;">🧪 Raw Data Viewer</h3>
                <div style="font-size:12px; color:#bdc3c7; margin-bottom:10px;">Inspect raw JSON for debugging (GraphQL, status, history, config).</div>
                <div id="raw-buttons" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
            `;

            const btns = [
                { id: 'raw-scene', label: 'Current Scene (GraphQL)', color: '#2980b9' },
                { id: 'raw-status', label: 'Status Summary', color: '#16a085' },
                { id: 'raw-history', label: 'Automation History (last 10)', color: '#8e44ad' },
                { id: 'raw-config', label: 'Full Config', color: '#2c3e50' },
                { id: 'raw-profiles', label: 'Profiles', color: '#9b59b6' },
                { id: 'raw-schema', label: 'Schema Introspection (cached)', color: '#d35400' },
                { id: 'raw-duplicates', label: 'Duplicate Hashes', color: '#c0392b' },
                { id: 'raw-dup-manager', label: 'Manage Duplicates', color: '#e67e22' }
            ];
            const rawButtonsWrap = rawSection.querySelector('#raw-buttons');
            btns.forEach(b => {
                const el = document.createElement('button');
                el.id = b.id;
                el.textContent = b.label;
                el.style.cssText = `background:${b.color}; color:#fff; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; font-size:12px; font-weight:600;`;
                rawButtonsWrap.appendChild(el);
            });

            const showJsonViewer = (titleText, obj) => {
                try {
                    const wrap = document.createElement('div');
                    wrap.style.cssText = 'position:fixed; inset:0; z-index:10040; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.55); backdrop-filter: blur(3px)';
                    const card = document.createElement('div');
                    card.style.cssText = 'width: 80vw; max-width: 960px; max-height: 80vh; overflow:auto; background:#1e2a35; color:#ecf0f1; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,0.5); padding:16px; border:1px solid rgba(255,255,255,0.08)';
                    const header = document.createElement('div');
                    header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; gap:8px;';
                    header.innerHTML = `<div style="font-weight:700; color:#e67e22;">${titleText}</div>`;
                    const btns = document.createElement('div');
                    const copy = document.createElement('button');
                    copy.textContent = '📋 Copy JSON';
                    copy.style.cssText = 'background:#7f8c8d;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;margin-right:8px;';
                    const close = document.createElement('button');
                    close.textContent = 'Close';
                    close.style.cssText = 'background:#95a5a6;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;';
                    btns.appendChild(copy); btns.appendChild(close);
                    header.appendChild(btns);
                    const pre = document.createElement('pre');
                    pre.style.cssText = 'font-size:12px; line-height:1.45; background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; white-space:pre-wrap; word-break:break-word;';
                    pre.textContent = JSON.stringify(obj, null, 2);
                    card.appendChild(header);
                    card.appendChild(pre);
                    wrap.appendChild(card);
                    document.body.appendChild(wrap);
                    copy.onclick = async () => { try { await navigator.clipboard.writeText(pre.textContent); copy.textContent = '✅ Copied'; setTimeout(() => copy.textContent = '📋 Copy JSON', 1500); } catch (_) { } };
                    close.onclick = () => wrap.remove();
                    wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
                } catch (_) { }
            };

            // Wire raw data buttons
            rawSection.querySelector('#raw-scene').addEventListener('click', async () => {
                try {
                    const sceneId = this.statusTracker.extractSceneId() || graphqlClient.getCurrentSceneId();
                    if (!sceneId) { notifications.show('No scene detected', 'warning'); return; }
                    const data = await graphqlClient.getSceneDetails(sceneId);
                    showJsonViewer(`Scene ${sceneId} (GraphQL)`, data);
                } catch (e) { notifications.show('Failed to load scene data', 'error'); }
            });
            rawSection.querySelector('#raw-status').addEventListener('click', async () => {
                try { const data = this.statusTracker.getStatusSummary(); showJsonViewer('Status Summary', data); } catch (_) { }
            });
            rawSection.querySelector('#raw-history').addEventListener('click', async () => {
                try { const all = await this.historyManager.getAllHistory(); showJsonViewer('Automation History (last 10)', all.slice(0, 10)); } catch (_) { }
            });
            rawSection.querySelector('#raw-config').addEventListener('click', async () => {
                try { const cfg = Object.fromEntries(Object.keys(CONFIG).map(k => [k, getConfig(CONFIG[k])])); showJsonViewer('Full Config', cfg); } catch (_) { }
            });
            rawSection.querySelector('#raw-profiles').addEventListener('click', async () => {
                try { const p = JSON.parse(GM_getValue('automation_profiles', '{}')); showJsonViewer('Profiles', p); } catch (_) { }
            });
            rawSection.querySelector('#raw-schema').addEventListener('click', async () => {
                try { const s = JSON.parse(GM_getValue('schema_introspection', '{}')); showJsonViewer('Schema Introspection (cached)', s); } catch (_) { }
            });
            rawSection.querySelector('#raw-duplicates').addEventListener('click', async () => {
                try { const d = JSON.parse(GM_getValue('duplicate_hashes', '{}')); showJsonViewer('Duplicate Hashes', d); } catch (_) { }
            });
            const dupMgrBtn = rawSection.querySelector('#raw-dup-manager');
            if (dupMgrBtn) dupMgrBtn.addEventListener('click', () => {
                // Inline manager to avoid context issues
                let map = {};
                try { map = JSON.parse(GM_getValue('duplicate_hashes', '{}')); } catch (_) { map = {}; }
                const wrap = document.createElement('div');
                wrap.style.cssText = 'position:fixed; inset:0; z-index:10035; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.55); backdrop-filter: blur(4px)';
                const card = document.createElement('div');
                card.style.cssText = 'width: 900px; max-height: 85vh; overflow:auto; background:#263645; color:#ecf0f1; border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,0.5); padding:18px; border:1px solid rgba(255,255,255,0.08)';
                card.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                        <h3 style="margin:0; color:#e67e22;">Duplicate Manager</h3>
                        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                            <label style="font-size:12px; opacity:.85; display:flex; align-items:center; gap:6px;">Threshold
                              <input id="dup-threshold" type="number" min="0" max="32" value="10" style="width:60px; padding:4px 6px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.08); color:#ecf0f1;"/>
                            </label>
                            <label style="font-size:12px; opacity:.85; display:flex; align-items:center; gap:6px;">Limit
                              <input id="dup-limit" type="number" min="50" max="2000" value="300" style="width:70px; padding:4px 6px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.08); color:#ecf0f1;"/>
                            </label>
                            <div style="width:1px; height:20px; background:rgba(255,255,255,0.15);"></div>
                            <label style="font-size:12px; opacity:.85; display:flex; align-items:center; gap:6px;">Accuracy
                              <select id="dup-accuracy" style="padding:4px 6px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.08); color:#ecf0f1;">
                                <option value="0">Exact</option>
                                <option value="4">High</option>
                                <option value="8">Medium</option>
                                <option value="10">Low</option>
                              </select>
                            </label>
                            <label style="font-size:12px; opacity:.85; display:flex; align-items:center; gap:6px;">Duration
                              <select id="dup-duration" style="padding:4px 6px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.08); color:#ecf0f1;">
                                <option value="-1">Any</option>
                                <option value="0">Equal</option>
                                <option value="1">±1s</option>
                                <option value="5">±5s</option>
                                <option value="10">±10s</option>
                              </select>
                            </label>
                            <button id="dup-server" style="background:#f39c12;color:#000;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-weight:700;">Fetch (Server pHash)</button>
                            <button id="dup-scan" style="background:#9b59b6;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-weight:700;">Scan (Local aHash)</button>
                            <button id="dup-refresh" style="background:#1abc9c;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-weight:600;">Refresh</button>
                            <button id="dup-close" style="background:#7f8c8d;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;">Close</button>
                        </div>
                    </div>
                    <div id="dup-list" style="display:flex; flex-direction:column; gap:12px;"></div>
                `;
                wrap.appendChild(card);
                document.body.appendChild(wrap);
                const list = card.querySelector('#dup-list');
                const hamming = (a, b) => { if (!a || !b || a.length !== b.length) return 64; let d = 0; for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) d++; } return d; };
                const scoreFrom = (dist) => Math.round((Math.max(0, 64 - dist) / 64) * 100);
                const absUrl = (p) => { if (!p) return ''; const base = getConfig(CONFIG.STASH_ADDRESS).replace(/\/$/, ''); return p.startsWith('http') ? p : `${base}${p.startsWith('/') ? '' : '/'}${p}`; };
                const fetchSceneCard = async (sceneId) => {
                    const query = `query($id: ID!){ findScene(id:$id){ id title organized tags { id } performers { id } files { id path } paths { screenshot } studio { name } updated_at } }`;
                    try { const data = await graphqlClient.query(query, { id: sceneId }); return data.findScene; } catch (_) { return null; }
                };
                const deleteScene = async (sceneId) => {
                    // Prefer modern input form and include delete flags
                    const variants = [
                        { q: `mutation($id: ID!,$df:Boolean,$dg:Boolean){ sceneDestroy(input:{id:$id, delete_file:$df, delete_generated:$dg}) }`, v: { id: String(sceneId), df: false, dg: true } },
                        { q: `mutation($id: ID!){ sceneDestroy(id:$id) }`, v: { id: String(sceneId) } },
                        { q: `mutation($ids: [ID!]!){ scenesDestroy(input:{ids:$ids}) }`, v: { ids: [String(sceneId)] } }
                    ];
                    for (const variant of variants) {
                        try { await graphqlClient.query(variant.q, variant.v); return true; } catch (_) { }
                    }
                    return false;
                };
                const fetchScenesPage = async (page, perPage) => {
                    // Try modern signature with filter
                    let query = `query($pp:Int!,$pg:Int!){ findScenes(filter:{per_page:$pp,page:$pg}){ count scenes{ id title paths{ screenshot } studio{ name } } } }`;
                    try { return await graphqlClient.query(query, { pp: perPage, pg: page }); } catch (_) { }
                    // Fallback signature
                    query = `query($pp:Int!,$pg:Int!){ findScenes(scene_filter:null, filter:{per_page:$pp,page:$pg}){ count scenes{ id title paths{ screenshot } studio{ name } } } }`;
                    try { return await graphqlClient.query(query, { pp: perPage, pg: page }); } catch (_) { }
                    // Last resort minimal
                    query = `query{ findScenes{ count scenes{ id title paths{ screenshot } studio{ name } } } }`;
                    try { return await graphqlClient.query(query, {}); } catch (_) { return null; }
                };
                const computeHashesForScenes = async (scenes) => {
                    const result = {};
                    for (const s of scenes) {
                        const shot = s?.paths?.screenshot ? absUrl(s.paths.screenshot) : '';
                        if (!shot) continue;
                        try { const h = await this.computeAHashFromImage(shot); if (h) result[String(s.id)] = h; } catch (_) { }
                    }
                    return result;
                };
                let currentMap = { ...map };
                const pairKey = (a, b) => {
                    const [x, y] = [String(a), String(b)].sort();
                    return `${x}|${y}`;
                };
                const render = async () => {
                    list.innerHTML = '';
                    const thresholdInput = card.querySelector('#dup-threshold');
                    const threshold = Math.max(0, Math.min(32, parseInt(thresholdInput.value || '10', 10)));
                    let ignore = {};
                    try { ignore = JSON.parse(GM_getValue('duplicate_ignore_pairs', '{}')); } catch (_) { ignore = {}; }
                    const arr = Object.entries(currentMap);
                    const pairs = [];
                    for (let i = 0; i < arr.length; i++) {
                        for (let j = i + 1; j < arr.length; j++) {
                            const [idA, hA] = arr[i];
                            const [idB, hB] = arr[j];
                            const dist = hamming(hA, hB);
                            if (dist <= threshold) {
                                const k = pairKey(idA, idB);
                                if (!ignore[k]) pairs.push({ idA, idB, dist });
                            }
                        }
                    }
                    if (pairs.length === 0) {
                        list.innerHTML = '<div style="opacity:.7; font-size:13px;">No duplicate pairs under current threshold.</div>';
                        return;
                    }
                    pairs.sort((a, b) => a.dist - b.dist);
                    for (const p of pairs) {
                        const row = document.createElement('div');
                        row.style.cssText = 'background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px;';
                        const head = document.createElement('div');
                        head.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;';
                        const title = document.createElement('div');
                        title.style.cssText = 'font-weight:600; color:#f1c40f;';
                        title.textContent = `Scenes ${p.idA} ↔ ${p.idB}`;
                        const metaTop = document.createElement('div');
                        metaTop.style.cssText = 'font-size:12px; opacity:.8;';
                        const score = scoreFrom(p.dist);
                        metaTop.textContent = `Distance ${p.dist} • Similarity ${score}%`;
                        head.appendChild(title); head.appendChild(metaTop);
                        row.appendChild(head);
                        const grid = document.createElement('div');
                        grid.style.cssText = 'display:grid; grid-template-columns: repeat(2, 1fr); gap:10px;';
                        row.appendChild(grid);
                        list.appendChild(row);
                        const details = await Promise.all([fetchSceneCard(p.idA), fetchSceneCard(p.idB)]);
                        [p.idA, p.idB].forEach((sid, idx) => {
                            const data = details[idx];
                            const cardEl = document.createElement('div');
                            cardEl.style.cssText = 'background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:8px;';
                            const img = document.createElement('img');
                            img.style.cssText = 'width:100%; height:120px; object-fit:cover; border-radius:6px; background:#111; margin-bottom:6px;';
                            const shot = data?.paths?.screenshot ? absUrl(data.paths.screenshot) : '';
                            if (shot) img.src = shot; else img.alt = 'No preview';
                            const name = document.createElement('div');
                            name.style.cssText = 'font-size:12px; font-weight:600; margin-bottom:2px;';
                            let titleText = data?.title;
                            if (!titleText) {
                                const primary = Array.isArray(data?.files) && data.files.length > 0 ? data.files[0] : null;
                                if (primary && primary.path) {
                                    try { titleText = primary.path.split('/').pop(); } catch (_) { titleText = `Scene ${sid}`; }
                                } else { titleText = `Scene ${sid}`; }
                            }
                            name.textContent = titleText;
                            const sub = document.createElement('div');
                            sub.style.cssText = 'font-size:11px; opacity:.8; margin-bottom:6px;';
                            sub.textContent = data?.studio?.name ? data.studio.name : '';
                            // file meta (local pair)
                            const fileMeta = document.createElement('div');
                            fileMeta.style.cssText = 'font-size:11px; opacity:.9; margin:4px 0;';
                            const primaryFile = Array.isArray(data?.files) && data.files.length > 0 ? data.files[0] : null;
                            if (primaryFile) {
                                const dur = primaryFile.duration ? Math.round(primaryFile.duration) : 0;
                                const hh = String(Math.floor(dur / 3600)).padStart(2, '0');
                                const mm = String(Math.floor((dur % 3600) / 60)).padStart(2, '0');
                                const ss = String(Math.floor(dur % 60)).padStart(2, '0');
                                const durationStr = dur ? `${hh}:${mm}:${ss}` : '';
                                const sizeStr = primaryFile.size ? `${(primaryFile.size / (1024 * 1024)).toFixed(1)} MB` : '';
                                fileMeta.textContent = [durationStr, sizeStr].filter(Boolean).join(' • ');
                            }
                            const btns = document.createElement('div');
                            btns.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap;';
                            const open = document.createElement('button');
                            open.textContent = 'Open';
                            open.style.cssText = 'background:#3498db;color:#fff;border:none;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;';
                            open.onclick = () => { const base = getConfig(CONFIG.STASH_ADDRESS).replace(/\/$/, ''); window.open(`${base}/scenes/${sid}`, '_blank'); };
                            const remove = document.createElement('button');
                            remove.textContent = 'Delete Scene';
                            remove.style.cssText = 'background:#e74c3c;color:#fff;border:none;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;';
                            remove.onclick = async () => {
                                try {
                                    if (!confirm(`Permanently delete scene ${sid}?`)) return;
                                    const ok = await deleteScene(sid);
                                    if (ok) {
                                        // Remove local hash tracking as well
                                        delete currentMap[sid];
                                        delete map[sid];
                                        GM_setValue('duplicate_hashes', JSON.stringify(map));
                                        notifications.show(`Deleted scene ${sid}`, 'success');
                                        render();
                                    } else {
                                        notifications.show(`Failed to delete scene ${sid}`, 'error');
                                    }
                                } catch (_) { notifications.show(`Failed to delete scene ${sid}`, 'error'); }
                            };
                            btns.appendChild(open);
                            btns.appendChild(remove);
                            cardEl.appendChild(img);
                            cardEl.appendChild(name);
                            cardEl.appendChild(sub);
                            if (fileMeta.textContent) cardEl.appendChild(fileMeta);
                            // metadata pills with simple hover preview
                            const meta = document.createElement('div');
                            meta.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; margin:6px 0; font-size:11px;';
                            const pill = (text, bg) => { const el = document.createElement('span'); el.style.cssText = `display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border-radius:999px; background:${bg}; color:#fff;`; el.textContent = text; return el; };
                            const countTag = (data?.tags?.length || 0);
                            const countPerf = (data?.performers?.length || 0);
                            const organized = !!data?.organized;
                            const tagsPill = pill(`🏷️ ${countTag}`, 'rgba(231, 76, 60, 0.45)');
                            const perfPill = pill(`👤 ${countPerf}`, 'rgba(52, 152, 219, 0.45)');
                            if (data?.tags && data.tags.length) tagsPill.title = data.tags.map(t => t.name || t.id).join(', ');
                            if (data?.performers && data.performers.length) perfPill.title = data.performers.map(p => p.name || p.id).join(', ');
                            meta.appendChild(tagsPill);
                            meta.appendChild(perfPill);
                            meta.appendChild(pill(`${organized ? '✅' : '⬜'} Org`, organized ? 'rgba(39, 174, 96, 0.55)' : 'rgba(149, 165, 166, 0.45)'));
                            cardEl.appendChild(meta);
                            cardEl.appendChild(btns);
                            grid.appendChild(cardEl);
                        });
                        const controls = document.createElement('div');
                        controls.style.cssText = 'display:flex; gap:8px; margin-top:8px;';
                        const notDup = document.createElement('button');
                        notDup.textContent = 'Mark Not Duplicate';
                        notDup.style.cssText = 'background:#7f8c8d;color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;';
                        notDup.onclick = () => {
                            const k = pairKey(p.idA, p.idB);
                            let ig = {};
                            try { ig = JSON.parse(GM_getValue('duplicate_ignore_pairs', '{}')); } catch (_) { ig = {}; }
                            ig[k] = true; GM_setValue('duplicate_ignore_pairs', JSON.stringify(ig));
                            notifications.show('Pair hidden as not duplicate', 'info');
                            // remove immediately
                            row.remove();
                            render();
                        };
                        // add VR/passthrough ignore button
                        const ignoreVr = document.createElement('button');
                        ignoreVr.textContent = 'Ignore (This Pair)';
                        ignoreVr.style.cssText = 'background:#8e44ad;color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;';
                        ignoreVr.onclick = () => {
                            const k = pairKey(p.idA, p.idB);
                            let ig = {};
                            try { ig = JSON.parse(GM_getValue('duplicate_ignore_pairs', '{}')); } catch (_) { ig = {}; }
                            ig[k] = true; GM_setValue('duplicate_ignore_pairs', JSON.stringify(ig));
                            notifications.show('Ignored this pair', 'info');
                            // remove immediately
                            row.remove();
                            render();
                        };
                        controls.appendChild(notDup);
                        controls.appendChild(ignoreVr);
                        row.appendChild(controls);
                    }
                };
                card.querySelector('#dup-close').onclick = () => wrap.remove();
                card.querySelector('#dup-server').onclick = async () => {
                    try {
                        const acc = parseInt(card.querySelector('#dup-accuracy').value || '0', 10);
                        const dur = parseFloat(card.querySelector('#dup-duration').value || '-1');
                        const groups = await graphqlClient.findDuplicateScenes({ distance: acc, durationDiff: dur });
                        // Render server groups with small batches to keep UI responsive
                        list.innerHTML = '';
                        const prog = document.createElement('div');
                        prog.style.cssText = 'font-size:12px; opacity:.8; margin:6px 0;';
                        list.appendChild(prog);
                        if (!groups || groups.length === 0) {
                            prog.textContent = 'No server-side duplicates found.';
                            return;
                        }

                        const batchSize = 4;
                        let index = 0;

                        const renderGroup = (group) => {
                            const sep = document.createElement('div');
                            sep.style.cssText = 'border-top:1px dashed rgba(255,255,255,0.15); margin:8px 0;';
                            const rows = document.createElement('div');
                            rows.style.cssText = 'display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:10px;';

                            // auto-select largest by file size
                            const withSizes = group.map(s => ({ s, size: (Array.isArray(s.files) && s.files.length ? s.files[0].size || 0 : 0) }));
                            withSizes.sort((a, b) => b.size - a.size);
                            const dest = withSizes[0]?.s;
                            const sources = withSizes.slice(1).map(x => x.s);

                            // check group ignore list and skip rendering if ignored
                            let ignoredGroups = {};
                            try { ignoredGroups = JSON.parse(GM_getValue('duplicate_ignore_groups', '{}')); } catch (_) { ignoredGroups = {}; }
                            const groupKey = group.map(g => String(g.id)).sort().join('|');
                            if (ignoredGroups[groupKey]) return; // skip

                            list.appendChild(sep);
                            list.appendChild(rows);

                            group.forEach(scene => {
                                const cardEl = document.createElement('div');
                                cardEl.style.cssText = 'background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:8px;';
                                const img = document.createElement('img');
                                img.style.cssText = 'width:100%; height:120px; object-fit:cover; border-radius:6px; background:#111; margin-bottom:6px;';
                                const shot = scene?.paths?.sprite || scene?.paths?.screenshot || '';
                                if (shot) { const base = getConfig(CONFIG.STASH_ADDRESS).replace(/\/$/, ''); img.src = shot.startsWith('http') ? shot : `${base}${shot.startsWith('/') ? '' : '/'}${shot}`; } else { img.alt = 'No preview'; }
                                const name = document.createElement('div');
                                name.style.cssText = 'font-size:12px; font-weight:600; margin-bottom:2px;';
                                let titleText = scene?.title;
                                if (!titleText) {
                                    const primary = Array.isArray(scene?.files) && scene.files.length > 0 ? scene.files[0] : null;
                                    if (primary && primary.path) {
                                        try { titleText = primary.path.split('/').pop(); } catch (_) { titleText = `Scene ${scene?.id}`; }
                                    } else { titleText = `Scene ${scene?.id}`; }
                                }
                                name.textContent = titleText;
                                const sub = document.createElement('div');
                                sub.style.cssText = 'font-size:11px; opacity:.8; margin-bottom:6px;';
                                sub.textContent = scene?.studio?.name ? scene.studio.name : '';
                                const meta = document.createElement('div');
                                meta.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; margin:6px 0; font-size:11px;';
                                const pill = (text, bg) => { const el = document.createElement('span'); el.style.cssText = `display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border-radius:999px; background:${bg}; color:#fff;`; el.textContent = text; return el; };
                                const countTag = (scene?.tags?.length || 0);
                                const countPerf = (scene?.performers?.length || 0);
                                const organized = !!scene?.organized;
                                const tagsPill = pill(`🏷️ ${countTag}`, 'rgba(231, 76, 60, 0.45)');
                                const perfPill = pill(`👤 ${countPerf}`, 'rgba(52, 152, 219, 0.45)');
                                if (scene?.tags && scene.tags.length) tagsPill.title = scene.tags.map(t => t.name || t.id).join(', ');
                                if (scene?.performers && scene.performers.length) perfPill.title = scene.performers.map(p => p.name || p.id).join(', ');
                                meta.appendChild(tagsPill);
                                meta.appendChild(perfPill);
                                meta.appendChild(pill(`${organized ? '✅' : '⬜'} Org`, organized ? 'rgba(39, 174, 96, 0.55)' : 'rgba(149, 165, 166, 0.45)'));
                                // file meta
                                const fileMeta = document.createElement('div');
                                fileMeta.style.cssText = 'font-size:11px; opacity:.9; margin:4px 0;';
                                const primaryFile = Array.isArray(scene?.files) && scene.files.length > 0 ? scene.files[0] : null;
                                if (primaryFile) {
                                    const dur = primaryFile.duration ? Math.round(primaryFile.duration) : 0;
                                    const hh = String(Math.floor(dur / 3600)).padStart(2, '0');
                                    const mm = String(Math.floor((dur % 3600) / 60)).padStart(2, '0');
                                    const ss = String(Math.floor(dur % 60)).padStart(2, '0');
                                    const durationStr = dur ? `${hh}:${mm}:${ss}` : '';
                                    const sizeStr = primaryFile.size ? `${(primaryFile.size / (1024 * 1024)).toFixed(1)} MB` : '';
                                    fileMeta.textContent = [durationStr, sizeStr].filter(Boolean).join(' • ');
                                }
                                const btns = document.createElement('div');
                                btns.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap;';
                                const open = document.createElement('button');
                                open.textContent = 'Open';
                                open.style.cssText = 'background:#3498db;color:#fff;border:none;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;';
                                open.onclick = () => { const base = getConfig(CONFIG.STASH_ADDRESS).replace(/\/$/, ''); window.open(`${base}/scenes/${scene.id}`, '_blank'); };
                                const remove = document.createElement('button');
                                remove.textContent = 'Delete';
                                remove.style.cssText = 'background:#e74c3c;color:#fff;border:none;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;';
                                remove.onclick = async () => {
                                    try {
                                        if (!confirm(`Permanently delete scene ${scene.id}?`)) return;
                                        const ok = await deleteScene(scene.id);
                                        if (ok) { notifications.show(`Deleted scene ${scene.id}`, 'success'); cardEl.remove(); }
                                        else { notifications.show(`Failed to delete scene ${scene.id}`, 'error'); }
                                    } catch (_) { notifications.show(`Failed to delete scene ${scene.id}`, 'error'); }
                                };
                                const mergeBtn = document.createElement('button');
                                mergeBtn.textContent = 'Auto-Merge to Largest';
                                mergeBtn.style.cssText = 'background:#e67e22;color:#fff;border:none;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;';
                                mergeBtn.onclick = async () => {
                                    try {
                                        if (!dest || !sources.length) { notifications.show('Nothing to merge', 'warning'); return; }
                                        // Build merge list: all other scenes as sources
                                        const sourceIds = sources.map(x => x.id).filter(id => id !== dest.id);
                                        if (!sourceIds.length) { notifications.show('Nothing to merge', 'warning'); return; }
                                        // Determine if destination has metadata (title/tags/performers/studio/date)
                                        const fullDest = await graphqlClient.getSceneForMerge(dest.id);
                                        const hasMeta = (obj) => !!(obj?.title || (obj?.tags?.length) || (obj?.performers?.length) || obj?.studio || obj?.date || obj?.details);
                                        let values = null;
                                        if (!hasMeta(fullDest)) {
                                            // Prefer first source with metadata as donor for values (without overwriting file assignment)
                                            for (const src of sources) {
                                                const fullSrc = await graphqlClient.getSceneForMerge(src.id);
                                                if (hasMeta(fullSrc)) {
                                                    const v = {};
                                                    const set = (k, val) => { if (val !== undefined && val !== null && (!(Array.isArray(val)) || val.length > 0)) v[k] = val; };
                                                    set('title', fullSrc.title);
                                                    set('code', fullSrc.code);
                                                    set('details', fullSrc.details);
                                                    set('director', fullSrc.director);
                                                    set('urls', fullSrc.urls);
                                                    set('date', fullSrc.date);
                                                    if (typeof fullSrc.rating100 === 'number') set('rating100', fullSrc.rating100);
                                                    if (fullSrc.studio?.id) set('studio_id', fullSrc.studio.id);
                                                    const perfIds = (fullSrc.performers || []).map(p => p.id);
                                                    const tagIds = (fullSrc.tags || []).map(t => t.id);
                                                    const galIds = (fullSrc.galleries || []).map(g => g.id);
                                                    if (perfIds.length) set('performer_ids', perfIds);
                                                    if (tagIds.length) set('tag_ids', tagIds);
                                                    if (galIds.length) set('gallery_ids', galIds);
                                                    values = Object.keys(v).length ? v : null;
                                                    break;
                                                }
                                            }
                                        }
                                        const mergedId = await graphqlClient.sceneMerge({ destination: dest.id, source: sourceIds, values });
                                        if (mergedId) {
                                            // Build merge log and UI
                                            const sizeOf = (sc) => (Array.isArray(sc?.files) && sc.files.length ? (sc.files[0].size || 0) : 0);
                                            const fmtMB = (b) => `${(b / (1024 * 1024)).toFixed(1)} MB`;
                                            const destSize = sizeOf(dest);
                                            const srcSummary = sources.map(s => `#${s.id} (${fmtMB(sizeOf(s))})`).join(', ');
                                            const transferred = values ? Object.keys(values).filter(k => k !== 'id') : [];

                                            // Do not open immediately; open after user accepts/rejects delete below

                                            const wrap = document.createElement('div');
                                            wrap.style.cssText = 'position:fixed; inset:0; z-index:10055; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.6)';
                                            const card = document.createElement('div');
                                            card.style.cssText = 'width: 680px; max-width: 90vw; max-height: 85vh; overflow:auto; background:#1e2a35; color:#ecf0f1; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,0.5); padding:16px; border:1px solid rgba(255,255,255,0.08)';
                                            const title = document.createElement('div');
                                            title.style.cssText = 'font-weight:700; color:#e67e22; margin-bottom:8px;';
                                            title.textContent = `Merged ${sourceIds.length} scenes into #${dest.id}`;
                                            const body = document.createElement('div');
                                            body.style.cssText = 'font-size:13px; opacity:.95; line-height:1.5;';
                                            const donorLine = values ? `<div>Donor metadata fields: ${transferred.length ? transferred.join(', ') : 'none'}</div>` : '<div>No metadata transfer needed (destination had metadata)</div>';
                                            body.innerHTML = `
                                                <div>Destination: #${dest.id} • Size: ${fmtMB(destSize)}</div>
                                                <div>Sources: ${srcSummary}</div>
                                                ${donorLine}
                                                <div style="margin-top:8px;">Delete smaller source scenes now?</div>
                                            `;
                                            const btns = document.createElement('div');
                                            btns.style.cssText = 'display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;';
                                            const yes = document.createElement('button');
                                            yes.textContent = '✅ Delete Smaller Scenes';
                                            yes.style.cssText = 'background:#e74c3c;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;';
                                            const no = document.createElement('button');
                                            no.textContent = 'Skip';
                                            no.style.cssText = 'background:#7f8c8d;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;';
                                            const close = document.createElement('button');
                                            close.textContent = 'Close';
                                            close.style.cssText = 'background:#95a5a6;color:#fff;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;';
                                            btns.appendChild(yes);
                                            btns.appendChild(no);
                                            btns.appendChild(close);
                                            card.appendChild(title);
                                            card.appendChild(body);
                                            card.appendChild(btns);
                                            wrap.appendChild(card);
                                            document.body.appendChild(wrap);

                                            const performDelete = async () => {
                                                // Delete feature disabled as requested; keep confirm popup behavior only
                                                wrap.remove();
                                            };
                                            yes.onclick = async () => {
                                                if (confirm('Are you sure you want to permanently delete the smaller source scenes?')) {
                                                    await performDelete();
                                                    // open merged scene after accept
                                                    try {
                                                        const base = getConfig(CONFIG.STASH_ADDRESS).replace(/\/$/, '');
                                                        const win = window.open(`${base}/scenes/${dest.id}`, '_blank');
                                                        if (!win) window.location.assign(`${base}/scenes/${dest.id}`);
                                                    } catch (_) { }
                                                }
                                            };
                                            no.onclick = () => {
                                                // open merged scene after reject
                                                try {
                                                    const base = getConfig(CONFIG.STASH_ADDRESS).replace(/\/$/, '');
                                                    const win = window.open(`${base}/scenes/${dest.id}`, '_blank');
                                                    if (!win) window.location.assign(`${base}/scenes/${dest.id}`);
                                                } catch (_) { }
                                                wrap.remove();
                                            };
                                            close.onclick = () => wrap.remove();

                                            notifications.show(`Merged ${sourceIds.length} -> #${dest.id}. Opened merged scene.`, 'success');
                                        } else {
                                            notifications.show('Merge failed', 'error');
                                        }
                                    } catch (e) { notifications.show('Merge failed', 'error'); }
                                };
                                const metaBtn = document.createElement('button');
                                metaBtn.textContent = 'Metadata';
                                metaBtn.style.cssText = 'background:#2ecc71;color:#fff;border:none;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;';
                                metaBtn.onclick = () => {
                                    try {
                                        const title = `Scene ${scene.id} metadata`;
                                        // reuse showJsonViewer from outer scope if available
                                        const root = document.querySelector('#raw-buttons');
                                        // fallback local viewer
                                        const wrap = document.createElement('div');
                                        wrap.style.cssText = 'position:fixed; inset:0; z-index:10050; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.6)';
                                        const card = document.createElement('div');
                                        card.style.cssText = 'width: 80vw; max-width: 1000px; max-height: 80vh; overflow:auto; background:#1e2a35; color:#ecf0f1; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,0.5); padding:16px; border:1px solid rgba(255,255,255,0.08)';
                                        const header = document.createElement('div');
                                        header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; gap:8px;';
                                        header.innerHTML = `<div style="font-weight:700; color:#2ecc71;">${title}</div>`;
                                        const close = document.createElement('button');
                                        close.textContent = 'Close';
                                        close.style.cssText = 'background:#95a5a6;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;';
                                        header.appendChild(close);
                                        const pre = document.createElement('pre');
                                        pre.style.cssText = 'font-size:12px; line-height:1.45; background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; white-space:pre-wrap; word-break:break-word;';
                                        pre.textContent = JSON.stringify(scene, null, 2);
                                        const fp = document.createElement('div');
                                        fp.style.cssText = 'font-size:11px; opacity:.85; margin-top:8px;';
                                        const p = Array.isArray(scene?.files) && scene.files.length > 0 ? scene.files[0]?.path || '' : '';
                                        if (p) fp.textContent = `Path: ${p}`;
                                        card.appendChild(header);
                                        card.appendChild(pre);
                                        if (p) card.appendChild(fp);
                                        wrap.appendChild(card);
                                        document.body.appendChild(wrap);
                                        close.onclick = () => wrap.remove();
                                        wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
                                    } catch (_) { }
                                };
                                btns.appendChild(open);
                                btns.appendChild(remove);
                                btns.appendChild(mergeBtn);
                                btns.appendChild(metaBtn);
                                cardEl.appendChild(img);
                                cardEl.appendChild(name);
                                cardEl.appendChild(sub);
                                if (fileMeta.textContent) cardEl.appendChild(fileMeta);
                                cardEl.appendChild(meta);
                                cardEl.appendChild(btns);
                                rows.appendChild(cardEl);
                            });

                            // group-level controls
                            const grpControls = document.createElement('div');
                            grpControls.style.cssText = 'display:flex; gap:8px; margin:6px 0; justify-content:flex-end;';
                            const ignoreGroupBtn = document.createElement('button');
                            ignoreGroupBtn.textContent = 'Ignore This Group';
                            ignoreGroupBtn.style.cssText = 'background:#8e44ad;color:#fff;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;';
                            ignoreGroupBtn.onclick = () => {
                                let ig = {};
                                try { ig = JSON.parse(GM_getValue('duplicate_ignore_groups', '{}')); } catch (_) { ig = {}; }
                                ig[groupKey] = true; GM_setValue('duplicate_ignore_groups', JSON.stringify(ig));
                                notifications.show('Ignored this duplicate group', 'info');
                                rows.remove(); sep.remove(); grpControls.remove();
                            };
                            rows.parentElement?.appendChild(grpControls);
                            grpControls.appendChild(ignoreGroupBtn);
                        };

                        const renderBatch = () => {
                            const end = Math.min(groups.length, index + batchSize);
                            for (let i = index; i < end; i++) renderGroup(groups[i]);
                            index = end;
                            prog.textContent = `Rendering ${index}/${groups.length} groups...`;
                            if (index < groups.length) requestAnimationFrame(renderBatch);
                            else setTimeout(() => { try { prog.remove(); } catch (_) { } }, 800);
                        };

                        requestAnimationFrame(renderBatch);
                    } catch (_) { notifications.show('Server duplicate fetch failed', 'error'); }
                };

                card.querySelector('#dup-scan').onclick = async () => {
                    try {
                        const limitEl = card.querySelector('#dup-limit');
                        const limit = Math.max(50, Math.min(2000, parseInt(limitEl.value || '300', 10)));
                        const perPage = 50;
                        let page = 1;
                        let collected = [];
                        let total = Infinity;
                        while (collected.length < limit && page < 200) {
                            const data = await fetchScenesPage(page, perPage);
                            if (!data || !data.findScenes) break;
                            const { count, scenes } = data.findScenes;
                            total = count || total;
                            collected.push(...(scenes || []));
                            if (!scenes || scenes.length < perPage) break;
                            page++;
                        }
                        const subset = collected.slice(0, limit);
                        currentMap = await computeHashesForScenes(subset);
                        notifications.show(`Scanned ${Object.keys(currentMap).length} scenes for duplicates`, 'info');
                        render();
                    } catch (_) { notifications.show('Scan failed', 'error'); }
                };
                render();
            });

            dialog.appendChild(title);
            dialog.appendChild(optionsContainer);
            dialog.appendChild(extraSection);
            dialog.appendChild(graphqlSection);
            dialog.appendChild(storageSection);
            dialog.appendChild(rawSection);
            dialog.appendChild(actionsContainer);

            backdrop.appendChild(dialog);
            document.body.appendChild(backdrop);

            // Event listeners
            const closeDialog = () => {
                backdrop.remove();
            };
            // Extra section listeners
            extraSection.querySelector('#activeProfileName').addEventListener('change', (e) => { this.activeProfileName = e.target.value.trim(); GM_setValue('ACTIVE_PROFILE_NAME', this.activeProfileName); });
            extraSection.querySelector('#saveProfileBtn').addEventListener('click', () => {
                try {
                    const key = 'automation_profiles';
                    const existing = JSON.parse(GM_getValue(key, '{}'));
                    // Store by underlying GM keys (CONFIG[k]) so we can load directly
                    existing[this.activeProfileName || 'default'] = Object.fromEntries(
                        Object.keys(CONFIG).map(k => [CONFIG[k], getConfig(CONFIG[k])])
                    );
                    GM_setValue(key, JSON.stringify(existing));
                    notifications.show('💾 Profile saved', 'success');
                } catch (_) { notifications.show('❌ Failed to save profile', 'error'); }
            });
            // Button styling helper
            const styleBtn = (el, bg) => {
                el.style.cssText = `
                    background: ${bg};
                    color: #fff;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.25);
                    transition: transform .08s ease, box-shadow .15s ease, filter .15s ease;
                `;
                el.onmouseenter = () => { el.style.transform = 'translateY(-1px)'; el.style.boxShadow = '0 4px 14px rgba(0,0,0,0.3)'; el.style.filter = 'brightness(1.05)'; };
                el.onmouseleave = () => { el.style.transform = 'none'; el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.25)'; el.style.filter = 'none'; };
                el.onmousedown = () => { el.style.transform = 'translateY(0) scale(0.98)'; };
                el.onmouseup = () => { el.style.transform = 'translateY(-1px)'; };
            };

            const saveBtn = extraSection.querySelector('#saveProfileBtn');
            const loadBtn = extraSection.querySelector('#loadProfileBtn');
            const delBtn = extraSection.querySelector('#deleteProfileBtn');
            const inspectBtn = extraSection.querySelector('#inspectProfileBtn');
            const manageBtn = extraSection.querySelector('#manageProfilesBtn');
            styleBtn(saveBtn, '#f1c40f'); // amber
            styleBtn(loadBtn, '#3498db'); // blue
            styleBtn(delBtn, '#e74c3c'); // red
            styleBtn(inspectBtn, '#7f8c8d'); // gray
            styleBtn(manageBtn, '#16a085'); // teal

            extraSection.querySelector('#loadProfileBtn').addEventListener('click', () => {
                try {
                    const key = 'automation_profiles';
                    const existing = JSON.parse(GM_getValue(key, '{}'));
                    const name = this.activeProfileName || 'default';
                    if (!existing[name]) { notifications.show('❌ Profile not found', 'error'); return; }
                    const cfg = existing[name];
                    // cfg keys are GM keys
                    Object.entries(cfg).forEach(([gmKey, val]) => setConfig(gmKey, val));
                    notifications.show(`✅ Profile '${name}' loaded`, 'success');
                    // Refresh open dialog controls to reflect loaded values
                    this.updateConfigDialogControls();
                } catch (_) { notifications.show('❌ Failed to load profile', 'error'); }
            });
            extraSection.querySelector('#deleteProfileBtn').addEventListener('click', () => {
                try {
                    const key = 'automation_profiles';
                    const existing = JSON.parse(GM_getValue(key, '{}'));
                    const name = this.activeProfileName || 'default';
                    if (!existing[name]) { notifications.show('❌ Profile not found', 'error'); return; }
                    delete existing[name];
                    GM_setValue(key, JSON.stringify(existing));
                    notifications.show(`🗑️ Profile '${name}' deleted`, 'info');
                } catch (_) { notifications.show('❌ Failed to delete profile', 'error'); }
            });
            extraSection.querySelector('#inspectProfileBtn').addEventListener('click', async () => {
                try {
                    const key = 'automation_profiles';
                    const existing = JSON.parse(GM_getValue(key, '{}'));
                    const name = this.activeProfileName || 'default';
                    const cfg = existing[name];
                    if (!cfg) { notifications.show('❌ Profile not found', 'error'); return; }
                    await navigator.clipboard.writeText(JSON.stringify(cfg, null, 2));
                    notifications.show('📋 Profile JSON copied to clipboard', 'success');
                } catch (_) { notifications.show('❌ Failed to copy profile', 'error'); }
            });
            extraSection.querySelector('#manageProfilesBtn').addEventListener('click', this.showProfileManager.bind(this));

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

        /**
         * Update the open configuration dialog controls to reflect current stored settings
         */
        updateConfigDialogControls() {
            const dialog = document.querySelector('#stash-config-dialog');
            if (!dialog) return;
            const controls = dialog.querySelectorAll('[data-config-key]');
            controls.forEach((el) => {
                const key = el.getAttribute('data-config-key');
                const val = getConfig(key);
                if (el instanceof HTMLInputElement) {
                    if (el.type === 'checkbox') {
                        el.checked = !!val;
                    } else {
                        el.value = val != null ? String(val) : '';
                    }
                } else if (el instanceof HTMLTextAreaElement) {
                    el.value = val != null ? String(val) : '';
                }
            });
            // Update Active Profile input if present
            const profileInput = dialog.querySelector('#activeProfileName');
            if (profileInput && typeof this.activeProfileName === 'string') {
                profileInput.value = this.activeProfileName;
            }
        }
        showProfileManager() {
            const key = 'automation_profiles';
            const existing = JSON.parse(GM_getValue(key, '{}'));
            const names = Object.keys(existing).sort();

            const wrap = document.createElement('div');
            wrap.style.cssText = 'position:fixed; inset:0; z-index:10010; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.55); backdrop-filter: blur(4px)';
            const card = document.createElement('div');
            card.style.cssText = 'width:540px; max-height:80vh; overflow:auto; background:#263645; color:#ecf0f1; border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,0.5); padding:18px; border:1px solid rgba(255,255,255,0.08)';
            card.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                    <h3 style="margin:0; color:#1abc9c;">Profile Manager</h3>
                    <button id="pm-close" style="background:#7f8c8d;color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;">Close</button>
                </div>
                <div style="display:flex; gap:10px; align-items:center; margin-bottom:12px;">
                    <input id="pm-filter" placeholder="Filter profiles..." style="flex:1;padding:8px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#ecf0f1;">
                    <button id="pm-new" style="background:#f1c40f;color:#000;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-weight:600;">New</button>
                </div>
                <div id="pm-list" style="display:flex; flex-direction:column; gap:8px;"></div>
            `;

            const list = card.querySelector('#pm-list');
            const render = (filter = '') => {
                list.innerHTML = '';
                const filtered = names.filter(n => n.toLowerCase().includes(filter.toLowerCase()));
                if (filtered.length === 0) {
                    list.innerHTML = '<div style="opacity:.7; font-size:13px;">No profiles found</div>';
                    return;
                }
                filtered.forEach(name => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.08)';
                    const label = document.createElement('div');
                    label.textContent = name;
                    label.style.cssText = 'flex:1; font-weight:600;';
                    const btnLoad = document.createElement('button');
                    const btnInspect = document.createElement('button');
                    const btnDelete = document.createElement('button');
                    const btnRename = document.createElement('button');
                    const style = (el, bg) => { el.style.cssText = `background:${bg};color:#fff;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;`; };
                    btnLoad.textContent = 'Load'; style(btnLoad, '#3498db');
                    btnInspect.textContent = 'Inspect'; style(btnInspect, '#7f8c8d');
                    btnDelete.textContent = 'Delete'; style(btnDelete, '#e74c3c');
                    btnRename.textContent = 'Rename'; style(btnRename, '#9b59b6');

                    btnLoad.onclick = () => {
                        const cfg = existing[name]; if (!cfg) return;
                        Object.keys(cfg).forEach(k => setConfig(k, cfg[k]));
                        this.activeProfileName = name; GM_setValue('ACTIVE_PROFILE_NAME', name);
                        notifications.show(`✅ Profile '${name}' loaded`, 'success');
                    };
                    btnInspect.onclick = async () => {
                        try { await navigator.clipboard.writeText(JSON.stringify(existing[name], null, 2)); notifications.show('📋 Copied profile JSON', 'success'); } catch (_) { notifications.show('❌ Copy failed', 'error'); }
                    };
                    btnDelete.onclick = () => {
                        if (!confirm(`Delete profile '${name}'?`)) return;
                        delete existing[name]; GM_setValue(key, JSON.stringify(existing));
                        const idx = names.indexOf(name); if (idx >= 0) names.splice(idx, 1);
                        render(card.querySelector('#pm-filter').value);
                        notifications.show('🗑️ Profile deleted', 'info');
                    };
                    btnRename.onclick = () => {
                        const newName = prompt('New profile name:', name) || '';
                        if (!newName || newName === name) return;
                        if (existing[newName]) { notifications.show('❌ Name already exists', 'error'); return; }
                        existing[newName] = existing[name]; delete existing[name]; GM_setValue(key, JSON.stringify(existing));
                        const idx = names.indexOf(name); if (idx >= 0) names[idx] = newName; else names.push(newName);
                        names.sort(); this.activeProfileName = newName; GM_setValue('ACTIVE_PROFILE_NAME', newName);
                        render(card.querySelector('#pm-filter').value);
                        notifications.show('✏️ Profile renamed', 'success');
                    };
                    row.appendChild(label);
                    row.appendChild(btnLoad);
                    row.appendChild(btnInspect);
                    row.appendChild(btnRename);
                    row.appendChild(btnDelete);
                    list.appendChild(row);
                });
            };

            wrap.appendChild(card);
            document.body.appendChild(wrap);
            render('');
            card.querySelector('#pm-close').onclick = () => wrap.remove();
            card.querySelector('#pm-filter').oninput = (e) => render(e.target.value);
            card.querySelector('#pm-new').onclick = () => {
                const name = prompt('Profile name:', this.activeProfileName || 'default');
                if (!name) return;
                const current = JSON.parse(GM_getValue(key, '{}'));
                if (current[name]) { notifications.show('❌ Name already exists', 'error'); return; }
                current[name] = Object.fromEntries(Object.keys(CONFIG).map(k => [k, getConfig(CONFIG[k])]));
                GM_setValue(key, JSON.stringify(current));
                names.push(name); names.sort();
                render(card.querySelector('#pm-filter').value);
                notifications.show('🆕 Profile created', 'success');
            };
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
            this.observerRoot = null;

            // Remove any overlay elements and listeners
            this.hideCancelButton();
            this.hideSkipButton();
            this.removeOverlayListeners();

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
            this._lastStatusSummaryKey = '';
            return statusContainer;
        }

        /**
         * Update the status summary display
         */
        updateStatusSummaryDisplay() {
            if (!this.statusSummaryContainer || !this.statusTracker) return;

            const summary = this.statusTracker.getStatusSummary();
            const completion = this.statusTracker.getCompletionStatus();
            // Skip if no change to avoid unnecessary DOM work
            const nextKey = JSON.stringify({
                scene: summary.scene.id,
                stashdb: summary.sources.stashdb.status,
                tpdb: summary.sources.theporndb.status,
                organized: summary.organized.status,
                pct: completion.percentage
            });
            if (this._lastStatusSummaryKey === nextKey) {
                return;
            }
            this._lastStatusSummaryKey = nextKey;

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
            const startUrl = window.location.href;
            this.summaryWidget.startTracking(sceneName, sceneId);
            const automationStartMs = Date.now();

            // Reset and set automation state
            this.automationCancelled = false;
            this.automationInProgress = true;
            // Ensure organize-after-save state starts clean
            this._organizedAfterSave = false;

            // Check if we're in re-scrape mode
            this.rescrapeOptions.forceRescrape = this.rescrapeOptions.rescrapeStashDB || this.rescrapeOptions.rescrapeThePornDB;
            // Show cancel button
            this.showCancelButton();
            try {
                // Ensure we are on the edit panel before proceeding
                const onEdit = await this.openEditPanel();
                if (!onEdit) {
                    throw new Error('Could not open edit panel');
                }

                const ensureSameScene = () => {
                    const urlChanged = window.location.href !== startUrl;
                    const idChanged = (this.statusTracker.extractSceneId() || '') !== sceneId;
                    if (urlChanged || idChanged) throw new Error('Navigation detected during automation');
                };
                ensureSameScene();
                // Check what's already scraped
                let alreadyScraped = { stashdb: false, theporndb: false };
                if (getConfig(CONFIG.SKIP_ALREADY_SCRAPED) && !this.rescrapeOptions.forceRescrape) {
                    ensureSameScene();
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
                    ensureSameScene();

                    this.summaryWidget.addSource('StashDB');
                    // Respect user skip request
                    if (this.skipCurrentSourceRequested) {
                        this.summaryWidget.addAction('Scraped StashDB', 'skip', 'user skipped');
                    }
                    const stashOutcome = this.skipCurrentSourceRequested ? { found: false, skip: true, reason: 'user skipped' } : await this.scrapeStashDB();
                    this.skipCurrentSourceRequested = false; // one-shot
                    if (!stashOutcome || stashOutcome.found === false) {
                        const reason = (stashOutcome && stashOutcome.reason) ? stashOutcome.reason : 'no match';
                        this.summaryWidget.addAction('Scraped StashDB', 'skip', reason);
                    } else {
                        this.summaryWidget.addAction('Scraped StashDB', 'success');
                    }

                    // Check for cancellation after scraping
                    if (this.automationCancelled) {
                        this.updateSceneStatus('⚠️ Automation cancelled');
                        return;
                    }
                    ensureSameScene();

                    // Only proceed with performers/apply if scraper found a match
                    if (stashOutcome && stashOutcome.found) {
                        if (getConfig(CONFIG.AUTO_CREATE_PERFORMERS)) {
                            await this.createNewPerformers();
                            this.summaryWidget.addAction('Created new performers/tags', 'success');

                            // Check for cancellation after creating performers
                            if (this.automationCancelled) {
                                this.updateSceneStatus('⚠️ Automation cancelled');
                                return;
                            }
                        }

                        // Allow user to skip at apply stage as well
                        if (this.skipCurrentSourceRequested) {
                            this.summaryWidget.addAction('Apply StashDB data', 'skip', 'user skipped');
                            stashDBResult = 'skip';
                        } else {
                            stashDBResult = await this.applyScrapedData();
                        }
                        this.skipCurrentSourceRequested = false;
                        if (stashDBResult === 'cancel') {
                            // User cancelled entire automation
                            this.updateSceneStatus('⚠️ Automation cancelled by user');
                            return;
                        } else if (stashDBResult === 'skip') {
                        }
                    } else {
                        // Keep result as 'skip' if not found
                        stashDBResult = 'skip';
                    }
                }

                if (needsThePornDB) {
                    // Check for cancellation before scraping
                    if (this.automationCancelled) {
                        this.updateSceneStatus('⚠️ Automation cancelled');
                        this.summaryWidget.addAction('ThePornDB Scraping', 'cancelled');
                        return;
                    }
                    ensureSameScene();

                    this.summaryWidget.addSource('ThePornDB');
                    if (this.skipCurrentSourceRequested) {
                        this.summaryWidget.addAction('Scraped ThePornDB', 'skip', 'user skipped');
                    }
                    const tpdbOutcome = this.skipCurrentSourceRequested ? { found: false, skip: true, reason: 'user skipped' } : await this.scrapeThePornDB();
                    this.skipCurrentSourceRequested = false;
                    if (!tpdbOutcome || tpdbOutcome.found === false) {
                        const reason = (tpdbOutcome && tpdbOutcome.reason) ? tpdbOutcome.reason : 'no match';
                        this.summaryWidget.addAction('Scraped ThePornDB', 'skip', reason);
                    } else {
                        this.summaryWidget.addAction('Scraped ThePornDB', 'success');
                    }

                    // Check for cancellation after scraping
                    if (this.automationCancelled) {
                        this.updateSceneStatus('⚠️ Automation cancelled');
                        return;
                    }
                    ensureSameScene();

                    // Only proceed with performers/apply if scraper found a match
                    if (tpdbOutcome && tpdbOutcome.found) {
                        if (getConfig(CONFIG.AUTO_CREATE_PERFORMERS)) {
                            await this.createNewPerformers();
                            this.summaryWidget.addAction('Created new performers/tags', 'success');

                            // Check for cancellation after creating performers
                            if (this.automationCancelled) {
                                this.updateSceneStatus('⚠️ Automation cancelled');
                                return;
                            }
                        }

                        if (this.skipCurrentSourceRequested) {
                            this.summaryWidget.addAction('Apply ThePornDB data', 'skip', 'user skipped');
                            thePornDBResult = 'skip';
                        } else {
                            thePornDBResult = await this.applyScrapedData();
                        }
                        this.skipCurrentSourceRequested = false;
                        if (thePornDBResult === 'cancel') {
                            // User cancelled entire automation
                            this.updateSceneStatus('⚠️ Automation cancelled by user');
                            return;
                        } else if (thePornDBResult === 'skip') {
                        }
                    } else {
                        thePornDBResult = 'skip';
                    }
                }

                // Check for cancellation before saving
                if (this.automationCancelled) {
                    this.updateSceneStatus('⚠️ Automation cancelled');
                    return;
                }

                // Save scraped data first
                ensureSameScene();
                await this.saveScene();
                this.summaryWidget.addAction('Saved scene', 'success');
                if (this._organizedAfterSave) {
                    this.summaryWidget.addAction('Marked as organized', 'success');
                }
                // Check for cancellation after saving
                if (this.automationCancelled) {
                    this.updateSceneStatus('⚠️ Automation cancelled');
                    return;
                }

                // Check organize status before attempting organization
                if (getConfig(CONFIG.AUTO_ORGANIZE)) {
                    // Check current organized status first
                    ensureSameScene();
                    const isCurrentlyOrganized = await this.checkOrganizedStatus();

                    if (isCurrentlyOrganized) {
                        this.updateSceneStatus('✅ Already organized');
                        this.summaryWidget.addAction('Mark as organized', 'skip', 'Already organized');
                    } else {
                        // If we already organized right after save, skip re-organizing
                        if (this._organizedAfterSave) {
                            this.updateSceneStatus('✅ Organized after save');
                            this.summaryWidget.addAction('Mark as organized', 'skip', 'Already organized after save');
                        } else {
                            const hasStashDB = alreadyScraped.stashdb || needsStashDB;
                            const hasThePornDB = alreadyScraped.theporndb || needsThePornDB;

                            if (hasStashDB && hasThePornDB) {
                                // Organize the scene
                                ensureSameScene();
                                await this.organizeScene();
                                this.summaryWidget.addAction('Marked as organized', 'success');

                                // Save again after organizing
                                ensureSameScene();
                                await this.saveScene();
                                this.summaryWidget.addAction('Saved scene', 'success');
                            } else if (hasStashDB || hasThePornDB) {
                                this.updateSceneStatus('⚠️ Skipping organization - need both sources');
                            } else {
                                this.updateSceneStatus('❌ No sources found');
                            }
                        }
                    }
                }

                this.updateSceneStatus('✅ Automation complete!');
                notifications.show('✅ Automation completed successfully!', 'success');

                // Save successful automation history
                const organizedNow = await this.checkOrganizedStatus();
                const automationEndMs = Date.now();
                const durationMs = Math.max(0, automationEndMs - automationStartMs);
                await this.saveAutomationResult({
                    success: true,
                    duration: durationMs,
                    sourcesUsed: [
                        ...(stashDBResult === 'apply' ? ['stashdb'] : []),
                        ...(thePornDBResult === 'apply' ? ['theporndb'] : [])
                    ],
                    stashdb: alreadyScraped.stashdb || stashDBResult === 'apply',
                    theporndb: alreadyScraped.theporndb || thePornDBResult === 'apply',
                    organized: organizedNow,
                    skippedSources: [
                        ...(stashDBResult === 'skip' && needsStashDB ? ['stashdb'] : []),
                        ...(thePornDBResult === 'skip' && needsThePornDB ? ['theporndb'] : [])
                    ]
                });

                // After success, compute and store duplicate hash for quick future checks
                try { await this.checkForDuplicateScene(sceneId); } catch (_) { }

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
                    // Clear all caches to ensure fresh data
                    if (this.sourceDetector && this.sourceDetector.cache) {
                        this.sourceDetector.cache.clear();
                    }
                    
                    // Clear GraphQL cache
                    if (window.graphQLCache && window.graphQLCache.invalidate) {
                        window.graphQLCache.invalidate('GetScene');
                    } else if (window.cacheManager) {
                        // Fallback: clear entire graphql cache store
                        window.cacheManager.clear('graphql');
                    }
                    
                    // Force refresh of status detection
                    await this.statusTracker.detectCurrentStatus();
                    await this.updateStatusFromDOM();
                    
                    // Update and show summary widget 
                    if (this.summaryWidget) {
                        if (this.summaryWidget.updateFromAutomation) {
                            this.summaryWidget.updateFromAutomation();
                        }
                        // Show the summary
                        if (this.summaryWidget.showSummary) {
                            this.summaryWidget.showSummary();
                        }
                    }
                    
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
                    duration: Math.max(0, Date.now() - automationStartMs),
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
                this.hideSkipButton();

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
            // Reuse overlays if they already exist; otherwise create
            if (this.cancelButton && document.body.contains(this.cancelButton)) {
                this.cancelButton.style.display = 'flex';
            } else {
                this.hideCancelButton();
                this.hideSkipButton();

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

            // Also render skip button for current source
            this.showSkipButton();
        }

        hideCancelButton() {
            if (this.cancelButton) {
                this.cancelButton.remove();
                this.cancelButton = null;
            }
        }

        showSkipButton() {
            // Reuse existing skip overlay if present
            if (this.skipButton && document.body.contains(this.skipButton)) {
                this.skipButton.style.display = 'flex';
                return;
            }
            this.hideSkipButton();

            this.skipButton = document.createElement('div');
            this.skipButton.id = 'automation-skip-overlay';
            this.skipButton.style.cssText = `
                position: fixed;
                top: 130px;
                right: 20px;
                z-index: 10003;
                background: linear-gradient(135deg, #ffaa00, #ff8800);
                color: white;
                padding: 10px 16px;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(255, 136, 0, 0.3);
                cursor: pointer;
                font-family: 'Segoe UI', sans-serif;
                font-size: 13px;
                font-weight: bold;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.2s ease;
                animation: slideIn 0.2s ease;
            `;

            this.skipButton.innerHTML = `
                <span style="font-size: 18px;">⏭️</span>
                <span>Skip Current Source</span>
            `;

            this.skipButton.onmouseenter = () => {
                this.skipButton.style.background = 'linear-gradient(135deg, #ffbb33, #ff9900)';
                this.skipButton.style.transform = 'scale(1.05)';
            };
            this.skipButton.onmouseleave = () => {
                this.skipButton.style.background = 'linear-gradient(135deg, #ffaa00, #ff8800)';
                this.skipButton.style.transform = 'scale(1)';
            };

            this.skipButton.onclick = () => {
                this.skipCurrentSourceRequested = true;
                this.summaryWidget && this.summaryWidget.addWarning('User requested to skip current source');
                this.updateSceneStatus('⏭️ Skipping current source...');
                notifications.show('⏭️ Will skip current source', 'info');
            };

            document.body.appendChild(this.skipButton);
        }

        hideSkipButton() {
            if (this.skipButton) {
                this.skipButton.remove();
                this.skipButton = null;
            }
        }

        /**
         * Remove overlay listeners and ensure no duplicate handlers remain
         */
        removeOverlayListeners() {
            try {
                window.removeEventListener('stash:graphql', () => { });
                window.removeEventListener('stash:graphql-mutation', () => { });
            } catch (_) { }
        }
        async checkAlreadyScraped() {
            this.updateSceneStatus('🔍 Checking already scraped sources...');

            const result = { stashdb: false, theporndb: false };

            try {

                // Enhanced GraphQL-powered detection (highest confidence)
                if (getConfig(CONFIG.ENABLE_CROSS_SCENE_INTELLIGENCE)) {

                    try {
                        const sceneId = graphqlClient.getCurrentSceneId();
                        const sceneDetails = sceneId ? await graphqlClient.getSceneDetailsCached(sceneId) : null;
                        // Check StashDB via GraphQL
                        const stashdbStatus = await this.sourceDetector.detectStashDBData(sceneDetails);
                        if (stashdbStatus.found && stashdbStatus.confidence >= 100) {
                            result.stashdb = true;
                            this.updateSceneStatus('✅ Source detected');
                        }

                        // Check ThePornDB via GraphQL
                        const theporndbStatus = await this.sourceDetector.detectThePornDBData(sceneDetails);
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
                        debugLog('GraphQL detection error in checkAlreadyScraped:', graphqlError);
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
            
            // Track performance
            const startTime = performance.now();

            if (this.automationCancelled) throw new Error('Automation cancelled');
            if (this.skipCurrentSourceRequested) return { found: false, skip: true, reason: 'user skipped' };

            const scrapeBtn = this.findScrapeButton();
            if (!scrapeBtn) throw new Error('Scrape button not found');

            await this.clickFast(scrapeBtn);

            // Wait for dropdown items to appear
            try {
                await this.waitForElement(['.dropdown-menu.show .dropdown-item', '.dropdown-menu .dropdown-item'], { timeout: 3000 });
            } catch (_) {
                if (this.skipCurrentSourceRequested) return { found: false, skip: true, reason: 'user skipped' };
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

            // Wait until either modal/edit form shows up
            try {
                await this.waitForElement(['.modal.show .modal-dialog', '.entity-edit-panel', '.scene-edit-details'], { timeout: 7000 });
            } catch (_) {
                if (this.skipCurrentSourceRequested) return { found: false, skip: true, reason: 'user skipped' };
            }

            // Detect outcome and warn if not found
            const outcome = await this.detectScraperOutcome();
            if (!outcome.found) {
                const notFound = (outcome.reason || '').toLowerCase().includes('scene not found');
                const reason = outcome.reason ? ` (${outcome.reason})` : '';
                this.summaryWidget.addWarning(`StashDB: no match${reason}`);
                notifications.show(`StashDB scraper found no scene${reason}`, 'warning');
                return { found: false, skip: true, reason: outcome.reason, notFound };
            }
            
            // Track performance
            if (window.performanceMonitor) {
                const duration = performance.now() - startTime;
                window.performanceMonitor.addMetric({
                    type: 'scraping',
                    name: 'StashDB',
                    duration: duration,
                    success: true,
                    timestamp: Date.now()
                });
            }
            
            // Immediately update status after successful scrape
            if (this.statusTracker) {
                this.statusTracker.updateStatus('stashdb', {
                    scraped: true,
                    timestamp: new Date()
                });
                // Force immediate status detection
                this.statusTracker.detectCurrentStatus();
            }
            
            return { found: true };
        }

        async scrapeThePornDB() {
            // Track performance
            const startTime = performance.now();
            this.updateSceneStatus('🔍 Scraping...');

            if (this.automationCancelled) throw new Error('Automation cancelled');
            if (this.skipCurrentSourceRequested) return { found: false, skip: true, reason: 'user skipped' };

            const scrapeBtn = this.findScrapeButton();
            if (!scrapeBtn) throw new Error('Scrape button not found');

            await this.clickFast(scrapeBtn);

            // Wait for dropdown items
            try {
                await this.waitForElement(['.dropdown-menu.show .dropdown-item', '.dropdown-menu .dropdown-item'], { timeout: 3000 });
            } catch (_) {
                if (this.skipCurrentSourceRequested) return { found: false, skip: true, reason: 'user skipped' };
            }

            if (this.automationCancelled) throw new Error('Automation cancelled');

            const options = document.querySelectorAll('.dropdown-menu .dropdown-item, a.dropdown-item');
            for (const option of options) {
                const t = option.textContent.toLowerCase();
                if (t.includes('theporndb') || t.includes('tpdb')) {
                    await this.clickFast(option);
                    break;
                }
            }

            // Wait until modal/edit form shows up
            try {
                await this.waitForElement(['.modal.show .modal-dialog', '.entity-edit-panel', '.scene-edit-details'], { timeout: 7000 });
            } catch (_) {
                if (this.skipCurrentSourceRequested) return { found: false, skip: true, reason: 'user skipped' };
            }

            // Detect outcome and warn if not found
            const outcome = await this.detectScraperOutcome();
            if (!outcome.found) {
                const notFound = (outcome.reason || '').toLowerCase().includes('scene not found');
                const reason = outcome.reason ? ` (${outcome.reason})` : '';
                this.summaryWidget.addWarning(`ThePornDB: no match${reason}`);
                notifications.show(`ThePornDB scraper found no scene${reason}`, 'warning');
                return { found: false, skip: true, reason: outcome.reason, notFound };
            }
            
            // Immediately update status after successful scrape
            if (this.statusTracker) {
                this.statusTracker.updateStatus('theporndb', {
                    scraped: true,
                    timestamp: new Date()
                });
                // Force immediate status detection
                this.statusTracker.detectCurrentStatus();
            }
            
            return { found: true };
        }

        findScrapeButton() {
            // Cache per page lifecycle for performance
            if (this._cachedScrapeBtn && document.body.contains(this._cachedScrapeBtn)) {
                return this._cachedScrapeBtn;
            }

            // Prefer common toolbar/button group locations first
            const candidates = [
                '.btn-group .btn, .btn-group button',
                '.scraper-group button',
                'button[data-toggle="dropdown"]',
                'button'
            ];
            for (const sel of candidates) {
                const list = document.querySelectorAll(sel);
                for (const btn of list) {
                    if (btn.textContent && btn.textContent.toLowerCase().includes('scrape')) {
                        this._cachedScrapeBtn = btn;
                        return btn;
                    }
                }
            }
            return null;
        }
        /**
         * Run automation for multiple scenes with progress UI and rate limiting
         * @param {string[]} sceneIds
         * @param {{concurrency?:number}} opts
         */
        async runAutomationForScenes(sceneIds = [], opts = {}) {
            if (!Array.isArray(sceneIds) || sceneIds.length === 0) return;
            const concurrency = Math.max(1, Number(opts.concurrency) || 2);
            const queue = new TaskQueue({ concurrency, baseDelayMs: 600, maxRetries: 2 });

            // Build lightweight progress overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10010;background:#263645;color:#ecf0f1;padding:10px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.35);font-family:Segoe UI, sans-serif;';
            const label = document.createElement('span');
            label.textContent = `Queued ${sceneIds.length} | Done 0`;
            overlay.appendChild(label);
            document.body.appendChild(overlay);
            let done = 0;

            const goToScene = async (sceneId) => {
                const url = `${getConfig(CONFIG.STASH_ADDRESS).replace(/\/$/, '')}/scenes/${sceneId}`;
                const current = window.location.pathname.includes(`/scenes/${sceneId}`);
                if (!current) {
                    history.pushState({}, '', url);
                    // Wait for React rerender and edit panel readiness
                    await this.wait(400);
                }
                // Ensure panel exists
                if (!this.panel || this.isMinimized) {
                    this.createPanel();
                }
                // Make sure we are on edit context for buttons to exist
                const onEdit = await this.openEditPanel();
                if (!onEdit) throw new Error('Failed to open edit panel');
            };

            sceneIds.forEach((sceneId) => {
                queue.enqueue(async () => {
                    try {
                        await goToScene(sceneId);
                        await this.startAutomation();
                    } catch (_) {
                    } finally {
                        done++;
                        label.textContent = `Queued ${sceneIds.length} | Done ${done}`;
                        if (done === sceneIds.length) setTimeout(() => overlay.remove(), 1500);
                    }
                }, { sceneId });
            });
        }

        // Open-in-tabs and selection features removed

        /**
         * Find the Apply button either in the active modal or edit panel
         */
        findApplyButton() {
            // Prefer modal if visible
            const modal = document.querySelector('.modal.show, .modal.fade.show, .ModalContainer .modal.show');
            const containers = [];
            if (modal) containers.push(modal);
            const editRoot = this.getEditRoot();
            if (editRoot && (!modal || !modal.contains(editRoot))) containers.push(editRoot);
            containers.push(document);

            const selectorSets = [
                'button[data-testid*="apply" i]',
                'button.btn-primary',
                'button',
                '.btn',
                'input[type="submit"], input[type="button"]'
            ];

            for (const root of containers) {
                for (const sel of selectorSets) {
                    try {
                        const list = root.querySelectorAll(sel);
                        for (const btn of list) {
                            const text = (btn.textContent || btn.value || '').toLowerCase();
                            const testId = (btn.getAttribute && btn.getAttribute('data-testid')) || '';
                            if ((text.includes('apply') || /apply/i.test(testId)) && !btn.disabled) {
                                return btn;
                            }
                        }
                    } catch (_) { }
                }
            }
            return null;
        }

        isEditPanelOpen() {
            const fullSelectors = [
                '.entity-edit-panel',
                '.scene-edit-details',
                '.edit-panel',
                '.scene-edit-panel',
                'form[class*="edit" i]',
                '[data-testid*="edit" i]'
            ];
            const fullFound = fullSelectors.some(s => !!document.querySelector(s));
            if (fullFound) return true;
            // Heuristic only if quick edit isn't open
            if (!this.isQuickEditOpen()) {
                const btns = Array.from(document.querySelectorAll('button, .btn, input[type="submit"], input[type="button"]'));
                const hasEditButtons = btns.some(b => {
                    const t = (b.textContent || b.value || '').toLowerCase();
                    return t.includes('save') || t.includes('apply');
                });
                return hasEditButtons;
            }
            return false;
        }

        isQuickEditOpen() {
            const quickSelectors = [
                '.quick-edit', '.quickedit', '.quick-edit-panel',
                '[data-testid*="quick"][data-testid*="edit" i]',
                '[class*="quick" i][class*="edit" i]'
            ];
            return quickSelectors.some(s => !!document.querySelector(s));
        }

        async openEditPanel() {
            if (this.isEditPanelOpen()) return true;

            this.updateSceneStatus('📝 Opening edit panel...');
            const previousSkip = this.skipCurrentSourceRequested;
            // Avoid a stale skip interfering with navigation
            this.skipCurrentSourceRequested = false;

            const waitEdit = async () => {
                const targets = ['.entity-edit-panel', '.scene-edit-details', '.edit-panel', '.scene-edit-panel', 'form[class*="edit" i]', '[data-testid*="edit" i]'];
                try {
                    await this.waitForElement(targets, { timeout: 6000 });
                    // Ensure we didn't open quick edit instead
                    if (this.isQuickEditOpen() && !this.isEditPanelOpen()) return false;
                    return true;
                } catch (_) {
                    // Final heuristic check
                    if (this.isEditPanelOpen() && !this.isQuickEditOpen()) return true;
                    // Brief fallback recheck
                    await this.wait(300);
                    return this.isEditPanelOpen() && !this.isQuickEditOpen();
                }
            };

            // Strategy 1: Edit tab/link
            let tab = null;
            const sceneId = this.statusTracker.extractSceneId() || (window.location.pathname.match(/scenes\/(\d+)/)?.[1] ?? null);
            const tabSelectors = [
                sceneId ? `a[href$="/scenes/${sceneId}/edit"]` : null,
                'a[href*="/scenes/" i][href$="/edit" i]',
                'a[role="tab"][href*="edit" i]',
                'a[href*="/edit" i]',
                'a[class*="nav" i][href*="edit" i]'
            ].filter(Boolean);
            for (const s of tabSelectors) {
                try { tab = document.querySelector(s); } catch (_) { tab = null; }
                if (tab) break;
            }
            if (!tab) {
                // Fallback: only consider anchors with href to avoid quick edit buttons
                const candidates = Array.from(document.querySelectorAll('a[href]:not([disabled])'));
                tab = candidates.find(el => {
                    const href = (el.getAttribute('href') || '').toLowerCase();
                    const text = (el.textContent || '').toLowerCase();
                    return (href.includes('/edit') || text.includes('edit')) && !href.includes('quick');
                }) || null;
            }
            if (tab) {
                await this.clickFast(tab);
                const ok = await waitEdit();
                this.skipCurrentSourceRequested = previousSkip;
                return ok;
            }

            // Strategy 2: button/link with title
            const clickables = Array.from(document.querySelectorAll('button, a'));
            const byTitle = clickables.find(el => (el.getAttribute('title') || '').toLowerCase().includes('edit'));
            if (byTitle) {
                await this.clickFast(byTitle);
                const ok = await waitEdit();
                this.skipCurrentSourceRequested = previousSkip;
                return ok;
            }

            // Strategy 3: text content
            const byText = clickables.find(el => (el.textContent || '').toLowerCase().includes('edit scene') || (el.textContent || '').toLowerCase().trim() === 'edit');
            if (byText) {
                await this.clickFast(byText);
                const ok = await waitEdit();
                this.skipCurrentSourceRequested = previousSkip;
                return ok;
            }
            // Strategy 4: pencil icon
            const icon = document.querySelector('svg[data-icon="pen"], i.fa-pen, i.fa-pencil-alt');
            if (icon) {
                const btn = icon.closest('button, a');
                if (btn) {
                    await this.clickFast(btn);
                    const ok = await waitEdit();
                    this.skipCurrentSourceRequested = previousSkip;
                    return ok;
                }
            }

            this.skipCurrentSourceRequested = previousSkip;
            return this.isEditPanelOpen();
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
                if (this.automationCancelled) return scrapedData;
                // Short wait for the scraper results to render
                await this.wait(300);

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
                // Allow opting out via config
                if (!getConfig(CONFIG.PREFER_HIGHER_RES_THUMBNAILS)) {
                    return { shouldUpdate: false, reason: 'Preference disabled' };
                }
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

                // Require minimum improvement threshold (e.g., >= 20%) to avoid churn
                const minImprovement = 20;
                if (result.shouldUpdate && (Number(improvementPercent) >= minImprovement || currentRes.pixels === 0)) {
                    result.reason = `Scraped thumbnail is ${improvementPercent}% larger (${scrapedRes.width}x${scrapedRes.height} vs ${currentRes.width}x${currentRes.height})`;
                } else if (result.shouldUpdate) {
                    result.shouldUpdate = false;
                    result.reason = `Improvement ${improvementPercent}% below threshold`;
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

        // ----- Lightweight duplicate detection (thumbnail aHash) -----
        async computeAHashFromImage(url) {
            return new Promise((resolve) => {
                if (!url) return resolve('');
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = 8; canvas.height = 8;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, 8, 8);
                        const data = ctx.getImageData(0, 0, 8, 8).data;
                        const gray = [];
                        for (let i = 0; i < data.length; i += 4) gray.push((data[i] + data[i + 1] + data[i + 2]) / 3);
                        const avg = gray.reduce((a, b) => a + b, 0) / gray.length;
                        const bits = gray.map(v => (v > avg ? 1 : 0)).join('');
                        resolve(bits);
                    } catch (_) { resolve(''); }
                };
                img.onerror = () => resolve('');
                img.src = url;
            });
        }
        hamming(a, b) { if (!a || !b || a.length !== b.length) return 64; let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; }
        duplicateScoreFrom(hammingDistance, fpOverlap = 0) {
            const hashScore = Math.max(0, 64 - hammingDistance) / 64;
            const fpScore = Math.min(1, fpOverlap);
            return Math.round((0.7 * hashScore + 0.3 * fpScore) * 100);
        }
        async checkForDuplicateScene(sceneId) {
            try {
                const thumb = this.getCurrentThumbnail();
                if (!thumb) return;
                const hash = await this.computeAHashFromImage(thumb);
                if (!hash) return;
                const key = 'duplicate_hashes';
                const map = JSON.parse(GM_getValue(key, '{}'));
                // Compare to existing
                let best = { id: null, score: 0, dist: 64 };
                Object.entries(map).forEach(([otherId, otherHash]) => {
                    if (otherId === sceneId) return;
                    const dist = this.hamming(hash, otherHash);
                    const score = this.duplicateScoreFrom(dist, 0);
                    if (score > best.score) best = { id: otherId, score, dist };
                });
                // Store current
                map[sceneId] = hash; GM_setValue(key, JSON.stringify(map));
                if (best.score >= 85) {
                    notifications.show(`⚠️ Possible duplicate of scene ${best.id} (score ${best.score}%)`, 'warning');
                }
            } catch (_) { }
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
                        if (getConfig(CONFIG.PREFER_HIGHER_RES_THUMBNAILS)) {
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
            if (this.automationCancelled) return 'cancel';

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

            // Canonicalization removed
            this.updateSceneStatus('✅ Applying metadata changes...');

            const root = this.getEditRoot();
            // Prefer explicit apply button detection with multiple strategies
            const applyBtn = this.findApplyButton();
            if (applyBtn) {
                applyBtn.click();
                await this.waitForGraphQLMutation(1500);
                notifications.show('✅ Metadata applied successfully', 'success');
                return 'apply';
            }

            return 'skip';
        }

        async createNewPerformers() {
            this.updateSceneStatus('👥 Creating new performers...');
            if (this.automationCancelled) return;

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
                            // Short bounded delay between clicks
                            await this.wait(i < plusButtons.length - 1 ? 400 : 700);

                        }
                    } catch (error) {
                    }
                }
            }
        }
        // canonicalization removed

        async organizeScene({ fast = false } = {}) {
            this.updateSceneStatus('📁 Organizing scene...');
            if (this.automationCancelled) return;

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
                if (this.dryRunMode) {
                    this.mutationPlan.push({ type: 'organizeScene', sceneId: this.statusTracker.extractSceneId(), when: Date.now() });
                    notifications.show('🧪 Dry-run: recorded organizeScene', 'info');
                    return;
                }
                organizedToggle.click();
                // Bounded wait for UI to update
                await this.wait(fast ? 200 : 500);

                // Verify the organization was successful
                const newStatus = await this.checkOrganizedStatus();
                if (newStatus) {
                    this.updateSceneStatus('✅ Organized');
                    this._organizedAfterSave = true;
                    
                    // Immediately update status tracker
                    if (this.statusTracker) {
                        this.statusTracker.updateStatus('organized', {
                            status: true,
                            timestamp: new Date()
                        });
                        // Force immediate status detection
                        this.statusTracker.detectCurrentStatus();
                    }
                } else {
                    this.updateSceneStatus('⚠️ Organization status unclear');
                }

                // Update status widget after organize change
                if (!fast) {
                    await this.updateStatusAfterOrganize();
                }
            } else {
                this.updateSceneStatus('✅ Scene already organized');
                this._organizedAfterSave = true;
                
                // Immediately update status tracker
                if (this.statusTracker) {
                    this.statusTracker.updateStatus('organized', {
                        status: true,
                        timestamp: new Date()
                    });
                    // Force immediate status detection
                    this.statusTracker.detectCurrentStatus();
                }

                // Still update widget to ensure accuracy
                if (!fast) {
                    await this.updateStatusAfterOrganize();
                }
            }
        }

        async updateStatusAfterOrganize() {
            try {
                // Prefer evented update; fallback to short wait
                const mutationEvent = new Promise(resolve => {
                    const handler = () => {
                        window.removeEventListener('stash:graphql-mutation', handler);
                        resolve();
                    };
                    window.addEventListener('stash:graphql-mutation', handler, { once: true });
                });
                const timeout = new Promise(resolve => setTimeout(resolve, 1000));
                await Promise.race([mutationEvent, timeout]);

                // Clear GraphQL caches to ensure fresh data
                if (graphqlClient && graphqlClient.clear) graphqlClient.clear();
                if (this.sourceDetector && this.sourceDetector.cache) this.sourceDetector.cache.clear();

                // Trigger status update from DOM
                await this.updateStatusFromDOM();
            } catch (error) {
            }
        }

        async saveScene() {
            this.updateSceneStatus('💾 Saving...');

            // Prefer scoped search within edit panel to avoid broad DOM scans
            const editRoot = this.getEditRoot();
            const allButtons = editRoot.querySelectorAll('button, .btn, input[type="button"], input[type="submit"]');
            for (const btn of allButtons) {
                const text = btn.textContent || btn.value || '';
                if (text.toLowerCase().includes('save') && !btn.disabled) {
                    btn.click();
                    // Wait for a GraphQL mutation event or fallback after 1200ms
                    await this.waitForGraphQLMutation(1200);

                    // Immediately attempt to organize after save (fast path), before status update
                    try {
                        await this.organizeScene({ fast: true });
                        // organizeScene will set this._organizedAfterSave accordingly
                    } catch (e) {
                        // Non-fatal; organization may be handled later in the flow
                    }

                    // Update status widget after save
                    await this.updateStatusAfterSave();
                    return;
                }
            }
        }

        async updateStatusAfterSave() {
            try {
                // Prefer evented update; fallback to bounded wait
                // Give backend a short window to update when events are not sufficient
                await this.wait(800);

                // Clear GraphQL caches to ensure fresh data
                if (graphqlClient && graphqlClient.clear) graphqlClient.clear();
                if (this.sourceDetector && this.sourceDetector.cache) this.sourceDetector.cache.clear();

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
    // Create core components first
    const sourceDetector = new SourceDetector();
    const statusTracker = new StatusTracker(sourceDetector);
    const historyManager = new HistoryManager();

    // Create UI manager
    const uiManager = new UIManager();

    // Create global summary widget and make it available
    const globalSummaryWidget = new AutomationSummaryWidget(uiManager, sourceDetector, statusTracker, historyManager);
    window.globalSummaryWidget = globalSummaryWidget;
    
    // Assign to uiManager
    uiManager.summaryWidget = globalSummaryWidget;

    // Make available globally
    window.stashUIManager = uiManager;
    window.sourceDetector = sourceDetector;
    window.statusTracker = statusTracker;
    window.historyManager = historyManager;

    // Initialize UI after DOM is ready
    async function initializeUI() {
        debugLog('🎯 Initializing UI...');
        const urlObj = new URL(window.location.href);
        const pathname = urlObj.pathname;
        const isSceneDetail = /\/scenes\/(\d+)/.test(pathname);
        const isScenesBrowse = pathname.startsWith('/scenes') && !isSceneDetail && !pathname.includes('/scenes/markers');

        if (isSceneDetail) {
            // Check if scene is already organized
            await uiManager.wait(1000); // Wait for page to load
            const isOrganized = await uiManager.checkOrganizedStatus();

            if (isOrganized) {
                uiManager.createMinimizedButton();
                uiManager.isMinimized = true;
            } else {
                uiManager.createPanel();
            }
        } else if (isScenesBrowse) {
            // On browse page, show minimized button by default
            uiManager.createMinimizedButton();
            uiManager.isMinimized = true;
        } else {
            // On non-scene pages, always show minimized button
            uiManager.createMinimizedButton();
            uiManager.isMinimized = true;
        }
    }

    // Initialize performance enhancements if available
    function initializeEnhancements() {
        debugLog('🔍 Checking for performance enhancements...');

        // Check if cache manager is available (already initialized by library)
        if (window.cacheManager) {
            debugLog('✅ Cache manager available');
            // Pre-warm cache with common queries
            if (window.graphQLCache && window.graphQLCache.warmup) {
                window.graphQLCache.warmup();
            }
        }

        // Check if performance monitor is available (already initialized by library)
        if (window.performanceMonitor) {
            debugLog('✅ Performance monitoring available');
            // Configure performance thresholds
            if (window.performanceConfigManager) {
                window.performanceConfigManager.set('monitoring.warnThreshold', 100);
                window.performanceConfigManager.set('monitoring.criticalThreshold', 500);
            }
        }

        // Check if theme manager is available (already initialized by library)
        if (window.themeManager) {
            // Theme manager might need initialization
            if (window.themeManager.initialize) {
                window.themeManager.initialize();
            }
            debugLog('✅ Theme manager available');
            // Apply dark theme by default for Stash
            if (window.themeManager.applyTheme) {
                window.themeManager.applyTheme('dark');
            }
        }

        // Check if keyboard shortcuts are available (already initialized by library)
        if (window.keyboardShortcuts) {
            // The library already has default shortcuts defined in defaultShortcuts
            // We just need to set up the action callbacks for them
            if (window.keyboardShortcuts.setActionCallback) {
                // Map library actions to our UI manager methods
                window.keyboardShortcuts.setActionCallback('startAutomation', () => {
                    if (window.stashUIManager && window.stashUIManager.startAutomation) {
                        window.stashUIManager.startAutomation();
                    }
                });
                
                window.keyboardShortcuts.setActionCallback('startAutomationSilent', () => {
                    if (window.stashUIManager && window.stashUIManager.startAutomation) {
                        window.stashUIManager.startAutomation(true); // Silent mode
                    }
                });
                
                window.keyboardShortcuts.setActionCallback('toggleMinimize', () => {
                    if (window.stashUIManager) {
                        window.stashUIManager.isMinimized ? window.stashUIManager.expand() : window.stashUIManager.minimize();
                    }
                });
                
                window.keyboardShortcuts.setActionCallback('openConfig', () => {
                    if (window.stashUIManager && window.stashUIManager.showConfigDialog) {
                        window.stashUIManager.showConfigDialog();
                    }
                });
                
                window.keyboardShortcuts.setActionCallback('showHelp', () => {
                    if (window.stashUIManager && window.stashUIManager.showHealthDashboard) {
                        window.stashUIManager.showHealthDashboard();
                    }
                });
                
                window.keyboardShortcuts.setActionCallback('cancelAutomation', () => {
                    if (window.stashUIManager && window.stashUIManager.automationInProgress) {
                        window.stashUIManager.cancelAutomation();
                    }
                });
                
                // Edit panel shortcuts
                window.keyboardShortcuts.setActionCallback('applyScrapedData', () => {
                    if (window.stashUIManager && window.stashUIManager.applyScrapedData) {
                        window.stashUIManager.applyScrapedData();
                    }
                });
                
                window.keyboardShortcuts.setActionCallback('saveScene', () => {
                    if (window.stashUIManager && window.stashUIManager.saveScene) {
                        window.stashUIManager.saveScene();
                    }
                });
                
                window.keyboardShortcuts.setActionCallback('organizeScene', () => {
                    if (window.stashUIManager && window.stashUIManager.organizeScene) {
                        window.stashUIManager.organizeScene();
                    }
                });
                
                window.keyboardShortcuts.setActionCallback('scrapeStashDB', () => {
                    if (window.stashUIManager && window.stashUIManager.scrapeStashDB) {
                        window.stashUIManager.scrapeStashDB();
                    }
                });
                
                window.keyboardShortcuts.setActionCallback('scrapeThePornDB', () => {
                    if (window.stashUIManager && window.stashUIManager.scrapeThePornDB) {
                        window.stashUIManager.scrapeThePornDB();
                    }
                });
                
                // Navigation shortcuts
                window.keyboardShortcuts.setActionCallback('previousScene', () => {
                    const prevButton = document.querySelector('button[title="Previous"]');
                    if (prevButton) prevButton.click();
                });
                
                window.keyboardShortcuts.setActionCallback('nextScene', () => {
                    const nextButton = document.querySelector('button[title="Next"]');
                    if (nextButton) nextButton.click();
                });
                
                window.keyboardShortcuts.setActionCallback('openEditPanel', () => {
                    const editButton = document.querySelector('a[data-rb-event-key="scene-edit-panel"]');
                    if (editButton) editButton.click();
                });
                
                window.keyboardShortcuts.setActionCallback('closeEditPanel', () => {
                    const closeButton = document.querySelector('.edit-panel button.close');
                    if (closeButton) closeButton.click();
                });
                
                // Performance shortcuts
                window.keyboardShortcuts.setActionCallback('togglePerformanceMonitor', () => {
                    const widget = document.getElementById('stash-performance-widget');
                    if (widget) {
                        widget.style.display = widget.style.display === 'none' ? 'block' : 'none';
                    }
                });
                
                window.keyboardShortcuts.setActionCallback('toggleDebugMode', () => {
                    if (window.performanceConfigManager) {
                        const debugMode = window.performanceConfigManager.get('debug.enabled');
                        window.performanceConfigManager.set('debug.enabled', !debugMode);
                        notifications.show(`Debug mode ${!debugMode ? 'enabled' : 'disabled'}`, 'info');
                    }
                });
                
                window.keyboardShortcuts.setActionCallback('toggleTheme', () => {
                    if (window.themeManager) {
                        // Get all available theme names
                        const allThemes = window.themeManager.getAllThemes();
                        const themeNames = Object.keys(allThemes).filter(name => name !== 'system');
                        
                        // Get current theme name
                        const currentThemeName = window.themeManager.currentTheme || 'dark';
                        
                        // Find next theme
                        const currentIndex = themeNames.indexOf(currentThemeName);
                        const nextIndex = (currentIndex + 1) % themeNames.length;
                        const nextTheme = themeNames[nextIndex];
                        
                        // Apply the next theme
                        window.themeManager.applyTheme(nextTheme);
                        notifications.show(`Theme changed to ${allThemes[nextTheme].name || nextTheme}`, 'info');
                    }
                });
            }
            debugLog('✅ Keyboard shortcuts action callbacks registered');
        }

        // Check if animation controller is available (already initialized by library)
        if (window.animationController) {
            debugLog('✅ Animation controller available');
        }

        // Check for performance config manager
        if (window.performanceConfigManager) {
            debugLog('✅ Performance configuration available');
        }

        // Summary of available enhancements
        const enhancements = [];
        if (window.cacheManager) enhancements.push('Caching');
        if (window.performanceMonitor) enhancements.push('Performance');
        if (window.themeManager) enhancements.push('Themes');
        if (window.keyboardShortcuts) enhancements.push('Keyboard');
        if (window.animationController) enhancements.push('Animations');
        if (window.performanceConfigManager) enhancements.push('Config');

        if (enhancements.length > 0) {
            debugLog(`🚀 Enhanced mode active with: ${enhancements.join(', ')}`);
        } else {
            debugLog('⚠️ Running in standard mode (no enhancements detected)');
        }
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            try {
                initializeEnhancements();
                setTimeout(initializeUI, 1000);
            } catch (error) {
                console.error('❌ AutomateStash initialization error:', error);
                debugLog('Error details:', error.stack);
            }
        });
    } else {
        try {
            initializeEnhancements();
            setTimeout(initializeUI, 1000);
        } catch (error) {
            console.error('❌ AutomateStash initialization error:', error);
            debugLog('Error details:', error.stack);
        }
    }

    window.uiManager = uiManager;
    window.expandAutomateStash = () => uiManager.expand();


})();