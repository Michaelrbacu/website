// Local storage key for posts
const STORAGE_KEY = 'michael_blog_posts';

// Initialize the blog
document.addEventListener('DOMContentLoaded', function() {
    loadPosts();
    setupEventListeners();
});

// Event Listeners
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
}

// Handle page navigation
function showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Remove active state from nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Show selected page
    document.getElementById(pageName + '-page').classList.add('active');
    document.getElementById('nav-' + pageName).classList.add('active');

    // Refresh admin list if admin page is opened
    if (pageName === 'admin') {
        loadAdminPostsList();
    }
}

// Handle post form submission
function handlePostSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const type = document.getElementById('post-type').value;
    const tags = document.getElementById('post-tags').value.split(',').map(t => t.trim()).filter(t => t);
    const videoUrl = document.getElementById('video-url').value.trim();

    if (!title || !content) {
        alert('Please fill in all required fields');
        return;
    }

    if (type === 'video' && !videoUrl) {
        alert('Please provide a video URL');
        return;
    }

    // Create post object
    const post = {
        id: Date.now(),
        title: title,
        content: content,
        type: type,
        videoUrl: videoUrl,
        tags: tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    // Save post
    savePosts(post);

    // Reset form
    document.getElementById('post-form').reset();
    updatePostTypeUI();

    // Show success message
    alert('Post created successfully!');

    // Reload posts
    loadPosts();
    loadAdminPostsList();
}

// Save posts to localStorage
function savePosts(newPost) {
    let posts = getPosts();
    posts.unshift(newPost); // Add new post to the beginning
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

// Get posts from localStorage
function getPosts() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

// Load and display posts on blog page
function loadPosts() {
    const posts = getPosts();
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

// Create post card element
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.dataset.type = post.type;

    const date = new Date(post.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
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
    } else {
        cardContent += `
            <div class="post-preview">
                <p>${escapeHtml(preview)}</p>
            </div>
        `;
    }

    cardContent += `
        <div class="post-footer">
            <div class="post-tags">
                ${post.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
            </div>
        </div>
    `;

    card.innerHTML = cardContent;
    card.addEventListener('click', () => openModal(post));

    return card;
}

// Filter posts
function filterPosts(type) {
    const cards = document.querySelectorAll('.post-card');
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Show/hide cards based on filter
    cards.forEach(card => {
        if (type === 'all' || card.dataset.type === type) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

// Open modal with full post
function openModal(post) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');

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
            <span class="post-type-badge ${post.type}">${post.type}</span>
        </div>
    `;

    if (post.type === 'video' && post.videoUrl) {
        const embedUrl = convertToEmbedUrl(post.videoUrl);
        content += `
            <iframe class="modal-video" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>
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

// Close modal
function closeModal() {
    document.getElementById('modal').classList.remove('show');
}

// Convert video URL to embed format
function convertToEmbedUrl(url) {
    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        if (url.includes('youtube.com/embed/')) {
            return url;
        }
        const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1];
        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}`;
        }
    }
    // Vimeo
    if (url.includes('vimeo.com')) {
        const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
        if (videoId) {
            return `https://player.vimeo.com/video/${videoId}`;
        }
    }
    // If it's already an embed URL or direct video file
    return url;
}

// Load admin posts list
function loadAdminPostsList() {
    const posts = getPosts();
    const adminList = document.getElementById('admin-posts-list');
    const emptyState = document.getElementById('admin-empty-state');

    if (posts.length === 0) {
        adminList.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    adminList.innerHTML = '';

    posts.forEach(post => {
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
                <p>${post.type.toUpperCase()} • ${date}</p>
            </div>
            <div class="admin-post-actions">
                <button class="btn btn-secondary btn-small" onclick="editPost(${post.id})">Edit</button>
                <button class="btn btn-danger btn-small" onclick="deletePost(${post.id})">Delete</button>
            </div>
        `;
        adminList.appendChild(postItem);
    });
}

// Delete post
function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) {
        return;
    }

    let posts = getPosts();
    posts = posts.filter(p => p.id !== postId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));

    loadPosts();
    loadAdminPostsList();
    alert('Post deleted successfully!');
}

// Edit post (simple implementation - repopulates form)
function editPost(postId) {
    const posts = getPosts();
    const post = posts.find(p => p.id === postId);

    if (!post) return;

    document.getElementById('post-title').value = post.title;
    document.getElementById('post-content').value = post.content;
    document.getElementById('post-type').value = post.type;
    document.getElementById('video-url').value = post.videoUrl || '';
    document.getElementById('post-tags').value = post.tags.join(', ');

    updatePostTypeUI();

    // Delete the old post
    deletePost(postId);

    // Scroll to form
    document.querySelector('.admin-section').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('post-title').focus();
}

// Update post type UI
function updatePostTypeUI() {
    const postType = document.getElementById('post-type').value;
    const videoSection = document.getElementById('video-section');

    if (postType === 'video') {
        videoSection.classList.remove('hidden');
    } else {
        videoSection.classList.add('hidden');
    }
}

// Utility function to escape HTML
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
