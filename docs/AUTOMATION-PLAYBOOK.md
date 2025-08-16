# AutomateStash Automation Playbook

Practical strategies to push Stash automation further. Each section includes a short strategy, data model, and ready-to-adapt code snippets for a Tampermonkey/Greasemonkey userscript running inside Stash.

Notes
- Examples assume GM storage and a `stashGQL(query, variables)` helper.
- Prefer small, composable utilities over large flows. Keep steps idempotent and checkpointed.
- Use short, bounded waits and visibility-aware DOM ops.

## Utilities used across snippets

```javascript
// Storage wrappers (namespaced keys to avoid collisions)
const NS = 'automate-stash';
const k = (s) => `${NS}:${s}`;
const get = (key, fallback) => GM_getValue(k(key), fallback);
const set = (key, value) => GM_setValue(k(key), value);

// TTL cache
const cache = {
  get(key) {
    const v = get(`cache:${key}`);
    if (!v) return undefined;
    const { exp, data } = v;
    return exp && Date.now() > exp ? undefined : data;
  },
  set(key, data, ttlMs) {
    set(`cache:${key}`, { data, exp: ttlMs ? Date.now() + ttlMs : undefined });
  },
};

// Simple concurrency controller
function createLimiter(max) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (!queue.length || active >= max) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then((r) => resolve(r)).catch(reject).finally(() => {
      active--;
      next();
    });
  };
  return function limit(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

// Visibility-safe click
async function clickVisible(el) {
  el.scrollIntoView({ behavior: 'instant', block: 'center' });
  await new Promise(r => requestAnimationFrame(r));
  el.focus();
  el.click();
}

// Guarded selector wait
async function waitVisible(selectors, timeout = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const s of Array.isArray(selectors) ? selectors : [selectors]) {
      const el = document.querySelector(s);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width && rect.height && rect.top >= 0 && rect.bottom <= window.innerHeight + 1) return el;
      }
    }
    await new Promise(r => setTimeout(r, 50));
  }
  return undefined;
}

// Minimal GQL helper stub (adapt to your project helper)
async function stashGQL(query, variables) {
  const res = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    credentials: 'include',
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map(e => e.message).join('; '));
  return json.data;
}
```

---

## 1) Smart scraping and data quality

### 1.1 Adaptive scraper routing
- Goal: Try sources in the order most likely to succeed for this studio/series/filename pattern.
- Store rolling success stats per key, update after each scrape.

```javascript
function keyForScene(scene) {
  return [scene.studio || 'nostudio', scene.series || 'noseries'].join('|');
}

function getScraperStats() {
  return get('scraperStats', {});
}

function recordScrape(scene, source, { success }) {
  const stats = getScraperStats();
  const key = keyForScene(scene);
  stats[key] ||= {};
  stats[key][source] ||= { ok: 0, fail: 0 };
  success ? stats[key][source].ok++ : stats[key][source].fail++;
  set('scraperStats', stats);
}

function orderSources(scene, sources) {
  const stats = getScraperStats();
  const key = keyForScene(scene);
  const row = stats[key] || {};
  const score = (s) => {
    const r = row[s];
    if (!r) return 0;
    const n = r.ok + r.fail;
    return n ? (r.ok / n) : 0;
  };
  return [...sources].sort((a, b) => score(b) - score(a));
}
```

### 1.2 Confidence gating
- Compute a match score and gate apply/create below a threshold.

```javascript
function computeMatchScore(proposal, scene) {
  let score = 0;
  if (proposal.title && scene.title && proposal.title.toLowerCase() === scene.title.toLowerCase()) score += 0.4;
  if (proposal.date && scene.date && proposal.date === scene.date) score += 0.2;
  if (proposal.duration && scene.duration) {
    const diff = Math.abs(proposal.duration - scene.duration);
    score += diff <= 10 ? 0.2 : diff <= 30 ? 0.1 : 0;
  }
  if (proposal.performers && scene.performers) {
    const overlap = proposal.performers.filter(p => scene.performers.includes(p)).length;
    score += Math.min(0.2, overlap * 0.05);
  }
  return Math.min(1, score);
}

async function gateApply(proposal, scene, threshold = 0.6) {
  const s = computeMatchScore(proposal, scene);
  if (s >= threshold) return true;
  const queue = get('triageQueue', []);
  queue.push({ id: scene.id, proposal, score: s, ts: Date.now() });
  set('triageQueue', queue);
  return false;
}
```

### 1.3 Auto re-scrape policy
- Retry failed/low-confidence scenes off-peak. Keep a FIFO and a backoff per source.

