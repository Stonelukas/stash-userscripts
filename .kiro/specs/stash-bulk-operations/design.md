# Design Document

## Overview

The Stash Bulk Operations Manager integrates seamlessly with Stash's React-based interface to provide efficient batch editing capabilities. The system uses Stash's GraphQL API for data operations and implements a non-intrusive UI overlay that works across different scene listing views.

## Architecture

### Core Components

1. **Selection Manager**: Handles scene selection state and UI updates
2. **Bulk Operations Engine**: Executes batch operations using Stash GraphQL API
3. **Progress Tracker**: Monitors and displays operation progress
4. **UI Overlay System**: Provides bulk operation interface without disrupting existing UI

### Integration Points

- **Stash GraphQL API**: For scene mutations and queries
- **React SPA Navigation**: Maintains selection state across page transitions
- **Bootstrap UI Components**: Consistent styling with Stash interface
- **Stash Scene Cards**: Adds selection checkboxes to existing scene displays

## Components and Interfaces

### Selection Manager Class

```javascript
class SelectionManager {
    constructor() {
        this.selectedScenes = new Set();
        this.observers = [];
    }
    
    addScene(sceneId) { /* Add scene to selection */ }
    removeScene(sceneId) { /* Remove scene from selection */ }
    selectAll() { /* Select all visible scenes */ }
    clearSelection() { /* Clear all selections */ }
    getSelectedCount() { /* Return count of selected scenes */ }
}
```

### Bulk Operations Engine

```javascript
class BulkOperationsEngine {
    async bulkUpdateTags(sceneIds, tagsToAdd, tagsToRemove) { /* GraphQL mutations */ }
    async bulkUpdatePerformers(sceneIds, performersToAdd, performersToRemove) { /* GraphQL mutations */ }
    async bulkUpdateStudio(sceneIds, studioId) { /* GraphQL mutations */ }
    async bulkUpdateMetadata(sceneIds, metadata) { /* GraphQL mutations */ }
}
```

### Progress Tracking System

```javascript
class ProgressTracker {
    constructor(totalItems) {
        this.total = totalItems;
        this.completed = 0;
        this.errors = [];
    }
    
    updateProgress(completed, errors = []) { /* Update progress display */ }
    showSummary() { /* Display completion summary */ }
}
```

## Data Models

### Scene Selection State

```javascript
const BulkOperationState = {
    selectedScenes: new Set(),
    operationInProgress: false,
    currentOperation: null,
    progressData: {
        total: 0,
        completed: 0,
        errors: []
    }
};
```

### GraphQL Mutation Templates

```javascript
const BULK_MUTATIONS = {
    UPDATE_SCENE_TAGS: `
        mutation BulkUpdateSceneTags($sceneIds: [ID!]!, $tagIds: [ID!]!) {
            bulkSceneUpdate(input: {
                ids: $sceneIds
                tag_ids: { ids: $tagIds, mode: SET }
            }) {
                id
            }
        }
    `,
    UPDATE_SCENE_PERFORMERS: `
        mutation BulkUpdateScenePerformers($sceneIds: [ID!]!, $performerIds: [ID!]!) {
            bulkSceneUpdate(input: {
                ids: $sceneIds
                performer_ids: { ids: $performerIds, mode: SET }
            }) {
                id
            }
        }
    `
};
```

## Error Handling

### Graceful Degradation

- Continue processing remaining scenes if individual operations fail
- Log detailed error information for troubleshooting
- Provide retry mechanisms for failed operations
- Maintain UI responsiveness during long operations

### Validation System

```javascript
const ValidationRules = {
    validateSceneSelection: (sceneIds) => {
        if (!sceneIds || sceneIds.length === 0) {
            throw new Error('No scenes selected for bulk operation');
        }
        return true;
    },
    
    validateTagInput: (tags) => {
        return tags.every(tag => tag.id && tag.name);
    },
    
    validatePerformerInput: (performers) => {
        return performers.every(performer => performer.id && performer.name);
    }
};
```

## Testing Strategy

### Integration Testing

- Test with different scene listing views (scenes, performers, studios)
- Validate GraphQL mutations with Stash API
- Test selection persistence across page navigation
- Verify UI responsiveness during bulk operations

### Error Scenario Testing

- Network failures during bulk operations
- Invalid scene IDs in selection
- Concurrent user modifications
- Large batch size performance testing