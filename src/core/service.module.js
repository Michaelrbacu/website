/**
 * Service Module - Core injectable services
 * Implements Angular-like dependency injection pattern
 */

// Service Registry (Angular-like DI container)
class ServiceContainer {
    constructor() {
        this.services = new Map();
    }

    register(name, service) {
        this.services.set(name, service);
    }

    get(name) {
        if (!this.services.has(name)) {
            console.warn(`Service '${name}' not found in container`);
            return null;
        }
        return this.services.get(name);
    }
}

// Global service container instance
const serviceContainer = new ServiceContainer();

/**
 * BlogService - Manages blog post data
 */
class BlogService {
    constructor() {
        this.storageKey = 'michael_blog_posts';
        this.analyticsKey = 'michael_blog_analytics';
    }

    getPosts() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey)) || [];
        } catch (e) {
            console.error('Error loading posts:', e);
            return [];
        }
    }

    savePosts(posts) {
        localStorage.setItem(this.storageKey, JSON.stringify(posts));
    }

    createPost(postData) {
        const posts = this.getPosts();
        const post = {
            id: Date.now(),
            ...postData,
            createdAt: new Date().toISOString(),
            views: 0
        };
        posts.unshift(post);
        this.savePosts(posts);
        return post;
    }

    updatePost(id, updates) {
        let posts = this.getPosts();
        posts = posts.map(p => p.id === id ? { ...p, ...updates } : p);
        this.savePosts(posts);
    }

    deletePost(id) {
        let posts = this.getPosts();
        posts = posts.filter(p => p.id !== id);
        this.savePosts(posts);
    }

    incrementViews(id) {
        this.updatePost(id, { views: (this.getPosts().find(p => p.id === id)?.views || 0) + 1 });
    }
}

/**
 * CryptoService - Manages cryptocurrency data
 */
class CryptoService {
    constructor() {
        this.cryptoData = [];
    }

