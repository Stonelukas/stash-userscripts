# Product Steering Rules

## Product Purpose
Build automation tools for Stash, a self-hosted adult content management system. Focus on automating metadata scraping, scene organization, and bulk operations to save users time.

## Core Features
Always prioritize these features when making changes:
- **Automation**: Scene scraping from StashDB and ThePornDB with smart skip logic
- **Bulk Operations**: Multi-scene selection and batch processing capabilities
- **Quality Analysis**: Video quality scoring and duplicate detection
- **Performance Monitoring**: Real-time metrics tracking and optimization recommendations
- **Data Management**: Export/import tools for backup and migration
- **UI Enhancement**: Floating widgets, minimizable panels, and keyboard shortcuts

## User Value Proposition
Users install these tools to:
- Automate repetitive metadata tasks (saving 15-30 seconds per scene)
- Process entire libraries with bulk operations
- Maintain consistent quality standards across collections
- Monitor and optimize Stash performance
- Preserve data with backup/restore capabilities

## Key Business Logic Rules
Follow these rules when implementing features:
- Always check if sources are already scraped before re-scraping (unless user forces)
- Use confidence scoring (0.0-1.0) for scraper detection accuracy
- Maintain global automation state flags to prevent race conditions
- Show visual feedback for all long-running operations
- Support cancellation for any automation workflow
- Persist user configuration across sessions using GM storage
- Respect Stash's GraphQL mutation delays (typically 1000ms)

## Target Environment
Design for these constraints:
- Stash server running on localhost:9998
- React SPA with client-side routing
- GraphQL API for all data operations
- Userscript managers (Tampermonkey/Greasemonkey) for script injection
- Modern browsers (Chrome, Firefox, Edge)

## Quality Standards
Maintain these standards in all features:
- Automation success rate must exceed 95%
- Memory usage should stay under 80MB
- Operations must be reversible or have confirmation dialogs
- All features must gracefully handle missing elements or API failures
- Status notifications must be clear and actionable