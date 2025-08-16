## AutomateStash-Final.js – Optimization Plan (Revised)

**Last Updated: 2025-01-16**
**Status: Enhanced Version In Progress (AutomateStash-Final-Enhanced.js)**

This plan reflects the current state of AutomateStash-Final.js and the new enhanced version with performance monitoring. Items already implemented are summarized for clarity.

### Already implemented

#### Original AutomateStash-Final.js Features
- Duplicate checker (server pHash) with accuracy (0/4/8/10) and duration (-1, 0, 1, 5, 10)
- Local aHash fallback utilities
- Title fallback to file basename when missing
- Metadata pills (tags, performers, organized) + duration and file size display
- Ignore persistence
  - Pair-level (`duplicate_ignore_pairs`) and group-level (`duplicate_ignore_groups`); rows hidden immediately; persisted via GM
- Merge flow
  - Destination = largest file-size scene
  - If destination lacks metadata, transfer donor metadata (safe fields) using `sceneMerge` with `values.id = destination`
  - Open merged scene only after user chooses (accept/reject) in confirm dialog
  - Delete disabled by default; confirm dialog retained for UX
- GraphQL hardening
  - String IDs for mutations
  - `sceneDestroy` variants support; `sceneMerge` values guarded
  - Request coalescing present in script-level client

#### Performance Enhancements (NEW - Implemented in Enhanced Version)
- ✅ Performance monitoring with real-time metrics (performance-enhancer.js)
- ✅ LRU cache with TTL strategies (cache-manager.js)
- ✅ DOM operation batching to reduce reflows
- ✅ Task queue with priority and concurrency control
- ✅ Optimized element waiting with MutationObserver
- ✅ Memory management with scheduled cleanup
- ✅ GraphQL request performance tracking
- ✅ Advanced caching for GraphQL responses

#### UI/UX Enhancements (NEW - Implemented)
- ✅ Modern theme system with 4 built-in themes (ui-theme-manager.js)
- ✅ Animation controller with 15+ pre-built animations (animation-controller.js)
- ✅ Keyboard shortcuts system with 20+ default shortcuts (keyboard-shortcuts.js)
- ✅ General UI configuration manager (ui-config.js)
- ✅ Reduced motion support and accessibility features
- ✅ Visual feedback for keyboard actions

### Current Implementation Status
- **Library Components**: 100% Complete (7/7 files created)
- **Core Integration**: 60% Complete (missing automation methods from original)
- **Testing**: Not started
- **Documentation**: 90% Complete

### Gaps / Opportunities (Updated)
1) **[IN PROGRESS]** Complete core automation logic integration
   - Copy 13 missing methods from AutomateStash-Final.js
   - Wrap all methods with performance monitoring
   - Implement full classes (SourceDetector, StatusTracker, HistoryManager)

2) **[PENDING]** Fix library loading mechanism
   - Current @require with file:// protocol won't work for users
   - Options: Bundle all libraries, use CDN, or build process

3) **[COMPLETE]** Centralized GraphQL client with caching
   - ✅ Advanced caching implemented in enhanced version
   - ✅ Request performance tracking added
   - ✅ LRU cache with TTL strategies

4) **[COMPLETE]** Performance optimization infrastructure
   - ✅ DOM batching implemented
   - ✅ Task queue with concurrency control
   - ✅ Memory management and cleanup

5) **[PENDING]** Testing and validation
   - Performance benchmarking against targets
   - Cross-browser compatibility testing
   - Integration testing with full automation workflow

### Prioritized next steps (Updated for Enhanced Version)
1) **IMMEDIATE**: Complete core automation integration
   - Copy methods: `waitForElement`, `clickFast`, `detectScraperOutcome`, etc.
   - Add performance monitoring wrappers to all methods
   - Test automation workflow with performance tracking

2) **HIGH PRIORITY**: Fix library loading
   - Create single-file bundle option for easy deployment
   - Alternative: Host on CDN (jsDelivr/GitHub Pages)
   - Document installation process

3) **MEDIUM PRIORITY**: Performance validation
   - Measure automation time before/after enhancements
   - Verify 40-50% reduction target achieved
   - Validate memory usage stays under 80MB

4) **LOW PRIORITY**: Additional optimizations
   - Virtualized rendering for large datasets
   - Progressive enhancement for older browsers
   - Advanced schema introspection

### Performance Metrics and Targets

#### Expected Improvements
- **Automation Time**: 40-50% reduction
- **GraphQL Requests**: 40% reduction via caching
- **DOM Operations**: 60% reduction via batching
- **Memory Usage**: < 80MB sustained
- **Cache Hit Rate**: > 70% for repeated operations

### Code concepts (Enhanced Implementation)
- TTL cache for duplicate search
```js
const dupCache = new Map(); // key -> { ts, data }
function getDupCache(k, ttlMs=30000){ const e=dupCache.get(k); return e && (Date.now()-e.ts)<ttlMs ? e.data : null; }
function setDupCache(k, data){ dupCache.set(k, { ts: Date.now(), data }); }
```
- Virtualized render sketch
```js
function renderVirtualized(container, items, itemHeight=88){
  const viewport = container.getBoundingClientRect().height;
  const visible = Math.ceil(viewport / itemHeight) + 6;
  function update(){
    const scrollTop = container.scrollTop;
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - 3);
    const slice = items.slice(start, start + visible);
    // render only `slice` rows; position with translateY(start*itemHeight)
  }
  container.addEventListener('scroll', ()=>requestAnimationFrame(update));
  update();
}
```
- Shared GraphQL client (module-ready)
```js
export class GQLClient {
  constructor(base, apiKey){ this.base=base; this.apiKey=apiKey; }
  async request(query, variables){
    const ctl = new AbortController(); const to=setTimeout(()=>ctl.abort(), 12000);
    try{
      const r = await fetch(`${this.base}/graphql`,{ method:'POST', signal: ctl.signal,
        headers:{'Content-Type':'application/json', ...(this.apiKey?{ApiKey:this.apiKey}:{})},
        body: JSON.stringify({ query, variables }) });
      const j = await r.json(); if (j.errors) throw new Error(j.errors.map(e=>e.message).join(','));
      return j.data;
    } finally { clearTimeout(to); }
  }
  async mutateWithVariants(variants){ for (const v of variants){ try{ return await this.request(v.q,v.v);}catch(_){} } throw new Error('All variants failed'); }
}
```

### Implementation Progress Summary

✅ **Completed**:
- All 7 library files created and functional
- Performance monitoring infrastructure
- Advanced caching system
- Modern UI/UX enhancements
- Keyboard shortcuts and accessibility

🚧 **In Progress**:
- Core automation logic integration (60%)
- Documentation updates (90%)

📋 **Pending**:
- Library loading mechanism fix
- Full testing and validation
- Performance benchmarking
- Deployment preparation

This revised plan reflects the enhanced version development with comprehensive performance optimizations and modern UI/UX improvements. The focus is now on completing the core automation integration and preparing for deployment.