```javascript
function enqueueRescrape(sceneId, reason) {
  const q = get('rescrapeQueue', []);
  q.push({ sceneId, reason, nextAt: Date.now() + 6 * 3600e3, tries: 0 });
  set('rescrapeQueue', q);
}

function popDueRescrapes(limit = 5) {
  const q = get('rescrapeQueue', []);
  const now = Date.now();
  const due = q.filter(x => x.nextAt <= now).slice(0, limit);
  const rest = q.filter(x => !due.includes(x));
  set('rescrapeQueue', rest);
  return due;
}

async function processRescrapes(runOne) {
  for (const job of popDueRescrapes()) {
    try {
      await runOne(job.sceneId);
    } catch (e) {
      job.tries++;
      job.nextAt = Date.now() + Math.min(24, 2 ** job.tries) * 3600e3;
      const q = get('rescrapeQueue', []);
      q.push(job);
      set('rescrapeQueue', q);
    }
  }
}
```

### 1.4 Duplicate detection (thumbnail perceptual hash)
- Fast average-hash (aHash) of thumbnails to catch near-duplicates.

```javascript
async function imageAhash(imgUrl) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = imgUrl;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = 8; c.height = 8;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, 8, 8);
  const { data } = ctx.getImageData(0, 0, 8, 8);
  const gray = [];
  for (let i = 0; i < data.length; i += 4) gray.push(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
  const avg = gray.reduce((a, b) => a + b, 0) / gray.length;
  let bits = 0n;
  gray.forEach((g, i) => { if (g >= avg) bits |= 1n << BigInt(i); });
  return bits;
}

function hamming(a, b) {
  let x = a ^ b, c = 0;
  while (x) { x &= x - 1n; c++; }
  return c;
}
```

### 1.5 Outdated metadata refresh

```javascript
function markScraped(sceneId) {
  const t = get('lastScrapedAt', {});
  t[sceneId] = Date.now();
  set('lastScrapedAt', t);
}

function needsRefresh(sceneId, months = 12) {
  const t = get('lastScrapedAt', {});
  const at = t[sceneId];
  return !at || (Date.now() - at) > months * 30 * 24 * 3600e3;
}
```

---

## 2) Workflow automation and rules

### 2.1 Rule engine (IFTTT)

```javascript
const rules = [
  {
    when: s => s.studio === 'Example Studio',
    then: async (s) => {
      await scrapeWith('StashDB', s);
      await scrapeWith('TPDB', s);
      await quickOrganize(s);
    },
  },
  {
    when: s => /S\d+E\d+/.test(s.title || ''),
    then: async (s) => setEpisodeTags(s),
  },
];

async function runRules(scene) {
  for (const r of rules) if (r.when(scene)) await r.then(scene);
}
```

### 2.2 Scheduled jobs (off-peak)

```javascript
function isOffPeak() {
  const h = new Date().getHours();
  return h >= 1 && h <= 6;
}

async function schedulerTick() {
  if (!isOffPeak()) return;
  await processRescrapes(async (sceneId) => {
    // Implement a targeted re-scrape pipeline for a sceneId
  });
}

setInterval(schedulerTick, 5 * 60 * 1000);
```

### 2.3 Post-save hooks

```javascript
async function afterSave(scene) {
  await quickOrganize(scene);
  const log = get('auditLog', []);
  log.push({ type: 'save', id: scene.id, at: Date.now() });
  set('auditLog', log);
}
```

### 2.4 Gated creation

```javascript
function allowCreatePerformer(signals) {
  let score = 0;
  if (signals.nameExact) score += 0.4;
  if (signals.siteMatch) score += 0.3;
  if (signals.birthdateMatch) score += 0.2;
  if (signals.aliasOverlap) score += 0.1;
  return score >= 0.6;
}
```

---

## 3) Bulk operations and organization

### 3.1 Smart naming templates (client-side planning)

```javascript
function buildFilenameTemplate(scene) {
  const safe = (s) => (s || '').replace(/[^\w\-\.]+/g, ' ').trim();
  return `${safe(scene.studio)} - ${safe(scene.date)} - ${safe(scene.title)}.mp4`;
}
```

### 3.2 Smart collections (auto-curated)

```javascript
function defineSmartCollection(id, filter) {
  const map = get('smartCollections', {});
  map[id] = { filter, updated: 0 };
  set('smartCollections', map);
}

async function updateSmartCollections(listScenes) {
  const map = get('smartCollections', {});
  for (const [id, cfg] of Object.entries(map)) {
    const scenes = await listScenes();
    const matched = scenes.filter(cfg.filter);
    set(`smartCollections:${id}`, matched.map(s => s.id));
    cfg.updated = Date.now();
  }
  set('smartCollections', map);
}
```

### 3.3 Tag macros

