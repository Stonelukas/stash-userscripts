## StashBulkOperations.js – Optimization Plan

### Goals
- Faster batch operations with better feedback and error isolation.
- Safer GraphQL interactions with retries and schema variants.
- Cleaner selection/state handling and cancelation support.

### Issues observed (quick scan)
- GraphQL client uses fixed `/graphql`, no ApiKey/header or timeout.
- Per-scene requests in loops (N GraphQL calls) – needs batching/pagination.
- No concurrency control for heavy ops beyond a constant; no backpressure.
- Console-only feedback; progress and error aggregation can be improved.

### Action Plan
1) GraphQL client
   - Accept base URL + ApiKey; add timeout + retry/backoff.
   - Add `paginate` helper to fetch large lists with `per_page` and `page`.
2) Batch processing
   - Introduce TaskQueue with concurrency, per-task timeout, and abortable cancel.
   - Batch updates with `scenesUpdate` where feasible.
3) Selection/State
   - Centralize selection state; expose typed events; store last selection in GM.
   - Provide quick filters + saved presets for common bulk operations.
4) UX
   - Progress bar with counts, error panel with per-item errors.
   - Dry-run mode for metadata changes.

### Code Concepts
- TaskQueue
```js
class TaskQueue{
  constructor({concurrency=4,retry=1}={}){ this.c=concurrency; this.q=[]; this.a=0; this.r=retry; }
  enqueue(fn){ return new Promise((res,rej)=>{ this.q.push({fn,res,rej,tries:0}); this._pump(); }); }
  async _pump(){ if(this.a>=this.c||!this.q.length) return; const t=this.q.shift(); this.a++; try{ const v=await t.fn(); t.res(v);}catch(e){ if(t.tries++<this.r){ this.q.push(t);} else t.rej(e);} finally{ this.a--; this._pump(); } }
}
```
- Batched update
```js
async function scenesUpdate(gql, payloads){
  const m = `mutation($input:[SceneUpdateInput!]!){ scenesUpdate(input:$input){ id } }`;
  return gql.request(m, { input: payloads });
}
```
- Pagination helper
```js
async function paginate(find,{perPage=100, max=Infinity}={}){
  let page=1, out=[]; while(out.length<max){
    const r = await find({ per_page: perPage, page });
    const items = r?.findScenes?.scenes||[]; if(!items.length) break;
    out.push(...items); if(items.length<perPage) break; page++;
  } return out;
}
```





