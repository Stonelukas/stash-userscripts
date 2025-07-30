// ==UserScript==
// @name         Stash Collection Organizer
// @namespace    https://github.com/example/stash-userscripts
// @version      1.0.2
// @description  Intelligent organization suggestions, file naming standardization, metadata analysis, and collection health monitoring for Stash
// @author       Your Name
// @match        http://localhost:9998/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        // Organization Settings
        DEFAULT_FOLDER_DEPTH: 2,
        MAX_FOLDER_DEPTH: 4,
        DEFAULT_GROUPING: 'performer', // 'performer', 'studio', 'genre', 'date'
        
        // Naming Settings
        DEFAULT_NAMING_TEMPLATE: '{performer} - {studio} - {title}',
        MAX_FILENAME_LENGTH: 255,
        SANITIZE_SPECIAL_CHARS: true,
        
        // Analysis Settings
        BATCH_SIZE: 100,
        ANALYSIS_TIMEOUT: 30000,
        CACHE_DURATION: 3600000, // 1 hour
        
        // UI Settings
        PREVIEW_ITEMS: 10,
        ENABLE_ANIMATIONS: true,
        DARK_THEME: true,
        
        // Storage Keys
        SETTINGS_KEY: 'collection_organizer_settings',
        CACHE_KEY: 'collection_organizer_cache',
        RULES_KEY: 'collection_organizer_rules'
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

        sanitizeFilename(filename) {
            // Remove or replace special characters
            let sanitized = filename.replace(/[<>:"/\\|?*]/g, '_');
            
            // Trim to max length
            if (sanitized.length > CONFIG.MAX_FILENAME_LENGTH) {
                const extension = sanitized.split('.').pop();
                const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
                const maxNameLength = CONFIG.MAX_FILENAME_LENGTH - extension.length - 1;
                sanitized = nameWithoutExt.substring(0, maxNameLength) + '.' + extension;
            }
            
            return sanitized.trim();
        },

        formatDate(dateStr) {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            return date.toISOString().split('T')[0]; // YYYY-MM-DD
        },

        formatDuration(seconds) {
            if (!seconds) return '';
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;
        },

        calculateSimilarity(str1, str2) {
            const longer = str1.length > str2.length ? str1 : str2;
            const shorter = str1.length > str2.length ? str2 : str1;
            
            if (longer.length === 0) return 1.0;
            
            const editDistance = this.levenshteinDistance(longer, shorter);
            return (longer.length - editDistance) / parseFloat(longer.length);
        },

        levenshteinDistance(str1, str2) {
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
        }
    };

    // ===== GRAPHQL CLIENT =====
    class GraphQLClient {
        constructor() {
            this.endpoint = '/graphql';
        }

        async query(query, variables = {}) {
            console.log('GraphQL Query:', query.substring(0, 100) + '...');
            try {
                const response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ query, variables })
                });

                const data = await response.json();
                console.log('GraphQL Response:', data);
                
                if (data.errors) {
                    console.error('GraphQL errors:', data.errors);
                    throw new Error(data.errors[0].message);
                }

                return data.data;
            } catch (error) {
                console.error('GraphQL query failed:', error);
                throw error;
            }
        }

        async getAllScenes(filter = {}) {
            const query = `
                query FindScenes($filter: SceneFilterType) {
                    findScenes(scene_filter: $filter) {
                        count
                        scenes {
                            id
                            title
                            date
                            rating100
                            o_counter
                            organized
                            paths {
                                screenshot
                            }
                            file {
                                path
                                size
                                duration
                                video_codec
                                audio_codec
                                width
                                height
                                framerate
                                bit_rate
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
                            galleries {
                                id
                                title
                            }
                            movies {
                                movie {
                                    id
                                    name
                                }
                            }
                        }
                    }
                }
            `;
            
            return this.query(query, { filter });
        }

        async updateScenePaths(sceneId, newPath) {
            const mutation = `
                mutation SceneUpdate($input: SceneUpdateInput!) {
                    sceneUpdate(input: $input) {
                        id
                        file {
                            path
                        }
                    }
                }
            `;
            
            return this.query(mutation, {
                input: {
                    id: sceneId,
                    file_path: newPath
                }
            });
        }

        async getSystemStats() {
            const query = `
                query Stats {
                    stats {
                        scene_count
                        performer_count
                        studio_count
                        tag_count
                        total_size
                    }
                }
            `;
            
            return this.query(query);
        }
    }

    // ===== PATTERN ANALYSIS ENGINE =====
    class PatternAnalysisEngine {
        constructor(graphqlClient) {
            this.graphql = graphqlClient;
            this.patterns = {
                folder: new Map(),
                naming: new Map(),
                metadata: new Map()
            };
        }

        async analyzeExistingPatterns(scenes) {
            console.log('🔍 Analyzing existing organization patterns...');
            
            const analysis = {
                folderStructures: this.analyzeFolderPatterns(scenes),
                namingConventions: this.analyzeNamingPatterns(scenes),
                metadataUsage: this.analyzeMetadataPatterns(scenes),
                organizationPreferences: this.inferUserPreferences(scenes)
            };
            
            console.log('📊 Pattern analysis complete:', analysis);
            return analysis;
        }

        analyzeFolderPatterns(scenes) {
            const folderPatterns = new Map();
            
            scenes.forEach(scene => {
                if (!scene.file?.path) return;
                
                const pathParts = scene.file.path.split(/[/\\]/);
                pathParts.pop(); // Remove filename
                
                // Analyze folder depth
                const depth = pathParts.length;
                
                // Analyze folder structure patterns
                if (pathParts.length > 0) {
                    const pattern = this.detectFolderPattern(pathParts, scene);
                    const key = pattern.type;
                    
                    if (!folderPatterns.has(key)) {
                        folderPatterns.set(key, {
                            type: pattern.type,
                            count: 0,
                            examples: [],
                            depth: []
                        });
                    }
                    
                    const patternData = folderPatterns.get(key);
                    patternData.count++;
                    patternData.depth.push(depth);
                    
                    if (patternData.examples.length < 5) {
                        patternData.examples.push({
                            path: pathParts.join('/'),
                            scene: scene.title
                        });
                    }
                }
            });
            
            return {
                patterns: Array.from(folderPatterns.values()),
                averageDepth: this.calculateAverageDepth(folderPatterns),
                mostCommon: this.getMostCommonPattern(folderPatterns)
            };
        }

        detectFolderPattern(pathParts, scene) {
            // Check for performer-based organization
            if (scene.performers?.length > 0) {
                const performerNames = scene.performers.map(p => p.name.toLowerCase());
                const hasPerformerFolder = pathParts.some(part => 
                    performerNames.some(name => part.toLowerCase().includes(name))
                );
                if (hasPerformerFolder) {
                    return { type: 'performer-based' };
                }
            }
            
            // Check for studio-based organization
            if (scene.studio) {
                const studioName = scene.studio.name.toLowerCase();
                const hasStudioFolder = pathParts.some(part => 
                    part.toLowerCase().includes(studioName)
                );
                if (hasStudioFolder) {
                    return { type: 'studio-based' };
                }
            }
            
            // Check for date-based organization
            const datePattern = /\d{4}[-_]?\d{2}[-_]?\d{2}|\d{4}/;
            const hasDateFolder = pathParts.some(part => datePattern.test(part));
            if (hasDateFolder) {
                return { type: 'date-based' };
            }
            
            // Check for genre/tag-based organization
            if (scene.tags?.length > 0) {
                const tagNames = scene.tags.map(t => t.name.toLowerCase());
                const hasTagFolder = pathParts.some(part => 
                    tagNames.some(tag => part.toLowerCase().includes(tag))
                );
                if (hasTagFolder) {
                    return { type: 'tag-based' };
                }
            }
            
            return { type: 'custom' };
        }

        analyzeNamingPatterns(scenes) {
            const namingPatterns = new Map();
            
            scenes.forEach(scene => {
                if (!scene.file?.path) return;
                
                const filename = scene.file.path.split(/[/\\]/).pop();
                const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.') || filename.length);
                
                const pattern = this.detectNamingPattern(nameWithoutExt, scene);
                const key = pattern.template;
                
                if (!namingPatterns.has(key)) {
                    namingPatterns.set(key, {
                        template: pattern.template,
                        count: 0,
                        examples: [],
                        consistency: 0
                    });
                }
                
                const patternData = namingPatterns.get(key);
                patternData.count++;
                
                if (patternData.examples.length < 5) {
                    patternData.examples.push({
                        filename: filename,
                        scene: scene.title
                    });
                }
            });
            
            return {
                patterns: Array.from(namingPatterns.values()),
                consistency: this.calculateNamingConsistency(namingPatterns, scenes.length),
                mostCommon: this.getMostCommonPattern(namingPatterns)
            };
        }

        detectNamingPattern(filename, scene) {
            const components = [];
            
            // Check for performer names
            if (scene.performers?.length > 0) {
                const hasPerformer = scene.performers.some(p => 
                    filename.toLowerCase().includes(p.name.toLowerCase())
                );
                if (hasPerformer) components.push('performer');
            }
            
            // Check for studio name
            if (scene.studio && filename.toLowerCase().includes(scene.studio.name.toLowerCase())) {
                components.push('studio');
            }
            
            // Check for date
            const datePattern = /\d{4}[-_]?\d{2}[-_]?\d{2}|\d{8}/;
            if (datePattern.test(filename)) {
                components.push('date');
            }
            
            // Check for title
            if (scene.title && filename.toLowerCase().includes(scene.title.toLowerCase())) {
                components.push('title');
            }
            
            // Determine template based on component order
            const template = components.length > 0 ? 
                `{${components.join('} - {')}}` : 
                'custom';
            
            return { template, components };
        }

        analyzeMetadataPatterns(scenes) {
            const metadataCompleteness = {
                overall: 0,
                byField: {},
                distribution: {
                    complete: 0,
                    partial: 0,
                    minimal: 0
                }
            };
            
            const fields = ['title', 'performers', 'studio', 'date', 'tags', 'rating100'];
            
            fields.forEach(field => {
                metadataCompleteness.byField[field] = 0;
            });
            
            scenes.forEach(scene => {
                let fieldCount = 0;
                
                fields.forEach(field => {
                    let hasField = false;
                    
                    switch (field) {
                        case 'performers':
                            hasField = scene.performers && scene.performers.length > 0;
                            break;
                        case 'tags':
                            hasField = scene.tags && scene.tags.length > 0;
                            break;
                        case 'studio':
                            hasField = scene.studio !== null;
                            break;
                        default:
                            hasField = scene[field] !== null && scene[field] !== undefined;
                    }
                    
                    if (hasField) {
                        metadataCompleteness.byField[field]++;
                        fieldCount++;
                    }
                });
                
                const completenessRatio = fieldCount / fields.length;
                metadataCompleteness.overall += completenessRatio;
                
                if (completenessRatio >= 0.8) {
                    metadataCompleteness.distribution.complete++;
                } else if (completenessRatio >= 0.5) {
                    metadataCompleteness.distribution.partial++;
                } else {
                    metadataCompleteness.distribution.minimal++;
                }
            });
            
            // Calculate percentages
            metadataCompleteness.overall = (metadataCompleteness.overall / scenes.length) * 100;
            
            fields.forEach(field => {
                metadataCompleteness.byField[field] = 
                    (metadataCompleteness.byField[field] / scenes.length) * 100;
            });
            
            return metadataCompleteness;
        }

        inferUserPreferences(scenes) {
            const folderAnalysis = this.analyzeFolderPatterns(scenes);
            const namingAnalysis = this.analyzeNamingPatterns(scenes);
            const metadataAnalysis = this.analyzeMetadataPatterns(scenes);
            
            return {
                preferredGrouping: folderAnalysis.mostCommon?.type || 'performer-based',
                namingStyle: namingAnalysis.mostCommon?.template || '{performer} - {studio} - {title}',
                folderDepth: Math.round(folderAnalysis.averageDepth) || 2,
                metadataPriority: this.determineMetadataPriority(metadataAnalysis.byField),
                organizationConsistency: this.calculateOverallConsistency(folderAnalysis, namingAnalysis)
            };
        }

        determineMetadataPriority(fieldCompleteness) {
            return Object.entries(fieldCompleteness)
                .sort((a, b) => b[1] - a[1])
                .map(([field]) => field);
        }

        calculateOverallConsistency(folderAnalysis, namingAnalysis) {
            const folderConsistency = folderAnalysis.mostCommon ? 
                (folderAnalysis.mostCommon.count / folderAnalysis.patterns.reduce((sum, p) => sum + p.count, 0)) : 0;
            
            const namingConsistency = namingAnalysis.consistency / 100;
            
            return ((folderConsistency + namingConsistency) / 2) * 100;
        }

        calculateAverageDepth(folderPatterns) {
            let totalDepth = 0;
            let totalCount = 0;
            
            folderPatterns.forEach(pattern => {
                totalDepth += pattern.depth.reduce((sum, d) => sum + d, 0);
                totalCount += pattern.depth.length;
            });
            
            return totalCount > 0 ? totalDepth / totalCount : 0;
        }

        calculateNamingConsistency(namingPatterns, totalScenes) {
            if (namingPatterns.size === 0) return 0;
            
            const mostCommon = this.getMostCommonPattern(namingPatterns);
            return mostCommon ? (mostCommon.count / totalScenes) * 100 : 0;
        }

        getMostCommonPattern(patterns) {
            let mostCommon = null;
            let maxCount = 0;
            
            patterns.forEach(pattern => {
                if (pattern.count > maxCount) {
                    maxCount = pattern.count;
                    mostCommon = pattern;
                }
            });
            
            return mostCommon;
        }

        generateOrganizationSuggestions(patterns, scenes) {
            const suggestions = {
                folderReorganization: this.suggestFolderStructure(patterns, scenes),
                fileRenaming: this.suggestNamingImprovements(patterns, scenes),
                metadataEnhancements: this.suggestMetadataImprovements(patterns, scenes)
            };
            
            return suggestions;
        }

        suggestFolderStructure(patterns, scenes) {
            const { organizationPreferences } = patterns;
            const suggestions = [];
            
            // Analyze current organization issues
            const issues = this.identifyOrganizationIssues(scenes);
            
            // Generate folder structure based on preferences
            const structure = this.generateOptimalStructure(
                organizationPreferences.preferredGrouping,
                organizationPreferences.folderDepth,
                scenes
            );
            
            return {
                issues,
                proposedStructure: structure,
                estimatedChanges: this.calculateStructureChanges(scenes, structure)
            };
        }

        identifyOrganizationIssues(scenes) {
            const issues = [];
            
            // Check for scattered files
            const performerScenes = new Map();
            scenes.forEach(scene => {
                scene.performers?.forEach(performer => {
                    if (!performerScenes.has(performer.id)) {
                        performerScenes.set(performer.id, new Set());
                    }
                    const folder = scene.file?.path?.split(/[/\\]/).slice(0, -1).join('/');
                    if (folder) {
                        performerScenes.get(performer.id).add(folder);
                    }
                });
            });
            
            performerScenes.forEach((folders, performerId) => {
                if (folders.size > 3) {
                    issues.push({
                        type: 'scattered_performer',
                        severity: 'medium',
                        description: `Performer's scenes are scattered across ${folders.size} different folders`,
                        affectedItems: performerId
                    });
                }
            });
            
            // Check for deep nesting
            scenes.forEach(scene => {
                if (scene.file?.path) {
                    const depth = scene.file.path.split(/[/\\]/).length - 1;
                    if (depth > CONFIG.MAX_FOLDER_DEPTH) {
                        issues.push({
                            type: 'deep_nesting',
                            severity: 'low',
                            description: `File nested ${depth} levels deep`,
                            affectedItems: scene.id
                        });
                    }
                }
            });
            
            return issues;
        }

        generateOptimalStructure(groupingType, targetDepth, scenes) {
            const structure = new Map();
            
            scenes.forEach(scene => {
                const path = this.calculateOptimalPath(scene, groupingType, targetDepth);
                
                if (!structure.has(path)) {
                    structure.set(path, {
                        scenes: [],
                        metadata: this.extractPathMetadata(path, groupingType)
                    });
                }
                
                structure.get(path).scenes.push({
                    id: scene.id,
                    title: scene.title,
                    currentPath: scene.file?.path
                });
            });
            
            return Array.from(structure.entries()).map(([path, data]) => ({
                path,
                ...data
            }));
        }

        calculateOptimalPath(scene, groupingType, targetDepth) {
            const pathComponents = [];
            
            switch (groupingType) {
                case 'performer-based':
                    if (scene.performers?.length > 0) {
                        // Use primary performer
                        pathComponents.push('Performers');
                        pathComponents.push(Utils.sanitizeFilename(scene.performers[0].name));
                        
                        if (targetDepth > 2 && scene.studio) {
                            pathComponents.push(Utils.sanitizeFilename(scene.studio.name));
                        }
                    }
                    break;
                    
                case 'studio-based':
                    if (scene.studio) {
                        pathComponents.push('Studios');
                        pathComponents.push(Utils.sanitizeFilename(scene.studio.name));
                        
                        if (targetDepth > 2 && scene.date) {
                            const year = new Date(scene.date).getFullYear();
                            pathComponents.push(year.toString());
                        }
                    }
                    break;
                    
                case 'date-based':
                    if (scene.date) {
                        const date = new Date(scene.date);
                        pathComponents.push(date.getFullYear().toString());
                        pathComponents.push(String(date.getMonth() + 1).padStart(2, '0'));
                        
                        if (targetDepth > 2 && scene.studio) {
                            pathComponents.push(Utils.sanitizeFilename(scene.studio.name));
                        }
                    }
                    break;
                    
                case 'tag-based':
                    if (scene.tags?.length > 0) {
                        pathComponents.push('Tags');
                        // Use primary/first tag
                        pathComponents.push(Utils.sanitizeFilename(scene.tags[0].name));
                        
                        if (targetDepth > 2 && scene.performers?.length > 0) {
                            pathComponents.push(Utils.sanitizeFilename(scene.performers[0].name));
                        }
                    }
                    break;
                    
                default:
                    pathComponents.push('Unsorted');
            }
            
            // Fallback for scenes that don't fit the grouping
            if (pathComponents.length === 0) {
                pathComponents.push('Unsorted');
            }
            
            return pathComponents.join('/');
        }

        extractPathMetadata(path, groupingType) {
            const components = path.split('/');
            const metadata = {
                type: groupingType,
                primary: components[1] || 'Unknown',
                secondary: components[2] || null
            };
            
            return metadata;
        }

        calculateStructureChanges(scenes, proposedStructure) {
            let changes = 0;
            let unchanged = 0;
            
            proposedStructure.forEach(folder => {
                folder.scenes.forEach(scene => {
                    if (scene.currentPath) {
                        const currentFolder = scene.currentPath.split(/[/\\]/).slice(0, -1).join('/');
                        if (currentFolder !== folder.path) {
                            changes++;
                        } else {
                            unchanged++;
                        }
                    }
                });
            });
            
            return {
                total: scenes.length,
                toMove: changes,
                toStay: unchanged,
                percentageChange: (changes / scenes.length) * 100
            };
        }

        suggestNamingImprovements(patterns, scenes) {
            const { organizationPreferences, namingConventions } = patterns;
            
            const inconsistentFiles = [];
            const suggestedNames = new Map();
            
            scenes.forEach(scene => {
                if (!scene.file?.path) return;
                
                const currentFilename = scene.file.path.split(/[/\\]/).pop();
                const suggestedFilename = this.generateStandardName(
                    scene,
                    organizationPreferences.namingStyle
                );
                
                if (currentFilename !== suggestedFilename) {
                    inconsistentFiles.push({
                        sceneId: scene.id,
                        current: currentFilename,
                        suggested: suggestedFilename,
                        reason: this.determineNamingIssue(currentFilename, scene)
                    });
                    
                    suggestedNames.set(scene.id, suggestedFilename);
                }
            });
            
            return {
                inconsistentCount: inconsistentFiles.length,
                consistencyScore: ((scenes.length - inconsistentFiles.length) / scenes.length) * 100,
                suggestions: inconsistentFiles.slice(0, CONFIG.PREVIEW_ITEMS),
                template: organizationPreferences.namingStyle
            };
        }

        generateStandardName(scene, template) {
            const extension = scene.file?.path ? 
                scene.file.path.split('.').pop() : 'mp4';
            
            const tokens = {
                performer: scene.performers?.map(p => p.name).join(', ') || 'Unknown',
                studio: scene.studio?.name || 'Unknown',
                title: scene.title || 'Untitled',
                date: Utils.formatDate(scene.date),
                resolution: this.getResolution(scene.file),
                duration: Utils.formatDuration(scene.file?.duration)
            };
            
            let filename = template;
            Object.entries(tokens).forEach(([key, value]) => {
                filename = filename.replace(`{${key}}`, value);
            });
            
            // Remove empty tokens
            filename = filename.replace(/\s*-\s*-\s*/g, ' - ');
            filename = filename.replace(/^\s*-\s*|\s*-\s*$/g, '');
            
            return Utils.sanitizeFilename(filename) + '.' + extension;
        }

        getResolution(file) {
            if (!file?.width || !file?.height) return '';
            
            if (file.height >= 2160) return '4K';
            if (file.height >= 1080) return '1080p';
            if (file.height >= 720) return '720p';
            if (file.height >= 480) return '480p';
            return 'SD';
        }

        determineNamingIssue(filename, scene) {
            const issues = [];
            
            // Check for missing key information
            if (scene.performers?.length > 0 && 
                !scene.performers.some(p => filename.toLowerCase().includes(p.name.toLowerCase()))) {
                issues.push('missing_performer');
            }
            
            if (scene.studio && !filename.toLowerCase().includes(scene.studio.name.toLowerCase())) {
                issues.push('missing_studio');
            }
            
            // Check for special characters
            if (/[<>:"|?*]/.test(filename)) {
                issues.push('special_characters');
            }
            
            // Check length
            if (filename.length > CONFIG.MAX_FILENAME_LENGTH) {
                issues.push('too_long');
            }
            
            return issues.length > 0 ? issues.join(', ') : 'inconsistent_format';
        }

        suggestMetadataImprovements(patterns, scenes) {
            const { metadataUsage } = patterns;
            const improvements = {
                critical: [],
                recommended: [],
                optional: []
            };
            
            const criticalFields = ['title', 'performers', 'date'];
            const recommendedFields = ['studio', 'tags'];
            const optionalFields = ['rating100', 'details'];
            
            scenes.forEach(scene => {
                const missingFields = [];
                
                // Check critical fields
                criticalFields.forEach(field => {
                    if (!this.hasField(scene, field)) {
                        missingFields.push(field);
                    }
                });
                
                if (missingFields.length > 0) {
                    improvements.critical.push({
                        sceneId: scene.id,
                        title: scene.title || 'Untitled',
                        missing: missingFields,
                        suggestions: this.generateFieldSuggestions(scene, missingFields)
                    });
                    return;
                }
                
                // Check recommended fields
                missingFields.length = 0;
                recommendedFields.forEach(field => {
                    if (!this.hasField(scene, field)) {
                        missingFields.push(field);
                    }
                });
                
                if (missingFields.length > 0) {
                    improvements.recommended.push({
                        sceneId: scene.id,
                        title: scene.title,
                        missing: missingFields
                    });
                    return;
                }
                
                // Check optional fields
                missingFields.length = 0;
                optionalFields.forEach(field => {
                    if (!this.hasField(scene, field)) {
                        missingFields.push(field);
                    }
                });
                
                if (missingFields.length > 0) {
                    improvements.optional.push({
                        sceneId: scene.id,
                        title: scene.title,
                        missing: missingFields
                    });
                }
            });
            
            return {
                summary: {
                    criticalIssues: improvements.critical.length,
                    recommendedImprovements: improvements.recommended.length,
                    optionalEnhancements: improvements.optional.length,
                    overallCompleteness: metadataUsage.overall
                },
                details: improvements,
                fieldCompleteness: metadataUsage.byField
            };
        }

        hasField(scene, field) {
            switch (field) {
                case 'performers':
                    return scene.performers && scene.performers.length > 0;
                case 'tags':
                    return scene.tags && scene.tags.length > 0;
                case 'studio':
                    return scene.studio !== null;
                case 'title':
                    return scene.title && scene.title.trim().length > 0;
                default:
                    return scene[field] !== null && scene[field] !== undefined;
            }
        }

        generateFieldSuggestions(scene, missingFields) {
            const suggestions = {};
            
            missingFields.forEach(field => {
                switch (field) {
                    case 'title':
                        // Try to extract title from filename
                        if (scene.file?.path) {
                            const filename = scene.file.path.split(/[/\\]/).pop();
                            const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.') || filename.length);
                            suggestions.title = this.cleanupTitle(nameWithoutExt);
                        }
                        break;
                        
                    case 'date':
                        // Try to extract date from filename or path
                        if (scene.file?.path) {
                            const dateMatch = scene.file.path.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
                            if (dateMatch) {
                                suggestions.date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
                            }
                        }
                        break;
                        
                    case 'performers':
                        // Suggest based on folder structure
                        if (scene.file?.path) {
                            const pathParts = scene.file.path.split(/[/\\]/);
                            suggestions.performerHints = pathParts.filter(part => 
                                part.length > 2 && !part.match(/^\d+$/)
                            );
                        }
                        break;
                }
            });
            
            return suggestions;
        }

        cleanupTitle(rawTitle) {
            // Remove common prefixes/suffixes
            let title = rawTitle;
            
            // Remove resolution indicators
            title = title.replace(/\b(4K|1080p|720p|480p|SD|HD)\b/gi, '');
            
            // Remove file format indicators
            title = title.replace(/\.(mp4|avi|mkv|mov|wmv)$/i, '');
            
            // Replace underscores and dots with spaces
            title = title.replace(/[_\.]/g, ' ');
            
            // Remove extra spaces
            title = title.replace(/\s+/g, ' ').trim();
            
            return title;
        }
    }

    // ===== FILE ORGANIZATION SYSTEM =====
    class FileOrganizationSystem {
        constructor(graphqlClient) {
            this.graphql = graphqlClient;
            this.operationQueue = [];
            this.rollbackStack = [];
        }

        async createOrganizationPlan(scenes, preferences, suggestions) {
            const plan = {
                id: Date.now().toString(),
                created: new Date(),
                type: 'comprehensive',
                operations: [],
                preview: {
                    beforeStructure: this.captureCurrentStructure(scenes),
                    afterStructure: null,
                    summary: {
                        totalChanges: 0,
                        foldersCreated: 0,
                        filesRenamed: 0,
                        metadataUpdated: 0
                    }
                },
                rollbackPlan: {
                    operations: [],
                    backupLocations: [],
                    metadataBackup: this.backupMetadata(scenes)
                }
            };

            // Add folder reorganization operations
            if (suggestions.folderReorganization) {
                const folderOps = this.planFolderOperations(
                    scenes,
                    suggestions.folderReorganization.proposedStructure
                );
                plan.operations.push(...folderOps);
                plan.preview.summary.totalChanges += folderOps.length;
            }

            // Add file renaming operations
            if (suggestions.fileRenaming && suggestions.fileRenaming.suggestions.length > 0) {
                const renamingOps = this.planRenamingOperations(
                    suggestions.fileRenaming.suggestions
                );
                plan.operations.push(...renamingOps);
                plan.preview.summary.filesRenamed += renamingOps.length;
            }

            // Generate after structure preview
            plan.preview.afterStructure = this.generateAfterStructure(
                plan.preview.beforeStructure,
                plan.operations
            );

            // Count new folders
            plan.preview.summary.foldersCreated = this.countNewFolders(
                plan.preview.beforeStructure,
                plan.preview.afterStructure
            );

            // Generate rollback plan
            plan.rollbackPlan.operations = this.generateRollbackOperations(plan.operations);

            return plan;
        }

        captureCurrentStructure(scenes) {
            const structure = new Map();

            scenes.forEach(scene => {
                if (!scene.file?.path) return;

                const pathParts = scene.file.path.split(/[/\\]/);
                const filename = pathParts.pop();
                const folderPath = pathParts.join('/') || '/';

                if (!structure.has(folderPath)) {
                    structure.set(folderPath, {
                        files: [],
                        subfolders: new Set()
                    });
                }

                structure.get(folderPath).files.push({
                    sceneId: scene.id,
                    filename: filename,
                    size: scene.file.size,
                    metadata: {
                        title: scene.title,
                        performers: scene.performers?.map(p => p.name),
                        studio: scene.studio?.name
                    }
                });

                // Track subfolder structure
                let currentPath = '';
                pathParts.forEach((part, index) => {
                    const parentPath = currentPath || '/';
                    currentPath = currentPath ? `${currentPath}/${part}` : part;

                    if (!structure.has(parentPath)) {
                        structure.set(parentPath, {
                            files: [],
                            subfolders: new Set()
                        });
                    }

                    structure.get(parentPath).subfolders.add(part);
                });
            });

            return structure;
        }

        planFolderOperations(scenes, proposedStructure) {
            const operations = [];

            proposedStructure.forEach(folder => {
                folder.scenes.forEach(sceneInfo => {
                    if (!sceneInfo.currentPath) return;

                    const currentFolder = sceneInfo.currentPath.split(/[/\\]/).slice(0, -1).join('/');
                    const filename = sceneInfo.currentPath.split(/[/\\]/).pop();
                    const newPath = `${folder.path}/${filename}`;

                    if (currentFolder !== folder.path) {
                        operations.push({
                            type: 'move',
                            sceneId: sceneInfo.id,
                            currentPath: sceneInfo.currentPath,
                            targetPath: newPath,
                            changes: {
                                folder: {
                                    from: currentFolder,
                                    to: folder.path
                                }
                            },
                            estimatedImpact: {
                                filesAffected: 1,
                                metadataChanges: 0,
                                riskLevel: 'low'
                            }
                        });
                    }
                });
            });

            return operations;
        }

        planRenamingOperations(renamingSuggestions) {
            const operations = [];

            renamingSuggestions.forEach(suggestion => {
                const folder = suggestion.current.substring(0, suggestion.current.lastIndexOf('/') + 1);
                const newPath = folder + suggestion.suggested;

                operations.push({
                    type: 'rename',
                    sceneId: suggestion.sceneId,
                    currentPath: suggestion.current,
                    targetPath: newPath,
                    changes: {
                        filename: {
                            from: suggestion.current.split(/[/\\]/).pop(),
                            to: suggestion.suggested
                        }
                    },
                    estimatedImpact: {
                        filesAffected: 1,
                        metadataChanges: 0,
                        riskLevel: 'low'
                    }
                });
            });

            return operations;
        }

        generateAfterStructure(beforeStructure, operations) {
            // Clone the before structure
            const afterStructure = new Map();
            
            beforeStructure.forEach((value, key) => {
                afterStructure.set(key, {
                    files: [...value.files],
                    subfolders: new Set(value.subfolders)
                });
            });

            // Apply operations to generate after structure
            operations.forEach(op => {
                if (op.type === 'move' || op.type === 'rename') {
                    // Remove from current location
                    const currentFolder = op.currentPath.split(/[/\\]/).slice(0, -1).join('/') || '/';
                    const currentFilename = op.currentPath.split(/[/\\]/).pop();

                    if (afterStructure.has(currentFolder)) {
                        const folderData = afterStructure.get(currentFolder);
                        folderData.files = folderData.files.filter(
                            file => file.sceneId !== op.sceneId
                        );
                    }

                    // Add to new location
                    const targetFolder = op.targetPath.split(/[/\\]/).slice(0, -1).join('/') || '/';
                    const targetFilename = op.targetPath.split(/[/\\]/).pop();

                    if (!afterStructure.has(targetFolder)) {
                        afterStructure.set(targetFolder, {
                            files: [],
                            subfolders: new Set()
                        });
                    }

                    afterStructure.get(targetFolder).files.push({
                        sceneId: op.sceneId,
                        filename: targetFilename,
                        size: 0, // Would need to look up from original
                        metadata: {} // Would need to look up from original
                    });
                }
            });

            return afterStructure;
        }

        countNewFolders(beforeStructure, afterStructure) {
            const beforeFolders = new Set(beforeStructure.keys());
            const afterFolders = new Set(afterStructure.keys());

            let newFolders = 0;
            afterFolders.forEach(folder => {
                if (!beforeFolders.has(folder)) {
                    newFolders++;
                }
            });

            return newFolders;
        }

        backupMetadata(scenes) {
            return scenes.map(scene => ({
                id: scene.id,
                file: scene.file ? {
                    path: scene.file.path,
                    size: scene.file.size
                } : null,
                metadata: {
                    title: scene.title,
                    date: scene.date,
                    rating100: scene.rating100,
                    organized: scene.organized,
                    performers: scene.performers?.map(p => ({ id: p.id, name: p.name })),
                    studio: scene.studio ? { id: scene.studio.id, name: scene.studio.name } : null,
                    tags: scene.tags?.map(t => ({ id: t.id, name: t.name }))
                }
            }));
        }

        generateRollbackOperations(operations) {
            return operations.map(op => {
                switch (op.type) {
                    case 'move':
                    case 'rename':
                        return {
                            type: 'rollback_move',
                            sceneId: op.sceneId,
                            currentPath: op.targetPath,
                            targetPath: op.currentPath,
                            originalOperation: op
                        };
                    default:
                        return null;
                }
            }).filter(op => op !== null);
        }

        async executeOrganizationPlan(plan, progressCallback) {
            const results = {
                successful: [],
                failed: [],
                skipped: []
            };

            try {
                // Validate plan before execution
                const validation = await this.validatePlan(plan);
                if (!validation.safe) {
                    throw new Error(`Plan validation failed: ${validation.errors.join(', ')}`);
                }

                // Execute operations
                for (let i = 0; i < plan.operations.length; i++) {
                    const operation = plan.operations[i];
                    
                    try {
                        // Check if operation is still valid
                        const stillValid = await this.validateOperation(operation);
                        if (!stillValid) {
                            results.skipped.push({
                                operation,
                                reason: 'Operation no longer valid'
                            });
                            continue;
                        }

                        // Execute the operation
                        const result = await this.executeOperation(operation);
                        results.successful.push(result);
                        this.rollbackStack.push(operation);

                        // Update progress
                        if (progressCallback) {
                            progressCallback({
                                current: i + 1,
                                total: plan.operations.length,
                                operation: operation,
                                status: 'success'
                            });
                        }
                    } catch (error) {
                        console.error('Operation failed:', error);
                        results.failed.push({
                            operation,
                            error: error.message
                        });

                        // Update progress
                        if (progressCallback) {
                            progressCallback({
                                current: i + 1,
                                total: plan.operations.length,
                                operation: operation,
                                status: 'failed',
                                error: error.message
                            });
                        }
                    }
                }

                return results;
            } catch (error) {
                console.error('Plan execution failed:', error);
                
                // Attempt rollback if critical failure
                if (this.rollbackStack.length > 0) {
                    await this.performRollback();
                }
                
                throw error;
            }
        }

        async validatePlan(plan) {
            const checks = {
                diskSpace: await this.checkDiskSpace(plan),
                permissions: await this.checkPermissions(plan),
                conflicts: await this.checkConflicts(plan)
            };

            const errors = [];
            const warnings = [];

            if (!checks.diskSpace.sufficient) {
                errors.push(`Insufficient disk space: ${checks.diskSpace.required} needed`);
            }

            if (!checks.permissions.allWritable) {
                errors.push(`Write permissions missing for ${checks.permissions.issues.length} paths`);
            }

            if (checks.conflicts.found) {
                warnings.push(`${checks.conflicts.count} naming conflicts detected`);
            }

            return {
                safe: errors.length === 0,
                errors,
                warnings,
                checks
            };
        }

        async checkDiskSpace(plan) {
            // This would need actual implementation to check disk space
            // For now, return mock data
            return {
                sufficient: true,
                available: 1000000000, // 1GB
                required: 0
            };
        }

        async checkPermissions(plan) {
            // This would need actual implementation to check file permissions
            // For now, return mock data
            return {
                allWritable: true,
                issues: []
            };
        }

        async checkConflicts(plan) {
            const targetPaths = new Set();
            const conflicts = [];

            plan.operations.forEach(op => {
                if (targetPaths.has(op.targetPath)) {
                    conflicts.push({
                        path: op.targetPath,
                        operations: [op]
                    });
                }
                targetPaths.add(op.targetPath);
            });

            return {
                found: conflicts.length > 0,
                count: conflicts.length,
                conflicts
            };
        }

        async validateOperation(operation) {
            // Check if source file still exists and hasn't changed
            // This would need actual implementation
            return true;
        }

        async executeOperation(operation) {
            console.log(`Executing ${operation.type} operation for scene ${operation.sceneId}`);

            switch (operation.type) {
                case 'move':
                case 'rename':
                    return await this.moveFile(operation);
                default:
                    throw new Error(`Unknown operation type: ${operation.type}`);
            }
        }

        async moveFile(operation) {
            // Update the scene's file path in Stash
            const result = await this.graphql.updateScenePaths(
                operation.sceneId,
                operation.targetPath
            );

            return {
                operation,
                result,
                timestamp: new Date()
            };
        }

        async performRollback() {
            console.log('Performing rollback of operations...');

            const rollbackResults = {
                successful: 0,
                failed: 0
            };

            while (this.rollbackStack.length > 0) {
                const operation = this.rollbackStack.pop();
                
                try {
                    await this.executeOperation({
                        type: 'rollback_move',
                        sceneId: operation.sceneId,
                        currentPath: operation.targetPath,
                        targetPath: operation.currentPath
                    });
                    rollbackResults.successful++;
                } catch (error) {
                    console.error('Rollback failed for operation:', operation, error);
                    rollbackResults.failed++;
                }
            }

            return rollbackResults;
        }
    }

    // ===== NAMING CONVENTION ENGINE =====
    class NamingConventionEngine {
        constructor() {
            this.templates = {
                'performer_studio_title': '{performer} - {studio} - {title}',
                'date_performer_title': '{date} - {performer} - {title}',
                'studio_performer_title': '{studio} - {performer} - {title}',
                'performer_title_date': '{performer} - {title} - {date}',
                'custom': '{custom_template}'
            };
            
            this.loadCustomTemplates();
        }

        loadCustomTemplates() {
            const saved = GM_getValue(`${CONFIG.SETTINGS_KEY}_naming_templates`, {});
            Object.assign(this.templates, saved);
        }

        saveCustomTemplate(name, template) {
            this.templates[name] = template;
            GM_setValue(`${CONFIG.SETTINGS_KEY}_naming_templates`, this.templates);
        }

        standardizeFileName(scene, templateName) {
            const template = this.templates[templateName] || this.templates['performer_studio_title'];
            
            const tokens = this.extractTokens(scene);
            let filename = this.applyTemplate(template, tokens);
            
            // Clean up the filename
            filename = this.cleanupFilename(filename);
            
            // Add extension
            const extension = this.getFileExtension(scene.file?.path);
            
            return Utils.sanitizeFilename(filename) + extension;
        }

        extractTokens(scene) {
            return {
                performer: this.formatPerformers(scene.performers),
                performers: this.formatPerformers(scene.performers), // Alias
                studio: scene.studio?.name || 'Unknown Studio',
                title: this.formatTitle(scene.title),
                date: Utils.formatDate(scene.date),
                year: scene.date ? new Date(scene.date).getFullYear() : '',
                month: scene.date ? String(new Date(scene.date).getMonth() + 1).padStart(2, '0') : '',
                day: scene.date ? String(new Date(scene.date).getDate()).padStart(2, '0') : '',
                resolution: this.getResolution(scene.file),
                quality: this.getQualityIndicator(scene.file),
                duration: Utils.formatDuration(scene.file?.duration),
                codec: scene.file?.video_codec || '',
                rating: scene.rating100 ? Math.round(scene.rating100 / 20) : '',
                tags: this.formatTags(scene.tags),
                scene_id: scene.id
            };
        }

        formatPerformers(performers) {
            if (!performers || performers.length === 0) {
                return 'Unknown Performer';
            }
            
            if (performers.length === 1) {
                return performers[0].name;
            }
            
            if (performers.length === 2) {
                return `${performers[0].name} & ${performers[1].name}`;
            }
            
            return `${performers[0].name} & Others`;
        }

        formatTitle(title) {
            if (!title || title.trim() === '') {
                return 'Untitled';
            }
            
            // Remove common prefixes/suffixes
            let formatted = title;
            
            // Remove scene numbers at start
            formatted = formatted.replace(/^scene\s*\d+[-_\s]*/i, '');
            
            // Capitalize first letter of each word
            formatted = formatted.replace(/\b\w/g, l => l.toUpperCase());
            
            return formatted;
        }

        formatTags(tags) {
            if (!tags || tags.length === 0) {
                return '';
            }
            
            return tags.slice(0, 3).map(t => t.name).join(', ');
        }

        getResolution(file) {
            if (!file?.height) return '';
            
            if (file.height >= 2160) return '4K';
            if (file.height >= 1440) return '1440p';
            if (file.height >= 1080) return '1080p';
            if (file.height >= 720) return '720p';
            if (file.height >= 480) return '480p';
            return 'SD';
        }

        getQualityIndicator(file) {
            if (!file) return '';
            
            const resolution = this.getResolution(file);
            const bitrate = file.bit_rate || 0;
            
            // Calculate quality based on resolution and bitrate
            if (resolution === '4K' && bitrate > 20000000) return 'HQ';
            if (resolution === '1080p' && bitrate > 8000000) return 'HQ';
            if (bitrate < 2000000) return 'LQ';
            
            return '';
        }

        getFileExtension(path) {
            if (!path) return '.mp4';
            
            const lastDot = path.lastIndexOf('.');
            if (lastDot === -1) return '.mp4';
            
            return path.substring(lastDot);
        }

        applyTemplate(template, tokens) {
            let result = template;
            
            // Replace tokens
            Object.entries(tokens).forEach(([key, value]) => {
                const regex = new RegExp(`{${key}}`, 'gi');
                result = result.replace(regex, value || '');
            });
            
            // Remove any remaining unreplaced tokens
            result = result.replace(/{[^}]+}/g, '');
            
            return result;
        }

        cleanupFilename(filename) {
            // Remove multiple spaces
            filename = filename.replace(/\s+/g, ' ');
            
            // Remove multiple dashes
            filename = filename.replace(/\s*-\s*-\s*/g, ' - ');
            
            // Remove leading/trailing dashes
            filename = filename.replace(/^\s*-\s*|\s*-\s*$/g, '');
            
            // Remove leading/trailing spaces
            filename = filename.trim();
            
            return filename;
        }

        detectNamingInconsistencies(scenes) {
            const patterns = new Map();
            const inconsistencies = [];
            
            scenes.forEach(scene => {
                if (!scene.file?.path) return;
                
                const filename = scene.file.path.split(/[/\\]/).pop();
                const pattern = this.detectPattern(filename, scene);
                
                if (!patterns.has(pattern.key)) {
                    patterns.set(pattern.key, {
                        pattern: pattern,
                        count: 0,
                        examples: []
                    });
                }
                
                const patternData = patterns.get(pattern.key);
                patternData.count++;
                
                if (patternData.examples.length < 5) {
                    patternData.examples.push({
                        sceneId: scene.id,
                        filename: filename
                    });
                }
            });
            
            // Find the most common pattern
            let mostCommon = null;
            let maxCount = 0;
            
            patterns.forEach(patternData => {
                if (patternData.count > maxCount) {
                    maxCount = patternData.count;
                    mostCommon = patternData;
                }
            });
            
            // Identify files that don't match the most common pattern
            scenes.forEach(scene => {
                if (!scene.file?.path) return;
                
                const filename = scene.file.path.split(/[/\\]/).pop();
                const pattern = this.detectPattern(filename, scene);
                
                if (mostCommon && pattern.key !== mostCommon.pattern.key) {
                    inconsistencies.push({
                        sceneId: scene.id,
                        currentFilename: filename,
                        currentPattern: pattern,
                        expectedPattern: mostCommon.pattern,
                        severity: this.calculateInconsistencySeverity(pattern, mostCommon.pattern)
                    });
                }
            });
            
            return {
                patterns: Array.from(patterns.values()),
                mostCommonPattern: mostCommon,
                inconsistencies: inconsistencies,
                consistencyScore: ((scenes.length - inconsistencies.length) / scenes.length) * 100
            };
        }

        detectPattern(filename, scene) {
            const components = [];
            const positions = {};
            
            // Remove extension
            const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.') || filename.length);
            
            // Check for various components
            const checks = [
                { name: 'performer', check: () => this.checkForPerformers(nameWithoutExt, scene) },
                { name: 'studio', check: () => this.checkForStudio(nameWithoutExt, scene) },
                { name: 'date', check: () => this.checkForDate(nameWithoutExt) },
                { name: 'title', check: () => this.checkForTitle(nameWithoutExt, scene) },
                { name: 'resolution', check: () => this.checkForResolution(nameWithoutExt) },
                { name: 'duration', check: () => this.checkForDuration(nameWithoutExt) }
            ];
            
            checks.forEach(({ name, check }) => {
                const result = check();
                if (result.found) {
                    components.push(name);
                    positions[name] = result.position;
                }
            });
            
            // Sort components by position
            components.sort((a, b) => positions[a] - positions[b]);
            
            return {
                key: components.join('_'),
                components: components,
                positions: positions
            };
        }

        checkForPerformers(filename, scene) {
            if (!scene.performers || scene.performers.length === 0) {
                return { found: false };
            }
            
            const lowerFilename = filename.toLowerCase();
            let earliestPosition = filename.length;
            let found = false;
            
            scene.performers.forEach(performer => {
                const pos = lowerFilename.indexOf(performer.name.toLowerCase());
                if (pos !== -1) {
                    found = true;
                    earliestPosition = Math.min(earliestPosition, pos);
                }
            });
            
            return { found, position: earliestPosition };
        }

        checkForStudio(filename, scene) {
            if (!scene.studio) {
                return { found: false };
            }
            
            const lowerFilename = filename.toLowerCase();
            const pos = lowerFilename.indexOf(scene.studio.name.toLowerCase());
            
            return {
                found: pos !== -1,
                position: pos
            };
        }

        checkForDate(filename) {
            const datePatterns = [
                /(\d{4})-(\d{2})-(\d{2})/,
                /(\d{4})\.(\d{2})\.(\d{2})/,
                /(\d{4})_(\d{2})_(\d{2})/,
                /(\d{8})/
            ];
            
            for (const pattern of datePatterns) {
                const match = filename.match(pattern);
                if (match) {
                    return {
                        found: true,
                        position: match.index
                    };
                }
            }
            
            return { found: false };
        }

        checkForTitle(filename, scene) {
            if (!scene.title) {
                return { found: false };
            }
            
            const lowerFilename = filename.toLowerCase();
            const lowerTitle = scene.title.toLowerCase();
            
            // Check for exact match
            let pos = lowerFilename.indexOf(lowerTitle);
            if (pos !== -1) {
                return { found: true, position: pos };
            }
            
            // Check for partial match (first few words)
            const titleWords = lowerTitle.split(/\s+/);
            if (titleWords.length > 2) {
                const partialTitle = titleWords.slice(0, 3).join(' ');
                pos = lowerFilename.indexOf(partialTitle);
                if (pos !== -1) {
                    return { found: true, position: pos };
                }
            }
            
            return { found: false };
        }

        checkForResolution(filename) {
            const resolutionPatterns = [
                /\b(4K|2160p)\b/i,
                /\b(1440p)\b/i,
                /\b(1080p|FHD|FullHD)\b/i,
                /\b(720p|HD)\b/i,
                /\b(480p|SD)\b/i
            ];
            
            for (const pattern of resolutionPatterns) {
                const match = filename.match(pattern);
                if (match) {
                    return {
                        found: true,
                        position: match.index
                    };
                }
            }
            
            return { found: false };
        }

        checkForDuration(filename) {
            const durationPatterns = [
                /\b(\d+)h(\d+)m\b/,
                /\b(\d+)min\b/i,
                /\b(\d+)m\b/
            ];
            
            for (const pattern of durationPatterns) {
                const match = filename.match(pattern);
                if (match) {
                    return {
                        found: true,
                        position: match.index
                    };
                }
            }
            
            return { found: false };
        }

        calculateInconsistencySeverity(current, expected) {
            // Calculate how different the patterns are
            const currentComponents = new Set(current.components);
            const expectedComponents = new Set(expected.components);
            
            const missing = [...expectedComponents].filter(c => !currentComponents.has(c));
            const extra = [...currentComponents].filter(c => !expectedComponents.has(c));
            
            if (missing.length === 0 && extra.length === 0) {
                return 'low'; // Just different order
            }
            
            if (missing.length <= 1 && extra.length <= 1) {
                return 'medium';
            }
            
            return 'high';
        }

        generateBatchRenames(scenes, templateName) {
            const renames = [];
            const conflicts = new Map();
            
            scenes.forEach(scene => {
                if (!scene.file?.path) return;
                
                const currentPath = scene.file.path;
                const currentFilename = currentPath.split(/[/\\]/).pop();
                const folder = currentPath.substring(0, currentPath.lastIndexOf(currentFilename));
                
                const newFilename = this.standardizeFileName(scene, templateName);
                const newPath = folder + newFilename;
                
                // Check for conflicts
                if (conflicts.has(newPath)) {
                    conflicts.get(newPath).push(scene.id);
                } else {
                    conflicts.set(newPath, [scene.id]);
                    
                    if (currentFilename !== newFilename) {
                        renames.push({
                            sceneId: scene.id,
                            currentPath: currentPath,
                            newPath: newPath,
                            currentFilename: currentFilename,
                            newFilename: newFilename,
                            preview: this.generateRenamePreview(scene, currentFilename, newFilename)
                        });
                    }
                }
            });
            
            // Handle conflicts
            const resolvedRenames = this.resolveNamingConflicts(renames, conflicts);
            
            return {
                renames: resolvedRenames,
                conflicts: Array.from(conflicts.entries()).filter(([_, scenes]) => scenes.length > 1),
                total: resolvedRenames.length
            };
        }

        generateRenamePreview(scene, currentFilename, newFilename) {
            return {
                title: scene.title || 'Untitled',
                performers: scene.performers?.map(p => p.name).join(', ') || 'Unknown',
                studio: scene.studio?.name || 'Unknown',
                date: scene.date || 'Unknown',
                current: currentFilename,
                new: newFilename,
                change: this.highlightChanges(currentFilename, newFilename)
            };
        }

        highlightChanges(current, newName) {
            // Simple diff highlighting
            const currentParts = current.split(/[-_\s]+/);
            const newParts = newName.split(/[-_\s]+/);
            
            const changes = {
                added: newParts.filter(part => !currentParts.some(cp => cp.toLowerCase() === part.toLowerCase())),
                removed: currentParts.filter(part => !newParts.some(np => np.toLowerCase() === part.toLowerCase())),
                reordered: currentParts.length === newParts.length && currentParts.some((part, i) => part !== newParts[i])
            };
            
            return changes;
        }

        resolveNamingConflicts(renames, conflicts) {
            const resolved = [];
            
            renames.forEach(rename => {
                const conflictingScenes = conflicts.get(rename.newPath) || [];
                
                if (conflictingScenes.length > 1) {
                    // Add a unique identifier to resolve conflict
                    const index = conflictingScenes.indexOf(rename.sceneId);
                    const extension = rename.newFilename.substring(rename.newFilename.lastIndexOf('.'));
                    const nameWithoutExt = rename.newFilename.substring(0, rename.newFilename.lastIndexOf('.'));
                    
                    rename.newFilename = `${nameWithoutExt} (${index + 1})${extension}`;
                    rename.newPath = rename.newPath.substring(0, rename.newPath.lastIndexOf('/') + 1) + rename.newFilename;
                    rename.hasConflict = true;
                }
                
                resolved.push(rename);
            });
            
            return resolved;
        }
    }

    // ===== METADATA COMPLETENESS ANALYZER =====
    class MetadataCompletenessAnalyzer {
        constructor(graphqlClient) {
            this.graphql = graphqlClient;
            this.criticalFields = ['title', 'performers', 'studio', 'date'];
            this.optionalFields = ['tags', 'rating', 'details', 'url', 'director'];
            this.weights = {
                title: 20,
                performers: 25,
                studio: 20,
                date: 15,
                tags: 10,
                rating: 5,
                details: 3,
                url: 1,
                director: 1
            };
        }

        analyzeCompleteness(scenes) {
            const analysis = {
                overall: 0,
                byField: new Map(),
                criticalMissing: [],
                suggestions: [],
                scoreDistribution: {
                    excellent: 0, // 90-100%
                    good: 0,      // 70-89%
                    fair: 0,      // 50-69%
                    poor: 0       // <50%
                }
            };
            
            // Initialize field tracking
            [...this.criticalFields, ...this.optionalFields].forEach(field => {
                analysis.byField.set(field, {
                    present: 0,
                    missing: 0,
                    percentage: 0
                });
            });
            
            scenes.forEach(scene => {
                const completeness = this.calculateSceneCompleteness(scene);
                analysis.overall += completeness.percentage;
                
                // Track field presence
                completeness.fieldStatus.forEach((status, field) => {
                    const fieldStats = analysis.byField.get(field);
                    if (status.present) {
                        fieldStats.present++;
                    } else {
                        fieldStats.missing++;
                    }
                });
                
                // Categorize by score
                if (completeness.percentage >= 90) {
                    analysis.scoreDistribution.excellent++;
                } else if (completeness.percentage >= 70) {
                    analysis.scoreDistribution.good++;
                } else if (completeness.percentage >= 50) {
                    analysis.scoreDistribution.fair++;
                } else {
                    analysis.scoreDistribution.poor++;
                }
                
                // Track scenes with critical missing data
                if (completeness.percentage < 70 || completeness.criticalMissing.length > 0) {
                    analysis.criticalMissing.push({
                        scene,
                        score: completeness.percentage,
                        missing: completeness.missing,
                        criticalMissing: completeness.criticalMissing,
                        suggestions: this.generateCompletionSuggestions(scene, completeness)
                    });
                }
            });
            
            // Calculate overall stats
            analysis.overall = scenes.length > 0 ? analysis.overall / scenes.length : 0;
            
            // Calculate field percentages
            analysis.byField.forEach((stats, field) => {
                stats.percentage = scenes.length > 0 
                    ? (stats.present / scenes.length) * 100 
                    : 0;
            });
            
            // Generate global suggestions
            analysis.suggestions = this.generateGlobalSuggestions(analysis);
            
            return analysis;
        }

        calculateSceneCompleteness(scene) {
            const fieldStatus = new Map();
            let totalWeight = 0;
            let achievedWeight = 0;
            const missing = [];
            const criticalMissing = [];
            
            // Check all fields
            [...this.criticalFields, ...this.optionalFields].forEach(field => {
                const weight = this.weights[field];
                totalWeight += weight;
                
                const isPresent = this.checkFieldPresence(scene, field);
                fieldStatus.set(field, {
                    present: isPresent,
                    weight: weight
                });
                
                if (isPresent) {
                    achievedWeight += weight;
                } else {
                    missing.push(field);
                    if (this.criticalFields.includes(field)) {
                        criticalMissing.push(field);
                    }
                }
            });
            
            return {
                percentage: Math.round((achievedWeight / totalWeight) * 100),
                fieldStatus,
                missing,
                criticalMissing,
                achievedWeight,
                totalWeight
            };
        }

        checkFieldPresence(scene, field) {
            switch (field) {
                case 'title':
                    return scene.title && scene.title.trim().length > 0;
                case 'performers':
                    return scene.performers && scene.performers.length > 0;
                case 'studio':
                    return scene.studio && scene.studio.name;
                case 'date':
                    return scene.date && scene.date !== '';
                case 'tags':
                    return scene.tags && scene.tags.length > 0;
                case 'rating':
                    return scene.rating !== null && scene.rating !== undefined;
                case 'details':
                    return scene.details && scene.details.trim().length > 0;
                case 'url':
                    return scene.url && scene.url.trim().length > 0;
                case 'director':
                    return scene.director && scene.director.trim().length > 0;
                default:
                    return false;
            }
        }

        generateCompletionSuggestions(scene, completeness) {
            const suggestions = {
                autoFillOptions: this.identifyAutoFillSources(scene, completeness),
                scrapingSuggestions: this.suggestScrapingSources(scene),
                manualTasks: this.createManualCompletionTasks(scene, completeness)
            };
            
            return suggestions;
        }

        identifyAutoFillSources(scene, completeness) {
            const sources = [];
            
            // Check filename for metadata
            if (scene.file?.path) {
                const filename = scene.file.path.split(/[/\\]/).pop();
                const filenameData = this.extractMetadataFromFilename(filename);
                
                if (filenameData.performers && completeness.missing.includes('performers')) {
                    sources.push({
                        field: 'performers',
                        source: 'filename',
                        value: filenameData.performers,
                        confidence: 0.7
                    });
                }
                
                if (filenameData.studio && completeness.missing.includes('studio')) {
                    sources.push({
                        field: 'studio',
                        source: 'filename',
                        value: filenameData.studio,
                        confidence: 0.6
                    });
                }
                
                if (filenameData.date && completeness.missing.includes('date')) {
                    sources.push({
                        field: 'date',
                        source: 'filename',
                        value: filenameData.date,
                        confidence: 0.8
                    });
                }
            }
            
            // Check for related scenes that might have metadata
            if (scene.studio && completeness.missing.includes('tags')) {
                sources.push({
                    field: 'tags',
                    source: 'studio_common_tags',
                    value: 'Analyze other scenes from this studio',
                    confidence: 0.5
                });
            }
            
            return sources;
        }

        extractMetadataFromFilename(filename) {
            const metadata = {};
            
            // Common date patterns
            const datePatterns = [
                /(\d{4}[-._]\d{2}[-._]\d{2})/,
                /(\d{2}[-._]\d{2}[-._]\d{4})/,
                /(\d{8})/
            ];
            
            for (const pattern of datePatterns) {
                const match = filename.match(pattern);
                if (match) {
                    metadata.date = this.parseDate(match[1]);
                    break;
                }
            }
            
            // Studio patterns (common studios)
            const studioPatterns = [
                /\[([\w\s]+)\]/,
                /^([\w\s]+)\s*-/,
                /\s-\s*([\w\s]+)\s*-/
            ];
            
            for (const pattern of studioPatterns) {
                const match = filename.match(pattern);
                if (match) {
                    metadata.studio = match[1].trim();
                    break;
                }
            }
            
            // Performer detection (simple heuristic)
            const namePattern = /([A-Z][a-z]+\s+[A-Z][a-z]+)/g;
            const names = filename.match(namePattern);
            if (names) {
                metadata.performers = names;
            }
            
            return metadata;
        }

        parseDate(dateStr) {
            // Remove separators and normalize
            const normalized = dateStr.replace(/[-._]/g, '');
            
            if (normalized.length === 8) {
                // YYYYMMDD or DDMMYYYY
                const year1 = normalized.substring(0, 4);
                const year2 = normalized.substring(4, 8);
                
                if (parseInt(year1) > 1900 && parseInt(year1) < 2100) {
                    return `${year1}-${normalized.substring(4, 6)}-${normalized.substring(6, 8)}`;
                } else if (parseInt(year2) > 1900 && parseInt(year2) < 2100) {
                    return `${year2}-${normalized.substring(2, 4)}-${normalized.substring(0, 2)}`;
                }
            }
            
            return dateStr;
        }

        suggestScrapingSources(scene) {
            const suggestions = [];
            
            // StashDB
            suggestions.push({
                source: 'StashDB',
                priority: 'high',
                fields: ['title', 'performers', 'studio', 'date', 'tags'],
                confidence: 0.9
            });
            
            // ThePornDB
            suggestions.push({
                source: 'ThePornDB',
                priority: 'high',
                fields: ['title', 'performers', 'studio', 'date', 'tags'],
                confidence: 0.85
            });
            
            // Scene file analysis
            if (scene.file?.duration) {
                suggestions.push({
                    source: 'File Analysis',
                    priority: 'medium',
                    fields: ['duration', 'resolution', 'codec'],
                    confidence: 1.0
                });
            }
            
            return suggestions;
        }

        createManualCompletionTasks(scene, completeness) {
            const tasks = [];
            
            completeness.criticalMissing.forEach(field => {
                tasks.push({
                    field,
                    priority: 'high',
                    action: this.getFieldAction(field),
                    description: this.getFieldDescription(field)
                });
            });
            
            completeness.missing
                .filter(field => !completeness.criticalMissing.includes(field))
                .forEach(field => {
                    tasks.push({
                        field,
                        priority: 'medium',
                        action: this.getFieldAction(field),
                        description: this.getFieldDescription(field)
                    });
                });
            
            return tasks;
        }

        getFieldAction(field) {
            const actions = {
                title: 'Enter a descriptive title',
                performers: 'Add performer information',
                studio: 'Select or create studio',
                date: 'Set release date',
                tags: 'Add relevant tags',
                rating: 'Rate the scene',
                details: 'Add scene description',
                url: 'Add source URL',
                director: 'Add director information'
            };
            
            return actions[field] || 'Update field';
        }

        getFieldDescription(field) {
            const descriptions = {
                title: 'A clear, descriptive title helps with searching and organization',
                performers: 'Adding performers enables better filtering and discovery',
                studio: 'Studio information helps group related content',
                date: 'Release date is important for chronological organization',
                tags: 'Tags improve searchability and categorization',
                rating: 'Personal ratings help identify favorite content',
                details: 'Descriptions provide context and additional information',
                url: 'Source URLs help track content origin',
                director: 'Director information adds production context'
            };
            
            return descriptions[field] || 'This field helps improve organization';
        }

        generateGlobalSuggestions(analysis) {
            const suggestions = [];
            
            // Check for systematic issues
            const fieldsByCompleteness = Array.from(analysis.byField.entries())
                .sort((a, b) => a[1].percentage - b[1].percentage);
            
            // Suggest bulk operations for commonly missing fields
            fieldsByCompleteness
                .filter(([field, stats]) => stats.percentage < 50)
                .forEach(([field, stats]) => {
                    suggestions.push({
                        type: 'bulk_operation',
                        field,
                        missingCount: stats.missing,
                        description: `${stats.missing} scenes are missing ${field}. Consider bulk updating.`,
                        priority: this.criticalFields.includes(field) ? 'high' : 'medium'
                    });
                });
            
            // Suggest scraping for poor completeness
            if (analysis.scoreDistribution.poor > analysis.scoreDistribution.excellent) {
                suggestions.push({
                    type: 'batch_scraping',
                    description: 'Many scenes have poor metadata. Consider batch scraping from external sources.',
                    priority: 'high'
                });
            }
            
            // Suggest organization by completeness
            if (analysis.criticalMissing.length > 10) {
                suggestions.push({
                    type: 'organization',
                    description: 'Create a "Needs Metadata" tag to track incomplete scenes',
                    priority: 'medium'
                });
            }
            
            return suggestions;
        }
    }

    // ===== UI MANAGER =====
    class CollectionOrganizerUI {
        constructor(patternEngine, fileSystem, namingEngine, metadataAnalyzer, graphqlClient) {
            this.patternEngine = patternEngine;
            this.fileSystem = fileSystem;
            this.namingEngine = namingEngine;
            this.metadataAnalyzer = metadataAnalyzer;
            this.graphql = graphqlClient;
            
            this.currentView = 'overview';
            this.organizationPlan = null;
            this.analysisResults = null;
            this.scenes = [];
            
            this.init();
        }

        init() {
            this.injectStyles();
            this.createMainInterface();
            this.attachEventListeners();
            this.loadInitialData();
        }

        injectStyles() {
            GM_addStyle(`
                /* Collection Organizer Styles */
                .collection-organizer {
                    position: fixed;
                    top: 50px;
                    right: 20px;
                    width: 400px;
                    max-height: calc(100vh - 100px);
                    background: #1a1a2e;
                    border: 1px solid #16213e;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                    z-index: 9999;
                    display: none;
                    flex-direction: column;
                    font-family: Arial, sans-serif;
                }

                .organizer-header {
                    background: linear-gradient(135deg, #1a1a2e, #16213e);
                    padding: 15px;
                    border-bottom: 1px solid #0f3460;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .organizer-title {
                    color: #ecf0f1;
                    font-size: 18px;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .organizer-controls {
                    display: flex;
                    gap: 10px;
                }

                .organizer-btn {
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.3s;
                    font-size: 12px;
                }

                .organizer-btn:hover {
                    background: rgba(255,255,255,0.2);
                }

                .organizer-btn.active {
                    background: #3498db;
                    border-color: #3498db;
                }

                .organizer-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 15px;
                }

                /* Overview Styles */
                .overview-section {
                    margin-bottom: 20px;
                    background: rgba(255,255,255,0.05);
                    padding: 15px;
                    border-radius: 6px;
                }

                .overview-section h3 {
                    color: #3498db;
                    margin: 0 0 10px 0;
                    font-size: 16px;
                }

                .stat-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                }

                .stat-item {
                    background: rgba(255,255,255,0.05);
                    padding: 10px;
                    border-radius: 4px;
                    text-align: center;
                }

                .stat-value {
                    font-size: 24px;
                    color: #3498db;
                    font-weight: bold;
                }

                .stat-label {
                    font-size: 12px;
                    color: #95a5a6;
                    margin-top: 5px;
                }

                /* Analysis View */
                .analysis-results {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }

                .analysis-card {
                    background: rgba(255,255,255,0.05);
                    padding: 15px;
                    border-radius: 6px;
                }

                .analysis-card h4 {
                    color: #e74c3c;
                    margin: 0 0 10px 0;
                    font-size: 14px;
                }

                .pattern-item {
                    background: rgba(255,255,255,0.05);
                    padding: 8px;
                    margin: 5px 0;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #ecf0f1;
                }

                .pattern-count {
                    float: right;
                    color: #3498db;
                    font-weight: bold;
                }

                /* Organization Preview */
                .preview-container {
                    display: flex;
                    gap: 20px;
                }

                .preview-column {
                    flex: 1;
                    background: rgba(255,255,255,0.05);
                    padding: 15px;
                    border-radius: 6px;
                }

                .preview-column h4 {
                    color: #3498db;
                    margin: 0 0 10px 0;
                    font-size: 14px;
                }

                .folder-tree {
                    font-size: 12px;
                    color: #ecf0f1;
                }

                .folder-item {
                    padding: 2px 0;
                    padding-left: 20px;
                }

                .folder-name {
                    color: #f39c12;
                }

                .file-count {
                    color: #95a5a6;
                    font-size: 11px;
                    margin-left: 5px;
                }

                /* Progress Bar */
                .progress-container {
                    background: rgba(0,0,0,0.3);
                    height: 20px;
                    border-radius: 10px;
                    overflow: hidden;
                    margin: 10px 0;
                }

                .progress-bar {
                    background: linear-gradient(90deg, #2ecc71, #3498db);
                    height: 100%;
                    width: 0%;
                    transition: width 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 12px;
                }

                /* Status Messages */
                .status-message {
                    padding: 10px;
                    border-radius: 4px;
                    margin: 10px 0;
                    font-size: 12px;
                }

                .status-success {
                    background: rgba(46, 204, 113, 0.2);
                    color: #2ecc71;
                    border: 1px solid #2ecc71;
                }

                .status-warning {
                    background: rgba(241, 196, 15, 0.2);
                    color: #f1c40f;
                    border: 1px solid #f1c40f;
                }

                .status-error {
                    background: rgba(231, 76, 60, 0.2);
                    color: #e74c3c;
                    border: 1px solid #e74c3c;
                }

                /* Loading Spinner */
                .loading-spinner {
                    border: 3px solid rgba(255,255,255,0.1);
                    border-top: 3px solid #3498db;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    animation: spin 1s linear infinite;
                    margin: 20px auto;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                /* Scrollbar */
                .organizer-content::-webkit-scrollbar {
                    width: 8px;
                }

                .organizer-content::-webkit-scrollbar-track {
                    background: rgba(255,255,255,0.05);
                }

                .organizer-content::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.2);
                    border-radius: 4px;
                }

                .organizer-content::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.3);
                }
            `);
        }

        createMainInterface() {
            this.container = document.createElement('div');
            this.container.className = 'collection-organizer';
            this.container.innerHTML = `
                <div class="organizer-header">
                    <div class="organizer-title">
                        📁 Collection Organizer
                    </div>
                    <div class="organizer-controls">
                        <button class="organizer-btn minimize-btn" title="Minimize">_</button>
                        <button class="organizer-btn close-btn" title="Close">✕</button>
                    </div>
                </div>
                
                <div class="organizer-nav">
                    <button class="organizer-btn nav-btn active" data-view="overview">Overview</button>
                    <button class="organizer-btn nav-btn" data-view="analyze">Analyze</button>
                    <button class="organizer-btn nav-btn" data-view="organize">Organize</button>
                    <button class="organizer-btn nav-btn" data-view="naming">Naming</button>
                    <button class="organizer-btn nav-btn" data-view="health">Health</button>
                </div>
                
                <div class="organizer-content" id="organizer-content">
                    <div class="loading-spinner"></div>
                </div>
            `;

            document.body.appendChild(this.container);
            this.createToggleButton();
        }

        createToggleButton() {
            console.log('Creating toggle button...');
            const navBar = document.querySelector('.nav-tabs') || document.querySelector('.navbar-nav');
            if (!navBar) {
                console.warn('Navigation bar not found. Looking for alternatives...');
                // Try more selectors
                const alternativeNav = document.querySelector('nav ul') || 
                                     document.querySelector('.navbar') ||
                                     document.querySelector('header nav');
                if (alternativeNav) {
                    console.log('Found alternative nav:', alternativeNav);
                }
                return;
            }
            console.log('Found navigation bar:', navBar);

            const toggleButton = document.createElement('button');
            toggleButton.className = 'nav-link btn btn-link';
            toggleButton.innerHTML = '📁 Organizer';
            toggleButton.style.cursor = 'pointer';
            toggleButton.addEventListener('click', () => this.toggle());

            const li = document.createElement('li');
            li.className = 'nav-item';
            li.appendChild(toggleButton);
            
            navBar.appendChild(li);
        }

        attachEventListeners() {
            // Navigation
            this.container.querySelectorAll('.nav-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.switchView(btn.dataset.view);
                });
            });

            // Window controls
            this.container.querySelector('.minimize-btn').addEventListener('click', () => {
                this.minimize();
            });

            this.container.querySelector('.close-btn').addEventListener('click', () => {
                this.close();
            });
            
            // Event delegation for dynamically created buttons
            this.container.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn || btn.classList.contains('nav-btn') || 
                    btn.classList.contains('minimize-btn') || 
                    btn.classList.contains('close-btn')) {
                    return;
                }
                
                // Map button text/classes to actions
                const buttonText = btn.textContent.trim();
                
                if (buttonText.includes('Create Organization Plan')) {
                    this.createOrganizationPlan();
                } else if (buttonText.includes('Execute Plan')) {
                    this.executePlan();
                } else if (buttonText === '❌ Cancel') {
                    this.cancelPlan();
                } else if (buttonText.includes('Refresh Collection')) {
                    this.refreshData();
                } else if (buttonText.includes('Run Analysis')) {
                    this.startAnalysis();
                } else if (buttonText.includes('Preview Changes')) {
                    this.previewNaming();
                } else if (buttonText.includes('Apply Naming Changes')) {
                    this.executeNaming();
                }
            });
        }

        async loadInitialData() {
            try {
                // Load all scenes
                const scenesData = await this.graphql.getAllScenes();
                this.scenes = scenesData.findScenes.scenes;
                
                // Load system stats
                const stats = await this.graphql.getSystemStats();
                this.systemStats = stats.stats;
                
                // Display overview
                this.displayOverview();
            } catch (error) {
                console.error('Failed to load initial data:', error);
                this.showError('Failed to load collection data');
            }
        }

        displayOverview() {
            const content = document.getElementById('organizer-content');
            
            const organizedCount = this.scenes.filter(s => s.organized).length;
            const withMetadata = this.scenes.filter(s => 
                s.title && s.performers?.length > 0 && s.studio
            ).length;
            
            content.innerHTML = `
                <div class="overview-section">
                    <h3>Collection Overview</h3>
                    <div class="stat-grid">
                        <div class="stat-item">
                            <div class="stat-value">${this.scenes.length}</div>
                            <div class="stat-label">Total Scenes</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${organizedCount}</div>
                            <div class="stat-label">Organized</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${withMetadata}</div>
                            <div class="stat-label">Complete Metadata</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${this.formatBytes(this.systemStats.total_size)}</div>
                            <div class="stat-label">Total Size</div>
                        </div>
                    </div>
                </div>
                
                <div class="overview-section">
                    <h3>Quick Actions</h3>
                    <button class="organizer-btn" id="analyze-collection-btn">
                        🔍 Analyze Collection
                    </button>
                    <button class="organizer-btn" id="organization-wizard-btn">
                        📂 Organization Wizard
                    </button>
                    <button class="organizer-btn" id="naming-wizard-btn">
                        ✏️ Naming Standardization
                    </button>
                </div>
                
                <div class="overview-section">
                    <h3>Collection Health</h3>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${this.calculateHealthScore()}%">
                            ${this.calculateHealthScore()}%
                        </div>
                    </div>
                    <div style="font-size: 12px; color: #95a5a6; margin-top: 5px;">
                        Based on organization, metadata completeness, and naming consistency
                    </div>
                </div>
            `;
            
            // Bind button event handlers
            setTimeout(() => {
                const analyzeBtn = document.getElementById('analyze-collection-btn');
                if (analyzeBtn) {
                    analyzeBtn.addEventListener('click', () => this.startAnalysis());
                }
                
                const orgWizardBtn = document.getElementById('organization-wizard-btn');
                if (orgWizardBtn) {
                    orgWizardBtn.addEventListener('click', () => this.switchView('organize'));
                }
                
                const namingWizardBtn = document.getElementById('naming-wizard-btn');
                if (namingWizardBtn) {
                    namingWizardBtn.addEventListener('click', () => this.showNamingView());
                }
            }, 100);
        }
        
        showOrganizationWizard() {
            this.switchView('organize');
        }

        async startAnalysis() {
            this.switchView('analyze');
            const content = document.getElementById('organizer-content');
            
            content.innerHTML = `
                <div class="status-message status-info">
                    🔍 Analyzing collection patterns...
                </div>
                <div class="loading-spinner"></div>
            `;
            
            try {
                // Run pattern analysis
                this.analysisResults = await this.patternEngine.analyzeExistingPatterns(this.scenes);
                
                // Generate suggestions
                const suggestions = this.patternEngine.generateOrganizationSuggestions(
                    this.analysisResults,
                    this.scenes
                );
                
                this.displayAnalysisResults(this.analysisResults, suggestions);
            } catch (error) {
                console.error('Analysis failed:', error);
                this.showError('Analysis failed: ' + error.message);
            }
        }

        displayAnalysisResults(analysis, suggestions) {
            const content = document.getElementById('organizer-content');
            
            content.innerHTML = `
                <div class="analysis-results">
                    <div class="analysis-card">
                        <h4>Folder Organization Patterns</h4>
                        ${analysis.folderStructures.patterns.map(pattern => `
                            <div class="pattern-item">
                                ${pattern.type}
                                <span class="pattern-count">${pattern.count} scenes</span>
                            </div>
                        `).join('')}
                        <div style="margin-top: 10px; font-size: 12px; color: #95a5a6;">
                            Average folder depth: ${analysis.folderStructures.averageDepth.toFixed(1)}
                        </div>
                    </div>
                    
                    <div class="analysis-card">
                        <h4>Naming Conventions</h4>
                        ${analysis.namingConventions.patterns.slice(0, 5).map(pattern => `
                            <div class="pattern-item">
                                ${pattern.template}
                                <span class="pattern-count">${pattern.count} files</span>
                            </div>
                        `).join('')}
                        <div style="margin-top: 10px; font-size: 12px; color: #95a5a6;">
                            Naming consistency: ${analysis.namingConventions.consistency.toFixed(1)}%
                        </div>
                    </div>
                    
                    <div class="analysis-card">
                        <h4>Metadata Completeness</h4>
                        <div style="font-size: 12px;">
                            ${Object.entries(analysis.metadataUsage.byField).map(([field, percentage]) => `
                                <div style="margin: 5px 0;">
                                    <span style="color: #ecf0f1;">${field}:</span>
                                    <span style="color: #3498db; float: right;">${percentage.toFixed(1)}%</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="analysis-card">
                        <h4>User Preferences Detected</h4>
                        <div style="font-size: 12px; color: #ecf0f1;">
                            <div>Preferred grouping: <strong>${analysis.organizationPreferences.preferredGrouping}</strong></div>
                            <div>Naming style: <strong>${analysis.organizationPreferences.namingStyle}</strong></div>
                            <div>Folder depth: <strong>${analysis.organizationPreferences.folderDepth}</strong></div>
                            <div>Organization consistency: <strong>${analysis.organizationPreferences.organizationConsistency.toFixed(1)}%</strong></div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <button class="organizer-btn">
                            📋 Create Organization Plan
                        </button>
                    </div>
                </div>
            `;
        }

        async createOrganizationPlan() {
            if (!this.analysisResults) {
                this.showError('Please run analysis first');
                return;
            }
            
            const content = document.getElementById('organizer-content');
            content.innerHTML = '<div class="loading-spinner"></div>';
            
            try {
                const suggestions = this.patternEngine.generateOrganizationSuggestions(
                    this.analysisResults,
                    this.scenes
                );
                
                this.organizationPlan = await this.fileSystem.createOrganizationPlan(
                    this.scenes,
                    this.analysisResults.organizationPreferences,
                    suggestions
                );
                
                this.displayOrganizationPlan(this.organizationPlan);
            } catch (error) {
                console.error('Failed to create organization plan:', error);
                this.showError('Failed to create organization plan');
            }
        }

        displayOrganizationPlan(plan) {
            const content = document.getElementById('organizer-content');
            
            content.innerHTML = `
                <div class="organization-plan">
                    <h3 style="color: #3498db; margin-bottom: 15px;">Organization Plan</h3>
                    
                    <div class="plan-summary" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                        <div style="font-size: 14px; color: #ecf0f1;">
                            <div>Total operations: <strong>${plan.operations.length}</strong></div>
                            <div>Files to move: <strong>${plan.preview.summary.totalChanges}</strong></div>
                            <div>Folders to create: <strong>${plan.preview.summary.foldersCreated}</strong></div>
                            <div>Files to rename: <strong>${plan.preview.summary.filesRenamed}</strong></div>
                        </div>
                    </div>
                    
                    <div class="preview-container">
                        <div class="preview-column">
                            <h4>Current Structure</h4>
                            <div class="folder-tree">
                                ${this.renderFolderTree(plan.preview.beforeStructure)}
                            </div>
                        </div>
                        
                        <div class="preview-column">
                            <h4>Proposed Structure</h4>
                            <div class="folder-tree">
                                ${this.renderFolderTree(plan.preview.afterStructure)}
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px; text-align: center;">
                        <button class="organizer-btn" style="background: #27ae60;">
                            ✅ Execute Plan
                        </button>
                        <button class="organizer-btn" style="background: #e74c3c; margin-left: 10px;">
                            ❌ Cancel
                        </button>
                    </div>
                </div>
            `;
        }

        renderFolderTree(structure, level = 0) {
            const folders = Array.from(structure.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(0, 20); // Limit display
            
            return folders.map(([path, data]) => {
                const indent = '  '.repeat(level);
                const folderName = path.split('/').pop() || 'Root';
                const fileCount = data.files.length;
                
                return `
                    <div class="folder-item" style="padding-left: ${level * 20}px;">
                        <span class="folder-name">📁 ${folderName}</span>
                        <span class="file-count">(${fileCount} files)</span>
                    </div>
                `;
            }).join('');
        }

        async executePlan() {
            if (!this.organizationPlan) {
                this.showError('No organization plan available');
                return;
            }
            
            const content = document.getElementById('organizer-content');
            content.innerHTML = `
                <div class="execution-progress">
                    <h3 style="color: #3498db; margin-bottom: 15px;">Executing Organization Plan</h3>
                    
                    <div class="progress-container">
                        <div class="progress-bar" id="execution-progress">0%</div>
                    </div>
                    
                    <div id="execution-status" style="margin-top: 15px;">
                        <div class="status-message status-info">
                            Starting organization process...
                        </div>
                    </div>
                    
                    <div id="execution-log" style="margin-top: 15px; max-height: 300px; overflow-y: auto;">
                    </div>
                </div>
            `;
            
            try {
                const results = await this.fileSystem.executeOrganizationPlan(
                    this.organizationPlan,
                    (progress) => this.updateExecutionProgress(progress)
                );
                
                this.displayExecutionResults(results);
            } catch (error) {
                console.error('Plan execution failed:', error);
                this.showError('Plan execution failed: ' + error.message);
            }
        }

        updateExecutionProgress(progress) {
            const progressBar = document.getElementById('execution-progress');
            const statusDiv = document.getElementById('execution-status');
            const logDiv = document.getElementById('execution-log');
            
            const percentage = Math.round((progress.current / progress.total) * 100);
            progressBar.style.width = `${percentage}%`;
            progressBar.textContent = `${percentage}%`;
            
            // Update status
            const statusClass = progress.status === 'success' ? 'status-success' : 'status-error';
            statusDiv.innerHTML = `
                <div class="status-message ${statusClass}">
                    ${progress.status === 'success' ? '✅' : '❌'} 
                    Operation ${progress.current}/${progress.total}: 
                    ${progress.operation.type} - ${progress.operation.targetPath.split('/').pop()}
                </div>
            `;
            
            // Add to log
            const logEntry = document.createElement('div');
            logEntry.className = `status-message ${statusClass}`;
            logEntry.style.fontSize = '11px';
            logEntry.style.marginBottom = '5px';
            logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${progress.operation.type}: ${progress.operation.targetPath}`;
            logDiv.appendChild(logEntry);
            logDiv.scrollTop = logDiv.scrollHeight;
        }

        displayExecutionResults(results) {
            const content = document.getElementById('organizer-content');
            
            content.innerHTML = `
                <div class="execution-results">
                    <h3 style="color: #3498db; margin-bottom: 15px;">Organization Complete</h3>
                    
                    <div class="results-summary" style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 6px;">
                        <div style="color: #2ecc71; margin-bottom: 10px;">
                            ✅ Successful: ${results.successful.length} operations
                        </div>
                        ${results.failed.length > 0 ? `
                            <div style="color: #e74c3c; margin-bottom: 10px;">
                                ❌ Failed: ${results.failed.length} operations
                            </div>
                        ` : ''}
                        ${results.skipped.length > 0 ? `
                            <div style="color: #f39c12;">
                                ⏭️ Skipped: ${results.skipped.length} operations
                            </div>
                        ` : ''}
                    </div>
                    
                    ${results.failed.length > 0 ? `
                        <div class="failed-operations" style="margin-top: 15px;">
                            <h4 style="color: #e74c3c;">Failed Operations</h4>
                            ${results.failed.map(failure => `
                                <div class="status-message status-error" style="font-size: 12px;">
                                    ${failure.operation.targetPath}: ${failure.error}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div style="margin-top: 20px; text-align: center;">
                        <button class="organizer-btn">
                            🔄 Refresh Collection
                        </button>
                    </div>
                </div>
            `;
        }

        calculateHealthScore() {
            if (this.scenes.length === 0) return 0;
            
            const organized = this.scenes.filter(s => s.organized).length / this.scenes.length;
            const withMetadata = this.scenes.filter(s => 
                s.title && s.performers?.length > 0 && s.studio
            ).length / this.scenes.length;
            
            // Simple health score calculation
            const score = (organized * 50) + (withMetadata * 50);
            
            return Math.round(score);
        }

        formatBytes(bytes) {
            if (bytes === 0) return '0 Bytes';
            
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        switchView(view) {
            this.currentView = view;
            
            // Update nav buttons
            this.container.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === view);
            });
            
            // Load view content
            switch (view) {
                case 'overview':
                    this.displayOverview();
                    break;
                case 'analyze':
                    this.startAnalysis();
                    break;
                case 'organize':
                    this.showOrganizationView();
                    break;
                case 'naming':
                    this.showNamingView();
                    break;
                case 'health':
                    this.showHealthView();
                    break;
            }
        }

        showOrganizationView() {
            const content = document.getElementById('organizer-content');
            
            if (!this.analysisResults) {
                content.innerHTML = `
                    <div class="status-message status-warning">
                        ⚠️ Please run analysis first to see organization options
                    </div>
                    <button class="organizer-btn">
                        🔍 Run Analysis
                    </button>
                `;
                return;
            }
            
            this.createOrganizationPlan();
        }

        showNamingView() {
            const content = document.getElementById('organizer-content');
            
            content.innerHTML = `
                <div class="naming-view">
                    <h3 style="color: #3498db; margin-bottom: 15px;">File Naming Standardization</h3>
                    
                    <div class="naming-templates" style="margin-bottom: 20px;">
                        <h4 style="color: #e74c3c; margin-bottom: 10px;">Select Naming Template</h4>
                        <select id="naming-template" class="organizer-select" style="width: 100%; padding: 8px; background: #2c3e50; color: white; border: 1px solid #34495e; border-radius: 4px;">
                            ${Object.entries(this.namingEngine.templates).map(([key, template]) => `
                                <option value="${key}">${template}</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <button class="organizer-btn">
                        👁️ Preview Changes
                    </button>
                    
                    <div id="naming-preview" style="margin-top: 20px;"></div>
                </div>
            `;
        }

        async previewNaming() {
            const templateSelect = document.getElementById('naming-template');
            const previewDiv = document.getElementById('naming-preview');
            
            previewDiv.innerHTML = '<div class="loading-spinner"></div>';
            
            try {
                const batchRenames = this.namingEngine.generateBatchRenames(
                    this.scenes,
                    templateSelect.value
                );
                
                previewDiv.innerHTML = `
                    <div class="naming-preview">
                        <div class="status-message status-info">
                            📊 ${batchRenames.total} files will be renamed
                        </div>
                        
                        ${batchRenames.conflicts.length > 0 ? `
                            <div class="status-message status-warning">
                                ⚠️ ${batchRenames.conflicts.length} naming conflicts detected
                            </div>
                        ` : ''}
                        
                        <div style="margin-top: 15px; max-height: 300px; overflow-y: auto;">
                            ${batchRenames.renames.slice(0, 20).map(rename => `
                                <div style="background: rgba(255,255,255,0.05); padding: 10px; margin: 5px 0; border-radius: 4px; font-size: 12px;">
                                    <div style="color: #e74c3c;">Current: ${rename.currentFilename}</div>
                                    <div style="color: #2ecc71; margin-top: 5px;">New: ${rename.newFilename}</div>
                                </div>
                            `).join('')}
                            ${batchRenames.renames.length > 20 ? `
                                <div style="text-align: center; padding: 10px; color: #95a5a6;">
                                    ... and ${batchRenames.renames.length - 20} more
                                </div>
                            ` : ''}
                        </div>
                        
                        ${batchRenames.total > 0 ? `
                            <div style="margin-top: 20px; text-align: center;">
                                <button class="organizer-btn" style="background: #27ae60;">
                                    ✅ Apply Naming Changes
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `;
                
                // Store for execution
                this.pendingRenames = batchRenames;
            } catch (error) {
                console.error('Failed to preview naming:', error);
                this.showError('Failed to preview naming changes');
            }
        }

        async showHealthView() {
            const content = document.getElementById('organizer-content');
            content.innerHTML = '<div class="loading-spinner"></div>';
            
            try {
                // Analyze metadata completeness
                const analysis = this.metadataAnalyzer.analyzeCompleteness(this.scenes);
                
                content.innerHTML = `
                    <div class="health-view">
                        <h3 style="color: #3498db;">Collection Health Report</h3>
                        
                        <div class="health-overview">
                            <div class="metric-card">
                                <h4>Overall Completeness</h4>
                                <div class="metric-value" style="color: ${this.getScoreColor(analysis.overall)};">
                                    ${Math.round(analysis.overall)}%
                                </div>
                            </div>
                            
                            <div class="metric-card">
                                <h4>Total Scenes</h4>
                                <div class="metric-value">${this.scenes.length}</div>
                            </div>
                        </div>
                        
                        <div class="score-distribution">
                            <h4>Metadata Quality Distribution</h4>
                            <div class="distribution-bars">
                                <div class="dist-item">
                                    <span class="dist-label">Excellent (90-100%)</span>
                                    <div class="dist-bar" style="background: #2ecc71; width: ${(analysis.scoreDistribution.excellent / this.scenes.length) * 100}%;">
                                        ${analysis.scoreDistribution.excellent}
                                    </div>
                                </div>
                                <div class="dist-item">
                                    <span class="dist-label">Good (70-89%)</span>
                                    <div class="dist-bar" style="background: #3498db; width: ${(analysis.scoreDistribution.good / this.scenes.length) * 100}%;">
                                        ${analysis.scoreDistribution.good}
                                    </div>
                                </div>
                                <div class="dist-item">
                                    <span class="dist-label">Fair (50-69%)</span>
                                    <div class="dist-bar" style="background: #f39c12; width: ${(analysis.scoreDistribution.fair / this.scenes.length) * 100}%;">
                                        ${analysis.scoreDistribution.fair}
                                    </div>
                                </div>
                                <div class="dist-item">
                                    <span class="dist-label">Poor (&lt;50%)</span>
                                    <div class="dist-bar" style="background: #e74c3c; width: ${(analysis.scoreDistribution.poor / this.scenes.length) * 100}%;">
                                        ${analysis.scoreDistribution.poor}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="field-completeness">
                            <h4>Field Completeness</h4>
                            ${this.renderFieldCompleteness(analysis.byField)}
                        </div>
                        
                        ${analysis.suggestions.length > 0 ? `
                            <div class="improvement-suggestions">
                                <h4>Improvement Suggestions</h4>
                                ${analysis.suggestions.map(suggestion => `
                                    <div class="suggestion-item priority-${suggestion.priority}">
                                        <span class="suggestion-icon">${suggestion.type === 'bulk_operation' ? '⚡' : 
                                                                       suggestion.type === 'batch_scraping' ? '🔍' : '📁'}</span>
                                        <span class="suggestion-text">${suggestion.description}</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        
                        ${analysis.criticalMissing.length > 0 ? `
                            <div class="critical-missing">
                                <h4>Scenes Needing Attention (${analysis.criticalMissing.length})</h4>
                                <div class="missing-scenes-list">
                                    ${analysis.criticalMissing.slice(0, 10).map(item => `
                                        <div class="missing-scene-item">
                                            <div class="scene-title">${item.scene.title || 'Untitled'}</div>
                                            <div class="scene-score">Score: ${item.score}%</div>
                                            <div class="missing-fields">Missing: ${item.criticalMissing.join(', ')}</div>
                                        </div>
                                    `).join('')}
                                    ${analysis.criticalMissing.length > 10 ? 
                                        `<div class="more-items">... and ${analysis.criticalMissing.length - 10} more</div>` : ''}
                                </div>
                            </div>
                        ` : ''}
                        
                        <div style="margin-top: 20px; text-align: center;">
                            <button class="organizer-btn">
                                📊 Export Report
                            </button>
                        </div>
                    </div>
                `;
                
                this.addHealthViewStyles();
                
            } catch (error) {
                console.error('Failed to analyze collection health:', error);
                content.innerHTML = `
                    <div class="status-message status-error">
                        ❌ Failed to analyze collection health: ${error.message}
                    </div>
                `;
            }
        }
        
        renderFieldCompleteness(fieldData) {
            const sortedFields = Array.from(fieldData.entries())
                .sort((a, b) => b[1].percentage - a[1].percentage);
                
            return sortedFields.map(([field, stats]) => `
                <div class="field-stat">
                    <span class="field-name">${field}</span>
                    <div class="field-bar-container">
                        <div class="field-bar" style="width: ${stats.percentage}%; background: ${this.getScoreColor(stats.percentage)};">
                            ${Math.round(stats.percentage)}%
                        </div>
                    </div>
                    <span class="field-count">${stats.present}/${stats.present + stats.missing}</span>
                </div>
            `).join('');
        }
        
        getScoreColor(score) {
            if (score >= 90) return '#2ecc71';
            if (score >= 70) return '#3498db';
            if (score >= 50) return '#f39c12';
            return '#e74c3c';
        }
        
        addHealthViewStyles() {
            const styleId = 'health-view-styles';
            if (!document.getElementById(styleId)) {
                GM_addStyle(`
                    .health-overview {
                        display: flex;
                        gap: 15px;
                        margin: 20px 0;
                    }
                    
                    .metric-card {
                        flex: 1;
                        background: rgba(255,255,255,0.05);
                        padding: 15px;
                        border-radius: 6px;
                        text-align: center;
                    }
                    
                    .metric-card h4 {
                        color: #95a5a6;
                        margin: 0 0 10px 0;
                        font-size: 12px;
                    }
                    
                    .metric-value {
                        font-size: 24px;
                        font-weight: bold;
                    }
                    
                    .score-distribution {
                        background: rgba(255,255,255,0.05);
                        padding: 15px;
                        border-radius: 6px;
                        margin: 20px 0;
                    }
                    
                    .distribution-bars h4 {
                        color: #3498db;
                        margin: 0 0 15px 0;
                        font-size: 14px;
                    }
                    
                    .dist-item {
                        margin: 10px 0;
                    }
                    
                    .dist-label {
                        display: block;
                        color: #95a5a6;
                        font-size: 11px;
                        margin-bottom: 5px;
                    }
                    
                    .dist-bar {
                        height: 20px;
                        border-radius: 10px;
                        color: white;
                        font-size: 11px;
                        line-height: 20px;
                        text-align: center;
                        min-width: 30px;
                    }
                    
                    .field-completeness {
                        background: rgba(255,255,255,0.05);
                        padding: 15px;
                        border-radius: 6px;
                        margin: 20px 0;
                    }
                    
                    .field-completeness h4 {
                        color: #3498db;
                        margin: 0 0 15px 0;
                        font-size: 14px;
                    }
                    
                    .field-stat {
                        display: flex;
                        align-items: center;
                        margin: 8px 0;
                        font-size: 12px;
                    }
                    
                    .field-name {
                        width: 80px;
                        color: #ecf0f1;
                        text-transform: capitalize;
                    }
                    
                    .field-bar-container {
                        flex: 1;
                        background: rgba(0,0,0,0.3);
                        height: 16px;
                        border-radius: 8px;
                        margin: 0 10px;
                        overflow: hidden;
                    }
                    
                    .field-bar {
                        height: 100%;
                        font-size: 10px;
                        line-height: 16px;
                        text-align: center;
                        color: white;
                        transition: width 0.3s;
                    }
                    
                    .field-count {
                        color: #95a5a6;
                        font-size: 11px;
                        width: 50px;
                        text-align: right;
                    }
                    
                    .improvement-suggestions {
                        background: rgba(255,255,255,0.05);
                        padding: 15px;
                        border-radius: 6px;
                        margin: 20px 0;
                    }
                    
                    .improvement-suggestions h4 {
                        color: #3498db;
                        margin: 0 0 15px 0;
                        font-size: 14px;
                    }
                    
                    .suggestion-item {
                        padding: 10px;
                        margin: 8px 0;
                        border-radius: 4px;
                        font-size: 12px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    
                    .suggestion-item.priority-high {
                        background: rgba(231, 76, 60, 0.2);
                        border-left: 3px solid #e74c3c;
                    }
                    
                    .suggestion-item.priority-medium {
                        background: rgba(241, 196, 15, 0.2);
                        border-left: 3px solid #f1c40f;
                    }
                    
                    .suggestion-icon {
                        font-size: 16px;
                    }
                    
                    .critical-missing {
                        background: rgba(231, 76, 60, 0.1);
                        padding: 15px;
                        border-radius: 6px;
                        margin: 20px 0;
                    }
                    
                    .critical-missing h4 {
                        color: #e74c3c;
                        margin: 0 0 15px 0;
                        font-size: 14px;
                    }
                    
                    .missing-scene-item {
                        background: rgba(255,255,255,0.05);
                        padding: 10px;
                        margin: 8px 0;
                        border-radius: 4px;
                        font-size: 12px;
                    }
                    
                    .scene-title {
                        color: #ecf0f1;
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    
                    .scene-score {
                        color: #e74c3c;
                        font-size: 11px;
                        margin-bottom: 3px;
                    }
                    
                    .missing-fields {
                        color: #95a5a6;
                        font-size: 11px;
                    }
                    
                    .more-items {
                        text-align: center;
                        color: #95a5a6;
                        font-size: 11px;
                        margin-top: 10px;
                    }
                `);
            }
        }

        async refreshData() {
            await this.loadInitialData();
            this.showSuccess('Collection data refreshed');
        }

        showError(message) {
            const content = document.getElementById('organizer-content');
            content.innerHTML = `
                <div class="status-message status-error">
                    ❌ ${message}
                </div>
            `;
        }

        showSuccess(message) {
            const existingMessage = this.container.querySelector('.status-message');
            if (existingMessage) {
                existingMessage.className = 'status-message status-success';
                existingMessage.textContent = `✅ ${message}`;
            }
        }

        toggle() {
            const isVisible = this.container.style.display === 'flex';
            this.container.style.display = isVisible ? 'none' : 'flex';
        }

        minimize() {
            this.container.style.display = 'none';
        }

        close() {
            this.container.style.display = 'none';
        }
    }

    // ===== INITIALIZATION =====
    let collectionOrganizer;

    function initialize() {
        console.log('📁 Collection Organizer: Initializing...');
        
        // Debug: Log what we're looking for
        console.log('Looking for .main:', document.querySelector('.main'));
        console.log('Looking for [data-rb-event-key]:', document.querySelector('[data-rb-event-key]'));
        console.log('Current URL:', window.location.href);
        console.log('Document body:', document.body);
        
        // Try a more general approach - wait for any nav element
        let attempts = 0;
        const maxAttempts = 10;
        
        const checkInterval = setInterval(() => {
            attempts++;
            const navElement = document.querySelector('.navbar-nav') || 
                              document.querySelector('.nav-tabs') || 
                              document.querySelector('nav') ||
                              document.querySelector('#root');
            
            console.log(`Attempt ${attempts}/${maxAttempts} - Checking for nav element:`, navElement);
            
            // Initialize if we find the element OR if we've tried enough times
            if (navElement || attempts >= maxAttempts) {
                clearInterval(checkInterval);
                
                if (!navElement) {
                    console.warn('📁 Collection Organizer: Could not find nav element, initializing anyway...');
                }}
                
                // Initialize components
                const graphqlClient = new GraphQLClient();
                const patternEngine = new PatternAnalysisEngine(graphqlClient);
                const fileSystem = new FileOrganizationSystem(graphqlClient);
                const namingEngine = new NamingConventionEngine();
                const metadataAnalyzer = new MetadataCompletenessAnalyzer(graphqlClient);
                
                // Create UI
                collectionOrganizer = new CollectionOrganizerUI(
                    patternEngine,
                    fileSystem,
                    namingEngine,
                    metadataAnalyzer,
                    graphqlClient
                );
                
                // Make globally accessible
                window.collectionOrganizer = collectionOrganizer;
                
                console.log('✅ Collection Organizer: Ready');
            }
        }, 1000);
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('📁 Collection Organizer: DOM loaded, waiting a bit...');
            setTimeout(initialize, 1000);
        });
    } else {
        console.log('📁 Collection Organizer: Document already loaded, waiting a bit...');
        setTimeout(initialize, 1000);
    }
})();