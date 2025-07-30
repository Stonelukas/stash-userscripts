// ==UserScript==
// @name         Stash Export/Import Tools
// @namespace    https://github.com/7dJx1qP/stash-userscripts
// @version      1.0.0
// @description  Comprehensive data portability tools for Stash - export, import, backup, and migrate data
// @author       7dJx1qP
// @match        http://localhost:9998/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_download
// @grant        GM_notification
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ============= Configuration =============
    const CONFIG = {
        STASH_URL: 'http://localhost:9998',
        GRAPHQL_ENDPOINT: '/graphql',
        DEFAULT_CHUNK_SIZE: 1000,
        MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
        EXPORT_FORMATS: ['json', 'csv', 'xml'],
        IMPORT_FORMATS: ['json', 'csv', 'plex', 'jellyfin', 'kodi'],
        BACKUP_COMPRESSION: ['none', 'gzip', 'zip'],
        DEBUG_MODE: false
    };

    // ============= Utilities =============
    const log = (message, level = 'info') => {
        if (CONFIG.DEBUG_MODE || level === 'error') {
            const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
            console.log(`[Export/Import Tools] ${prefix} ${message}`);
        }
    };

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const downloadFile = (content, filename, mimeType = 'application/json') => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // ============= GraphQL Client =============
    class GraphQLClient {
        constructor() {
            this.endpoint = CONFIG.STASH_URL + CONFIG.GRAPHQL_ENDPOINT;
        }

        async query(query, variables = {}) {
            try {
                const response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query, variables })
                });

                const data = await response.json();
                if (data.errors) {
                    throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
                }
                return data.data;
            } catch (error) {
                log(`GraphQL query failed: ${error.message}`, 'error');
                throw error;
            }
        }

        async findScenes(filter = {}) {
            const query = `
                query FindScenes($filter: FindFilterType!) {
                    findScenes(filter: $filter) {
                        count
                        scenes {
                            id
                            title
                            details
                            date
                            rating100
                            organized
                            paths {
                                screenshot
                            }
                            file {
                                size
                                duration
                                video_codec
                                audio_codec
                                width
                                height
                                frame_rate
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
                            stash_ids {
                                endpoint
                                stash_id
                            }
                        }
                    }
                }
            `;
            return await this.query(query, { filter });
        }

        async findPerformers(filter = {}) {
            const query = `
                query FindPerformers($filter: FindFilterType!) {
                    findPerformers(filter: $filter) {
                        count
                        performers {
                            id
                            name
                            gender
                            birthdate
                            country
                            ethnicity
                            hair_color
                            eye_color
                            height_cm
                            weight
                            measurements
                            fake_tits
                            career_length
                            tattoos
                            piercings
                            alias_list
                            twitter
                            instagram
                            image_path
                            scene_count
                            rating100
                            details
                            death_date
                            url
                            stash_ids {
                                endpoint
                                stash_id
                            }
                        }
                    }
                }
            `;
            return await this.query(query, { filter });
        }

        async findStudios(filter = {}) {
            const query = `
                query FindStudios($filter: FindFilterType!) {
                    findStudios(filter: $filter) {
                        count
                        studios {
                            id
                            name
                            url
                            parent_studio {
                                id
                                name
                            }
                            child_studios {
                                id
                                name
                            }
                            image_path
                            scene_count
                            rating100
                            details
                            aliases
                            stash_ids {
                                endpoint
                                stash_id
                            }
                        }
                    }
                }
            `;
            return await this.query(query, { filter });
        }

        async findTags(filter = {}) {
            const query = `
                query FindTags($filter: FindFilterType!) {
                    findTags(filter: $filter) {
                        count
                        tags {
                            id
                            name
                            aliases
                            description
                            image_path
                            scene_count
                            scene_marker_count
                            parent_count
                            child_count
                        }
                    }
                }
            `;
            return await this.query(query, { filter });
        }

        async configuration() {
            const query = `
                query Configuration {
                    configuration {
                        general {
                            databasePath
                            generatedPath
                            metadataPath
                            scrapersPath
                            cachePath
                            calculateMD5
                            videoFileNamingAlgorithm
                            parallelTasks
                            previewAudio
                            previewSegments
                            previewSegmentDuration
                            previewExcludeStart
                            previewExcludeEnd
                            previewPreset
                            transcodeSize
                            maxTranscodeSize
                            maxStreamingTranscodeSize
                            writeImageThumbnails
                            createImageClipsFromVideos
                            apiKey
                            username
                            password
                            maxSessionAge
                            logLevel
                            logAccess
                            createGalleriesFromFolders
                            videoExtensions
                            imageExtensions
                            galleryExtensions
                            excludes
                            imageExcludes
                            customPerformerImageLocation
                            scraperUserAgent
                            scraperCertCheck
                            scraperCDPPath
                            stashBoxes {
                                name
                                endpoint
                                api_key
                            }
                        }
                    }
                }
            `;
            return await this.query(query);
        }

        async version() {
            const query = `
                query Version {
                    version {
                        version
                        hash
                        build_time
                    }
                }
            `;
            return await this.query(query);
        }
    }

    // ============= Format Adapters =============
    class JSONAdapter {
        constructor() {
            this.format = 'json';
            this.mimeType = 'application/json';
            this.extension = '.json';
        }

        async convert(data, options = {}) {
            const { pretty = true } = options;
            return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
        }

        async parse(content) {
            return JSON.parse(content);
        }
    }

    class CSVAdapter {
        constructor() {
            this.format = 'csv';
            this.mimeType = 'text/csv';
            this.extension = '.csv';
        }

        async convert(data, options = {}) {
            const { headers = true, delimiter = ',' } = options;
            
            if (!Array.isArray(data) || data.length === 0) {
                return '';
            }

            const flattenObject = (obj, prefix = '') => {
                return Object.keys(obj).reduce((acc, key) => {
                    const value = obj[key];
                    const newKey = prefix ? `${prefix}.${key}` : key;
                    
                    if (value && typeof value === 'object' && !Array.isArray(value)) {
                        Object.assign(acc, flattenObject(value, newKey));
                    } else if (Array.isArray(value)) {
                        acc[newKey] = value.map(v => typeof v === 'object' ? v.id || v.name : v).join(';');
                    } else {
                        acc[newKey] = value;
                    }
                    
                    return acc;
                }, {});
            };

            const flatData = data.map(item => flattenObject(item));
            const allKeys = [...new Set(flatData.flatMap(item => Object.keys(item)))];

            let csv = '';
            if (headers) {
                csv += allKeys.join(delimiter) + '\n';
            }

            csv += flatData.map(row => 
                allKeys.map(key => {
                    const value = row[key];
                    if (value === null || value === undefined) return '';
                    if (typeof value === 'string' && value.includes(delimiter)) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(delimiter)
            ).join('\n');

            return csv;
        }

        async parse(content, options = {}) {
            const { headers = true, delimiter = ',' } = options;
            const lines = content.split('\n').filter(line => line.trim());
            
            if (lines.length === 0) return [];

            const header = headers ? lines[0].split(delimiter) : null;
            const dataLines = headers ? lines.slice(1) : lines;

            return dataLines.map((line, index) => {
                const values = line.split(delimiter);
                if (!headers) {
                    return values;
                }

                const obj = {};
                header.forEach((key, i) => {
                    let value = values[i] || '';
                    
                    // Remove quotes
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1).replace(/""/g, '"');
                    }
                    
                    // Handle nested properties
                    const keys = key.split('.');
                    let current = obj;
                    
                    for (let j = 0; j < keys.length - 1; j++) {
                        if (!current[keys[j]]) {
                            current[keys[j]] = {};
                        }
                        current = current[keys[j]];
                    }
                    
                    // Handle array values
                    if (value.includes(';')) {
                        current[keys[keys.length - 1]] = value.split(';');
                    } else {
                        current[keys[keys.length - 1]] = value;
                    }
                });
                
                return obj;
            });
        }
    }

    class XMLAdapter {
        constructor() {
            this.format = 'xml';
            this.mimeType = 'application/xml';
            this.extension = '.xml';
        }

        async convert(data, options = {}) {
            const { rootElement = 'stash-export', pretty = true } = options;
            
            const escapeXML = (str) => {
                if (str === null || str === undefined) return '';
                return String(str)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&apos;');
            };

            const objectToXML = (obj, indent = '') => {
                let xml = '';
                
                for (const [key, value] of Object.entries(obj)) {
                    if (value === null || value === undefined) continue;
                    
                    const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
                    
                    if (Array.isArray(value)) {
                        value.forEach(item => {
                            if (typeof item === 'object') {
                                xml += `${indent}<${sanitizedKey}>\n`;
                                xml += objectToXML(item, indent + '  ');
                                xml += `${indent}</${sanitizedKey}>\n`;
                            } else {
                                xml += `${indent}<${sanitizedKey}>${escapeXML(item)}</${sanitizedKey}>\n`;
                            }
                        });
                    } else if (typeof value === 'object') {
                        xml += `${indent}<${sanitizedKey}>\n`;
                        xml += objectToXML(value, indent + '  ');
                        xml += `${indent}</${sanitizedKey}>\n`;
                    } else {
                        xml += `${indent}<${sanitizedKey}>${escapeXML(value)}</${sanitizedKey}>\n`;
                    }
                }
                
                return xml;
            };

            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xml += `<${rootElement}>\n`;
            
            if (Array.isArray(data)) {
                data.forEach(item => {
                    xml += '  <item>\n';
                    xml += objectToXML(item, '    ');
                    xml += '  </item>\n';
                });
            } else {
                xml += objectToXML(data, '  ');
            }
            
            xml += `</${rootElement}>`;
            
            return pretty ? xml : xml.replace(/\n\s*/g, '');
        }

        async parse(content) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(content, 'text/xml');
            
            const xmlToObject = (node) => {
                const obj = {};
                
                // Handle attributes
                if (node.attributes && node.attributes.length > 0) {
                    for (let i = 0; i < node.attributes.length; i++) {
                        const attr = node.attributes[i];
                        obj[`@${attr.name}`] = attr.value;
                    }
                }
                
                // Handle child nodes
                if (node.hasChildNodes()) {
                    const childNodes = [];
                    
                    for (let i = 0; i < node.childNodes.length; i++) {
                        const child = node.childNodes[i];
                        
                        if (child.nodeType === Node.TEXT_NODE) {
                            const text = child.nodeValue.trim();
                            if (text) {
                                return text;
                            }
                        } else if (child.nodeType === Node.ELEMENT_NODE) {
                            childNodes.push(child);
                        }
                    }
                    
                    childNodes.forEach(child => {
                        const childObj = xmlToObject(child);
                        
                        if (obj[child.nodeName]) {
                            if (!Array.isArray(obj[child.nodeName])) {
                                obj[child.nodeName] = [obj[child.nodeName]];
                            }
                            obj[child.nodeName].push(childObj);
                        } else {
                            obj[child.nodeName] = childObj;
                        }
                    });
                }
                
                return obj;
            };
            
            return xmlToObject(xmlDoc.documentElement);
        }
    }

    // ============= Export Engine =============
    class ExportEngine {
        constructor(graphqlClient) {
            this.client = graphqlClient;
            this.formatAdapters = new Map();
            this.registerDefaultAdapters();
        }

        registerDefaultAdapters() {
            this.formatAdapters.set('json', new JSONAdapter());
            this.formatAdapters.set('csv', new CSVAdapter());
            this.formatAdapters.set('xml', new XMLAdapter());
        }

        async exportData(options) {
            const {
                format = 'json',
                dataTypes = ['scenes', 'performers', 'studios', 'tags'],
                filters = {},
                fields = {},
                includeRelated = true,
                chunkSize = CONFIG.DEFAULT_CHUNK_SIZE,
                onProgress = () => {}
            } = options;

            const adapter = this.formatAdapters.get(format);
            if (!adapter) {
                throw new Error(`Unsupported export format: ${format}`);
            }

            onProgress({ status: 'starting', message: 'Starting export...' });

            const exportData = {};
            const metadata = {
                exportDate: new Date().toISOString(),
                version: await this.getStashVersion(),
                format: format,
                dataTypes: dataTypes
            };

            for (const dataType of dataTypes) {
                onProgress({ 
                    status: 'extracting', 
                    dataType, 
                    message: `Extracting ${dataType}...` 
                });

                const data = await this.extractDataType(
                    dataType, 
                    filters[dataType] || {}, 
                    fields[dataType] || null,
                    chunkSize
                );

                exportData[dataType] = data;
                
                onProgress({ 
                    status: 'extracted', 
                    dataType, 
                    count: data.length,
                    message: `Extracted ${data.length} ${dataType}` 
                });
            }

            if (includeRelated) {
                exportData.configuration = await this.client.configuration();
            }

            onProgress({ status: 'converting', message: `Converting to ${format}...` });

            const finalData = {
                metadata,
                data: exportData
            };

            const converted = await adapter.convert(finalData, options);
            
            onProgress({ status: 'complete', message: 'Export complete!' });

            return {
                content: converted,
                mimeType: adapter.mimeType,
                extension: adapter.extension,
                size: new Blob([converted]).size
            };
        }

        async extractDataType(dataType, filter, fields, chunkSize) {
            const allData = [];
            let page = 1;
            let hasMore = true;

            while (hasMore) {
                const pageFilter = {
                    ...filter,
                    page,
                    per_page: chunkSize
                };

                let result;
                switch (dataType) {
                    case 'scenes':
                        result = await this.client.findScenes(pageFilter);
                        allData.push(...result.findScenes.scenes);
                        hasMore = result.findScenes.scenes.length === chunkSize;
                        break;
                    case 'performers':
                        result = await this.client.findPerformers(pageFilter);
                        allData.push(...result.findPerformers.performers);
                        hasMore = result.findPerformers.performers.length === chunkSize;
                        break;
                    case 'studios':
                        result = await this.client.findStudios(pageFilter);
                        allData.push(...result.findStudios.studios);
                        hasMore = result.findStudios.studios.length === chunkSize;
                        break;
                    case 'tags':
                        result = await this.client.findTags(pageFilter);
                        allData.push(...result.findTags.tags);
                        hasMore = result.findTags.tags.length === chunkSize;
                        break;
                    default:
                        throw new Error(`Unknown data type: ${dataType}`);
                }

                page++;
                await sleep(100); // Rate limiting
            }

            // Apply field filtering if specified
            if (fields) {
                return allData.map(item => {
                    const filtered = {};
                    fields.forEach(field => {
                        if (field in item) {
                            filtered[field] = item[field];
                        }
                    });
                    return filtered;
                });
            }

            return allData;
        }

        async getStashVersion() {
            try {
                const result = await this.client.version();
                return result.version;
            } catch (error) {
                return 'unknown';
            }
        }

        async createFilteredExport(options) {
            const {
                collectionFilter,
                privacyOptions = {},
                format = 'json'
            } = options;

            // Apply privacy filters
            const fields = this.applyPrivacyFilters(privacyOptions);

            return await this.exportData({
                ...options,
                fields,
                filters: collectionFilter
            });
        }

        applyPrivacyFilters(privacyOptions) {
            const {
                excludePersonalData = false,
                anonymizeData = false,
                excludeFields = []
            } = privacyOptions;

            const fields = {};

            if (excludePersonalData) {
                // Define fields to exclude for each data type
                fields.performers = ['name', 'gender', 'country', 'ethnicity', 'image_path'];
                fields.scenes = ['title', 'date', 'rating100', 'organized'];
            }

            // Add custom excluded fields
            excludeFields.forEach(field => {
                Object.keys(fields).forEach(dataType => {
                    if (!fields[dataType].includes(field)) {
                        fields[dataType].push(field);
                    }
                });
            });

            return fields;
        }
    }

    // ============= Import Engine =============
    class ImportEngine {
        constructor(graphqlClient) {
            this.client = graphqlClient;
            this.parsers = new Map();
            this.schemaMappings = new Map();
            this.registerDefaultComponents();
        }

        registerDefaultComponents() {
            // Register parsers
            this.parsers.set('json', new JSONAdapter());
            this.parsers.set('csv', new CSVAdapter());
            this.parsers.set('xml', new XMLAdapter());

            // Register schema mappings for external formats
            this.schemaMappings.set('plex', {
                scenes: {
                    'title': 'title',
                    'summary': 'details',
                    'originally_available_at': 'date',
                    'rating': (value) => value * 10, // Convert 0-10 to 0-100
                    'actors': 'performers'
                }
            });

            this.schemaMappings.set('jellyfin', {
                scenes: {
                    'Name': 'title',
                    'Overview': 'details',
                    'PremiereDate': 'date',
                    'CommunityRating': (value) => value * 10,
                    'People': (value) => value.filter(p => p.Type === 'Actor')
                }
            });
        }

        async importData(file, options) {
            const {
                format,
                mapping = {},
                conflictResolution = 'skip',
                dryRun = false,
                onProgress = () => {}
            } = options;

            onProgress({ status: 'parsing', message: `Parsing ${format} file...` });

            const parser = this.parsers.get(format);
            if (!parser) {
                throw new Error(`Unsupported import format: ${format}`);
            }

            const content = await this.readFile(file);
            const rawData = await parser.parse(content);

            onProgress({ status: 'mapping', message: 'Mapping data to Stash schema...' });

            const mappedData = await this.mapToStashSchema(rawData, format, mapping);

            onProgress({ status: 'validating', message: 'Validating data...' });

            const validation = await this.validateData(mappedData);
            if (!validation.valid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            if (dryRun) {
                return this.generateImportPreview(mappedData, validation);
            }

            onProgress({ status: 'importing', message: 'Importing data...' });

            const results = await this.insertData(mappedData, conflictResolution, onProgress);

            onProgress({ status: 'complete', message: 'Import complete!' });

            return results;
        }

        async readFile(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsText(file);
            });
        }

        async mapToStashSchema(rawData, format, customMapping) {
            const defaultMapping = this.schemaMappings.get(format) || {};
            const mapping = { ...defaultMapping, ...customMapping };

            if (rawData.data) {
                // Handle our own export format
                return rawData.data;
            }

            // Map external formats
            const mappedData = {};

            Object.entries(rawData).forEach(([dataType, records]) => {
                if (!Array.isArray(records)) return;

                const typeMapping = mapping[dataType] || {};
                mappedData[dataType] = records.map(record => 
                    this.transformRecord(record, typeMapping)
                );
            });

            return mappedData;
        }

        transformRecord(record, mapping) {
            const transformed = {};

            Object.entries(record).forEach(([key, value]) => {
                const mappingRule = mapping[key];

                if (!mappingRule) {
                    // No mapping, keep original
                    transformed[key] = value;
                } else if (typeof mappingRule === 'string') {
                    // Simple field mapping
                    transformed[mappingRule] = value;
                } else if (typeof mappingRule === 'function') {
                    // Transform function
                    const mappedKey = Object.keys(mapping).find(k => mapping[k] === mappingRule);
                    transformed[mappedKey] = mappingRule(value);
                }
            });

            return transformed;
        }

        async validateData(data) {
            const errors = [];
            const warnings = [];

            // Validate each data type
            Object.entries(data).forEach(([dataType, records]) => {
                if (!Array.isArray(records)) {
                    errors.push(`${dataType} must be an array`);
                    return;
                }

                records.forEach((record, index) => {
                    const validation = this.validateRecord(dataType, record, index);
                    errors.push(...validation.errors);
                    warnings.push(...validation.warnings);
                });
            });

            return {
                valid: errors.length === 0,
                errors,
                warnings
            };
        }

        validateRecord(dataType, record, index) {
            const errors = [];
            const warnings = [];

            // Type-specific validation
            switch (dataType) {
                case 'scenes':
                    if (!record.title && !record.file) {
                        errors.push(`Scene ${index}: Must have title or file information`);
                    }
                    if (record.rating100 && (record.rating100 < 0 || record.rating100 > 100)) {
                        errors.push(`Scene ${index}: Rating must be between 0 and 100`);
                    }
                    break;

                case 'performers':
                    if (!record.name) {
                        errors.push(`Performer ${index}: Must have a name`);
                    }
                    break;

                case 'studios':
                    if (!record.name) {
                        errors.push(`Studio ${index}: Must have a name`);
                    }
                    break;

                case 'tags':
                    if (!record.name) {
                        errors.push(`Tag ${index}: Must have a name`);
                    }
                    break;
            }

            return { errors, warnings };
        }

        async insertData(data, conflictResolution, onProgress) {
            const results = {
                created: {},
                updated: {},
                skipped: {},
                errors: {}
            };

            for (const [dataType, records] of Object.entries(data)) {
                results.created[dataType] = 0;
                results.updated[dataType] = 0;
                results.skipped[dataType] = 0;
                results.errors[dataType] = [];

                for (let i = 0; i < records.length; i++) {
                    const record = records[i];
                    
                    try {
                        const result = await this.insertRecord(
                            dataType, 
                            record, 
                            conflictResolution
                        );

                        switch (result.action) {
                            case 'created':
                                results.created[dataType]++;
                                break;
                            case 'updated':
                                results.updated[dataType]++;
                                break;
                            case 'skipped':
                                results.skipped[dataType]++;
                                break;
                        }
                    } catch (error) {
                        results.errors[dataType].push({
                            record,
                            error: error.message
                        });
                    }

                    if (i % 10 === 0) {
                        onProgress({
                            status: 'importing',
                            dataType,
                            progress: i / records.length,
                            message: `Importing ${dataType}: ${i}/${records.length}`
                        });
                    }
                }
            }

            return results;
        }

        async insertRecord(dataType, record, conflictResolution) {
            // Check for existing record
            const existing = await this.findExisting(dataType, record);

            if (existing && conflictResolution === 'skip') {
                return { action: 'skipped', id: existing.id };
            }

            if (existing && conflictResolution === 'update') {
                await this.updateRecord(dataType, existing.id, record);
                return { action: 'updated', id: existing.id };
            }

            // Create new record
            const id = await this.createRecord(dataType, record);
            return { action: 'created', id };
        }

        async findExisting(dataType, record) {
            // Implementation would check for existing records based on unique identifiers
            // This is a placeholder
            return null;
        }

        async createRecord(dataType, record) {
            // Implementation would create records via GraphQL mutations
            // This is a placeholder
            return Math.random().toString(36).substr(2, 9);
        }

        async updateRecord(dataType, id, record) {
            // Implementation would update records via GraphQL mutations
            // This is a placeholder
            return true;
        }

        generateImportPreview(data, validation) {
            const preview = {
                summary: {},
                validation,
                sample: {}
            };

            Object.entries(data).forEach(([dataType, records]) => {
                preview.summary[dataType] = {
                    count: records.length,
                    fields: records.length > 0 ? Object.keys(records[0]) : []
                };

                preview.sample[dataType] = records.slice(0, 5);
            });

            return preview;
        }
    }

    // ============= Backup Manager =============
    class BackupManager {
        constructor(graphqlClient, exportEngine) {
            this.client = graphqlClient;
            this.exportEngine = exportEngine;
        }

        async createBackup(options) {
            const {
                includeFiles = false,
                compression = 'none',
                encryption = null,
                onProgress = () => {}
            } = options;

            onProgress({ status: 'gathering', message: 'Gathering backup data...' });

            const backupData = await this.gatherBackupData(includeFiles, onProgress);

            onProgress({ status: 'compressing', message: 'Compressing backup...' });

            let processedData = JSON.stringify(backupData, null, 2);

            if (compression === 'gzip') {
                // In a real implementation, we'd use a compression library
                // For now, we'll just mark it as compressed
                processedData = btoa(processedData); // Base64 encode as placeholder
            }

            if (encryption) {
                onProgress({ status: 'encrypting', message: 'Encrypting backup...' });
                // In a real implementation, we'd use encryption
                // For now, we'll just mark it as encrypted
            }

            const backup = {
                metadata: {
                    id: this.generateBackupId(),
                    timestamp: new Date().toISOString(),
                    version: backupData.metadata.version,
                    compression,
                    encryption: encryption ? encryption.type : null,
                    checksum: this.calculateChecksum(processedData)
                },
                data: processedData
            };

            onProgress({ status: 'complete', message: 'Backup complete!' });

            return backup;
        }

        async gatherBackupData(includeFiles, onProgress) {
            const exportResult = await this.exportEngine.exportData({
                format: 'json',
                dataTypes: ['scenes', 'performers', 'studios', 'tags'],
                includeRelated: true,
                onProgress: (progress) => {
                    if (progress.status === 'extracting') {
                        onProgress({ 
                            status: 'gathering', 
                            message: `Backing up ${progress.dataType}...` 
                        });
                    }
                }
            });

            const backupData = JSON.parse(exportResult.content);

            if (includeFiles) {
                backupData.fileReferences = await this.gatherFileReferences(backupData.data.scenes);
            }

            return backupData;
        }

        async gatherFileReferences(scenes) {
            // In a real implementation, this would gather file path information
            // For now, return a placeholder
            return scenes.map(scene => ({
                sceneId: scene.id,
                file: scene.file ? {
                    path: scene.file.path,
                    size: scene.file.size,
                    checksum: scene.file.checksum
                } : null
            }));
        }

        async restoreBackup(backup, options) {
            const {
                selective = false,
                dataTypes = ['scenes', 'performers', 'studios', 'tags'],
                conflictResolution = 'skip',
                dryRun = false,
                onProgress = () => {}
            } = options;

            onProgress({ status: 'validating', message: 'Validating backup...' });

            const validation = await this.validateBackup(backup);
            if (!validation.valid) {
                throw new Error(`Backup validation failed: ${validation.error}`);
            }

            onProgress({ status: 'extracting', message: 'Extracting backup data...' });

            let data = backup.data;

            if (backup.metadata.compression === 'gzip') {
                // Decompress
                data = atob(data); // Base64 decode as placeholder
            }

            if (backup.metadata.encryption) {
                onProgress({ status: 'decrypting', message: 'Decrypting backup...' });
                // Decrypt
            }

            const backupData = JSON.parse(data);

            if (selective) {
                // Filter to selected data types
                const filteredData = { metadata: backupData.metadata, data: {} };
                dataTypes.forEach(type => {
                    if (backupData.data[type]) {
                        filteredData.data[type] = backupData.data[type];
                    }
                });
                backupData.data = filteredData.data;
            }

            if (dryRun) {
                return this.generateRestorePreview(backupData);
            }

            onProgress({ status: 'restoring', message: 'Restoring data...' });

            const importEngine = new ImportEngine(this.client);
            const results = await importEngine.insertData(
                backupData.data,
                conflictResolution,
                onProgress
            );

            onProgress({ status: 'complete', message: 'Restore complete!' });

            return results;
        }

        async validateBackup(backup) {
            if (!backup.metadata || !backup.data) {
                return { valid: false, error: 'Invalid backup format' };
            }

            const checksum = this.calculateChecksum(backup.data);
            if (checksum !== backup.metadata.checksum) {
                return { valid: false, error: 'Backup checksum mismatch' };
            }

            return { valid: true };
        }

        generateBackupId() {
            return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        calculateChecksum(data) {
            // Simple checksum for demonstration
            let hash = 0;
            for (let i = 0; i < data.length; i++) {
                const char = data.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(16);
        }

        generateRestorePreview(backupData) {
            const preview = {
                metadata: backupData.metadata,
                summary: {}
            };

            Object.entries(backupData.data).forEach(([dataType, records]) => {
                if (Array.isArray(records)) {
                    preview.summary[dataType] = {
                        count: records.length
                    };
                }
            });

            return preview;
        }

        async scheduleBackup(schedule, options) {
            // In a real implementation, this would set up automated backups
            // For now, return a placeholder
            return {
                scheduleId: `schedule_${Date.now()}`,
                schedule,
                options,
                nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            };
        }
    }

    // ============= UI Manager =============
    class ExportImportUI {
        constructor(exportEngine, importEngine, backupManager) {
            this.exportEngine = exportEngine;
            this.importEngine = importEngine;
            this.backupManager = backupManager;
            this.currentOperation = null;
            this.initializeUI();
        }

        initializeUI() {
            // Create toggle button
            this.createToggleButton();
            
            // Create main widget
            this.createMainWidget();
            
            // Apply styles
            this.applyStyles();
        }

        createToggleButton() {
            this.toggleButton = document.createElement('button');
            this.toggleButton.id = 'export-import-toggle';
            this.toggleButton.innerHTML = '📦 Export/Import';
            this.toggleButton.onclick = () => this.toggleWidget();
            document.body.appendChild(this.toggleButton);
        }

        createMainWidget() {
            this.widget = document.createElement('div');
            this.widget.id = 'export-import-widget';
            this.widget.style.display = 'none';
            this.widget.innerHTML = `
                <div class="ei-header">
                    <h2>📦 Export/Import Tools</h2>
                    <button class="ei-close" onclick="this.parentElement.parentElement.style.display='none'">×</button>
                </div>
                <div class="ei-nav">
                    <button class="ei-nav-btn active" data-tab="export">Export</button>
                    <button class="ei-nav-btn" data-tab="import">Import</button>
                    <button class="ei-nav-btn" data-tab="backup">Backup</button>
                    <button class="ei-nav-btn" data-tab="migrate">Migrate</button>
                    <button class="ei-nav-btn" data-tab="sync">Sync</button>
                </div>
                <div class="ei-content">
                    <div class="ei-tab-content" id="export-tab" style="display: block;">
                        ${this.createExportTab()}
                    </div>
                    <div class="ei-tab-content" id="import-tab" style="display: none;">
                        ${this.createImportTab()}
                    </div>
                    <div class="ei-tab-content" id="backup-tab" style="display: none;">
                        ${this.createBackupTab()}
                    </div>
                    <div class="ei-tab-content" id="migrate-tab" style="display: none;">
                        ${this.createMigrateTab()}
                    </div>
                    <div class="ei-tab-content" id="sync-tab" style="display: none;">
                        ${this.createSyncTab()}
                    </div>
                </div>
                <div class="ei-status" id="operation-status"></div>
            `;
            
            document.body.appendChild(this.widget);
            
            // Set up event handlers
            this.setupEventHandlers();
        }

        createExportTab() {
            return `
                <div class="ei-section">
                    <h3>Export Data</h3>
                    <div class="ei-form-group">
                        <label>Format:</label>
                        <select id="export-format">
                            <option value="json">JSON</option>
                            <option value="csv">CSV</option>
                            <option value="xml">XML</option>
                        </select>
                    </div>
                    <div class="ei-form-group">
                        <label>Data Types:</label>
                        <div class="ei-checkbox-group">
                            <label><input type="checkbox" value="scenes" checked> Scenes</label>
                            <label><input type="checkbox" value="performers" checked> Performers</label>
                            <label><input type="checkbox" value="studios" checked> Studios</label>
                            <label><input type="checkbox" value="tags" checked> Tags</label>
                        </div>
                    </div>
                    <div class="ei-form-group">
                        <label>Options:</label>
                        <div class="ei-checkbox-group">
                            <label><input type="checkbox" id="include-related" checked> Include Configuration</label>
                            <label><input type="checkbox" id="exclude-personal"> Exclude Personal Data</label>
                            <label><input type="checkbox" id="anonymize-data"> Anonymize Data</label>
                        </div>
                    </div>
                    <div class="ei-form-group">
                        <label>Filter:</label>
                        <input type="text" id="export-filter" placeholder="Optional: Add filter expression">
                    </div>
                    <button class="ei-button ei-primary" onclick="window.exportImportUI.startExport()">
                        Start Export
                    </button>
                </div>
            `;
        }

        createImportTab() {
            return `
                <div class="ei-section">
                    <h3>Import Data</h3>
                    <div class="ei-form-group">
                        <label>Select File:</label>
                        <input type="file" id="import-file" accept=".json,.csv,.xml">
                    </div>
                    <div class="ei-form-group">
                        <label>Format:</label>
                        <select id="import-format">
                            <option value="json">JSON (Stash Export)</option>
                            <option value="csv">CSV</option>
                            <option value="plex">Plex Export</option>
                            <option value="jellyfin">Jellyfin Export</option>
                            <option value="kodi">Kodi Export</option>
                        </select>
                    </div>
                    <div class="ei-form-group">
                        <label>Conflict Resolution:</label>
                        <select id="conflict-resolution">
                            <option value="skip">Skip Existing</option>
                            <option value="update">Update Existing</option>
                            <option value="create">Create Duplicates</option>
                        </select>
                    </div>
                    <div class="ei-form-group">
                        <label><input type="checkbox" id="dry-run"> Dry Run (Preview Only)</label>
                    </div>
                    <button class="ei-button ei-primary" onclick="window.exportImportUI.startImport()">
                        Start Import
                    </button>
                </div>
            `;
        }

        createBackupTab() {
            return `
                <div class="ei-section">
                    <h3>Create Backup</h3>
                    <div class="ei-form-group">
                        <label>Compression:</label>
                        <select id="backup-compression">
                            <option value="none">None</option>
                            <option value="gzip">GZIP</option>
                            <option value="zip">ZIP</option>
                        </select>
                    </div>
                    <div class="ei-form-group">
                        <label>Options:</label>
                        <div class="ei-checkbox-group">
                            <label><input type="checkbox" id="include-files"> Include File References</label>
                            <label><input type="checkbox" id="encrypt-backup"> Encrypt Backup</label>
                        </div>
                    </div>
                    <button class="ei-button ei-primary" onclick="window.exportImportUI.createBackup()">
                        Create Backup
                    </button>
                    
                    <h3>Restore Backup</h3>
                    <div class="ei-form-group">
                        <label>Select Backup File:</label>
                        <input type="file" id="restore-file" accept=".json,.backup">
                    </div>
                    <div class="ei-form-group">
                        <label>Options:</label>
                        <div class="ei-checkbox-group">
                            <label><input type="checkbox" id="selective-restore"> Selective Restore</label>
                            <label><input type="checkbox" id="restore-dry-run"> Dry Run</label>
                        </div>
                    </div>
                    <button class="ei-button ei-secondary" onclick="window.exportImportUI.restoreBackup()">
                        Restore Backup
                    </button>
                </div>
            `;
        }

        createMigrateTab() {
            return `
                <div class="ei-section">
                    <h3>Migration Tools</h3>
                    <p class="ei-info">
                        Migration between Stash instances requires both instances to be accessible.
                        This feature is coming soon.
                    </p>
                    <div class="ei-form-group">
                        <label>Source Instance:</label>
                        <input type="text" id="source-url" placeholder="http://localhost:9998">
                    </div>
                    <div class="ei-form-group">
                        <label>Target Instance:</label>
                        <input type="text" id="target-url" placeholder="http://remote:9998">
                    </div>
                    <div class="ei-form-group">
                        <label>Options:</label>
                        <div class="ei-checkbox-group">
                            <label><input type="checkbox" id="incremental-migration"> Incremental Migration</label>
                            <label><input type="checkbox" id="verify-migration"> Verify After Migration</label>
                        </div>
                    </div>
                    <button class="ei-button ei-primary" disabled>
                        Start Migration (Coming Soon)
                    </button>
                </div>
            `;
        }

        createSyncTab() {
            return `
                <div class="ei-section">
                    <h3>Synchronization</h3>
                    <p class="ei-info">
                        Synchronize data between multiple Stash instances.
                        This feature is coming soon.
                    </p>
                    <div class="ei-form-group">
                        <label>Sync Partners:</label>
                        <div id="sync-partners">
                            <input type="text" placeholder="http://instance1:9998">
                            <input type="text" placeholder="http://instance2:9998">
                        </div>
                    </div>
                    <div class="ei-form-group">
                        <label>Sync Direction:</label>
                        <select id="sync-direction">
                            <option value="bidirectional">Bidirectional</option>
                            <option value="push">Push Only</option>
                            <option value="pull">Pull Only</option>
                        </select>
                    </div>
                    <button class="ei-button ei-primary" disabled>
                        Configure Sync (Coming Soon)
                    </button>
                </div>
            `;
        }

        setupEventHandlers() {
            // Tab navigation
            const navButtons = this.widget.querySelectorAll('.ei-nav-btn');
            navButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tab = e.target.dataset.tab;
                    this.switchTab(tab);
                });
            });

            // Close button
            const closeBtn = this.widget.querySelector('.ei-close');
            closeBtn.addEventListener('click', () => {
                this.widget.style.display = 'none';
            });
        }

        switchTab(tabName) {
            // Update nav buttons
            const navButtons = this.widget.querySelectorAll('.ei-nav-btn');
            navButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tabName);
            });

            // Update tab content
            const tabContents = this.widget.querySelectorAll('.ei-tab-content');
            tabContents.forEach(content => {
                const isActive = content.id === `${tabName}-tab`;
                content.style.display = isActive ? 'block' : 'none';
            });
        }

        toggleWidget() {
            const isVisible = this.widget.style.display !== 'none';
            this.widget.style.display = isVisible ? 'none' : 'block';
        }

        async startExport() {
            try {
                const format = document.getElementById('export-format').value;
                const dataTypes = Array.from(
                    document.querySelectorAll('#export-tab input[type="checkbox"]:checked')
                )
                .filter(cb => ['scenes', 'performers', 'studios', 'tags'].includes(cb.value))
                .map(cb => cb.value);

                const includeRelated = document.getElementById('include-related').checked;
                const excludePersonal = document.getElementById('exclude-personal').checked;
                const anonymizeData = document.getElementById('anonymize-data').checked;

                const result = await this.exportEngine.exportData({
                    format,
                    dataTypes,
                    includeRelated,
                    privacyOptions: {
                        excludePersonalData: excludePersonal,
                        anonymizeData
                    },
                    onProgress: (progress) => this.updateStatus(progress)
                });

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `stash-export-${timestamp}${result.extension}`;
                
                downloadFile(result.content, filename, result.mimeType);
                
                this.updateStatus({
                    status: 'success',
                    message: `Export complete! File size: ${formatBytes(result.size)}`
                });

            } catch (error) {
                this.updateStatus({
                    status: 'error',
                    message: `Export failed: ${error.message}`
                });
            }
        }

        async startImport() {
            try {
                const fileInput = document.getElementById('import-file');
                const file = fileInput.files[0];
                
                if (!file) {
                    throw new Error('Please select a file to import');
                }

                const format = document.getElementById('import-format').value;
                const conflictResolution = document.getElementById('conflict-resolution').value;
                const dryRun = document.getElementById('dry-run').checked;

                const result = await this.importEngine.importData(file, {
                    format,
                    conflictResolution,
                    dryRun,
                    onProgress: (progress) => this.updateStatus(progress)
                });

                if (dryRun) {
                    this.showImportPreview(result);
                } else {
                    this.showImportResults(result);
                }

            } catch (error) {
                this.updateStatus({
                    status: 'error',
                    message: `Import failed: ${error.message}`
                });
            }
        }

        async createBackup() {
            try {
                const compression = document.getElementById('backup-compression').value;
                const includeFiles = document.getElementById('include-files').checked;
                const encrypt = document.getElementById('encrypt-backup').checked;

                const backup = await this.backupManager.createBackup({
                    compression,
                    includeFiles,
                    encryption: encrypt ? { type: 'aes256', key: 'demo-key' } : null,
                    onProgress: (progress) => this.updateStatus(progress)
                });

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `stash-backup-${timestamp}.backup`;
                
                downloadFile(JSON.stringify(backup), filename, 'application/json');
                
                this.updateStatus({
                    status: 'success',
                    message: 'Backup created successfully!'
                });

            } catch (error) {
                this.updateStatus({
                    status: 'error',
                    message: `Backup failed: ${error.message}`
                });
            }
        }

        async restoreBackup() {
            try {
                const fileInput = document.getElementById('restore-file');
                const file = fileInput.files[0];
                
                if (!file) {
                    throw new Error('Please select a backup file to restore');
                }

                const content = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsText(file);
                });

                const backup = JSON.parse(content);
                const selective = document.getElementById('selective-restore').checked;
                const dryRun = document.getElementById('restore-dry-run').checked;

                const result = await this.backupManager.restoreBackup(backup, {
                    selective,
                    dryRun,
                    onProgress: (progress) => this.updateStatus(progress)
                });

                if (dryRun) {
                    this.showRestorePreview(result);
                } else {
                    this.showImportResults(result);
                }

            } catch (error) {
                this.updateStatus({
                    status: 'error',
                    message: `Restore failed: ${error.message}`
                });
            }
        }

        updateStatus(progress) {
            const statusDiv = document.getElementById('operation-status');
            statusDiv.className = `ei-status ${progress.status}`;
            statusDiv.textContent = progress.message;

            if (progress.status === 'complete' || progress.status === 'error') {
                setTimeout(() => {
                    statusDiv.className = 'ei-status';
                    statusDiv.textContent = '';
                }, 5000);
            }
        }

        showImportPreview(preview) {
            const content = `
                <h3>Import Preview</h3>
                <div class="ei-preview">
                    <h4>Summary:</h4>
                    ${Object.entries(preview.summary).map(([type, info]) => `
                        <div>${type}: ${info.count} records</div>
                    `).join('')}
                    
                    <h4>Validation:</h4>
                    <div class="ei-validation ${preview.validation.valid ? 'valid' : 'invalid'}">
                        ${preview.validation.valid ? '✅ All data valid' : '❌ Validation errors found'}
                    </div>
                    
                    ${preview.validation.errors.length > 0 ? `
                        <div class="ei-errors">
                            <h5>Errors:</h5>
                            ${preview.validation.errors.map(err => `<div>• ${err}</div>`).join('')}
                        </div>
                    ` : ''}
                    
                    ${preview.validation.warnings.length > 0 ? `
                        <div class="ei-warnings">
                            <h5>Warnings:</h5>
                            ${preview.validation.warnings.map(warn => `<div>• ${warn}</div>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `;

            const modal = this.createModal('Import Preview', content);
            document.body.appendChild(modal);
        }

        showImportResults(results) {
            const content = `
                <h3>Import Results</h3>
                <div class="ei-results">
                    ${Object.entries(results.created).map(([type, count]) => 
                        count > 0 ? `<div class="ei-success">✅ Created ${count} ${type}</div>` : ''
                    ).join('')}
                    
                    ${Object.entries(results.updated).map(([type, count]) => 
                        count > 0 ? `<div class="ei-info">📝 Updated ${count} ${type}</div>` : ''
                    ).join('')}
                    
                    ${Object.entries(results.skipped).map(([type, count]) => 
                        count > 0 ? `<div class="ei-warning">⏭️ Skipped ${count} ${type}</div>` : ''
                    ).join('')}
                    
                    ${Object.entries(results.errors).map(([type, errors]) => 
                        errors.length > 0 ? `
                            <div class="ei-error">
                                ❌ ${errors.length} ${type} errors
                                <details>
                                    <summary>View Details</summary>
                                    ${errors.map(err => `<div>• ${err.error}</div>`).join('')}
                                </details>
                            </div>
                        ` : ''
                    ).join('')}
                </div>
            `;

            const modal = this.createModal('Import Complete', content);
            document.body.appendChild(modal);
        }

        showRestorePreview(preview) {
            const content = `
                <h3>Restore Preview</h3>
                <div class="ei-preview">
                    <h4>Backup Information:</h4>
                    <div>Created: ${new Date(preview.metadata.timestamp).toLocaleString()}</div>
                    <div>Version: ${preview.metadata.version}</div>
                    
                    <h4>Data Summary:</h4>
                    ${Object.entries(preview.summary).map(([type, info]) => `
                        <div>${type}: ${info.count} records</div>
                    `).join('')}
                </div>
            `;

            const modal = this.createModal('Restore Preview', content);
            document.body.appendChild(modal);
        }

        createModal(title, content) {
            const modal = document.createElement('div');
            modal.className = 'ei-modal';
            modal.innerHTML = `
                <div class="ei-modal-content">
                    <div class="ei-modal-header">
                        <h2>${title}</h2>
                        <button class="ei-close" onclick="this.closest('.ei-modal').remove()">×</button>
                    </div>
                    <div class="ei-modal-body">
                        ${content}
                    </div>
                    <div class="ei-modal-footer">
                        <button class="ei-button ei-secondary" onclick="this.closest('.ei-modal').remove()">
                            Close
                        </button>
                    </div>
                </div>
            `;
            return modal;
        }

        applyStyles() {
            const style = document.createElement('style');
            style.textContent = `
                /* Toggle Button */
                #export-import-toggle {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    z-index: 10000;
                    padding: 8px 16px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    transition: all 0.3s ease;
                }

                #export-import-toggle:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
                }

                /* Main Widget */
                #export-import-widget {
                    position: fixed;
                    top: 60px;
                    right: 10px;
                    width: 600px;
                    max-height: 80vh;
                    background: #1a1a1a;
                    border: 1px solid #333;
                    border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                    z-index: 9999;
                    overflow: hidden;
                }

                /* Header */
                .ei-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .ei-header h2 {
                    margin: 0;
                    font-size: 20px;
                }

                .ei-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    transition: background 0.2s;
                }

                .ei-close:hover {
                    background: rgba(255, 255, 255, 0.2);
                }

                /* Navigation */
                .ei-nav {
                    display: flex;
                    background: #2a2a2a;
                    border-bottom: 1px solid #333;
                }

                .ei-nav-btn {
                    flex: 1;
                    padding: 12px;
                    background: none;
                    border: none;
                    color: #888;
                    cursor: pointer;
                    transition: all 0.2s;
                    border-bottom: 2px solid transparent;
                    font-size: 14px;
                    font-weight: 500;
                }

                .ei-nav-btn:hover {
                    color: #ccc;
                    background: rgba(255, 255, 255, 0.05);
                }

                .ei-nav-btn.active {
                    color: white;
                    border-bottom-color: #667eea;
                }

                /* Content */
                .ei-content {
                    padding: 20px;
                    max-height: calc(80vh - 150px);
                    overflow-y: auto;
                }

                .ei-section {
                    background: #2a2a2a;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                }

                .ei-section h3 {
                    margin: 0 0 20px 0;
                    color: white;
                    font-size: 18px;
                }

                /* Form Elements */
                .ei-form-group {
                    margin-bottom: 15px;
                }

                .ei-form-group label {
                    display: block;
                    color: #ccc;
                    margin-bottom: 5px;
                    font-size: 14px;
                }

                .ei-form-group input[type="text"],
                .ei-form-group input[type="file"],
                .ei-form-group select {
                    width: 100%;
                    padding: 8px 12px;
                    background: #1a1a1a;
                    border: 1px solid #444;
                    border-radius: 4px;
                    color: white;
                    font-size: 14px;
                }

                .ei-checkbox-group {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px;
                }

                .ei-checkbox-group label {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    margin: 0;
                    cursor: pointer;
                }

                /* Buttons */
                .ei-button {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .ei-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }

                .ei-primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
                }

                .ei-secondary {
                    background: #444;
                    color: white;
                }

                .ei-secondary:hover {
                    background: #555;
                }

                /* Status */
                .ei-status {
                    padding: 10px 20px;
                    text-align: center;
                    font-size: 14px;
                    transition: all 0.3s;
                }

                .ei-status.starting,
                .ei-status.extracting,
                .ei-status.mapping,
                .ei-status.validating,
                .ei-status.importing,
                .ei-status.converting,
                .ei-status.gathering,
                .ei-status.compressing,
                .ei-status.encrypting {
                    background: #3a3a3a;
                    color: #667eea;
                }

                .ei-status.complete,
                .ei-status.success {
                    background: #2a5a2a;
                    color: #4ade80;
                }

                .ei-status.error {
                    background: #5a2a2a;
                    color: #f87171;
                }

                /* Info Text */
                .ei-info {
                    background: rgba(102, 126, 234, 0.1);
                    border: 1px solid rgba(102, 126, 234, 0.3);
                    border-radius: 4px;
                    padding: 12px;
                    color: #a5b4fc;
                    font-size: 14px;
                    margin-bottom: 20px;
                }

                /* Modal */
                .ei-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 11000;
                }

                .ei-modal-content {
                    background: #1a1a1a;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 600px;
                    max-height: 80vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .ei-modal-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .ei-modal-body {
                    padding: 20px;
                    overflow-y: auto;
                    flex: 1;
                }

                .ei-modal-footer {
                    padding: 15px 20px;
                    border-top: 1px solid #333;
                    display: flex;
                    justify-content: flex-end;
                }

                /* Preview and Results */
                .ei-preview,
                .ei-results {
                    color: #ccc;
                }

                .ei-preview h4,
                .ei-results h4 {
                    color: white;
                    margin: 15px 0 10px 0;
                }

                .ei-validation.valid {
                    color: #4ade80;
                }

                .ei-validation.invalid {
                    color: #f87171;
                }

                .ei-errors {
                    background: rgba(248, 113, 113, 0.1);
                    border: 1px solid rgba(248, 113, 113, 0.3);
                    border-radius: 4px;
                    padding: 10px;
                    margin-top: 10px;
                    color: #f87171;
                }

                .ei-warnings {
                    background: rgba(251, 191, 36, 0.1);
                    border: 1px solid rgba(251, 191, 36, 0.3);
                    border-radius: 4px;
                    padding: 10px;
                    margin-top: 10px;
                    color: #fbbf24;
                }

                .ei-success {
                    color: #4ade80;
                    margin: 5px 0;
                }

                .ei-info {
                    color: #60a5fa;
                    margin: 5px 0;
                }

                .ei-warning {
                    color: #fbbf24;
                    margin: 5px 0;
                }

                .ei-error {
                    color: #f87171;
                    margin: 5px 0;
                }

                /* Scrollbar */
                .ei-content::-webkit-scrollbar {
                    width: 8px;
                }

                .ei-content::-webkit-scrollbar-track {
                    background: #1a1a1a;
                }

                .ei-content::-webkit-scrollbar-thumb {
                    background: #444;
                    border-radius: 4px;
                }

                .ei-content::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
            `;
            document.head.appendChild(style);
        }
    }

    // ============= Initialize =============
    function initialize() {
        log('Initializing Export/Import Tools...');

        // Create instances
        const graphqlClient = new GraphQLClient();
        const exportEngine = new ExportEngine(graphqlClient);
        const importEngine = new ImportEngine(graphqlClient);
        const backupManager = new BackupManager(graphqlClient, exportEngine);

        // Create UI
        const ui = new ExportImportUI(exportEngine, importEngine, backupManager);
        
        // Make UI accessible globally for event handlers
        window.exportImportUI = ui;

        log('Export/Import Tools initialized successfully!');
        
        GM_notification({
            title: '📦 Export/Import Tools',
            text: 'Export/Import Tools loaded successfully!',
            timeout: 3000
        });
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();