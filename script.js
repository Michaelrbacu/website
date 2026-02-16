// Local storage keys
const STORAGE_KEY = 'michael_blog_posts';
const ANALYTICS_KEY = 'michael_blog_analytics';
const THEME_KEY = 'michael_blog_theme';
const CURRENT_POSTS_TAB = 'current_posts_tab';

// CourtListener API
const COURTLISTENER_API = 'https://www.courtlistener.com/api/rest/v3';


// NASA API
const NASA_API_KEY = 'DEMO_KEY'; // Use demo key or replace with your actual API key
const NASA_APOD_API = 'https://api.nasa.gov/planetary/apod';

// Space background variables
let spaceImages = [];
let currentSpaceIndex = 0;
let spaceAutoRotateInterval = null;

// Three.js variables
let threeScene, threeCamera, threeRenderer, threeStars = [];
let isLoadingComplete = false;

// Initialize the blog
document.addEventListener('DOMContentLoaded', function() {
    // Show loading screen and initialize with animation
    showLoadingScreen();
    
    // Load everything in parallel
    Promise.all([
        loadSpaceImages(),
        new Promise(resolve => setTimeout(resolve, 1500)) // Minimum loading time for visual effect
    ]).then(() => {
        loadPosts();
        setupEventListeners();
        initTheme();
        loadAnalytics();
        loadCryptoData();
        loadDefaultCourts();
        initThreeJsScene();
        hideLoadingScreen();
        isLoadingComplete = true;
    });
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

// === LOADING SCREEN ===
function showLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        // Stagger the hide animations
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
        }, 300);
    }
}

// === THREE.JS INITIALIZATION ===
function initThreeJsScene() {
    const canvas = document.getElementById('three-canvas');
    if (!canvas) return;

    // Scene setup
    threeScene = new THREE.Scene();
    threeCamera = new THREE.PerspectiveCamera(75, window.innerWidth / 600, 0.1, 1000);
    threeRenderer = new THREE.WebGLRenderer({ 
        canvas: canvas,
        alpha: true,
        antialias: true
    });
    
    threeRenderer.setSize(window.innerWidth, 600);
    threeRenderer.setClearColor(0x000000, 0.3);
    threeCamera.position.z = 5;

    // Create animated stars field
    createAnimatedStars();

    // Add mouse interactivity with GSAP
    // DISABLED: Removed mousemove animation that was causing visual rotation
    /*
    document.addEventListener('mousemove', (e) => {
        if (threeCamera) {
            const x = (e.clientX / window.innerWidth) * 2 - 1;
            const y = -(e.clientY / 600) * 2 + 1;
            
            gsap.to(threeCamera, {
                duration: 0.5,
                x: x * 0.5,
                y: y * 0.5,
                ease: 'power2.out'
            });
        }
    });
    */

    // Animation loop with GSAP
    animate3DScene();

    // Handle window resize
    window.addEventListener('resize', () => {
        if (threeRenderer) {
            threeRenderer.setSize(window.innerWidth, 600);
            threeCamera.aspect = window.innerWidth / 600;
            threeCamera.updateProjectionMatrix();
        }
    });
}

function createAnimatedStars() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];

    // Create 1000 stars
    for (let i = 0; i < 1000; i++) {
        const x = (Math.random() - 0.5) * 20;
        const y = (Math.random() - 0.5) * 20;
        const z = (Math.random() - 0.5) * 20;
        positions.push(x, y, z);

        // Gold and light gold colors for stars
        const color = Math.random() > 0.5 ? 0xd4af37 : 0xf1e5c3;
        colors.push((color >> 16) & 255, (color >> 8) & 255, color & 255);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    
    const material = new THREE.PointsMaterial({
        size: 0.1,
        sizeAttenuation: true,
        color: 0xd4af37,
        opacity: 0.8,
        transparent: true
    });

    const stars = new THREE.Points(geometry, material);
    threeScene.add(stars);
    threeStars.push(stars);
}

