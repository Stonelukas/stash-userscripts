# Design Document

## Overview

The Stash Collection Organizer analyzes existing collection patterns to provide intelligent organization suggestions and automated maintenance tools. The system uses machine learning-inspired algorithms to understand user preferences and applies consistent organization rules across the entire collection.

## Architecture

### Core Components

1. **Pattern Analysis Engine**: Analyzes existing organization patterns to understand user preferences
2. **File Organization System**: Implements folder structure suggestions and file movement operations
3. **Naming Convention Engine**: Standardizes file names using configurable templates
4. **Metadata Completeness Analyzer**: Identifies and prioritizes missing metadata
5. **Collection Health Monitor**: Tracks collection quality metrics and trends
6. **Automation Rule Engine**: Applies organization rules to new content automatically

### Analysis Workflow

```javascript
const OrganizationWorkflow = {
    analysis: {
        scanExistingPatterns: 'Learn from current organization',
        identifyInconsistencies: 'Find organization problems',
        generateSuggestions: 'Create improvement recommendations'
    },
    implementation: {
        previewChanges: 'Show before/after organization',
        validateChanges: 'Ensure safe file operations',
        applyChanges: 'Execute organization improvements',
        trackResults: 'Monitor organization effectiveness'
    }
};
```

## Components and Interfaces

### Pattern Analysis Engine

```javascript
class PatternAnalysisEngine {
    analyzeExistingPatterns() {
        return {
            folderStructures: this.analyzeFolderPatterns(),
            namingConventions: this.analyzeNamingPatterns(),
            metadataUsage: this.analyzeMetadataPatterns(),
            organizationPreferences: this.inferUserPreferences()
        };
    }
    
    generateOrganizationSuggestions(patterns) {
        return {
            folderReorganization: this.suggestFolderStructure(patterns),
            fileRenaming: this.suggestNamingImprovements(patterns),
            metadataEnhancements: this.suggestMetadataImprovements(patterns)
        };
    }
    
    inferUserPreferences(existingOrganization) {
        // Machine learning-inspired preference detection
        return {
            preferredGrouping: 'performer', // or 'studio', 'genre', 'date'
            namingStyle: 'descriptive',     // or 'minimal', 'technical'
            folderDepth: 2,                 // preferred folder nesting level
            metadataPriority: ['performer', 'studio', 'tags', 'date']
        };
    }
}
```

### File Organization System

```javascript
class FileOrganizationSystem {
    async reorganizeCollection(organizationPlan) {
        const results = {
            moved: [],
            renamed: [],
            errors: [],
            rollbackInfo: []
        };
        
        for (const operation of organizationPlan.operations) {
            try {
                const result = await this.executeOperation(operation);
                results[operation.type].push(result);
                results.rollbackInfo.push(this.createRollbackInfo(operation, result));
            } catch (error) {
                results.errors.push({ operation, error });
            }
        }
        
        return results;
    }
    
    generateFolderStructure(preferences, scenes) {
        const structure = new Map();
        
        scenes.forEach(scene => {
            const path = this.calculateOptimalPath(scene, preferences);
            if (!structure.has(path)) {
                structure.set(path, []);
            }
            structure.get(path).push(scene);
        });
        
        return structure;
    }
}
```

### Naming Convention Engine

```javascript
class NamingConventionEngine {
    constructor() {
        this.templates = {
            performer_studio_title: '{performer} - {studio} - {title}',
            date_performer_title: '{date} - {performer} - {title}',
            studio_performer_title: '{studio} - {performer} - {title}',
            custom: '{custom_template}'
        };
    }
    
    standardizeFileName(scene, template) {
        const tokens = {
            performer: this.formatPerformerNames(scene.performers),
            studio: scene.studio?.name || 'Unknown',
            title: this.sanitizeTitle(scene.title),
            date: this.formatDate(scene.date),
            resolution: scene.file?.resolution || '',
            duration: this.formatDuration(scene.file?.duration)
        };
        
        return this.applyTemplate(template, tokens);
    }
    
    detectNamingInconsistencies(scenes) {
        const patterns = this.analyzeNamingPatterns(scenes);
        return {
            inconsistentFormats: this.findFormatInconsistencies(patterns),
            missingInformation: this.findMissingTokens(patterns),
            suggestions: this.generateNamingSuggestions(patterns)
        };
    }
}
```

### Metadata Completeness Analyzer

