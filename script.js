// Local storage keys
const STORAGE_KEY = 'michael_blog_posts';
const ANALYTICS_KEY = 'michael_blog_analytics';
const THEME_KEY = 'michael_blog_theme';
const CURRENT_POSTS_TAB = 'current_posts_tab';

// CourtListener API
const COURTLISTENER_API = 'https://www.courtlistener.com/api/rest/v3';

// Initialize the blog
document.addEventListener('DOMContentLoaded', function() {
    loadPosts();
    setupEventListeners();
    initTheme();
    loadAnalytics();
    loadCryptoData(); // Load crypto data on startup
    loadDefaultCourts(); // Load default court results on startup
});

// Setup event listeners
function setupEventListeners() {
    const postForm = document.getElementById('post-form');
    postForm.addEventListener('submit', handlePostSubmit);

    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.close');
    closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Blog search
    document.getElementById('blog-search').addEventListener('input', searchPosts);

    // Crypto search
    document.getElementById('crypto-search').addEventListener('input', searchCrypto);

    // Auto-save drafts
    const contentArea = document.getElementById('post-content');
    contentArea.addEventListener('input', function() {
        document.getElementById('char-count').textContent = this.value.length + ' / 10000 characters';
        saveDraft();
    });
}

// === THEME MANAGEMENT ===
function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-toggle').textContent = '☀️';
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    document.getElementById('theme-toggle').textContent = isDark ? '☀️' : '🌙';
}

// === PAGE NAVIGATION ===
function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    document.getElementById(pageName + '-page').classList.add('active');
    document.getElementById('nav-' + pageName).classList.add('active');

    if (pageName === 'admin') {
        loadAdminPostsList();
    } else if (pageName === 'crypto') {
        loadCryptoData();
    }
}

// === BLOG POSTS ===
function handlePostSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const type = document.getElementById('post-type').value;
    const category = document.getElementById('post-category').value.trim();
    const tags = document.getElementById('post-tags').value.split(',').map(t => t.trim()).filter(t => t);
    const videoUrl = document.getElementById('video-url').value.trim();
    const imageUrl = document.getElementById('image-url').value.trim();
    const isDraft = document.getElementById('post-draft').checked;

    if (!title || !content) {
        alert('Please fill in title and content');
        return;
    }

    if (type === 'video' && !videoUrl) {
        alert('Please provide a video URL');
        return;
    }

    if (type === 'image' && !imageUrl) {
        alert('Please provide an image URL');
        return;
    }

    const post = {
        id: Date.now(),
        title: title,
        content: content,
        type: type,
        category: category,
        videoUrl: videoUrl,
        imageUrl: imageUrl,
        tags: tags,
        isDraft: isDraft,
        views: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    savePosts(post);
    document.getElementById('post-form').reset();
    updatePostTypeUI();
    alert('Post ' + (isDraft ? 'saved as draft' : 'published') + ' successfully!');
    loadPosts();
    loadAdminPostsList();
}