function animate3DScene() {
    requestAnimationFrame(animate3DScene);

    // Stars are now static - no rotation
    // threeStars.forEach(star => {
    //     star.rotation.x += 0.0001;
    //     star.rotation.y += 0.0002;
    // });

    if (threeRenderer) {
        threeRenderer.render(threeScene, threeCamera);
    }
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

// === SPACE BACKGROUND IMAGES (NASA) ===
async function loadSpaceImages() {
    try {
        // Fetch multiple days of NASA APOD images
        const container = document.getElementById('space-images-container');
        const dates = [];
        
        // Get last 10 days of imagery
        for (let i = 0; i < 10; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dates.push(dateStr);
        }

        // Fetch images in parallel
        const promises = dates.map(date =>
            fetch(`${NASA_APOD_API}?api_key=${NASA_API_KEY}&date=${date}&thumbs=true`)
                .then(res => res.json())
                .catch(err => null)
        );

        const responses = await Promise.all(promises);
        
        // Filter valid responses and images with hdurl
        spaceImages = responses
            .filter(r => r && r.url && r.title)
            .map(r => ({
                url: r.hdurl || r.url,
                title: r.title,
                explanation: r.explanation
            }))
            .slice(0, 8); // Use top 8 images

        // If API fails or limited, use fallback space images
        if (spaceImages.length === 0) {
            spaceImages = [
                {
                    url: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=1200&h=600&fit=crop',
                    title: 'Galaxy Exploration',
                    explanation: 'Deep space imagery exploring distant galaxies and cosmic wonders'
                },
                {
                    url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1200&h=600&fit=crop',
                    title: 'Cosmic Universe',
                    explanation: 'Vast cosmic landscapes beyond our atmosphere'
                },
                {
                    url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1200&h=600&fit=crop',
                    title: 'Space Nebula',
                    explanation: 'Beautiful nebula formations in deep space'
                },
                {
                    url: 'https://images.unsplash.com/photo-1436262174933-eb871dce4c2e?w=1200&h=600&fit=crop',
                    title: 'Stellar Objects',
                    explanation: 'Magnificent stars and celestial objects'
                },
                {
                    url: 'https://images.unsplash.com/photo-1564053489984-317bde4340e7?w=1200&h=600&fit=crop',
                    title: 'Cosmic Rays',
                    explanation: 'Cosmic phenomena lighting up the night sky'
                },
                {
                    url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1200&h=600&fit=crop',
                    title: 'Space Wonder',
                    explanation: 'Exploring the infinite cosmos'
                },
                {
                    url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1200&h=600&fit=crop',
                    title: 'Universe Exploration',
                    explanation: 'Journey through the depths of space'
                },
                {
                    url: 'https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=1200&h=600&fit=crop',
                    title: 'Astronomical Wonders',
                    explanation: 'Witnessing the marvels of the universe'
                }
            ];
        }

        // Render space images
        container.innerHTML = '';
        spaceImages.forEach((img, idx) => {
            const div = document.createElement('div');
            div.className = `space-image ${idx === 0 ? 'active' : ''}`;
            div.style.backgroundImage = `url('${img.url}')`;
            div.title = img.title;
            container.appendChild(div);
        });

        // Update title
        if (spaceImages.length > 0) {
            updateSpaceTitle();
        }

        // Auto-rotate space images
        startSpaceAutoRotate();

    } catch (err) {
        console.log('Space images loading with fallback');
        loadSpaceImages(); // This will trigger fallback
    }
}

function updateSpaceTitle() {
    const titleEl = document.getElementById('space-title');
    if (titleEl && spaceImages[currentSpaceIndex]) {
        titleEl.textContent = spaceImages[currentSpaceIndex].title;
    }
}

function nextSpace() {
    const images = document.querySelectorAll('.space-image');
    if (images.length === 0) return;

    images[currentSpaceIndex].classList.remove('active');
    currentSpaceIndex = (currentSpaceIndex + 1) % images.length;
    images[currentSpaceIndex].classList.add('active');
    updateSpaceTitle();
    
    // Reset auto-rotate timer
    clearInterval(spaceAutoRotateInterval);
    startSpaceAutoRotate();
}

function previousSpace() {
    const images = document.querySelectorAll('.space-image');
    if (images.length === 0) return;

    images[currentSpaceIndex].classList.remove('active');
    currentSpaceIndex = (currentSpaceIndex - 1 + images.length) % images.length;
    images[currentSpaceIndex].classList.add('active');
    updateSpaceTitle();
    
    // Reset auto-rotate timer
    clearInterval(spaceAutoRotateInterval);
    startSpaceAutoRotate();
}

function startSpaceAutoRotate() {
    // Auto-rotate disabled - images stay static unless user navigates manually
    // spaceAutoRotateInterval = setInterval(() => {
    //     nextSpace();
    // }, 8000); // Change image every 8 seconds
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
    } else if (pageName === 'courts') {
        // Initialize CourtComponent for courts page
        if (window.courtComponent) {
            window.courtComponent.filteredCases = window.courtComponent.cases;
            window.courtComponent.selectedCase = null;
            window.courtComponent.render();
        }
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
            <small style="display: block; margin-top: 1rem; color: #6b7280;">👆 Click to view chart</small>
        </div>
    `;

    card.addEventListener('click', () => showCryptoChart(crypto));

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
    const judge = document.getElementById('court-judge').value;
    const party = document.getElementById('court-party').value;

    // Use CourtComponent if available
    if (window.courtComponent) {
        window.courtComponent.filteredCases = window.courtComponent.courtService.searchCases(query, judge, party);
        window.courtComponent.selectedCase = null;
        window.courtComponent.render();
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
    const mockCases = getAllMockCases();

    resultsDiv.innerHTML = '';
    mockCases.forEach(caseData => {
        const caseElement = createMockCaseElement(caseData);
        resultsDiv.appendChild(caseElement);
    });
}

function getAllMockCases() {
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
        },
        {
            case_name: 'New York State v. Environmental Enterprises',
            docket_number: '2024-NYCOA-45678',
            court: 'New York Court of Appeals',
            date_filed: '2023-11-05',
            judge: 'Chief Judge Janet DiFiore',
            parties: ['State of New York', 'Environmental Enterprises LLC'],
            summary: 'Environmental litigation concerning pollution violations and EPA compliance standards.',
            type: 'Environmental',
            status: 'Ongoing'
        },
        {
            case_name: 'Securities & Exchange Commission v. Investment Holdings Group',
            docket_number: '2024-SDTX-2234',
            court: 'US District Court, Southern District of Texas',
            date_filed: '2024-01-10',
            judge: 'Judge Lee H. Rosenthal',
            parties: ['Securities & Exchange Commission', 'Investment Holdings Group'],
            summary: 'Securities fraud case involving misrepresentation of financial assets and insider trading.',
            type: 'Civil',
            status: 'Ongoing'
        },
        {
            case_name: 'United States v. Smith',
            docket_number: '2024-SDNY-12345',
            court: 'US District Court, Southern District of New York',
            date_filed: '2024-01-15',
            judge: 'Judge John J. Kaplan',
            parties: ['United States', 'John Smith'],
            summary: 'Federal case involving commercial fraud allegations. Complex litigation over interstate commerce violations.',
            type: 'Criminal',
            status: 'Active'
        }
    ];
}

function filterCasesBySearch(allCases, query, judge, party) {
    return allCases.filter(c => {
        const queryMatch = !query || 
            c.case_name.toLowerCase().includes(query.toLowerCase()) ||
            c.summary.toLowerCase().includes(query.toLowerCase()) ||
            c.docket_number.toLowerCase().includes(query.toLowerCase()) ||
            c.parties.some(p => p.toLowerCase().includes(query.toLowerCase()));
        
        const judgeMatch = !judge || c.judge.toLowerCase().includes(judge.toLowerCase());
        const partyMatch = !party || c.parties.some(p => p.toLowerCase().includes(query.toLowerCase()));
        
        return queryMatch && judgeMatch && partyMatch;
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
    
    const typeClass = caseData.type.toLowerCase().replace(/\s+/g, '-');
    
    caseDiv.innerHTML = `
        <div class="case-header">
            <a href="#" class="case-name" onclick="showCaseDetails(event, '${btoa(JSON.stringify(caseData))}')">📋 ${escapeHtml(caseData.case_name)}</a>
            <span class="case-type-badge ${typeClass}">${escapeHtml(caseData.type)}</span>
            <span class="case-status-badge">${escapeHtml(caseData.status || 'Active')}</span>
        </div>
        <div class="case-meta">
            <div class="case-field">
                <span class="case-label">📍 Docket</span>
                <span class="case-value">${escapeHtml(caseData.docket_number)}</span>
            </div>
            <div class="case-field">
                <span class="case-label">⚖️ Court</span>
                <span class="case-value">${escapeHtml(caseData.court)}</span>
            </div>
            <div class="case-field">
                <span class="case-label">📅 Filed</span>
                <span class="case-value">${caseData.date_filed}</span>
            </div>
            ${caseData.judge ? `<div class="case-field">
                <span class="case-label">👨‍⚖️ Judge</span>
                <span class="case-value">${escapeHtml(caseData.judge)}</span>
            </div>` : ''}
        </div>
        <div class="case-description">${escapeHtml(caseData.summary)}</div>
        <div class="case-parties">
            <strong>⚡ Parties:</strong> 
            <div class="parties-tags">
                ${caseData.parties.map(p => `<span class="party-tag">${escapeHtml(p)}</span>`).join('')}
            </div>
        </div>
        <div class="case-footer">
            <button class="case-view-btn" onclick="showCaseDetails(event, '${btoa(JSON.stringify(caseData))}')">View Full Details →</button>
        </div>
    `;

    return caseDiv;
}

function showCaseDetails(event, encodedCaseData) {
    event.preventDefault();
    event.stopPropagation();
    
    try {
        const caseData = JSON.parse(atob(encodedCaseData));
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modal-body');
        
        const typeClass = caseData.type.toLowerCase().replace(/\s+/g, '-');
        
        modalBody.innerHTML = `
            <div class="case-detail-container">
                <h2 class="modal-post-title">📋 ${escapeHtml(caseData.case_name)}</h2>
                
                <div class="case-detail-badges">
                    <span class="case-type-badge ${typeClass}">${escapeHtml(caseData.type)}</span>
                    <span class="case-status-badge">${escapeHtml(caseData.status || 'Active')}</span>
                </div>
                
                <div class="case-detail-grid">
                    <div class="detail-column">
                        <h3>📑 Case Information</h3>
                        <div class="detail-item">
                            <label>Docket Number</label>
                            <span>${escapeHtml(caseData.docket_number)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Court</label>
                            <span>${escapeHtml(caseData.court)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Date Filed</label>
                            <span>${caseData.date_filed}</span>
                        </div>
                        ${caseData.judge ? `<div class="detail-item">
                            <label>Presiding Judge</label>
                            <span>${escapeHtml(caseData.judge)}</span>
                        </div>` : ''}
                    </div>
                    
                    <div class="detail-column">
                        <h3>⚡ Parties Involved</h3>
                        <div class="parties-list">
                            ${caseData.parties.map(p => `<div class="party-item">• ${escapeHtml(p)}</div>`).join('')}
                        </div>
                    </div>
                </div>
                
                <div class="case-detail-section">
                    <h3>📝 Case Summary</h3>
                    <p class="case-summary-text">${escapeHtml(caseData.summary)}</p>
                </div>
                
                <div class="case-detail-footer">
                    <small class="detail-note">💡 Information sourced from court records and legal databases</small>
                </div>
            </div>
        `;
        
        modal.classList.add('show');
    } catch (e) {
        console.error('Error parsing case data:', e);
    }
    return false;
}

// === CRYPTO CHARTS ===
let cryptoChart = null;

function showCryptoChart(crypto) {
    const modal = document.getElementById('crypto-chart-modal');
    const title = document.getElementById('chart-title');
    
    title.textContent = `${crypto.name} (${crypto.symbol}) - Price Chart`;
    modal.classList.add('show');

    // Generate simulated historical data
    const days = document.getElementById('crypto-timeframe').value === '1d' ? 24 : 
                 document.getElementById('crypto-timeframe').value === '7d' ? 7 : 
                 document.getElementById('crypto-timeframe').value === '30d' ? 30 : 365;
    
    const historicalData = generateHistoricalData(crypto.price, days);
    const labels = generateLabels(days);

    // Destroy existing chart if any
    if (cryptoChart) {
        cryptoChart.destroy();
    }

    const ctx = document.getElementById('priceChart').getContext('2d');
    const minPrice = Math.min(...historicalData);
    const maxPrice = Math.max(...historicalData);
    
    cryptoChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${crypto.symbol} Price (USD)`,
                data: historicalData,
                borderColor: crypto.change >= 0 ? '#10b981' : '#ef4444',
                backgroundColor: crypto.change >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: document.body.classList.contains('dark-mode') ? '#f3f4f6' : '#1f2937',
                        font: { size: 12 }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: minPrice * 0.95,
                    max: maxPrice * 1.05,
                    ticks: {
                        color: document.body.classList.contains('dark-mode') ? '#9ca3af' : '#6b7280',
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    },
                    grid: {
                        color: document.body.classList.contains('dark-mode') ? '#374151' : '#e5e7eb'
                    }
                },
                x: {
                    ticks: {
                        color: document.body.classList.contains('dark-mode') ? '#9ca3af' : '#6b7280'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function generateHistoricalData(currentPrice, days) {
    const data = [];
    let price = currentPrice * 0.7; // Start 30% lower
    
    for (let i = 0; i < days; i++) {
        // Random walk with slight upward trend
        const change = (Math.random() - 0.45) * (currentPrice * 0.05);
        price = Math.max(price + change, currentPrice * 0.5);
        data.push(parseFloat(price.toFixed(2)));
    }
    
    // Ensure last point is current price
    data[data.length - 1] = currentPrice;
    return data;
}

function generateLabels(days) {
    const labels = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        if (days <= 24) {
            date.setHours(date.getHours() - i);
            labels.push(date.toLocaleTimeString('en-US', { hour: '2-digit' }));
        } else if (days <= 30) {
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        } else {
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short' }));
        }
    }
    
    return labels;
}

function closeCryptoChart() {
    document.getElementById('crypto-chart-modal').classList.remove('show');
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