    async loadCryptoData() {
        // Simulated crypto data with realistic API structure
        this.cryptoData = [
            { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', currentPrice: 43250, priceChange: 2.5, potentialGain: 125000, signal: 'HOLD' },
            { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', currentPrice: 2280, priceChange: 1.8, potentialGain: 5000, signal: 'BUY' },
            { id: 'cardano', name: 'Cardano', symbol: 'ADA', currentPrice: 0.95, priceChange: 3.2, potentialGain: 2.50, signal: 'BUY' },
            { id: 'solana', name: 'Solana', symbol: 'SOL', currentPrice: 185, priceChange: 4.1, potentialGain: 550, signal: 'HOLD' },
            { id: 'polkadot', name: 'Polkadot', symbol: 'DOT', currentPrice: 12.50, priceChange: 2.9, potentialGain: 45, signal: 'SELL' },
            { id: 'ripple', name: 'Ripple', symbol: 'XRP', currentPrice: 2.10, priceChange: 1.5, potentialGain: 8.50, signal: 'HOLD' }
        ];
        return this.cryptoData;
    }

    getCryptoData() {
        return this.cryptoData;
    }

    searchCrypto(query) {
        return this.cryptoData.filter(crypto =>
            crypto.name.toLowerCase().includes(query.toLowerCase()) ||
            crypto.symbol.toLowerCase().includes(query.toLowerCase())
        );
    }
}

/**
 * CourtService - Manages court document data and searches
 */
class CourtService {
    constructor() {
        this.cases = [];
    }

    getCases() {
        return [
            {
                case_name: 'Securities & Exchange Commission v. FTX Trading Ltd.',
                docket_number: '2024-SDNY-11547',
                court: 'US District Court, Southern District of New York',
                date_filed: '2022-11-08',
                judge: 'Judge John J. Kaplan',
                parties: ['Securities & Exchange Commission', 'FTX Trading Ltd.', 'Sam Bankman-Fried'],
                summary: 'High-profile cryptocurrency fraud case. Securities violations, wire fraud, and conspiracy charges involving billions in customer funds. Judge Kaplan presiding.',
                type: 'Criminal',
                status: 'Active'
            },
            {
                case_name: 'United States v. Bankman-Fried, Samuel',
                docket_number: '2024-USDC-SDNY-845',
                court: 'US District Court, Southern District of New York',
                date_filed: '2022-12-13',
                judge: 'Judge John J. Kaplan',
                parties: ['United States', 'Samuel Bankman-Fried'],
                summary: 'Criminal prosecution of FTX founder. Wire fraud, money laundering, and conspiracy. Judge Kaplan overseeing trial.',
                type: 'Criminal',
                status: 'Active'
            },
            {
                case_name: 'Federal Trade Commission v. TechCorp Inc.',
                docket_number: '2024-NDCA-8901',
                court: 'US District Court, Northern District of California',
                date_filed: '2024-01-20',
                judge: 'Judge Elena Rodriguez',
                parties: ['Federal Trade Commission', 'TechCorp Inc.'],
                summary: 'Antitrust case involving alleged monopolistic practices in the technology sector.',
                type: 'Civil',
                status: 'Ongoing'
            }
        ];
    }

    searchCases(query, judge = '', party = '') {
        return this.getCases().filter(c => {
            const queryMatch = !query || 
                c.case_name.toLowerCase().includes(query.toLowerCase()) ||
                c.summary.toLowerCase().includes(query.toLowerCase()) ||
                c.parties.some(p => p.toLowerCase().includes(query.toLowerCase()));
            
            const judgeMatch = !judge || c.judge.toLowerCase().includes(judge.toLowerCase());
            const partyMatch = !party || c.parties.some(p => p.toLowerCase().includes(party.toLowerCase()));
            
            return queryMatch && judgeMatch && partyMatch;
        });
    }
}

/**
 * ThemeService - Manages application theming
 */
class ThemeService {
    constructor() {
        this.themeKey = 'michael_blog_theme';
        this.currentTheme = 'light';
    }

    initTheme() {
        this.currentTheme = localStorage.getItem(this.themeKey) || 'light';
        if (this.currentTheme === 'dark') {
            document.body.classList.add('dark-mode');
        }
    }

    toggleTheme() {
        const isDark = this.currentTheme === 'dark';
        this.currentTheme = isDark ? 'light' : 'dark';
        localStorage.setItem(this.themeKey, this.currentTheme);
        
        if (isDark) {
            document.body.classList.remove('dark-mode');
        } else {
            document.body.classList.add('dark-mode');
        }
        
        return this.currentTheme;
    }

    getTheme() {
        return this.currentTheme;
    }
}

/**
 * SpaceService - Manages NASA space imagery
 */
class SpaceService {
    constructor() {
        this.images = [];
        this.currentIndex = 0;
        this.apiKey = 'DEMO_KEY';
        this.apodUrl = 'https://api.nasa.gov/planetary/apod';
    }

    async loadSpaceImages() {
        try {
            const dates = [];
            for (let i = 0; i < 10; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                dates.push(date.toISOString().split('T')[0]);
            }

            const promises = dates.map(date =>
                fetch(`${this.apodUrl}?api_key=${this.apiKey}&date=${date}`)
                    .then(res => res.json())
                    .catch(() => null)
            );

            const responses = await Promise.all(promises);
            this.images = responses
                .filter(r => r && r.url && r.title)
                .map(r => ({
                    url: r.hdurl || r.url,
                    title: r.title,
                    explanation: r.explanation
                }))
                .slice(0, 8);

            return this.images;
        } catch (err) {
            console.error('Error loading space images:', err);
            return this.getDefaultImages();
        }
    }

    getDefaultImages() {
        return [
            { url: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=1200', title: 'Galaxy Exploration', explanation: 'Deep space' },
            { url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1200', title: 'Cosmic Universe', explanation: 'Vast cosmos' },
            { url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1200', title: 'Space Nebula', explanation: 'Beautiful nebula' }
        ];
    }

    getCurrentImage() {
        return this.images[this.currentIndex] || null;
    }

    nextImage() {
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        return this.getCurrentImage();
    }

    previousImage() {
        this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
        return this.getCurrentImage();
    }

    getImages() {
        return this.images;
    }
}

/**
 * NotificationService - Handles user notifications
 */
class NotificationService {
    notify(message, type = 'info') {
        console.log(`[${type.toUpperCase()}]: ${message}`);
        // Can be extended with toast notifications
    }

    success(message) {
        this.notify(message, 'success');
    }

    error(message) {
        this.notify(message, 'error');
    }

    warning(message) {
        this.notify(message, 'warning');
    }
}

// Register all services
serviceContainer.register('blog', new BlogService());
serviceContainer.register('crypto', new CryptoService());
serviceContainer.register('court', new CourtService());
serviceContainer.register('theme', new ThemeService());
serviceContainer.register('space', new SpaceService());
serviceContainer.register('notification', new NotificationService());

// Export for use
export { serviceContainer, BlogService, CryptoService, CourtService, ThemeService, SpaceService, NotificationService };
