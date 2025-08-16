// ==UserScript==
// @name         UI Theme Manager for AutomateStash
// @version      1.0.0
// @description  Modern theming system with dark/light modes and custom themes
// @author       AutomateStash Team
// ==/UserScript==

(function() {
    'use strict';

    /**
     * ThemeManager - Dynamic theming system with CSS custom properties
     * Provides dark/light modes, custom themes, and system preference detection
     */
    class ThemeManager {
        constructor() {
            this.themes = {
                dark: {
                    name: 'Dark Mode',
                    primary: '#667eea',
                    secondary: '#764ba2',
                    accent: '#3498db',
                    background: '#2c3e50',
                    surface: '#34495e',
                    text: '#ecf0f1',
                    textSecondary: '#bdc3c7',
                    success: '#27ae60',
                    warning: '#f39c12',
                    error: '#e74c3c',
                    info: '#3498db',
                    border: 'rgba(255,255,255,0.1)',
                    shadow: 'rgba(0,0,0,0.3)',
                    overlay: 'rgba(0,0,0,0.7)'
                },
                light: {
                    name: 'Light Mode',
                    primary: '#5e72e4',
                    secondary: '#825ee4',
                    accent: '#2dce89',
                    background: '#f7f8fc',
                    surface: '#ffffff',
                    text: '#32325d',
                    textSecondary: '#8898aa',
                    success: '#2dce89',
                    warning: '#fb6340',
                    error: '#f5365c',
                    info: '#11cdef',
                    border: 'rgba(0,0,0,0.05)',
                    shadow: 'rgba(0,0,0,0.1)',
                    overlay: 'rgba(255,255,255,0.9)'
                },
                midnight: {
                    name: 'Midnight',
                    primary: '#6366f1',
                    secondary: '#8b5cf6',
                    accent: '#ec4899',
                    background: '#0f172a',
                    surface: '#1e293b',
                    text: '#f1f5f9',
                    textSecondary: '#94a3b8',
                    success: '#10b981',
                    warning: '#f59e0b',
                    error: '#ef4444',
                    info: '#06b6d4',
                    border: 'rgba(148,163,184,0.1)',
                    shadow: 'rgba(0,0,0,0.5)',
                    overlay: 'rgba(15,23,42,0.9)'
                },
                ocean: {
                    name: 'Ocean',
                    primary: '#0891b2',
                    secondary: '#0e7490',
                    accent: '#06b6d4',
                    background: '#082f49',
                    surface: '#0c4a6e',
                    text: '#e0f2fe',
                    textSecondary: '#7dd3fc',
                    success: '#10b981',
                    warning: '#fbbf24',
                    error: '#f87171',
                    info: '#38bdf8',
                    border: 'rgba(125,211,252,0.1)',
                    shadow: 'rgba(0,0,0,0.4)',
                    overlay: 'rgba(8,47,73,0.9)'
                }
            };

            this.currentTheme = null;
            this.styleElement = null;
            this.systemPreference = null;
            this.customThemes = {};
            this.callbacks = [];

            // Load saved theme or detect system preference
            this.loadSavedTheme();
            this.detectSystemPreference();
            this.injectStyles();
        }

        /**
         * Load saved theme from storage
         */
        loadSavedTheme() {
            if (typeof GM_getValue !== 'undefined') {
                const savedTheme = GM_getValue('ui_theme', 'dark');
                const savedCustomThemes = GM_getValue('ui_custom_themes', '{}');
                
                try {
                    this.customThemes = JSON.parse(savedCustomThemes);
                } catch (e) {
                    this.customThemes = {};
                }

                this.currentTheme = savedTheme;
            } else {
                this.currentTheme = 'dark';
            }
        }

        /**
         * Save current theme to storage
         */
        saveTheme() {
            if (typeof GM_setValue !== 'undefined') {
                GM_setValue('ui_theme', this.currentTheme);
                GM_setValue('ui_custom_themes', JSON.stringify(this.customThemes));
            }
        }

        /**
         * Detect system color scheme preference
         */
        detectSystemPreference() {
            if (window.matchMedia) {
                const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
                this.systemPreference = darkModeQuery.matches ? 'dark' : 'light';

                // Listen for changes
                darkModeQuery.addEventListener('change', (e) => {
                    this.systemPreference = e.matches ? 'dark' : 'light';
                    if (this.currentTheme === 'system') {
                        this.applyTheme('system');
                    }
                });
            }
        }

        /**
         * Inject CSS custom properties and base styles
         */
        injectStyles() {
            if (this.styleElement) {
                this.styleElement.remove();
            }

            this.styleElement = document.createElement('style');
            this.styleElement.id = 'automatestash-theme-styles';
            
            // Base styles with CSS custom properties
            this.styleElement.textContent = `
                :root {
                    /* Theme colors will be injected here */
                }

                /* Smooth theme transitions */
                * {
                    transition: background-color 0.3s ease, 
                                color 0.3s ease, 
                                border-color 0.3s ease,
                                box-shadow 0.3s ease;
                }

                /* Respect reduced motion preference */
                @media (prefers-reduced-motion: reduce) {
                    * {
                        transition: none !important;
                    }
                }

                /* AutomateStash themed components */
                .as-themed-panel {
                    background: var(--as-background);
                    color: var(--as-text);
                    border: 1px solid var(--as-border);
                    box-shadow: 0 10px 40px var(--as-shadow);
                }

                .as-themed-button {
                    background: var(--as-primary);
                    color: var(--as-text);
                    border: 1px solid var(--as-border);
                    transition: all 0.2s ease;
                }

                .as-themed-button:hover {
                    background: var(--as-secondary);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px var(--as-shadow);
                }

                .as-themed-surface {
                    background: var(--as-surface);
                    color: var(--as-text);
                    border: 1px solid var(--as-border);
                }

                .as-themed-success {
                    background: var(--as-success);
                    color: white;
                }

                .as-themed-warning {
                    background: var(--as-warning);
                    color: white;
                }

                .as-themed-error {
                    background: var(--as-error);
                    color: white;
                }

                .as-themed-info {
                    background: var(--as-info);
                    color: white;
                }
            `;

            document.head.appendChild(this.styleElement);
            
            // Apply the current theme
            this.applyTheme(this.currentTheme);
        }

        /**
         * Apply a theme by name
         * @param {string} themeName - Name of the theme to apply
         */
        applyTheme(themeName) {
            let theme;

            if (themeName === 'system') {
                theme = this.themes[this.systemPreference || 'dark'];
            } else if (this.themes[themeName]) {
                theme = this.themes[themeName];
            } else if (this.customThemes[themeName]) {
                theme = this.customThemes[themeName];
            } else {
                console.warn(`Theme "${themeName}" not found, falling back to dark`);
                theme = this.themes.dark;
                themeName = 'dark';
            }

            this.currentTheme = themeName;
            this.saveTheme();

            // Update CSS custom properties
            const root = document.documentElement;
            Object.entries(theme).forEach(([key, value]) => {
                if (key !== 'name') {
                    root.style.setProperty(`--as-${key}`, value);
                }
            });

            // Notify callbacks
            this.notifyCallbacks(themeName, theme);
        }

        /**
         * Get current theme
         * @returns {Object} Current theme object
         */
        getCurrentTheme() {
            if (this.currentTheme === 'system') {
                return this.themes[this.systemPreference || 'dark'];
            }
            return this.themes[this.currentTheme] || 
                   this.customThemes[this.currentTheme] || 
                   this.themes.dark;
        }

        /**
         * Get all available themes
         * @returns {Object} All themes including custom ones
         */
        getAllThemes() {
            return {
                ...this.themes,
                ...this.customThemes,
                system: { name: 'System Default' }
            };
        }

        /**
         * Create a custom theme
         * @param {string} name - Theme name
         * @param {Object} colors - Theme colors
         */
        createCustomTheme(name, colors) {
            const baseTheme = this.themes.dark;
            const customTheme = {
                name: name,
                ...baseTheme,
                ...colors
            };

            this.customThemes[name] = customTheme;
            this.saveTheme();
            return customTheme;
        }

        /**
         * Delete a custom theme
         * @param {string} name - Theme name to delete
         */
        deleteCustomTheme(name) {
            if (this.customThemes[name]) {
                delete this.customThemes[name];
                this.saveTheme();
                
                // Switch to dark theme if the deleted theme was active
                if (this.currentTheme === name) {
                    this.applyTheme('dark');
                }
                return true;
            }
            return false;
        }

        /**
         * Toggle between dark and light themes
         */
        toggle() {
            const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
            this.applyTheme(newTheme);
        }

        /**
         * Register a callback for theme changes
         * @param {Function} callback - Function to call when theme changes
         */
        onThemeChange(callback) {
            this.callbacks.push(callback);
        }

        /**
         * Remove a theme change callback
         * @param {Function} callback - Callback to remove
         */
        removeCallback(callback) {
            const index = this.callbacks.indexOf(callback);
            if (index > -1) {
                this.callbacks.splice(index, 1);
            }
        }

        /**
         * Notify all callbacks of theme change
         * @param {string} themeName - Name of the new theme
         * @param {Object} theme - Theme object
         */
        notifyCallbacks(themeName, theme) {
            this.callbacks.forEach(callback => {
                try {
                    callback(themeName, theme);
                } catch (error) {
                    console.error('Error in theme change callback:', error);
                }
            });
        }

        /**
         * Create theme selector UI
         * @returns {HTMLElement} Theme selector element
         */
        createThemeSelector() {
            const selector = document.createElement('div');
            selector.className = 'as-theme-selector';
            selector.style.cssText = `
                display: flex;
                gap: 10px;
                padding: 10px;
                background: var(--as-surface);
                border-radius: 8px;
                border: 1px solid var(--as-border);
            `;

            const label = document.createElement('label');
            label.textContent = 'Theme: ';
            label.style.cssText = `
                color: var(--as-text);
                font-size: 14px;
                display: flex;
                align-items: center;
            `;

            const select = document.createElement('select');
            select.style.cssText = `
                background: var(--as-background);
                color: var(--as-text);
                border: 1px solid var(--as-border);
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 14px;
                cursor: pointer;
            `;

            // Populate themes
            const allThemes = this.getAllThemes();
            Object.entries(allThemes).forEach(([key, theme]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = theme.name;
                if (key === this.currentTheme) {
                    option.selected = true;
                }
                select.appendChild(option);
            });

            // Handle theme change
            select.addEventListener('change', (e) => {
                this.applyTheme(e.target.value);
            });

            selector.appendChild(label);
            selector.appendChild(select);

            return selector;
        }

        /**
         * Apply theme to specific element
         * @param {HTMLElement} element - Element to theme
         * @param {string} type - Theme type (panel, button, surface, etc.)
         */
        applyToElement(element, type = 'panel') {
            element.classList.add(`as-themed-${type}`);
        }

        /**
         * Remove theme from element
         * @param {HTMLElement} element - Element to untheme
         * @param {string} type - Theme type to remove
         */
        removeFromElement(element, type = 'panel') {
            element.classList.remove(`as-themed-${type}`);
        }
    }

    // Export for use in AutomateStash
    if (typeof window !== 'undefined') {
        window.ThemeManager = ThemeManager;
        
        // Auto-initialize if DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                window.themeManager = new ThemeManager();
            });
        } else {
            window.themeManager = new ThemeManager();
        }
    }

})();