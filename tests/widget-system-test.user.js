// ==UserScript==
// @name         Widget System Test
// @namespace    https://github.com/Stonelukas/stash-userscripts
// @version      1.0.0
// @description  Test script for widget system integration
// @author       AutomateStash Team
// @match        http://localhost:9998/*
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://raw.githubusercontent.com/Stonelukas/stash-userscripts/main/scripts/lib/widget-sub-managers.js
// @require      https://raw.githubusercontent.com/Stonelukas/stash-userscripts/main/scripts/lib/drag-manager.js
// @require      https://raw.githubusercontent.com/Stonelukas/stash-userscripts/main/scripts/lib/resize-manager.js
// @require      https://raw.githubusercontent.com/Stonelukas/stash-userscripts/main/scripts/lib/enhanced-widget-manager.js
// @require      https://raw.githubusercontent.com/Stonelukas/stash-userscripts/main/scripts/lib/widget-manager-integration.js
// ==/UserScript==

(function() {
    'use strict';

    console.log('🧪 Widget System Test Starting...');

    // Test 1: Check if all widget classes are available
    function testClassAvailability() {
        const classes = [
            'EnhancedWidgetManager',
            'DragManager', 
            'ResizeManager',
            'ZIndexManager',
            'FocusManager',
            'WidgetStateManager',
            'ThemeApplicationManager',
            'KeyboardManager',
            'AnimationAnchorManager',
            'WidgetEventBus',
            'WidgetManagerIntegration'
        ];

        console.log('📋 Testing class availability...');
        let allAvailable = true;
        
        classes.forEach(className => {
            if (window[className]) {
                console.log(`✅ ${className} is available`);
            } else {
                console.error(`❌ ${className} is NOT available`);
                allAvailable = false;
            }
        });

        return allAvailable;
    }

    // Test 2: Create a simple test widget
    function testWidgetCreation() {
        console.log('\n📦 Testing widget creation...');
        
        try {
            // Create enhanced widget manager
            const widgetManager = new window.EnhancedWidgetManager();
            console.log('✅ EnhancedWidgetManager created');

            // Create a test widget element
            const testWidget = document.createElement('div');
            testWidget.style.cssText = `
                position: fixed;
                top: 100px;
                left: 100px;
                width: 300px;
                height: 200px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 10px;
                padding: 20px;
                color: white;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                z-index: 10000;
            `;
            testWidget.innerHTML = `
                <h3 style="margin: 0 0 10px 0;">Widget System Test</h3>
                <p>This is a test widget. Try:</p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Dragging the header to move</li>
                    <li>Resizing from corners/edges</li>
                    <li>Clicking to focus</li>
                </ul>
                <button id="close-test-widget" style="
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: white;
                    padding: 5px 15px;
                    border-radius: 5px;
                    cursor: pointer;
                ">Close Test</button>
            `;

            document.body.appendChild(testWidget);
            console.log('✅ Test widget element created');

            // Register the widget
            const widgetId = widgetManager.registerWidget({
                element: testWidget,
                id: 'test-widget',
                options: {
                    resizable: true,
                    draggable: true,
                    minSize: { width: 200, height: 150 },
                    maxSize: { width: 600, height: 400 }
                }
            });
            console.log(`✅ Widget registered with ID: ${widgetId}`);

            // Add close button handler
            document.getElementById('close-test-widget').addEventListener('click', () => {
                widgetManager.close(widgetId);
                console.log('✅ Test widget closed');
            });

            return true;
        } catch (error) {
            console.error('❌ Widget creation failed:', error);
            return false;
        }
    }

    // Test 3: Test drag functionality
    function testDragFunctionality() {
        console.log('\n🎯 Testing drag functionality...');
        
        try {
            const widgetManager = window.enhancedWidgetManager || new window.EnhancedWidgetManager();
            const dragManager = widgetManager.dragManager;
            
            if (dragManager) {
                console.log('✅ DragManager is available');
                console.log(`   Config: boundaryPadding=${dragManager.config.boundaryPadding}px`);
                console.log(`   Config: useCSSTransform=${dragManager.config.useCSSTransform}`);
                return true;
            } else {
                console.error('❌ DragManager not initialized');
                return false;
            }
        } catch (error) {
            console.error('❌ Drag test failed:', error);
            return false;
        }
    }

    // Test 4: Test resize functionality
    function testResizeFunctionality() {
        console.log('\n📐 Testing resize functionality...');
        
        try {
            const widgetManager = window.enhancedWidgetManager || new window.EnhancedWidgetManager();
            const resizeManager = widgetManager.resizeManager;
            
            if (resizeManager) {
                console.log('✅ ResizeManager is available');
                console.log(`   Min dimensions: ${resizeManager.minDimensions.width}x${resizeManager.minDimensions.height}`);
                console.log(`   Handles: ${resizeManager.resizeHandles.join(', ')}`);
                return true;
            } else {
                console.error('❌ ResizeManager not initialized');
                return false;
            }
        } catch (error) {
            console.error('❌ Resize test failed:', error);
            return false;
        }
    }

    // Run all tests
    function runAllTests() {
        console.log('='.repeat(50));
        console.log('🚀 WIDGET SYSTEM INTEGRATION TEST SUITE');
        console.log('='.repeat(50));
        
        const results = {
            classAvailability: testClassAvailability(),
            widgetCreation: testWidgetCreation(),
            dragFunctionality: testDragFunctionality(),
            resizeFunctionality: testResizeFunctionality()
        };

        console.log('\n' + '='.repeat(50));
        console.log('📊 TEST RESULTS SUMMARY:');
        console.log('='.repeat(50));
        
        let allPassed = true;
        Object.entries(results).forEach(([test, passed]) => {
            console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
            if (!passed) allPassed = false;
        });

        console.log('='.repeat(50));
        if (allPassed) {
            console.log('🎉 ALL TESTS PASSED! Widget system is working correctly.');
        } else {
            console.log('⚠️ Some tests failed. Check the logs above for details.');
        }
        console.log('='.repeat(50));
    }

    // Wait for page to load before running tests
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(runAllTests, 1000);
        });
    } else {
        setTimeout(runAllTests, 1000);
    }

})();