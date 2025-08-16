// ==UserScript==
// @name         Stash Bulk Operations Manager
// @version      1.3.0
// @description  Efficient batch editing and management of multiple scenes, performers, and metadata within Stash
// @author       AutomateStash Suite
// @match        http://localhost:9998/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_notification
// ==/UserScript==

(function () {
    'use strict';

    console.log('🚀 Stash Bulk Operations Manager v1.3.0 - Enhanced with View Details and Remove from Scenes functionality');

    // ===== CONFIGURATION =====
    const CONFIG = {
        ENABLE_BULK_TAGS: 'enableBulkTags',
        ENABLE_BULK_PERFORMERS: 'enableBulkPerformers',
        ENABLE_BULK_STUDIOS: 'enableBulkStudios',
        ENABLE_BULK_METADATA: 'enableBulkMetadata',
        SHOW_PROGRESS: 'showProgress',
        AUTO_REFRESH: 'autoRefresh',
        MAX_CONCURRENT_OPERATIONS: 'maxConcurrentOperations'
    };

    const DEFAULTS = {
        [CONFIG.ENABLE_BULK_TAGS]: true,
        [CONFIG.ENABLE_BULK_PERFORMERS]: true,
        [CONFIG.ENABLE_BULK_STUDIOS]: true,
        [CONFIG.ENABLE_BULK_METADATA]: true,
        [CONFIG.SHOW_PROGRESS]: true,
        [CONFIG.AUTO_REFRESH]: true,
        [CONFIG.MAX_CONCURRENT_OPERATIONS]: 5
    };

    function getConfig(key) {
        const value = GM_getValue(key);
        return value !== undefined ? value : DEFAULTS[key];
    }

    function setConfig(key, value) {
        GM_setValue(key, value);
    }

    // ===== GRAPHQL CLIENT =====
    class GraphQLClient {
        constructor(options = {}) {
            this.baseUrl = options.baseUrl || '';
            this.endpoint = `${this.baseUrl}/graphql`;
            this.apiKey = options.apiKey || '';
            this.timeout = options.timeout || 30000;
            this.retryAttempts = options.retryAttempts || 2;
            this.retryDelay = options.retryDelay || 1000;
            this._abortController = null;
        }

        async query(query, variables = {}, options = {}) {
            const attempts = options.retry ?? this.retryAttempts;
            let lastError;

            for (let attempt = 0; attempt <= attempts; attempt++) {
                if (attempt > 0) {
                    // Exponential backoff: 1s, 2s, 4s...
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                try {
                    // Create abort controller for timeout
                    this._abortController = new AbortController();
                    const timeoutId = setTimeout(() => this._abortController.abort(), this.timeout);

                    const headers = {
                        'Content-Type': 'application/json',
                    };
                    if (this.apiKey) {
                        headers['ApiKey'] = this.apiKey;
                    }

                    const response = await fetch(this.endpoint, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ query, variables }),
                        signal: this._abortController.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const result = await response.json();
                    if (result.errors) {
                        // Don't retry GraphQL errors (they're likely not transient)
                        console.error('GraphQL errors:', result.errors);
                        throw new Error(result.errors[0].message);
                    }
                    return result.data;
                } catch (error) {
                    lastError = error;
                    if (error.name === 'AbortError') {
                        console.error(`⏱️ Request timeout after ${this.timeout}ms (attempt ${attempt + 1}/${attempts + 1})`);
                    } else if (attempt === attempts) {
                        console.error('❌ GraphQL query failed after all retries:', error);
                    } else {
                        console.warn(`⚠️ GraphQL query failed (attempt ${attempt + 1}/${attempts + 1}):`, error.message);
                    }
                }
            }
            throw lastError;
        }

        abort() {
            if (this._abortController) {
                this._abortController.abort();
            }
        }

        // Pagination helper - fetches all pages of a query
        async paginate(queryFn, options = {}) {
            const { perPage = 100, maxItems = Infinity } = options;
            let page = 1;
            let allItems = [];

            while (allItems.length < maxItems) {
                const result = await queryFn({ per_page: perPage, page });
                const items = result || [];

                if (items.length === 0) break;

                allItems = allItems.concat(items);

                if (items.length < perPage) break;
                page++;
            }

            return allItems.slice(0, maxItems);
        }

        // Batch scene update - update multiple scenes in one mutation
        async scenesUpdate(updates) {
            const mutation = `
                mutation ScenesUpdate($input: [SceneUpdateInput!]!) {
                    scenesUpdate(input: $input) {
                        id
                    }
                }
            `;

            // Ensure all IDs are strings
            const input = updates.map(update => ({
                ...update,
                id: String(update.id)
            }));

            return await this.query(mutation, { input });
        }

        // Search queries
        async searchTags(searchTerm = '') {
            const query = `
                query FindTags($filter: FindFilterType) {
                    findTags(filter: $filter) {
                        tags {
                            id
                            name
                            scene_count
                        }
                    }
                }
            `;

            const variables = searchTerm ? {
                filter: {
                    q: searchTerm,
                    per_page: 50
                }
            } : {
                filter: { per_page: 500 }
            };

            const result = await this.query(query, variables);
            return result.findTags.tags;
        }

        async searchPerformers(searchTerm = '') {
            const query = `
                query FindPerformers($filter: FindFilterType) {
                    findPerformers(filter: $filter) {
                        performers {
                            id
                            name
                            scene_count
                        }
                    }
                }
            `;

            const variables = searchTerm ? {
                filter: {
                    q: searchTerm,
                    per_page: 50
                }
            } : {
                filter: { per_page: 500 }
            };

            const result = await this.query(query, variables);
            return result.findPerformers.performers;
        }

        async searchStudios(searchTerm = '') {
            const query = `
                query FindStudios($filter: FindFilterType) {
                    findStudios(filter: $filter) {
                        studios {
                            id
                            name
                            scene_count
                        }
                    }
                }
            `;

            const variables = searchTerm ? {
                filter: {
                    q: searchTerm,
                    per_page: 50
                }
            } : {
                filter: { per_page: 500 }
            };

            const result = await this.query(query, variables);
            return result.findStudios.studios;
        }

        async getSceneDetails(sceneIds) {
            // Query each scene individually to avoid complex filter issues
            const scenes = [];

            console.log('Getting scene details for IDs:', sceneIds);

            for (const sceneId of sceneIds) {
                try {
                    const query = `
                        query FindScene($id: ID!) {
                            findScene(id: $id) {
                                id
                                title
                                date
                                files {
                                    path
                                    basename
                                }
                                paths {
                                    screenshot
                                }
                                tags {
                                    id
                                    name
                                }
                                performers {
                                    id
                                    name
                                }
                                studio {
                                    id
                                    name
                                }
                            }
                        }
                    `;

                    const result = await this.query(query, { id: sceneId });
                    if (result.findScene) {
                        scenes.push(result.findScene);
                    }
                } catch (error) {
                    console.error(`Failed to fetch scene ${sceneId}:`, error);
                }
            }

            return scenes;
        }
    }

    // ===== SELECTION MANAGER =====
    class SelectionManager {
        constructor() {
            this.selectedScenes = new Set();
            this.observers = [];
            this.selectionChangeCallbacks = [];
        }

        addScene(sceneId) {
            this.selectedScenes.add(sceneId);
            this.notifySelectionChange();
        }

        removeScene(sceneId) {
            this.selectedScenes.delete(sceneId);
            this.notifySelectionChange();
        }

        toggleScene(sceneId) {
            if (this.selectedScenes.has(sceneId)) {
                this.removeScene(sceneId);
            } else {
                this.addScene(sceneId);
            }
            return this.isSelected(sceneId);
        }

        selectAll() {
            const sceneCards = document.querySelectorAll('[data-scene-id]');
            sceneCards.forEach(card => {
                const sceneId = card.getAttribute('data-scene-id');
                if (sceneId) {
                    this.selectedScenes.add(sceneId);
                }
            });
            this.notifySelectionChange();
        }

        clearSelection() {
            this.selectedScenes.clear();
            this.notifySelectionChange();
        }

        getSelectedScenes() {
            return Array.from(this.selectedScenes);
        }

        getSelectedCount() {
            return this.selectedScenes.size;
        }

        isSelected(sceneId) {
            return this.selectedScenes.has(sceneId);
        }

        onSelectionChange(callback) {
            this.selectionChangeCallbacks.push(callback);
        }

        notifySelectionChange() {
            this.selectionChangeCallbacks.forEach(callback => {
                callback(this.getSelectedCount());
            });
        }
    }

    // ===== TASK QUEUE FOR CONCURRENCY CONTROL =====
    class TaskQueue {
        constructor(options = {}) {
            this.concurrency = options.concurrency || 4;
            this.retryCount = options.retryCount || 1;
            this.timeout = options.timeout || 30000;
            this.queue = [];
            this.activeCount = 0;
            this.aborted = false;
            this.results = [];
            this.errors = [];
            this.onProgress = options.onProgress || (() => { });
            this.onError = options.onError || (() => { });
        }

        async enqueue(task, metadata = {}) {
            if (this.aborted) {
                throw new Error('TaskQueue has been aborted');
            }

            return new Promise((resolve, reject) => {
                this.queue.push({
                    task,
                    metadata,
                    resolve,
                    reject,
                    attempts: 0
                });
                this._processNext();
            });
        }

        async enqueueAll(tasks) {
            const promises = tasks.map((task, index) =>
                this.enqueue(task.fn, { ...task.metadata, index })
            );
            return Promise.allSettled(promises);
        }

        async _processNext() {
            if (this.aborted || this.activeCount >= this.concurrency || this.queue.length === 0) {
                return;
            }

            const item = this.queue.shift();
            this.activeCount++;

            try {
                // Add timeout wrapper
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Task timeout')), this.timeout)
                );

                const result = await Promise.race([
                    item.task(),
                    timeoutPromise
                ]);

                this.results.push({ metadata: item.metadata, result });
                item.resolve(result);
                this.onProgress({
                    completed: this.results.length,
                    errors: this.errors.length,
                    remaining: this.queue.length,
                    active: this.activeCount
                });
            } catch (error) {
                item.attempts++;

                if (item.attempts <= this.retryCount && !this.aborted) {
                    // Retry with exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, item.attempts - 1), 10000);
                    setTimeout(() => {
                        this.queue.unshift(item);
                        this._processNext();
                    }, delay);
                    this.activeCount--;
                    return;
                }

                this.errors.push({ metadata: item.metadata, error });
                this.onError({ metadata: item.metadata, error });
                item.reject(error);
            } finally {
                this.activeCount--;
                // Process next item
                setTimeout(() => this._processNext(), 0);
            }
        }

        abort() {
            this.aborted = true;
            // Reject all pending tasks
            while (this.queue.length > 0) {
                const item = this.queue.shift();
                item.reject(new Error('Queue aborted'));
            }
        }

        reset() {
            this.queue = [];
            this.activeCount = 0;
            this.aborted = false;
            this.results = [];
            this.errors = [];
        }

        getStats() {
            return {
                completed: this.results.length,
                errors: this.errors.length,
                pending: this.queue.length,
                active: this.activeCount,
                total: this.results.length + this.errors.length + this.queue.length + this.activeCount
            };
        }
    }

    // ===== BULK OPERATIONS ENGINE =====
    class BulkOperationsEngine {
        constructor(graphqlClient) {
            this.graphql = graphqlClient;
            this.taskQueue = null;
            this.batchSize = 50; // Process scenes in batches to avoid overwhelming the server
        }

        // Initialize task queue with progress callbacks
        initTaskQueue(options = {}) {
            this.taskQueue = new TaskQueue({
                concurrency: options.concurrency || 4,
                retryCount: options.retryCount || 2,
                timeout: options.timeout || 30000,
                onProgress: options.onProgress,
                onError: options.onError
            });
            return this.taskQueue;
        }

        // Split scene IDs into batches for more efficient processing
        _createBatches(items, batchSize = this.batchSize) {
            const batches = [];
            for (let i = 0; i < items.length; i += batchSize) {
                batches.push(items.slice(i, i + batchSize));
            }
            return batches;
        }

        async bulkUpdateTags(sceneIds, tagsToAdd = [], tagsToRemove = []) {
            // Use batch update if we have many scenes
            if (sceneIds.length > this.batchSize) {
                return this.bulkUpdateTagsBatched(sceneIds, tagsToAdd, tagsToRemove);
            }

            const mutation = `
                mutation BulkUpdateSceneTags($ids: [ID!]!, $tag_ids: BulkUpdateIds!) {
                    bulkSceneUpdate(input: {
                        ids: $ids
                        tag_ids: $tag_ids
                    }) {
                        id
                    }
                }
            `;

            const variables = {
                ids: sceneIds,
                tag_ids: {
                    ids: tagsToRemove.length > 0 ? tagsToRemove : tagsToAdd,
                    mode: tagsToRemove.length > 0 ? 'REMOVE' : 'ADD'
                }
            };

            return await this.graphql.query(mutation, variables);
        }

        async bulkUpdateTagsBatched(sceneIds, tagsToAdd = [], tagsToRemove = []) {
            const batches = this._createBatches(sceneIds);
            const queue = this.taskQueue || this.initTaskQueue();

            const tasks = batches.map((batch, index) => ({
                fn: () => this.bulkUpdateTags(batch, tagsToAdd, tagsToRemove),
                metadata: { batch: index + 1, total: batches.length, sceneCount: batch.length }
            }));

            const results = await queue.enqueueAll(tasks);

            // Aggregate results and errors
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected');

            if (failed.length > 0) {
                console.warn(`⚠️ ${failed.length} batches failed:`, failed);
            }

            return {
                success: successful === results.length,
                processed: successful * this.batchSize,
                errors: failed.map(r => r.reason)
            };
        }

        async bulkUpdatePerformers(sceneIds, performersToAdd = [], performersToRemove = []) {
            const mutation = `
                mutation BulkUpdateScenePerformers($ids: [ID!]!, $performer_ids: BulkUpdateIds!) {
                    bulkSceneUpdate(input: {
                        ids: $ids
                        performer_ids: $performer_ids
                    }) {
                        id
                    }
                }
            `;

            const variables = {
                ids: sceneIds,
                performer_ids: {
                    ids: performersToRemove.length > 0 ? performersToRemove : performersToAdd,
                    mode: performersToRemove.length > 0 ? 'REMOVE' : 'ADD'
                }
            };

            return await this.graphql.query(mutation, variables);
        }

        async bulkUpdateStudio(sceneIds, studioId) {
            const mutation = `
                mutation BulkUpdateSceneStudio($ids: [ID!]!, $studio_id: ID) {
                    bulkSceneUpdate(input: {
                        ids: $ids
                        studio_id: $studio_id
                    }) {
                        id
                    }
                }
            `;

            const variables = {
                ids: sceneIds,
                studio_id: studioId
            };

            return await this.graphql.query(mutation, variables);
        }

        async bulkUpdateMetadata(sceneIds, metadata) {
            const mutation = `
                mutation BulkUpdateSceneMetadata($ids: [ID!]!, $input: BulkSceneUpdateInput!) {
                    bulkSceneUpdate(input: $input) {
                        id
                    }
                }
            `;

            const input = {
                ids: sceneIds,
                ...metadata
            };

            const variables = { ids: sceneIds, input };

            return await this.graphql.query(mutation, variables);
        }
    }

    // ===== ENHANCED PROGRESS TRACKER =====
    class ProgressTracker {
        constructor(totalItems, options = {}) {
            this.total = totalItems;
            this.completed = 0;
            this.errors = [];
            this.progressElement = null;
            this.errorPanel = null;
            this.startTime = Date.now();
            this.options = {
                title: 'Bulk Operation Progress',
                showETA: true,
                showErrors: true,
                autoClose: true,
                autoCloseDelay: 3000,
                ...options
            };
            this.createProgressUI();
        }

        createProgressUI() {
            this.progressElement = document.createElement('div');
            this.progressElement.className = 'bulk-progress-tracker';
            this.progressElement.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: white;
                color: #2c3e50;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                min-width: 350px;
                z-index: 10000;
                overflow: hidden;
                animation: slideUp 0.3s ease;
            `;

            // Add animation styles if not already present
            if (!document.querySelector('#progress-animations')) {
                const style = document.createElement('style');
                style.id = 'progress-animations';
                style.textContent = `
                    @keyframes slideUp {
                        from { transform: translateY(100%); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                    @keyframes slideDown {
                        from { transform: translateY(0); opacity: 1; }
                        to { transform: translateY(100%); opacity: 0; }
                    }
                `;
                document.head.appendChild(style);
            }

            this.updateDisplay();
            document.body.appendChild(this.progressElement);
        }

        updateProgress(completed, error = null) {
            this.completed = completed;
            if (error) {
                this.errors.push({
                    timestamp: new Date().toLocaleTimeString(),
                    message: error.message || error,
                    details: error
                });
            }
            this.updateDisplay();
        }

        updateDisplay() {
            const percentage = Math.round((this.completed / this.total) * 100);
            const hasErrors = this.errors.length > 0;
            const eta = this.calculateETA();

            this.progressElement.innerHTML = `
                <div style="padding: 15px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <h4 style="margin: 0; font-size: 16px; font-weight: 600;">${this.options.title}</h4>
                </div>
                <div style="padding: 20px;">
                    <div style="background: #ecf0f1; height: 24px; border-radius: 12px; overflow: hidden; position: relative;">
                        <div style="
                            background: ${hasErrors ? 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)' : 'linear-gradient(135deg, #27ae60 0%, #229954 100%)'};
                            height: 100%;
                            width: ${percentage}%;
                            transition: width 0.3s ease;
                            position: relative;
                        ">
                            <span style="
                                position: absolute;
                                right: 10px;
                                top: 50%;
                                transform: translateY(-50%);
                                color: white;
                                font-size: 12px;
                                font-weight: 600;
                            ">${percentage}%</span>
                        </div>
                    </div>
                    <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <p style="margin: 0; font-size: 14px; color: #2c3e50;">
                                <strong>${this.completed}</strong> / ${this.total} completed
                            </p>
                            ${this.options.showETA && eta ? `<p style="margin: 5px 0 0 0; font-size: 12px; color: #7f8c8d;">ETA: ${eta}</p>` : ''}
                        </div>
                        ${hasErrors ? `
                            <div style="text-align: right;">
                                <p style="margin: 0; color: #e74c3c; font-size: 14px; font-weight: 600;">
                                    ${this.errors.length} error${this.errors.length > 1 ? 's' : ''}
                                </p>
                                ${this.options.showErrors ? `
                                    <button onclick="window.bulkProgressTracker?.toggleErrorPanel()" style="
                                        background: #e74c3c;
                                        color: white;
                                        border: none;
                                        padding: 4px 12px;
                                        border-radius: 4px;
                                        cursor: pointer;
                                        font-size: 12px;
                                        margin-top: 5px;
                                    ">View Errors</button>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;

            // Store reference for button click
            window.bulkProgressTracker = this;
        }

        calculateETA() {
            if (this.completed === 0) return null;

            const elapsed = Date.now() - this.startTime;
            const rate = this.completed / elapsed;
            const remaining = this.total - this.completed;
            const eta = remaining / rate;

            if (eta < 1000) return 'Less than a second';
            if (eta < 60000) return `${Math.round(eta / 1000)} seconds`;
            if (eta < 3600000) return `${Math.round(eta / 60000)} minutes`;
            return `${Math.round(eta / 3600000)} hours`;
        }

        toggleErrorPanel() {
            if (!this.errorPanel) {
                this.createErrorPanel();
            }
            this.errorPanel.style.display =
                this.errorPanel.style.display === 'none' ? 'block' : 'none';
        }

        createErrorPanel() {
            this.errorPanel = document.createElement('div');
            this.errorPanel.style.cssText = `
                position: fixed;
                bottom: 100px;
                right: 20px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                max-width: 400px;
                max-height: 300px;
                overflow: hidden;
                z-index: 9999;
            `;

            this.errorPanel.innerHTML = `
                <div style="padding: 12px 15px; background: #e74c3c; color: white; font-weight: 600;">
                    Errors (${this.errors.length})
                    <button onclick="this.parentElement.parentElement.style.display='none'" style="
                        float: right;
                        background: none;
                        border: none;
                        color: white;
                        font-size: 20px;
                        cursor: pointer;
                        padding: 0;
                        margin: -5px -5px 0 0;
                    ">×</button>
                </div>
                <div style="max-height: 250px; overflow-y: auto; padding: 10px;">
                    ${this.errors.map((error, index) => `
                        <div style="
                            padding: 10px;
                            margin-bottom: 10px;
                            background: #ffe4e1;
                            border-left: 3px solid #e74c3c;
                            border-radius: 4px;
                        ">
                            <div style="font-size: 11px; color: #7f8c8d; margin-bottom: 5px;">
                                ${error.timestamp}
                            </div>
                            <div style="font-size: 13px; color: #2c3e50;">
                                ${error.message}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            document.body.appendChild(this.errorPanel);
        }

        showSummary() {
            const successCount = this.completed - this.errors.length;
            const duration = Math.round((Date.now() - this.startTime) / 1000);

            this.progressElement.innerHTML = `
                <div style="padding: 15px 20px; background: ${this.errors.length > 0 ? '#e74c3c' : '#27ae60'}; color: white;">
                    <h4 style="margin: 0; font-size: 16px; font-weight: 600;">
                        ${this.errors.length > 0 ? '⚠️ Operation Completed with Errors' : '✅ Operation Completed Successfully'}
                    </h4>
                </div>
                <div style="padding: 20px;">
                    <div style="margin-bottom: 15px;">
                        <p style="margin: 5px 0; color: #27ae60; font-size: 14px;">
                            ✅ ${successCount} scenes updated successfully
                        </p>
                        ${this.errors.length > 0 ? `
                            <p style="margin: 5px 0; color: #e74c3c; font-size: 14px;">
                                ❌ ${this.errors.length} errors occurred
                            </p>
                        ` : ''}
                        <p style="margin: 5px 0; color: #7f8c8d; font-size: 12px;">
                            ⏱️ Completed in ${duration} seconds
                        </p>
                        <p style="margin: 5px 0; color: #3498db; font-size: 12px; font-style: italic;">
                            💡 Selection preserved for additional operations
                        </p>
                    </div>
                    <button onclick="window.bulkProgressTracker?.destroy()" style="
                        width: 100%;
                        background: #3498db;
                        color: white;
                        border: none;
                        padding: 10px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                    ">Close</button>
                </div>
            `;

            if (this.errors.length > 0) {
                console.error('Bulk operation errors:', this.errors);
            }

            // Auto-close if configured and no errors
            if (this.options.autoClose && this.errors.length === 0) {
                setTimeout(() => this.destroy(), this.options.autoCloseDelay);
            }
        }

        destroy() {
            if (this.progressElement) {
                this.progressElement.style.animation = 'slideDown 0.3s ease';
                setTimeout(() => {
                    this.progressElement?.remove();
                    this.progressElement = null;
                }, 300);
            }
            if (this.errorPanel) {
                this.errorPanel.remove();
                this.errorPanel = null;
            }
            delete window.bulkProgressTracker;
        }
    }

    // ===== UI MANAGER =====
    class BulkUIManager {
        constructor(selectionManager, bulkOperations) {
            this.selectionManager = selectionManager;
            this.bulkOperations = bulkOperations;
            this.toolbar = null;
            this.checkboxStyle = null;

            this.initializeUI();
            this.setupSelectionUI();
            this.observeSceneCards();
        }

        initializeUI() {
            // Add checkbox styles
            const style = document.createElement('style');
            style.textContent = `
                .bulk-select-checkbox {
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    z-index: 10;
                    width: 20px;
                    height: 20px;
                    cursor: pointer;
                }
                
                .scene-card-container {
                    position: relative;
                }
                
                .scene-card-container.bulk-selected {
                    outline: 3px solid #3498db;
                    outline-offset: -3px;
                }
                
                .bulk-operations-toolbar {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 25px;
                    border-radius: 30px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    display: flex;
                    gap: 15px;
                    align-items: center;
                    z-index: 9999;
                    transition: all 0.3s ease;
                }
                
                .bulk-operations-toolbar button {
                    background: rgba(255,255,255,0.2);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s ease;
                }
                
                .bulk-operations-toolbar button:hover {
                    background: rgba(255,255,255,0.3);
                    transform: scale(1.05);
                }
            `;
            document.head.appendChild(style);
            this.checkboxStyle = style;
        }

        setupSelectionUI() {
            // Listen for selection changes
            this.selectionManager.onSelectionChange((count) => {
                if (count > 0) {
                    this.showToolbar();
                    this.updateToolbar(); // Update the count display
                } else {
                    this.hideToolbar();
                }
                this.updateSceneCardStyles();
            });
        }

        observeSceneCards() {
            // Use MutationObserver to detect new scene cards
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            this.processSceneCards(node);
                        }
                    });
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Process existing scene cards
            this.processSceneCards(document.body);
        }

        processSceneCards(container) {
            // Skip if we're inside a bulk dialog
            if (container.closest && container.closest('#bulk-dialog')) return;

            // Look for scene cards in various possible selectors
            const sceneCardSelectors = [
                '.scene-card',
                '[data-rb-event-key*="scene"]',
                '.grid-card',
                '.SceneCard',
                'div[class*="scene"]'
            ];

            sceneCardSelectors.forEach(selector => {
                const cards = container.querySelectorAll(selector);
                cards.forEach(card => {
                    // Skip if card is inside a bulk dialog
                    if (!card.closest('#bulk-dialog')) {
                        this.addCheckboxToCard(card);
                    }
                });
            });
        }

        addCheckboxToCard(card) {
            // Skip if already has checkbox
            if (card.querySelector('.bulk-select-checkbox')) return;

            // Try to find scene ID from various attributes
            let sceneId = card.getAttribute('data-scene-id');
            if (!sceneId) {
                const link = card.querySelector('a[href*="/scenes/"]');
                if (link) {
                    const match = link.href.match(/\/scenes\/(\d+)/);
                    if (match) sceneId = match[1];
                }
            }

            if (!sceneId) return;

            // Add data attribute for easy lookup
            card.setAttribute('data-scene-id', sceneId);
            card.classList.add('scene-card-container');

            // Create checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'bulk-select-checkbox';
            checkbox.checked = this.selectionManager.isSelected(sceneId);

            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();

                // Immediately update checkbox state for responsiveness
                const isNowSelected = this.selectionManager.toggleScene(sceneId);
                checkbox.checked = isNowSelected;

                // Update card style immediately
                if (isNowSelected) {
                    card.classList.add('bulk-selected');
                } else {
                    card.classList.remove('bulk-selected');
                }

                // Batch update other cards after a short delay
                if (this.updateTimer) clearTimeout(this.updateTimer);
                this.updateTimer = setTimeout(() => {
                    this.updateSceneCardStyles();
                }, 100);
            });

            card.appendChild(checkbox);
        }

        updateSceneCardStyles() {
            document.querySelectorAll('[data-scene-id]').forEach(card => {
                const sceneId = card.getAttribute('data-scene-id');
                const checkbox = card.querySelector('.bulk-select-checkbox');

                if (this.selectionManager.isSelected(sceneId)) {
                    card.classList.add('bulk-selected');
                    if (checkbox) checkbox.checked = true;
                } else {
                    card.classList.remove('bulk-selected');
                    if (checkbox) checkbox.checked = false;
                }
            });
        }

        showToolbar() {
            if (this.toolbar) return;

            this.toolbar = document.createElement('div');
            this.toolbar.className = 'bulk-operations-toolbar';

            this.updateToolbar();
            document.body.appendChild(this.toolbar);
        }

        updateToolbar() {
            if (!this.toolbar) return;

            const count = this.selectionManager.getSelectedCount();

            this.toolbar.innerHTML = `
                <span style="font-weight: 600;">${count} scenes selected</span>
                <button class="select-all-button">Select All</button>
                <button class="clear-button">Clear</button>
                ${getConfig(CONFIG.ENABLE_BULK_TAGS) ? '<button class="bulk-tags-button">Bulk Tags</button>' : ''}
                ${getConfig(CONFIG.ENABLE_BULK_PERFORMERS) ? '<button class="bulk-performers-button">Bulk Performers</button>' : ''}
                ${getConfig(CONFIG.ENABLE_BULK_STUDIOS) ? '<button class="bulk-studios-button">Bulk Studios</button>' : ''}
                ${getConfig(CONFIG.ENABLE_BULK_METADATA) ? '<button class="bulk-metadata-button">Bulk Metadata</button>' : ''}
            `;

            // Add event listeners to toolbar buttons
            const selectAllBtn = this.toolbar.querySelector('.select-all-button');
            if (selectAllBtn) selectAllBtn.addEventListener('click', () => this.selectAll());

            const clearBtn = this.toolbar.querySelector('.clear-button');
            if (clearBtn) clearBtn.addEventListener('click', () => this.clearSelection());

            const tagsBtn = this.toolbar.querySelector('.bulk-tags-button');
            if (tagsBtn) tagsBtn.addEventListener('click', () => this.showBulkTagsDialog());

            const performersBtn = this.toolbar.querySelector('.bulk-performers-button');
            if (performersBtn) performersBtn.addEventListener('click', () => this.showBulkPerformersDialog());

            const studiosBtn = this.toolbar.querySelector('.bulk-studios-button');
            if (studiosBtn) studiosBtn.addEventListener('click', () => this.showBulkStudiosDialog());

            const metadataBtn = this.toolbar.querySelector('.bulk-metadata-button');
            if (metadataBtn) metadataBtn.addEventListener('click', () => this.showBulkMetadataDialog());
        }

        hideToolbar() {
            if (this.toolbar) {
                this.toolbar.remove();
                this.toolbar = null;
            }
        }

        selectAll() {
            this.selectionManager.selectAll();
        }

        clearSelection() {
            this.selectionManager.clearSelection();
        }

        async showBulkTagsDialog() {
            const selectedScenes = this.selectionManager.getSelectedScenes();
            if (selectedScenes.length === 0) return;

            // Create dialog
            const dialog = this.createDialog('Bulk Tag Management');
            const content = dialog.querySelector('.dialog-content');

            content.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <p style="margin-bottom: 10px;">Managing tags for ${selectedScenes.length} selected scenes</p>
                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <button class="mode-add-tags" style="
                            flex: 1;
                            padding: 10px;
                            border: 2px solid #27ae60;
                            border-radius: 5px;
                            background: #27ae60;
                            color: white;
                            cursor: pointer;
                            font-weight: bold;
                        ">➕ Add Tags</button>
                        <button class="mode-remove-tags" style="
                            flex: 1;
                            padding: 10px;
                            border: 2px solid #555;
                            border-radius: 5px;
                            background: transparent;
                            color: #e0e0e0;
                            cursor: pointer;
                        ">➖ Remove Tags</button>
                        <button class="mode-clear-tags" style="
                            flex: 1;
                            padding: 10px;
                            border: 2px solid #555;
                            border-radius: 5px;
                            background: transparent;
                            color: #e0e0e0;
                            cursor: pointer;
                        ">🗑️ Clear All Tags</button>
                    </div>
                    <input type="text" id="tag-search" placeholder="Search tags..." style="
                        width: 100%;
                        padding: 8px;
                        border: 1px solid #555;
                        border-radius: 4px;
                        margin-bottom: 10px;
                        background: #1a1a1a;
                        color: white;
                    ">
                    <div id="tag-suggestions" style="
                        max-height: 300px;
                        overflow-y: auto;
                        border: 1px solid #555;
                        border-radius: 4px;
                        background: #1a1a1a;
                        color: white;
                    "></div>
                </div>
                <div>
                    <h4 style="margin-bottom: 10px;">Selected Tags: <span id="operation-mode" style="color: #27ae60; font-size: 14px;">(Adding)</span></h4>
                    <div id="selected-tags" style="
                        min-height: 50px;
                        border: 1px solid #555;
                        border-radius: 4px;
                        padding: 10px;
                        background: rgba(0,0,0,0.3);
                    "></div>
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="cancel-button" style="
                        padding: 10px 20px;
                        border: none;
                        border-radius: 5px;
                        background: #95a5a6;
                        color: white;
                        cursor: pointer;
                    ">Cancel</button>
                    <button id="apply-tags" style="
                        padding: 10px 20px;
                        border: none;
                        border-radius: 5px;
                        background: #27ae60;
                        color: white;
                        cursor: pointer;
                    ">Add Tags</button>
                </div>
            `;

            const selectedTags = new Map();
            let currentMode = 'add'; // 'add', 'remove', or 'clear'
            let loadedScenes = []; // Store loaded scenes for View Details functionality
            const searchInput = dialog.querySelector('#tag-search');
            const suggestionsDiv = dialog.querySelector('#tag-suggestions');
            const selectedTagsDiv = dialog.querySelector('#selected-tags');
            const applyButton = dialog.querySelector('#apply-tags');
            const operationModeSpan = dialog.querySelector('#operation-mode');

            // Mode buttons
            const addModeBtn = dialog.querySelector('.mode-add-tags');
            const removeModeBtn = dialog.querySelector('.mode-remove-tags');
            const clearModeBtn = dialog.querySelector('.mode-clear-tags');

            // Mode switching functions
            const setMode = (mode) => {
                currentMode = mode;
                selectedTags.clear();
                updateSelectedTags();

                // Update button styles
                addModeBtn.style.background = mode === 'add' ? '#27ae60' : 'transparent';
                addModeBtn.style.color = mode === 'add' ? 'white' : '#e0e0e0';
                addModeBtn.style.fontWeight = mode === 'add' ? 'bold' : 'normal';

                removeModeBtn.style.background = mode === 'remove' ? '#e74c3c' : 'transparent';
                removeModeBtn.style.color = mode === 'remove' ? 'white' : '#e0e0e0';
                removeModeBtn.style.fontWeight = mode === 'remove' ? 'bold' : 'normal';
                removeModeBtn.style.borderColor = mode === 'remove' ? '#e74c3c' : '#555';

                clearModeBtn.style.background = mode === 'clear' ? '#e67e22' : 'transparent';
                clearModeBtn.style.color = mode === 'clear' ? 'white' : '#e0e0e0';
                clearModeBtn.style.fontWeight = mode === 'clear' ? 'bold' : 'normal';
                clearModeBtn.style.borderColor = mode === 'clear' ? '#e67e22' : '#555';

                // Update mode indicator and button text
                if (mode === 'add') {
                    operationModeSpan.textContent = '(Adding)';
                    operationModeSpan.style.color = '#27ae60';
                    applyButton.textContent = 'Add Tags';
                    applyButton.style.background = '#27ae60';
                    searchInput.style.display = 'block';
                    suggestionsDiv.style.display = 'block';
                    searchInput.placeholder = 'Search tags to add...';
                    loadTags();
                } else if (mode === 'remove') {
                    operationModeSpan.textContent = '(Removing)';
                    operationModeSpan.style.color = '#e74c3c';
                    applyButton.textContent = 'Remove Tags';
                    applyButton.style.background = '#e74c3c';
                    searchInput.style.display = 'block';
                    suggestionsDiv.style.display = 'block';
                    searchInput.placeholder = 'Search tags or select from existing...';
                    loadExistingTags();
                } else if (mode === 'clear') {
                    operationModeSpan.textContent = '(Clearing All)';
                    operationModeSpan.style.color = '#e67e22';
                    applyButton.textContent = 'Clear All Tags';
                    applyButton.style.background = '#e67e22';
                    searchInput.style.display = 'none';
                    suggestionsDiv.style.display = 'none';
                    selectedTagsDiv.innerHTML = '<p style="color: #e67e22; text-align: center;">⚠️ This will remove ALL tags from selected scenes!</p>';
                }
            };

            // Mode button handlers
            addModeBtn.addEventListener('click', () => setMode('add'));
            removeModeBtn.addEventListener('click', () => setMode('remove'));
            clearModeBtn.addEventListener('click', () => setMode('clear'));

            // Add cancel button handler
            dialog.querySelector('.cancel-button').addEventListener('click', () => {
                dialog.remove();
            });

            // Load existing tags from selected scenes
            const loadExistingTags = async () => {
                if (currentMode !== 'remove') return;

                try {
                    console.log('Loading tags for scenes:', selectedScenes);
                    loadedScenes = await this.bulkOperations.graphql.getSceneDetails(selectedScenes);
                    console.log('Loaded scene details:', loadedScenes);
                    const tagMap = new Map();

                    if (!loadedScenes || loadedScenes.length === 0) {
                        suggestionsDiv.innerHTML = '<p style="color: #999; padding: 20px; text-align: center;">No scene data found</p>';
                        return;
                    }

                    // Collect all unique tags
                    loadedScenes.forEach(scene => {
                        if (scene.tags && Array.isArray(scene.tags)) {
                            scene.tags.forEach(tag => {
                                if (!tagMap.has(tag.id)) {
                                    tagMap.set(tag.id, {
                                        id: tag.id,
                                        name: tag.name,
                                        sceneCount: 1
                                    });
                                } else {
                                    tagMap.get(tag.id).sceneCount++;
                                }
                            });
                        }
                    });

                    // Display existing tags
                    const existingTags = Array.from(tagMap.values());
                    if (existingTags.length > 0) {
                        suggestionsDiv.innerHTML = `
                            <div style="padding: 10px; background: #2a2a2a; border-bottom: 2px solid #555;">
                                <strong>Tags in selected scenes:</strong>
                            </div>
                            ${existingTags.map(tag => `
                                <div class="tag-item" data-tag-id="${tag.id}" data-tag-name="${tag.name}" style="
                                    padding: 10px;
                                    cursor: pointer;
                                    border-bottom: 1px solid #333;
                                    transition: background 0.2s ease;
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                ">
                                    <div>
                                        <span>${tag.name}</span>
                                        <span style="color: #999; font-size: 12px;"> (in ${tag.sceneCount} of ${selectedScenes.length} scenes)</span>
                                    </div>
                                    <button class="view-details-btn" data-tag-id="${tag.id}" data-tag-name="${tag.name}" style="
                                        background: #3498db;
                                        color: white;
                                        border: none;
                                        padding: 4px 12px;
                                        border-radius: 3px;
                                        font-size: 12px;
                                        cursor: pointer;
                                    ">View Details</button>
                                </div>
                            `).join('')}
                        `;
                    } else {
                        suggestionsDiv.innerHTML = '<p style="color: #999; padding: 20px; text-align: center;">No tags found in selected scenes</p>';
                    }

                    // Add click handlers
                    suggestionsDiv.querySelectorAll('.tag-item').forEach(item => {
                        item.addEventListener('click', (e) => {
                            // Don't trigger if clicking the View Details button
                            if (e.target.classList.contains('view-details-btn')) {
                                return;
                            }

                            const tagId = item.getAttribute('data-tag-id');
                            const tagName = item.getAttribute('data-tag-name');

                            if (!selectedTags.has(tagId)) {
                                selectedTags.set(tagId, tagName);
                                updateSelectedTags();
                            }
                        });

                        item.addEventListener('mouseenter', () => {
                            item.style.background = '#333';
                        });

                        item.addEventListener('mouseleave', () => {
                            item.style.background = '#1a1a1a';
                        });
                    });

                    // Add View Details button handlers
                    suggestionsDiv.querySelectorAll('.view-details-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            const tagId = btn.getAttribute('data-tag-id');
                            const tagName = btn.getAttribute('data-tag-name');

                            // Find which scenes have this tag
                            const scenesWithTag = loadedScenes.filter(scene =>
                                scene.tags && scene.tags.some(tag => tag.id === tagId)
                            );

                            this.showSceneDetailsForItem(tagName, scenesWithTag, 'tag', tagId, () => {
                                // Reopen the tag dialog when back is clicked
                                this.showBulkTagsDialog();
                            });
                        });
                    });
                } catch (error) {
                    console.error('Error loading existing tags:', error);
                    suggestionsDiv.innerHTML = '<p style="color: red; padding: 10px;">Error loading existing tags</p>';
                }
            };

            // Load and display tags
            const loadTags = async (searchTerm = '') => {
                try {
                    const tags = await this.bulkOperations.graphql.searchTags(searchTerm);
                    suggestionsDiv.innerHTML = tags.map(tag => `
                        <div class="tag-item" data-tag-id="${tag.id}" data-tag-name="${tag.name}" style="
                            padding: 10px;
                            cursor: pointer;
                            border-bottom: 1px solid #333;
                            transition: background 0.2s ease;
                        ">
                            <span>${tag.name}</span>
                            <span style="color: #999; font-size: 12px;"> (${tag.scene_count} scenes)</span>
                        </div>
                    `).join('');

                    // Add click handlers
                    suggestionsDiv.querySelectorAll('.tag-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const tagId = item.getAttribute('data-tag-id');
                            const tagName = item.getAttribute('data-tag-name');

                            if (!selectedTags.has(tagId)) {
                                selectedTags.set(tagId, tagName);
                                updateSelectedTags();
                            }
                        });

                        item.addEventListener('mouseenter', () => {
                            item.style.background = '#333';
                        });

                        item.addEventListener('mouseleave', () => {
                            item.style.background = '#1a1a1a';
                        });
                    });
                } catch (error) {
                    suggestionsDiv.innerHTML = '<p style="color: red; padding: 10px;">Error loading tags</p>';
                }
            };

            const updateSelectedTags = () => {
                if (currentMode === 'clear') {
                    selectedTagsDiv.innerHTML = '<p style="color: #e67e22; text-align: center;">⚠️ This will remove ALL tags from selected scenes!</p>';
                    return;
                }

                const bgColor = currentMode === 'add' ? '#3498db' : '#e74c3c';
                selectedTagsDiv.innerHTML = Array.from(selectedTags.entries()).map(([id, name]) => `
                    <span style="
                        display: inline-block;
                        background: ${bgColor};
                        color: white;
                        padding: 5px 10px;
                        border-radius: 15px;
                        margin: 5px;
                        cursor: pointer;
                    " data-tag-id="${id}">
                        ${name} ×
                    </span>
                `).join('');

                if (selectedTags.size === 0 && currentMode !== 'clear') {
                    selectedTagsDiv.innerHTML = `<p style="color: #999; text-align: center;">No tags selected for ${currentMode === 'add' ? 'adding' : 'removing'}</p>`;
                }

                // Add click handlers to remove tags
                selectedTagsDiv.querySelectorAll('span[data-tag-id]').forEach(span => {
                    span.addEventListener('click', () => {
                        const tagId = span.getAttribute('data-tag-id');
                        selectedTags.delete(tagId);
                        updateSelectedTags();
                    });
                });
            };

            // Search input handler
            let searchTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    if (currentMode === 'remove' && e.target.value === '') {
                        loadExistingTags();
                    } else {
                        loadTags(e.target.value);
                    }
                }, 300);
            });

            // Apply button handler
            applyButton.addEventListener('click', async () => {
                if (currentMode !== 'clear' && selectedTags.size === 0) return;

                // Confirm clear operation
                if (currentMode === 'clear') {
                    if (!confirm(`Are you sure you want to remove ALL tags from ${selectedScenes.length} scenes? This cannot be undone.`)) {
                        return;
                    }
                }

                dialog.remove();

                const tagIds = Array.from(selectedTags.keys());
                const progress = new ProgressTracker(selectedScenes.length);

                try {
                    if (currentMode === 'add') {
                        await this.bulkOperations.bulkUpdateTags(selectedScenes, tagIds, []);
                    } else if (currentMode === 'remove') {
                        await this.bulkOperations.bulkUpdateTags(selectedScenes, [], tagIds);
                    } else if (currentMode === 'clear') {
                        // Clear all tags by setting an empty array
                        const mutation = `
                            mutation BulkClearSceneTags($ids: [ID!]!) {
                                bulkSceneUpdate(input: {
                                    ids: $ids
                                    tag_ids: { ids: [], mode: SET }
                                }) {
                                    id
                                }
                            }
                        `;
                        await this.bulkOperations.graphql.query(mutation, { ids: selectedScenes });
                    }

                    progress.updateProgress(selectedScenes.length);
                    progress.showSummary();

                    // Keep selection active for potential follow-up operations
                    // this.selectionManager.clearSelection(); // Commented out to preserve selection
                } catch (error) {
                    progress.updateProgress(0, error);
                    progress.showSummary();
                }
            });

            // Initial load
            loadTags();
            updateSelectedTags();
        }

        async showBulkPerformersDialog() {
            const selectedScenes = this.selectionManager.getSelectedScenes();
            if (selectedScenes.length === 0) return;

            // Create dialog
            const dialog = this.createDialog('Bulk Performer Management');
            const content = dialog.querySelector('.dialog-content');

            content.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <p style="margin-bottom: 10px;">Managing performers for ${selectedScenes.length} selected scenes</p>
                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <button class="mode-add-performers" style="
                            flex: 1;
                            padding: 10px;
                            border: 2px solid #27ae60;
                            border-radius: 5px;
                            background: #27ae60;
                            color: white;
                            cursor: pointer;
                            font-weight: bold;
                        ">➕ Add Performers</button>
                        <button class="mode-remove-performers" style="
                            flex: 1;
                            padding: 10px;
                            border: 2px solid #555;
                            border-radius: 5px;
                            background: transparent;
                            color: #e0e0e0;
                            cursor: pointer;
                        ">➖ Remove Performers</button>
                        <button class="mode-clear-performers" style="
                            flex: 1;
                            padding: 10px;
                            border: 2px solid #555;
                            border-radius: 5px;
                            background: transparent;
                            color: #e0e0e0;
                            cursor: pointer;
                        ">🗑️ Clear All Performers</button>
                    </div>
                    <input type="text" id="performer-search" placeholder="Search performers..." style="
                        width: 100%;
                        padding: 8px;
                        border: 1px solid #555;
                        border-radius: 4px;
                        margin-bottom: 10px;
                        background: #1a1a1a;
                        color: white;
                    ">
                    <div id="performer-suggestions" style="
                        max-height: 300px;
                        overflow-y: auto;
                        border: 1px solid #555;
                        border-radius: 4px;
                        background: #1a1a1a;
                        color: white;
                    "></div>
                </div>
                <div>
                    <h4 style="margin-bottom: 10px;">Selected Performers: <span id="operation-mode" style="color: #27ae60; font-size: 14px;">(Adding)</span></h4>
                    <div id="selected-performers" style="
                        min-height: 50px;
                        border: 1px solid #555;
                        border-radius: 4px;
                        padding: 10px;
                        background: rgba(0,0,0,0.3);
                    "></div>
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="cancel-button" style="
                        padding: 10px 20px;
                        border: none;
                        border-radius: 5px;
                        background: #95a5a6;
                        color: white;
                        cursor: pointer;
                    ">Cancel</button>
                    <button id="apply-performers" style="
                        padding: 10px 20px;
                        border: none;
                        border-radius: 5px;
                        background: #27ae60;
                        color: white;
                        cursor: pointer;
                    ">Add Performers</button>
                </div>
            `;

            const selectedPerformers = new Map();
            let currentMode = 'add'; // 'add', 'remove', or 'clear'
            let loadedScenes = []; // Store loaded scenes for View Details functionality
            const searchInput = dialog.querySelector('#performer-search');
            const suggestionsDiv = dialog.querySelector('#performer-suggestions');
            const selectedPerformersDiv = dialog.querySelector('#selected-performers');
            const applyButton = dialog.querySelector('#apply-performers');
            const operationModeSpan = dialog.querySelector('#operation-mode');

            // Mode buttons
            const addModeBtn = dialog.querySelector('.mode-add-performers');
            const removeModeBtn = dialog.querySelector('.mode-remove-performers');
            const clearModeBtn = dialog.querySelector('.mode-clear-performers');

            // Mode switching functions
            const setMode = (mode) => {
                currentMode = mode;
                selectedPerformers.clear();
                updateSelectedPerformers();

                // Update button styles
                addModeBtn.style.background = mode === 'add' ? '#27ae60' : 'transparent';
                addModeBtn.style.color = mode === 'add' ? 'white' : '#e0e0e0';
                addModeBtn.style.fontWeight = mode === 'add' ? 'bold' : 'normal';

                removeModeBtn.style.background = mode === 'remove' ? '#e74c3c' : 'transparent';
                removeModeBtn.style.color = mode === 'remove' ? 'white' : '#e0e0e0';
                removeModeBtn.style.fontWeight = mode === 'remove' ? 'bold' : 'normal';
                removeModeBtn.style.borderColor = mode === 'remove' ? '#e74c3c' : '#555';

                clearModeBtn.style.background = mode === 'clear' ? '#e67e22' : 'transparent';
                clearModeBtn.style.color = mode === 'clear' ? 'white' : '#e0e0e0';
                clearModeBtn.style.fontWeight = mode === 'clear' ? 'bold' : 'normal';
                clearModeBtn.style.borderColor = mode === 'clear' ? '#e67e22' : '#555';

                // Update mode indicator and button text
                if (mode === 'add') {
                    operationModeSpan.textContent = '(Adding)';
                    operationModeSpan.style.color = '#27ae60';
                    applyButton.textContent = 'Add Performers';
                    applyButton.style.background = '#27ae60';
                    searchInput.style.display = 'block';
                    suggestionsDiv.style.display = 'block';
                    searchInput.placeholder = 'Search performers to add...';
                    loadPerformers();
                } else if (mode === 'remove') {
                    operationModeSpan.textContent = '(Removing)';
                    operationModeSpan.style.color = '#e74c3c';
                    applyButton.textContent = 'Remove Performers';
                    applyButton.style.background = '#e74c3c';
                    searchInput.style.display = 'block';
                    suggestionsDiv.style.display = 'block';
                    searchInput.placeholder = 'Search performers or select from existing...';
                    loadExistingPerformers();
                } else if (mode === 'clear') {
                    operationModeSpan.textContent = '(Clearing All)';
                    operationModeSpan.style.color = '#e67e22';
                    applyButton.textContent = 'Clear All Performers';
                    applyButton.style.background = '#e67e22';
                    searchInput.style.display = 'none';
                    suggestionsDiv.style.display = 'none';
                    selectedPerformersDiv.innerHTML = '<p style="color: #e67e22; text-align: center;">⚠️ This will remove ALL performers from selected scenes!</p>';
                }
            };

            // Mode button handlers
            addModeBtn.addEventListener('click', () => setMode('add'));
            removeModeBtn.addEventListener('click', () => setMode('remove'));
            clearModeBtn.addEventListener('click', () => setMode('clear'));

            // Add cancel button handler
            dialog.querySelector('.cancel-button').addEventListener('click', () => {
                dialog.remove();
            });

            // Load existing performers from selected scenes
            const loadExistingPerformers = async () => {
                if (currentMode !== 'remove') return;

                try {
                    console.log('Loading performers for scenes:', selectedScenes);
                    loadedScenes = await this.bulkOperations.graphql.getSceneDetails(selectedScenes);
                    console.log('Loaded scene details:', loadedScenes);
                    const performerMap = new Map();

                    if (!loadedScenes || loadedScenes.length === 0) {
                        suggestionsDiv.innerHTML = '<p style="color: #999; padding: 20px; text-align: center;">No scene data found</p>';
                        return;
                    }

                    // Collect all unique performers
                    loadedScenes.forEach(scene => {
                        if (scene.performers && Array.isArray(scene.performers)) {
                            scene.performers.forEach(performer => {
                                if (!performerMap.has(performer.id)) {
                                    performerMap.set(performer.id, {
                                        id: performer.id,
                                        name: performer.name,
                                        sceneCount: 1
                                    });
                                } else {
                                    performerMap.get(performer.id).sceneCount++;
                                }
                            });
                        }
                    });

                    // Display existing performers
                    const existingPerformers = Array.from(performerMap.values());
                    if (existingPerformers.length > 0) {
                        suggestionsDiv.innerHTML = `
                            <div style="padding: 10px; background: #2a2a2a; border-bottom: 2px solid #555;">
                                <strong>Performers in selected scenes:</strong>
                            </div>
                            ${existingPerformers.map(performer => `
                                <div class="performer-item" data-performer-id="${performer.id}" data-performer-name="${performer.name}" style="
                                    padding: 10px;
                                    cursor: pointer;
                                    border-bottom: 1px solid #333;
                                    transition: background 0.2s ease;
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                ">
                                    <div>
                                        <span>${performer.name}</span>
                                        <span style="color: #999; font-size: 12px;"> (in ${performer.sceneCount} of ${selectedScenes.length} scenes)</span>
                                    </div>
                                    <button class="view-details-btn" data-performer-id="${performer.id}" data-performer-name="${performer.name}" style="
                                        background: #3498db;
                                        color: white;
                                        border: none;
                                        padding: 4px 12px;
                                        border-radius: 3px;
                                        font-size: 12px;
                                        cursor: pointer;
                                    ">View Details</button>
                                </div>
                            `).join('')}
                        `;
                    } else {
                        suggestionsDiv.innerHTML = '<p style="color: #999; padding: 20px; text-align: center;">No performers found in selected scenes</p>';
                    }

                    // Add click handlers
                    suggestionsDiv.querySelectorAll('.performer-item').forEach(item => {
                        item.addEventListener('click', (e) => {
                            // Don't trigger if clicking the View Details button
                            if (e.target.classList.contains('view-details-btn')) {
                                return;
                            }

                            const performerId = item.getAttribute('data-performer-id');
                            const performerName = item.getAttribute('data-performer-name');

                            if (!selectedPerformers.has(performerId)) {
                                selectedPerformers.set(performerId, performerName);
                                updateSelectedPerformers();
                            }
                        });

                        item.addEventListener('mouseenter', () => {
                            item.style.background = '#333';
                        });

                        item.addEventListener('mouseleave', () => {
                            item.style.background = '#1a1a1a';
                        });
                    });

                    // Add View Details button handlers
                    suggestionsDiv.querySelectorAll('.view-details-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            const performerId = btn.getAttribute('data-performer-id');
                            const performerName = btn.getAttribute('data-performer-name');

                            // Find which scenes have this performer
                            const scenesWithPerformer = loadedScenes.filter(scene =>
                                scene.performers && scene.performers.some(performer => performer.id === performerId)
                            );

                            this.showSceneDetailsForItem(performerName, scenesWithPerformer, 'performer', performerId, () => {
                                // Reopen the performer dialog when back is clicked
                                this.showBulkPerformersDialog();
                            });
                        });
                    });
                } catch (error) {
                    console.error('Error loading existing performers:', error);
                    suggestionsDiv.innerHTML = '<p style="color: red; padding: 10px;">Error loading existing performers</p>';
                }
            };

            // Load and display performers
            const loadPerformers = async (searchTerm = '') => {
                try {
                    const performers = await this.bulkOperations.graphql.searchPerformers(searchTerm);
                    suggestionsDiv.innerHTML = performers.map(performer => `
                        <div class="performer-item" data-performer-id="${performer.id}" data-performer-name="${performer.name}" style="
                            padding: 10px;
                            cursor: pointer;
                            border-bottom: 1px solid #333;
                            transition: background 0.2s ease;
                        ">
                            <span>${performer.name}</span>
                            <span style="color: #666; font-size: 12px;"> (${performer.scene_count} scenes)</span>
                        </div>
                    `).join('');

                    // Add click handlers
                    suggestionsDiv.querySelectorAll('.performer-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const performerId = item.getAttribute('data-performer-id');
                            const performerName = item.getAttribute('data-performer-name');

                            if (!selectedPerformers.has(performerId)) {
                                selectedPerformers.set(performerId, performerName);
                                updateSelectedPerformers();
                            }
                        });

                        item.addEventListener('mouseenter', () => {
                            item.style.background = '#333';
                        });

                        item.addEventListener('mouseleave', () => {
                            item.style.background = '#1a1a1a';
                        });
                    });
                } catch (error) {
                    suggestionsDiv.innerHTML = '<p style="color: red; padding: 10px;">Error loading performers</p>';
                }
            };

            const updateSelectedPerformers = () => {
                if (currentMode === 'clear') {
                    selectedPerformersDiv.innerHTML = '<p style="color: #e67e22; text-align: center;">⚠️ This will remove ALL performers from selected scenes!</p>';
                    return;
                }

                const bgColor = currentMode === 'add' ? '#e74c3c' : '#e74c3c';
                selectedPerformersDiv.innerHTML = Array.from(selectedPerformers.entries()).map(([id, name]) => `
                    <span style="
                        display: inline-block;
                        background: ${bgColor};
                        color: white;
                        padding: 5px 10px;
                        border-radius: 15px;
                        margin: 5px;
                        cursor: pointer;
                    " data-performer-id="${id}">
                        ${name} ×
                    </span>
                `).join('');

                if (selectedPerformers.size === 0 && currentMode !== 'clear') {
                    selectedPerformersDiv.innerHTML = `<p style="color: #999; text-align: center;">No performers selected for ${currentMode === 'add' ? 'adding' : 'removing'}</p>`;
                }

                // Add click handlers to remove performers
                selectedPerformersDiv.querySelectorAll('span[data-performer-id]').forEach(span => {
                    span.addEventListener('click', () => {
                        const performerId = span.getAttribute('data-performer-id');
                        selectedPerformers.delete(performerId);
                        updateSelectedPerformers();
                    });
                });
            };

            // Search input handler
            let searchTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    if (currentMode === 'remove' && e.target.value === '') {
                        loadExistingPerformers();
                    } else {
                        loadPerformers(e.target.value);
                    }
                }, 300);
            });

            // Apply button handler
            applyButton.addEventListener('click', async () => {
                if (currentMode !== 'clear' && selectedPerformers.size === 0) return;

                // Confirm clear operation
                if (currentMode === 'clear') {
                    if (!confirm(`Are you sure you want to remove ALL performers from ${selectedScenes.length} scenes? This cannot be undone.`)) {
                        return;
                    }
                }

                dialog.remove();

                const performerIds = Array.from(selectedPerformers.keys());
                const progress = new ProgressTracker(selectedScenes.length);

                try {
                    if (currentMode === 'add') {
                        await this.bulkOperations.bulkUpdatePerformers(selectedScenes, performerIds, []);
                    } else if (currentMode === 'remove') {
                        await this.bulkOperations.bulkUpdatePerformers(selectedScenes, [], performerIds);
                    } else if (currentMode === 'clear') {
                        // Clear all performers by setting an empty array
                        const mutation = `
                            mutation BulkClearScenePerformers($ids: [ID!]!) {
                                bulkSceneUpdate(input: {
                                    ids: $ids
                                    performer_ids: { ids: [], mode: SET }
                                }) {
                                    id
                                }
                            }
                        `;
                        await this.bulkOperations.graphql.query(mutation, { ids: selectedScenes });
                    }

                    progress.updateProgress(selectedScenes.length);
                    progress.showSummary();

                    // Keep selection active for potential follow-up operations
                    // this.selectionManager.clearSelection(); // Commented out to preserve selection
                } catch (error) {
                    progress.updateProgress(0, error);
                    progress.showSummary();
                }
            });

            // Initial load
            loadPerformers();
            updateSelectedPerformers();
        }

        async showBulkStudiosDialog() {
            const selectedScenes = this.selectionManager.getSelectedScenes();
            if (selectedScenes.length === 0) return;

            // Create dialog
            const dialog = this.createDialog('Bulk Studio Assignment');
            const content = dialog.querySelector('.dialog-content');

            content.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <p style="margin-bottom: 10px;">Managing studio for ${selectedScenes.length} selected scenes</p>
                    <div id="existing-studios" style="
                        margin-bottom: 15px;
                        padding: 15px;
                        background: #2a2a2a;
                        border-radius: 5px;
                        border: 1px solid #555;
                    ">
                        <strong style="display: block; margin-bottom: 10px;">Current Studios in Selected Scenes:</strong>
                        <div id="existing-studios-list" style="color: #999;">Loading...</div>
                    </div>
                    <input type="text" id="studio-search" placeholder="Search studios to assign..." style="
                        width: 100%;
                        padding: 8px;
                        border: 1px solid #555;
                        border-radius: 4px;
                        margin-bottom: 10px;
                        background: #1a1a1a;
                        color: white;
                    ">
                    <div id="studio-suggestions" style="
                        max-height: 300px;
                        overflow-y: auto;
                        border: 1px solid #555;
                        border-radius: 4px;
                        background: #1a1a1a;
                        color: white;
                    "></div>
                </div>
                <div>
                    <h4 style="margin-bottom: 10px;">Selected Studio:</h4>
                    <div id="selected-studio" style="
                        min-height: 50px;
                        border: 1px solid #555;
                        border-radius: 4px;
                        padding: 10px;
                        background: rgba(0,0,0,0.3);
                    ">
                        <p style="color: #999;">No studio selected</p>
                    </div>
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="cancel-button" style="
                        padding: 10px 20px;
                        border: none;
                        border-radius: 5px;
                        background: #95a5a6;
                        color: white;
                        cursor: pointer;
                    ">Cancel</button>
                    <button id="remove-studio" style="
                        padding: 10px 20px;
                        border: none;
                        border-radius: 5px;
                        background: #e74c3c;
                        color: white;
                        cursor: pointer;
                    ">Remove Studio</button>
                    <button id="apply-studio" style="
                        padding: 10px 20px;
                        border: none;
                        border-radius: 5px;
                        background: #27ae60;
                        color: white;
                        cursor: pointer;
                        opacity: 0.5;
                    " disabled>Apply Studio</button>
                </div>
            `;

            let selectedStudio = null;
            let studioToRemove = null;
            let loadedScenes = []; // Store loaded scenes for View Details functionality
            const searchInput = dialog.querySelector('#studio-search');
            const suggestionsDiv = dialog.querySelector('#studio-suggestions');
            const selectedStudioDiv = dialog.querySelector('#selected-studio');
            const existingStudiosDiv = dialog.querySelector('#existing-studios-list');
            const applyButton = dialog.querySelector('#apply-studio');
            const removeButton = dialog.querySelector('#remove-studio');

            // Add cancel button handler
            dialog.querySelector('.cancel-button').addEventListener('click', () => {
                dialog.remove();
            });

            // Load existing studios from selected scenes
            const loadExistingStudios = async () => {
                try {
                    loadedScenes = await this.bulkOperations.graphql.getSceneDetails(selectedScenes);
                    const studioMap = new Map();
                    let noStudioCount = 0;

                    // Collect all unique studios
                    loadedScenes.forEach(scene => {
                        if (scene.studio) {
                            if (!studioMap.has(scene.studio.id)) {
                                studioMap.set(scene.studio.id, {
                                    id: scene.studio.id,
                                    name: scene.studio.name,
                                    sceneCount: 1
                                });
                            } else {
                                studioMap.get(scene.studio.id).sceneCount++;
                            }
                        } else {
                            noStudioCount++;
                        }
                    });

                    // Display existing studios
                    const existingStudios = Array.from(studioMap.values());
                    if (existingStudios.length > 0 || noStudioCount > 0) {
                        let html = '';

                        if (existingStudios.length > 0) {
                            html += existingStudios.map(studio => `
                                <div style="
                                    display: inline-flex;
                                    align-items: center;
                                    background: #9b59b6;
                                    color: white;
                                    padding: 5px 10px;
                                    border-radius: 5px;
                                    margin: 5px;
                                    cursor: pointer;
                                    position: relative;
                                " class="existing-studio-item" data-studio-id="${studio.id}" data-studio-name="${studio.name}">
                                    ${studio.name} (${studio.sceneCount} scenes)
                                    <button class="view-details-btn" data-studio-id="${studio.id}" data-studio-name="${studio.name}" style="
                                        background: #3498db;
                                        color: white;
                                        border: none;
                                        padding: 2px 8px;
                                        border-radius: 3px;
                                        font-size: 11px;
                                        cursor: pointer;
                                        margin-left: 10px;
                                    ">View Details</button>
                                </div>
                            `).join('');
                        }

                        if (noStudioCount > 0) {
                            html += `
                                <div style="
                                    display: inline-block;
                                    background: #555;
                                    color: #e0e0e0;
                                    padding: 5px 10px;
                                    border-radius: 5px;
                                    margin: 5px;
                                ">
                                    No Studio (${noStudioCount} scenes)
                                </div>
                            `;
                        }

                        existingStudiosDiv.innerHTML = html;

                        // Add click handlers for existing studios
                        existingStudiosDiv.querySelectorAll('.existing-studio-item').forEach(item => {
                            item.addEventListener('click', (e) => {
                                // Don't trigger if clicking the View Details button
                                if (e.target.classList.contains('view-details-btn')) {
                                    return;
                                }

                                // Clear previous selections
                                existingStudiosDiv.querySelectorAll('.existing-studio-item').forEach(el => {
                                    el.style.outline = 'none';
                                });

                                // Highlight selected
                                item.style.outline = '2px solid #e67e22';
                                studioToRemove = {
                                    id: item.getAttribute('data-studio-id'),
                                    name: item.getAttribute('data-studio-name')
                                };
                            });
                        });

                        // Add View Details button handlers
                        existingStudiosDiv.querySelectorAll('.view-details-btn').forEach(btn => {
                            btn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                const studioId = btn.getAttribute('data-studio-id');
                                const studioName = btn.getAttribute('data-studio-name');

                                // Find which scenes have this studio
                                const scenesWithStudio = loadedScenes.filter(scene =>
                                    scene.studio && scene.studio.id === studioId
                                );

                                this.showSceneDetailsForItem(studioName, scenesWithStudio, 'studio', studioId, () => {
                                    // Reopen the studio dialog when back is clicked
                                    this.showBulkStudiosDialog();
                                });
                            });
                        });
                    } else {
                        existingStudiosDiv.innerHTML = '<p style="color: #999;">No studios assigned to selected scenes</p>';
                    }
                } catch (error) {
                    console.error('Error loading existing studios:', error);
                    existingStudiosDiv.innerHTML = '<p style="color: red;">Error loading existing studios</p>';
                }
            };

            // Load existing studios on dialog open
            loadExistingStudios();

            // Load and display studios
            const loadStudios = async (searchTerm = '') => {
                try {
                    const studios = await this.bulkOperations.graphql.searchStudios(searchTerm);
                    suggestionsDiv.innerHTML = studios.map(studio => `
                        <div class="studio-item" data-studio-id="${studio.id}" data-studio-name="${studio.name}" style="
                            padding: 10px;
                            cursor: pointer;
                            border-bottom: 1px solid #333;
                            transition: background 0.2s ease;
                        ">
                            <span>${studio.name}</span>
                            <span style="color: #666; font-size: 12px;"> (${studio.scene_count} scenes)</span>
                        </div>
                    `).join('');

                    // Add click handlers
                    suggestionsDiv.querySelectorAll('.studio-item').forEach(item => {
                        item.addEventListener('click', () => {
                            selectedStudio = {
                                id: item.getAttribute('data-studio-id'),
                                name: item.getAttribute('data-studio-name')
                            };
                            updateSelectedStudio();
                        });

                        item.addEventListener('mouseenter', () => {
                            item.style.background = '#333';
                        });

                        item.addEventListener('mouseleave', () => {
                            item.style.background = '#1a1a1a';
                        });
                    });
                } catch (error) {
                    suggestionsDiv.innerHTML = '<p style="color: red; padding: 10px;">Error loading studios</p>';
                }
            };

            const updateSelectedStudio = () => {
                if (selectedStudio) {
                    selectedStudioDiv.innerHTML = `
                        <span style="
                            display: inline-block;
                            background: #9b59b6;
                            color: white;
                            padding: 8px 15px;
                            border-radius: 5px;
                        ">
                            ${selectedStudio.name}
                        </span>
                    `;
                    applyButton.disabled = false;
                    applyButton.style.opacity = '1';
                } else {
                    selectedStudioDiv.innerHTML = '<p style="color: #999;">No studio selected</p>';
                    applyButton.disabled = true;
                    applyButton.style.opacity = '0.5';
                }
            };

            // Search input handler
            let searchTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    loadStudios(e.target.value);
                }, 300);
            });

            // Apply button handler
            applyButton.addEventListener('click', async () => {
                if (!selectedStudio) return;

                dialog.remove();

                const progress = new ProgressTracker(selectedScenes.length);

                try {
                    await this.bulkOperations.bulkUpdateStudio(selectedScenes, selectedStudio.id);
                    progress.updateProgress(selectedScenes.length);
                    progress.showSummary();

                    // Keep selection active for potential follow-up operations
                    // this.selectionManager.clearSelection(); // Commented out to preserve selection
                } catch (error) {
                    progress.updateProgress(0, error);
                    progress.showSummary();
                }
            });

            // Remove studio button handler
            removeButton.addEventListener('click', async () => {
                if (!studioToRemove) {
                    alert('Please select a studio from the current studios list to remove');
                    return;
                }

                dialog.remove();

                // Find scenes that have this studio
                const scenes = await this.bulkOperations.graphql.getSceneDetails(selectedScenes);
                const scenesToUpdate = scenes
                    .filter(scene => scene.studio && scene.studio.id === studioToRemove.id)
                    .map(scene => scene.id);

                if (scenesToUpdate.length === 0) {
                    alert('No scenes found with the selected studio');
                    return;
                }

                const progress = new ProgressTracker(scenesToUpdate.length);

                try {
                    await this.bulkOperations.bulkUpdateStudio(scenesToUpdate, null);
                    progress.updateProgress(scenesToUpdate.length);
                    progress.showSummary();

                    // Keep selection active for potential follow-up operations
                    // this.selectionManager.clearSelection(); // Commented out to preserve selection
                } catch (error) {
                    progress.updateProgress(0, error);
                    progress.showSummary();
                }
            });


            // Initial load
            loadStudios();
        }

        async showBulkMetadataDialog() {
            const selectedScenes = this.selectionManager.getSelectedScenes();
            if (selectedScenes.length === 0) return;

            // Create dialog
            const dialog = this.createDialog('Bulk Metadata Edit');
            const content = dialog.querySelector('.dialog-content');

            content.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <p style="margin-bottom: 10px;">Editing metadata for ${selectedScenes.length} selected scenes</p>
                    <div style="background: #2a4d69; border: 1px solid #4a7d99; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #fff;">ℹ️ What is Bulk Metadata Management?</h4>
                        <p style="margin: 5px 0; font-size: 14px; color: #e0e0e0;">
                            This tool allows you to update multiple scene properties at once:
                        </p>
                        <ul style="margin: 10px 0; padding-left: 20px; font-size: 14px; color: #e0e0e0;">
                            <li><strong>Rating</strong>: Set the same quality rating for all selected scenes</li>
                            <li><strong>Date</strong>: Update the scene date (useful for batch dating content)</li>
                            <li><strong>Organized</strong>: Mark scenes as organized or unorganized in bulk</li>
                            <li><strong>Details</strong>: Append text to the details field of all scenes</li>
                        </ul>
                        <p style="margin: 10px 0 0 0; font-size: 12px; color: #bbb;">
                            💡 Tip: Leave fields empty to keep their existing values unchanged
                        </p>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; color: #e0e0e0;">Rating:</label>
                        <select id="metadata-rating" style="
                            width: 100%;
                            padding: 8px;
                            border: 1px solid #555;
                            border-radius: 4px;
                            background: #2a2a2a;
                            color: #e0e0e0;
                        ">
                            <option value="">Keep existing</option>
                            <option value="0">0 - Unrated</option>
                            <option value="1">1 - Poor</option>
                            <option value="2">2 - Below Average</option>
                            <option value="3">3 - Average</option>
                            <option value="4">4 - Good</option>
                            <option value="5">5 - Excellent</option>
                        </select>
                        <small style="color: #999; font-size: 12px;">Apply the same rating to all selected scenes</small>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; color: #e0e0e0;">Date:</label>
                        <input type="date" id="metadata-date" style="
                            width: 100%;
                            padding: 8px;
                            border: 1px solid #555;
                            border-radius: 4px;
                            background: #2a2a2a;
                            color: #e0e0e0;
                        ">
                        <small style="color: #999; font-size: 12px;">Set the same date for all selected scenes</small>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; color: #e0e0e0;">Organized:</label>
                        <select id="metadata-organized" style="
                            width: 100%;
                            padding: 8px;
                            border: 1px solid #555;
                            border-radius: 4px;
                            background: #2a2a2a;
                            color: #e0e0e0;
                        ">
                            <option value="">Keep existing</option>
                            <option value="true">Yes - Mark as Organized</option>
                            <option value="false">No - Mark as Unorganized</option>
                        </select>
                        <small style="color: #999; font-size: 12px;">Bulk update the organized status</small>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; color: #e0e0e0;">Details (append text):</label>
                        <textarea id="metadata-details" placeholder="Text entered here will be added to existing details..." style="
                            width: 100%;
                            padding: 8px;
                            border: 1px solid #555;
                            border-radius: 4px;
                            background: #2a2a2a;
                            color: #e0e0e0;
                            min-height: 80px;
                            resize: vertical;
                        "></textarea>
                        <small style="color: #999; font-size: 12px;">This text will be appended to the existing details of each scene</small>
                    </div>
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="cancel-button" style="
                        padding: 10px 20px;
                        border: none;
                        border-radius: 5px;
                        background: #95a5a6;
                        color: white;
                        cursor: pointer;
                    ">Cancel</button>
                    <button id="apply-metadata" style="
                        padding: 10px 20px;
                        border: none;
                        border-radius: 5px;
                        background: #27ae60;
                        color: white;
                        cursor: pointer;
                    ">Apply Changes</button>
                </div>
            `;

            const applyButton = dialog.querySelector('#apply-metadata');

            // Add cancel button handler
            dialog.querySelector('.cancel-button').addEventListener('click', () => {
                dialog.remove();
            });

            // Apply button handler
            applyButton.addEventListener('click', async () => {
                const rating = dialog.querySelector('#metadata-rating').value;
                const date = dialog.querySelector('#metadata-date').value;
                const organized = dialog.querySelector('#metadata-organized').value;
                const details = dialog.querySelector('#metadata-details').value;

                // Build metadata object with only non-empty values
                const metadata = {};
                if (rating !== '') metadata.rating = parseInt(rating);
                if (date !== '') metadata.date = date;
                if (organized !== '') metadata.organized = organized === 'true';
                if (details.trim() !== '') metadata.details = details.trim();

                // Check if any metadata was provided
                if (Object.keys(metadata).length === 0) {
                    alert('No changes specified');
                    return;
                }

                dialog.remove();

                const progress = new ProgressTracker(selectedScenes.length);

                try {
                    await this.bulkOperations.bulkUpdateMetadata(selectedScenes, metadata);
                    progress.updateProgress(selectedScenes.length);
                    progress.showSummary();

                    // Keep selection active for potential follow-up operations
                    // this.selectionManager.clearSelection(); // Commented out to preserve selection
                } catch (error) {
                    progress.updateProgress(0, error);
                    progress.showSummary();
                }
            });
        }

        createDialog(title) {
            // Remove existing dialog if any
            const existingDialog = document.getElementById('bulk-dialog');
            if (existingDialog) existingDialog.remove();

            const dialog = document.createElement('div');
            dialog.id = 'bulk-dialog';
            dialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #2c3e50;
                color: white;
                padding: 0;
                border-radius: 10px;
                box-shadow: 0 4px 30px rgba(0,0,0,0.5);
                z-index: 10001;
                min-width: 500px;
                max-width: 90vw;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
            `;

            dialog.innerHTML = `
                <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <h3 style="margin: 0;">${title}</h3>
                </div>
                <div class="dialog-content" style="padding: 20px; overflow-y: auto; flex: 1;">
                    <!-- Content will be inserted here -->
                </div>
            `;

            document.body.appendChild(dialog);

            // Hide any existing bulk select checkboxes inside the dialog
            const style = document.createElement('style');
            style.textContent = `
                #bulk-dialog .bulk-select-checkbox {
                    display: none !important;
                    visibility: hidden !important;
                    width: 0 !important;
                    height: 0 !important;
                    position: absolute !important;
                    left: -9999px !important;
                }
                #bulk-dialog .scene-card-container .bulk-select-checkbox,
                #bulk-dialog [data-scene-id] > .bulk-select-checkbox {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
            dialog._styleElement = style;

            // Clean up style when dialog is removed
            const originalRemove = dialog.remove.bind(dialog);
            dialog.remove = function () {
                if (dialog._styleElement) {
                    dialog._styleElement.remove();
                }
                originalRemove();
            };

            return dialog;
        }

        showComingSoonDialog(feature) {
            const dialog = this.createDialog(`${feature} - Coming Soon!`);
            const content = dialog.querySelector('.dialog-content');

            content.innerHTML = `
                <p>This feature is currently under development.</p>
                <button class="close-dialog-button" style="
                    background: #3498db;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-top: 15px;
                ">OK</button>
            `;

            // Add event listener to close button
            content.querySelector('.close-dialog-button').addEventListener('click', () => {
                dialog.remove();
            });
        }

        showSceneDetailsForItem(itemName, scenesArray, type, itemId, backCallback = null) {
            const dialog = this.createDialog(`Scenes with ${itemName}`);
            const content = dialog.querySelector('.dialog-content');

            // Track selected scenes in this view
            const selectedInView = new Set();

            // Display the results
            if (scenesArray.length > 0) {
                content.innerHTML = `
                    <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <p><strong>${scenesArray.length}</strong> scene${scenesArray.length > 1 ? 's' : ''} with <strong>${itemName}</strong></p>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button class="select-all-btn" style="
                                background: #27ae60;
                                color: white;
                                border: none;
                                padding: 6px 12px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 12px;
                            ">Select All</button>
                            <button class="select-none-btn" style="
                                background: #95a5a6;
                                color: white;
                                border: none;
                                padding: 6px 12px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 12px;
                            ">Select None</button>
                        </div>
                    </div>
                    <div class="scenes-list" style="max-height: 400px; overflow-y: auto;">
                        ${scenesArray.map(scene => {
                    // Get filename from the first file if no title
                    let displayName = scene.title;
                    if (!displayName && scene.files && scene.files.length > 0) {
                        displayName = scene.files[0].basename || scene.files[0].path.split('/').pop();
                    }
                    if (!displayName) {
                        displayName = `Scene #${scene.id}`;
                    }

                    return `
                            <div class="scene-item" data-scene-id="${scene.id}" style="
                                padding: 10px;
                                margin-bottom: 10px;
                                background: #2a2a2a;
                                border-radius: 5px;
                                border: 1px solid #555;
                                display: flex;
                                gap: 15px;
                                position: relative;
                            ">
                                <div style="display: flex; align-items: center;">
                                    <input type="checkbox" class="scene-select-checkbox" data-scene-id="${scene.id}" style="
                                        width: 18px;
                                        height: 18px;
                                        cursor: pointer;
                                        margin-right: 10px;
                                    ">
                                </div>
                                ${scene.paths && scene.paths.screenshot ? `
                                    <div style="flex-shrink: 0;">
                                        <a href="/scenes/${scene.id}" target="_blank">
                                            <img src="${scene.paths.screenshot}" style="
                                                width: 160px;
                                                height: 90px;
                                                object-fit: cover;
                                                border-radius: 4px;
                                                cursor: pointer;
                                            " alt="${displayName}">
                                        </a>
                                    </div>
                                ` : ''}
                                <div style="flex: 1;">
                                    <div style="font-weight: bold; margin-bottom: 5px;">
                                        <a href="/scenes/${scene.id}" target="_blank" style="color: #3498db; text-decoration: none;">
                                            ${displayName}
                                        </a>
                                    </div>
                                    ${scene.date ? `<div style="color: #999; font-size: 12px;">Date: ${scene.date}</div>` : ''}
                                    ${scene.performers && scene.performers.length > 0 ? `
                                        <div style="color: #999; font-size: 12px; margin-top: 5px;">
                                            Performers: ${scene.performers.map(p => p.name).join(', ')}
                                        </div>
                                    ` : ''}
                                    ${scene.studio ? `
                                        <div style="color: #999; font-size: 12px;">
                                            Studio: ${scene.studio.name}
                                        </div>
                                    ` : ''}
                                    ${scene.tags && scene.tags.length > 0 ? `
                                        <div style="margin-top: 5px;">
                                            ${scene.tags.map(tag => `
                                                <span style="
                                                    display: inline-block;
                                                    background: #555;
                                                    color: white;
                                                    padding: 2px 8px;
                                                    border-radius: 3px;
                                                    font-size: 11px;
                                                    margin: 2px;
                                                ">
                                                    ${tag.name}
                                                </span>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            `;
                }).join('')}
                    </div>
                    <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span class="selection-count" style="color: #999;">0 scenes selected</span>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            ${backCallback ? `
                                <button class="back-button" style="
                                    background: #95a5a6;
                                    color: white;
                                    border: none;
                                    padding: 10px 20px;
                                    border-radius: 5px;
                                    cursor: pointer;
                                ">Back</button>
                            ` : ''}
                            <button class="delete-selected-button" style="
                                background: #e74c3c;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 5px;
                                cursor: pointer;
                                opacity: 0.5;
                            " disabled>Remove ${type === 'tag' ? 'Tag' : type === 'performer' ? 'Performer' : 'Studio'} from Selected</button>
                            <button class="close-dialog-button" style="
                                background: #3498db;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 5px;
                                cursor: pointer;
                            ">Close</button>
                        </div>
                    </div>
                `;
            } else {
                content.innerHTML = `
                    <p>No scenes found with ${itemName}</p>
                    <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
                        ${backCallback ? `
                            <button class="back-button" style="
                                background: #95a5a6;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 5px;
                                cursor: pointer;
                            ">Back</button>
                        ` : ''}
                        <button class="close-dialog-button" style="
                            background: #3498db;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 5px;
                            cursor: pointer;
                        ">Close</button>
                    </div>
                `;
            }

            // Remove any existing bulk-select-checkbox elements from the content
            const removeBulkCheckboxes = () => {
                // Debug: log what we find
                const bulkCheckboxes = content.querySelectorAll('.bulk-select-checkbox');
                if (bulkCheckboxes.length > 0) {
                    console.log('Found bulk checkboxes to remove:', bulkCheckboxes.length);
                    bulkCheckboxes.forEach(checkbox => {
                        checkbox.remove();
                    });
                }

                // Also remove any bulk-selected class from scene items
                content.querySelectorAll('.bulk-selected').forEach(elem => {
                    elem.classList.remove('bulk-selected');
                });

                // Remove checkboxes that might have been added without the class
                content.querySelectorAll('.scene-item input[type="checkbox"]:not(.scene-select-checkbox)').forEach(checkbox => {
                    console.log('Removing non-scene-select checkbox:', checkbox);
                    checkbox.remove();
                });

                // Also check if checkboxes are being added to scene-card elements
                content.querySelectorAll('.scene-card input[type="checkbox"]:not(.scene-select-checkbox)').forEach(checkbox => {
                    console.log('Removing scene-card checkbox:', checkbox);
                    checkbox.remove();
                });
            };

            // Remove immediately and after a short delay to catch any late additions
            removeBulkCheckboxes();
            setTimeout(removeBulkCheckboxes, 100);
            setTimeout(removeBulkCheckboxes, 300);

            // Add event handlers
            const updateSelectionCount = () => {
                const count = selectedInView.size;
                const countSpan = content.querySelector('.selection-count');
                if (countSpan) {
                    countSpan.textContent = `${count} scene${count !== 1 ? 's' : ''} selected`;
                }

                const deleteBtn = content.querySelector('.delete-selected-button');
                if (deleteBtn) {
                    deleteBtn.disabled = count === 0;
                    deleteBtn.style.opacity = count === 0 ? '0.5' : '1';
                }
            };

            // Checkbox handlers
            content.querySelectorAll('.scene-select-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const sceneId = e.target.getAttribute('data-scene-id');
                    if (e.target.checked) {
                        selectedInView.add(sceneId);
                    } else {
                        selectedInView.delete(sceneId);
                    }
                    updateSelectionCount();
                });
            });

            // Select All button
            const selectAllBtn = content.querySelector('.select-all-btn');
            if (selectAllBtn) {
                selectAllBtn.addEventListener('click', () => {
                    content.querySelectorAll('.scene-select-checkbox').forEach(checkbox => {
                        checkbox.checked = true;
                        selectedInView.add(checkbox.getAttribute('data-scene-id'));
                    });
                    updateSelectionCount();
                });
            }

            // Select None button
            const selectNoneBtn = content.querySelector('.select-none-btn');
            if (selectNoneBtn) {
                selectNoneBtn.addEventListener('click', () => {
                    content.querySelectorAll('.scene-select-checkbox').forEach(checkbox => {
                        checkbox.checked = false;
                        selectedInView.delete(checkbox.getAttribute('data-scene-id'));
                    });
                    updateSelectionCount();
                });
            }

            // Back button
            const backBtn = content.querySelector('.back-button');
            if (backBtn && backCallback) {
                backBtn.addEventListener('click', () => {
                    dialog.remove();
                    // Small delay to ensure dialog is fully removed before opening the next one
                    setTimeout(() => {
                        backCallback();
                    }, 100);
                });
            }

            // Delete Selected button (actually removes tag/performer/studio from scenes)
            const deleteBtn = content.querySelector('.delete-selected-button');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async () => {
                    if (selectedInView.size === 0) return;

                    const itemType = type === 'tag' ? 'Tag' : type === 'performer' ? 'Performer' : 'Studio';
                    const confirmMsg = `Are you sure you want to remove ${itemName} from ${selectedInView.size} selected scene${selectedInView.size !== 1 ? 's' : ''}?`;

                    if (confirm(confirmMsg)) {
                        try {
                            deleteBtn.disabled = true;
                            deleteBtn.textContent = 'Removing...';

                            const sceneIds = Array.from(selectedInView);

                            if (type === 'tag') {
                                // Remove tag from scenes - pass empty array for add, itemId in remove array
                                await this.bulkOperations.bulkUpdateTags(sceneIds, [], [itemId]);
                            } else if (type === 'performer') {
                                // Remove performer from scenes - pass empty array for add, itemId in remove array
                                await this.bulkOperations.bulkUpdatePerformers(sceneIds, [], [itemId]);
                            } else if (type === 'studio') {
                                // Remove studio from scenes (set to null)
                                await this.bulkOperations.bulkUpdateStudio(sceneIds, null);
                            }

                            // Update the UI to reflect the changes
                            selectedInView.forEach(sceneId => {
                                const sceneItem = content.querySelector(`.scene-item[data-scene-id="${sceneId}"]`);
                                if (sceneItem) {
                                    // Since the scene no longer has this tag/performer/studio,
                                    // we should remove it from the view (it no longer matches the filter)
                                    sceneItem.style.opacity = '0.5';
                                    sceneItem.style.transition = 'opacity 0.3s ease';

                                    // Add a visual indicator that it was removed
                                    const indicator = document.createElement('div');
                                    indicator.style.cssText = `
                                        position: absolute;
                                        top: 50%;
                                        left: 50%;
                                        transform: translate(-50%, -50%);
                                        background: rgba(231, 76, 60, 0.9);
                                        color: white;
                                        padding: 5px 10px;
                                        border-radius: 4px;
                                        font-size: 12px;
                                        z-index: 10;
                                    `;
                                    indicator.textContent = `${itemType} Removed`;
                                    sceneItem.style.position = 'relative';
                                    sceneItem.appendChild(indicator);

                                    // Remove the scene from the list after animation
                                    setTimeout(() => sceneItem.remove(), 800);
                                }
                            });

                            // Update the scene count
                            setTimeout(() => {
                                const remainingScenes = content.querySelectorAll('.scene-item').length;
                                const scenesP = content.querySelector('div p strong');
                                if (scenesP) {
                                    scenesP.textContent = remainingScenes.toString();
                                }
                            }, 400);

                            alert(`Successfully removed ${itemName} from ${selectedInView.size} scene${selectedInView.size !== 1 ? 's' : ''}.\n\nSelection preserved for additional operations.`);
                            // Keep selection for follow-up operations
                            // selectedInView.clear();
                            updateSelectionCount();

                        } catch (error) {
                            console.error(`Error removing ${type}:`, error);
                            alert(`Error removing ${type}. Check the console for details.`);
                        } finally {
                            deleteBtn.disabled = false;
                            deleteBtn.textContent = `Remove ${itemType} from Selected`;
                        }
                    }
                });
            }

            // Close button
            content.querySelector('.close-dialog-button').addEventListener('click', () => {
                dialog.remove();
            });
        }

        async showSceneDetailsDialog(type, itemId, itemName) {
            const selectedScenes = this.selectionManager.getSelectedScenes();
            const dialog = this.createDialog(`Scenes with ${itemName}`);
            const content = dialog.querySelector('.dialog-content');

            content.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <p>Loading scene details...</p>
                </div>
            `;

            try {
                const scenes = await this.bulkOperations.graphql.getSceneDetails(selectedScenes);
                let matchingScenes = [];

                // Filter scenes based on type
                if (type === 'tag') {
                    matchingScenes = scenes.filter(scene =>
                        scene.tags && scene.tags.some(tag => tag.id === itemId)
                    );
                } else if (type === 'performer') {
                    matchingScenes = scenes.filter(scene =>
                        scene.performers && scene.performers.some(performer => performer.id === itemId)
                    );
                } else if (type === 'studio') {
                    matchingScenes = scenes.filter(scene =>
                        scene.studio && scene.studio.id === itemId
                    );
                }

                // Display the results
                if (matchingScenes.length > 0) {
                    content.innerHTML = `
                        <div style="margin-bottom: 20px;">
                            <p><strong>${matchingScenes.length}</strong> of <strong>${selectedScenes.length}</strong> selected scenes have <strong>${itemName}</strong></p>
                        </div>
                        <div style="max-height: 400px; overflow-y: auto;">
                            ${matchingScenes.map(scene => `
                                <div style="
                                    padding: 10px;
                                    margin-bottom: 10px;
                                    background: #2a2a2a;
                                    border-radius: 5px;
                                    border: 1px solid #555;
                                ">
                                    <div style="font-weight: bold; margin-bottom: 5px;">
                                        ${scene.title || `Scene #${scene.id}`}
                                    </div>
                                    ${scene.date ? `<div style="color: #999; font-size: 12px;">Date: ${scene.date}</div>` : ''}
                                    ${scene.performers && scene.performers.length > 0 ? `
                                        <div style="color: #999; font-size: 12px; margin-top: 5px;">
                                            Performers: ${scene.performers.map(p => p.name).join(', ')}
                                        </div>
                                    ` : ''}
                                    ${scene.studio ? `
                                        <div style="color: #999; font-size: 12px;">
                                            Studio: ${scene.studio.name}
                                        </div>
                                    ` : ''}
                                    ${scene.tags && scene.tags.length > 0 ? `
                                        <div style="margin-top: 5px;">
                                            ${scene.tags.map(tag => `
                                                <span style="
                                                    display: inline-block;
                                                    background: ${tag.id === itemId ? '#3498db' : '#555'};
                                                    color: white;
                                                    padding: 2px 8px;
                                                    border-radius: 3px;
                                                    font-size: 11px;
                                                    margin: 2px;
                                                ">
                                                    ${tag.name}
                                                </span>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                        <div style="margin-top: 20px; text-align: right;">
                            <button class="close-dialog-button" style="
                                background: #3498db;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 5px;
                                cursor: pointer;
                            ">Close</button>
                        </div>
                    `;
                } else {
                    content.innerHTML = `
                        <p>No scenes found with ${itemName}</p>
                        <button class="close-dialog-button" style="
                            background: #3498db;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 5px;
                            cursor: pointer;
                            margin-top: 15px;
                        ">Close</button>
                    `;
                }

                // Add event listener to close button
                content.querySelector('.close-dialog-button').addEventListener('click', () => {
                    dialog.remove();
                });

            } catch (error) {
                console.error('Error loading scene details:', error);
                content.innerHTML = `
                    <p style="color: red;">Error loading scene details</p>
                    <button class="close-dialog-button" style="
                        background: #3498db;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-top: 15px;
                    ">Close</button>
                `;

                content.querySelector('.close-dialog-button').addEventListener('click', () => {
                    dialog.remove();
                });
            }
        }
    }

    // ===== INITIALIZATION =====
    const graphqlClient = new GraphQLClient();
    const selectionManager = new SelectionManager();
    const bulkOperations = new BulkOperationsEngine(graphqlClient);
    const bulkUI = new BulkUIManager(selectionManager, bulkOperations);

    // No longer needed as we're using proper event listeners
    // window.bulkUI = bulkUI;

    console.log('✅ Stash Bulk Operations Manager initialized successfully');

})();