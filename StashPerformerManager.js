// ==UserScript==
// @name         Stash Performer Manager Pro
// @namespace    https://github.com/example/stash-userscripts
// @version      1.1.2
// @description  Advanced performer management with enhanced search, social media integration, and comprehensive statistics
// @author       Your Name
// @match        http://localhost:9998/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      localhost
// @connect      stashdb.org
// @connect      twitter.com
// @connect      instagram.com
// @connect      onlyfans.com
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        // Search Settings
        FUZZY_MATCH_THRESHOLD: 0.7,
        SEARCH_DEBOUNCE_DELAY: 300,
        MAX_SEARCH_RESULTS: 100,
        
        // Image Settings
        MIN_IMAGE_QUALITY: 0.6,
        IMAGE_ANALYSIS_TIMEOUT: 5000,
        BULK_UPLOAD_BATCH_SIZE: 10,
        
        // Social Media Settings
        SOCIAL_MEDIA_CACHE_TIME: 86400000, // 24 hours
        SOCIAL_MEDIA_RATE_LIMIT: 100, // requests per hour
        
        // Statistics Settings
        STATS_UPDATE_INTERVAL: 300000, // 5 minutes
        POPULARITY_ALGORITHM: 'weighted', // 'simple' or 'weighted'
        
        // UI Settings
        ENABLE_ANIMATIONS: true,
        COMPACT_MODE: false,
        DARK_THEME: true,
        
        // Storage Keys
        FILTERS_KEY: 'performer_manager_filters',
        CACHE_KEY: 'performer_manager_cache',
        SETTINGS_KEY: 'performer_manager_settings'
    };

    // ===== UTILITIES =====
    const Utils = {
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
        },

        async sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        calculateLevenshteinDistance(str1, str2) {
            const matrix = [];
            for (let i = 0; i <= str2.length; i++) {
                matrix[i] = [i];
            }
            for (let j = 0; j <= str1.length; j++) {
                matrix[0][j] = j;
            }
            for (let i = 1; i <= str2.length; i++) {
                for (let j = 1; j <= str1.length; j++) {
                    if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(
                            matrix[i - 1][j - 1] + 1,
                            matrix[i][j - 1] + 1,
                            matrix[i - 1][j] + 1
                        );
                    }
                }
            }
            return matrix[str2.length][str1.length];
        },

        fuzzyMatch(str1, str2, threshold = CONFIG.FUZZY_MATCH_THRESHOLD) {
            const maxLength = Math.max(str1.length, str2.length);
            const distance = this.calculateLevenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
            const similarity = 1 - (distance / maxLength);
            return similarity >= threshold;
        },

        formatDuration(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        },

        generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    };

    // ===== GRAPHQL CLIENT =====
    class GraphQLClient {
        constructor() {
            this.endpoint = '/graphql';
        }

        async query(query, variables = {}) {
            try {
                // Log the query for debugging
                console.log('🔍 GraphQL Query:', query.substring(0, 200) + '...');
                
                const response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ query, variables })
                });

                const data = await response.json();
                if (data.errors) {
                    console.error('GraphQL errors:', data.errors);
                    console.error('Failed query was:', query);
                    throw new Error(data.errors[0].message);
                }

                return data.data;
            } catch (error) {
                console.error('GraphQL query failed:', error);
                console.error('Failed query was:', query);
                throw error;
            }
        }

        // Performer Queries
        async getPerformers(filter = {}) {
            const query = `
                query FindPerformers($filter: FindFilterType) {
                    findPerformers(filter: $filter) {
                        count
                        performers {
                            id
                            name
                            birthdate
                            image_path
                            scene_count
                            rating100
                            details
                            tags {
                                id
                                name
                            }
                        }
                    }
                }
            `;
            // Ensure we always have a filter with at least per_page
            const finalFilter = {
                per_page: 500,
                ...filter
            };
            return this.query(query, { filter: finalFilter });
        }

        async getPerformer(id) {
            const query = `
                query FindPerformer($id: ID!) {
                    findPerformer(id: $id) {
                        id
                        name
                        birthdate
                        death_date
                        image_path
                        measurements
                        height_cm
                        ethnicity
                        country
                        eye_color
                        hair_color
                        fake_tits
                        career_length
                        tattoos
                        piercings
                        details
                        url
                        scene_count
                        scenes {
                            id
                            title
                            date
                            rating100
                            paths {
                                screenshot
                            }
                        }
                        tags {
                            id
                            name
                        }
                    }
                }
            `;
            return this.query(query, { id });
        }

        async getPerformerScenes(performerId) {
            const query = `
                query FindScenes($performer_id: [ID!]) {
                    findScenes(scene_filter: { performers: { value: $performer_id, modifier: INCLUDES } }) {
                        count
                        scenes {
                            id
                            title
                            date
                            rating100
                            o_counter
                            paths {
                                screenshot
                            }
                            performers {
                                id
                                name
                            }
                        }
                    }
                }
            `;
            return this.query(query, { performer_id: [performerId] });
        }

        async updatePerformer(input) {
            const mutation = `
                mutation PerformerUpdate($input: PerformerUpdateInput!) {
                    performerUpdate(input: $input) {
                        id
                        name
                    }
                }
            `;
            return this.query(mutation, { input });
        }
    }

    // ===== FUZZY MATCHER =====
    class FuzzyMatcher {
        constructor() {
            this.cache = new Map();
        }

        search(query, performers, threshold = CONFIG.FUZZY_MATCH_THRESHOLD) {
            if (!query) return performers;

            const cacheKey = `${query}_${threshold}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const results = performers
                .map(performer => ({
                    performer,
                    score: this.calculateScore(query, performer)
                }))
                .filter(result => result.score >= threshold)
                .sort((a, b) => b.score - a.score)
                .map(result => result.performer);

            this.cache.set(cacheKey, results);
            return results;
        }

        calculateScore(query, performer) {
            const queryLower = query.toLowerCase();
            const nameLower = performer.name.toLowerCase();
            
            // Exact match
            if (nameLower === queryLower) return 1.0;
            
            // Starts with
            if (nameLower.startsWith(queryLower)) return 0.9;
            
            // Contains
            if (nameLower.includes(queryLower)) return 0.8;
            
            // Note: aliases field removed as it's not available in Stash GraphQL schema
            
            // Fuzzy match
            return 1 - (Utils.calculateLevenshteinDistance(queryLower, nameLower) / Math.max(queryLower.length, nameLower.length));
        }

        clearCache() {
            this.cache.clear();
        }
    }

    // ===== PERFORMER SEARCH ENGINE =====
    class PerformerSearchEngine {
        constructor(graphqlClient) {
            this.graphql = graphqlClient;
            this.fuzzyMatcher = new FuzzyMatcher();
            this.filters = new Map();
            this.loadFilters();
        }

        async search(query, options = {}) {
            try {
                // Build filter with search query if provided
                const stashFilter = this.buildStashFilter();
                if (query) {
                    stashFilter.q = query;
                }
                
                const data = await this.graphql.getPerformers(stashFilter);
                let performers = data.findPerformers.performers;

                // Apply additional fuzzy matching if query provided for better results
                if (query) {
                    performers = this.fuzzyMatcher.search(query, performers);
                }

                // Apply additional filters
                performers = this.applyAdvancedFilters(performers);

                // Sort results
                performers = this.sortResults(performers, options.sortBy || 'relevance');

                // Limit results
                if (options.limit) {
                    performers = performers.slice(0, options.limit);
                }

                return {
                    results: performers,
                    total: performers.length,
                    query,
                    filters: Array.from(this.filters.entries())
                };
            } catch (error) {
                console.error('Search error:', error);
                return { results: [], total: 0, error: error.message };
            }
        }

        buildStashFilter() {
            const filter = {
                per_page: 500
            };
            
            // For now, we'll use a simple query-based approach
            // since FindFilterType doesn't support the same filters as PerformerFilterType
            // We'll apply filters after fetching the performers
            
            return filter;
        }

        applyAdvancedFilters(performers) {
            let filtered = [...performers];
            
            for (const [key, value] of this.filters) {
                switch (key) {
                    case 'age_range':
                        filtered = filtered.filter(p => {
                            if (!p.birthdate) return false;
                            const age = this.calculateAge(p.birthdate);
                            return age >= value.min && age <= value.max;
                        });
                        break;
                    case 'has_image':
                        if (value) {
                            filtered = filtered.filter(p => p.image_path);
                        }
                        break;
                    case 'rating':
                        filtered = filtered.filter(p => {
                            const rating = p.rating100 || 0;
                            return rating >= value.min;
                        });
                        break;
                    case 'scene_count':
                        filtered = filtered.filter(p => {
                            const count = p.scene_count || 0;
                            return count >= value.min && count <= (value.max || 999999);
                        });
                        break;
                    case 'last_activity':
                        // Would need scene data to implement
                        break;
                }
            }
            
            return filtered;
        }

        sortResults(performers, sortBy) {
            switch (sortBy) {
                case 'name':
                    return performers.sort((a, b) => a.name.localeCompare(b.name));
                case 'scene_count':
                    return performers.sort((a, b) => (b.scene_count || 0) - (a.scene_count || 0));
                case 'rating':
                    return performers.sort((a, b) => (b.rating100 || 0) - (a.rating100 || 0));
                case 'relevance':
                default:
                    return performers; // Already sorted by fuzzy match score
            }
        }

        addFilter(type, criteria) {
            this.filters.set(type, criteria);
            this.saveFilters();
            this.fuzzyMatcher.clearCache();
        }

        removeFilter(type) {
            this.filters.delete(type);
            this.saveFilters();
            this.fuzzyMatcher.clearCache();
        }

        clearFilters() {
            this.filters.clear();
            this.saveFilters();
            this.fuzzyMatcher.clearCache();
        }

        getActiveFilters() {
            return Array.from(this.filters.entries());
        }

        saveFilters() {
            GM_setValue(CONFIG.FILTERS_KEY, JSON.stringify(Array.from(this.filters)));
        }

        loadFilters() {
            try {
                const saved = GM_getValue(CONFIG.FILTERS_KEY);
                if (saved) {
                    this.filters = new Map(JSON.parse(saved));
                }
            } catch (error) {
                console.error('Failed to load filters:', error);
            }
        }

        calculateAge(birthdate) {
            const today = new Date();
            const birth = new Date(birthdate);
            let age = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
            return age;
        }
    }

    // ===== IMAGE MANAGER =====
    class PerformerImageManager {
        constructor(graphqlClient) {
            this.graphql = graphqlClient;
            this.imageCache = new Map();
        }

        async analyzeImageQuality(imageUrl) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                const timeout = setTimeout(() => {
                    reject(new Error('Image analysis timeout'));
                }, CONFIG.IMAGE_ANALYSIS_TIMEOUT);

                img.onload = () => {
                    clearTimeout(timeout);
                    const quality = this.assessQuality(img);
                    resolve({
                        url: imageUrl,
                        width: img.width,
                        height: img.height,
                        aspectRatio: img.width / img.height,
                        quality,
                        recommendations: this.generateRecommendations(quality)
                    });
                };

                img.onerror = () => {
                    clearTimeout(timeout);
                    reject(new Error('Failed to load image'));
                };

                img.src = imageUrl;
            });
        }

        assessQuality(img) {
            const scores = {
                resolution: this.scoreResolution(img.width, img.height),
                aspectRatio: this.scoreAspectRatio(img.width / img.height),
                fileSize: 0.7 // Default as we can't get file size from Image object
            };

            const overallQuality = (scores.resolution * 0.5 + scores.aspectRatio * 0.3 + scores.fileSize * 0.2);
            
            return {
                overall: overallQuality,
                scores,
                rating: this.getQualityRating(overallQuality)
            };
        }

        scoreResolution(width, height) {
            const pixels = width * height;
            if (pixels >= 1920 * 1080) return 1.0;  // Full HD or better
            if (pixels >= 1280 * 720) return 0.8;   // HD
            if (pixels >= 854 * 480) return 0.6;    // SD
            if (pixels >= 640 * 360) return 0.4;    // Low
            return 0.2; // Very low
        }

        scoreAspectRatio(ratio) {
            const ideal = 2/3; // Portrait orientation
            const deviation = Math.abs(ratio - ideal);
            if (deviation < 0.1) return 1.0;
            if (deviation < 0.3) return 0.8;
            if (deviation < 0.5) return 0.6;
            return 0.4;
        }

        getQualityRating(score) {
            if (score >= 0.8) return 'excellent';
            if (score >= 0.6) return 'good';
            if (score >= 0.4) return 'fair';
            if (score >= 0.2) return 'poor';
            return 'very poor';
        }

        generateRecommendations(quality) {
            const recommendations = [];
            
            if (quality.scores.resolution < 0.6) {
                recommendations.push('Consider using a higher resolution image (minimum 1280x720)');
            }
            
            if (quality.scores.aspectRatio < 0.6) {
                recommendations.push('Portrait orientation (2:3 ratio) is recommended for performer images');
            }
            
            if (quality.overall < CONFIG.MIN_IMAGE_QUALITY) {
                recommendations.push('This image does not meet the minimum quality standards');
            }
            
            return recommendations;
        }

        async suggestImagesFromScenes(performerId) {
            try {
                const data = await this.graphql.getPerformerScenes(performerId);
                const scenes = data.findScenes.scenes;
                
                // Get unique scene paths
                const suggestions = scenes
                    .filter(scene => scene.paths && scene.paths.screenshot)
                    .slice(0, 10) // Limit to 10 suggestions
                    .map(scene => ({
                        sceneId: scene.id,
                        title: scene.title,
                        // In a real implementation, we'd extract frames from the video
                        // For now, we'll just return scene info
                        thumbnailUrl: `/scene/${scene.id}/screenshot`,
                        confidence: this.calculateSuggestionConfidence(scene)
                    }));
                
                return suggestions.sort((a, b) => b.confidence - a.confidence);
            } catch (error) {
                console.error('Failed to suggest images:', error);
                return [];
            }
        }

        calculateSuggestionConfidence(scene) {
            let confidence = 0.5;
            
            // Higher rated scenes likely have better quality
            if (scene.rating100) {
                confidence += (scene.rating100 / 100) * 0.3;
            }
            
            // More recent scenes likely have better quality
            if (scene.date) {
                const age = (Date.now() - new Date(scene.date).getTime()) / (365 * 24 * 60 * 60 * 1000);
                if (age < 1) confidence += 0.2;
                else if (age < 3) confidence += 0.1;
            }
            
            return Math.min(confidence, 1.0);
        }
    }

    // ===== SOCIAL MEDIA INTEGRATOR =====
    class SocialMediaIntegrator {
        constructor() {
            this.cache = new Map();
            this.rateLimits = new Map();
        }

        validateSocialMediaLink(platform, url) {
            const validators = {
                twitter: /^https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_]+$/,
                instagram: /^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+$/,
                onlyfans: /^https?:\/\/(www\.)?onlyfans\.com\/[a-zA-Z0-9_]+$/
            };
            
            return validators[platform]?.test(url) || false;
        }

        extractUsername(platform, url) {
            if (!this.validateSocialMediaLink(platform, url)) {
                return null;
            }

            const patterns = {
                twitter: /(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/,
                instagram: /instagram\.com\/([a-zA-Z0-9_.]+)/,
                onlyfans: /onlyfans\.com\/([a-zA-Z0-9_]+)/
            };

            const match = url.match(patterns[platform]);
            return match ? match[1] : null;
        }

        async fetchBasicProfileInfo(platform, url) {
            // Check cache first
            const cacheKey = `${platform}_${url}`;
            const cached = this.cache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp < CONFIG.SOCIAL_MEDIA_CACHE_TIME)) {
                return cached.data;
            }

            // Check rate limits
            if (this.isRateLimited(platform)) {
                return { error: 'rate_limited', retryAfter: this.getRateLimitExpiry(platform) };
            }

            // In a real implementation, this would make API calls
            // For now, return mock data
            const mockData = {
                platform,
                url,
                username: this.extractUsername(platform, url),
                displayName: 'Mock User',
                isVerified: Math.random() > 0.7,
                followerCount: Math.floor(Math.random() * 100000),
                lastActivity: new Date().toISOString(),
                fetchedAt: new Date().toISOString()
            };

            // Cache the result
            this.cache.set(cacheKey, {
                data: mockData,
                timestamp: Date.now()
            });

            return mockData;
        }

        isRateLimited(platform) {
            const limit = this.rateLimits.get(platform);
            return limit && limit.count >= CONFIG.SOCIAL_MEDIA_RATE_LIMIT && Date.now() < limit.resetTime;
        }

        getRateLimitExpiry(platform) {
            const limit = this.rateLimits.get(platform);
            return limit ? Math.ceil((limit.resetTime - Date.now()) / 1000) : 0;
        }

        clearCache() {
            this.cache.clear();
        }
    }

    // ===== STATISTICS ENGINE =====
    class PerformerStatisticsEngine {
        constructor(graphqlClient) {
            this.graphql = graphqlClient;
            this.statsCache = new Map();
        }

        async generatePerformerStats(performerId) {
            // Check cache
            const cached = this.statsCache.get(performerId);
            if (cached && (Date.now() - cached.timestamp < CONFIG.STATS_UPDATE_INTERVAL)) {
                return cached.stats;
            }

            try {
                const [performerData, scenesData] = await Promise.all([
                    this.graphql.getPerformer(performerId),
                    this.graphql.getPerformerScenes(performerId)
                ]);

                const performer = performerData.findPerformer;
                const scenes = scenesData.findScenes.scenes;

                const stats = {
                    basic: {
                        sceneCount: scenes.length,
                        // Duration field not available in Stash GraphQL schema
                        totalDuration: 0,
                        averageRating: this.calculateAverageRating(scenes),
                        totalViews: scenes.reduce((sum, scene) => sum + (scene.o_counter || 0), 0)
                    },
                    popularity: this.calculatePopularityMetrics(scenes),
                    timeline: this.generateActivityTimeline(scenes),
                    collaborations: await this.analyzeCollaborations(scenes, performerId),
                    trends: this.analyzeTrends(scenes)
                };

                // Cache the stats
                this.statsCache.set(performerId, {
                    stats,
                    timestamp: Date.now()
                });

                return stats;
            } catch (error) {
                console.error('Failed to generate performer stats:', error);
                return null;
            }
        }

        calculateAverageRating(scenes) {
            const ratedScenes = scenes.filter(s => s.rating100);
            if (ratedScenes.length === 0) return 0;
            const sum = ratedScenes.reduce((total, scene) => total + scene.rating100, 0);
            return Math.round((sum / ratedScenes.length) * 10) / 10;
        }

        calculatePopularityMetrics(scenes) {
            const now = Date.now();
            const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);
            const threeMonthsAgo = now - (90 * 24 * 60 * 60 * 1000);

            const recentScenes = scenes.filter(s => s.date && new Date(s.date).getTime() > oneMonthAgo);
            const quarterScenes = scenes.filter(s => s.date && new Date(s.date).getTime() > threeMonthsAgo);

            const totalViews = scenes.reduce((sum, s) => sum + (s.o_counter || 0), 0);
            
            const metrics = {
                totalViews: totalViews,
                averageViews: scenes.length > 0 ? Math.round(totalViews / scenes.length) : 0,
                recentActivity: recentScenes.length,
                quarterlyActivity: quarterScenes.length,
                popularityScore: 0
            };

            // Calculate popularity score
            if (CONFIG.POPULARITY_ALGORITHM === 'weighted') {
                metrics.popularityScore = this.calculateWeightedPopularity(scenes, metrics);
            } else {
                metrics.popularityScore = Math.round((metrics.totalViews / Math.max(scenes.length, 1)) * 10);
            }

            return metrics;
        }

        calculateWeightedPopularity(scenes, metrics) {
            const factors = {
                viewsPerScene: Math.min(metrics.averageViews / 100, 10) * 0.3,
                recentActivity: Math.min(metrics.recentActivity / 5, 10) * 0.3,
                consistency: Math.min(scenes.length / 50, 10) * 0.2,
                rating: (this.calculateAverageRating(scenes) / 100) * 10 * 0.2
            };

            const score = Object.values(factors).reduce((sum, factor) => sum + factor, 0);
            return Math.round(score * 10) / 10;
        }

        generateActivityTimeline(scenes) {
            const timeline = {};
            
            scenes.forEach(scene => {
                if (!scene.date) return;
                const date = new Date(scene.date);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                
                if (!timeline[monthKey]) {
                    timeline[monthKey] = {
                        count: 0,
                        totalViews: 0,
                        totalRating: 0,
                        ratedCount: 0
                    };
                }
                
                timeline[monthKey].count++;
                timeline[monthKey].totalViews += scene.o_counter || 0;
                if (scene.rating100) {
                    timeline[monthKey].totalRating += scene.rating100;
                    timeline[monthKey].ratedCount++;
                }
            });

            // Calculate averages
            Object.keys(timeline).forEach(month => {
                const data = timeline[month];
                data.averageViews = data.count > 0 ? Math.round(data.totalViews / data.count) : 0;
                data.averageRating = data.ratedCount > 0 ? Math.round((data.totalRating / data.ratedCount) * 10) / 10 : 0;
            });

            return timeline;
        }

        async analyzeCollaborations(scenes, performerId) {
            const collaborations = {};
            
            scenes.forEach(scene => {
                scene.performers.forEach(performer => {
                    if (performer.id !== performerId) {
                        if (!collaborations[performer.id]) {
                            collaborations[performer.id] = {
                                id: performer.id,
                                name: performer.name,
                                sceneCount: 0,
                                scenes: []
                            };
                        }
                        collaborations[performer.id].sceneCount++;
                        collaborations[performer.id].scenes.push(scene.id);
                    }
                });
            });

            // Convert to array and sort by frequency
            const sorted = Object.values(collaborations)
                .sort((a, b) => b.sceneCount - a.sceneCount)
                .slice(0, 20); // Top 20 collaborators

            return {
                total: Object.keys(collaborations).length,
                frequent: sorted,
                mostFrequent: sorted[0] || null
            };
        }

        analyzeTrends(scenes) {
            const sortedScenes = scenes
                .filter(s => s.date)
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            if (sortedScenes.length < 2) {
                return { trend: 'insufficient_data' };
            }

            const recentScenes = sortedScenes.slice(0, Math.min(10, Math.floor(sortedScenes.length / 2)));
            const olderScenes = sortedScenes.slice(Math.min(10, Math.floor(sortedScenes.length / 2)));

            const recentAvgViews = recentScenes.reduce((sum, s) => sum + (s.o_counter || 0), 0) / recentScenes.length;
            const olderAvgViews = olderScenes.reduce((sum, s) => sum + (s.o_counter || 0), 0) / olderScenes.length;

            const viewsTrend = recentAvgViews > olderAvgViews * 1.2 ? 'increasing' : 
                              recentAvgViews < olderAvgViews * 0.8 ? 'decreasing' : 'stable';

            return {
                trend: viewsTrend,
                recentAverage: Math.round(recentAvgViews),
                historicalAverage: Math.round(olderAvgViews),
                percentChange: olderAvgViews > 0 ? Math.round(((recentAvgViews - olderAvgViews) / olderAvgViews) * 100) : 0
            };
        }
    }

    // ===== DATA VALIDATOR =====
    class PerformerDataValidator {
        constructor(graphqlClient) {
            this.graphql = graphqlClient;
            this.duplicateCache = new Map();
        }

        async findDuplicates() {
            try {
                const data = await this.graphql.getPerformers({});
                const performers = data.findPerformers.performers;
                const duplicates = new Map();

                // Group by normalized name
                performers.forEach(performer => {
                    const normalizedName = this.normalizeName(performer.name);
                    if (!duplicates.has(normalizedName)) {
                        duplicates.set(normalizedName, []);
                    }
                    duplicates.get(normalizedName).push(performer);
                });

                // Filter to only actual duplicates
                const actualDuplicates = [];
                duplicates.forEach((group, name) => {
                    if (group.length > 1) {
                        actualDuplicates.push({
                            name,
                            performers: group,
                            confidence: this.calculateDuplicateConfidence(group)
                        });
                    }
                });

                // Check for similar names (fuzzy matching)
                for (let i = 0; i < performers.length - 1; i++) {
                    for (let j = i + 1; j < performers.length; j++) {
                        const similarity = this.calculateSimilarity(performers[i], performers[j]);
                        if (similarity > 0.8 && !this.alreadyGrouped(performers[i], performers[j], actualDuplicates)) {
                            actualDuplicates.push({
                                name: `${performers[i].name} / ${performers[j].name}`,
                                performers: [performers[i], performers[j]],
                                confidence: similarity
                            });
                        }
                    }
                }

                return actualDuplicates.sort((a, b) => b.confidence - a.confidence);
            } catch (error) {
                console.error('Failed to find duplicates:', error);
                return [];
            }
        }

        normalizeName(name) {
            return name.toLowerCase().replace(/[^a-z0-9]/g, '');
        }

        calculateSimilarity(performer1, performer2) {
            let score = 0;
            let factors = 0;

            // Name similarity
            const nameSimilarity = 1 - (Utils.calculateLevenshteinDistance(
                performer1.name.toLowerCase(),
                performer2.name.toLowerCase()
            ) / Math.max(performer1.name.length, performer2.name.length));
            score += nameSimilarity * 0.4;
            factors += 0.4;

            // Birthdate match
            if (performer1.birthdate && performer2.birthdate) {
                score += performer1.birthdate === performer2.birthdate ? 0.3 : 0;
                factors += 0.3;
            }

            // Note: aliases comparison removed as field not available in Stash GraphQL schema

            // Physical attributes
            if (performer1.height_cm && performer2.height_cm) {
                const heightDiff = Math.abs(performer1.height_cm - performer2.height_cm);
                score += heightDiff < 5 ? 0.1 : 0;
                factors += 0.1;
            }

            return factors > 0 ? score / factors : 0;
        }


        calculateDuplicateConfidence(group) {
            if (group.length === 2) {
                return this.calculateSimilarity(group[0], group[1]);
            }
            
            let totalSimilarity = 0;
            let comparisons = 0;
            for (let i = 0; i < group.length - 1; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    totalSimilarity += this.calculateSimilarity(group[i], group[j]);
                    comparisons++;
                }
            }
            return comparisons > 0 ? totalSimilarity / comparisons : 0;
        }

        alreadyGrouped(performer1, performer2, groups) {
            return groups.some(group => 
                group.performers.some(p => p.id === performer1.id) &&
                group.performers.some(p => p.id === performer2.id)
            );
        }

        async validatePerformerData(performerId) {
            try {
                const data = await this.graphql.getPerformer(performerId);
                const performer = data.findPerformer;
                const issues = [];

                // Check completeness
                if (!performer.image_path) issues.push({ type: 'missing_image', severity: 'medium' });
                if (!performer.birthdate) issues.push({ type: 'missing_birthdate', severity: 'low' });
                if (!performer.ethnicity) issues.push({ type: 'missing_ethnicity', severity: 'low' });
                if (!performer.country) issues.push({ type: 'missing_country', severity: 'low' });
                if (!performer.measurements) issues.push({ type: 'missing_measurements', severity: 'low' });
                
                // Check data quality
                if (performer.name && performer.name.length < 3) {
                    issues.push({ type: 'short_name', severity: 'high', details: 'Name too short' });
                }


                return {
                    performer,
                    issues,
                    completeness: this.calculateCompleteness(performer),
                    dataQuality: this.calculateDataQuality(performer, issues)
                };
            } catch (error) {
                console.error('Failed to validate performer:', error);
                return null;
            }
        }

        calculateCompleteness(performer) {
            const fields = [
                'name', 'image_path', 'birthdate', 'ethnicity', 'country',
                'eye_color', 'hair_color', 'height_cm', 'measurements', 'details'
            ];
            const filledFields = fields.filter(field => performer[field]);
            return Math.round((filledFields.length / fields.length) * 100);
        }

        calculateDataQuality(performer, issues) {
            const baseScore = 100;
            const highSeverityPenalty = 20;
            const mediumSeverityPenalty = 10;
            const lowSeverityPenalty = 5;

            let score = baseScore;
            issues.forEach(issue => {
                switch (issue.severity) {
                    case 'high': score -= highSeverityPenalty; break;
                    case 'medium': score -= mediumSeverityPenalty; break;
                    case 'low': score -= lowSeverityPenalty; break;
                }
            });

            return Math.max(0, score);
        }
    }

    // ===== RELATIONSHIP MAPPER =====
    class PerformerRelationshipMapper {
        constructor(graphqlClient) {
            this.graphql = graphqlClient;
            this.relationshipCache = new Map();
        }

        async analyzeRelationships(performerId) {
            try {
                const scenesData = await this.graphql.getPerformerScenes(performerId);
                const scenes = scenesData.findScenes.scenes;
                
                const relationships = new Map();
                const coPerformers = new Map();

                // Analyze co-performers
                scenes.forEach(scene => {
                    scene.performers.forEach(performer => {
                        if (performer.id !== performerId) {
                            if (!coPerformers.has(performer.id)) {
                                coPerformers.set(performer.id, {
                                    id: performer.id,
                                    name: performer.name,
                                    scenes: [],
                                    firstScene: scene.date,
                                    lastScene: scene.date
                                });
                            }
                            
                            const data = coPerformers.get(performer.id);
                            data.scenes.push(scene.id);
                            if (scene.date) {
                                data.firstScene = new Date(scene.date) < new Date(data.firstScene) ? scene.date : data.firstScene;
                                data.lastScene = new Date(scene.date) > new Date(data.lastScene) ? scene.date : data.lastScene;
                            }
                        }
                    });
                });

                // Calculate relationship strengths
                const relationshipsArray = Array.from(coPerformers.values()).map(data => ({
                    ...data,
                    sceneCount: data.scenes.length,
                    relationshipStrength: this.calculateRelationshipStrength(data, scenes.length),
                    relationshipType: this.classifyRelationship(data)
                }));

                // Sort by relationship strength
                relationshipsArray.sort((a, b) => b.relationshipStrength - a.relationshipStrength);

                return {
                    totalRelationships: relationshipsArray.length,
                    relationships: relationshipsArray,
                    networkDensity: this.calculateNetworkDensity(relationshipsArray, scenes.length),
                    clusters: this.identifyClusters(relationshipsArray)
                };
            } catch (error) {
                console.error('Failed to analyze relationships:', error);
                return null;
            }
        }

        calculateRelationshipStrength(data, totalScenes) {
            const frequency = data.scenes.length / totalScenes;
            const recency = this.calculateRecency(data.lastScene);
            const consistency = this.calculateConsistency(data.firstScene, data.lastScene, data.scenes.length);
            
            return (frequency * 0.5 + recency * 0.3 + consistency * 0.2) * 100;
        }

        calculateRecency(lastScene) {
            if (!lastScene) return 0;
            const daysSince = (Date.now() - new Date(lastScene).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince < 30) return 1;
            if (daysSince < 90) return 0.8;
            if (daysSince < 180) return 0.6;
            if (daysSince < 365) return 0.4;
            return 0.2;
        }

        calculateConsistency(firstScene, lastScene, sceneCount) {
            if (!firstScene || !lastScene || sceneCount < 2) return 0;
            
            const timeSpan = new Date(lastScene) - new Date(firstScene);
            const expectedScenes = timeSpan / (30 * 24 * 60 * 60 * 1000); // Assuming monthly collaboration
            
            return Math.min(1, sceneCount / Math.max(1, expectedScenes));
        }

        classifyRelationship(data) {
            if (data.scenes.length >= 10) return 'frequent_collaborator';
            if (data.scenes.length >= 5) return 'regular_collaborator';
            if (data.scenes.length >= 3) return 'occasional_collaborator';
            return 'rare_collaborator';
        }

        calculateNetworkDensity(relationships, totalScenes) {
            if (totalScenes === 0) return 0;
            const totalCollaborations = relationships.reduce((sum, r) => sum + r.sceneCount, 0);
            return Math.min(1, totalCollaborations / (totalScenes * 2));
        }

        identifyClusters(relationships) {
            // Simple clustering based on collaboration frequency
            const clusters = {
                core: relationships.filter(r => r.relationshipStrength > 50),
                regular: relationships.filter(r => r.relationshipStrength > 20 && r.relationshipStrength <= 50),
                peripheral: relationships.filter(r => r.relationshipStrength <= 20)
            };
            
            return clusters;
        }

        async generateRelationshipGraph(performerId, depth = 1) {
            const graph = {
                nodes: [],
                edges: []
            };
            
            const visited = new Set();
            const queue = [{ id: performerId, depth: 0 }];
            
            while (queue.length > 0 && graph.nodes.length < 50) {
                const { id, depth: currentDepth } = queue.shift();
                
                if (visited.has(id) || currentDepth > depth) continue;
                visited.add(id);
                
                try {
                    const performerData = await this.graphql.getPerformer(id);
                    const performer = performerData.findPerformer;
                    
                    graph.nodes.push({
                        id: performer.id,
                        name: performer.name,
                        image: performer.image_path,
                        depth: currentDepth
                    });
                    
                    if (currentDepth < depth) {
                        const relationships = await this.analyzeRelationships(id);
                        if (relationships) {
                            relationships.relationships.slice(0, 5).forEach(rel => {
                                graph.edges.push({
                                    source: id,
                                    target: rel.id,
                                    weight: rel.relationshipStrength,
                                    sceneCount: rel.sceneCount
                                });
                                
                                if (!visited.has(rel.id)) {
                                    queue.push({ id: rel.id, depth: currentDepth + 1 });
                                }
                            });
                        }
                    }
                } catch (error) {
                    console.error('Failed to process performer:', id, error);
                }
            }
            
            return graph;
        }
    }

    // ===== BULK IMAGE UPLOADER =====
    class BulkImageUploader {
        constructor(graphqlClient) {
            this.graphql = graphqlClient;
            this.uploadQueue = [];
            this.isUploading = false;
        }

        async uploadImages(performerId, files) {
            // Add files to queue
            files.forEach(file => {
                this.uploadQueue.push({
                    performerId,
                    file,
                    status: 'pending'
                });
            });

            if (!this.isUploading) {
                this.processQueue();
            }

            return {
                queued: files.length,
                queueSize: this.uploadQueue.length
            };
        }

        async processQueue() {
            this.isUploading = true;

            while (this.uploadQueue.length > 0) {
                const batch = this.uploadQueue.splice(0, CONFIG.BULK_UPLOAD_BATCH_SIZE);
                
                await Promise.all(batch.map(async (item) => {
                    try {
                        item.status = 'uploading';
                        await this.uploadSingleImage(item.performerId, item.file);
                        item.status = 'completed';
                    } catch (error) {
                        item.status = 'failed';
                        item.error = error.message;
                        console.error('Upload failed:', error);
                    }
                }));

                // Small delay between batches
                if (this.uploadQueue.length > 0) {
                    await Utils.sleep(1000);
                }
            }

            this.isUploading = false;
        }

        async uploadSingleImage(performerId, file) {
            // In a real implementation, this would upload to Stash
            // For now, we'll simulate the process
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                
                reader.onload = async (e) => {
                    try {
                        // Simulate upload delay
                        await Utils.sleep(500 + Math.random() * 1000);
                        
                        // In reality, we'd send this to Stash's image upload endpoint
                        console.log(`Uploading image for performer ${performerId}:`, file.name);
                        
                        resolve({
                            success: true,
                            filename: file.name,
                            performerId
                        });
                    } catch (error) {
                        reject(error);
                    }
                };
                
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(file);
            });
        }

        getQueueStatus() {
            return {
                total: this.uploadQueue.length,
                pending: this.uploadQueue.filter(i => i.status === 'pending').length,
                uploading: this.uploadQueue.filter(i => i.status === 'uploading').length,
                completed: this.uploadQueue.filter(i => i.status === 'completed').length,
                failed: this.uploadQueue.filter(i => i.status === 'failed').length,
                isUploading: this.isUploading
            };
        }

        clearQueue() {
            this.uploadQueue = [];
            return { cleared: true };
        }
    }

    // ===== DATA EXPORTER =====
    class PerformerDataExporter {
        constructor(graphqlClient, statisticsEngine) {
            this.graphql = graphqlClient;
            this.statisticsEngine = statisticsEngine;
        }

        async exportPerformerData(performerId, format = 'json') {
            try {
                const [performerData, stats, scenes] = await Promise.all([
                    this.graphql.getPerformer(performerId),
                    this.statisticsEngine.generatePerformerStats(performerId),
                    this.graphql.getPerformerScenes(performerId)
                ]);

                const performer = performerData.findPerformer;
                const exportData = {
                    performer: {
                        ...performer,
                        statistics: stats,
                        sceneDetails: scenes.findScenes.scenes
                    },
                    exportDate: new Date().toISOString(),
                    exportVersion: '1.0'
                };

                switch (format) {
                    case 'json':
                        return this.exportAsJSON(exportData);
                    case 'csv':
                        return this.exportAsCSV(exportData);
                    case 'html':
                        return this.exportAsHTML(exportData);
                    default:
                        throw new Error(`Unsupported format: ${format}`);
                }
            } catch (error) {
                console.error('Export failed:', error);
                throw error;
            }
        }

        async exportSearchResults(searchResults, format = 'json') {
            const exportData = {
                searchQuery: searchResults.query,
                filters: searchResults.filters,
                resultCount: searchResults.total,
                performers: searchResults.results,
                exportDate: new Date().toISOString()
            };

            switch (format) {
                case 'json':
                    return this.exportAsJSON(exportData);
                case 'csv':
                    return this.exportSearchResultsAsCSV(exportData);
                case 'html':
                    return this.exportSearchResultsAsHTML(exportData);
                default:
                    throw new Error(`Unsupported format: ${format}`);
            }
        }

        exportAsJSON(data) {
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            this.downloadFile(blob, `performer-data-${Date.now()}.json`);
            return { success: true, format: 'json' };
        }

        exportAsCSV(data) {
            const performer = data.performer;
            const rows = [
                ['Field', 'Value'],
                ['Name', performer.name],
                ['Birthdate', performer.birthdate || ''],
                ['Country', performer.country || ''],
                ['Ethnicity', performer.ethnicity || ''],
                ['Hair Color', performer.hair_color || ''],
                ['Eye Color', performer.eye_color || ''],
                ['Height', performer.height_cm ? `${performer.height_cm}cm` : ''],
                ['Measurements', performer.measurements || ''],
                ['Scene Count', performer.scene_count || 0],
                ['Average Rating', data.performer.statistics?.basic?.averageRating ? Math.round(data.performer.statistics.basic.averageRating / 20) + '/5' : '0/5'],
                ['Total Duration', data.performer.statistics?.basic?.totalDuration > 0 ? Utils.formatDuration(data.performer.statistics.basic.totalDuration) : 'N/A'],
                ['Popularity Score', data.performer.statistics?.popularity?.popularityScore || 0]
            ];

            const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            this.downloadFile(blob, `performer-${performer.name.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.csv`);
            return { success: true, format: 'csv' };
        }

        exportSearchResultsAsCSV(data) {
            const headers = ['Name', 'Scene Count', 'Rating', 'Has Image'];
            const rows = [headers];

            data.performers.forEach(performer => {
                rows.push([
                    performer.name,
                    performer.scene_count || 0,
                    Math.round(performer.rating100 / 20) || 'N/A',
                    performer.image_path ? 'Yes' : 'No'
                ]);
            });

            const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            this.downloadFile(blob, `performer-search-results-${Date.now()}.csv`);
            return { success: true, format: 'csv' };
        }

        exportAsHTML(data) {
            const performer = data.performer;
            const stats = performer.statistics;

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${performer.name} - Performer Profile</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                        h1 { color: #333; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
                        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
                        .info-item { padding: 10px; background: #f8f9fa; border-radius: 4px; }
                        .info-label { font-weight: bold; color: #666; }
                        .stats { margin-top: 30px; }
                        .stat-card { background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 10px 0; }
                        .stat-value { font-size: 24px; font-weight: bold; color: #2196f3; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>${performer.name}</h1>
                        
                        <div class="info-grid">
                            <div class="info-item">
                            </div>
                            <div class="info-item">
                                <span class="info-label">Birthdate:</span> ${performer.birthdate || 'Unknown'}
                            </div>
                            <div class="info-item">
                                <span class="info-label">Country:</span> ${performer.country || 'Unknown'}
                            </div>
                            <div class="info-item">
                                <span class="info-label">Ethnicity:</span> ${performer.ethnicity || 'Unknown'}
                            </div>
                        </div>

                        <div class="stats">
                            <h2>Statistics</h2>
                            <div class="stat-card">
                                <div class="stat-value">${stats?.basic?.sceneCount || 0}</div>
                                <div>Total Scenes</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${stats?.basic?.totalDuration > 0 ? Utils.formatDuration(stats.basic.totalDuration) : 'N/A'}</div>
                                <div>Total Duration</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${stats?.basic?.averageRating ? Math.round(stats.basic.averageRating / 20) : 0}/5</div>
                                <div>Average Rating</div>
                            </div>
                        </div>

                        <p style="margin-top: 30px; text-align: center; color: #666;">
                            Exported on ${new Date(data.exportDate).toLocaleString()}
                        </p>
                    </div>
                </body>
                </html>
            `;

            const blob = new Blob([html], { type: 'text/html' });
            this.downloadFile(blob, `performer-${performer.name.replace(/[^a-z0-9]/gi, '_')}-profile.html`);
            return { success: true, format: 'html' };
        }

        exportSearchResultsAsHTML(data) {
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Performer Search Results</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
                        h1 { color: #333; }
                        .search-info { background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                        th { background: #f5f5f5; font-weight: bold; }
                        tr:hover { background: #f5f5f5; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Performer Search Results</h1>
                        
                        <div class="search-info">
                            <p><strong>Query:</strong> ${data.searchQuery || 'All performers'}</p>
                            <p><strong>Results:</strong> ${data.resultCount}</p>
                            ${data.filters.length > 0 ? `<p><strong>Filters:</strong> ${data.filters.map(f => f[0]).join(', ')}</p>` : ''}
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Scenes</th>
                                    <th>Rating</th>
                                    <th>Has Image</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.performers.map(p => `
                                    <tr>
                                        <td>${p.name}</td>
                                        <td>${p.scene_count || 0}</td>
                                        <td>${p.rating100 ? Math.round(p.rating100 / 20) : 'N/A'}</td>
                                        <td>${p.image_path ? '✓' : '✗'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <p style="margin-top: 30px; text-align: center; color: #666;">
                            Exported on ${new Date(data.exportDate).toLocaleString()}
                        </p>
                    </div>
                </body>
                </html>
            `;

            const blob = new Blob([html], { type: 'text/html' });
            this.downloadFile(blob, `performer-search-results-${Date.now()}.html`);
            return { success: true, format: 'html' };
        }

        downloadFile(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    // ===== PERFORMER DETAIL WIDGET =====
    class PerformerDetailWidget {
        constructor(graphqlClient, statisticsEngine, relationshipMapper, dataValidator, imageManager) {
            this.graphql = graphqlClient;
            this.statisticsEngine = statisticsEngine;
            this.relationshipMapper = relationshipMapper;
            this.dataValidator = dataValidator;
            this.imageManager = imageManager;
            
            this.currentPerformerId = null;
            this.currentTab = 'overview';
            this.container = null;
            
            this.init();
        }
        
        init() {
            this.injectStyles();
            this.createDetailInterface();
        }
        
        injectStyles() {
            GM_addStyle(`
                /* Performer Detail Widget */
                .performer-detail-widget {
                    position: fixed;
                    top: 40px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 90%;
                    max-width: 1200px;
                    height: 90vh;
                    background: #1a1a2e;
                    border: 1px solid #16213e;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.8);
                    z-index: 10000;
                    display: none;
                    flex-direction: column;
                    overflow: hidden;
                }
                
                /* Detail Header */
                .detail-header {
                    display: flex;
                    align-items: center;
                    padding: 20px;
                    background: linear-gradient(135deg, #1a1a2e, #16213e);
                    border-bottom: 1px solid #0f3460;
                }
                
                .detail-performer-image {
                    width: 100px;
                    height: 120px;
                    border-radius: 8px;
                    object-fit: cover;
                    margin-right: 20px;
                }
                
                .detail-performer-info {
                    flex: 1;
                }
                
                .detail-performer-name {
                    font-size: 28px;
                    color: #ecf0f1;
                    margin-bottom: 10px;
                }
                
                .detail-performer-meta {
                    display: flex;
                    gap: 20px;
                    color: #7f8c8d;
                    font-size: 14px;
                }
                
                .detail-controls {
                    display: flex;
                    gap: 10px;
                }
                
                .detail-control-btn {
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: white;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .detail-control-btn:hover {
                    background: rgba(255,255,255,0.2);
                }
                
                /* Tab Navigation */
                .detail-tabs {
                    display: flex;
                    background: rgba(52, 152, 219, 0.1);
                    border-bottom: 1px solid #0f3460;
                }
                
                .detail-tab {
                    padding: 15px 30px;
                    cursor: pointer;
                    color: #7f8c8d;
                    border-bottom: 3px solid transparent;
                    transition: all 0.3s;
                }
                
                .detail-tab:hover {
                    color: #ecf0f1;
                    background: rgba(255,255,255,0.05);
                }
                
                .detail-tab.active {
                    color: #3498db;
                    border-bottom-color: #3498db;
                }
                
                /* Tab Content */
                .detail-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                }
                
                /* Overview Tab */
                .overview-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                }
                
                .info-section {
                    background: rgba(255,255,255,0.05);
                    padding: 20px;
                    border-radius: 8px;
                }
                
                .info-section h3 {
                    color: #3498db;
                    margin-bottom: 15px;
                    font-size: 18px;
                }
                
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                
                .info-label {
                    color: #7f8c8d;
                    font-size: 14px;
                }
                
                .info-value {
                    color: #ecf0f1;
                    font-size: 14px;
                    font-weight: 500;
                }
                
                /* Scenes Tab */
                .scenes-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 15px;
                }
                
                .scene-card {
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    overflow: hidden;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .scene-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 5px 20px rgba(52, 152, 219, 0.3);
                }
                
                .scene-thumbnail {
                    width: 100%;
                    height: 120px;
                    object-fit: cover;
                }
                
                .scene-info {
                    padding: 10px;
                }
                
                .scene-title {
                    color: #ecf0f1;
                    font-size: 14px;
                    margin-bottom: 5px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                
                .scene-meta {
                    color: #7f8c8d;
                    font-size: 12px;
                }
                
                /* Statistics Tab */
                .stats-dashboard {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                }
                
                .chart-container {
                    background: rgba(255,255,255,0.05);
                    padding: 20px;
                    border-radius: 8px;
                    height: 300px;
                }
                
                /* Relationships Tab */
                .relationship-network {
                    background: rgba(255,255,255,0.05);
                    padding: 20px;
                    border-radius: 8px;
                    min-height: 400px;
                }
                
                .collaborator-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 15px;
                    margin-top: 20px;
                }
                
                .collaborator-card {
                    display: flex;
                    align-items: center;
                    background: rgba(255,255,255,0.05);
                    padding: 15px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .collaborator-card:hover {
                    background: rgba(255,255,255,0.1);
                }
                
                .collaborator-image {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    object-fit: cover;
                    margin-right: 15px;
                    background-color: #2c3e50;
                    display: block;
                }
                
                .collaborator-info {
                    flex: 1;
                }
                
                .collaborator-name {
                    color: #ecf0f1;
                    font-size: 14px;
                    margin-bottom: 5px;
                }
                
                .collaborator-stats {
                    color: #7f8c8d;
                    font-size: 12px;
                }
                
                /* Data Quality Tab */
                .quality-report {
                    background: rgba(255,255,255,0.05);
                    padding: 20px;
                    border-radius: 8px;
                }
                
                .quality-score {
                    font-size: 48px;
                    font-weight: bold;
                    text-align: center;
                    margin: 20px 0;
                }
                
                .quality-high { color: #2ecc71; }
                .quality-medium { color: #f39c12; }
                .quality-low { color: #e74c3c; }
                
                .issues-list {
                    margin-top: 20px;
                }
                
                .issue-item {
                    display: flex;
                    align-items: center;
                    padding: 10px;
                    margin-bottom: 10px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 4px;
                }
                
                .issue-severity {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    margin-right: 15px;
                }
                
                .severity-high { background: #e74c3c; }
                .severity-medium { background: #f39c12; }
                .severity-low { background: #3498db; }
                
                /* Gallery Tab */
                .gallery-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    gap: 10px;
                }
                
                .gallery-item {
                    position: relative;
                    padding-bottom: 100%;
                    background: rgba(255,255,255,0.05);
                    border-radius: 4px;
                    overflow: hidden;
                    cursor: pointer;
                }
                
                .gallery-image {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.3s;
                }
                
                .gallery-item:hover .gallery-image {
                    transform: scale(1.1);
                }
            `);
        }
        
        createDetailInterface() {
            const container = document.createElement('div');
            container.className = 'performer-detail-widget';
            container.innerHTML = `
                <div class="detail-header">
                    <img class="detail-performer-image" id="detail-performer-image" src="/assets/no-image.png" alt="">
                    <div class="detail-performer-info">
                        <h1 class="detail-performer-name" id="detail-performer-name">Loading...</h1>
                        <div class="detail-performer-meta" id="detail-performer-meta"></div>
                    </div>
                    <div class="detail-controls">
                        <button class="detail-control-btn" id="detail-edit-btn">✏️ Edit</button>
                        <button class="detail-control-btn" id="detail-export-btn">📥 Export</button>
                        <button class="detail-control-btn" id="detail-close-btn">✕ Close</button>
                    </div>
                </div>
                
                <div class="detail-tabs">
                    <div class="detail-tab active" data-tab="overview">Overview</div>
                    <div class="detail-tab" data-tab="scenes">Scenes</div>
                    <div class="detail-tab" data-tab="statistics">Statistics</div>
                    <div class="detail-tab" data-tab="relationships">Relationships</div>
                    <div class="detail-tab" data-tab="gallery">Gallery</div>
                    <div class="detail-tab" data-tab="quality">Data Quality</div>
                </div>
                
                <div class="detail-content" id="detail-content">
                    <!-- Content will be dynamically loaded here -->
                </div>
            `;
            
            document.body.appendChild(container);
            this.container = container;
            
            // Attach event listeners
            this.attachDetailEventListeners();
        }
        
        attachDetailEventListeners() {
            // Tab switching
            this.container.querySelectorAll('.detail-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    this.switchTab(tab.dataset.tab);
                });
            });
            
            // Control buttons
            document.getElementById('detail-close-btn').addEventListener('click', () => {
                this.close();
            });
            
            document.getElementById('detail-edit-btn').addEventListener('click', () => {
                this.editPerformer();
            });
            
            document.getElementById('detail-export-btn').addEventListener('click', () => {
                this.exportPerformerData();
            });
        }
        
        async open(performerId) {
            this.currentPerformerId = performerId;
            this.container.style.display = 'flex';
            
            // Load performer data
            try {
                const performerData = await this.graphql.getPerformer(performerId);
                const performer = performerData.findPerformer;
                
                // Update header
                document.getElementById('detail-performer-image').src = performer.image_path || '/assets/no-image.png';
                document.getElementById('detail-performer-name').textContent = performer.name;
                
                // Update meta info
                const metaInfo = [];
                if (performer.birthdate) {
                    const age = this.calculateAge(performer.birthdate);
                    metaInfo.push(`Age: ${age}`);
                }
                if (performer.country) metaInfo.push(`Country: ${performer.country}`);
                if (performer.scene_count) metaInfo.push(`Scenes: ${performer.scene_count}`);
                
                document.getElementById('detail-performer-meta').innerHTML = metaInfo
                    .map(info => `<span>${info}</span>`)
                    .join('');
                
                // Load initial tab content
                this.switchTab('overview');
                
            } catch (error) {
                console.error('Failed to load performer:', error);
                this.container.innerHTML = `<div style="text-align: center; padding: 50px; color: #e74c3c;">Failed to load performer data: ${error.message}</div>`;
            }
        }
        
        async switchTab(tabName) {
            // Update active tab
            this.container.querySelectorAll('.detail-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tab === tabName);
            });
            
            this.currentTab = tabName;
            const contentContainer = document.getElementById('detail-content');
            
            // Show loading
            contentContainer.innerHTML = '<div style="text-align: center; padding: 50px;"><div class="loading-spinner"></div></div>';
            
            try {
                switch (tabName) {
                    case 'overview':
                        await this.loadOverviewTab();
                        break;
                    case 'scenes':
                        await this.loadScenesTab();
                        break;
                    case 'statistics':
                        await this.loadStatisticsTab();
                        break;
                    case 'relationships':
                        await this.loadRelationshipsTab();
                        break;
                    case 'gallery':
                        await this.loadGalleryTab();
                        break;
                    case 'quality':
                        await this.loadQualityTab();
                        break;
                }
            } catch (error) {
                contentContainer.innerHTML = `<div style="text-align: center; padding: 50px; color: #e74c3c;">Failed to load tab content: ${error.message}</div>`;
            }
        }
        
        async loadOverviewTab() {
            const performerData = await this.graphql.getPerformer(this.currentPerformerId);
            const performer = performerData.findPerformer;
            
            const contentContainer = document.getElementById('detail-content');
            contentContainer.innerHTML = `
                <div class="overview-grid">
                    <div class="info-section">
                        <h3>Basic Information</h3>
                        <div class="info-row">
                            <span class="info-label">Name</span>
                            <span class="info-value">${performer.name}</span>
                        </div>
                        ${performer.birthdate ? `
                            <div class="info-row">
                                <span class="info-label">Birthdate</span>
                                <span class="info-value">${new Date(performer.birthdate).toLocaleDateString()}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Age</span>
                                <span class="info-value">${this.calculateAge(performer.birthdate)} years</span>
                            </div>
                        ` : ''}
                        ${performer.death_date ? `
                            <div class="info-row">
                                <span class="info-label">Death Date</span>
                                <span class="info-value">${new Date(performer.death_date).toLocaleDateString()}</span>
                            </div>
                        ` : ''}
                        ${performer.country ? `
                            <div class="info-row">
                                <span class="info-label">Country</span>
                                <span class="info-value">${performer.country}</span>
                            </div>
                        ` : ''}
                        ${performer.ethnicity ? `
                            <div class="info-row">
                                <span class="info-label">Ethnicity</span>
                                <span class="info-value">${performer.ethnicity}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="info-section">
                        <h3>Physical Attributes</h3>
                        ${performer.height_cm ? `
                            <div class="info-row">
                                <span class="info-label">Height</span>
                                <span class="info-value">${performer.height_cm} cm</span>
                            </div>
                        ` : ''}
                        ${performer.measurements ? `
                            <div class="info-row">
                                <span class="info-label">Measurements</span>
                                <span class="info-value">${performer.measurements}</span>
                            </div>
                        ` : ''}
                        ${performer.eye_color ? `
                            <div class="info-row">
                                <span class="info-label">Eye Color</span>
                                <span class="info-value">${performer.eye_color}</span>
                            </div>
                        ` : ''}
                        ${performer.hair_color ? `
                            <div class="info-row">
                                <span class="info-label">Hair Color</span>
                                <span class="info-value">${performer.hair_color}</span>
                            </div>
                        ` : ''}
                        ${performer.fake_tits ? `
                            <div class="info-row">
                                <span class="info-label">Breast Enhancement</span>
                                <span class="info-value">Yes</span>
                            </div>
                        ` : ''}
                        ${performer.tattoos ? `
                            <div class="info-row">
                                <span class="info-label">Tattoos</span>
                                <span class="info-value">${performer.tattoos}</span>
                            </div>
                        ` : ''}
                        ${performer.piercings ? `
                            <div class="info-row">
                                <span class="info-label">Piercings</span>
                                <span class="info-value">${performer.piercings}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="info-section">
                        <h3>Career Information</h3>
                        <div class="info-row">
                            <span class="info-label">Total Scenes</span>
                            <span class="info-value">${performer.scene_count || 0}</span>
                        </div>
                        ${performer.career_length ? `
                            <div class="info-row">
                                <span class="info-label">Career Length</span>
                                <span class="info-value">${performer.career_length}</span>
                            </div>
                        ` : ''}
                        ${performer.url ? `
                            <div class="info-row">
                                <span class="info-label">URL</span>
                                <span class="info-value"><a href="${performer.url}" target="_blank" style="color: #3498db;">${performer.url}</a></span>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${performer.details ? `
                        <div class="info-section" style="grid-column: 1 / -1;">
                            <h3>Details</h3>
                            <div style="color: #ecf0f1; line-height: 1.6;">
                                ${performer.details}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${performer.tags && performer.tags.length > 0 ? `
                        <div class="info-section" style="grid-column: 1 / -1;">
                            <h3>Tags</h3>
                            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                                ${performer.tags.map(tag => `
                                    <span style="background: rgba(52, 152, 219, 0.2); padding: 5px 15px; border-radius: 20px; color: #3498db; font-size: 14px;">
                                        ${tag.name}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        async loadScenesTab() {
            const scenesData = await this.graphql.getPerformerScenes(this.currentPerformerId);
            const scenes = scenesData.findScenes.scenes;
            
            const contentContainer = document.getElementById('detail-content');
            
            if (scenes.length === 0) {
                contentContainer.innerHTML = '<div style="text-align: center; padding: 50px; color: #7f8c8d;">No scenes found for this performer</div>';
                return;
            }
            
            contentContainer.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <h3 style="color: #3498db;">Total Scenes: ${scenes.length}</h3>
                </div>
                <div class="scenes-grid">
                    ${scenes.map(scene => `
                        <div class="scene-card" data-scene-id="${scene.id}">
                            <img class="scene-thumbnail" src="${scene.paths?.screenshot || '/assets/no-scene.png'}" alt="${scene.title || 'Untitled'}">
                            <div class="scene-info">
                                <div class="scene-title">${scene.title || 'Untitled Scene'}</div>
                                <div class="scene-meta">
                                    ${scene.date ? new Date(scene.date).toLocaleDateString() : 'No date'}
                                    ${scene.rating100 ? ` • ⭐ ${Math.round(scene.rating100 / 20)}/5` : ''}
                                    ${scene.o_counter ? ` • 👁️ ${scene.o_counter}` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            
            // Add click handlers for scenes
            contentContainer.querySelectorAll('.scene-card').forEach(card => {
                card.addEventListener('click', () => {
                    window.location.href = `/scenes/${card.dataset.sceneId}`;
                });
            });
        }
        
        async loadStatisticsTab() {
            const stats = await this.statisticsEngine.generatePerformerStats(this.currentPerformerId);
            
            if (!stats) {
                document.getElementById('detail-content').innerHTML = '<div style="text-align: center; padding: 50px; color: #e74c3c;">Failed to generate statistics</div>';
                return;
            }
            
            const contentContainer = document.getElementById('detail-content');
            contentContainer.innerHTML = `
                <div class="stats-dashboard">
                    <div class="info-section">
                        <h3>Basic Statistics</h3>
                        <div class="info-row">
                            <span class="info-label">Total Scenes</span>
                            <span class="info-value">${stats.basic.sceneCount}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Average Rating</span>
                            <span class="info-value">${Math.round(stats.basic.averageRating / 20)}/5</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Total Views</span>
                            <span class="info-value">${stats.basic.totalViews.toLocaleString()}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Average Views</span>
                            <span class="info-value">${stats.popularity.averageViews.toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div class="info-section">
                        <h3>Popularity Metrics</h3>
                        <div class="info-row">
                            <span class="info-label">Popularity Score</span>
                            <span class="info-value">${stats.popularity.popularityScore}/10</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Recent Activity</span>
                            <span class="info-value">${stats.popularity.recentActivity} scenes</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Quarterly Activity</span>
                            <span class="info-value">${stats.popularity.quarterlyActivity} scenes</span>
                        </div>
                    </div>
                    
                    <div class="info-section">
                        <h3>Trends</h3>
                        <div class="info-row">
                            <span class="info-label">Trend Direction</span>
                            <span class="info-value" style="color: ${stats.trends.trend === 'increasing' ? '#2ecc71' : stats.trends.trend === 'decreasing' ? '#e74c3c' : '#f39c12'}">
                                ${stats.trends.trend}
                            </span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Recent Average</span>
                            <span class="info-value">${stats.trends.recentAverage} views</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Historical Average</span>
                            <span class="info-value">${stats.trends.historicalAverage} views</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Change</span>
                            <span class="info-value" style="color: ${stats.trends.percentChange > 0 ? '#2ecc71' : '#e74c3c'}">
                                ${stats.trends.percentChange > 0 ? '+' : ''}${stats.trends.percentChange}%
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="chart-container" style="margin-top: 20px;">
                    <h3 style="color: #3498db; margin-bottom: 15px;">Activity Timeline</h3>
                    <div id="timeline-chart" style="color: #ecf0f1;">
                        ${this.renderTimelineChart(stats.timeline)}
                    </div>
                </div>
            `;
        }
        
        async loadRelationshipsTab() {
            const relationships = await this.relationshipMapper.analyzeRelationships(this.currentPerformerId);
            
            if (!relationships) {
                document.getElementById('detail-content').innerHTML = '<div style="text-align: center; padding: 50px; color: #e74c3c;">Failed to analyze relationships</div>';
                return;
            }
            
            const contentContainer = document.getElementById('detail-content');
            
            // First render the basic structure
            contentContainer.innerHTML = `
                <div class="relationship-network">
                    <h3 style="color: #3498db; margin-bottom: 15px;">Collaboration Network</h3>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
                        <div class="info-section">
                            <h4>Total Collaborators</h4>
                            <div style="font-size: 36px; color: #3498db; text-align: center;">
                                ${relationships.totalRelationships}
                            </div>
                        </div>
                        <div class="info-section">
                            <h4>Network Density</h4>
                            <div style="font-size: 36px; color: #3498db; text-align: center;">
                                ${Math.round(relationships.networkDensity * 100)}%
                            </div>
                        </div>
                        <div class="info-section">
                            <h4>Most Frequent</h4>
                            <div style="font-size: 18px; color: #ecf0f1; text-align: center;">
                                ${relationships.relationships[0]?.name || 'N/A'}
                                ${relationships.relationships[0] ? `(${relationships.relationships[0].sceneCount} scenes)` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <h4 style="color: #3498db; margin-bottom: 15px;">Top Collaborators</h4>
                    <div class="collaborator-list">
                        ${relationships.relationships.slice(0, 12).map(rel => `
                            <div class="collaborator-card" data-performer-id="${rel.id}">
                                <img class="collaborator-image" src="" alt="${rel.name}" data-performer-id="${rel.id}" style="background-color: #2c3e50;">
                                <div class="collaborator-info">
                                    <div class="collaborator-name">${rel.name}</div>
                                    <div class="collaborator-stats">
                                        ${rel.sceneCount} scenes • ${Math.round(rel.relationshipStrength)}% strength
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            // Fetch images for each collaborator
            const collaboratorImages = contentContainer.querySelectorAll('.collaborator-image');
            collaboratorImages.forEach(async (img) => {
                const performerId = img.dataset.performerId;
                try {
                    const performerData = await this.graphql.getPerformer(performerId);
                    if (performerData?.findPerformer?.image_path) {
                        img.src = performerData.findPerformer.image_path;
                        console.log(`Loaded image for performer ${performerId}:`, performerData.findPerformer.image_path);
                    } else {
                        // Set a default background color for missing images
                        img.style.backgroundColor = '#2c3e50';
                        console.log(`No image found for performer ${performerId}`);
                    }
                } catch (error) {
                    console.error(`Failed to load image for performer ${performerId}:`, error);
                    img.style.backgroundColor = '#2c3e50';
                }
            });
            
            // Add click handlers for collaborators
            contentContainer.querySelectorAll('.collaborator-card').forEach(card => {
                card.addEventListener('click', () => {
                    this.open(card.dataset.performerId);
                });
            });
        }
        
        async loadGalleryTab() {
            const performerData = await this.graphql.getPerformer(this.currentPerformerId);
            const performer = performerData.findPerformer;
            const scenesData = await this.graphql.getPerformerScenes(this.currentPerformerId);
            const scenes = scenesData.findScenes.scenes;
            
            const contentContainer = document.getElementById('detail-content');
            
            const images = [];
            
            // Add performer image
            if (performer.image_path) {
                images.push({
                    url: performer.image_path,
                    type: 'profile',
                    title: 'Profile Image'
                });
            }
            
            // Add scene screenshots
            scenes.forEach(scene => {
                if (scene.paths?.screenshot) {
                    images.push({
                        url: scene.paths.screenshot,
                        type: 'scene',
                        title: scene.title || 'Scene Screenshot',
                        sceneId: scene.id
                    });
                }
            });
            
            if (images.length === 0) {
                contentContainer.innerHTML = '<div style="text-align: center; padding: 50px; color: #7f8c8d;">No images available</div>';
                return;
            }
            
            contentContainer.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <h3 style="color: #3498db;">Gallery (${images.length} images)</h3>
                </div>
                <div class="gallery-container">
                    ${images.map((img, index) => `
                        <div class="gallery-item" data-index="${index}">
                            <img class="gallery-image" src="${img.url}" alt="${img.title}">
                        </div>
                    `).join('')}
                </div>
            `;
            
            // Add click handlers for gallery items
            contentContainer.querySelectorAll('.gallery-item').forEach(item => {
                item.addEventListener('click', () => {
                    const index = parseInt(item.dataset.index);
                    this.openImageViewer(images, index);
                });
            });
        }
        
        async loadQualityTab() {
            try {
                const validation = await this.dataValidator.validatePerformerData(this.currentPerformerId);
                
                if (!validation) {
                    document.getElementById('detail-content').innerHTML = '<div style="text-align: center; padding: 50px; color: #e74c3c;">Failed to validate performer data. Check console for details.</div>';
                    return;
                }
            } catch (error) {
                console.error('Error in loadQualityTab:', error);
                document.getElementById('detail-content').innerHTML = `<div style="text-align: center; padding: 50px; color: #e74c3c;">Error validating performer data: ${error.message}</div>`;
                return;
            }
            
            const scoreClass = validation.dataQuality >= 80 ? 'quality-high' : 
                             validation.dataQuality >= 60 ? 'quality-medium' : 'quality-low';
            
            const contentContainer = document.getElementById('detail-content');
            contentContainer.innerHTML = `
                <div class="quality-report">
                    <h3 style="color: #3498db; text-align: center;">Data Quality Report</h3>
                    
                    <div class="quality-score ${scoreClass}">
                        ${validation.dataQuality}%
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px;">
                        <div class="info-section">
                            <h4>Completeness</h4>
                            <div style="font-size: 24px; color: #3498db; text-align: center;">
                                ${validation.completeness}%
                            </div>
                        </div>
                        <div class="info-section">
                            <h4>Issues Found</h4>
                            <div style="font-size: 24px; color: ${validation.issues.length > 0 ? '#e74c3c' : '#2ecc71'}; text-align: center;">
                                ${validation.issues.length}
                            </div>
                        </div>
                    </div>
                    
                    ${validation.issues.length > 0 ? `
                        <div class="issues-list">
                            <h4 style="color: #3498db; margin-bottom: 15px;">Data Issues</h4>
                            ${validation.issues.map(issue => `
                                <div class="issue-item">
                                    <div class="issue-severity severity-${issue.severity}"></div>
                                    <div style="flex: 1;">
                                        <div style="color: #ecf0f1; font-weight: 500;">
                                            ${this.formatIssueType(issue.type)}
                                        </div>
                                        ${issue.details ? `
                                            <div style="color: #7f8c8d; font-size: 12px; margin-top: 5px;">
                                                ${issue.details}
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div style="color: #7f8c8d; font-size: 12px;">
                                        ${issue.severity}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 30px;">
                            <div style="font-size: 48px; color: #2ecc71; margin-bottom: 10px;">✓</div>
                            <div style="color: #ecf0f1; font-size: 18px;">No data quality issues found!</div>
                        </div>
                    `}
                </div>
            `;
        }
        
        // Helper methods
        calculateAge(birthdate) {
            const today = new Date();
            const birth = new Date(birthdate);
            let age = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
            return age;
        }
        
        formatIssueType(type) {
            const typeMap = {
                'missing_image': 'Missing Profile Image',
                'missing_birthdate': 'Missing Birthdate',
                'missing_ethnicity': 'Missing Ethnicity',
                'missing_country': 'Missing Country',
                'missing_measurements': 'Missing Measurements',
                'short_name': 'Name Too Short'
            };
            return typeMap[type] || type;
        }
        
        renderTimelineChart(timeline) {
            const months = Object.keys(timeline).sort();
            if (months.length === 0) {
                return '<div style="text-align: center; color: #7f8c8d;">No timeline data available</div>';
            }
            
            const maxCount = Math.max(...months.map(m => timeline[m].count));
            
            return `
                <div style="display: flex; align-items: flex-end; gap: 5px; height: 200px;">
                    ${months.slice(-12).map(month => {
                        const data = timeline[month];
                        const height = (data.count / maxCount) * 100;
                        return `
                            <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                                <div style="background: #3498db; width: 100%; height: ${height}%; min-height: 5px; border-radius: 4px 4px 0 0;" 
                                     title="${month}: ${data.count} scenes, ${data.averageViews} avg views"></div>
                                <div style="font-size: 10px; color: #7f8c8d; margin-top: 5px; transform: rotate(-45deg); transform-origin: center;">
                                    ${month.substring(5)}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
        
        openImageViewer(images, startIndex) {
            // Simple image viewer implementation
            const viewer = document.createElement('div');
            viewer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.9);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            
            let currentIndex = startIndex;
            
            viewer.innerHTML = `
                <img src="${images[currentIndex].url}" style="max-width: 90%; max-height: 90%; object-fit: contain;">
                <button style="position: absolute; top: 20px; right: 20px; background: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px;">Close</button>
                ${images.length > 1 ? `
                    <button style="position: absolute; left: 20px; top: 50%; transform: translateY(-50%); background: white; border: none; padding: 10px; cursor: pointer; border-radius: 4px;">◀</button>
                    <button style="position: absolute; right: 20px; top: 50%; transform: translateY(-50%); background: white; border: none; padding: 10px; cursor: pointer; border-radius: 4px;">▶</button>
                ` : ''}
            `;
            
            viewer.querySelector('button').addEventListener('click', () => {
                document.body.removeChild(viewer);
            });
            
            viewer.addEventListener('click', (e) => {
                if (e.target === viewer) {
                    document.body.removeChild(viewer);
                }
            });
            
            document.body.appendChild(viewer);
        }
        
        editPerformer() {
            // Navigate to Stash's edit page
            window.location.href = `/performers/${this.currentPerformerId}/edit`;
        }
        
        async exportPerformerData() {
            const exporter = new PerformerDataExporter(this.graphql, this.statisticsEngine);
            await exporter.exportPerformerData(this.currentPerformerId, 'json');
        }
        
        close() {
            this.container.style.display = 'none';
            this.currentPerformerId = null;
        }
    }

    // ===== UI COMPONENTS =====
    class PerformerManagerUI {
        constructor(searchEngine, imageManager, socialMediaIntegrator, statisticsEngine, relationshipMapper, dataValidator) {
            this.searchEngine = searchEngine;
            this.imageManager = imageManager;
            this.socialMediaIntegrator = socialMediaIntegrator;
            this.statisticsEngine = statisticsEngine;
            this.relationshipMapper = relationshipMapper;
            this.dataValidator = dataValidator;
            
            this.currentView = 'search';
            this.selectedPerformers = new Set();
            
            // Initialize detail widget
            this.detailWidget = new PerformerDetailWidget(
                searchEngine.graphql,
                statisticsEngine,
                relationshipMapper,
                dataValidator,
                imageManager
            );
            
            this.init();
        }

        init() {
            this.injectStyles();
            this.createMainInterface();
            this.attachEventListeners();
            this.setupKeyboardShortcuts();
            this.protectContainer();
        }
        
        protectContainer() {
            // Protect our search results container from external modifications
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.target.id === 'pm-search-results') {
                        const container = mutation.target;
                        // Check if external code is modifying our container
                        if (container.className !== 'performer-results-section' || 
                            container.style.display === 'none' ||
                            container.offsetWidth === 0) {
                            console.warn('🛡️ External modification detected, restoring container state');
                            container.className = 'performer-results-section';
                            container.style.display = 'block';
                            container.style.visibility = 'visible';
                            container.style.opacity = '1';
                            container.style.minHeight = '200px';
                            container.style.width = '100%';
                        }
                    }
                });
            });
            
            // Start observing once the container exists
            setTimeout(() => {
                const container = document.getElementById('pm-search-results');
                if (container) {
                    observer.observe(container, { 
                        attributes: true, 
                        attributeFilter: ['class', 'style']
                    });
                }
            }, 1000);
        }

        injectStyles() {
            GM_addStyle(`
                /* Main Container */
                .performer-manager-container {
                    position: fixed;
                    top: 60px;
                    right: 20px;
                    width: 400px;
                    max-height: calc(100vh - 100px);
                    height: calc(100vh - 100px);
                    background: #1a1a2e;
                    border: 1px solid #16213e;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    transition: all 0.3s ease;
                    overflow: hidden;
                }

                .performer-manager-container.minimized {
                    height: 50px;
                    overflow: hidden;
                }

                /* Header */
                .performer-manager-header {
                    padding: 15px;
                    background: linear-gradient(135deg, #1a1a2e, #16213e);
                    border-bottom: 1px solid #0f3460;
                    cursor: move;
                }

                .performer-manager-title {
                    color: #3498db;
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 10px;
                }

                .performer-manager-controls {
                    display: flex;
                    gap: 10px;
                    position: absolute;
                    top: 15px;
                    right: 15px;
                }

                .pm-control-btn {
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.3s;
                }

                .pm-control-btn:hover {
                    background: rgba(255,255,255,0.2);
                }

                /* Search Section */
                .performer-search-section {
                    padding: 15px;
                    border-bottom: 1px solid #0f3460;
                }

                .performer-search-box {
                    position: relative;
                    margin-bottom: 10px;
                }

                .performer-search-input {
                    width: 100%;
                    padding: 10px 40px 10px 15px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 4px;
                    color: white;
                    font-size: 14px;
                }

                .performer-search-input:focus {
                    outline: none;
                    border-color: #3498db;
                }

                .performer-search-icon {
                    position: absolute;
                    right: 15px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #7f8c8d;
                }

                /* Filter Section */
                .performer-filter-section {
                    padding: 10px 15px;
                    background: rgba(52, 152, 219, 0.1);
                    border-bottom: 1px solid #0f3460;
                }

                .performer-filter-toggle {
                    cursor: pointer;
                    color: #3498db;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }

                .performer-filter-panel {
                    margin-top: 10px;
                    display: none;
                }

                .performer-filter-panel.active {
                    display: block;
                }

                .filter-group {
                    margin-bottom: 15px;
                }

                .filter-label {
                    color: #ecf0f1;
                    font-size: 12px;
                    margin-bottom: 5px;
                    display: block;
                }

                .filter-range {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }

                .filter-input {
                    flex: 1;
                    padding: 5px 10px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 4px;
                    color: white;
                    font-size: 12px;
                }

                /* Results Section */
                .performer-results-section {
                    flex: 1;
                    overflow-y: auto;
                    padding: 15px;
                    min-height: 200px !important;
                    width: 100% !important;
                }
                
                #pm-search-results {
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    min-height: 200px !important;
                    width: 100% !important;
                }

                .performer-result-item {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 10px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 6px;
                    margin-bottom: 10px;
                    cursor: pointer;
                    transition: all 0.3s;
                }

                .performer-result-item:hover {
                    background: rgba(255,255,255,0.1);
                }

                .performer-result-item.selected {
                    background: rgba(52, 152, 219, 0.2);
                    border: 1px solid #3498db;
                }

                .performer-thumbnail {
                    width: 60px;
                    height: 80px;
                    border-radius: 4px;
                    object-fit: cover;
                    background: #0f3460;
                }

                .performer-info {
                    flex: 1;
                }

                .performer-name {
                    color: #ecf0f1;
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }

                .performer-stats {
                    display: flex;
                    gap: 15px;
                    font-size: 12px;
                    color: #7f8c8d;
                }

                .performer-stat {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }

                /* Active Filters Display */
                .active-filters {
                    padding: 10px 15px;
                    background: rgba(243, 156, 18, 0.1);
                    border-bottom: 1px solid #0f3460;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                }

                .filter-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 8px;
                    background: rgba(243, 156, 18, 0.2);
                    border: 1px solid #f39c12;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #f39c12;
                }

                .filter-tag-remove {
                    cursor: pointer;
                    font-weight: bold;
                }

                /* Statistics View */
                .performer-stats-view {
                    padding: 20px;
                    display: none;
                    overflow-y: auto;
                    max-height: calc(100vh - 200px);
                }

                .performer-stats-view.active {
                    display: block;
                }

                .stats-header {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    margin-bottom: 20px;
                }

                .stats-performer-image {
                    width: 80px;
                    height: 100px;
                    border-radius: 6px;
                    object-fit: cover;
                }

                .stats-performer-info h2 {
                    color: #ecf0f1;
                    margin-bottom: 5px;
                }

                .stats-performer-info p {
                    color: #7f8c8d;
                    font-size: 14px;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                    margin-bottom: 20px;
                }

                .stat-card {
                    background: rgba(255,255,255,0.05);
                    padding: 15px;
                    border-radius: 6px;
                    text-align: center;
                }

                .stat-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #3498db;
                    margin-bottom: 5px;
                }

                .stat-label {
                    color: #7f8c8d;
                    font-size: 12px;
                }

                /* Loading State */
                .loading-spinner {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border: 3px solid rgba(255,255,255,0.1);
                    border-radius: 50%;
                    border-top-color: #3498db;
                    animation: spin 1s ease-in-out infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                /* Scrollbar */
                .performer-results-section::-webkit-scrollbar,
                .performer-stats-view::-webkit-scrollbar {
                    width: 8px;
                }

                .performer-results-section::-webkit-scrollbar-track,
                .performer-stats-view::-webkit-scrollbar-track {
                    background: rgba(255,255,255,0.05);
                }

                .performer-results-section::-webkit-scrollbar-thumb,
                .performer-stats-view::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.2);
                    border-radius: 4px;
                }

                .performer-results-section::-webkit-scrollbar-thumb:hover,
                .performer-stats-view::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.3);
                }
            `);
        }

        createMainInterface() {
            const container = document.createElement('div');
            container.className = 'performer-manager-container';
            container.style.display = 'none'; // Start hidden
            container.innerHTML = `
                <div class="performer-manager-header">
                    <div class="performer-manager-title">🎭 Performer Manager Pro</div>
                    <div class="performer-manager-controls">
                        <button class="pm-control-btn" id="pm-minimize-btn" title="Minimize">−</button>
                        <button class="pm-control-btn" id="pm-close-btn" title="Close">×</button>
                    </div>
                </div>

                <div class="performer-search-section">
                    <div class="performer-search-box">
                        <input type="text" class="performer-search-input" id="performer-search" placeholder="Search performers...">
                        <span class="performer-search-icon">🔍</span>
                    </div>
                </div>
                
                <div class="performer-filter-section">
                    <div class="performer-filter-toggle">
                        <span>Advanced Filters</span>
                        <span id="filter-toggle-icon">▼</span>
                    </div>
                    <div class="performer-filter-panel" id="filter-panel">
                        <div class="filter-group">
                            <label class="filter-label">Age Range</label>
                            <div class="filter-range">
                                <input type="number" class="filter-input" id="age-min" placeholder="Min" min="18" max="100">
                                <span>-</span>
                                <input type="number" class="filter-input" id="age-max" placeholder="Max" min="18" max="100">
                            </div>
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">Scene Count</label>
                            <div class="filter-range">
                                <input type="number" class="filter-input" id="scene-min" placeholder="Min" min="0">
                                <span>-</span>
                                <input type="number" class="filter-input" id="scene-max" placeholder="Max" min="0">
                            </div>
                        </div>
                        <div class="filter-group">
                            <label class="filter-label">
                                <input type="checkbox" id="has-image-filter"> Has Image
                            </label>
                        </div>
                    </div>
                </div>

                <div class="active-filters" id="active-filters" style="display: none;"></div>

                <div class="performer-results-section" id="pm-search-results">
                    <div class="search-placeholder" style="text-align: center; color: #7f8c8d; padding: 20px;">
                        Enter a search term or use filters to find performers
                    </div>
                </div>

                <div class="performer-stats-view" id="pm-stats-view"></div>
            `;

            document.body.appendChild(container);
            this.container = container;
        }

        attachEventListeners() {
            // Search functionality
            const searchInput = document.getElementById('performer-search');
            searchInput.addEventListener('input', Utils.debounce(() => {
                this.performSearch();
            }, CONFIG.SEARCH_DEBOUNCE_DELAY));

            // Filter toggle
            document.querySelector('.performer-filter-toggle').addEventListener('click', () => {
                this.toggleFilterPanel();
            });

            // Filter inputs
            const filterInputs = ['age-min', 'age-max', 'scene-min', 'scene-max'];
            filterInputs.forEach(id => {
                document.getElementById(id).addEventListener('change', () => {
                    this.updateFilters();
                });
            });

            document.getElementById('has-image-filter').addEventListener('change', () => {
                this.updateFilters();
            });

            // Control buttons
            document.getElementById('pm-minimize-btn').addEventListener('click', () => {
                this.toggleMinimize();
            });

            document.getElementById('pm-close-btn').addEventListener('click', () => {
                this.close();
            });

            // Make header draggable
            this.makeDraggable();
        }

        makeDraggable() {
            const header = this.container.querySelector('.performer-manager-header');
            let isDragging = false;
            let currentX;
            let currentY;
            let initialX;
            let initialY;
            let xOffset = 0;
            let yOffset = 0;

            const dragStart = (e) => {
                if (e.target.closest('.performer-manager-controls')) return;
                
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
                isDragging = true;
            };

            const dragEnd = () => {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
            };

            const drag = (e) => {
                if (!isDragging) return;
                
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;

                this.container.style.transform = `translate(${currentX}px, ${currentY}px)`;
            };

            header.addEventListener('mousedown', dragStart);
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', dragEnd);
        }

        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Ctrl/Cmd + Shift + P to toggle performer manager
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
                    e.preventDefault();
                    this.toggle();
                }
                
                // ESC to close
                if (e.key === 'Escape' && this.container.style.display !== 'none') {
                    this.close();
                }
            });
        }

        async performSearch() {
            const query = document.getElementById('performer-search').value;
            const resultsContainer = document.getElementById('pm-search-results');
            
            console.log('🔍 Performing search for:', query);
            
            // Ensure we're in search view
            if (this.currentView !== 'search') {
                this.showSearchView();
            }
            
            // Show loading state
            resultsContainer.innerHTML = '<div style="text-align: center; padding: 20px;"><div class="loading-spinner"></div></div>';
            
            try {
                const results = await this.searchEngine.search(query, { limit: CONFIG.MAX_SEARCH_RESULTS });
                console.log('📊 Search results:', results);
                this.displaySearchResults(results);
            } catch (error) {
                console.error('❌ Search error:', error);
                resultsContainer.innerHTML = `<div style="text-align: center; color: #e74c3c; padding: 20px;">Error: ${error.message}</div>`;
            }
        }

        displaySearchResults(results) {
            const resultsContainer = document.getElementById('pm-search-results');
            console.log('📋 Display search results called with:', results);
            console.log('🎯 Results container:', resultsContainer);
            
            if (!results || !results.results || results.results.length === 0) {
                console.log('⚠️ No results to display');
                resultsContainer.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 20px;">No performers found</div>';
                return;
            }

            console.log(`✨ Creating HTML for ${results.results.length} performers`);
            const html = results.results.map(performer => `
                <div class="performer-result-item" data-performer-id="${performer.id}">
                    <img class="performer-thumbnail" src="${performer.image_path || '/assets/no-image.png'}" alt="${performer.name}">
                    <div class="performer-info">
                        <div class="performer-name">${performer.name}</div>
                        <div class="performer-stats">
                            <span class="performer-stat">📹 ${performer.scene_count || 0} scenes</span>
                            ${performer.rating100 ? `<span class="performer-stat">⭐ ${Math.round(performer.rating100 / 20)}/5</span>` : ''}
                        </div>
                    </div>
                </div>
            `).join('');

            console.log('🎨 Generated HTML length:', html.length);
            
            // Clear any existing content first
            resultsContainer.innerHTML = '';
            
            // Insert the new HTML
            resultsContainer.innerHTML = html;
            
            // Ensure the container is visible and remove any conflicting classes
            resultsContainer.className = 'performer-results-section';
            resultsContainer.style.display = 'block';
            resultsContainer.style.visibility = 'visible';
            resultsContainer.style.opacity = '1';
            resultsContainer.style.minHeight = '200px';
            resultsContainer.style.width = '100%';
            
            // Force a reflow to ensure changes are applied
            resultsContainer.offsetHeight;
            
            console.log('✅ HTML inserted into container');
            console.log('🔍 Container display:', resultsContainer.style.display);
            console.log('👁️ Container visibility:', resultsContainer.style.visibility);
            console.log('📐 Container dimensions:', resultsContainer.offsetWidth, 'x', resultsContainer.offsetHeight);
            console.log('📄 Container content length:', resultsContainer.innerHTML.length);
            console.log('🏠 Parent container display:', this.container.style.display);
            console.log('🎯 First result item:', resultsContainer.querySelector('.performer-result-item'));
            
            // Check if results are actually visible
            const firstResult = resultsContainer.querySelector('.performer-result-item');
            if (firstResult) {
                const rect = firstResult.getBoundingClientRect();
                console.log('📍 First result position:', rect);
                console.log('👀 First result visible:', rect.width > 0 && rect.height > 0);
            }

            // Add click handlers
            resultsContainer.querySelectorAll('.performer-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.selectPerformer(item.dataset.performerId);
                });
            });
        }

        updateFilters() {
            // Age filter
            const ageMin = document.getElementById('age-min').value;
            const ageMax = document.getElementById('age-max').value;
            if (ageMin || ageMax) {
                this.searchEngine.addFilter('age_range', {
                    min: parseInt(ageMin) || 18,
                    max: parseInt(ageMax) || 100
                });
            } else {
                this.searchEngine.removeFilter('age_range');
            }

            // Scene count filter
            const sceneMin = document.getElementById('scene-min').value;
            const sceneMax = document.getElementById('scene-max').value;
            if (sceneMin || sceneMax) {
                this.searchEngine.addFilter('scene_count', {
                    min: parseInt(sceneMin) || 0,
                    max: parseInt(sceneMax) || 999999
                });
            } else {
                this.searchEngine.removeFilter('scene_count');
            }

            // Has image filter
            const hasImage = document.getElementById('has-image-filter').checked;
            if (hasImage) {
                this.searchEngine.addFilter('has_image', true);
            } else {
                this.searchEngine.removeFilter('has_image');
            }

            this.displayActiveFilters();
            this.performSearch();
        }

        displayActiveFilters() {
            const activeFilters = this.searchEngine.getActiveFilters();
            const container = document.getElementById('active-filters');
            
            if (activeFilters.length === 0) {
                container.style.display = 'none';
                return;
            }

            container.style.display = 'flex';
            container.innerHTML = activeFilters.map(([type, value]) => {
                let label = '';
                switch (type) {
                    case 'age_range':
                        label = `Age: ${value.min}-${value.max}`;
                        break;
                    case 'scene_count':
                        label = `Scenes: ${value.min}-${value.max}`;
                        break;
                    case 'has_image':
                        label = 'Has Image';
                        break;
                    default:
                        label = type;
                }
                
                return `
                    <span class="filter-tag">
                        ${label}
                        <span class="filter-tag-remove" data-filter="${type}">×</span>
                    </span>
                `;
            }).join('');

            // Add remove handlers
            container.querySelectorAll('.filter-tag-remove').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.searchEngine.removeFilter(btn.dataset.filter);
                    this.displayActiveFilters();
                    this.performSearch();
                });
            });
        }

        async selectPerformer(performerId) {
            // Open the detail widget for the selected performer
            try {
                await this.detailWidget.open(performerId);
            } catch (error) {
                console.error('Failed to open performer details:', error);
                alert(`Failed to open performer details: ${error.message}`);
            }
        }

        displayPerformerStats(performer, stats) {
            const statsView = document.getElementById('pm-stats-view');
            
            statsView.innerHTML = `
                <div style="position: sticky; top: 0; background: #1a1a2e; padding-bottom: 10px; z-index: 10;">
                    <button class="pm-control-btn" onclick="performerManager.showSearchView()">← Back to Search</button>
                </div>
                
                <div class="stats-header" style="margin-top: 15px;">
                    <img class="stats-performer-image" src="${performer.image_path || '/assets/no-image.png'}" alt="${performer.name}">
                    <div class="stats-performer-info">
                        <h2>${performer.name}</h2>
                    </div>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${stats.basic.sceneCount}</div>
                        <div class="stat-label">Total Scenes</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.basic.totalDuration > 0 ? Utils.formatDuration(stats.basic.totalDuration) : 'N/A'}</div>
                        <div class="stat-label">Total Duration</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${Math.round(stats.basic.averageRating / 20)}/5</div>
                        <div class="stat-label">Average Rating</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.popularity.popularityScore}</div>
                        <div class="stat-label">Popularity Score</div>
                    </div>
                </div>

                <div style="margin-top: 20px;">
                    <h3 style="color: #3498db; margin-bottom: 10px;">Activity Trend</h3>
                    <p style="color: #ecf0f1;">Trend: <span style="color: ${stats.trends.trend === 'increasing' ? '#2ecc71' : stats.trends.trend === 'decreasing' ? '#e74c3c' : '#f39c12'}">${stats.trends.trend}</span></p>
                    <p style="color: #7f8c8d; font-size: 14px;">Recent average views: ${stats.trends.recentAverage} (${stats.trends.percentChange > 0 ? '+' : ''}${stats.trends.percentChange}%)</p>
                </div>

                ${stats.collaborations.frequent.length > 0 ? `
                    <div style="margin-top: 20px;">
                        <h3 style="color: #3498db; margin-bottom: 10px;">Frequent Collaborators</h3>
                        <div style="color: #ecf0f1; font-size: 14px;">
                            ${stats.collaborations.frequent.slice(0, 5).map(collab => 
                                `<div style="margin-bottom: 5px;">${collab.name} (${collab.sceneCount} scenes)</div>`
                            ).join('')}
                        </div>
                    </div>
                ` : ''}
            `;
        }

        showSearchView() {
            this.currentView = 'search';
            const statsView = document.getElementById('pm-stats-view');
            const searchResults = document.getElementById('pm-search-results');
            
            // Hide stats view
            statsView.style.display = 'none';
            statsView.classList.remove('active');
            
            // Show search results
            searchResults.style.display = 'block';
            searchResults.style.visibility = 'visible';
            searchResults.style.opacity = '1';
            
            console.log('🔄 Switched to search view');
            console.log('📊 Stats view display:', statsView.style.display);
            console.log('🔍 Search results display:', searchResults.style.display);
        }

        toggleFilterPanel() {
            const panel = document.getElementById('filter-panel');
            const icon = document.getElementById('filter-toggle-icon');
            
            if (panel.classList.contains('active')) {
                panel.classList.remove('active');
                icon.textContent = '▼';
            } else {
                panel.classList.add('active');
                icon.textContent = '▲';
            }
        }

        toggleMinimize() {
            this.container.classList.toggle('minimized');
            const btn = document.getElementById('pm-minimize-btn');
            btn.textContent = this.container.classList.contains('minimized') ? '+' : '−';
        }

        toggle() {
            if (this.container.style.display === 'none') {
                this.container.style.display = 'flex';
            } else {
                this.container.style.display = 'none';
            }
        }

        close() {
            this.container.style.display = 'none';
        }
    }

    // ===== INITIALIZATION =====
    let performerManager;

    function createToggleButton() {
        // Try multiple navbar selectors
        const navbarSelectors = [
            '.navbar-nav',
            '.nav',
            'ul.navbar-nav',
            'nav ul',
            '.navbar .nav'
        ];

        let navbar = null;
        for (const selector of navbarSelectors) {
            navbar = document.querySelector(selector);
            if (navbar) break;
        }

        if (!navbar) {
            console.warn('Performer Manager Pro: Navbar not found, retrying...');
            setTimeout(createToggleButton, 1000);
            return;
        }

        // Check if button already exists
        if (document.getElementById('performer-manager-toggle')) {
            return;
        }

        const toggleButton = document.createElement('li');
        toggleButton.className = 'nav-item';
        toggleButton.innerHTML = `
            <a id="performer-manager-toggle" class="nav-link" href="#" style="cursor: pointer;">
                🎭 Performers
            </a>
        `;

        toggleButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (performerManager) {
                performerManager.toggle();
            } else {
                console.warn('Performer Manager Pro: Not initialized yet');
            }
        });

        navbar.appendChild(toggleButton);
        console.log('✅ Performer Manager Pro: Toggle button added to navbar');
    }

    function initialize() {
        console.log('🎭 Performer Manager Pro: Initializing...');

        // Create toggle button as soon as possible
        createToggleButton();

        // Wait for Stash to load
        const checkInterval = setInterval(() => {
            if (document.querySelector('.main') || document.querySelector('[data-rb-event-key]')) {
                clearInterval(checkInterval);
                
                // Initialize components
                const graphqlClient = new GraphQLClient();
                const searchEngine = new PerformerSearchEngine(graphqlClient);
                const imageManager = new PerformerImageManager(graphqlClient);
                const socialMediaIntegrator = new SocialMediaIntegrator();
                const statisticsEngine = new PerformerStatisticsEngine(graphqlClient);
                const relationshipMapper = new PerformerRelationshipMapper(graphqlClient);
                const dataValidator = new PerformerDataValidator(graphqlClient);
                
                // Create UI
                performerManager = new PerformerManagerUI(
                    searchEngine,
                    imageManager,
                    socialMediaIntegrator,
                    statisticsEngine,
                    relationshipMapper,
                    dataValidator
                );
                
                // Make globally accessible for debugging
                window.performerManager = performerManager;
                
                // Ensure toggle button exists
                createToggleButton();
                
                console.log('✅ Performer Manager Pro: Ready!');
            }
        }, 1000);
    }

    // Start initialization
    initialize();
})();