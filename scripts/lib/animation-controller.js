// ==UserScript==
// @name         Animation Controller for AutomateStash
// @version      1.0.0
// @description  Performance-optimized animation system with smooth transitions and micro-interactions
// @author       AutomateStash Team
// ==/UserScript==

(function() {
    'use strict';

    /**
     * AnimationController - Centralized animation management system
     * Provides smooth, performant animations with reduced motion support
     */
    class AnimationController {
        constructor() {
            this.animations = new Map();
            this.runningAnimations = new Set();
            this.prefersReducedMotion = false;
            this.defaultEasing = {
                linear: 'linear',
                ease: 'ease',
                easeIn: 'ease-in',
                easeOut: 'ease-out',
                easeInOut: 'ease-in-out',
                easeInQuad: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
                easeOutQuad: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                easeInOutQuad: 'cubic-bezier(0.455, 0.03, 0.515, 0.955)',
                easeInCubic: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
                easeOutCubic: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
                easeInOutCubic: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
                easeInQuart: 'cubic-bezier(0.895, 0.03, 0.685, 0.22)',
                easeOutQuart: 'cubic-bezier(0.165, 0.84, 0.44, 1)',
                easeInOutQuart: 'cubic-bezier(0.77, 0, 0.175, 1)',
                easeInQuint: 'cubic-bezier(0.755, 0.05, 0.855, 0.06)',
                easeOutQuint: 'cubic-bezier(0.23, 1, 0.32, 1)',
                easeInOutQuint: 'cubic-bezier(0.86, 0, 0.07, 1)',
                easeInExpo: 'cubic-bezier(0.95, 0.05, 0.795, 0.035)',
                easeOutExpo: 'cubic-bezier(0.19, 1, 0.22, 1)',
                easeInOutExpo: 'cubic-bezier(1, 0, 0, 1)',
                spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
            };
            
            this.initialize();
        }

        /**
         * Initialize animation controller
         */
        initialize() {
            // Check for reduced motion preference
            this.checkReducedMotion();
            
            // Watch for preference changes
            if (window.matchMedia) {
                const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
                mediaQuery.addEventListener('change', () => {
                    this.checkReducedMotion();
                });
            }
            
            // Setup RAF loop for custom animations
            this.setupAnimationLoop();
            
            // Inject base animation styles
            this.injectAnimationStyles();
            
            console.log('🎬 Animation controller initialized');
        }

        /**
         * Check if user prefers reduced motion
         */
        checkReducedMotion() {
            if (window.matchMedia) {
                this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            }
        }

        /**
         * Setup animation loop using requestAnimationFrame
         */
        setupAnimationLoop() {
            const loop = () => {
                if (this.runningAnimations.size > 0) {
                    this.runningAnimations.forEach(animation => {
                        if (animation && typeof animation.update === 'function') {
                            animation.update();
                        }
                    });
                }
                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        }

        /**
         * Inject CSS animation styles
         */
        injectAnimationStyles() {
            const style = document.createElement('style');
            style.id = 'automatestash-animations';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                
                @keyframes slideInLeft {
                    from { transform: translateX(-100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                
                @keyframes slideOutLeft {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(-100%); opacity: 0; }
                }
                
                @keyframes slideInUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                
                @keyframes slideOutDown {
                    from { transform: translateY(0); opacity: 1; }
                    to { transform: translateY(100%); opacity: 0; }
                }
                
                @keyframes scaleIn {
                    from { transform: scale(0); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                
                @keyframes scaleOut {
                    from { transform: scale(1); opacity: 1; }
                    to { transform: scale(0); opacity: 0; }
                }
                
                @keyframes rotateIn {
                    from { transform: rotate(-180deg) scale(0); opacity: 0; }
                    to { transform: rotate(0) scale(1); opacity: 1; }
                }
                
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
                    20%, 40%, 60%, 80% { transform: translateX(2px); }
                }
                
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                
                @keyframes bounce {
                    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-10px); }
                    60% { transform: translateY(-5px); }
                }
                
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                
                .as-animated {
                    animation-fill-mode: both;
                }
                
                .as-animated.infinite {
                    animation-iteration-count: infinite;
                }
                
                /* Reduced motion overrides */
                @media (prefers-reduced-motion: reduce) {
                    .as-animated {
                        animation-duration: 0.01ms !important;
                        animation-iteration-count: 1 !important;
                        transition-duration: 0.01ms !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        /**
         * Animate element with CSS animation
         */
        animate(element, animationName, options = {}) {
            if (!element) return Promise.reject('No element provided');
            
            // Skip animation if reduced motion is preferred
            if (this.prefersReducedMotion && !options.force) {
                if (options.onComplete) options.onComplete();
                return Promise.resolve();
            }
            
            return new Promise((resolve) => {
                const {
                    duration = 300,
                    easing = 'ease',
                    delay = 0,
                    direction = 'normal',
                    fillMode = 'both',
                    iterationCount = 1,
                    onComplete = null,
                    className = 'as-animated'
                } = options;
                
                // Build animation CSS
                const animationCSS = `${animationName} ${duration}ms ${this.getEasing(easing)} ${delay}ms ${iterationCount} ${direction} ${fillMode}`;
                
                // Apply animation
                element.style.animation = animationCSS;
                element.classList.add(className);
                
                if (iterationCount === 'infinite') {
                    element.classList.add('infinite');
                }
                
                // Handle completion
                const handleComplete = () => {
                    element.removeEventListener('animationend', handleComplete);
                    
                    if (iterationCount !== 'infinite') {
                        element.style.animation = '';
                        element.classList.remove(className, 'infinite');
                    }
                    
                    if (onComplete) onComplete();
                    resolve();
                };
                
                if (iterationCount !== 'infinite') {
                    element.addEventListener('animationend', handleComplete);
                } else {
                    // For infinite animations, resolve immediately
                    resolve();
                }
            });
        }

        /**
         * Transition element properties
         */
        transition(element, properties, options = {}) {
            if (!element) return Promise.reject('No element provided');
            
            // Skip transition if reduced motion is preferred
            if (this.prefersReducedMotion && !options.force) {
                Object.assign(element.style, properties);
                if (options.onComplete) options.onComplete();
                return Promise.resolve();
            }
            
            return new Promise((resolve) => {
                const {
                    duration = 300,
                    easing = 'ease',
                    delay = 0,
                    onComplete = null
                } = options;
                
                // Store original transition
                const originalTransition = element.style.transition;
                
                // Build transition CSS
                const transitionProps = Object.keys(properties)
                    .map(prop => `${this.kebabCase(prop)} ${duration}ms ${this.getEasing(easing)} ${delay}ms`)
                    .join(', ');
                
                element.style.transition = transitionProps;
                
                // Force reflow
                element.offsetHeight;
                
                // Apply properties
                Object.assign(element.style, properties);
                
                // Handle completion
                const handleComplete = () => {
                    element.removeEventListener('transitionend', handleComplete);
                    element.style.transition = originalTransition;
                    
                    if (onComplete) onComplete();
                    resolve();
                };
                
                element.addEventListener('transitionend', handleComplete);
                
                // Fallback timeout
                setTimeout(handleComplete, duration + delay + 50);
            });
        }

        /**
         * Create custom animation using RAF
         */
        createCustomAnimation(options) {
            const {
                duration = 1000,
                easing = 'easeInOut',
                onUpdate,
                onComplete,
                from = 0,
                to = 1
            } = options;
            
            if (this.prefersReducedMotion && !options.force) {
                if (onUpdate) onUpdate(to);
                if (onComplete) onComplete();
                return { stop: () => {} };
            }
            
            const startTime = performance.now();
            const easingFunc = this.getEasingFunction(easing);
            let animationId = null;
            let stopped = false;
            
            const animation = {
                update: () => {
                    if (stopped) {
                        this.runningAnimations.delete(animation);
                        return;
                    }
                    
                    const currentTime = performance.now();
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const easedProgress = easingFunc(progress);
                    const value = from + (to - from) * easedProgress;
                    
                    if (onUpdate) onUpdate(value, progress);
                    
                    if (progress >= 1) {
                        this.runningAnimations.delete(animation);
                        if (onComplete) onComplete();
                    }
                },
                stop: () => {
                    stopped = true;
                    this.runningAnimations.delete(animation);
                }
            };
            
            this.runningAnimations.add(animation);
            return animation;
        }

        /**
         * Stagger animations on multiple elements
         */
        stagger(elements, animationName, options = {}) {
            const {
                staggerDelay = 50,
                ...animOptions
            } = options;
            
            const promises = Array.from(elements).map((element, index) => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        this.animate(element, animationName, animOptions).then(resolve);
                    }, index * staggerDelay);
                });
            });
            
            return Promise.all(promises);
        }

        /**
         * Chain multiple animations
         */
        async chain(element, animations) {
            for (const { name, options } of animations) {
                await this.animate(element, name, options);
            }
        }

        /**
         * Parallel animations on same element
         */
        parallel(element, animations) {
            const promises = animations.map(({ name, options }) => {
                return this.animate(element, name, options);
            });
            return Promise.all(promises);
        }

        /**
         * Common UI animations
         */
        
        fadeIn(element, duration = 300) {
            return this.animate(element, 'fadeIn', { duration });
        }
        
        fadeOut(element, duration = 300) {
            return this.animate(element, 'fadeOut', { duration });
        }
        
        slideIn(element, direction = 'right', duration = 300) {
            const animName = `slideIn${direction.charAt(0).toUpperCase() + direction.slice(1)}`;
            return this.animate(element, animName, { duration, easing: 'easeOut' });
        }
        
        slideOut(element, direction = 'right', duration = 300) {
            const animName = `slideOut${direction.charAt(0).toUpperCase() + direction.slice(1)}`;
            return this.animate(element, animName, { duration, easing: 'easeIn' });
        }
        
        scaleIn(element, duration = 300) {
            return this.animate(element, 'scaleIn', { duration, easing: 'spring' });
        }
        
        scaleOut(element, duration = 300) {
            return this.animate(element, 'scaleOut', { duration, easing: 'easeIn' });
        }
        
        shake(element, duration = 500) {
            return this.animate(element, 'shake', { duration });
        }
        
        pulse(element, options = {}) {
            return this.animate(element, 'pulse', {
                duration: 1000,
                iterationCount: options.infinite ? 'infinite' : 3,
                ...options
            });
        }
        
        bounce(element, options = {}) {
            return this.animate(element, 'bounce', {
                duration: 1000,
                iterationCount: options.infinite ? 'infinite' : 1,
                ...options
            });
        }
        
        spin(element, options = {}) {
            return this.animate(element, 'spin', {
                duration: 1000,
                iterationCount: options.infinite ? 'infinite' : 1,
                easing: 'linear',
                ...options
            });
        }

        /**
         * Progress animations
         */
        
        animateProgress(element, from, to, duration = 1000) {
            return this.createCustomAnimation({
                from,
                to,
                duration,
                easing: 'easeOut',
                onUpdate: (value) => {
                    element.style.width = `${value}%`;
                    if (element.dataset.showValue) {
                        element.textContent = `${Math.round(value)}%`;
                    }
                }
            });
        }
        
        animateCounter(element, from, to, duration = 1000) {
            return this.createCustomAnimation({
                from,
                to,
                duration,
                easing: 'easeOut',
                onUpdate: (value) => {
                    element.textContent = Math.round(value).toLocaleString();
                }
            });
        }

        /**
         * Micro-interactions
         */
        
        addHoverEffect(element, scale = 1.05) {
            element.style.transition = 'transform 0.2s ease';
            
            element.addEventListener('mouseenter', () => {
                if (!this.prefersReducedMotion) {
                    element.style.transform = `scale(${scale})`;
                }
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.transform = 'scale(1)';
            });
        }
        
        addClickEffect(element) {
            element.addEventListener('click', () => {
                if (!this.prefersReducedMotion) {
                    element.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        element.style.transform = 'scale(1)';
                    }, 100);
                }
            });
        }
        
        addRippleEffect(element) {
            element.style.position = 'relative';
            element.style.overflow = 'hidden';
            
            element.addEventListener('click', (e) => {
                if (this.prefersReducedMotion) return;
                
                const rect = element.getBoundingClientRect();
                const ripple = document.createElement('span');
                const size = Math.max(rect.width, rect.height);
                
                ripple.style.cssText = `
                    position: absolute;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.5);
                    width: ${size}px;
                    height: ${size}px;
                    left: ${e.clientX - rect.left - size/2}px;
                    top: ${e.clientY - rect.top - size/2}px;
                    transform: scale(0);
                    pointer-events: none;
                `;
                
                element.appendChild(ripple);
                
                this.animate(ripple, 'scaleIn', {
                    duration: 600,
                    onComplete: () => {
                        this.fadeOut(ripple, 200).then(() => {
                            ripple.remove();
                        });
                    }
                });
            });
        }

        /**
         * Loading animations
         */
        
        createSpinner(options = {}) {
            const {
                size = 40,
                color = '#667eea',
                strokeWidth = 4
            } = options;
            
            const spinner = document.createElement('div');
            spinner.className = 'as-spinner';
            spinner.style.cssText = `
                width: ${size}px;
                height: ${size}px;
                border: ${strokeWidth}px solid rgba(0, 0, 0, 0.1);
                border-top-color: ${color};
                border-radius: 50%;
            `;
            
            this.spin(spinner, { infinite: true });
            
            return spinner;
        }
        
        createShimmer(element) {
            element.style.background = `
                linear-gradient(
                    90deg,
                    rgba(255, 255, 255, 0) 0%,
                    rgba(255, 255, 255, 0.2) 50%,
                    rgba(255, 255, 255, 0) 100%
                )
            `;
            element.style.backgroundSize = '200% 100%';
            
            return this.animate(element, 'shimmer', {
                duration: 1500,
                iterationCount: 'infinite',
                easing: 'linear'
            });
        }

        /**
         * Utility functions
         */
        
        getEasing(easing) {
            return this.defaultEasing[easing] || easing;
        }
        
        getEasingFunction(easing) {
            const easingFunctions = {
                linear: t => t,
                easeIn: t => t * t,
                easeOut: t => t * (2 - t),
                easeInOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
                easeInQuad: t => t * t,
                easeOutQuad: t => t * (2 - t),
                easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
                easeInCubic: t => t * t * t,
                easeOutCubic: t => (--t) * t * t + 1,
                easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
                easeInQuart: t => t * t * t * t,
                easeOutQuart: t => 1 - (--t) * t * t * t,
                easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
                easeInQuint: t => t * t * t * t * t,
                easeOutQuint: t => 1 + (--t) * t * t * t * t,
                easeInOutQuint: t => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,
                easeInExpo: t => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
                easeOutExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
                easeInOutExpo: t => {
                    if (t === 0 || t === 1) return t;
                    if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2;
                    return (2 - Math.pow(2, -20 * t + 10)) / 2;
                },
                spring: t => {
                    const c4 = (2 * Math.PI) / 3;
                    return t === 0 ? 0 : t === 1 ? 1 :
                        Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
                },
                bounce: t => {
                    const n1 = 7.5625;
                    const d1 = 2.75;
                    if (t < 1 / d1) {
                        return n1 * t * t;
                    } else if (t < 2 / d1) {
                        return n1 * (t -= 1.5 / d1) * t + 0.75;
                    } else if (t < 2.5 / d1) {
                        return n1 * (t -= 2.25 / d1) * t + 0.9375;
                    } else {
                        return n1 * (t -= 2.625 / d1) * t + 0.984375;
                    }
                }
            };
            
            return easingFunctions[easing] || easingFunctions.linear;
        }
        
        kebabCase(str) {
            return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        }
        
        /**
         * Stop all running animations
         */
        stopAll() {
            this.runningAnimations.forEach(animation => {
                if (animation && typeof animation.stop === 'function') {
                    animation.stop();
                }
            });
            this.runningAnimations.clear();
        }
        
        /**
         * Pause/resume animations (for performance)
         */
        pause() {
            this.paused = true;
        }
        
        resume() {
            this.paused = false;
        }
    }

    // Export for use in AutomateStash
    if (typeof window !== 'undefined') {
        window.AnimationController = AnimationController;
        window.animationController = new AnimationController();
    }

})();