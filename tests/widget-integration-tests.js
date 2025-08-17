// Widget Integration Tests
// Run these tests by opening http://localhost:9998/?test=widgets

/**
 * Widget Integration Test Suite
 */
class WidgetIntegrationTests {
    constructor() {
        this.tests = [];
        this.results = [];
        this.setupTests();
    }

    setupTests() {
        // Test 1: Check if UIManager exists
        this.addTest('UIManager should exist', () => {
            if (!window.uiManager) {
                throw new Error('UIManager not found');
            }
            if (typeof window.uiManager !== 'object') {
                throw new Error('UIManager is not an object');
            }
        });

        // Test 2: Check if EnhancedWidgetManager is available
        this.addTest('EnhancedWidgetManager should be available', () => {
            if (!window.EnhancedWidgetManager) {
                throw new Error('EnhancedWidgetManager class not found');
            }
            if (typeof window.EnhancedWidgetManager !== 'function') {
                throw new Error('EnhancedWidgetManager is not a constructor');
            }
        });

        // Test 3: Check if WidgetManagerIntegration is available
        this.addTest('WidgetManagerIntegration should be available', () => {
            if (!window.WidgetManagerIntegration) {
                throw new Error('WidgetManagerIntegration class not found');
            }
            if (typeof window.WidgetManagerIntegration !== 'function') {
                throw new Error('WidgetManagerIntegration is not a constructor');
            }
        });

        // Test 4: Verify integration is initialized
        this.addTest('Widget integration should be initialized', () => {
            const uiManager = window.uiManager;
            if (!uiManager) {
                throw new Error('UIManager not found');
            }
            
            if (uiManager.widgetIntegration) {
                if (!(uiManager.widgetIntegration instanceof window.WidgetManagerIntegration)) {
                    throw new Error('Invalid integration instance');
                }
                if (!uiManager.widgetIntegration.initialized) {
                    throw new Error('Integration not initialized');
                }
            } else {
                console.warn('Widget integration not found, may be in legacy mode');
            }
        });

        // Test 5: Test widget registration
        this.addTest('Widget registration should work', () => {
            const testWidget = document.createElement('div');
            testWidget.id = 'test-widget';
            testWidget.style.cssText = 'width: 300px; height: 200px; background: #333;';
            testWidget.innerHTML = '<div>Test Widget</div>';
            document.body.appendChild(testWidget);

            const uiManager = window.uiManager;
            if (uiManager && uiManager.registerWidget) {
                uiManager.registerWidget(testWidget, 'test-widget');
                
                if (!uiManager.widgets.has('test-widget')) {
                    testWidget.remove();
                    throw new Error('Widget not registered in UIManager');
                }
                
                if (uiManager.widgetIntegration && uiManager.widgetIntegration.enhancedManager) {
                    const widgetId = uiManager.widgetIntegration.widgetMap.get('test-widget');
                    if (!widgetId) {
                        testWidget.remove();
                        throw new Error('Widget not registered in EnhancedWidgetManager');
                    }
                }
            }

            testWidget.remove();
        });

        // Test 6: Test draggable functionality
        this.addTest('Draggable functionality should be applied', () => {
            const testWidget = document.createElement('div');
            testWidget.id = 'test-draggable';
            testWidget.innerHTML = '<div>Header</div><div>Content</div>';
            document.body.appendChild(testWidget);

            const header = testWidget.querySelector('div');
            const uiManager = window.uiManager;
            
            if (uiManager && uiManager.makeDraggable) {
                uiManager.makeDraggable(header, testWidget, 'test');
            }

            testWidget.remove();
        });

        // Test 7: Test z-index management
        this.addTest('Z-index management should work', () => {
            const widget1 = document.createElement('div');
            widget1.id = 'test-z1';
            widget1.style.cssText = 'position: fixed; width: 100px; height: 100px;';
            
            const widget2 = document.createElement('div');
            widget2.id = 'test-z2';
            widget2.style.cssText = 'position: fixed; width: 100px; height: 100px;';
            
            document.body.appendChild(widget1);
            document.body.appendChild(widget2);

            const uiManager = window.uiManager;
            if (uiManager && uiManager.bringToFront) {
                uiManager.registerWidget(widget1, 'z1');
                uiManager.registerWidget(widget2, 'z2');
                
                uiManager.bringToFront(widget2);
                
                const z1 = parseInt(widget1.style.zIndex || '0');
                const z2 = parseInt(widget2.style.zIndex || '0');
                
                if (!(z2 > z1 || z2 > 0)) {
                    widget1.remove();
                    widget2.remove();
                    throw new Error('Z-index not properly managed');
                }
            }

            widget1.remove();
            widget2.remove();
        });

        // Test 8: Test enhanced methods availability
        this.addTest('Enhanced methods should be available on UIManager', () => {
            const uiManager = window.uiManager;
            
            if (uiManager && uiManager.widgetIntegration) {
                const methods = [
                    'minimizeWidget',
                    'restoreWidget',
                    'resizeWidget',
                    'applyThemeToWidgets',
                    'registerWidgetShortcut'
                ];
                
                for (const method of methods) {
                    if (typeof uiManager[method] !== 'function') {
                        throw new Error(`${method} method not found`);
                    }
                }
            } else {
                console.warn('Enhanced methods test skipped - integration not available');
            }
        });

        // Test 9: Test resize handles
        this.addTest('Resize handles should be added to widgets', () => {
            const testWidget = document.createElement('div');
            testWidget.id = 'test-resize';
            testWidget.style.cssText = 'position: fixed; width: 300px; height: 200px;';
            document.body.appendChild(testWidget);

            const uiManager = window.uiManager;
            if (uiManager && uiManager.registerWidget) {
                uiManager.registerWidget(testWidget, 'test-resize');
                
                const handles = testWidget.querySelectorAll('.resize-handle');
                if (handles.length === 0) {
                    testWidget.remove();
                    throw new Error('No resize handles found');
                }
                
                if (handles.length !== 8) {
                    testWidget.remove();
                    throw new Error(`Expected 8 resize handles, found ${handles.length}`);
                }
            }

            testWidget.remove();
        });

        // Test 10: Test integration status
        this.addTest('Integration status should be retrievable', () => {
            const uiManager = window.uiManager;
            
            if (uiManager && uiManager.widgetIntegration) {
                const status = uiManager.widgetIntegration.getStatus();
                
                if (!status) {
                    throw new Error('Status not available');
                }
                
                if (typeof status.initialized !== 'boolean') {
                    throw new Error('Invalid status structure');
                }
            }
        });
    }

