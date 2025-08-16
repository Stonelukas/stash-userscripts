## StashPerformerManager.js – Optimization Plan

### Goals
- Safer performer merges and bulk edits.
- Better filters and presets for tagging.

### Action Plan
1) Performer merge
   - Merge values only if dest missing; `values.id = dest` and only allowed fields.
   - Reassign scenes if needed; show preview of deltas.
2) Bulk tagging/fields
   - Batched updates via `performersUpdate` (if available) or per-performer with TaskQueue.
   - Filters: by tag, studio appearance, age range at scene-date.
3) UI
   - Side-by-side merge dialog (like scene merge) with scraped values pattern.

### Code Concepts
- Merge values builder
```js
function buildPerformerValues(dest, src){
  const v={ id:String(dest.id) }, set=(k,val)=>{ if(val!=null && (!(Array.isArray(val))||val.length)) v[k]=val; };
  set('name', src.name); set('details', src.details); set('url', src.url);
  // add more when confirmed by schema
  return v;
}
```
- Query helpers
```js
async function findPerformersByName(gql, name){
  const q=`query($f:PerformerFilterType){ findPerformers(filter:$f){ performers{ id name scene_count } } }`;
  const d=await gql.request(q,{f:{name:{value:name,modifier:"MATCHES_REGEX"}}});
  return d?.findPerformers?.performers||[];
}
```





