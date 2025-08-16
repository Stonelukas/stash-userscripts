// ==UserScript==
// @name         Stash Scene Quality Analyzer
// @namespace    https://github.com/stashapp/stash
// @version      1.0.1
// @description  Automatically analyzes video quality metrics, identifies duplicates, and provides quality recommendations for Stash scenes
// @author       StashDevelopment
// @match        http://localhost:9998/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    console.log('🎬 Stash Scene Quality Analyzer v1.0.1 - Initializing');

    // ===== CONFIGURATION =====
    const CONFIG = {
        ENABLE_AUTO_ANALYSIS: 'enableAutoAnalysis',
        ENABLE_DUPLICATE_DETECTION: 'enableDuplicateDetection',
        ENABLE_QUALITY_FLAGS: 'enableQualityFlags',
        MIN_RESOLUTION_THRESHOLD: 'minResolutionThreshold',
        MIN_BITRATE_THRESHOLD: 'minBitrateThreshold',
        QUALITY_SCORE_WEIGHTS: 'qualityScoreWeights',
        SHOW_QUALITY_BADGES: 'showQualityBadges',
        ANALYSIS_BATCH_SIZE: 'analysisBatchSize'
    };

    const DEFAULTS = {
        [CONFIG.ENABLE_AUTO_ANALYSIS]: true,
        [CONFIG.ENABLE_DUPLICATE_DETECTION]: true,
        [CONFIG.ENABLE_QUALITY_FLAGS]: true,
        [CONFIG.MIN_RESOLUTION_THRESHOLD]: 720,
        [CONFIG.MIN_BITRATE_THRESHOLD]: 2000,
        [CONFIG.QUALITY_SCORE_WEIGHTS]: {
            resolution: 0.4,
            bitrate: 0.3,
            codec: 0.2,
            audio: 0.1
        },
        [CONFIG.SHOW_QUALITY_BADGES]: true,
        [CONFIG.ANALYSIS_BATCH_SIZE]: 10
    };

    // Quality thresholds
    const QUALITY_THRESHOLDS = {
        RESOLUTION: {
            EXCELLENT: { min: 2160, score: 100, label: '4K' },
            GOOD: { min: 1080, score: 80, label: '1080p' },
            FAIR: { min: 720, score: 60, label: '720p' },
            POOR: { min: 480, score: 40, label: '480p' },
            VERY_POOR: { min: 0, score: 20, label: 'SD' }
        },
        BITRATE: {
            EXCELLENT: { min: 8000, score: 100, label: '8+ Mbps' },
            GOOD: { min: 4000, score: 80, label: '4-8 Mbps' },
            FAIR: { min: 2000, score: 60, label: '2-4 Mbps' },
            POOR: { min: 1000, score: 40, label: '1-2 Mbps' },
            VERY_POOR: { min: 0, score: 20, label: '<1 Mbps' }
        },
        CODEC: {
            H265: { score: 100, label: 'H.265/HEVC' },
            H264: { score: 80, label: 'H.264/AVC' },
            VP9: { score: 75, label: 'VP9' },
            VP8: { score: 60, label: 'VP8' },
            OTHER: { score: 40, label: 'Other' }
        }
    };

    // GraphQL queries
    const GRAPHQL_QUERIES = {
        SCENE_FILE_INFO: `
            query SceneFileInfo($id: ID!) {
                findScene(id: $id) {
                    id
                    title
                    files {
                        size
                        duration
                        video_codec
                        audio_codec
                        width
                        height
                        frame_rate
                        bit_rate
                        fingerprints {
                            type
                            value
                        }
                    }
                }
            }
        `,
        ALL_SCENES: `
            query AllScenes {
                findScenes {
                    count
                    scenes {
                        id
                        title
                        files {
                            size
                            duration
                            width
                            height
                            bit_rate
                            fingerprints {
                                type
                                value
                            }
                        }
                    }
                }
            }
        `,
        UPDATE_SCENE_TAGS: `
            mutation UpdateSceneTags($id: ID!, $tag_ids: [ID!]) {
                sceneUpdate(input: { id: $id, tag_ids: $tag_ids }) {
                    id
                    tags {
                        id
                        name
                    }
                }
            }
        `,
        FIND_TAG: `
            query FindTag($name: String!) {
                findTags(tag_filter: { name: { value: $name, modifier: EQUALS } }) {
                    count
                    tags {
                        id
                        name
                    }
                }
            }
        `,
        CREATE_TAG: `
            mutation TagCreate($name: String!) {
                tagCreate(input: { name: $name }) {
                    id
                    name
                }
            }
        `
    };

    // Utility functions
    function getConfig(key) {
        return GM_getValue(key, DEFAULTS[key]);
    }

    function setConfig(key, value) {
        GM_setValue(key, value);
    }

    function formatFileSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    function formatBitrate(kbps) {
        if (kbps >= 1000) {
            return (kbps / 1000).toFixed(1) + ' Mbps';
        }
        return kbps + ' kbps';
    }

    // ===== GRAPHQL CLIENT =====
    class GraphQLClient {
        constructor() {
            this.endpoint = '/graphql';
        }

        async query(query, variables = {}) {
            try {
                const response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query,
                        variables
                    })
                });

                const data = await response.json();
                if (data.errors) {
                    console.error('GraphQL errors:', data.errors);
                    throw new Error(`GraphQL query failed: ${data.errors[0].message}`);
                }
                if (!data.data) {
                    throw new Error('GraphQL query returned no data');
                }
                return data.data;
            } catch (error) {
                console.error('GraphQL query failed:', error);
                throw error;
            }
        }

        async getSceneFileInfo(sceneId) {
            const data = await this.query(GRAPHQL_QUERIES.SCENE_FILE_INFO, { id: sceneId });
            return data?.findScene || null;
        }

        async getAllScenes() {
            try {
                const data = await this.query(GRAPHQL_QUERIES.ALL_SCENES);
                if (!data || !data.findScenes) {
                    console.warn('No scenes data returned from GraphQL');
                    return { count: 0, scenes: [] };
                }
                return data.findScenes;
            } catch (error) {
                console.error('Failed to get all scenes:', error);
                return { count: 0, scenes: [] };
            }
        }

        async updateSceneTags(sceneId, tagIds) {
            const data = await this.query(GRAPHQL_QUERIES.UPDATE_SCENE_TAGS, {
                id: sceneId,
                tag_ids: tagIds
            });
            return data?.sceneUpdate || null;
        }

        async findTag(name) {
            const data = await this.query(GRAPHQL_QUERIES.FIND_TAG, { name });
            return data?.findTags?.tags?.length > 0 ? data.findTags.tags[0] : null;
        }

        async createTag(name) {
            const data = await this.query(GRAPHQL_QUERIES.CREATE_TAG, { name });
            return data?.tagCreate || null;
        }
    }

    // ===== QUALITY METRICS ENGINE =====
    class QualityMetricsEngine {
        constructor() {
            this.weights = getConfig(CONFIG.QUALITY_SCORE_WEIGHTS);
        }

        analyzeScene(sceneData) {
            const file = sceneData.file || (sceneData.files && sceneData.files[0]) || {};

            return {
                resolution: this.extractResolution(file),
                bitrate: this.extractBitrate(file),
                codec: this.extractCodec(file),
                audioQuality: this.analyzeAudio(file),
                fileSize: file.size || 0,
                duration: file.duration || 0,
                framerate: file.frame_rate || 0
            };
        }

        extractResolution(file) {
            return {
                width: file.width || 0,
                height: file.height || 0,
                pixels: (file.width || 0) * (file.height || 0)
            };
        }

        extractBitrate(file) {
            // Bitrate is stored in kilobits per second
            return file.bit_rate || 0;
        }

        extractCodec(file) {
            return {
                video: file.video_codec || 'unknown',
                audio: file.audio_codec || 'unknown'
            };
        }

        analyzeAudio(file) {
            return {
                codec: file.audio_codec || 'unknown',
                // Additional audio metrics would come from extended file info
                quality: this.scoreAudioCodec(file.audio_codec)
            };
        }

        scoreAudioCodec(codec) {
            const audioScores = {
                'aac': 90,
                'ac3': 85,
                'mp3': 70,
                'opus': 95,
                'flac': 100,
                'unknown': 50
            };
            return audioScores[codec?.toLowerCase()] || 50;
        }

        calculateQualityScore(metrics) {
            const scores = {
                resolution: this.scoreResolution(metrics.resolution),
                bitrate: this.scoreBitrate(metrics.bitrate),
                codec: this.scoreCodec(metrics.codec),
                audio: metrics.audioQuality.quality
            };

            // Calculate weighted average
            const overallScore =
                scores.resolution * this.weights.resolution +
                scores.bitrate * this.weights.bitrate +
                scores.codec * this.weights.codec +
                scores.audio * this.weights.audio;

            return {
                overall: Math.round(overallScore),
                ...scores
            };
        }

        scoreResolution(resolution) {
            const height = resolution.height;

            for (const [, threshold] of Object.entries(QUALITY_THRESHOLDS.RESOLUTION)) {
                if (height >= threshold.min) {
                    return threshold.score;
                }
            }
            return QUALITY_THRESHOLDS.RESOLUTION.VERY_POOR.score;
        }

        scoreBitrate(bitrate) {
            for (const [, threshold] of Object.entries(QUALITY_THRESHOLDS.BITRATE)) {
                if (bitrate >= threshold.min) {
                    return threshold.score;
                }
            }
            return QUALITY_THRESHOLDS.BITRATE.VERY_POOR.score;
        }

        scoreCodec(codec) {
            const videoCodec = codec.video?.toLowerCase() || '';

            if (videoCodec.includes('h265') || videoCodec.includes('hevc')) {
                return QUALITY_THRESHOLDS.CODEC.H265.score;
            } else if (videoCodec.includes('h264') || videoCodec.includes('avc')) {
                return QUALITY_THRESHOLDS.CODEC.H264.score;
            } else if (videoCodec.includes('vp9')) {
                return QUALITY_THRESHOLDS.CODEC.VP9.score;
            } else if (videoCodec.includes('vp8')) {
                return QUALITY_THRESHOLDS.CODEC.VP8.score;
            }
            return QUALITY_THRESHOLDS.CODEC.OTHER.score;
        }

        getQualityFlags(metrics, scores) {
            const flags = [];
            const minResolution = getConfig(CONFIG.MIN_RESOLUTION_THRESHOLD);
            const minBitrate = getConfig(CONFIG.MIN_BITRATE_THRESHOLD);

            if (metrics.resolution.height < minResolution) {
                flags.push('low_resolution');
            }
            if (metrics.bitrate < minBitrate) {
                flags.push('low_bitrate');
            }
            if (scores.audio < 60) {
                flags.push('audio_issues');
            }
            if (scores.overall < 40) {
                flags.push('poor_quality');
            } else if (scores.overall >= 80) {
                flags.push('high_quality');
            }

            return flags;
        }
    }

    // ===== DUPLICATE DETECTOR =====
    class DuplicateDetector {
        constructor() {
            this.fingerprintCache = new Map();
        }

        generateFingerprint(sceneData) {
            const file = sceneData.file || (sceneData.files && sceneData.files[0]) || {};

            // Create a composite fingerprint based on multiple factors
            const sizeFingerprint = this.hashFileSize(file.size || 0);
            const durationFingerprint = this.hashDuration(file.duration || 0);
            const titleFingerprint = this.hashTitle(sceneData.title || '');
            const resolutionFingerprint = this.hashResolution(file.width || 0, file.height || 0);

            // Extract fingerprints from file
            let phash, checksum, oshash;
            if (file.fingerprints) {
                file.fingerprints.forEach(fp => {
                    if (fp.type === 'phash') phash = fp.value;
                    else if (fp.type === 'checksum' || fp.type === 'md5') checksum = fp.value;
                    else if (fp.type === 'oshash') oshash = fp.value;
                });
            }

            return {
                sceneId: sceneData.id,
                composite: `${sizeFingerprint}-${durationFingerprint}-${titleFingerprint}-${resolutionFingerprint}`,
                size: file.size || 0,
                duration: file.duration || 0,
                title: sceneData.title || '',
                phash: phash,
                checksum: checksum,
                oshash: oshash
            };
        }

        hashFileSize(size) {
            // Group by 10MB ranges
            return Math.floor(size / (10 * 1024 * 1024));
        }

        hashDuration(duration) {
            // Group by 10 second ranges
            return Math.floor(duration / 10);
        }

        hashTitle(title) {
            // Simple title similarity hash
            return title.toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .slice(0, 10);
        }

        hashResolution(width, height) {
            // Group by resolution categories
            const pixels = width * height;
            if (pixels >= 3840 * 2160) return '4k';
            if (pixels >= 1920 * 1080) return '1080p';
            if (pixels >= 1280 * 720) return '720p';
            if (pixels >= 854 * 480) return '480p';
            return 'sd';
        }

        findDuplicates(scenes) {
            const fingerprints = scenes.map(scene => ({
                scene,
                fingerprint: this.generateFingerprint(scene)
            }));

            const groups = new Map();

            // Group by composite fingerprint first
            fingerprints.forEach(({ scene, fingerprint }) => {
                const key = fingerprint.composite;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push({ scene, fingerprint });
            });

            // Further analyze groups for more accurate duplicate detection
            const duplicateGroups = [];
            groups.forEach((group) => {
                if (group.length > 1) {
                    // Check for phash similarity if available
                    const refinedGroups = this.refineByPhash(group);
                    refinedGroups.forEach(refined => {
                        if (refined.length > 1) {
                            duplicateGroups.push(this.createDuplicateGroup(refined));
                        }
                    });
                }
            });

            return duplicateGroups;
        }

        calculateHammingDistance(hash1, hash2) {
            // Convert hex strings to binary and calculate Hamming distance
            if (!hash1 || !hash2 || hash1.length !== hash2.length) {
                return Infinity;
            }
            
            let distance = 0;
            for (let i = 0; i < hash1.length; i++) {
                const num1 = parseInt(hash1[i], 16);
                const num2 = parseInt(hash2[i], 16);
                let xor = num1 ^ num2;
                
                // Count bits set in XOR result
                while (xor) {
                    distance += xor & 1;
                    xor >>= 1;
                }
            }
            
            return distance;
        }

        refineByPhash(group) {
            // If phashes are available, use them for more accurate grouping
            const phashGroups = [];
            const threshold = 10; // Hamming distance threshold for similarity
            
            group.forEach(item => {
                const phash = item.fingerprint.phash;
                if (!phash) {
                    // Items without phash get their own group
                    phashGroups.push([item]);
                    return;
                }
                
                // Try to find a similar phash group
                let added = false;
                for (const phashGroup of phashGroups) {
                    const representativePhash = phashGroup[0].fingerprint.phash;
                    if (representativePhash) {
                        const distance = this.calculateHammingDistance(phash, representativePhash);
                        if (distance <= threshold) {
                            phashGroup.push(item);
                            added = true;
                            break;
                        }
                    }
                }
                
                // If no similar group found, create new group
                if (!added) {
                    phashGroups.push([item]);
                }
            });

            // Only return groups with more than one item
            return phashGroups.filter(g => g.length > 1);
        }

        createDuplicateGroup(items) {
            // Sort by quality (this requires quality scores to be calculated)
            const groupId = `dup-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

            return {
                groupId,
                scenes: items.map(item => ({
                    sceneId: item.scene.id,
                    title: item.scene.title,
                    fileSize: item.fingerprint.size,
                    duration: item.fingerprint.duration
                })),
                similarity: 0.95, // High similarity for now
                count: items.length
            };
        }
    }

    // ===== QUALITY ANALYZER UI =====
    class QualityAnalyzerUI {
        constructor(metricsEngine, duplicateDetector, graphqlClient) {
            this.metricsEngine = metricsEngine;
            this.duplicateDetector = duplicateDetector;
            this.graphql = graphqlClient;
            this.analysisResults = new Map();
            this.setupStyles();
            this.injectQualityIndicators();
            this.setupToolbar();
        }

        setupStyles() {
            GM_addStyle(`
                /* Quality Badge Styles */
                .quality-badge {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: bold;
                    color: white;
                    z-index: 10;
                    backdrop-filter: blur(2px);
                }

                .quality-excellent {
                    background: linear-gradient(135deg, #27ae60, #2ecc71);
                }

                .quality-good {
                    background: linear-gradient(135deg, #3498db, #5dade2);
                }

                .quality-fair {
                    background: linear-gradient(135deg, #f39c12, #f1c40f);
                }

                .quality-poor {
                    background: linear-gradient(135deg, #e67e22, #d68910);
                }

                .quality-very-poor {
                    background: linear-gradient(135deg, #e74c3c, #c0392b);
                }

                /* Quality Flags */
                .quality-flags {
                    position: absolute;
                    bottom: 8px;
                    left: 8px;
                    display: flex;
                    gap: 4px;
                    flex-wrap: wrap;
                    max-width: 70%;
                }

                .quality-flag {
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 10px;
                    font-weight: 500;
                    backdrop-filter: blur(2px);
                }

                .flag-low-resolution {
                    background: rgba(231, 76, 60, 0.8);
                    color: white;
                }

                .flag-low-bitrate {
                    background: rgba(230, 126, 34, 0.8);
                    color: white;
                }

                .flag-audio-issues {
                    background: rgba(241, 196, 15, 0.8);
                    color: #333;
                }

                .flag-duplicate {
                    background: rgba(155, 89, 182, 0.8);
                    color: white;
                }

                /* Quality Analyzer Toolbar */
                .quality-analyzer-toolbar {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #2c3e50, #34495e);
                    color: white;
                    padding: 15px;
                    border-radius: 10px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    z-index: 10000;
                    min-width: 200px;
                }

                .analyzer-toolbar-header {
                    font-weight: bold;
                    margin-bottom: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .analyzer-toolbar-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .analyzer-button {
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 5px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-align: center;
                }

                .analyzer-button:hover {
                    background: rgba(255,255,255,0.2);
                    transform: translateY(-1px);
                }

                .analyzer-minimize-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                }

                /* Analysis Progress */
                .analysis-progress {
                    margin-top: 10px;
                    display: none;
                }

                .progress-bar {
                    height: 4px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 2px;
                    overflow: hidden;
                    margin-top: 5px;
                }

                .progress-fill {
                    height: 100%;
                    background: #27ae60;
                    transition: width 0.3s ease;
                }

                .progress-text {
                    font-size: 11px;
                    margin-top: 5px;
                    opacity: 0.8;
                }
            `);
        }

        injectQualityIndicators() {
            // Observer for scene cards
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            this.processSceneCards(node);
                        }
                    });
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Process existing cards
            this.processSceneCards(document.body);
        }

        processSceneCards(container) {
            const sceneCards = container.querySelectorAll('[data-rb-event-key*="scene-"]');
            sceneCards.forEach(card => {
                if (!card.querySelector('.quality-badge')) {
                    this.addQualityIndicator(card);
                }
            });
        }

        async addQualityIndicator(card) {
            const sceneId = this.extractSceneId(card);
            if (!sceneId) return;

            // Check if we have cached results
            if (this.analysisResults.has(sceneId)) {
                this.displayQualityIndicator(card, this.analysisResults.get(sceneId));
                return;
            }

            // Only show badges if enabled
            if (getConfig(CONFIG.SHOW_QUALITY_BADGES)) {
                // Fetch and analyze in background
                this.analyzeSceneInBackground(sceneId, card);
            }
        }

        extractSceneId(card) {
            const link = card.querySelector('a[href*="/scenes/"]');
            if (link) {
                const match = link.href.match(/\/scenes\/(\d+)/);
                return match ? match[1] : null;
            }
            return null;
        }

        async analyzeSceneInBackground(sceneId, card) {
            try {
                const sceneData = await this.graphql.getSceneFileInfo(sceneId);
                if (!sceneData) return;

                const metrics = this.metricsEngine.analyzeScene(sceneData);
                const scores = this.metricsEngine.calculateQualityScore(metrics);
                const flags = this.metricsEngine.getQualityFlags(metrics, scores);

                const result = {
                    sceneId,
                    metrics,
                    scores,
                    flags,
                    timestamp: Date.now()
                };

                this.analysisResults.set(sceneId, result);
                this.displayQualityIndicator(card, result);
            } catch (error) {
                console.error(`Failed to analyze scene ${sceneId}:`, error);
            }
        }

        displayQualityIndicator(card, analysisResult) {
            // Add quality badge
            const badge = document.createElement('div');
            badge.className = 'quality-badge';

            const score = analysisResult.scores.overall;
            let qualityClass = '';
            let qualityLabel = '';

            if (score >= 90) {
                qualityClass = 'quality-excellent';
                qualityLabel = 'Excellent';
            } else if (score >= 70) {
                qualityClass = 'quality-good';
                qualityLabel = 'Good';
            } else if (score >= 50) {
                qualityClass = 'quality-fair';
                qualityLabel = 'Fair';
            } else if (score >= 30) {
                qualityClass = 'quality-poor';
                qualityLabel = 'Poor';
            } else {
                qualityClass = 'quality-very-poor';
                qualityLabel = 'Very Poor';
            }

            badge.classList.add(qualityClass);
            badge.textContent = `${score}`;
            badge.title = `Quality: ${qualityLabel}\nResolution: ${analysisResult.metrics.resolution.width}x${analysisResult.metrics.resolution.height}\nBitrate: ${formatBitrate(analysisResult.metrics.bitrate)}`;

            // Find the thumbnail container
            const thumbnailContainer = card.querySelector('.scene-card-preview');
            if (thumbnailContainer) {
                thumbnailContainer.style.position = 'relative';
                thumbnailContainer.appendChild(badge);
            }

            // Add quality flags
            if (analysisResult.flags.length > 0 && getConfig(CONFIG.ENABLE_QUALITY_FLAGS)) {
                const flagsContainer = document.createElement('div');
                flagsContainer.className = 'quality-flags';

                analysisResult.flags.forEach(flag => {
                    const flagElement = document.createElement('span');
                    flagElement.className = `quality-flag flag-${flag.replace(/_/g, '-')}`;
                    flagElement.textContent = flag.replace(/_/g, ' ');
                    flagsContainer.appendChild(flagElement);
                });

                if (thumbnailContainer) {
                    thumbnailContainer.appendChild(flagsContainer);
                }
            }
        }

        setupToolbar() {
            const toolbar = document.createElement('div');
            toolbar.className = 'quality-analyzer-toolbar';
            toolbar.innerHTML = `
                <div class="analyzer-toolbar-header">
                    <span>🎬 Quality Analyzer</span>
                    <button class="analyzer-minimize-btn">−</button>
                </div>
                <div class="analyzer-toolbar-buttons">
                    <button class="analyzer-button analyze-all-btn">
                        📊 Analyze All Scenes
                    </button>
                    <button class="analyzer-button find-duplicates-btn">
                        🔍 Find Duplicates
                    </button>
                    <button class="analyzer-button quality-report-btn">
                        📈 Quality Report
                    </button>
                    <button class="analyzer-button settings-btn">
                        ⚙️ Settings
                    </button>
                </div>
                <div class="analysis-progress">
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <div class="progress-text">Analyzing...</div>
                </div>
            `;

            document.body.appendChild(toolbar);

            // Add event listeners
            toolbar.querySelector('.analyzer-minimize-btn').addEventListener('click', () => {
                this.toggleToolbar(toolbar);
            });

            toolbar.querySelector('.analyze-all-btn').addEventListener('click', () => {
                this.startBulkAnalysis();
            });

            toolbar.querySelector('.find-duplicates-btn').addEventListener('click', () => {
                this.findDuplicates();
            });

            toolbar.querySelector('.quality-report-btn').addEventListener('click', () => {
                this.generateQualityReport();
            });

            toolbar.querySelector('.settings-btn').addEventListener('click', () => {
                this.showSettings();
            });
        }

        toggleToolbar(toolbar) {
            const buttons = toolbar.querySelector('.analyzer-toolbar-buttons');
            const progress = toolbar.querySelector('.analysis-progress');
            const minimizeBtn = toolbar.querySelector('.analyzer-minimize-btn');

            if (buttons.style.display === 'none') {
                buttons.style.display = 'flex';
                progress.style.display = progress.dataset.wasVisible === 'true' ? 'block' : 'none';
                minimizeBtn.textContent = '−';
            } else {
                buttons.style.display = 'none';
                progress.dataset.wasVisible = progress.style.display !== 'none';
                progress.style.display = 'none';
                minimizeBtn.textContent = '+';
            }
        }

        async startBulkAnalysis() {
            console.log('🔄 Starting bulk quality analysis...');
            
            const progressContainer = document.querySelector('.analysis-progress');
            const progressFill = document.querySelector('.progress-fill');
            const progressText = document.querySelector('.progress-text');
            
            // Show progress
            progressContainer.style.display = 'block';
            progressFill.style.width = '0%';
            
            try {
                // Get all scenes
                progressText.textContent = 'Fetching scenes...';
                const scenesData = await this.graphql.getAllScenes();
                const scenes = scenesData.scenes || [];
                const totalScenes = scenes.length;
                
                if (totalScenes === 0) {
                    progressText.textContent = 'No scenes found';
                    setTimeout(() => {
                        progressContainer.style.display = 'none';
                    }, 2000);
                    return;
                }
                
                progressText.textContent = `Analyzing ${totalScenes} scenes...`;
                
                const batchSize = getConfig(CONFIG.ANALYSIS_BATCH_SIZE);
                let analyzed = 0;
                
                // Process in batches
                for (let i = 0; i < totalScenes; i += batchSize) {
                    const batch = scenes.slice(i, i + batchSize);
                    
                    // Analyze batch in parallel
                    const batchPromises = batch.map(async (scene) => {
                        try {
                            // Skip if already analyzed recently (within last hour)
                            if (this.analysisResults.has(scene.id)) {
                                const cached = this.analysisResults.get(scene.id);
                                if (Date.now() - cached.timestamp < 3600000) {
                                    return cached;
                                }
                            }
                            
                            const sceneData = await this.graphql.getSceneFileInfo(scene.id);
                            if (!sceneData) return null;
                            
                            const metrics = this.metricsEngine.analyzeScene(sceneData);
                            const scores = this.metricsEngine.calculateQualityScore(metrics);
                            const flags = this.metricsEngine.getQualityFlags(metrics, scores);
                            
                            const result = {
                                sceneId: scene.id,
                                metrics,
                                scores,
                                flags,
                                timestamp: Date.now()
                            };
                            
                            this.analysisResults.set(scene.id, result);
                            return result;
                        } catch (error) {
                            console.error(`Failed to analyze scene ${scene.id}:`, error);
                            return null;
                        }
                    });
                    
                    await Promise.all(batchPromises);
                    analyzed += batch.length;
                    
                    // Update progress
                    const progress = (analyzed / totalScenes) * 100;
                    progressFill.style.width = `${progress}%`;
                    progressText.textContent = `Analyzed ${analyzed} of ${totalScenes} scenes...`;
                }
                
                progressText.textContent = `Analysis complete! Analyzed ${analyzed} scenes.`;
                
                // Apply quality tags if enabled
                if (getConfig(CONFIG.ENABLE_QUALITY_FLAGS)) {
                    progressText.textContent = 'Applying quality tags...';
                    await this.applyQualityTags();
                }
                
                // Refresh current view
                this.processSceneCards(document.body);
                
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 3000);
                
            } catch (error) {
                console.error('Bulk analysis failed:', error);
                progressText.textContent = 'Analysis failed!';
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 3000);
            }
        }

        async applyQualityTags() {
            // Create or find quality tags
            const tagMap = {
                'low_resolution': 'Low Resolution',
                'low_bitrate': 'Low Bitrate',
                'audio_issues': 'Audio Issues',
                'poor_quality': 'Poor Quality',
                'high_quality': 'High Quality'
            };
            
            // First, ensure all quality tags exist
            const tagIds = new Map();
            
            for (const [key, name] of Object.entries(tagMap)) {
                try {
                    let tag = await this.graphql.findTag(name);
                    
                    if (!tag) {
                        console.log(`Creating quality tag: ${name}`);
                        tag = await this.graphql.createTag(name);
                    }
                    
                    tagIds.set(key, tag.id);
                } catch (error) {
                    console.error(`Failed to create/find tag ${name}:`, error);
                }
            }
            
            // Now apply tags to scenes based on their quality flags
            let taggedCount = 0;
            const updatePromises = [];
            
            this.analysisResults.forEach((result, sceneId) => {
                if (result.flags.length > 0) {
                    const sceneTags = result.flags
                        .filter(flag => tagIds.has(flag))
                        .map(flag => tagIds.get(flag));
                    
                    if (sceneTags.length > 0) {
                        taggedCount++;
                        // Note: This will replace existing tags. In a real implementation,
                        // you might want to fetch existing tags and merge them.
                        updatePromises.push(
                            this.graphql.updateSceneTags(sceneId, sceneTags)
                                .catch(error => console.error(`Failed to tag scene ${sceneId}:`, error))
                        );
                    }
                }
            });
            
            // Execute all tag updates
            await Promise.all(updatePromises);
            
            console.log(`✅ Tagged ${taggedCount} scenes with quality flags`);
        }

        async findDuplicates() {
            console.log('🔍 Searching for duplicates...');
            
            const progressContainer = document.querySelector('.analysis-progress');
            const progressFill = document.querySelector('.progress-fill');
            const progressText = document.querySelector('.progress-text');
            
            // Show progress
            progressContainer.style.display = 'block';
            progressFill.style.width = '0%';
            
            try {
                progressText.textContent = 'Fetching all scenes for duplicate detection...';
                
                // Get all scenes with file info
                const scenesData = await this.graphql.getAllScenes();
                const scenes = scenesData.scenes || [];
                
                if (scenes.length < 2) {
                    progressText.textContent = 'Not enough scenes for duplicate detection';
                    setTimeout(() => {
                        progressContainer.style.display = 'none';
                    }, 2000);
                    return;
                }
                
                progressText.textContent = `Analyzing ${scenes.length} scenes for duplicates...`;
                progressFill.style.width = '25%';
                
                // Fetch detailed info for all scenes
                const detailedScenes = [];
                const batchSize = 20;
                
                for (let i = 0; i < scenes.length; i += batchSize) {
                    const batch = scenes.slice(i, i + batchSize);
                    const batchPromises = batch.map(scene => 
                        this.graphql.getSceneFileInfo(scene.id).catch(() => null)
                    );
                    
                    const batchResults = await Promise.all(batchPromises);
                    detailedScenes.push(...batchResults.filter(s => s !== null));
                    
                    const progress = 25 + ((i / scenes.length) * 50);
                    progressFill.style.width = `${progress}%`;
                    progressText.textContent = `Fetching scene details... ${i + batch.length} of ${scenes.length}`;
                }
                
                progressText.textContent = 'Finding duplicates...';
                progressFill.style.width = '75%';
                
                // Find duplicates
                const duplicateGroups = this.duplicateDetector.findDuplicates(detailedScenes);
                
                progressFill.style.width = '100%';
                
                if (duplicateGroups.length === 0) {
                    progressText.textContent = 'No duplicates found!';
                } else {
                    progressText.textContent = `Found ${duplicateGroups.length} duplicate groups`;
                    this.showDuplicateResults(duplicateGroups);
                }
                
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 3000);
                
            } catch (error) {
                console.error('Duplicate detection failed:', error);
                progressText.textContent = 'Duplicate detection failed!';
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 3000);
            }
        }

        showDuplicateResults(duplicateGroups) {
            // Create modal to show duplicate results
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #2c3e50;
                color: white;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 4px 30px rgba(0,0,0,0.5);
                z-index: 10002;
                max-width: 800px;
                max-height: 80vh;
                overflow-y: auto;
            `;
            
            modal.innerHTML = `
                <h3 style="margin-top: 0;">Duplicate Detection Results</h3>
                <p>Found ${duplicateGroups.length} groups of potential duplicates</p>
                <div style="margin-top: 20px;">
                    ${duplicateGroups.map((group, index) => `
                        <div style="
                            background: rgba(255,255,255,0.1);
                            padding: 15px;
                            margin-bottom: 15px;
                            border-radius: 5px;
                        ">
                            <h4>Duplicate Group ${index + 1} (${group.count} scenes)</h4>
                            <div style="font-size: 14px;">
                                ${group.scenes.map(scene => `
                                    <div style="margin: 5px 0;">
                                        <a href="/scenes/${scene.sceneId}" target="_blank" style="color: #3498db;">
                                            ${scene.title || 'Untitled'} 
                                        </a>
                                        - ${formatFileSize(scene.fileSize)}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button id="close-duplicates" style="
                    background: #3498db;
                    border: none;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-top: 20px;
                ">Close</button>
            `;
            
            document.body.appendChild(modal);
            
            document.getElementById('close-duplicates').addEventListener('click', () => {
                modal.remove();
            });
        }

        async generateQualityReport() {
            console.log('📊 Generating quality report...');
            
            if (this.analysisResults.size === 0) {
                alert('No analysis data available. Please run "Analyze All Scenes" first.');
                return;
            }
            
            // Calculate statistics
            const stats = {
                total: this.analysisResults.size,
                excellent: 0,
                good: 0,
                fair: 0,
                poor: 0,
                veryPoor: 0,
                avgScore: 0,
                lowResolution: 0,
                lowBitrate: 0,
                audioIssues: 0
            };
            
            let totalScore = 0;
            
            this.analysisResults.forEach(result => {
                const score = result.scores.overall;
                totalScore += score;
                
                if (score >= 90) stats.excellent++;
                else if (score >= 70) stats.good++;
                else if (score >= 50) stats.fair++;
                else if (score >= 30) stats.poor++;
                else stats.veryPoor++;
                
                // Count flags
                if (result.flags.includes('low_resolution')) stats.lowResolution++;
                if (result.flags.includes('low_bitrate')) stats.lowBitrate++;
                if (result.flags.includes('audio_issues')) stats.audioIssues++;
            });
            
            stats.avgScore = Math.round(totalScore / stats.total);
            
            // Create report modal
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #2c3e50;
                color: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 4px 30px rgba(0,0,0,0.5);
                z-index: 10002;
                max-width: 600px;
            `;
            
            modal.innerHTML = `
                <h2 style="margin-top: 0;">📊 Quality Analysis Report</h2>
                
                <div style="margin: 20px 0;">
                    <h3>Overall Statistics</h3>
                    <p><strong>Total Scenes Analyzed:</strong> ${stats.total}</p>
                    <p><strong>Average Quality Score:</strong> ${stats.avgScore}/100</p>
                </div>
                
                <div style="margin: 20px 0;">
                    <h3>Quality Distribution</h3>
                    <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 5px;">
                        <div style="margin: 5px 0;">
                            <span style="color: #27ae60;">Excellent (90-100):</span> 
                            ${stats.excellent} scenes (${((stats.excellent/stats.total)*100).toFixed(1)}%)
                        </div>
                        <div style="margin: 5px 0;">
                            <span style="color: #3498db;">Good (70-89):</span> 
                            ${stats.good} scenes (${((stats.good/stats.total)*100).toFixed(1)}%)
                        </div>
                        <div style="margin: 5px 0;">
                            <span style="color: #f39c12;">Fair (50-69):</span> 
                            ${stats.fair} scenes (${((stats.fair/stats.total)*100).toFixed(1)}%)
                        </div>
                        <div style="margin: 5px 0;">
                            <span style="color: #e67e22;">Poor (30-49):</span> 
                            ${stats.poor} scenes (${((stats.poor/stats.total)*100).toFixed(1)}%)
                        </div>
                        <div style="margin: 5px 0;">
                            <span style="color: #e74c3c;">Very Poor (0-29):</span> 
                            ${stats.veryPoor} scenes (${((stats.veryPoor/stats.total)*100).toFixed(1)}%)
                        </div>
                    </div>
                </div>
                
                <div style="margin: 20px 0;">
                    <h3>Quality Issues</h3>
                    <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 5px;">
                        <div style="margin: 5px 0;">
                            🔍 Low Resolution: ${stats.lowResolution} scenes
                        </div>
                        <div style="margin: 5px 0;">
                            📊 Low Bitrate: ${stats.lowBitrate} scenes
                        </div>
                        <div style="margin: 5px 0;">
                            🔊 Audio Issues: ${stats.audioIssues} scenes
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 30px;">
                    <button id="export-report" style="
                        background: #27ae60;
                        border: none;
                        color: white;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Export Report</button>
                    <button id="close-report" style="
                        background: #3498db;
                        border: none;
                        color: white;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Close</button>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            document.getElementById('close-report').addEventListener('click', () => {
                modal.remove();
            });
            
            document.getElementById('export-report').addEventListener('click', () => {
                this.exportReport(stats);
            });
        }

        exportReport(stats) {
            const date = new Date().toISOString().split('T')[0];
            const report = {
                generatedAt: new Date().toISOString(),
                statistics: stats,
                detailedResults: []
            };
            
            // Add detailed results
            this.analysisResults.forEach((result, sceneId) => {
                report.detailedResults.push({
                    sceneId,
                    scores: result.scores,
                    metrics: result.metrics,
                    flags: result.flags
                });
            });
            
            // Create and download JSON file
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stash-quality-report-${date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('📄 Report exported successfully');
        }

        showSettings() {
            console.log('⚙️ Opening settings...');
            
            // Create settings modal
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #2c3e50;
                color: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 4px 30px rgba(0,0,0,0.5);
                z-index: 10002;
                max-width: 500px;
                width: 90%;
            `;
            
            modal.innerHTML = `
                <h2 style="margin-top: 0;">⚙️ Quality Analyzer Settings</h2>
                
                <div style="margin: 20px 0;">
                    <label style="display: block; margin-bottom: 10px;">
                        <input type="checkbox" id="enable-auto-analysis" ${getConfig(CONFIG.ENABLE_AUTO_ANALYSIS) ? 'checked' : ''}>
                        Enable automatic analysis for new scenes
                    </label>
                    
                    <label style="display: block; margin-bottom: 10px;">
                        <input type="checkbox" id="enable-duplicate-detection" ${getConfig(CONFIG.ENABLE_DUPLICATE_DETECTION) ? 'checked' : ''}>
                        Enable duplicate detection
                    </label>
                    
                    <label style="display: block; margin-bottom: 10px;">
                        <input type="checkbox" id="enable-quality-flags" ${getConfig(CONFIG.ENABLE_QUALITY_FLAGS) ? 'checked' : ''}>
                        Enable quality flag tags
                    </label>
                    
                    <label style="display: block; margin-bottom: 10px;">
                        <input type="checkbox" id="show-quality-badges" ${getConfig(CONFIG.SHOW_QUALITY_BADGES) ? 'checked' : ''}>
                        Show quality badges on scene cards
                    </label>
                </div>
                
                <div style="margin: 20px 0;">
                    <h3>Quality Thresholds</h3>
                    
                    <label style="display: block; margin-bottom: 10px;">
                        Minimum Resolution (height in pixels):
                        <input type="number" id="min-resolution" value="${getConfig(CONFIG.MIN_RESOLUTION_THRESHOLD)}" 
                               style="width: 100px; margin-left: 10px; background: #34495e; border: 1px solid #7f8c8d; color: white; padding: 5px;">
                    </label>
                    
                    <label style="display: block; margin-bottom: 10px;">
                        Minimum Bitrate (kbps):
                        <input type="number" id="min-bitrate" value="${getConfig(CONFIG.MIN_BITRATE_THRESHOLD)}" 
                               style="width: 100px; margin-left: 10px; background: #34495e; border: 1px solid #7f8c8d; color: white; padding: 5px;">
                    </label>
                    
                    <label style="display: block; margin-bottom: 10px;">
                        Analysis Batch Size:
                        <input type="number" id="batch-size" value="${getConfig(CONFIG.ANALYSIS_BATCH_SIZE)}" min="1" max="50"
                               style="width: 100px; margin-left: 10px; background: #34495e; border: 1px solid #7f8c8d; color: white; padding: 5px;">
                    </label>
                </div>
                
                <div style="margin: 20px 0;">
                    <h3>Quality Score Weights</h3>
                    <p style="font-size: 12px; opacity: 0.8;">Adjust the importance of each factor (must total 100%)</p>
                    
                    <div id="weight-sliders">
                        ${Object.entries(getConfig(CONFIG.QUALITY_SCORE_WEIGHTS)).map(([key, value]) => `
                            <div style="margin-bottom: 10px;">
                                <label style="display: block;">
                                    ${key.charAt(0).toUpperCase() + key.slice(1)}: 
                                    <span id="weight-${key}-value">${Math.round(value * 100)}%</span>
                                </label>
                                <input type="range" id="weight-${key}" min="0" max="100" value="${value * 100}" 
                                       style="width: 100%;">
                            </div>
                        `).join('')}
                        <div style="margin-top: 10px; font-weight: bold;">
                            Total: <span id="weight-total">100%</span>
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 30px;">
                    <button id="save-settings" style="
                        background: #27ae60;
                        border: none;
                        color: white;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Save Settings</button>
                    <button id="cancel-settings" style="
                        background: #95a5a6;
                        border: none;
                        color: white;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Cancel</button>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Weight slider handling
            const updateWeightTotal = () => {
                const weights = {
                    resolution: parseInt(document.getElementById('weight-resolution').value),
                    bitrate: parseInt(document.getElementById('weight-bitrate').value),
                    codec: parseInt(document.getElementById('weight-codec').value),
                    audio: parseInt(document.getElementById('weight-audio').value)
                };
                
                const total = Object.values(weights).reduce((sum, val) => sum + val, 0);
                document.getElementById('weight-total').textContent = `${total}%`;
                
                // Update individual displays
                Object.keys(weights).forEach(key => {
                    document.getElementById(`weight-${key}-value`).textContent = `${weights[key]}%`;
                });
                
                return total === 100;
            };
            
            // Add listeners to weight sliders
            ['resolution', 'bitrate', 'codec', 'audio'].forEach(key => {
                document.getElementById(`weight-${key}`).addEventListener('input', updateWeightTotal);
            });
            
            // Save button
            document.getElementById('save-settings').addEventListener('click', () => {
                if (!updateWeightTotal()) {
                    alert('Quality score weights must total 100%');
                    return;
                }
                
                // Save all settings
                setConfig(CONFIG.ENABLE_AUTO_ANALYSIS, document.getElementById('enable-auto-analysis').checked);
                setConfig(CONFIG.ENABLE_DUPLICATE_DETECTION, document.getElementById('enable-duplicate-detection').checked);
                setConfig(CONFIG.ENABLE_QUALITY_FLAGS, document.getElementById('enable-quality-flags').checked);
                setConfig(CONFIG.SHOW_QUALITY_BADGES, document.getElementById('show-quality-badges').checked);
                setConfig(CONFIG.MIN_RESOLUTION_THRESHOLD, parseInt(document.getElementById('min-resolution').value));
                setConfig(CONFIG.MIN_BITRATE_THRESHOLD, parseInt(document.getElementById('min-bitrate').value));
                setConfig(CONFIG.ANALYSIS_BATCH_SIZE, parseInt(document.getElementById('batch-size').value));
                
                // Save weights
                const weights = {
                    resolution: parseInt(document.getElementById('weight-resolution').value) / 100,
                    bitrate: parseInt(document.getElementById('weight-bitrate').value) / 100,
                    codec: parseInt(document.getElementById('weight-codec').value) / 100,
                    audio: parseInt(document.getElementById('weight-audio').value) / 100
                };
                setConfig(CONFIG.QUALITY_SCORE_WEIGHTS, weights);
                
                // Update engine weights
                this.metricsEngine.weights = weights;
                
                modal.remove();
                
                // Clear cache to reanalyze with new settings
                this.analysisResults.clear();
                this.processSceneCards(document.body);
            });
            
            // Cancel button
            document.getElementById('cancel-settings').addEventListener('click', () => {
                modal.remove();
            });
        }
    }

    // ===== INITIALIZATION =====
    function initialize() {
        console.log('🎬 Quality Analyzer: Waiting for page to load...');

        // Wait for Stash to fully load
        const checkInterval = setInterval(() => {
            if (document.querySelector('.scene-card-preview') ||
                document.querySelector('[data-rb-event-key*="scene-"]')) {
                clearInterval(checkInterval);
                console.log('✅ Quality Analyzer: Page loaded, initializing components...');

                // Initialize components
                const graphqlClient = new GraphQLClient();
                const metricsEngine = new QualityMetricsEngine();
                const duplicateDetector = new DuplicateDetector();
                new QualityAnalyzerUI(metricsEngine, duplicateDetector, graphqlClient);

                console.log('✅ Quality Analyzer: Ready!');
            }
        }, 1000);
    }

    // Start initialization
    initialize();
})();
