## StashPerformanceMonitor.js – Optimization Plan

### Goals
- Accurate capture of performance metrics without impacting UX.
- Visualize hotspots (queries, DOM ops) and suggest fixes.

### Action Plan
1) Instrumentation
   - Wrap fetch to capture durations and error rates; categorize by GraphQL operation.
   - Observe long tasks (`PerformanceObserver`) and first input delay.
2) Reporting
   - Small in-memory buffer; export as JSON for offline analysis.
   - Simple charts in a modal (top N operations by time).
3) Guidance
   - Detect repeated queries; recommend caching TTLs.
   - Detect large DOM batches; recommend batching via raf.

### Code Concepts
- Fetch wrapper
```js
async function timedFetch(url, opts){
  const t0=performance.now(); try{ const r=await fetch(url,opts); return r; }
  finally{ const t1=performance.now(); record('fetch', url, t1-t0); }
}
```
- Long task observer
```js
new PerformanceObserver((list)=>{
  for(const e of list.getEntries()) record('longtask', e.name||'main', e.duration);
}).observe({ type:'longtask', buffered:true });
```





