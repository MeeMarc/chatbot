// Global Variables
let conversationHistory = [];
let currentConversationId = null;
let conversations = [];
let isCreatingConversation = false; // Flag to prevent duplicate conversation creation

// Message Batching System - Collect messages and respond once with all context
let pendingMessages = [];
let batchTimeout = null;
let isGeneratingResponse = false;
let abortController = null; // For canceling AI requests
const BATCH_DELAY = 500; // Wait 500ms after last message before responding (allows multiple rapid messages to batch together)

// ========================================
// API Helper Functions
// ========================================

function getAuthToken() {
    return localStorage.getItem('authToken') || null;
}

async function apiRequest(endpoint, options = {}) {
    const token = getAuthToken();
    if (!token && !options.skipAuth) {
        // For guest users, allow API calls without auth (they'll use localStorage)
        if (isGuestMode()) {
            throw new Error('Guest mode - using local storage');
        }
        // For authenticated users without token, throw error
        throw new Error('Not authenticated');
    }
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && !options.skipAuth ? { 'Authorization': `Bearer ${token}` } : {})
        },
        ...options
    };
    
    try {
        const response = await fetch(endpoint, defaultOptions);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

// Mobile Keyboard Handling - Position input area directly above keyboard
function handleMobileKeyboard() {
    const inputArea = document.querySelector('.input-area');
    const input = document.getElementById('user-input');
    if (!inputArea || !input) return;
    
    // Use Visual Viewport API if available (modern browsers)
    if (window.visualViewport) {
        const viewport = window.visualViewport;
        
        function adjustForKeyboard() {
            // Get viewport dimensions
            const viewportHeight = viewport.height;
            const viewportTop = viewport.offsetTop;
            const viewportBottom = viewportTop + viewportHeight;
            const windowHeight = window.innerHeight;
            
            // Calculate keyboard height
            const keyboardHeight = windowHeight - viewportBottom;
            
            // If keyboard is open (keyboard height is significant)
            if (keyboardHeight > 100) {
                // Position input area fixed directly above keyboard
                // bottom should equal keyboard height to sit right above it
                inputArea.style.position = 'fixed';
                inputArea.style.bottom = `${keyboardHeight}px`;
                inputArea.style.left = '0';
                inputArea.style.right = '0';
                inputArea.style.width = '100%';
                inputArea.style.zIndex = '1000';
                inputArea.style.transform = 'none';
            } else {
                // Keyboard closed - return to normal position
                inputArea.style.position = 'relative';
                inputArea.style.bottom = 'auto';
                inputArea.style.left = 'auto';
                inputArea.style.right = 'auto';
                inputArea.style.width = 'auto';
                inputArea.style.transform = 'none';
            }
        }
        
        viewport.addEventListener('resize', adjustForKeyboard);
        viewport.addEventListener('scroll', adjustForKeyboard);
        
        // Also handle input focus/blur for immediate feedback
        input.addEventListener('focus', () => {
            setTimeout(adjustForKeyboard, 100);
        });
        
        input.addEventListener('blur', () => {
            setTimeout(() => {
                inputArea.style.position = 'relative';
                inputArea.style.bottom = 'auto';
                inputArea.style.left = 'auto';
                inputArea.style.right = 'auto';
                inputArea.style.width = 'auto';
                inputArea.style.transform = 'none';
            }, 300);
        });
    } else {
        // Fallback for older browsers - detect window resize
        let initialHeight = window.innerHeight;
        
        function adjustForKeyboardFallback() {
            const currentHeight = window.innerHeight;
            const heightDiff = initialHeight - currentHeight;
            
            // If keyboard is open (window height decreased significantly)
            if (heightDiff > 150) {
                // Position input area fixed at bottom of visible area
                inputArea.style.position = 'fixed';
                inputArea.style.bottom = '0';
                inputArea.style.left = '0';
                inputArea.style.right = '0';
                inputArea.style.width = '100%';
                inputArea.style.zIndex = '1000';
                inputArea.style.transform = 'none';
            } else {
                // Keyboard closed
                inputArea.style.position = 'relative';
                inputArea.style.bottom = 'auto';
                inputArea.style.left = 'auto';
                inputArea.style.right = 'auto';
                inputArea.style.width = 'auto';
                inputArea.style.transform = 'none';
            }
        }
        
        window.addEventListener('resize', adjustForKeyboardFallback);
        
        // Handle input focus/blur
        input.addEventListener('focus', () => {
            setTimeout(adjustForKeyboardFallback, 300);
        });
        
        input.addEventListener('blur', () => {
            setTimeout(() => {
                inputArea.style.position = 'relative';
                inputArea.style.bottom = 'auto';
                inputArea.style.left = 'auto';
                inputArea.style.right = 'auto';
                inputArea.style.width = 'auto';
                inputArea.style.transform = 'none';
            }, 300);
        });
    }
}

// Initialize app when page loads (for chat.html only)
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in (for chat.html)
    // Run async checkAuthentication without blocking
    (async function() {
        try {
            await checkAuthentication();
        } catch (error) {
            console.error('❌ Error in checkAuthentication:', error);
            // Still show chat UI even if auth check fails
            const chat = document.getElementById('chat');
            if (chat) chat.style.display = 'flex';
        }
    })();
    
    // Initialize mobile keyboard handling
    handleMobileKeyboard();
    
    checkInternetConnection();
    // Update status indicator after DOM is loaded
    setTimeout(() => {
        updateStatusIndicator();
    }, 100);
    // Check connection status periodically (reduced frequency for performance)
    // Only check when tab is visible to save resources
    let connectionCheckInterval = null;
    function startConnectionCheck() {
        if (connectionCheckInterval) clearInterval(connectionCheckInterval);
        connectionCheckInterval = setInterval(() => {
            // Only check if tab is visible
            if (!document.hidden) {
                checkInternetConnection();
            }
        }, 60000); // Reduced to every 60 seconds (was 30)
    }
    
    // Start checking when tab is visible
    if (!document.hidden) {
        startConnectionCheck();
    }
    
    // Pause checking when tab is hidden, resume when visible
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (connectionCheckInterval) {
                clearInterval(connectionCheckInterval);
                connectionCheckInterval = null;
            }
        } else {
            startConnectionCheck();
            checkInternetConnection(); // Check immediately when tab becomes visible
        }
    });
});

// Helper function to check if user is guest
function isGuestMode() {
    return sessionStorage.getItem('isGuest') === 'true';
}

// Helper function to get current user (checks both localStorage and sessionStorage)
function getCurrentUser() {
    const localUser = localStorage.getItem('currentUser');
    const sessionUser = sessionStorage.getItem('currentUser');
    const userString = sessionUser || localUser;
    return userString ? JSON.parse(userString) : null;
}

// Helper function to get storage (localStorage for regular users, sessionStorage for guests)
function getStorage() {
    return isGuestMode() ? sessionStorage : localStorage;
}

// Authentication Functions (for chat.html only)
function checkAuthentication() {
    const currentUser = getCurrentUser();
    const isLoggedIn = localStorage.getItem('isLoggedIn') || sessionStorage.getItem('isLoggedIn');
    
    if (!currentUser || isLoggedIn !== 'true') {
        // User is not logged in, redirect to login
        window.location.href = '/login';
        return;
    }
    
    // User is logged in, initialize chat interface
    const user = currentUser;
    const usernameElement = document.getElementById('current-username');
    const usernameShortElement = document.getElementById('current-username-short');
    const usernameFullElement = document.getElementById('current-username-full');
    const userEmailElement = document.getElementById('current-user-email');
    
    const displayName = user.isGuest ? 'Guest' : (user.name || 'User');
    const displayEmail = user.isGuest ? 'Anonymous' : (user.email || '');
    
    if (usernameElement) usernameElement.textContent = displayName;
    if (usernameShortElement) usernameShortElement.textContent = displayName;
    if (usernameFullElement) usernameFullElement.textContent = displayName;
    if (userEmailElement) userEmailElement.textContent = displayEmail;
    
    // Update logout button text and styling for guest users
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        if (user.isGuest) {
            logoutBtn.innerHTML = '🔐 Log in';
            logoutBtn.classList.add('guest-login');
        } else {
            logoutBtn.innerHTML = '🚪 Logout';
            logoutBtn.classList.remove('guest-login');
        }
    }
    
    // Always update status indicator immediately
    updateStatusIndicator();

    // Start chat UI (AI keys are now managed by backend .env)
    const prechat = document.getElementById('prechat');
    if (prechat) {
        prechat.style.display = 'flex';
    }
    setTimeout(() => {
        if (prechat) {
            prechat.style.display = 'none';
        }
        (async () => {
            try {
                await startChat();
                updateStatusIndicator();
            } catch (error) {
                console.error('❌ Error starting chat:', error);
                const chat = document.getElementById('chat');
                if (chat) chat.style.display = 'flex';
            }
        })();
    }, 1200);
}

// Custom Confirmation Modal
function showConfirmModal(options) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmation-modal');
        const icon = document.getElementById('modal-icon');
        const title = document.getElementById('modal-title');
        const message = document.getElementById('modal-message');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const confirmBtn = document.getElementById('modal-confirm-btn');
        
        // Set content
        icon.textContent = options.icon || '⚠️';
        title.textContent = options.title || 'Confirm Action';
        message.textContent = options.message || 'Are you sure you want to proceed?';
        confirmBtn.textContent = options.confirmText || 'Confirm';
        cancelBtn.textContent = options.cancelText || 'Cancel';
        
        // Style confirm button based on type
        if (options.type === 'danger') {
            confirmBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            confirmBtn.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
        } else {
            confirmBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            confirmBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
        }
        
        // Show modal
        modal.style.display = 'flex';
        
        // Handle cancel
        const handleCancel = () => {
            modal.style.display = 'none';
            cancelBtn.removeEventListener('click', handleCancel);
            confirmBtn.removeEventListener('click', handleConfirm);
            modal.removeEventListener('click', handleOverlayClick);
            resolve(false);
        };
        
        // Handle confirm
        const handleConfirm = () => {
            modal.style.display = 'none';
            cancelBtn.removeEventListener('click', handleCancel);
            confirmBtn.removeEventListener('click', handleConfirm);
            modal.removeEventListener('click', handleOverlayClick);
            resolve(true);
        };
        
        // Handle overlay click
        const handleOverlayClick = (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        };
        
        cancelBtn.addEventListener('click', handleCancel);
        confirmBtn.addEventListener('click', handleConfirm);
        modal.addEventListener('click', handleOverlayClick);
    });
}