```javascript
const tagMacros = {
  'hardcore': ['Anal', 'Blowjob', 'Cumshot'],
  'softcore': ['Solo', 'Striptease'],
};

function expandTagMacro(scene, macroName) {
  const tags = tagMacros[macroName] || [];
  return [...new Set([...(scene.tags || []), ...tags])];
}
```

### 3.4 One-click cleanup (client-side checks)

```javascript
function normalizeTitleCase(s) {
  return s.replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase());
}

function cleanupSceneLocal(scene) {
  const out = { ...scene };
  if (out.title) out.title = normalizeTitleCase(out.title);
  if (out.date && /\//.test(out.date)) out.date = out.date.replace(/\//g, '-');
  return out;
}
```

---

## 4) Reliability, recovery, and testing

### 4.1 Checkpointed jobs

```javascript
function startJob(name, payload) {
  const jobs = get('jobs', {});
  const id = `${name}:${Date.now()}`;
  jobs[id] = { name, payload, step: 0, at: Date.now() };
  set('jobs', jobs);
  return id;
}

function updateJob(id, step, extra) {
  const jobs = get('jobs', {});
  if (!jobs[id]) return;
  jobs[id] = { ...jobs[id], step, ...extra, at: Date.now() };
  set('jobs', jobs);
}

function completeJob(id, ok, error) {
  const jobs = get('jobs', {});
  const done = get('jobsDone', []);
  if (jobs[id]) {
    done.push({ ...jobs[id], ok, error, doneAt: Date.now() });
    delete jobs[id];
    set('jobs', jobs);
    set('jobsDone', done);
  }
}
```

### 4.2 Selector health checks

```javascript
async function validateSelectors(list) {
  const results = [];
  for (const s of list) results.push({ s, ok: !!document.querySelector(s) });
  const bad = results.filter(r => !r.ok);
  if (bad.length) console.warn('Selector(s) failing', bad);
  return bad.length === 0;
}
```

### 4.3 Tiny E2E smoke (happy path)

```javascript
async function smokeTest() {
  // Replace stubs to match your UI
  const ok1 = await validateSelectors(['.scene-edit-form', 'button.btn-primary']);
  if (!ok1) throw new Error('Base selectors changed');
  // Add a minimal scrape/apply/save dry-run here
}
```

### 4.4 Failure triage dashboard (data model)

```javascript
function recordFailure(phase, reason, sceneId) {
  const f = get('failures', []);
  f.push({ phase, reason, sceneId, at: Date.now() });
  set('failures', f);
}

function summarizeFailures() {
  const f = get('failures', []);
  const by = {};
  for (const x of f) {
    const k = `${x.phase}|${x.reason}`;
    by[k] = (by[k] || 0) + 1;
  }
  return Object.entries(by).sort((a, b) => b[1] - a[1]);
}
```

---

## 5) UI and ergonomics

### 5.1 Command palette

```javascript
function openCommandPalette(commands) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;background:rgba(0,0,0,0.35);z-index:99999;';
  div.innerHTML = `
    <div style="margin-top:10vh;background:#111;color:#eee;padding:12px 16px;border-radius:8px;min-width:520px;box-shadow:0 10px 30px rgba(0,0,0,.4)">
      <input id="cp-inp" placeholder="Type a command..." style="width:100%;padding:10px;border-radius:6px;border:1px solid #333;background:#1b1b1b;color:#eee" />
      <div id="cp-list" style="margin-top:8px;max-height:50vh;overflow:auto"></div>
    </div>`;
  document.body.appendChild(div);
  const inp = div.querySelector('#cp-inp');
  const list = div.querySelector('#cp-list');
  function render(filter = '') {
    const items = commands.filter(c => c.title.toLowerCase().includes(filter.toLowerCase()));
    list.innerHTML = items.map((c, i) => `<div data-i="${i}" style="padding:6px 8px;border-radius:6px;cursor:pointer">${c.title}</div>`).join('');
    [...list.children].forEach(node => node.addEventListener('click', async (e) => { await items[+node.dataset.i].run(); close(); }));
  }
  function close() { div.remove(); }
  inp.addEventListener('input', () => render(inp.value));
  inp.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); if (e.key === 'Enter') { const first = list.firstChild; if (first) first.dispatchEvent(new Event('click')); }});
  render();
  inp.focus();
}
```

### 5.2 Sidecar triage panel (low-confidence review)

```javascript
function openTriagePanel(entry) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;top:0;right:0;width:420px;height:100vh;background:#0f0f10;color:#eee;z-index:99998;box-shadow:-8px 0 24px rgba(0,0,0,.4);padding:12px;overflow:auto';
  div.innerHTML = `<h3>Triage</h3><pre>${JSON.stringify(entry, null, 2)}</pre><button id="triage-accept">Accept</button> <button id="triage-skip">Skip</button>`;
  document.body.appendChild(div);
}
```

