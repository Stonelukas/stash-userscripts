#!/bin/bash

# Build script to create AutomateStash-Final-Enhanced-Bundle.user.js
# This bundles all libraries inline to avoid @require file:// issues

echo "Building AutomateStash Enhanced Bundle..."

OUTPUT_FILE="AutomateStash-Final-Enhanced-Bundle.user.js"
TEMP_FILE="temp_bundle.js"

# Start with userscript header
cat > "$OUTPUT_FILE" << 'EOF'
// ==UserScript==
// @name         AutomateStash Final Enhanced Bundle
// @version      5.0.0
// @description  AutomateStash with integrated performance monitoring and UI/UX enhancements (bundled)
// @author       AutomateStash Team
// @match        http://localhost:9998/*
// @exclude      http://localhost:9998/scenes/markers?*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_notification
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

EOF

# Add cache-manager.js
echo "    // ===== CACHE MANAGER LIBRARY =====" >> "$OUTPUT_FILE"
if [ -f "lib/cache-manager.js" ]; then
    # Remove the IIFE wrapper and export statements
    sed '1d;$d' lib/cache-manager.js | sed 's/window\.CacheManager/const CacheManager/g' >> "$OUTPUT_FILE"
else
    echo "    // Warning: cache-manager.js not found" >> "$OUTPUT_FILE"
fi

# Add performance-config.js  
echo "    // ===== PERFORMANCE CONFIG =====" >> "$OUTPUT_FILE"
if [ -f "config/performance-config.js" ]; then
    # Remove the IIFE wrapper
    sed '1d;$d' config/performance-config.js >> "$OUTPUT_FILE"
else
    echo "    // Warning: performance-config.js not found" >> "$OUTPUT_FILE"
fi

# Add performance-enhancer.js
echo "    // ===== PERFORMANCE ENHANCER LIBRARY =====" >> "$OUTPUT_FILE"
if [ -f "lib/performance-enhancer.js" ]; then
    # Remove the IIFE wrapper and fix exports
    sed '1d;$d' lib/performance-enhancer.js | sed 's/window\.PerformanceEnhancer/const PerformanceEnhancer/g' | sed 's/window\.domBatch/const domBatch/g' >> "$OUTPUT_FILE"
else
    echo "    // Warning: performance-enhancer.js not found" >> "$OUTPUT_FILE"
fi

# Add the main Enhanced script content (without the header and @require statements)
echo "    // ===== MAIN AUTOMATESTASH ENHANCED SCRIPT =====" >> "$OUTPUT_FILE"
# Skip the userscript header and start from the IIFE
sed -n '/^(function () {$/,$p' AutomateStash-Final-Enhanced.js | sed '$d' >> "$OUTPUT_FILE"

# Close the IIFE
echo "})();" >> "$OUTPUT_FILE"

echo "Bundle created: $OUTPUT_FILE"
echo "Size: $(wc -l $OUTPUT_FILE | cut -d' ' -f1) lines"