// Toast Notification System
function showToast(options) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${options.type || 'info'}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    const titles = {
        success: 'Success',
        error: 'Error',
        warning: 'Warning',
        info: 'Information'
    };
    
    const icon = options.icon || icons[options.type || 'info'];
    const title = options.title || titles[options.type || 'info'];
    const message = options.message || '';
    const duration = options.duration || 5000;
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            ${title ? `<div class="toast-title">${title}</div>` : ''}
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" type="button">✕</button>
        <div class="toast-progress"></div>
    `;
    
    // Add close button event listener
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            toast.classList.add('toast-slide-out');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        });
    }
    
    container.appendChild(toast);
    
    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.add('toast-slide-out');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }, duration);
    }
}

function logout() {
    const isGuest = isGuestMode();
    
    // For guest users, just redirect to login without confirmation
    if (isGuest) {
        const storage = getStorage();
        storage.removeItem('currentUser');
        storage.removeItem('isLoggedIn');
        storage.removeItem('isGuest');
        
        // Clear all guest data
        Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('conversations_') || key.includes('guest')) {
                sessionStorage.removeItem(key);
            }
        });
        
        // Also clear localStorage auth if exists
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isLoggedIn');
        
        conversationHistory = [];
        conversations = [];
        window.location.href = '/login';
        console.log('👋 Guest exited');
        return;
    }
    
    // For authenticated users, show confirmation modal
    showConfirmModal({
        icon: '🚪',
        title: 'Logout',
        message: 'Are you sure you want to logout?',
        confirmText: 'Logout',
        cancelText: 'Cancel',
        type: 'danger'
    }).then((confirmed) => {
        if (confirmed) {
            const storage = getStorage();
            storage.removeItem('currentUser');
            storage.removeItem('isLoggedIn');
            storage.removeItem('isGuest');
            
            // Also clear localStorage auth if exists
            localStorage.removeItem('currentUser');
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('authToken');
            
            conversationHistory = [];
            conversations = [];
            window.location.href = '/login';
            console.log('👋 User logged out');
        }
    });
}

// Chat Initialization
async function startChat() {
    const prechat = document.getElementById('prechat');
    const chat = document.getElementById('chat');
    const messages = document.getElementById('messages');

    // AI keys are server-managed; always show chat interface.
    if (prechat) {
        const setupPrompt = document.getElementById('setup-prompt');
        if (setupPrompt) setupPrompt.remove();
        prechat.style.display = 'none';
    }
    if (chat) chat.style.display = 'flex';

    // ALWAYS start with a new empty chat - reset everything
    currentConversationId = null;
    conversationHistory = [];

    // Clear messages display
    if (messages) {
        messages.innerHTML = '';
    }

    // Show welcome message when chat is empty
    toggleWelcomeMessage();

    // Load conversations list (with error handling)
    try {
        await loadConversations();
    } catch (error) {
        console.error('❌ Error loading conversations:', error);
        conversations = []; // Fallback to empty array
    }
    renderConversationsList();
    toggleWelcomeMessage(); // Update welcome/no chat history display
    
    updateStatusIndicator();
}

// Dismiss setup prompt and use fallback mode
async function dismissSetupPrompt() {
    const prechat = document.getElementById('prechat');
    const chat = document.getElementById('chat');
    const setupPrompt = document.getElementById('setup-prompt');
    
    if (setupPrompt) {
        setupPrompt.style.display = 'none';
    }
    
    // Show chat interface with fallback mode
    if (prechat) prechat.style.display = 'none';
    if (chat) chat.style.display = 'flex';
    
    // Always start with empty chat
    const messages = document.getElementById('messages');
    if (messages) {
        messages.innerHTML = '';
    }
    
    // Show welcome message when chat is empty
    toggleWelcomeMessage();
    
    // Load conversations
    try {
        await loadConversations();
    } catch (error) {
        console.error('❌ Error loading conversations:', error);
        conversations = []; // Fallback to empty array
    }
    renderConversationsList();
    toggleWelcomeMessage(); // Update welcome/no chat history display
    
    updateStatusIndicator();
}

// Status Indicator Functions
function updateStatusIndicator() {
    // Status indicator removed - function kept to prevent errors if called elsewhere
    return;
}

function checkInternetConnection() {
    // Check if navigator.onLine is available
    if (navigator.onLine === false) {
        console.warn('⚠️ No internet connection detected');
        return false;
    }
    
    // Try to fetch a small resource to verify actual connectivity
    fetch('https://www.google.com/favicon.ico', { 
        method: 'HEAD', 
        mode: 'no-cors',
        cache: 'no-cache'
    })
    .then(() => {
        console.log('✅ Internet connection confirmed');
    })
    .catch(() => {
        console.warn('⚠️ Cannot reach internet - API calls may fail');
    });
    
    return navigator.onLine;
}

// Conversations Management System
async function loadConversations() {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
        console.warn('⚠️ No current user found when loading conversations');
        conversations = [];
        return;
    }
    
    // For guest users, still use localStorage/sessionStorage
    if (isGuestMode()) {
        const storage = getStorage();
        const userEmail = currentUser.email || 'default';
        const conversationsKey = `conversations_${userEmail}`;
        const storedConversations = storage.getItem(conversationsKey);
        
        if (storedConversations) {
            try {
                conversations = JSON.parse(storedConversations);
                if (!Array.isArray(conversations)) {
                    conversations = [];
                }
                conversations.sort((a, b) => {
                    const dateA = new Date(a.updatedAt || a.createdAt || 0);
                    const dateB = new Date(b.updatedAt || b.createdAt || 0);
                    return dateB - dateA;
                });
                console.log(`✅ Loaded ${conversations.length} conversation(s) for guest`);
            } catch (error) {
                console.error('❌ Error parsing conversations:', error);
                conversations = [];
            }
        } else {
            conversations = [];
        }
        return;
    }
    
    // For authenticated users, fetch from database
    try {
        const data = await apiRequest('/api/conversations', { method: 'GET' });
        conversations = data.map(conv => ({
            id: conv.id,
            title: conv.title,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            messages: [] // Messages loaded separately when conversation is opened
        }));
        console.log(`✅ Loaded ${conversations.length} conversation(s) from database`);
    } catch (error) {
        console.error('❌ Error loading conversations from database:', error);
        conversations = [];
        // Fallback to localStorage if API fails
        const storage = getStorage();
        const userEmail = currentUser.email || 'default';
        const conversationsKey = `conversations_${userEmail}`;
        const storedConversations = storage.getItem(conversationsKey);
        if (storedConversations) {
            try {
                conversations = JSON.parse(storedConversations);
                if (!Array.isArray(conversations)) conversations = [];
            } catch (e) {
                conversations = [];
            }
        }
    }
}

function saveConversations() {
    // For guest users, still use localStorage/sessionStorage
    if (isGuestMode()) {
        const currentUser = getCurrentUser();
        const storage = getStorage();
        
        if (!currentUser) {
            console.warn('⚠️ No current user found when saving conversations');
            return;
        }
        
        const userEmail = currentUser.email || 'default';
        const conversationsKey = `conversations_${userEmail}`;
        
        try {
            storage.setItem(conversationsKey, JSON.stringify(conversations));
            console.log(`✅ Saved ${conversations.length} conversation(s) for guest`);
        } catch (error) {
            console.error('❌ Error saving conversations:', error);
        }
        return;
    }
    
    // For authenticated users, conversations are stored in database
    // This function is kept for local state management but doesn't save to storage
    // Conversations are saved to database when messages are added/updated
}

function createNewConversation() {
    // Don't create conversation in list yet - only create when first message is sent
    currentConversationId = null; // Reset to null so it creates on first message
    conversationHistory = [];
    
    // Clear messages display
    const messages = document.getElementById('messages');
    if (messages) {
        messages.innerHTML = '';
    }
    
    // Show welcome message when chat is empty
    toggleWelcomeMessage();
    
    return null; // No conversation ID until first message
}

async function createNewConversationOnFirstMessage() {
    // For guest users, create local conversation
    if (isGuestMode()) {
        const conversationId = 'conv_' + Date.now();
        currentConversationId = conversationId;
        
        const newConversation = {
            id: conversationId,
            title: 'New Chat',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        conversations.unshift(newConversation);
        saveConversations();
        renderConversationsList();
        toggleWelcomeMessage();
        
        return conversationId;
    }
    
    // For authenticated users, create conversation in database
    try {
        const data = await apiRequest('/api/conversations', {
            method: 'POST',
            body: JSON.stringify({ title: 'New Chat' })
        });
        
        currentConversationId = data.id;
        
        const newConversation = {
            id: data.id,
            title: data.title,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            messages: []
        };
        
        conversations.unshift(newConversation);
        // Reload conversations to ensure sync with database (optional - local update is usually enough)
        renderConversationsList();
        toggleWelcomeMessage();
        
        return data.id;
    } catch (error) {
        console.error('❌ Error creating conversation:', error);
        // Fallback to local conversation if API fails
        const conversationId = 'conv_' + Date.now();
        currentConversationId = conversationId;
        
        const newConversation = {
            id: conversationId,
            title: 'New Chat',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        conversations.unshift(newConversation);
        saveConversations();
        renderConversationsList();
        toggleWelcomeMessage();
        
        return conversationId;
    }
}

async function saveCurrentConversation() {
    const messagesDiv = document.getElementById('messages');
    if (!messagesDiv) return;
    
    const messageCount = messagesDiv.children.length;
    
    // Only create conversation if there are messages and no conversation exists
    // Use flag to prevent duplicate creation when called multiple times rapidly
    if (!currentConversationId && messageCount > 0 && !isCreatingConversation) {
        isCreatingConversation = true;
        try {
            await createNewConversationOnFirstMessage();
        } finally {
            isCreatingConversation = false;
        }
    }
    
    if (!currentConversationId) return; // No conversation yet, nothing to save
    
    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation) return;
    
    // Extract messages from DOM (excluding loading indicator)
    const domMessages = Array.from(messagesDiv.children)
        .filter(msg => !msg.classList.contains('loading')) // Exclude loading indicator
        .map(msg => {
            // Extract text content excluding the timestamp tooltip
            const timestampTooltip = msg.querySelector('.message-timestamp');
            let content = msg.textContent || msg.innerText || '';
            
            // Remove timestamp tooltip text from content if present
            if (timestampTooltip) {
                const timestampText = timestampTooltip.textContent || '';
                content = content.replace(timestampText, '').trim();
            }
            
            // Get timestamp from data attribute or use current time
            const timestampAttr = msg.getAttribute('data-timestamp');
            const timestamp = timestampAttr ? new Date(timestampAttr).toISOString() : new Date().toISOString();
            
            return {
                role: msg.classList.contains('user') ? 'user' : 'ai',
                content: content,
                timestamp: timestamp,
                createdAt: timestamp
            };
        });
    
    // For guest users, save locally
    if (isGuestMode()) {
        conversation.messages = domMessages;
        conversation.updatedAt = new Date().toISOString();
        
        // Update title from first user message if still "New Chat"
        if (conversation.title === 'New Chat' && conversation.messages.length > 0) {
            const firstUserMessage = conversation.messages.find(m => m.role === 'user');
            if (firstUserMessage) {
                // For guest users, just use first 50 chars (no AI API call needed)
                conversation.title = firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
            }
        }
        
        saveConversations();
        renderConversationsList();
        return;
    }
    
    // For authenticated users, save to database
    // Compare with existing messages to find new ones to save
    const existingMessages = conversation.messages || [];
    const newMessages = domMessages.slice(existingMessages.length);
    
    // Save new messages to database
    if (newMessages.length > 0) {
        try {
            // Use bulk save when there are multiple messages, otherwise save individually
            if (newMessages.length > 1) {
                // Bulk save multiple messages at once (more efficient)
                const messagesToSave = newMessages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));
                
                const result = await apiRequest(`/api/conversations/${currentConversationId}/messages/bulk`, {
                    method: 'POST',
                    body: JSON.stringify({ messages: messagesToSave })
                });
                
                // Update local conversation with all messages (including timestamps from server)
                conversation.messages = domMessages;
                conversation.updatedAt = new Date().toISOString();
                
                // Update title from first user message if still "New Chat"
                if (result.success && conversation.title === 'New Chat' && conversation.messages.length > 0) {
                    const firstUserMessage = conversation.messages.find(m => m.role === 'user');
                    if (firstUserMessage) {
                        try {
                            const newTitle = await generateConversationTitle(firstUserMessage.content);
                            if (newTitle) {
                                await apiRequest(`/api/conversations/${currentConversationId}`, {
                                    method: 'PUT',
                                    body: JSON.stringify({ title: newTitle })
                                });
                                conversation.title = newTitle;
                                renderConversationsList(); // Update UI with new title
                            } else {
                                // Fallback to first 50 chars if AI title generation fails
                                const fallbackTitle = firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
                                await apiRequest(`/api/conversations/${currentConversationId}`, {
                                    method: 'PUT',
                                    body: JSON.stringify({ title: fallbackTitle })
                                });
                                conversation.title = fallbackTitle;
                                renderConversationsList();
                            }
                        } catch (error) {
                            console.error('❌ Error generating/updating conversation title (bulk):', error);
                            // Fallback to first 50 chars on error
                            const fallbackTitle = firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
                            try {
                                await apiRequest(`/api/conversations/${currentConversationId}`, {
                                    method: 'PUT',
                                    body: JSON.stringify({ title: fallbackTitle })
                                });
                                conversation.title = fallbackTitle;
                                renderConversationsList();
                            } catch (updateError) {
                                console.error('❌ Error updating conversation title (bulk fallback):', updateError);
                            }
                        }
                    }
                }
            } else {
                // Save single message
                const msg = newMessages[0];
                await apiRequest(`/api/conversations/${currentConversationId}/messages`, {
                    method: 'POST',
                    body: JSON.stringify({
                        role: msg.role,
                        content: msg.content
                    })
                });
                
                // Update local conversation with all messages
                conversation.messages = domMessages;
                conversation.updatedAt = new Date().toISOString();
                
                // Update title if needed (first user message) - generate AI summary
                if (conversation.title === 'New Chat' && msg.role === 'user') {
                    try {
                        const newTitle = await generateConversationTitle(msg.content);
                        if (newTitle) {
                            await apiRequest(`/api/conversations/${currentConversationId}`, {
                                method: 'PUT',
                                body: JSON.stringify({ title: newTitle })
                            });
                            conversation.title = newTitle;
                            renderConversationsList(); // Update UI with new title
                        } else {
                            // Fallback to first 50 chars if AI title generation fails
                            const fallbackTitle = msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '');
                            await apiRequest(`/api/conversations/${currentConversationId}`, {
                                method: 'PUT',
                                body: JSON.stringify({ title: fallbackTitle })
                            });
                            conversation.title = fallbackTitle;
                            renderConversationsList();
                        }
                    } catch (error) {
                        console.error('❌ Error generating/updating conversation title:', error);
                        // Fallback to first 50 chars on error
                        const fallbackTitle = msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '');
                        try {
                            await apiRequest(`/api/conversations/${currentConversationId}`, {
                                method: 'PUT',
                                body: JSON.stringify({ title: fallbackTitle })
                            });
                            conversation.title = fallbackTitle;
                            renderConversationsList();
                        } catch (updateError) {
                            console.error('❌ Error updating conversation title (fallback):', updateError);
                        }
                    }
                }
            }
            
            renderConversationsList();
        } catch (error) {
            console.error('❌ Error saving messages to database:', error);
            // Fallback: save locally for now (for guest mode compatibility)
            conversation.messages = domMessages;
            saveConversations();
            renderConversationsList();
        }
    } else {
        // No new messages, but ensure conversation title is updated if it changed
        conversation.messages = domMessages;
        
        // Check if title needs updating (should already be set, but ensure it's synced)
        if (conversation.title === 'New Chat' && conversation.messages.length > 0) {
            const firstUserMessage = conversation.messages.find(m => m.role === 'user');
            if (firstUserMessage) {
                try {
                    const newTitle = await generateConversationTitle(firstUserMessage.content);
                    if (newTitle && newTitle !== conversation.title) {
                        await apiRequest(`/api/conversations/${currentConversationId}`, {
                            method: 'PUT',
                            body: JSON.stringify({ title: newTitle })
                        });
                        conversation.title = newTitle;
                        renderConversationsList();
                    } else if (!newTitle) {
                        // Fallback if AI title generation failed
                        const fallbackTitle = firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
                        if (fallbackTitle !== conversation.title) {
                            await apiRequest(`/api/conversations/${currentConversationId}`, {
                                method: 'PUT',
                                body: JSON.stringify({ title: fallbackTitle })
                            });
                            conversation.title = fallbackTitle;
                            renderConversationsList();
                        }
                    }
                } catch (error) {
                    console.error('❌ Error updating conversation title:', error);
                    // Fallback to first 50 chars on error
                    const fallbackTitle = firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
                    if (fallbackTitle !== conversation.title) {
                        try {
                            await apiRequest(`/api/conversations/${currentConversationId}`, {
                                method: 'PUT',
                                body: JSON.stringify({ title: fallbackTitle })
                            });
                            conversation.title = fallbackTitle;
                            renderConversationsList();
                        } catch (updateError) {
                            console.error('❌ Error updating conversation title (fallback):', updateError);
                        }
                    }
                }
            }
        }
        
        renderConversationsList();
    }
}

async function loadConversation(conversationId) {
    // Save current conversation before switching (if it has messages)
    if (currentConversationId) {
        const currentMessages = document.getElementById('messages');
        if (currentMessages && currentMessages.children.length > 0) {
            await saveCurrentConversation();
        }
    }
    
    let conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;
    
    currentConversationId = conversationId;
    
    // For guest users, use local messages
    if (isGuestMode()) {
        // Restore conversation history for AI context
        conversationHistory = conversation.messages ? conversation.messages.map(m => ({
            role: m.role,
            content: m.content
        })) : [];
        
        // Render messages
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = '';
            if (conversation.messages && conversation.messages.length > 0) {
                conversation.messages.forEach(msg => {
                    if (msg.role === 'user') {
                        appendUser(msg.content, false, msg.timestamp || msg.createdAt);
                    } else {
                        appendAI(msg.content, false, msg.timestamp || msg.createdAt);
                    }
                });
                scrollToBottom();
            } else {
                toggleWelcomeMessage();
            }
        }
        
        toggleConversationsSidebar();
        renderConversationsList();
        return;
    }
    
    // For authenticated users, fetch messages from database
    try {
        const data = await apiRequest(`/api/conversations/${conversationId}`, { method: 'GET' });
        
        // Update conversation with fetched data
        conversation.messages = data.messages || [];
        
        // Restore conversation history for AI context
        conversationHistory = conversation.messages.map(m => ({
            role: m.role,
            content: m.content
        }));
        
        // Render messages
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = '';
            if (conversation.messages.length > 0) {
                conversation.messages.forEach(msg => {
                    if (msg.role === 'user') {
                        appendUser(msg.content, false, msg.createdAt);
                    } else {
                        appendAI(msg.content, false, msg.createdAt);
                    }
                });
                scrollToBottom();
            } else {
                toggleWelcomeMessage();
            }
        }
        
        toggleConversationsSidebar();
        renderConversationsList();
    } catch (error) {
        console.error('❌ Error loading conversation:', error);
        // Fallback to local messages if available
        conversationHistory = conversation.messages ? conversation.messages.map(m => ({
            role: m.role,
            content: m.content
        })) : [];
        
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = '';
            if (conversation.messages && conversation.messages.length > 0) {
                conversation.messages.forEach(msg => {
                    if (msg.role === 'user') {
                        appendUser(msg.content, false, msg.timestamp || msg.createdAt);
                    } else {
                        appendAI(msg.content, false, msg.timestamp || msg.createdAt);
                    }
                });
                scrollToBottom();
            } else {
                toggleWelcomeMessage();
            }
        }
        
        toggleConversationsSidebar();
        renderConversationsList();
    }
}

async function deleteConversation(conversationId, event) {
    event.stopPropagation();
    
    const confirmed = await showConfirmModal({
        icon: '🗑️',
        title: 'Delete Conversation',
        message: 'Are you sure you want to delete this conversation? This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger'
    });
    
    if (!confirmed) return;
    
    // Ensure modal is closed
    const modal = document.getElementById('confirmation-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // For guest users, delete locally
    if (isGuestMode()) {
        conversations = conversations.filter(c => c.id !== conversationId);
        saveConversations();
        
        if (currentConversationId === conversationId) {
            currentConversationId = null;
            conversationHistory = [];
            const messages = document.getElementById('messages');
            if (messages) {
                messages.innerHTML = '';
            }
            toggleWelcomeMessage();
        }
        
        renderConversationsList();
        toggleWelcomeMessage();
        showToast({ type: 'success', title: 'Deleted', message: 'Conversation deleted successfully.' });
        return;
    }
    
    // For authenticated users, delete from database
    try {
        console.log('🗑️ Deleting conversation from database:', conversationId);
        const response = await apiRequest(`/api/conversations/${conversationId}`, { method: 'DELETE' });
        
        if (response && response.success) {
            console.log('✅ Conversation deleted from database successfully');
            
            // Remove from local array
            conversations = conversations.filter(c => c.id !== conversationId);
            
            // Clear current conversation if it was the deleted one
            if (currentConversationId === conversationId) {
                currentConversationId = null;
                conversationHistory = [];
                const messages = document.getElementById('messages');
                if (messages) {
                    messages.innerHTML = '';
                }
                toggleWelcomeMessage();
            }
            
            // Reload conversations from database to ensure sync
            await loadConversations();
            renderConversationsList();
            toggleWelcomeMessage();
            showToast({ type: 'success', title: 'Deleted', message: 'Conversation deleted successfully from database.' });
        } else {
            throw new Error('Delete response was not successful');
        }
    } catch (error) {
        console.error('❌ Error deleting conversation from database:', error);
        
        // Try to provide more specific error message
        let errorMessage = 'Failed to delete conversation. Please try again.';
        if (error.message && error.message.includes('Not authenticated')) {
            errorMessage = 'You must be logged in to delete conversations.';
        } else if (error.message && error.message.includes('not found')) {
            errorMessage = 'Conversation not found in database.';
        }
        
        showToast({ type: 'error', title: 'Delete Failed', message: errorMessage });
        
        // Still try to remove from local view if it exists
        const wasInLocal = conversations.some(c => c.id === conversationId);
        if (wasInLocal) {
            conversations = conversations.filter(c => c.id !== conversationId);
            renderConversationsList();
            console.warn('⚠️ Removed from local view, but database delete failed');
        }
    }
}

function renderConversationsList() {
    const sidebar = document.getElementById('conversations-sidebar');
    if (!sidebar) return;
    
    // Always show "New Chat" button at the top
    // If no conversations exist, show "No chat history" message
    let conversationsHTML = '';
    
    if (conversations.length === 0) {
        conversationsHTML = `
            <div class="conversation-item new-chat-item ${currentConversationId === null ? 'active' : ''}" 
                 onclick="newChat()">
                <div class="conversation-content">
                    <div class="conversation-title">✨ New Chat</div>
                </div>
            </div>
            <div class="conversations-empty">
                <div class="conversations-empty-icon">💬</div>
                <p class="conversations-empty-title">No chat history yet</p>
                <p class="conversations-empty-description">Start a new conversation to begin chatting!</p>
            </div>
        `;
    } else {
        conversationsHTML = `
            <div class="conversation-item new-chat-item ${currentConversationId === null ? 'active' : ''}" 
                 onclick="newChat()">
                <div class="conversation-content">
                    <div class="conversation-title">✨ New Chat</div>
                </div>
            </div>
            ${conversations.map(conv => `
                <div class="conversation-item ${conv.id === currentConversationId ? 'active' : ''}" 
                     onclick="loadConversation('${conv.id}')">
                    <div class="conversation-content">
                        <div class="conversation-title">${conv.title}</div>
                        <div class="conversation-date">${formatDate(conv.updatedAt)}</div>
                    </div>
                    <button class="delete-conv-btn" onclick="deleteConversation('${conv.id}', event)" title="Delete">🗑️</button>
                </div>
            `).join('')}
        `;
    }
    
    sidebar.innerHTML = `
        <div class="conversations-header">
            <h3>💬 Conversations</h3>
            <button onclick="toggleConversationsSidebar()" class="close-btn" title="Close">✕</button>
        </div>
        <div class="conversations-list">
            ${conversationsHTML}
        </div>
    `;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
}

function formatTimestamp(date) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    // Show exact time with date
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const minutesStr = minutes.toString().padStart(2, '0');
    
    const timeString = `${hours12}:${minutesStr} ${ampm}`;
    
    // Add relative time if recent (removed "Just now" per user request)
    if (diffMins < 1) {
        return timeString;
    } else if (diffMins < 60) {
        return `${diffMins}m ago • ${timeString}`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago • ${timeString}`;
    } else if (diffDays === 1) {
        return `Yesterday • ${timeString}`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago • ${timeString}`;
    } else {
        // Show full date for older messages
        const month = date.toLocaleString('default', { month: 'short' });
        const day = date.getDate();
        const year = date.getFullYear();
        return `${month} ${day}, ${year} • ${timeString}`;
    }
}

function toggleConversationsSidebar() {
    const sidebar = document.getElementById('conversations-sidebar');
    const chatActions = document.querySelector('.chat-actions');
    if (sidebar) {
        const isVisible = sidebar.style.display === 'block';
        sidebar.style.display = isVisible ? 'none' : 'block';
        
        // Hide other sidebars and menus
        const otherSidebar = document.getElementById('sidebar');
        const apiConfig = document.getElementById('api-config');
        const userMenu = document.getElementById('user-menu');
        const tipsContent = document.getElementById('tips-content');
        if (otherSidebar) otherSidebar.style.display = 'none';
        if (apiConfig) apiConfig.style.display = 'none';
        if (userMenu) userMenu.style.display = 'none';
        if (tipsContent) tipsContent.style.display = 'none';
    }
}

function toggleUserMenu() {
    const userMenu = document.getElementById('user-menu');
    if (userMenu) {
        const isVisible = userMenu.style.display === 'block';
        userMenu.style.display = isVisible ? 'none' : 'block';
        
        // Hide other sidebars and panels
        const sidebar = document.getElementById('sidebar');
        const conversationsSidebar = document.getElementById('conversations-sidebar');
        const apiConfig = document.getElementById('api-config');
        const tipsContent = document.getElementById('tips-content');
        if (sidebar) sidebar.style.display = 'none';
        if (conversationsSidebar) conversationsSidebar.style.display = 'none';
        if (apiConfig) apiConfig.style.display = 'none';
        if (tipsContent) tipsContent.style.display = 'none';
    }
}

// Close user menu when clicking outside
document.addEventListener('click', function(event) {
    const userMenu = document.getElementById('user-menu');
    const userMenuBtn = document.querySelector('.user-menu-btn');
    
    if (userMenu && userMenuBtn && 
        !userMenu.contains(event.target) && 
        !userMenuBtn.contains(event.target) &&
        userMenu.style.display === 'block') {
        userMenu.style.display = 'none';
    }
});

// Local Storage Functions (legacy - for backward compatibility)
function saveToLocalStorage() {
    // Auto-save current conversation instead
    saveCurrentConversation().catch(error => {
        console.error('❌ Error saving conversation:', error);
    });
}

// Performance: Optimized scroll with requestAnimationFrame
let scrollTimeout = null;
function scrollToBottom() {
    // Clear any pending scroll
    if (scrollTimeout) {
        cancelAnimationFrame(scrollTimeout);
    }
    
    // Use requestAnimationFrame for smooth, performant scrolling
    scrollTimeout = requestAnimationFrame(() => {
        const messages = document.getElementById('messages');
        if (messages) {
            messages.scrollTop = messages.scrollHeight;
        }
        scrollTimeout = null;
    });
}

// Message Display Functions
function toggleWelcomeMessage() {
    const welcomeMessage = document.getElementById('welcome-message');
    const messages = document.getElementById('messages');
    
    if (!welcomeMessage || !messages) return;
    
    // Hide welcome message if there are any messages (including loading indicator)
    const hasMessages = messages.children.length > 0;
    
    if (hasMessages) {
        welcomeMessage.classList.add('hidden');
    } else {
        welcomeMessage.classList.remove('hidden');
    }
}

function appendAI(text, autoSave = true, timestamp = null) {
    const messages = document.getElementById('messages');
    const p = document.createElement('p');
    p.classList.add('ai');
    p.textContent = text;
    
    // Add timestamp data attribute
    const now = timestamp ? new Date(timestamp) : new Date();
    p.setAttribute('data-timestamp', now.toISOString());
    
    // Create timestamp tooltip
    const tooltip = document.createElement('span');
    tooltip.className = 'message-timestamp';
    tooltip.textContent = formatTimestamp(now);
    p.appendChild(tooltip);
    
    messages.appendChild(p);
    messages.scrollTop = messages.scrollHeight;
    
    // Hide welcome message when messages are added
    toggleWelcomeMessage();
    
    if (autoSave) {
        // Save asynchronously without blocking
        saveCurrentConversation().catch(error => {
            console.error('❌ Error saving conversation:', error);
        });
    }
}

function appendUser(text, autoSave = true, timestamp = null) {
    const messages = document.getElementById('messages');
    const p = document.createElement('p');
    p.classList.add('user');
    p.textContent = text;
    
    // Add timestamp data attribute
    const now = timestamp ? new Date(timestamp) : new Date();
    p.setAttribute('data-timestamp', now.toISOString());
    
    // Create timestamp tooltip
    const tooltip = document.createElement('span');
    tooltip.className = 'message-timestamp';
    tooltip.textContent = formatTimestamp(now);
    p.appendChild(tooltip);
    
    messages.appendChild(p);
    messages.scrollTop = messages.scrollHeight;
    
    // Hide welcome message when messages are added
    toggleWelcomeMessage();
    
    if (autoSave) {
        // Save asynchronously without blocking
        saveCurrentConversation().catch(error => {
            console.error('❌ Error saving conversation:', error);
        });
    }
}

// Show/Hide AI thinking indicator in conversation box
function showAIThinkingIndicator(show) {
    const messages = document.getElementById('messages');
    let indicator = document.getElementById('ai-thinking-indicator');
    
    if (show) {
        // Create indicator if it doesn't exist
        if (!indicator && messages) {
            indicator = document.createElement('p');
            indicator.classList.add('ai', 'loading');
            indicator.id = 'ai-thinking-indicator';
            indicator.textContent = 'AI is thinking';
            messages.appendChild(indicator);
            scrollToBottom();
        }
    } else {
        // Remove indicator if it exists
        if (indicator) {
            indicator.remove();
        }
    }
}

// Enable/Disable input during AI response (User can type but not send)
function setInputEnabled(enabled) {
    const input = document.getElementById('user-input');
    const sendBtn = document.querySelector('.send-btn');
    
    if (input) {
        // Keep input enabled so user can type, but placeholder indicates status
        input.disabled = false; // Always allow typing
        input.placeholder = 'Type your message...'; // Keep placeholder consistent
    }
    
    // Show/hide AI thinking indicator in conversation box
    showAIThinkingIndicator(!enabled);
    
    if (sendBtn) {
        if (!enabled) {
            // Change button to "Stop" when AI is generating
            sendBtn.textContent = 'Stop';
            sendBtn.onclick = stopAIResponse;
            sendBtn.disabled = false; // Keep enabled so user can click stop
            sendBtn.style.opacity = '1';
            sendBtn.style.cursor = 'pointer';
            sendBtn.style.background = '#ef4444'; // Solid color instead of gradient
        } else {
            // Change button back to "Send"
            sendBtn.textContent = 'Send';
            sendBtn.onclick = () => sendMessage();
            sendBtn.disabled = false;
            sendBtn.style.opacity = '1';
            sendBtn.style.cursor = 'pointer';
            sendBtn.style.background = '#667eea'; // Solid color instead of gradient
        }
    }
    
    // Also disable tips panel buttons
    const tipButtons = document.querySelectorAll('.tip-btn');
    tipButtons.forEach(btn => {
        btn.disabled = !enabled;
        if (!enabled) {
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    });
}

// Stop AI response generation (User must stop before sending new messages)
function stopAIResponse() {
    console.log('🛑 User requested to stop AI response');
    
    // Abort the fetch request
    if (abortController) {
        abortController.abort();
    }
    
    // Clear any pending batch
    if (batchTimeout) {
        clearTimeout(batchTimeout);
        batchTimeout = null;
    }
    
    // Remove thinking indicator
    showAIThinkingIndicator(false);
    
    // Remove loading indicator if it exists (shouldn't, but just in case)
    const loadingIndicator = document.getElementById('ai-loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
    
    // Reset state
    isGeneratingResponse = false;
    pendingMessages = [];
    abortController = null;
    
    // Re-enable send button so user can send new messages
    setInputEnabled(true);
    
    console.log('✅ AI response stopped successfully');
}

// Message Sending - Shows immediately, batches for AI response
async function sendMessage(msg) {
    // Prevent sending messages while AI is generating response (ChatGPT-like)
    if (isGeneratingResponse) {
        return;
    }
    
    const input = document.getElementById('user-input');
    if (!msg) {
        msg = input.value.trim();
    }
    if (!msg) return;
    
    // Conversation creation is handled by saveCurrentConversation() after message is added
    // No need to create it here - prevents duplicate conversations
    
    // Clear input immediately for better UX
    input.value = '';
    
    // Blur input to close keyboard on mobile after sending
    // This will trigger the keyboard close handler to return input area to bottom
    setTimeout(() => {
        input.blur();
    }, 100);
    
    // Show user message immediately in UI
    appendUser(msg);
    
    // Add message to pending batch
    pendingMessages.push(msg);
    
    // Clear existing timeout
    if (batchTimeout) {
        clearTimeout(batchTimeout);
    }
    
    // Wait for more messages, then process batch together
    batchTimeout = setTimeout(() => {
        processBatchedMessages();
    }, BATCH_DELAY);
}

// Process all pending messages together in one AI call
async function processBatchedMessages() {
    if (isGeneratingResponse || pendingMessages.length === 0) {
        return;
    }
    
    // If already processing, add current messages to queue and wait
    if (isGeneratingResponse) {
        return;
    }
    
    isGeneratingResponse = true;
    
    // Disable send button (but allow typing) while AI is generating response
    setInputEnabled(false);
    
    // Get all pending messages
    const messagesToProcess = [...pendingMessages];
    pendingMessages = []; // Clear the batch
    
    // Combine all messages into one context
    const combinedMessage = messagesToProcess.join('\n\n');
    
    // Show "AI is thinking" indicator in conversation box
    const messages = document.getElementById('messages');
    
    // Remove any existing loading indicators (in case one exists)
    const existingLoading = document.getElementById('ai-loading-indicator');
    if (existingLoading) {
        existingLoading.remove();
    }
    const existingThinking = document.getElementById('ai-thinking-indicator');
    if (existingThinking) {
        existingThinking.remove();
    }
    
    // Hide welcome message when starting to generate response
    toggleWelcomeMessage();
    
    // Show "AI is thinking" indicator in messages area
    showAIThinkingIndicator(true);
    
    try {
        // Generate ONE response for ALL messages using complete conversation history
        const response = await generateAIResponse(combinedMessage, messagesToProcess);
        
        // Check if request was aborted (user clicked stop)
        if (abortController && abortController.signal.aborted) {
            console.log('🛑 Response generation was stopped by user');
            return; // Exit early, already cleaned up by stopAIResponse
        }
        
        // Remove thinking indicator before showing response
        showAIThinkingIndicator(false);
        
        // Remove loading indicator if it exists (shouldn't, but just in case)
        const loadingIndicator = document.getElementById('ai-loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        // Append AI response (will automatically scroll to bottom)
        appendAI(response);
    } catch (error) {
        // Check if error is due to user cancellation
        if (error.message === 'Request cancelled by user' || (abortController && abortController.signal.aborted)) {
            console.log('🛑 AI response generation was stopped by user');
            return; // Exit early, already cleaned up by stopAIResponse
        }
        
        // Remove thinking indicator
        showAIThinkingIndicator(false);
        
        // Remove loading indicator if it exists
        const loadingIndicator = document.getElementById('ai-loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        console.error("❌ AI API error details:", error);
        console.error("❌ Error message:", error.message);
        console.error("❌ Error stack:", error.stack);
        
        // Parse error message for better user feedback
        let errorMessage = "I'm having trouble connecting right now. 💙\n\n";
        const errorMsg = error.message || '';
        
        // Simplified error messages focused on internet connectivity
        if (errorMsg.includes('401') || errorMsg.includes('API key') || errorMsg.includes('authentication') || errorMsg.includes('authentication failed')) {
            errorMessage += "🔑 Connection Issue: Unable to authenticate with the AI service.\n\n";
            errorMessage += "💡 This usually happens due to internet connectivity problems or temporary service issues.\n";
            errorMessage += "Please check your internet connection and try again in a moment.";
        } else if (errorMsg.includes('403')) {
            errorMessage += "🚫 Access Denied: Unable to connect to the AI service.\n\n";
            errorMessage += "💡 This may be a temporary connectivity issue. Please check your internet connection and try again.";
        } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
            errorMessage += "⏱️ Too Many Requests: The service is temporarily busy.\n\n";
            errorMessage += "💡 Please wait a moment and try again. This usually resolves quickly.";
        } else if (errorMsg.includes('400')) {
            errorMessage += "❌ Connection Error: Unable to process the request.\n\n";
            errorMessage += "💡 This might be a temporary connectivity issue. Please check your internet connection and try again.";
        } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
            errorMessage += "🔍 Service Temporarily Unavailable: The AI service is having issues.\n\n";
            errorMessage += "💡 Please check your internet connection and try again. The bot will automatically retry with different configurations.";
        } else if (errorMsg.includes('All API model configurations failed') || errorMsg.includes('All models')) {
            errorMessage += "🔄 Connection Failed: Unable to reach the AI service.\n\n";
            errorMessage += "💡 Please check your internet connection and try again. This is usually a temporary network issue.";
        } else if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('Failed to fetch')) {
            errorMessage += "🌐 Network Error: Cannot connect to the internet.\n\n";
            errorMessage += "💡 Please check your internet connection and try again.";
        } else if (errorMsg.includes('is not defined')) {
            errorMessage += "⚠️ Service Error: An unexpected error occurred.\n\n";
            errorMessage += "💡 Please check your internet connection and refresh the page. If the issue persists, try again in a few moments.";
        } else {
            errorMessage += "⚠️ Connection Error: Unable to reach the AI service.\n\n";
            errorMessage += "💡 Please check your internet connection and try again. This is usually a temporary network issue.";
        }
        
        appendAI(errorMessage);
        console.error("Full error object:", error);
    }
    
    // Reset flag after processing
    isGeneratingResponse = false;
    
    // Clear abort controller
    abortController = null;
    
    // Re-enable input after AI finishes responding (ChatGPT-like)
    setInputEnabled(true);
    
    // If more messages arrived while processing, process them now (only if not aborted)
    if (pendingMessages.length > 0 && !abortController) {
        batchTimeout = setTimeout(() => {
            processBatchedMessages();
        }, BATCH_DELAY);
    }
}

// UI Toggle Functions
function toggleTipsPanel() {
    const tipsContent = document.getElementById('tips-content');
    const tipsToggleBtn = document.querySelector('.tips-toggle-btn');
    if (!tipsContent || !tipsToggleBtn) return;
    
    const isVisible = tipsContent.classList.contains('active') || tipsContent.style.display === 'flex';
    if (isVisible) {
        tipsContent.classList.remove('active');
        tipsContent.style.display = 'none';
    } else {
        // Calculate button position for floating bubble
        const btnRect = tipsToggleBtn.getBoundingClientRect();
        const contentHeight = 300; // Approximate height of tips content
        const spacing = 12; // Space between button and content
        
        // Position content above the button
        tipsContent.style.position = 'fixed';
        tipsContent.style.bottom = `${window.innerHeight - btnRect.top + spacing}px`;
        tipsContent.style.left = `${btnRect.left}px`;
        tipsContent.style.transform = 'translateY(0)';
        
        tipsContent.classList.add('active');
        tipsContent.style.display = 'flex';
    }
}

function toggleSidebar() {
    // Legacy function - redirect to toggleTipsPanel
    toggleTipsPanel();
}

// Close tips panel when clicking outside
document.addEventListener('click', function(event) {
    const tipsPanel = document.getElementById('tips-panel');
    const tipsContent = document.getElementById('tips-content');
    const tipsToggleBtn = document.querySelector('.tips-toggle-btn');
    
    if (tipsPanel && tipsContent && 
        (tipsContent.classList.contains('active') || tipsContent.style.display === 'flex') &&
        !tipsPanel.contains(event.target) &&
        !tipsToggleBtn?.contains(event.target)) {
        tipsContent.classList.remove('active');
        tipsContent.style.display = 'none';
    }
});

// Quick message buttons - closes tips panel when clicked
function sendQuick(text) {
    const tipsContent = document.getElementById('tips-content');
    if (tipsContent) {
        tipsContent.classList.remove('active');
        tipsContent.style.display = 'none';
    }
    sendMessage(text);
}

function toggleApiConfig() {
    const apiConfig = document.getElementById('api-config');
    const sidebar = document.getElementById('sidebar');
    const conversationsSidebar = document.getElementById('conversations-sidebar');
    const chat = document.getElementById('chat');
    const prechat = document.getElementById('prechat');
    
    // Toggle settings panel
    const isCurrentlyVisible = apiConfig.style.display === 'block';
    
    if (!isCurrentlyVisible) {
        // Opening settings - hide sidebars and show settings
        sidebar.style.display = 'none';
        if (conversationsSidebar) conversationsSidebar.style.display = 'none';
        apiConfig.style.display = 'block';
        
        // If chat container is hidden (setup prompt showing), show it so settings are visible
        if (chat && chat.style.display === 'none') {
            chat.style.display = 'flex';
            // Hide the prechat screen but keep setup prompt
            if (prechat) {
                const setupPrompt = document.getElementById('setup-prompt');
                if (setupPrompt) {
                    // Keep setup prompt visible but dim it
                    prechat.style.display = 'none';
                }
            }
        }
        
        // Refresh API keys list when opening settings
        refreshApiKeysList();
    } else {
        // Closing settings
        apiConfig.style.display = 'none';
    }
    
    // Load saved settings
    const geminiModel = localStorage.getItem('gemini_model') || 'gemini-pro';
    const modelSelect = document.getElementById('gemini-model');
    if (modelSelect) modelSelect.value = geminiModel;
    
}

// Built-in Default API Key (Shared/Public Key)
// ⚠️ SECURITY WARNING: This key will be visible in the browser's source code.
// Anyone can extract it. Use this only for:
// - Free tier API keys (no billing risk)
// - Public/demo purposes
// - Temporary shared access
// For production apps, use a backend proxy instead!
const DEFAULT_BUILTIN_API_KEY = ''; // Keep empty: do not hardcode secrets in frontend

// EMBEDDED API KEYS - HIDDEN FROM USERS
// ⚠️ Add your API keys here (up to 20 keys for maximum redundancy)
// These keys are embedded in code and automatically used by all users
// The system will automatically rotate through working keys if one fails
// 
// RECOMMENDED: Distribute keys across multiple Google accounts
// - 3-5 keys minimum for redundancy
// - 10 keys ideal for medium-high traffic
// - 20 keys for very high traffic and maximum reliability
// - Best practice: Use keys from different Google accounts (separate quotas)
//   Example: 10 keys from Account A + 10 keys from Account B = 2x throughput
//
// To get free API keys: https://makersuite.google.com/app/apikey
// Replace the placeholder keys below with your actual API keys
const PRE_CONFIGURED_API_KEYS = [
    '', // Key 1
    '', // Key 2
    '', // Key 3
    '', // Key 4
    '', // Key 5
    '', // Key 6
    '', // Key 7
    '', // Key 8
    '', // Key 9
    '', // Key 10
    '', // Key 11
    '', // Key 12
    '', // Key 13
    '', // Key 14
    '', // Key 15
    '', // Key 16
    '', // Key 17
    '', // Key 18
    '', // Key 19
    '', // Key 20
];

// Multi-API Key Management System - GLOBAL (Shared across all users)
// API keys are stored globally so all users can use them
const GLOBAL_API_KEYS_STORAGE_KEY = 'gemini_api_keys_global';

// Performance: Cache API keys to avoid frequent localStorage reads
let cachedApiKeys = null;
let apiKeysCacheTime = 0;
const API_KEYS_CACHE_DURATION = 5000; // Cache for 5 seconds
const KEY_RATE_LIMIT_COOLDOWN_MS = 120000; // 2 minutes
const KEY_TRANSIENT_COOLDOWN_MS = 30000; // 30 seconds
const KEY_STATUS_WORKING = 'working';
const KEY_STATUS_COOLDOWN = 'cooldown';
const KEY_STATUS_INVALID = 'invalid';

function sanitizeApiKey(rawKey) {
    if (!rawKey || typeof rawKey !== 'string') {
        return '';
    }
    return rawKey.trim();
}

function normalizeKeyRecord(keyObj, index = 0) {
    if (!keyObj || typeof keyObj !== 'object') {
        return null;
    }
    
    const normalizedKey = sanitizeApiKey(keyObj.key);
    if (!normalizedKey || !normalizedKey.startsWith('AIza')) {
        return null;
    }
    
    const normalizedStatus = keyObj.status === KEY_STATUS_INVALID || keyObj.status === KEY_STATUS_COOLDOWN
        ? keyObj.status
        : KEY_STATUS_WORKING;
    
    return {
        ...keyObj,
        id: keyObj.id || `key_${index}_${Date.now()}`,
        key: normalizedKey,
        active: Boolean(keyObj.active),
        status: normalizedStatus,
        cooldownUntil: keyObj.cooldownUntil ? Number(keyObj.cooldownUntil) : null,
        lastError: keyObj.lastError || null,
        failedAt: keyObj.failedAt || null,
        invalidAt: keyObj.invalidAt || null
    };
}

function dedupeApiKeys(keys) {
    if (!Array.isArray(keys)) {
        return [];
    }
    
    const deduped = [];
    const seen = new Set();
    
    keys.forEach((keyObj, index) => {
        const normalized = normalizeKeyRecord(keyObj, index);
        if (!normalized || seen.has(normalized.key)) {
            return;
        }
        
        seen.add(normalized.key);
        deduped.push(normalized);
    });
    
    return deduped;
}

function isKeyOnCooldown(keyObj, now = Date.now()) {
    if (!keyObj || keyObj.status !== KEY_STATUS_COOLDOWN || !keyObj.cooldownUntil) {
        return false;
    }
    return Number(keyObj.cooldownUntil) > now;
}

function clearExpiredCooldowns(keys, now = Date.now()) {
    let changed = false;
    const updated = keys.map(keyObj => {
        if (keyObj.status === KEY_STATUS_COOLDOWN && keyObj.cooldownUntil && Number(keyObj.cooldownUntil) <= now) {
            changed = true;
            return {
                ...keyObj,
                status: KEY_STATUS_WORKING,
                cooldownUntil: null,
                lastError: null
            };
        }
        return keyObj;
    });
    
    return { keys: updated, changed };
}

function getUserApiKeys() {
    // Use cache if still valid
    const now = Date.now();
    if (cachedApiKeys && (now - apiKeysCacheTime) < API_KEYS_CACHE_DURATION) {
        return cachedApiKeys;
    }
    
    // Always use embedded keys first - these are the primary source
    let keys = [];
    let keysChanged = false;
    
    // Auto-import embedded keys if not already imported (always check for updates)
    if (PRE_CONFIGURED_API_KEYS.length > 0) {
        // Always sync embedded keys (in case you update the code)
        const validEmbeddedKeys = PRE_CONFIGURED_API_KEYS
            .map(key => sanitizeApiKey(key))
            .filter(key => key && key.startsWith('AIza'));
        
        if (validEmbeddedKeys.length > 0) {
            console.log('🔄 Loading embedded API keys:', validEmbeddedKeys.length, 'keys');
            
            // Get existing keys from storage
            const storedKeys = dedupeApiKeys(JSON.parse(localStorage.getItem(GLOBAL_API_KEYS_STORAGE_KEY) || '[]'));
            const existingKeyValues = new Set(storedKeys.map(k => k.key));
            
            // Add embedded keys that aren't already in storage
            validEmbeddedKeys.forEach((key, index) => {
                if (!existingKeyValues.has(key)) {
                    keys.push({
                        id: 'embedded_' + index,
                        key: key,
                        addedAt: new Date().toISOString(),
                        active: index === 0, // First key is active by default
                        status: KEY_STATUS_WORKING,
                        preconfigured: true,
                        embedded: true
                    });
                    keysChanged = true;
                    console.log('✅ Added embedded key', (index + 1) + '/' + validEmbeddedKeys.length);
                } else {
                    // Key already exists, keep it but mark as embedded
                    const existing = storedKeys.find(k => k.key === key);
                    if (existing) {
                        existing.embedded = true;
                        keys.push(existing);
                    }
                }
            });
            
            // Also add any non-embedded keys that were previously added (backup)
            storedKeys.forEach(storedKey => {
                if (!storedKey.embedded && !keys.find(k => k.key === storedKey.key)) {
                    keys.push(storedKey);
                }
            });
            
            // Ensure first embedded key is active if no active key
            const hasActiveKey = keys.some(k => k.active);
            if (!hasActiveKey && keys.length > 0) {
                let nextActiveIndex = keys.findIndex(k => k.status !== KEY_STATUS_INVALID && !isKeyOnCooldown(k, now));
                if (nextActiveIndex < 0) {
                    nextActiveIndex = 0;
                }
                keys.forEach((keyObj, index) => {
                    keyObj.active = (index === nextActiveIndex);
                });
                keysChanged = true;
            }
            
            // Save updated keys
            if (keys.length > 0) {
                keys = dedupeApiKeys(keys);
                const cooldownResult = clearExpiredCooldowns(keys, now);
                keys = cooldownResult.keys;
                keysChanged = keysChanged || cooldownResult.changed;
                if (keysChanged) {
                    saveUserApiKeys(keys);
                }
                localStorage.setItem('embedded_keys_imported', 'true');
                console.log('✅ Loaded', keys.length, 'API keys (embedded + stored)');
            }
        }
    }
    
    // If no keys yet, try to load from storage
    if (keys.length === 0) {
        keys = dedupeApiKeys(JSON.parse(localStorage.getItem(GLOBAL_API_KEYS_STORAGE_KEY) || '[]'));
        const cooldownResult = clearExpiredCooldowns(keys, now);
        keys = cooldownResult.keys;
        if (cooldownResult.changed) {
            saveUserApiKeys(keys);
        }
    }
    
    // Cache the result
    cachedApiKeys = keys;
    apiKeysCacheTime = Date.now();
    
    return keys;
}

function saveUserApiKeys(keys) {
    // Save to global storage - available to all users
    const normalizedKeys = dedupeApiKeys(keys);
    localStorage.setItem(GLOBAL_API_KEYS_STORAGE_KEY, JSON.stringify(normalizedKeys));
    // Invalidate cache
    cachedApiKeys = normalizedKeys;
    apiKeysCacheTime = Date.now();
    console.log('💾 Saved', normalizedKeys.length, 'API keys (global, shared across all users)');
}

function updateApiKeyRecord(apiKeyValue, updater) {
    const normalizedKey = sanitizeApiKey(apiKeyValue);
    if (!normalizedKey) {
        return false;
    }
    
    const keys = getUserApiKeys();
    let changed = false;
    
    const updatedKeys = keys.map(keyObj => {
        if (keyObj.key !== normalizedKey) {
            return keyObj;
        }
        changed = true;
        return updater({ ...keyObj });
    });
    
    if (changed) {
        saveUserApiKeys(updatedKeys);
    }
    
    return changed;
}

function markApiKeyWorking(apiKeyValue) {
    const normalizedKey = sanitizeApiKey(apiKeyValue);
    if (!normalizedKey) {
        return;
    }
    
    const keys = getUserApiKeys();
    let found = false;
    let changed = false;
    
    const updatedKeys = keys.map(keyObj => {
        if (keyObj.key === normalizedKey) {
            found = true;
            changed = true;
            return {
                ...keyObj,
                active: true,
                status: KEY_STATUS_WORKING,
                cooldownUntil: null,
                lastError: null,
                failedAt: null
            };
        }
        
        if (keyObj.active) {
            changed = true;
            return { ...keyObj, active: false };
        }
        
        return keyObj;
    });
    
    if (found && changed) {
        saveUserApiKeys(updatedKeys);
    }
}

function markApiKeyCooldown(apiKeyValue, cooldownMs, errorMessage) {
    updateApiKeyRecord(apiKeyValue, keyObj => ({
        ...keyObj,
        active: false,
        status: KEY_STATUS_COOLDOWN,
        cooldownUntil: Date.now() + cooldownMs,
        lastError: errorMessage || 'Temporary API failure',
        failedAt: new Date().toISOString()
    }));
}

function markApiKeyInvalid(apiKeyValue, errorMessage) {
    updateApiKeyRecord(apiKeyValue, keyObj => ({
        ...keyObj,
        active: false,
        status: KEY_STATUS_INVALID,
        cooldownUntil: null,
        lastError: errorMessage || 'API key is invalid or expired',
        failedAt: new Date().toISOString(),
        invalidAt: new Date().toISOString()
    }));
}

function buildCandidateApiKeys() {
    const now = Date.now();
    const keys = getUserApiKeys();
    const candidates = [];
    const seen = new Set();
    
    const activeKey = keys.find(k => k.active && k.status !== KEY_STATUS_INVALID && !isKeyOnCooldown(k, now));
    const orderedKeys = activeKey
        ? [activeKey, ...keys.filter(k => k.id !== activeKey.id)]
        : [...keys];
    
    orderedKeys.forEach(keyObj => {
        const key = sanitizeApiKey(keyObj.key);
        if (!key || seen.has(key)) {
            return;
        }
        
        if (keyObj.status === KEY_STATUS_INVALID || isKeyOnCooldown(keyObj, now)) {
            return;
        }
        
        seen.add(key);
        candidates.push({
            key,
            source: keyObj.embedded ? 'embedded' : 'stored',
            isBuiltIn: false
        });
    });
    
    const legacyKey = sanitizeApiKey(localStorage.getItem('gemini_api_key'));
    if (legacyKey && !seen.has(legacyKey)) {
        seen.add(legacyKey);
        candidates.push({
            key: legacyKey,
            source: 'legacy',
            isBuiltIn: false
        });
    }
    
    if (DEFAULT_BUILTIN_API_KEY) {
        const useBuiltInKey = localStorage.getItem('use_builtin_key');
        if (useBuiltInKey !== 'false') {
            if (useBuiltInKey === null) {
                localStorage.setItem('use_builtin_key', 'true');
            }
            
            const builtInKey = sanitizeApiKey(DEFAULT_BUILTIN_API_KEY);
            if (builtInKey && !seen.has(builtInKey)) {
                candidates.push({
                    key: builtInKey,
                    source: 'builtin',
                    isBuiltIn: true
                });
            }
        }
    }
    
    return candidates;
}

function createGeminiError(message, { statusCode = null, errorType = 'unknown', retryable = true } = {}) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.errorType = errorType;
    error.retryable = retryable;
    return error;
}

function classifyGeminiFailure(error) {
    if (!error) {
        return 'unknown';
    }
    
    if (error.errorType) {
        return error.errorType;
    }
    
    const message = String(error.message || '').toLowerCase();
    if (message.includes('request cancelled')) {
        return 'aborted';
    }
    if (
        message.includes('authentication failed') ||
        message.includes('invalid api key') ||
        message.includes('401') ||
        message.includes('403')
    ) {
        return 'auth';
    }
    if (
        message.includes('429') ||
        message.includes('quota') ||
        message.includes('rate limit') ||
        message.includes('resource exhausted')
    ) {
        return 'rate_limit';
    }
    
    return 'transient';
}

function applyKeyFailurePolicy(apiKeyValue, error) {
    const failureType = classifyGeminiFailure(error);
    if (failureType === 'aborted') {
        return;
    }
    
    if (failureType === 'auth') {
        markApiKeyInvalid(apiKeyValue, error.message);
        return;
    }
    
    if (failureType === 'rate_limit') {
        markApiKeyCooldown(apiKeyValue, KEY_RATE_LIMIT_COOLDOWN_MS, error.message);
        return;
    }
    
    markApiKeyCooldown(apiKeyValue, KEY_TRANSIENT_COOLDOWN_MS, error.message);
}

function getActiveApiKey() {
    const candidates = buildCandidateApiKeys();
    if (candidates.length === 0) {
        return null;
    }
    return candidates[0].key;
}

function setActiveApiKey(keyId) {
    const keys = getUserApiKeys();
    keys.forEach(k => {
        k.active = (k.id === keyId);
    });
    saveUserApiKeys(keys);
    refreshApiKeysList();
    updateStatusIndicator();
}

async function addApiKey() {
    const keyInput = document.getElementById('gemini-key');
    if (keyInput) {
        keyInput.value = '';
    }

    showToast({
        type: 'info',
        title: 'Backend Key Mode',
        message: 'Browser API key input is disabled. Configure Gemini keys only in backend .env variables.',
        duration: 5500
    });
}

function removeApiKey(keyId) {
    showConfirmModal({
        icon: '🗑️',
        title: 'Remove API Key',
        message: 'Are you sure you want to remove this API key?',
        confirmText: 'Remove',
        cancelText: 'Cancel',
        type: 'danger'
    }).then((confirmed) => {
        if (!confirmed) return;
        
        const keys = getUserApiKeys();
        const filteredKeys = keys.filter(k => k.id !== keyId);
        
        // If we removed the active key, activate the most recent one
        const wasActive = keys.find(k => k.id === keyId && k.active);
        if (wasActive && filteredKeys.length > 0) {
            filteredKeys[0].active = true;
        }
        
        saveUserApiKeys(filteredKeys);
        refreshApiKeysList();
        updateStatusIndicator();
        
        // Update legacy key if this was the active one
        const activeKey = getActiveApiKey();
        if (activeKey) {
            localStorage.setItem('gemini_api_key', activeKey);
        } else {
            localStorage.removeItem('gemini_api_key');
        }
    });
}

function toggleBuiltInKey() {
    const checkbox = document.getElementById('use-builtin-key');
    const useBuiltIn = checkbox ? checkbox.checked : true;
    localStorage.setItem('use_builtin_key', useBuiltIn.toString());
    updateStatusIndicator();
    
    const builtinInfo = document.getElementById('builtin-key-info');
    if (builtinInfo) {
        builtinInfo.style.display = useBuiltIn ? 'block' : 'none';
    }
    
    console.log('🔑 Built-in key:', useBuiltIn ? 'enabled' : 'disabled');
}

function refreshApiKeysList() {
    const keysList = document.getElementById('api-keys-list');
    if (!keysList) return;
    
    const keys = getUserApiKeys();
    const now = Date.now();
    const availableKeys = keys.filter(k => k.status !== KEY_STATUS_INVALID);
    const activeKeys = availableKeys.filter(k => !isKeyOnCooldown(k, now));
    const cooldownKeys = keys.filter(k => isKeyOnCooldown(k, now));
    const embeddedKeys = keys.filter(k => k.embedded);
    
    // Show simplified status (keys are hidden from users)
    if (keys.length === 0) {
        keysList.innerHTML = '<p style="margin: 0; font-size: 12px; color: var(--success-color);">✅ Server-managed AI keys enabled (.env on backend). No browser key setup required.</p>';
        return;
    }
    
    // Show count and status only (keys are hidden)
    const statusColor = activeKeys.length > 0 ? 'var(--success-color)' : 'var(--error-color)';
    const statusIcon = activeKeys.length > 0 ? '✅' : '⚠️';
    
    keysList.innerHTML = `
        <div style="padding: 8px;">
            <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: var(--text-primary);">
                ${statusIcon} ${keys.length} API Key${keys.length !== 1 ? 's' : ''} Configured
            </p>
            <p style="margin: 0; font-size: 11px; color: var(--text-secondary);">
                • ${embeddedKeys.length} embedded key${embeddedKeys.length !== 1 ? 's' : ''} from code<br>
                • ${activeKeys.length} active/working key${activeKeys.length !== 1 ? 's' : ''}<br>
                &bull; ${cooldownKeys.length} key${cooldownKeys.length !== 1 ? 's' : ''} in cooldown<br>
                • Automatic failover enabled (legacy browser-key mode)
            </p>
        </div>
    `;
}

// API Key Management
function saveApiKey() {
    const keyInput = document.getElementById('gemini-key');
    const key = keyInput ? keyInput.value.trim() : '';
    const model = document.getElementById('gemini-model').value;
    
    // Save model settings
    localStorage.setItem('gemini_model', model);
    
    // If a key is provided, add it using the new system
    if (key) {
        addApiKey().then(() => {
            // After adding key, save other settings
            showToast({
                type: 'success',
                title: 'Settings Saved',
                message: 'Using ' + model + ' (FREE Tier) with humorous and emotional responses!',
                duration: 5000
            });
            console.log('✅ Settings saved');
            console.log('📊 Selected model:', model);
            
            // Hide setup prompt and show chat interface
            const setupPrompt = document.getElementById('setup-prompt');
            const prechat = document.getElementById('prechat');
            const chat = document.getElementById('chat');
            
            if (setupPrompt) setupPrompt.style.display = 'none';
            if (prechat) prechat.style.display = 'none';
            if (chat) chat.style.display = 'flex';
            
            updateStatusIndicator();
        });
    } else {
        // Just save model settings
        showToast({
            type: 'success',
            title: 'Settings Saved',
            message: 'Your settings have been saved successfully!',
            duration: 4000
        });
        console.log('✅ Settings saved');
        console.log('📊 Selected model:', model);
        
        // In backend-proxy mode, no browser key is required.
        showToast({
            type: 'info',
            title: 'Server Keys Active',
            message: 'AI keys are managed securely on the backend environment.',
            duration: 4500
        });
    }
}

async function callBackendAIGenerate(prompt, generationConfig = {}, options = {}) {
    const preferredModel = localStorage.getItem('gemini_model') || 'gemini-1.5-flash';
    const payload = {
        prompt: prompt,
        preferredModel: preferredModel,
        generationConfig: {
            temperature: generationConfig.temperature ?? 0.9,
            maxOutputTokens: generationConfig.maxOutputTokens ?? 300,
            topP: generationConfig.topP ?? 0.95,
            topK: generationConfig.topK ?? 40
        }
    };

    const response = await apiRequest('/api/ai/generate', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify(payload),
        signal: options.signal
    });

    const text = response?.text?.trim?.();
    if (!text) {
        throw new Error('Invalid AI response from backend');
    }
    return text;
}

// Generate conversation title from first user message
async function generateConversationTitle(firstMessage) {
    try {
        const titlePrompt = `Based on this message, generate a short, concise conversation title (maximum 6 words, no quotes or punctuation at the end). Just return the title text only:\n\n"${firstMessage}"`;
        const title = await callBackendAIGenerate(titlePrompt, {
            maxOutputTokens: 20,
            temperature: 0.7,
            topP: 0.95,
            topK: 40
        });

        let cleanTitle = title.replace(/^["']|["']$/g, '').replace(/\.$/, '').trim();
        if (cleanTitle.length > 50) {
            cleanTitle = cleanTitle.substring(0, 47) + '...';
        }
        return cleanTitle || null;
    } catch (error) {
        console.warn('⚠️ Title generation failed:', error.message);
        return null;
    }
}

// AI Response Generation - uses backend proxy (server-managed keys from .env)
async function generateAIResponse(combinedMessage, originalMessages = null) {
    // Add all user messages to conversation history
    // If we have the original array of messages, add them individually
    // Otherwise, add the combined message
    if (originalMessages && originalMessages.length > 0) {
        // Add each message individually to preserve individual context
        originalMessages.forEach(msg => {
            conversationHistory.push({ role: "user", content: msg });
        });
    } else {
        // Fallback: add combined message
        conversationHistory.push({ role: "user", content: combinedMessage });
    }
    
    // Enhanced system prompt as Personal Guide for Emotional Well-being
    const systemPrompt = `${RESTRICTION}

You are Your Personal Guide for Emotional Well-being. You are a friendly, empathetic, and supportive emotional wellness companion. Your personality traits:
- Warm, caring, and genuinely concerned about users' emotional wellbeing
- Emotionally intelligent - adapt your tone to match the user's mood and needs
- Supportive and encouraging - help users navigate their feelings and challenges
- Use emojis naturally and expressively to convey emotions and warmth
- Share practical advice, insights, or encouragement when helpful
- Be thoughtful, understanding, and patient in your responses
- Keep responses concise but meaningful (2-4 sentences typically)
- Balance support with gentle guidance - know when to listen and when to offer perspective
- Use conversational, natural language like talking to a trusted friend
- Show genuine care and understanding - be empathetic, hopeful, and compassionate

Your role is to be a reliable emotional support companion that helps users feel heard, understood, and supported in their journey toward emotional wellbeing.

${INSTRUCTIONS}`;
    
    const context = conversationHistory.slice(-10).map(m => 
        m.role === 'user' ? `User: ${m.content}` : `Assistant: ${m.content}`
    ).join('\n');

    const prompt = `${systemPrompt}\n\nConversation history:\n${context}\n\nUser: ${combinedMessage}\nAssistant:`;

    abortController = new AbortController();
    try {
        const aiResponse = await callBackendAIGenerate(prompt, {
            temperature: 0.9,
            maxOutputTokens: 300,
            topP: 0.95,
            topK: 40
        }, {
            signal: abortController.signal
        });

        conversationHistory.push({ role: "assistant", content: aiResponse });
        return aiResponse;
    } catch (error) {
        if (error.name === 'AbortError' || (abortController && abortController.signal.aborted)) {
            throw new Error('Request cancelled by user');
        }
        throw error;
    }
}

// Chat Management Functions
function newChat() {
    // Save current conversation before starting new one (only if it has messages)
    if (currentConversationId) {
        const messages = document.getElementById('messages');
        if (messages && messages.children.length > 0) {
            // Save asynchronously without blocking
            saveCurrentConversation().catch(error => {
                console.error('❌ Error saving conversation:', error);
            });
        }
    }
    
    // Clear chat but don't create conversation until user sends first message (ChatGPT style)
    createNewConversation();
    
    // Update conversations list to highlight "New Chat" as active
    renderConversationsList();
    
    // Close conversations sidebar
    const sidebar = document.getElementById('conversations-sidebar');
    if (sidebar && sidebar.style.display === 'block') {
        toggleConversationsSidebar();
    }
}

function clearChat() {
    // Removed - replaced by newChat functionality
    newChat();
}

// Handle Enter key press in input field
document.addEventListener('DOMContentLoaded', function() {
    const userInput = document.getElementById('user-input');
    if (userInput) {
        userInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                // Prevent sending if AI is generating response (ChatGPT-like behavior)
                if (isGeneratingResponse) {
                    // If AI is generating, Enter key should trigger stop instead
                    stopAIResponse();
                } else {
                    sendMessage();
                }
            }
        });
    }
    
});


