/**
 * Component Module - Angular-like component architecture
 * Base component class and component registry
 */

/**
 * BaseComponent - Angular-inspired base component class
 * Provides lifecycle hooks and dependency injection
 */
class BaseComponent {
    constructor(selector, template = '', dependencies = {}) {
        this.selector = selector;
        this.template = template;
        this.dependencies = dependencies;
        this.element = null;
        this.state = {};
        this.changeDetection = false;
    }

    // Lifecycle Hooks (Angular style)
    onInit() { }
    onDestroy() { }
    onChanges(changes) { }
    onAfterViewInit() { }

    /**
     * Initialize component and inject dependencies
     */
    initialize() {
        this.element = document.querySelector(this.selector);
        if (!this.element) {
            console.warn(`Component selector '${this.selector}' not found`);
            return false;
        }
        this.onInit();
        this.render();
        this.onAfterViewInit();
        return true;
    }

    /**
     * Set component state and trigger change detection
     */
    setState(newState) {
        const changes = {};
        for (let key in newState) {
            if (this.state[key] !== newState[key]) {
                changes[key] = { old: this.state[key], new: newState[key] };
                this.state[key] = newState[key];
            }
        }
        if (Object.keys(changes).length > 0) {
            this.onChanges(changes);
            this.render();
        }
    }

    /**
     * Get service from DI container
     */
    getService(serviceName) {
        return this.dependencies[serviceName] || null;
    }

    /**
     * Render component - Override in child classes
     */
    render() {
        if (!this.element) return;
        this.element.innerHTML = this.template;
    }

    /**
     * Add event listener (Angular style)
     */
    addEventListener(selector, event, handler) {
        const el = this.element.querySelector(selector);
        if (el) {
            el.addEventListener(event, handler.bind(this));
        }
    }

    /**
     * Query element within component
     */
    querySelector(selector) {
        return this.element?.querySelector(selector);
    }

    /**
     * Query all elements within component
     */
    querySelectorAll(selector) {
        return this.element?.querySelectorAll(selector) || [];
    }

    /**
     * Emit custom event (Angular style)
     */
    emit(eventName, detail) {
        const event = new CustomEvent(eventName, { detail });
        this.element?.dispatchEvent(event);
    }

    /**
     * Listen for component events
     */
    on(eventName, handler) {
        this.element?.addEventListener(eventName, handler);
    }
}

/**
 * BlogComponent - Manages blog functionality
 */
class BlogComponent extends BaseComponent {
    constructor(dependencies) {
        super('#blog-section', '', dependencies);
        this.blogService = dependencies.blog;
        this.posts = [];
        this.editingId = null;
    }

    onInit() {
        this.posts = this.blogService.getPosts();
    }