### 5.3 Progress HUD metrics

```javascript
function metrics() {
  const m = get('metrics', { phase: {}, source: {} });
  function inc(map, k, d) { map[k] = (map[k] || 0) + d; }
  return {
    start(phase) { inc(m.phase, `${phase}:started`, 1); set('metrics', m); },
    ok(phase) { inc(m.phase, `${phase}:ok`, 1); set('metrics', m); },
    fail(phase) { inc(m.phase, `${phase}:fail`, 1); set('metrics', m); },
  };
}
```

---

## 6) Performance and scaling

### 6.1 Concurrency and backpressure

```javascript
const limit = createLimiter(2);
async function runConcurrent(tasks) {
  return Promise.all(tasks.map(t => limit(t)));
}
```

### 6.2 Request coalescing and TTL caches

```javascript
const inflight = new Map();
async function cachedQuery(key, query, variables, ttlMs = 5000) {
  const cached = cache.get(key);
  if (cached) return cached;
  if (inflight.has(key)) return inflight.get(key);
  const p = stashGQL(query, variables).then((data) => { cache.set(key, data, ttlMs); inflight.delete(key); return data; })
    .catch((e) => { inflight.delete(key); throw e; });
  inflight.set(key, p);
  return p;
}
```

### 6.3 Pipelined DOM ops

```javascript
async function batchClicks(selectors) {
  for (const s of selectors) {
    const el = await waitVisible(s, 1500);
    if (el) await clickVisible(el);
  }
}
```

### 6.4 Metrics and budgets

```javascript
const perfBudget = { scrapeMs: 8000, applyMs: 3000 };
function withinBudget(name, elapsedMs) { return elapsedMs <= (perfBudget[name] || 999999); }
```

---

## 7) Integrations and ecosystem

### 7.1 Webhooks (optional)

```javascript
async function sendWebhook(event, payload) {
  const url = get('webhookUrl');
  if (!url) return;
  await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, payload }) });
}
```

### 7.2 Import watcher (client-side polling)

```javascript
async function listRecentScenes() {
  // Use your GraphQL list query here
  return [];
}

async function watchNewImports() {
  const seen = new Set(get('seenSceneIds', []));
  const list = await listRecentScenes();
  const fresh = list.filter(s => !seen.has(s.id));
  for (const s of fresh) {
    // enqueue automation pipeline for s
    seen.add(s.id);
  }
  set('seenSceneIds', [...seen]);
}

setInterval(watchNewImports, 60 * 1000);
```

### 7.3 Export packs

```javascript
function downloadJSON(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}
```

### 7.4 Simple API surface (window binding)

```javascript
window.AutomateStashAPI = {
  rescrape: (sceneId) => enqueueRescrape(sceneId, 'manual'),
  failures: summarizeFailures,
  metrics: () => get('metrics', {}),
};
```

---

## 8) Media analysis assists (optional)

These are browser-only approximations. Prefer server-side tools for accuracy.

```javascript
async function probeVideo(el) {
  return { duration: el.duration, width: el.videoWidth, height: el.videoHeight };
}
```

---

## 9) Guardrails and governance

### 9.1 Dry-run mode

```javascript
const DRY_RUN = () => !!get('dryRun', false);
async function guardedApply(fn, label) {
  if (DRY_RUN()) return { skipped: true, label };
  return fn();
}
```

### 9.2 Audit log and rollback (last-N)

```javascript
function logChange(kind, id, before, after) {
  const log = get('auditLog', []);
  log.push({ kind, id, before, after, at: Date.now() });
  set('auditLog', log);
}

function lastChanges(n = 20) {
  const log = get('auditLog', []);
  return log.slice(-n);
}
```

### 9.3 Rate limits and quotas

```javascript
function limiterByKey(maxPerMinute) {
  const wins = get('rateWins', {});
  return (key) => {
    const now = Date.now();
    const win = Math.floor(now / 60000);
    wins[key] ||= { win, count: 0 };
    if (wins[key].win !== win) wins[key] = { win, count: 0 };
    if (wins[key].count >= maxPerMinute) return false;
    wins[key].count++;
    set('rateWins', wins);
    return true;
  };
}
```

---

## Integration tips
- Replace GraphQL stubs with concrete queries from docs/API.md.
- Start with low-risk features: adaptive routing, confidence gating, post-save hooks, metrics.
- Keep per-scene state (scrapedAt, lastOutcome, organizedAt) to improve decisions over time.
- Add small UI surfaces (palette, HUD) to control and observe automation at runtime.
