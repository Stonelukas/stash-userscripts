## StashExportImportTools.js – Optimization Plan

### Goals
- Reliable large exports/imports with chunking and resume.
- Validation before import; schema/version awareness.
- Clear progress + error reporting.

### Issues
- GraphQL client lacks timeout/backoff and ApiKey header.
- Risk of huge payloads (JSON), need streaming/chunking.

### Action Plan
1) Exports
   - Chunked fetch via pagination; write NDJSON or split files per 10k items.
   - Optionally compress (gzip/zip) after chunk writing.
2) Imports
   - Validate schema keys; dry-run to count would-be changes.
   - Upsert approach with idempotency (by stash_id or checksums).
3) Resume support
   - Store last checkpoint and chunk index in GM; allow resume on failure.

### Code Concepts
- NDJSON writer
```js
function toNDJSON(array){ return array.map(o=>JSON.stringify(o)).join('\n'); }
```
- Import dry-run
```js
async function dryRunScenes(data){
  const invalid = [];
  for(const s of data){ if(!s.title && !s.files?.length) invalid.push(s.id||s.title||'[unknown]'); }
  return { total: data.length, invalid };
}
```
- Checkpointing
```js
function saveCheckpoint(key, state){ GM_setValue(key, JSON.stringify(state)); }
function loadCheckpoint(key){ try{ return JSON.parse(GM_getValue(key,'{}')); }catch(_){ return {}; } }
```





