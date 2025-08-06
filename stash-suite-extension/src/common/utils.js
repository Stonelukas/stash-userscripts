/**
 * Common utility functions for Stash Suite Extension
 */

// Sleep function for delays
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Wait for element with multiple selectors
export async function waitForElement(selectors, timeout = 5000) {
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        for (const selector of selectorArray) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        await sleep(100);
    }
    
    throw new Error(`Elements not found: ${selectorArray.join(', ')}`);
}

// Check if element exists
export function elementExists(selectors) {
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
    return selectorArray.some(selector => document.querySelector(selector) !== null);
}

// Create element with styles
export function createElement(tag, styles = {}, attributes = {}) {
    const element = document.createElement(tag);
    
    // Apply styles
    Object.assign(element.style, styles);
    
    // Apply attributes
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'innerHTML' || key === 'textContent') {
            element[key] = value;
        } else {
            element.setAttribute(key, value);
        }
    });
    
    return element;
}

// Debounce function
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Check if on scene page
export function isScenePage() {
    return window.location.pathname.match(/^\/scenes\/\d+/) && 
           !window.location.pathname.includes('/markers');
}

// Get scene ID from URL
export function getSceneIdFromUrl() {
    const match = window.location.pathname.match(/\/scenes\/(\d+)/);
    return match ? match[1] : null;
}

// Format file size
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Deep clone object
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Notification wrapper that works with both extension API and fallback
export async function showNotification(message, type = 'info', duration = 4000) {
    // Try Chrome extension notification API first
    if (chrome.notifications) {
        try {
            const notificationId = `stash-suite-${Date.now()}`;
            await chrome.notifications.create(notificationId, {
                type: 'basic',
                iconUrl: '/icons/icon-128.png',
                title: 'Stash Suite',
                message: message,
                priority: type === 'error' ? 2 : 1
            });
            
            if (duration > 0) {
                setTimeout(() => {
                    chrome.notifications.clear(notificationId);
                }, duration);
            }
            
            return;
        } catch (error) {
            console.warn('Chrome notifications failed, falling back to DOM notification');
        }
    }
    
    // Fallback to DOM-based notification
    const notification = createElement('div', {
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: '10001',
        background: getNotificationColor(type),
        color: 'white',
        padding: '15px 20px',
        borderRadius: '8px',
        maxWidth: '400px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        fontFamily: '"Segoe UI", sans-serif',
        fontSize: '14px',
        opacity: '0',
        transform: 'translateX(100%)',
        transition: 'all 0.3s ease',
        cursor: 'pointer'
    }, {
        innerHTML: `${getNotificationIcon(type)} ${message}`
    });
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Click to dismiss
    notification.addEventListener('click', () => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    });
    
    // Auto dismiss
    if (duration > 0) {
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }
}

function getNotificationColor(type) {
    const colors = {
        success: 'linear-gradient(135deg, #00c853, #00a846)',
        error: 'linear-gradient(135deg, #d32f2f, #c62828)',
        warning: 'linear-gradient(135deg, #ff9800, #f57c00)',
        info: 'linear-gradient(135deg, #2196f3, #1976d2)'
    };
    return colors[type] || colors.info;
}

function getNotificationIcon(type) {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    return icons[type] || icons.info;
}

// Timing constants
export const TIMING = {
    REACT_RENDER_DELAY: 800,
    ELEMENT_WAIT_TIMEOUT: 8000,
    GRAPHQL_MUTATION_DELAY: 1000,
    SAVE_DELAY: 1500,
    NOTIFICATION_DURATION: 4000,
    DEBOUNCE_DELAY: 500,
    THROTTLE_LIMIT: 1000
};

// DOM observer helper
export function observeDOM(targetNode, callback, options = {}) {
    const config = {
        childList: true,
        subtree: true,
        attributes: false,
        ...options
    };
    
    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
    
    return observer;
}

// Error logging helper
export function logError(context, error) {
    console.error(`[Stash Suite - ${context}]`, error);
    showNotification(`Error in ${context}: ${error.message}`, 'error');
}