# Design Document

## Overview

The Stash Scene Quality Analyzer leverages Stash's existing video metadata and file information to perform comprehensive quality analysis. The system uses a combination of technical metrics and heuristic algorithms to assess content quality and identify potential issues.

## Architecture

### Core Components

1. **Quality Metrics Engine**: Analyzes video technical specifications
2. **Duplicate Detection System**: Identifies similar content using fingerprinting
3. **Quality Scoring Algorithm**: Assigns numerical quality scores based on multiple factors
4. **Report Generator**: Creates comprehensive quality analysis reports
5. **Background Processor**: Handles automatic analysis of new content

### Data Sources

- **Stash File Metadata**: Resolution, bitrate, codec, file size
- **Video Stream Information**: Frame rate, aspect ratio, duration
- **Audio Stream Data**: Audio codec, sample rate, channels
- **File System Data**: File creation date, modification time

## Components and Interfaces

### Quality Metrics Engine

```javascript
class QualityMetricsEngine {
    analyzeScene(sceneData) {
        return {
            resolution: this.extractResolution(sceneData),
            bitrate: this.extractBitrate(sceneData),
            codec: this.extractCodec(sceneData),
            audioQuality: this.analyzeAudio(sceneData),
            fileSize: this.getFileSize(sceneData)
        };
    }
    
    calculateQualityScore(metrics) {
        // Weighted scoring algorithm
        const resolutionScore = this.scoreResolution(metrics.resolution);
        const bitrateScore = this.scoreBitrate(metrics.bitrate);
        const codecScore = this.scoreCodec(metrics.codec);
        
        return (resolutionScore * 0.4) + (bitrateScore * 0.3) + (codecScore * 0.3);
    }
}
```

### Duplicate Detection System

```javascript
class DuplicateDetector {
    generateFingerprint(sceneData) {
        // Create content fingerprint based on:
        // - File size
        // - Duration
        // - Resolution
        // - Scene title similarity
        return {
            sizeFingerprint: this.hashFileSize(sceneData.size),
            durationFingerprint: this.hashDuration(sceneData.duration),
            titleFingerprint: this.hashTitle(sceneData.title)
        };
    }
    
    findDuplicates(scenes) {
        const fingerprints = scenes.map(scene => ({
            scene,
            fingerprint: this.generateFingerprint(scene)
        }));
        
        return this.groupSimilarFingerprints(fingerprints);
    }
}
```

### Quality Scoring Algorithm

```javascript
const QualityThresholds = {
    RESOLUTION: {
        EXCELLENT: { min: 2160, score: 100 }, // 4K
        GOOD: { min: 1080, score: 80 },       // 1080p
        FAIR: { min: 720, score: 60 },        // 720p
        POOR: { min: 480, score: 40 },        // 480p
        VERY_POOR: { min: 0, score: 20 }      // Below 480p
    },
    BITRATE: {
        EXCELLENT: { min: 8000, score: 100 }, // 8+ Mbps
        GOOD: { min: 4000, score: 80 },       // 4-8 Mbps
        FAIR: { min: 2000, score: 60 },       // 2-4 Mbps
        POOR: { min: 1000, score: 40 },       // 1-2 Mbps
        VERY_POOR: { min: 0, score: 20 }      // Below 1 Mbps
    }
};
```

## Data Models

### Quality Analysis Result

```javascript
const QualityAnalysisResult = {
    sceneId: String,
    timestamp: Date,
    metrics: {
        resolution: { width: Number, height: Number },
        bitrate: Number,
        codec: String,
        audioQuality: {
            codec: String,
            sampleRate: Number,
            channels: Number
        },
        fileSize: Number,
        duration: Number
    },
    scores: {
        overall: Number,
        resolution: Number,
        bitrate: Number,
        codec: Number,
        audio: Number
    },
    flags: [String], // ['low_resolution', 'low_bitrate', 'audio_issues']
    recommendations: [String]
};
```

### Duplicate Group Structure

```javascript
const DuplicateGroup = {
    groupId: String,
    scenes: [{
        sceneId: String,
        qualityScore: Number,
        fileSize: Number,
        resolution: String,
        recommended: Boolean // Best quality in group
    }],
    similarity: Number, // 0-1 similarity score
    recommendations: {
        keep: String, // Scene ID to keep
        remove: [String] // Scene IDs to consider removing
    }
};
```

## Error Handling

### Metadata Extraction Failures

```javascript
const MetadataErrorHandler = {
    handleMissingMetadata(sceneId, missingFields) {
        console.warn(`Scene ${sceneId} missing metadata:`, missingFields);
        return {
            canAnalyze: missingFields.length < 3,
            partialAnalysis: true,
            missingData: missingFields
        };
    },
    
    handleCorruptedFile(sceneId, error) {
        return {
            canAnalyze: false,
            error: 'corrupted_file',
            recommendation: 'File may be corrupted and should be checked manually'
        };
    }
};
```

## Testing Strategy

### Quality Algorithm Validation

- Test scoring algorithm with known quality samples
- Validate duplicate detection with intentional duplicates
- Test edge cases (very small files, unusual formats)
- Performance testing with large libraries

### Integration Testing

- Test with various video formats and codecs
- Validate Stash API integration for metadata extraction
- Test background processing performance
- Verify UI integration with existing Stash interface