    addTest(name, testFn) {
        this.tests.push({ name, testFn });
    }

    async runAll() {
        console.log('🧪 Starting Widget Integration Tests...');
        console.log('=' . repeat(50));

        for (const test of this.tests) {
            await this.runTest(test);
        }

        this.printResults();
        return this.results;
    }

    async runTest(test) {
        console.log(`\n📝 Running: ${test.name}`);
        
        try {
            const startTime = performance.now();
            await test.testFn();
            const duration = performance.now() - startTime;
            
            test.status = 'passed';
            test.duration = duration;
            console.log(`✅ PASSED (${duration.toFixed(2)}ms)`);
            
        } catch (error) {
            test.status = 'failed';
            test.error = error;
            console.error(`❌ FAILED: ${error.message}`);
        }
        
        this.results.push({
            name: test.name,
            status: test.status,
            duration: test.duration,
            error: test.error
        });
    }

    printResults() {
        console.log('\n' + '=' . repeat(50));
        console.log('📊 Test Results Summary:');
        console.log('=' . repeat(50));

        const passed = this.results.filter(r => r.status === 'passed').length;
        const failed = this.results.filter(r => r.status === 'failed').length;
        const total = this.results.length;

        console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
        
        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results.filter(r => r.status === 'failed').forEach(result => {
                console.log(`  - ${result.name}: ${result.error?.message}`);
            });
        }

        const passRate = total > 0 ? (passed / total * 100).toFixed(1) : 0;
        console.log(`\n🎯 Pass Rate: ${passRate}%`);
    }
}

// Auto-run tests if in development mode
if (typeof window !== 'undefined') {
    window.WidgetIntegrationTests = WidgetIntegrationTests;
    
    // Run tests when URL contains test parameter
    if (window.location.search.includes('test=widgets')) {
        console.log('🚀 Auto-running widget integration tests...');
        setTimeout(() => {
            const tests = new WidgetIntegrationTests();
            tests.runAll().then(results => {
                console.log('✅ Tests completed');
                window.testResults = results;
            });
        }, 3000); // Wait for page and scripts to load
    }
}