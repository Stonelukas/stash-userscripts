## StashQualityAnalyzer.js – Optimization Plan

### Goals
- Assess media quality (resolution, bitrate, codec) and flag improvements.
- Provide actionable suggestions (re-encode, replace, retag) with previews.

### Action Plan
1) Metrics
   - Compute quality score per file: resolution, bitrate/px, codec profile, keyframe interval (if available).
   - Compare scene variants; suggest keeping best by size/quality.
2) Findings & Suggestions
   - Low bitrate at high resolution -> suggest re-encode or mark as low-quality.
   - Mismatched aspect ratio vs tag/orientation -> suggest retagging.
3) UI
   - Grid with color-coded scores; filters by studio/performer/date.
   - Export CSV/JSON for external processing.

### Code Concepts
- Quality score
```js
function qualityScore({width,height,bit_rate}){
  const pixels = (width||0)*(height||0);
  const bpp = pixels? (bit_rate||0)/pixels : 0;
  let score = 0;
  if (width>=1920 && height>=1080) score+=30; else if (width>=1280) score+=15;
  if (bpp>0.07) score+=40; else if (bpp>0.04) score+=25; else if (bpp>0.02) score+=10;
  return Math.min(100, score);
}
```
- CSV export
```js
function toCSV(rows){ const keys=Object.keys(rows[0]||{}); return [keys.join(','), ...rows.map(r=>keys.map(k=>JSON.stringify(r[k]??'')).join(','))].join('\n'); }
```