```javascript
class MetadataCompletenessAnalyzer {
    analyzeCompleteness(scenes) {
        const analysis = {
            overall: 0,
            byField: new Map(),
            criticalMissing: [],
            suggestions: []
        };
        
        const criticalFields = ['title', 'performers', 'studio', 'date'];
        const optionalFields = ['tags', 'rating', 'details'];
        
        scenes.forEach(scene => {
            const completeness = this.calculateSceneCompleteness(scene, criticalFields, optionalFields);
            analysis.overall += completeness.percentage;
            
            if (completeness.percentage < 70) {
                analysis.criticalMissing.push({
                    scene,
                    missing: completeness.missing,
                    suggestions: this.generateCompletionSuggestions(scene)
                });
            }
        });
        
        analysis.overall /= scenes.length;
        return analysis;
    }
    
    generateCompletionSuggestions(scene) {
        return {
            autoFillOptions: this.identifyAutoFillSources(scene),
            scrapingSuggestions: this.suggestScrapingSources(scene),
            manualTasks: this.createManualCompletionTasks(scene)
        };
    }
}
```

## Data Models

### Organization Plan

```javascript
const OrganizationPlan = {
    id: String,
    created: Date,
    type: 'folder_reorganization' | 'file_renaming' | 'metadata_completion',
    
    operations: [{
        type: 'move' | 'rename' | 'update_metadata',
        sceneId: String,
        currentPath: String,
        targetPath: String,
        changes: Object,
        estimatedImpact: {
            filesAffected: Number,
            metadataChanges: Number,
            riskLevel: 'low' | 'medium' | 'high'
        }
    }],
    
    preview: {
        beforeStructure: Object,
        afterStructure: Object,
        summary: {
            totalChanges: Number,
            foldersCreated: Number,
            filesRenamed: Number,
            metadataUpdated: Number
        }
    },
    
    rollbackPlan: {
        operations: [Object],
        backupLocations: [String],
        metadataBackup: Object
    }
};
```

### Collection Health Report

```javascript
const CollectionHealthReport = {
    timestamp: Date,
    overall: {
        healthScore: Number, // 0-100
        totalScenes: Number,
        issuesFound: Number,
        improvementOpportunities: Number
    },
    
    categories: {
        organization: {
            score: Number,
            issues: ['inconsistent_folders', 'deep_nesting', 'scattered_files'],
            suggestions: [String]
        },
        naming: {
            score: Number,
            issues: ['inconsistent_format', 'special_characters', 'too_long'],
            suggestions: [String]
        },
        metadata: {
            score: Number,
            completeness: Number,
            issues: ['missing_performers', 'missing_studios', 'missing_dates'],
            suggestions: [String]
        },
        duplicates: {
            score: Number,
            duplicateGroups: Number,
            wastedSpace: Number,
            suggestions: [String]
        }
    },
    
    trends: {
        healthScoreHistory: [{ date: Date, score: Number }],
        improvementAreas: [String],
        recommendations: [String]
    }
};
```

## Error Handling

### File Operation Safety

```javascript
const FileOperationSafety = {
    validateOperation(operation) {
        const checks = [
            this.checkTargetPathExists(operation.targetPath),
            this.checkWritePermissions(operation.targetPath),
            this.checkDiskSpace(operation.estimatedSize),
            this.checkFileInUse(operation.currentPath)
        ];
        
        return {
            safe: checks.every(check => check.passed),
            warnings: checks.filter(check => check.warning),
            errors: checks.filter(check => check.error)
        };
    },
    
    createRollbackPlan(operations) {
        return operations.map(op => ({
            type: 'rollback',
            originalOperation: op,
            rollbackAction: this.generateRollbackAction(op),
            backupLocation: this.getBackupLocation(op)
        }));
    }
};
```

### Data Integrity Protection

```javascript
const DataIntegrityProtection = {
    backupMetadata(scenes) {
        return {
            timestamp: new Date(),
            scenes: scenes.map(scene => ({
                id: scene.id,
                metadata: this.extractMetadata(scene),
                filePath: scene.file?.path
            })),
            checksum: this.calculateChecksum(scenes)
        };
    },
    
    validateIntegrity(backup, currentScenes) {
        const currentChecksum = this.calculateChecksum(currentScenes);
        return {
            valid: backup.checksum === currentChecksum,
            differences: this.findDifferences(backup.scenes, currentScenes),
            corruptionDetected: this.detectCorruption(backup, currentScenes)
        };
    }
};
```

## Testing Strategy

### Organization Algorithm Testing

- Test pattern recognition with various existing organization styles
- Validate folder structure suggestions with different collection sizes
- Test naming convention detection and standardization
- Verify metadata completeness analysis accuracy

### File Operation Testing

- Test file movement operations with various file systems
- Validate rollback functionality for failed operations
- Test concurrent access handling during organization
- Performance testing with large collections

### Safety and Integrity Testing

- Test backup and restore functionality
- Validate data integrity protection mechanisms
- Test error recovery and rollback procedures
- Verify permission and disk space checking