## StashCollectionOrganizer.js – Optimization Plan

### Goals
- Smarter suggestions with less blocking UI.
- Standardized naming and folder rules with previews + undo.
- Robust GraphQL updates with batching.

### Findings
- Large in-memory operations; risk of long blocks.
- Direct fetch to `/graphql` w/o timeout/ApiKey abstraction.
- Naming sanitization exists; could support templates + variables.

### Action Plan
1) Analysis pipeline
   - Stream analysis in chunks (`BATCH_SIZE`), yield to UI via `await nextTick()`.
   - Cache analysis results for 1h; invalidate by date range or studio/tag selection.
2) Naming & Foldering
   - Pluggable templates: `{performer}`, `{studio}`, `{title}`, `{date}` with safe fallback.
   - Preview panel shows current vs proposed; bulk apply supports rollback (GM backup).
3) GraphQL Ops
   - Use `scenesUpdate` batched changes; throttle per 250ms; show errors per scene.

### Code Concepts
- Template engine
```js
function renderTemplate(tpl, ctx){
  return tpl.replace(/\{(\w+)\}/g, (_,k)=> (ctx[k]??'').toString());
}
```
- Non-blocking chunked loop
```js
async function processInChunks(items, size, cb){
  for(let i=0;i<items.length;i+=size){
    const slice = items.slice(i,i+size);
    await cb(slice,i);
    await new Promise(r=>setTimeout(r)); // yield
  }
}
```
- Undo snapshot
```js
function snapshotScenes(scenes){
  return scenes.map(s=>({id:s.id, path:s.files?.[0]?.path, title:s.title, tags:s.tags?.map(t=>t.id)}));
}
```




