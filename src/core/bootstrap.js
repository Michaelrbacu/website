/**
 * Bootstrap Module - Angular-like application bootstrap
 * Initializes services, components, and application state
 */

// Import modules (in real Angular, these would be ES6 imports)
// For browser environment, these modules are loaded via script tags

/**
 * ApplicationBootstrapper - Angular-like bootstrap process
 */
class ApplicationBootstrapper {
    constructor() {
        this.serviceContainer = null;
        this.componentRegistry = null;
        this.components = [];
        this.isInitialized = false;
    }

    /**
     * Bootstrap the entire application
     * Similar to: ng serve -> bootstrap modules -> initialize components
     */
    async bootstrap() {
        console.log('🚀 Starting application bootstrap...');

        try {
            // Step 1: Initialize service container
            this.initializeServices();

            // Step 2: Initialize theme
            await this.initializeTheme();

            // Step 3: Initialize components
            await this.initializeComponents();

            // Step 4: Initialize 3D scene (Three.js)
            await this.initialize3DScene();

            // Step 5: Load async data
            await this.loadAsyncData();

            // Step 6: Hide loading screen and complete initialization
            this.completeInitialization();

            this.isInitialized = true;
            console.log('✅ Application bootstrap completed');
        } catch (error) {
            console.error('❌ Bootstrap failed:', error);
            this.handleBootstrapError(error);
        }
    }

    /**
     * Step 1: Initialize service container
     */
    initializeServices() {
        console.log('📦 Initializing services...');

        // Get global service container (from service.module.js)
        this.serviceContainer = window.serviceContainer;

        if (!this.serviceContainer) {
            throw new Error('ServiceContainer not available. Ensure service.module.js is loaded.');
        }

        // Verify all required services are registered
        const requiredServices = ['blog', 'crypto', 'court', 'theme', 'space', 'notification'];
        requiredServices.forEach(service => {
            if (!this.serviceContainer.get(service)) {
                throw new Error(`Required service '${service}' not found`);
            }
        });

        console.log('✅ Services initialized:', requiredServices);
    }

    /**
     * Step 2: Initialize theme
     */
    async initializeTheme() {
        console.log('🎨 Initializing theme...');
        const themeService = this.serviceContainer.get('theme');
        themeService.initTheme();
        
        // Attach theme toggle handler
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const newTheme = themeService.toggleTheme();
                console.log(`🌓 Theme switched to: ${newTheme}`);
            });
        }

        console.log('✅ Theme initialized');
    }

    /**
     * Step 3: Initialize components
     * Angular-like component registration and initialization
     */
    async initializeComponents() {
        console.log('🧩 Initializing components...');

        // Get global component registry (from component.module.js)
        const ComponentRegistry = window.ComponentRegistry;
        if (!ComponentRegistry) {
            throw new Error('ComponentRegistry not available. Ensure component.module.js is loaded.');
        }

        this.componentRegistry = new ComponentRegistry();

        // Register components
        const BlogComponent = window.BlogComponent;
        const CryptoComponent = window.CryptoComponent;
        const CourtComponent = window.CourtComponent;
        const AdminComponent = window.AdminComponent;

        this.componentRegistry.register('blog', BlogComponent);
        this.componentRegistry.register('crypto', CryptoComponent);
        this.componentRegistry.register('court', CourtComponent);
        this.componentRegistry.register('admin', AdminComponent);

        // Initialize all components with dependency injection
        const componentDeps = this.getComponentDependencies();
        this.components = [];
        
        // Initialize each component, but handle court component specially
        ['blog', 'crypto', 'admin'].forEach(name => {
            const Component = this.componentRegistry.components.get(name);
            const instance = this.componentRegistry.create(name, componentDeps);
            if (instance && instance.initialize()) {
                this.components.push(instance);
            }
        });

        // Initialize court component but don't call initialize() yet (element doesn't exist)
        const CourtComponentClass = this.componentRegistry.components.get('court');
        const courtComponent = new CourtComponentClass(componentDeps);
        courtComponent.onInit();  // Just call onInit to load data
        window.courtComponent = courtComponent;
        this.components.push(courtComponent);

        console.log(`✅ Components initialized: ${this.components.length} components`);
    }

    /**
     * Get dependencies for component injection
     */
    getComponentDependencies() {
        return {
            blog: this.serviceContainer.get('blog'),
            crypto: this.serviceContainer.get('crypto'),
            court: this.serviceContainer.get('court'),
            theme: this.serviceContainer.get('theme'),
            space: this.serviceContainer.get('space'),
            notification: this.serviceContainer.get('notification')
        };
    }

    /**
     * Step 4: Initialize 3D scene
     */
    async initialize3DScene() {
        console.log('🌌 Initializing 3D scene...');

        if (typeof initThreeJsScene === 'function') {
            await initThreeJsScene();
            console.log('✅ 3D scene initialized');
        } else {
            console.warn('⚠️ Three.js initialization function not found');
        }
    }

    /**
     * Step 5: Load async data
     */
    async loadAsyncData() {
        console.log('📡 Loading async data...');

        const spaceService = this.serviceContainer.get('space');
        const cryptoService = this.serviceContainer.get('crypto');

        try {
            await Promise.all([
                spaceService.loadSpaceImages(),
                cryptoService.loadCryptoData()
            ]);
            console.log('✅ Async data loaded');
        } catch (error) {
            console.warn('⚠️ Error loading async data:', error);
        }
    }

    /**
     * Step 6: Complete initialization
     */
    completeInitialization() {
        console.log('🎬 Completing initialization...');

        // Hide loading screen with smooth transition
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                loadingScreen.style.pointerEvents = 'none';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }, 500);
        }

        // Dispatch application ready event
        window.dispatchEvent(new CustomEvent('app-ready', {
            detail: { isInitialized: true, components: this.components }
        }));

        console.log('✅ Application ready');
    }

    /**
     * Handle bootstrap errors
     */
    handleBootstrapError(error) {
        const notification = this.serviceContainer.get('notification');
        if (notification) {
            notification.error(`Bootstrap failed: ${error.message}`);
        }

        // Show error in loading screen
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = '❌ Initialization failed. Please refresh.';
        }
    }

    /**
     * Provide service getter for global access
     */
    getService(name) {
        return this.serviceContainer.get(name);
    }

    /**
     * Provide component access
     */
    getComponent(name) {
        return this.components.find(c => c.constructor.name === name);
    }

    /**
     * Angular-like injector for runtime dependency resolution
     */
    inject(serviceName) {
        const service = this.getService(serviceName);
        if (!service) {
            console.warn(`Service '${serviceName}' not available for injection`);
        }
        return service;
    }
}

/**
 * Global Application Instance
 * Acts like Angular's AppComponent
 */
let app = null;

/**
 * Initialize application on DOM ready
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 DOM Content Loaded - Starting bootstrap');

    app = new ApplicationBootstrapper();
    await app.bootstrap();
});

/**
 * Global API for accessing application services
 * Usage: app.inject('blog'), app.getService('theme'), etc.
 */
window.getAppService = (serviceName) => {
    return app ? app.getService(serviceName) : null;
};

window.getAppInstance = () => {
    return app;
};

// Export for ES6 module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ApplicationBootstrapper };
}