function savePosts(newPost) {
    let posts = getPosts();
    posts.unshift(newPost);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

function getPosts() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

function loadPosts() {
    const posts = getPosts().filter(p => !p.isDraft);
    const container = document.getElementById('posts-container');
    const emptyState = document.getElementById('empty-state');

    if (posts.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = '';

    posts.forEach(post => {
        const postElement = createPostCard(post);
        container.appendChild(postElement);
    });
}

function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.dataset.type = post.type;
    card.dataset.views = post.views || 0;
    card.dataset.searchtext = (post.title + ' ' + post.content + ' ' + post.tags.join(' ')).toLowerCase();

    const date = new Date(post.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    let preview = post.content;
    if (preview.length > 150) {
        preview = preview.substring(0, 150) + '...';
    }

    let cardContent = `
        <div class="post-header">
            <span class="post-type-badge ${post.type}">${post.type}</span>
            <h3>${escapeHtml(post.title)}</h3>
            <p class="post-date">${date}</p>
        </div>
    `;

    if (post.type === 'video') {
        cardContent += `
            <div class="video-placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                    <path d="M6.271 5.055a.5.5 0 0 1 .52.038l3.5 2.5a.5.5 0 0 1 0 .814l-3.5 2.5A.5.5 0 0 1 6 10.5v-5a.5.5 0 0 1 .271-.445z"/>
                </svg>
            </div>
        `;
    } else if (post.type === 'image') {
        cardContent += `
            <div class="image-placeholder">
                <img src="${escapeHtml(post.imageUrl)}" alt="Post image" onerror="this.parentElement.innerHTML='<svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"currentColor\" viewBox=\"0 0 16 16\"><path d=\"M14.5 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H1.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h13zM1 2v12h13V2H1z\"/></svg>'">
            </div>
        `;
    } else {
        cardContent += `
            <div class="post-preview">
                <p>${escapeHtml(preview)}</p>
            </div>
        `;
    }

    if (post.category) {
        cardContent += `<div style="padding: 0 1.5rem; color: #6b7280; font-size: 0.85rem;">📁 ${escapeHtml(post.category)}</div>`;
    }

    cardContent += `
        <div class="post-footer">
            <div class="post-tags">
                ${post.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
            </div>
            <div class="post-stats">👁️ ${post.views || 0}</div>
        </div>
    `;

    card.innerHTML = cardContent;
    card.addEventListener('click', () => openModal(post));

    return card;
}

function searchPosts() {
    const query = document.getElementById('blog-search').value.toLowerCase();
    const cards = document.querySelectorAll('.post-card');
    
    cards.forEach(card => {
        if (card.dataset.searchtext.includes(query)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

function filterPosts(type) {
    const cards = document.querySelectorAll('.post-card');
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    cards.forEach(card => {
        if (type === 'all' || card.dataset.type === type) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

function sortPostsByViews() {
    const container = document.getElementById('posts-container');
    const cards = Array.from(document.querySelectorAll('.post-card'));
    
    // Sort by view count (from data attribute)
    cards.sort((a, b) => {
        const viewsA = parseInt(a.dataset.views || 0);
        const viewsB = parseInt(b.dataset.views || 0);
        return viewsB - viewsA;
    });
    
    // Clear and re-add sorted cards
    container.innerHTML = '';
    cards.forEach(card => {
        container.appendChild(card);
    });
}

function openModal(post) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');

    // Increment view count
    let posts = getPosts();
    const postIndex = posts.findIndex(p => p.id === post.id);
    if (postIndex !== -1) {
        posts[postIndex].views = (posts[postIndex].views || 0) + 1;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
    }

    const date = new Date(post.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    let content = `
        <h2 class="modal-post-title">${escapeHtml(post.title)}</h2>
        <div class="modal-post-meta">
            <span>${date}</span>
            ${post.category ? '<span> • ' + escapeHtml(post.category) + '</span>' : ''}
            <span class="post-type-badge ${post.type}">${post.type}</span>
        </div>
    `;

    if (post.type === 'video' && post.videoUrl) {
        const embedUrl = convertToEmbedUrl(post.videoUrl);
        content += `
            <iframe class="modal-video" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>
        `;
    } else if (post.type === 'image' && post.imageUrl) {
        content += `
            <img class="modal-image" src="${escapeHtml(post.imageUrl)}" alt="Post image">
        `;
    }

    content += `
        <div class="modal-post-content">${escapeHtml(post.content)}</div>
    `;

    if (post.tags.length > 0) {
        content += `
            <div class="post-tags">
                ${post.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
            </div>
        `;
    }

    modalBody.innerHTML = content;
    modal.classList.add('show');
}

function closeModal() {
    document.getElementById('modal').classList.remove('show');
}

function convertToEmbedUrl(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        if (url.includes('youtube.com/embed/')) {
            return url;
        }
        const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1];
        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}`;
        }
    }
    if (url.includes('vimeo.com')) {
        const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
        if (videoId) {
            return `https://player.vimeo.com/video/${videoId}`;
        }
    }
    return url;
}

function updatePostTypeUI() {
    const postType = document.getElementById('post-type').value;
    document.getElementById('video-section').classList.toggle('hidden', postType !== 'video');
    document.getElementById('image-section').classList.toggle('hidden', postType !== 'image');
}

// === ADMIN FUNCTIONS ===
function loadAdminPostsList() {
    const tab = localStorage.getItem(CURRENT_POSTS_TAB) || 'published';
    const posts = getPosts();
    const adminList = document.getElementById('admin-posts-list');
    const emptyState = document.getElementById('admin-empty-state');

    const filteredPosts = posts.filter(p => tab === 'published' ? !p.isDraft : p.isDraft);

    if (filteredPosts.length === 0) {
        adminList.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    adminList.innerHTML = '';

    filteredPosts.forEach(post => {
        const date = new Date(post.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const postItem = document.createElement('div');
        postItem.className = 'admin-post-item';
        postItem.innerHTML = `
            <div class="admin-post-info">
                <h4>${escapeHtml(post.title)}</h4>
                <p>${post.type.toUpperCase()} • ${date} • 👁️ ${post.views || 0} views</p>
            </div>
            <div class="admin-post-actions">
                <button class="btn btn-secondary btn-small" onclick="editPost(${post.id})">Edit</button>
                <button class="btn btn-danger btn-small" onclick="deletePost(${post.id})">Delete</button>
            </div>
        `;
        adminList.appendChild(postItem);
    });
}

function switchPostsTab(tab) {
    localStorage.setItem(CURRENT_POSTS_TAB, tab);
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    loadAdminPostsList();
}

function deletePost(postId) {
    if (!confirm('Delete this post?')) return;

    let posts = getPosts();
    posts = posts.filter(p => p.id !== postId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));

    loadPosts();
    loadAdminPostsList();
    alert('Post deleted!');
}

function editPost(postId) {
    const posts = getPosts();
    const post = posts.find(p => p.id === postId);

    if (!post) return;

    document.getElementById('post-title').value = post.title;
    document.getElementById('post-content').value = post.content;
    document.getElementById('post-type').value = post.type;
    document.getElementById('post-category').value = post.category || '';
    document.getElementById('video-url').value = post.videoUrl || '';
    document.getElementById('image-url').value = post.imageUrl || '';
    document.getElementById('post-tags').value = post.tags.join(', ');
    document.getElementById('post-draft').checked = post.isDraft;

    updatePostTypeUI();
    deletePost(postId);

    document.querySelector('.admin-section').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('post-title').focus();
}

function saveDraft() {
    const title = document.getElementById('post-title').value;
    const content = document.getElementById('post-content').value;
    if (title || content) {
        localStorage.setItem('post_draft', JSON.stringify({
            title, content, timestamp: Date.now()
        }));
    }
}

function exportPosts() {
    const posts = getPosts();
    const dataStr = JSON.stringify(posts, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `blog-posts-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

function downloadBackup() {
    const backup = {
        posts: getPosts(),
        analytics: getAnalytics(),
        exported: new Date().toISOString()
    };
    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `blog-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

function viewAnalytics() {
    const analytics = getAnalytics();
    const posts = getPosts();
    const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
    const topPost = posts.reduce((max, p) => (p.views || 0) > (max.views || 0) ? p : max, {});

    alert(`📊 ANALYTICS\n\nTotal Posts: ${posts.length}\nTotal Views: ${totalViews}\nTop Post: ${topPost.title || 'N/A'} (${topPost.views || 0} views)`);
}

// === ANALYTICS ===
function getAnalytics() {
    const stored = localStorage.getItem(ANALYTICS_KEY);
    return stored ? JSON.parse(stored) : { visits: 0, lastVisit: null };
}

function loadAnalytics() {
    let analytics = getAnalytics();
    analytics.visits = (analytics.visits || 0) + 1;
    analytics.lastVisit = new Date().toISOString();
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));
}

// === CRYPTO TRACKING ===
function loadCryptoData() {
    const timeframe = document.getElementById('crypto-timeframe')?.value || '1y';
    const cryptoList = document.getElementById('crypto-list');
    
    if (!cryptoList) return; // If page not ready yet, skip

    // Simulated crypto data with predictions (sorted by potential gain)
    const cryptoData = [
        { name: 'Solana', symbol: 'SOL', price: 198, change: 12.3, prediction: 220, signal: 'buy' },
        { name: 'Ripple', symbol: 'XRP', price: 2.45, change: 8.5, prediction: 3.2, signal: 'buy' },
        { name: 'Bitcoin', symbol: 'BTC', price: 42850, change: 5.2, prediction: 45000, signal: 'buy' },
        { name: 'Ethereum', symbol: 'ETH', price: 2280, change: 3.8, prediction: 2500, signal: 'hold' },
        { name: 'Binance Coin', symbol: 'BNB', price: 612, change: -2.1, prediction: 580, signal: 'hold' },
        { name: 'Cardano', symbol: 'ADA', price: 0.98, change: -1.2, prediction: 1.1, signal: 'hold' },
    ];

    cryptoList.innerHTML = '';
    cryptoData.forEach(crypto => {
        const card = createCryptoCard(crypto);
        cryptoList.appendChild(card);
    });
}

function createCryptoCard(crypto) {
    const card = document.createElement('div');
    card.className = 'crypto-card';
    card.dataset.searchtext = (crypto.name + ' ' + crypto.symbol).toLowerCase();

    const changeClass = crypto.change >= 0 ? 'positive' : 'negative';
    const changeSymbol = crypto.change >= 0 ? '▲' : '▼';
    const potentialGain = ((crypto.prediction - crypto.price) / crypto.price * 100).toFixed(1);

    card.innerHTML = `
        <div class="crypto-name">${crypto.name}</div>
        <div class="crypto-symbol">${crypto.symbol}</div>
        <div class="crypto-price">$${crypto.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
        <div class="crypto-change ${changeClass}">${changeSymbol} ${Math.abs(crypto.change).toFixed(2)}%</div>
        
        <div class="crypto-prediction">
            <strong>24h Prediction: $${crypto.prediction.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong>
            <div style="margin-top: 0.5rem; color: ${potentialGain > 0 ? '#10b981' : '#ef4444'}">
                Potential: ${potentialGain > 0 ? '+' : ''}${potentialGain}%
            </div>
            <div class="signal ${crypto.signal}">
                ${crypto.signal.toUpperCase()}
            </div>
        </div>
    `;

    return card;
}

function searchCrypto() {
    const query = document.getElementById('crypto-search').value.toLowerCase();
    const cards = document.querySelectorAll('.crypto-card');
    
    cards.forEach(card => {
        if (card.dataset.searchtext.includes(query)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

// === COURT DOCUMENTS ===
async function searchCourts() {
    const query = document.getElementById('court-search-query').value;
    const jurisdiction = document.getElementById('court-jurisdiction').value;
    const judge = document.getElementById('court-judge').value;
    const party = document.getElementById('court-party').value;

    if (!query) {
        alert('Please enter a search query');
        return;
    }

    const resultsDiv = document.getElementById('courts-results');
    resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div>Searching court documents...</div>';

    try {
        const searchParams = new URLSearchParams();
        if (query) searchParams.append('q', query);
        if (party) searchParams.append('party_name', party);

        const url = `https://www.courtlistener.com/api/rest/v3/search/?${searchParams.toString()}&format=json`;
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                displayCourtResults(data.results);
            } else {
                resultsDiv.innerHTML = '<div class="empty-state"><p>No court documents found. Try a different search.</p></div>';
            }
        } else {
            displayMockCourtResults();
        }
    } catch (error) {
        console.log('Using demo court data');
        displayMockCourtResults();
    }
}

function displayCourtResults(results) {
    const resultsDiv = document.getElementById('courts-results');
    resultsDiv.innerHTML = '';

    results.slice(0, 20).forEach(result => {
        const caseElement = createCaseElement(result);
        resultsDiv.appendChild(caseElement);
    });
}

function displayMockCourtResults() {
    const resultsDiv = document.getElementById('courts-results');
    const mockCases = [
        {
            case_name: 'United States v. Smith',
            docket_number: '2024-CV-12345',
            court: 'US District Court, Southern District of New York',
            date_filed: '2024-01-15',
            parties: ['United States', 'John Smith'],
            summary: 'Federal case involving commercial fraud allegations. Complex litigation over interstate commerce violations.'
        },
        {
            case_name: 'State v. Johnson',
            docket_number: '2024-CA-54321',
            court: 'California Superior Court',
            date_filed: '2024-02-10',
            parties: ['State of California', 'Michael Johnson'],
            summary: 'State criminal case with multiple charges. High-profile case with significant media attention.'
        },
        {
            case_name: 'Federal Trade Commission v. TechCorp Inc.',
            docket_number: '2024-FTCU-8901',
            court: 'US District Court, Northern District of California',
            date_filed: '2024-01-20',
            parties: ['Federal Trade Commission', 'TechCorp Inc.'],
            summary: 'Antitrust case involving alleged monopolistic practices in the technology sector.'
        },
        {
            case_name: 'New York State v. Environmental Enterprises',
            docket_number: '2024-NY-45678',
            court: 'New York Court of Appeals',
            date_filed: '2023-11-05',
            parties: ['State of New York', 'Environmental Enterprises LLC'],
            summary: 'Environmental litigation concerning pollution violations and EPA compliance standards.'
        },
        {
            case_name: 'Securities & Exchange Commission v. Investment Holdings',
            docket_number: '2024-SEC-2234',
            court: 'US District Court, Southern District of Texas',
            date_filed: '2024-01-10',
            parties: ['Securities & Exchange Commission', 'Investment Holdings Group'],
            summary: 'Securities fraud case involving misrepresentation of financial assets and insider trading.'
        }
    ];

    resultsDiv.innerHTML = '';
    mockCases.forEach(caseData => {
        const caseElement = createMockCaseElement(caseData);
        resultsDiv.appendChild(caseElement);
    });
}

function loadDefaultCourts() {
    const resultsDiv = document.getElementById('courts-results');
    if (resultsDiv) {
        displayMockCourtResults();
    }
}

function createCaseElement(result) {
    const caseDiv = document.createElement('div');
    caseDiv.className = 'court-case';
    
    caseDiv.innerHTML = `
        <a href="${result.absolute_url || '#'}" target="_blank" class="case-name">${escapeHtml(result.case_name)}</a>
        <div class="case-meta">
            <div class="case-field">
                <span class="case-label">Docket #</span>
                <span>${escapeHtml(result.docket_number || 'N/A')}</span>
            </div>
            <div class="case-field">
                <span class="case-label">Court</span>
                <span>${escapeHtml(result.court || 'N/A')}</span>
            </div>
            <div class="case-field">
                <span class="case-label">Filed</span>
                <span>${result.date_filed || 'N/A'}</span>
            </div>
        </div>
    `;

    return caseDiv;
}

function createMockCaseElement(caseData) {
    const caseDiv = document.createElement('div');
    caseDiv.className = 'court-case';
    
    caseDiv.innerHTML = `
        <a href="#" class="case-name">${escapeHtml(caseData.case_name)}</a>
        <div class="case-meta">
            <div class="case-field">
                <span class="case-label">Docket #</span>
                <span>${escapeHtml(caseData.docket_number)}</span>
            </div>
            <div class="case-field">
                <span class="case-label">Court</span>
                <span>${escapeHtml(caseData.court)}</span>
            </div>
            <div class="case-field">
                <span class="case-label">Filed</span>
                <span>${caseData.date_filed}</span>
            </div>
        </div>
        <div class="case-description">${escapeHtml(caseData.summary)}</div>
        <div class="case-link">
            <strong>Parties:</strong> ${caseData.parties.map(p => escapeHtml(p)).join(', ')}
        </div>
    `;

    return caseDiv;
}

// === UTILITIES ===
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
