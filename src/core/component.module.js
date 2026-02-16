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
        super('#courts-results', '', dependencies);
        this.courtService = dependencies.court;
        this.cases = [];
        this.filteredCases = [];
        this.selectedCase = null;
    }

    onInit() {
        this.cases = this.courtService.getCases();
        this.filteredCases = this.cases;
        // Don't render during init - wait for showPage to be called
    }

    render() {
        if (!this.selectedCase) {
            // Render case list
            this.renderCasesList();
        } else {
            // Render case details with transcripts
            this.renderCaseDetails();
        }

        this.attachEventListeners();
    }

    renderCasesList() {
        if (!this.element) return;
        
        this.element.innerHTML = this.filteredCases.map(caseItem => `
            <div class="case-card" data-docket="${caseItem.docket_number}" style="cursor: pointer; padding: 15px; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9; transition: all 0.3s ease;">
                <h4 style="margin: 0 0 8px 0; color: #333;">${caseItem.case_name}</h4>
                <p style="margin: 4px 0; font-size: 0.9em; color: #666;"><strong>Docket:</strong> ${caseItem.docket_number}</p>
                <p style="margin: 4px 0; font-size: 0.9em; color: #666;"><strong>Judge:</strong> ${caseItem.judge}</p>
                <p style="margin: 4px 0; font-size: 0.9em; color: #666;"><strong>Court:</strong> ${caseItem.court}</p>
                <p style="margin: 8px 0; font-size: 0.85em; color: #555;">${caseItem.summary}</p>
                <div style="margin-top: 8px; font-size: 0.85em;">
                    <span style="display: inline-block; padding: 4px 8px; background: ${caseItem.type === 'Criminal' ? '#e74c3c' : '#3498db'}; color: white; border-radius: 4px; margin-right: 8px;">${caseItem.type}</span>
                    <span style="display: inline-block; padding: 4px 8px; background: #27ae60; color: white; border-radius: 4px;">${caseItem.status}</span>
                    <span style="display: inline-block; padding: 4px 8px; background: #95a5a6; color: white; border-radius: 4px; margin-left: 8px;">📄 ${caseItem.transcripts?.length || 0} transcripts</span>
                </div>
            </div>
        `).join('');
    }

    renderCaseDetails() {
        if (!this.element) return;
        
        const transcripts = this.courtService.getTranscripts(this.selectedCase.docket_number);
        
        let html = `
            <div style="max-width: 900px;">
                <button id="btn-back-cases" style="padding: 8px 16px; margin-bottom: 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1em;">← Back to Cases</button>
                
                <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #ddd;">
                    <h2 style="margin-top: 0;">${this.selectedCase.case_name}</h2>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0;">
                        <div>
                            <strong>Docket Number:</strong><br>${this.selectedCase.docket_number}
                        </div>
                        <div>
                            <strong>Court:</strong><br>${this.selectedCase.court}
                        </div>
                        <div>
                            <strong>Judge:</strong><br>${this.selectedCase.judge}
                        </div>
                        <div>
                            <strong>Date Filed:</strong><br>${this.selectedCase.date_filed}
                        </div>
                        <div>
                            <strong>Type:</strong><br>${this.selectedCase.type}
                        </div>
                        <div>
                            <strong>Status:</strong><br><span style="display: inline-block; padding: 4px 8px; background: #27ae60; color: white; border-radius: 4px;">${this.selectedCase.status}</span>
                        </div>
                    </div>

                    <h3>Parties Involved</h3>
                    <ul style="list-style-position: inside;">
                        ${this.selectedCase.parties.map(party => `<li>${party}</li>`).join('')}
                    </ul>

                    <h3>Summary</h3>
                    <p>${this.selectedCase.summary}</p>

                    <div style="border-top: 1px solid #ddd; padding-top: 20px; margin-top: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h3 style="margin: 0;">Court Transcripts (${transcripts.length})</h3>
                            <button id="btn-download-all" style="padding: 8px 16px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer;">⬇️ Download All</button>
                        </div>
                        
                        <div>
                            ${transcripts.map(transcript => `
                                <div style="padding: 12px; margin: 8px 0; background: #f9f9f9; border-left: 4px solid #3498db; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong>${transcript.title}</strong><br>
                                        <span style="font-size: 0.9em; color: #666;">📅 ${transcript.date} | 📄 ${transcript.pages} pages</span>
                                    </div>
                                    <div style="display: flex; gap: 8px;">
                                        <button class="btn-view-transcript" data-id="${transcript.id}" data-title="${transcript.title}" style="padding: 6px 12px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">👁️ View</button>
                                        <button class="btn-download-transcript" data-id="${transcript.id}" data-title="${transcript.title}" style="padding: 6px 12px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer;">⬇️ Download</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div id="transcript-viewer" style="display: none; margin-top: 20px; background: #f5f5f5; padding: 16px; border-radius: 8px; border: 1px solid #ddd;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h3 id="viewer-title" style="margin: 0;"></h3>
                            <button id="btn-close-viewer" style="padding: 6px 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">✕ Close</button>
                        </div>
                        <div id="transcript-content" style="background: white; padding: 16px; border-radius: 4px; max-height: 500px; overflow-y: auto; font-family: monospace; font-size: 0.9em; line-height: 1.6; white-space: pre-wrap; word-break: break-word;"></div>
                    </div>
                </div>
            </div>
        `;
        
        this.element.innerHTML = html;
    }

    attachEventListeners() {
        if (this.selectedCase) {
            // Case details view listeners
            this.querySelector('#btn-back-cases')?.addEventListener('click', () => this.goBackToCases());
            this.querySelector('#btn-download-all')?.addEventListener('click', () => this.downloadAllTranscripts());
            
            this.querySelectorAll('.btn-view-transcript').forEach(btn => {
                btn.addEventListener('click', (e) => this.viewTranscript(e.target.dataset.id, e.target.dataset.title));
            });

            this.querySelectorAll('.btn-download-transcript').forEach(btn => {
                btn.addEventListener('click', (e) => this.downloadTranscript(e.target.dataset.id, e.target.dataset.title));
            });

            this.querySelector('#btn-close-viewer')?.addEventListener('click', () => this.closeTranscriptViewer());
        } else {
            // Case list view listeners
            this.querySelector('#search-query')?.addEventListener('input', () => this.filterCases());
            this.querySelector('#filter-judge')?.addEventListener('input', () => this.filterCases());
            
            this.querySelectorAll('.case-card').forEach(card => {
                card.addEventListener('click', () => this.selectCase(card.dataset.docket));
            });
        }
    }

    selectCase(docketNumber) {
        this.selectedCase = this.cases.find(c => c.docket_number === docketNumber);
        this.render();
    }

    goBackToCases() {
        this.selectedCase = null;
        this.render();
    }

    viewTranscript(transcriptId, title) {
        const content = this.courtService.getTranscriptContent(transcriptId);
        const viewer = this.querySelector('#transcript-viewer');
        
        if (viewer) {
            this.querySelector('#viewer-title').textContent = title;
            const contentDiv = this.querySelector('#transcript-content');
            contentDiv.innerHTML = `<pre>${this.escapeHtml(content)}</pre>`;
            viewer.classList.remove('hidden');
            contentDiv.scrollTop = 0;
        }
    }

    closeTranscriptViewer() {
        this.querySelector('#transcript-viewer')?.classList.add('hidden');
    }

    downloadTranscript(transcriptId, title) {
        this.courtService.downloadTranscript(transcriptId, title);
    }

    downloadAllTranscripts() {
        if (this.selectedCase) {
            this.courtService.downloadAllTranscripts(this.selectedCase.docket_number, this.selectedCase.case_name);
        }
    }

    filterCases() {
        const query = this.querySelector('#search-query')?.value || '';
        const judge = this.querySelector('#filter-judge')?.value || '';

        this.filteredCases = this.courtService.searchCases(query, judge, '');
        this.render();
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
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
