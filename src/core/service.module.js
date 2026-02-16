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
        this.courtListenerBaseUrl = 'https://www.courtlistener.com/api/rest/v3';
        this.cacheKey = 'court_cases_cache';
        this.cacheExpiry = 'court_cases_expiry';
    }

    /**
     * Fetch cases from CourtListener API
     * Free public API for court documents and opinions
     */
    async getCases(forceRefresh = false) {
        // Check cache first
        if (!forceRefresh) {
            const cached = this.getCachedCases();
            if (cached) {
                return cached;
            }
        }

        try {
            console.log('📡 Fetching cases from CourtListener API...');
            
            // Fetch recent opinions from US Courts
            const response = await fetch(
                `${this.courtListenerBaseUrl}/opinions/?order_by=-date_filed&limit=20&format=json`
            );

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data = await response.json();
            const cases = this.transformApiResponseToCases(data.results);
            
            // Cache the results
            this.cacheResults(cases);
            
            this.cases = cases;
            console.log(`✅ Loaded ${cases.length} cases from CourtListener API`);
            return cases;
        } catch (error) {
            console.error('❌ Error fetching from CourtListener API:', error);
            // Fall back to empty array if API fails
            return [];
        }
    }

    /**
     * Transform CourtListener API response to internal case format
     */
    transformApiResponseToCases(results) {
        return results.map((opinion, index) => ({
            case_name: opinion.case_name || opinion.plain_text?.substring(0, 100) || 'Unknown Case',
            docket_number: opinion.docket_id ? `DOCKET-${opinion.docket_id}` : `OPINION-${opinion.id}`,
            court: this.getCourtName(opinion.court),
            date_filed: opinion.date_filed || new Date().toISOString().split('T')[0],
            judge: opinion.judge ? opinion.judge.map(j => `Judge ${j.name}`).join(', ') : 'Presiding Judge',
            parties: this.extractParties(opinion.case_name || ''),
            summary: opinion.plain_text?.substring(0, 300) + '...' || 'Court opinion case',
            type: opinion.type ? opinion.type.toUpperCase() : 'CIVIL',
            status: 'Completed',
            opinion_id: opinion.id,
            opinion_url: opinion.absolute_url,
            transcripts: [
                {
                    id: `opinion_${opinion.id}`,
                    title: 'Full Opinion',
                    date: opinion.date_filed || new Date().toISOString().split('T')[0],
                    pages: Math.ceil((opinion.plain_text?.length || 0) / 2500)
                }
            ]
        }));
    }

    /**
     * Extract parties from case name
     */
    extractParties(caseName) {
        const parts = caseName.split(' v. ');
        if (parts.length === 2) {
            return [parts[0].trim(), parts[1].trim()];
        }
        return [caseName];
    }

    /**
     * Get human-readable court name from court object
     */
    getCourtName(court) {
        if (!court) return 'Court of Record';
        
        const courtMap = {
            'scotus': 'United States Supreme Court',
            'ca1': 'United States Court of Appeals - First Circuit',
            'ca2': 'United States Court of Appeals - Second Circuit',
            'ca3': 'United States Court of Appeals - Third Circuit',
            'ca4': 'United States Court of Appeals - Fourth Circuit',
            'ca5': 'United States Court of Appeals - Fifth Circuit',
            'ca6': 'United States Court of Appeals - Sixth Circuit',
            'ca7': 'United States Court of Appeals - Seventh Circuit',
            'ca8': 'United States Court of Appeals - Eighth Circuit',
            'ca9': 'United States Court of Appeals - Ninth Circuit',
            'ca10': 'United States Court of Appeals - Tenth Circuit',
            'ca11': 'United States Court of Appeals - Eleventh Circuit',
            'cadc': 'United States Court of Appeals - District of Columbia',
            'cafc': 'United States Court of Appeals - Federal Circuit',
        };
        
        return courtMap[court.id] || court.full_name || 'Court of Record';
    }

    /**
     * Cache results with expiry
     */
    cacheResults(cases) {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(this.cacheKey, JSON.stringify(cases));
            // Cache for 24 hours
            localStorage.setItem(this.cacheExpiry, Date.now() + (24 * 60 * 60 * 1000));
        }
    }

    /**
     * Get cached results if valid
     */
    getCachedCases() {
        if (typeof localStorage === 'undefined') return null;
        
        const expiry = localStorage.getItem(this.cacheExpiry);
        if (!expiry || Date.now() > parseInt(expiry)) {
            // Cache expired
            localStorage.removeItem(this.cacheKey);
            localStorage.removeItem(this.cacheExpiry);
            return null;
        }
        
        const cached = localStorage.getItem(this.cacheKey);
        return cached ? JSON.parse(cached) : null;
    }

    /**
     * Search cases from API results
     */
    async searchCases(query, judge = '', party = '') {
        const cases = await this.getCases();
        
        return cases.filter(c => {
            const queryMatch = !query || 
                c.case_name.toLowerCase().includes(query.toLowerCase()) ||
                c.summary.toLowerCase().includes(query.toLowerCase()) ||
                c.parties.some(p => p.toLowerCase().includes(query.toLowerCase()));
            
            const judgeMatch = !judge || c.judge.toLowerCase().includes(judge.toLowerCase());
            const partyMatch = !party || c.parties.some(p => p.toLowerCase().includes(party.toLowerCase()));
            
            return queryMatch && judgeMatch && partyMatch;
        });
    }

    /**
     * Get transcripts for a case (in this case, the full opinion text)
     */
    async getTranscripts(caseId) {
        const cases = await this.getCases();
        const caseData = cases.find(c => c.docket_number === caseId);
        return caseData ? caseData.transcripts : [];
    }

    async getTranscriptContent(transcriptId) {
        // Extract opinion ID from transcript ID
        const opinionId = transcriptId.replace('opinion_', '');
        
        try {
            const response = await fetch(
                `${this.courtListenerBaseUrl}/opinions/${opinionId}/?format=json`
            );
            
            if (!response.ok) {
                throw new Error(`Failed to fetch opinion content`);
            }
            
            const data = await response.json();
            return data.plain_text || 'Opinion text not available';
        } catch (error) {
            console.error('Error fetching transcript content:', error);
            return `Unable to fetch opinion content. Error: ${error.message}`;
        }
    }
        return transcripts[transcriptId] || '';
    }

    async downloadTranscript(transcriptId, transcriptTitle) {
        try {
            const content = await this.getTranscriptContent(transcriptId);
            const blob = new Blob([content], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${transcriptTitle.replace(/\s+/g, '_')}_${transcriptId}.txt`;
            document.body.appendChild(link);
            link.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error downloading transcript:', error);
            alert('Failed to download transcript. Please try again.');
        }
    }

    async downloadAllTranscripts(caseId, caseName) {
        try {
            const transcripts = await this.getTranscripts(caseId);
            if (transcripts.length === 0) return;

            let fullContent = `COMPLETE CASE TRANSCRIPTS\n`;
            fullContent += `Case: ${caseName}\n`;
            fullContent += `Docket: ${caseId}\n`;
            fullContent += `Downloaded: ${new Date().toLocaleString()}\n`;
            fullContent += `Data Source: CourtListener API (www.courtlistener.com)\n`;
            fullContent += `${'='.repeat(70)}\n\n`;

            for (const transcript of transcripts) {
                try {
                    const content = await this.getTranscriptContent(transcript.id);
                    fullContent += `\n\nOPINION: ${transcript.title}\n`;
                    fullContent += `Date: ${transcript.date} | Pages: ${transcript.pages}\n`;
                    fullContent += `${'-'.repeat(70)}\n`;
                    fullContent += content;
                    fullContent += `\n\n${'='.repeat(70)}\n`;
                } catch (error) {
                    fullContent += `\n\n[Error fetching opinion ${transcript.id}]\n`;
                }
            }

            const blob = new Blob([fullContent], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${caseName.replace(/\s+/g, '_')}_all_opinions.txt`;
            document.body.appendChild(link);
            link.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error downloading all transcripts:', error);
            alert('Failed to download transcripts. Please try again.');
        }
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