    render() {
        if (!this.element) return;

        this.element.innerHTML = `
            <div class="blog-container">
                <div class="blog-header">
                    <h2>Blog Posts</h2>
                    <button class="btn-primary" id="btn-new-post">+ New Post</button>
                </div>
                <div id="post-list" class="post-list">
                    ${this.renderPostList()}
                </div>
                <div id="post-form" class="post-form hidden">
                    ${this.renderPostForm()}
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    renderPostList() {
        return this.posts.map(post => `
            <article class="post-card">
                <div class="post-meta">
                    <span class="post-date">${new Date(post.createdAt).toLocaleDateString()}</span>
                    <span class="post-views">👁️ ${post.views} views</span>
                </div>
                <h3 class="post-title">${post.title}</h3>
                <p class="post-content">${post.content.substring(0, 200)}...</p>
                <div class="post-actions">
                    <button class="btn-edit" data-id="${post.id}">Edit</button>
                    <button class="btn-delete" data-id="${post.id}">Delete</button>
                </div>
            </article>
        `).join('');
    }

    renderPostForm() {
        return `
            <form id="edit-form">
                <input type="text" id="post-title" placeholder="Post Title" required>
                <textarea id="post-content" placeholder="Post content..." required></textarea>
                <div class="form-actions">
                    <button type="submit" class="btn-save">Save Post</button>
                    <button type="button" class="btn-cancel">Cancel</button>
                </div>
            </form>
        `;
    }

    attachEventListeners() {
        this.querySelector('#btn-new-post')?.addEventListener('click', () => this.showCreateForm());
        this.querySelector('.btn-cancel')?.addEventListener('click', () => this.hideForm());
        this.querySelector('#edit-form')?.addEventListener('submit', (e) => this.handleSavePost(e));
        this.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.deletePost(e.target.dataset.id));
        });
    }

    showCreateForm() {
        this.querySelector('#post-form')?.classList.remove('hidden');
    }

    hideForm() {
        this.querySelector('#post-form')?.classList.add('hidden');
        this.editingId = null;
    }

    handleSavePost(e) {
        e.preventDefault();
        const title = this.querySelector('#post-title')?.value;
        const content = this.querySelector('#post-content')?.value;

        if (title && content) {
            this.blogService.createPost({ title, content });
            this.setState({ posts: this.blogService.getPosts() });
            this.hideForm();
        }
    }

    deletePost(id) {
        if (confirm('Delete this post?')) {
            this.blogService.deletePost(id);
            this.setState({ posts: this.blogService.getPosts() });
        }
    }
}

/**
 * CryptoComponent - Manages crypto tracker
 */
class CryptoComponent extends BaseComponent {
    constructor(dependencies) {
        super('#crypto-section', '', dependencies);
        this.cryptoService = dependencies.crypto;
        this.coins = [];
    }

    async onInit() {
        this.coins = await this.cryptoService.loadCryptoData();
    }

    render() {
        if (!this.element) return;

        this.element.innerHTML = `
            <div class="crypto-container">
                <h2>Crypto Portfolio</h2>
                <div class="crypto-grid">
                    ${this.renderCryptoCards()}
                </div>
            </div>
        `;
    }

    renderCryptoCards() {
        return this.coins.map(coin => `
            <div class="crypto-card">
                <div class="crypto-header">
                    <h3>${coin.name}</h3>
                    <span class="symbol">${coin.symbol}</span>
                </div>
                <div class="crypto-price">
                    <span class="current-price">$${coin.currentPrice.toFixed(2)}</span>
                    <span class="change ${coin.priceChange > 0 ? 'positive' : 'negative'}">
                        ${coin.priceChange > 0 ? '+' : ''}${coin.priceChange}%
                    </span>
                </div>
                <div class="crypto-signal">
                    <span class="signal-${coin.signal.toLowerCase()}">${coin.signal}</span>
                </div>
            </div>
        `).join('');
    }
}

/**
 * CourtComponent - Manages court search
 */
class CourtComponent extends BaseComponent {
    constructor(dependencies) {
        super('#court-section', '', dependencies);
        this.courtService = dependencies.court;
        this.cases = [];
        this.filteredCases = [];
    }

    onInit() {
        this.cases = this.courtService.getCases();
        this.filteredCases = this.cases;
    }

    render() {
        if (!this.element) return;

        this.element.innerHTML = `
            <div class="court-container">
                <h2>Court Document Search</h2>
                <div class="search-filters">
                    <input type="text" id="search-query" placeholder="Search cases...">
                    <input type="text" id="filter-judge" placeholder="Filter by judge...">
                </div>
                <div class="cases-list">
                    ${this.renderCasesList()}
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    renderCasesList() {
        return this.filteredCases.map(caseItem => `
            <div class="case-card">
                <h4>${caseItem.case_name}</h4>
                <p class="case-docket">Docket: ${caseItem.docket_number}</p>
                <p class="case-judge">Judge: ${caseItem.judge}</p>
                <p class="case-summary">${caseItem.summary}</p>
                <span class="case-status">${caseItem.status}</span>
            </div>
        `).join('');
    }

    attachEventListeners() {
        this.querySelector('#search-query')?.addEventListener('input', () => this.filterCases());
        this.querySelector('#filter-judge')?.addEventListener('input', () => this.filterCases());
    }

    filterCases() {
        const query = this.querySelector('#search-query')?.value || '';
        const judge = this.querySelector('#filter-judge')?.value || '';

        this.filteredCases = this.courtService.searchCases(query, judge, '');
        this.render();
    }
}

/**
 * AdminComponent - Manages admin dashboard
 */
class AdminComponent extends BaseComponent {
    constructor(dependencies) {
        super('#admin-section', '', dependencies);
        this.blogService = dependencies.blog;
        this.cryptoService = dependencies.crypto;
        this.courtService = dependencies.court;
    }

    render() {
        if (!this.element) return;

        const posts = this.blogService.getPosts().length;
        const coins = this.cryptoService.getCryptoData().length;
        const cases = this.courtService.getCases().length;

        this.element.innerHTML = `
            <div class="admin-dashboard">
                <h2>Admin Dashboard</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <h3>Blog Posts</h3>
                        <p class="stat-value">${posts}</p>
                    </div>
                    <div class="stat-card">
                        <h3>Cryptocurrencies</h3>
                        <p class="stat-value">${coins}</p>
                    </div>
                    <div class="stat-card">
                        <h3>Court Cases</h3>
                        <p class="stat-value">${cases}</p>
                    </div>
                </div>
            </div>
        `;
    }
}

/**
 * Component Registry - Manages all components
 */
class ComponentRegistry {
    constructor() {
        this.components = new Map();
    }

    register(name, Component) {
        this.components.set(name, Component);
    }

    create(name, dependencies) {
        const Component = this.components.get(name);
        if (!Component) {
            console.error(`Component '${name}' not found in registry`);
            return null;
        }
        return new Component(dependencies);
    }

    initializeAll(dependencies) {
        const instances = [];
        this.components.forEach((Component, name) => {
            const instance = this.create(name, dependencies);
            if (instance && instance.initialize()) {
                instances.push(instance);
            }
        });
        return instances;
    }
}

// Export components and registry
export { BaseComponent, BlogComponent, CryptoComponent, CourtComponent, AdminComponent, ComponentRegistry };
