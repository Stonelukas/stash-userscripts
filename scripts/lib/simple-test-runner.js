/**
 * Simple test runner for EnhancedWidgetManager
 * Run this file directly in browser console or Node.js with jsdom
 */

(function() {
    'use strict';
    
    // Simple test framework implementation
    const TestRunner = {
        tests: [],
        currentSuite: '',
        results: {
            passed: 0,
            failed: 0,
            errors: []
        },
        
        describe(suiteName, callback) {
            this.currentSuite = suiteName;
            console.group(`📦 ${suiteName}`);
            callback();
            console.groupEnd();
        },
        
        it(testName, callback) {
            try {
                // Setup for each test
                if (typeof this.beforeEachCallback === 'function') {
                    this.beforeEachCallback();
                }
                
                // Run the test
                if (callback.length > 0) {
                    // Async test
                    return new Promise((resolve, reject) => {
                        const done = (error) => {
                            if (error) reject(error);
                            else resolve();
                        };
                        callback(done);
                    }).then(() => {
                        this.results.passed++;
                        console.log(`  ✅ ${testName}`);
                    }).catch(error => {
                        this.results.failed++;
                        this.results.errors.push({suite: this.currentSuite, test: testName, error});
                        console.error(`  ❌ ${testName}`, error.message);
                    });
                } else {
                    // Sync test
                    callback();
                    this.results.passed++;
                    console.log(`  ✅ ${testName}`);
                }
                
                // Cleanup after each test
                if (typeof this.afterEachCallback === 'function') {
                    this.afterEachCallback();
                }
            } catch (error) {
                this.results.failed++;
                this.results.errors.push({suite: this.currentSuite, test: testName, error});
                console.error(`  ❌ ${testName}`, error.message);
            }
        },
        
        beforeEach(callback) {
            this.beforeEachCallback = callback;
        },
        
        afterEach(callback) {
            this.afterEachCallback = callback;
        },
        
        expect(actual) {
            return {
                toBe(expected) {
                    if (actual !== expected) {
                        throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
                    }
                },
                toBeDefined() {
                    if (actual === undefined) {
                        throw new Error(`Expected value to be defined but got undefined`);
                    }
                },
                toBeNull() {
                    if (actual !== null) {
                        throw new Error(`Expected ${JSON.stringify(actual)} to be null`);
                    }
                },
                toBeGreaterThan(expected) {
                    if (!(actual > expected)) {
                        throw new Error(`Expected ${actual} to be greater than ${expected}`);
                    }
                },
                toMatch(pattern) {
                    if (!pattern.test(actual)) {
                        throw new Error(`Expected ${actual} to match ${pattern}`);
                    }
                },
                toThrow(errorType) {
                    let threw = false;
                    let thrownError = null;
                    try {
                        actual();
                    } catch (e) {
                        threw = true;
                        thrownError = e;
                    }
                    if (!threw) {
                        throw new Error(`Expected function to throw but it didn't`);
                    }
                    if (errorType && !(thrownError instanceof errorType)) {
                        throw new Error(`Expected function to throw ${errorType.name} but threw ${thrownError.constructor.name}`);
                    }
                },
                toHaveBeenCalled() {
                    if (!actual.called) {
                        throw new Error(`Expected spy to have been called`);
                    }
                },
                toHaveBeenCalledWith(...args) {
                    if (!actual.calledWith || !actual.calledWith(...args)) {
                        throw new Error(`Expected spy to have been called with ${JSON.stringify(args)}`);
                    }
                },
                not: {
                    toThrow() {
                        let threw = false;
                        try {
                            actual();
                        } catch (e) {
                            threw = true;
                        }
                        if (threw) {
                            throw new Error(`Expected function not to throw but it did`);
                        }
                    }
                }
            };
        },
        
        spyOn(object, method) {
            const original = object[method];
            const spy = function(...args) {
                spy.called = true;
                spy.callCount++;
                spy.lastArgs = args;
                if (spy.returnValue !== undefined) {
                    return spy.returnValue;
                }
                return original.apply(object, args);
            };
            spy.called = false;
            spy.callCount = 0;
            spy.and = {
                returnValue(value) {
                    spy.returnValue = value;
                    return spy;
                }
            };
            object[method] = spy;
            return spy;
        },
        
        async runTests() {
            console.log('🧪 Running Enhanced Widget Manager Tests...\n');
            
            // Load the implementation
            if (typeof window !== 'undefined' && !window.EnhancedWidgetManager) {
                console.error('❌ EnhancedWidgetManager not loaded. Please load enhanced-widget-manager.js first.');
                return;
            }
            
            // Make test functions global
            window.describe = this.describe.bind(this);
            window.it = this.it.bind(this);
            window.beforeEach = this.beforeEach.bind(this);
            window.afterEach = this.afterEach.bind(this);
            window.expect = this.expect.bind(this);
            window.spyOn = this.spyOn.bind(this);
            
            // Run selected test suites
            this.runInitializationTests();
            this.runRegistrationTests();
            this.runFocusTests();
            this.runConfigTests();
            
            // Print summary
            this.printSummary();
        },
        
        runInitializationTests() {
            describe('Initialization', () => {
                let manager;
                
                beforeEach(() => {
                    window.mockStorage = {};
                    manager = new window.EnhancedWidgetManager();
                });
                
                it('should initialize with default configuration', () => {
                    expect(manager.initialized).toBe(true);
                    expect(manager.config.enableResize).toBe(true);
                    expect(manager.config.defaultSize.width).toBe(400);
                });
                
                it('should initialize sub-managers', () => {
                    expect(manager.eventBus).toBeDefined();
                });
            });
        },
        
        runRegistrationTests() {
            describe('Widget Registration', () => {
                let manager, element;
                
                beforeEach(() => {
                    window.mockStorage = {};
                    manager = new window.EnhancedWidgetManager();
                    element = document.createElement('div');
                    document.body.appendChild(element);
                });
                
                afterEach(() => {
                    if (element && element.parentNode) {
                        element.remove();
                    }
                });
                
                it('should register a widget with valid options', () => {
                    const widgetId = manager.registerWidget({
                        element: element,
                        resizable: true
                    });
                    expect(widgetId).toBeDefined();
                    expect(manager.getWidget(widgetId)).toBeDefined();
                });
                
                it('should throw error for missing element', () => {
                    expect(() => manager.registerWidget({})).toThrow(window.WidgetValidationError);
                });
            });
        },
        
        runFocusTests() {
            describe('Widget Focus Management', () => {
                let manager, element;
                
                beforeEach(() => {
                    window.mockStorage = {};
                    manager = new window.EnhancedWidgetManager();
                    element = document.createElement('div');
                    document.body.appendChild(element);
                });
                
                afterEach(() => {
                    if (element && element.parentNode) {
                        element.remove();
                    }
                });
                
                it('should bring widget to front', () => {
                    const widgetId = manager.registerWidget({ element });
                    manager.bringToFront(widgetId);
                    expect(manager.activeWidget.id).toBe(widgetId);
                });
            });
        },
        
        runConfigTests() {
            describe('Configuration Management', () => {
                let manager;
                
                beforeEach(() => {
                    window.mockStorage = {};
                    manager = new window.EnhancedWidgetManager();
                });
                
                it('should update configuration', () => {
                    manager.updateConfiguration({ enableResize: false });
                    expect(manager.config.enableResize).toBe(false);
                });
            });
        },
        
        printSummary() {
            console.log('\n' + '='.repeat(50));
            console.log('📊 Test Results Summary');
            console.log('='.repeat(50));
            console.log(`✅ Passed: ${this.results.passed}`);
            console.log(`❌ Failed: ${this.results.failed}`);
            console.log(`📈 Total: ${this.results.passed + this.results.failed}`);
            console.log(`✨ Success Rate: ${Math.round((this.results.passed / (this.results.passed + this.results.failed)) * 100)}%`);
            
            if (this.results.errors.length > 0) {
                console.log('\n❌ Failed Tests:');
                this.results.errors.forEach(({suite, test, error}) => {
                    console.log(`  ${suite} > ${test}: ${error.message}`);
                });
            }
            
            console.log('='.repeat(50));
        }
    };
    
    // Auto-run if in browser
    if (typeof window !== 'undefined') {
        window.TestRunner = TestRunner;
        console.log('Test runner loaded. Run TestRunner.runTests() to start.');
        console.log('Make sure enhanced-widget-manager.js is loaded first!');
    }
    
    // Export for Node.js
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TestRunner;
    }
})();