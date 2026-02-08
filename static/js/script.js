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
const AI_BACKEND_REQUEST_TIMEOUT_MS = 7000;
const LOW_QUOTA_MODE = true;
const MAX_CONTEXT_TURNS = LOW_QUOTA_MODE ? 6 : 10;
const AI_STRICT_CORRECTION_PASSES = LOW_QUOTA_MODE ? 0 : 2;
const LEGACY_BROWSER_KEY_STORAGE_KEYS = [
    'gemini_api_keys_global',
    'gemini_api_key',
    'embedded_keys_imported',
    'use_builtin_key'
];
const SUPPORTED_CHAT_LANGUAGES = ['ilokano', 'filipino', 'english'];
const LANGUAGE_PREF_STORAGE_KEY = 'chat_reply_language_preference';

function clearLegacyBrowserApiKeyState() {
    // Backend proxy mode: never keep Gemini API keys in browser storage.
    LEGACY_BROWSER_KEY_STORAGE_KEYS.forEach((key) => {
        try {
            localStorage.removeItem(key);
        } catch (_error) {
            // Ignore storage cleanup errors.
        }
    });
}

function getStoredLanguagePreference() {
    const value = String(localStorage.getItem(LANGUAGE_PREF_STORAGE_KEY) || '').toLowerCase();
    return SUPPORTED_CHAT_LANGUAGES.includes(value) ? value : null;
}

function setStoredLanguagePreference(language) {
    if (SUPPORTED_CHAT_LANGUAGES.includes(language)) {
        localStorage.setItem(LANGUAGE_PREF_STORAGE_KEY, language);
    }
}

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
        const rawBody = await response.text();
        let data = {};

        if (rawBody) {
            try {
                data = JSON.parse(rawBody);
            } catch (_parseError) {
                data = { error: rawBody.slice(0, 300) };
            }
        }

        if (!response.ok) {
            const backendError = String(data?.error || '').trim();
            const statusInfo = `HTTP ${response.status}`;
            const message = backendError || `${statusInfo}: API request failed`;
            throw new Error(message);
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
    clearLegacyBrowserApiKeyState();
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

        const latestUserMessage = messagesToProcess[messagesToProcess.length - 1] || combinedMessage;
        const aiErrorType = classifyAIError(error);
        const fallbackReply = buildLocalFallbackReply(latestUserMessage, error);
        appendAI(fallbackReply);

        showToast({
            type: 'warning',
            title: aiErrorType === 'rate_limit' ? 'AI Quota Reached' : 'Temporary AI Issue',
            message: aiErrorType === 'rate_limit'
                ? 'Backend Gemini keys hit quota/rate limits. Add fresh keys or wait for reset.'
                : 'Using backup reply mode for this message. Please try again in a few seconds.',
            duration: 3500
        });
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

// Backend-only AI key mode (frontend never stores provider keys).
function refreshApiKeysList() {
    const keysList = document.getElementById('api-keys-list');
    if (!keysList) return;
    keysList.innerHTML = '<p style="margin: 0; font-size: 12px; color: var(--success-color);">Server-managed AI keys are enabled (.env on backend). Browser key storage is disabled.</p>';
}

function setActiveApiKey(keyId) {
    void keyId;
    refreshApiKeysList();
    updateStatusIndicator();
}

async function addApiKey() {
    const keyInput = document.getElementById('gemini-key');
    if (keyInput) {
        keyInput.value = '';
    }

    clearLegacyBrowserApiKeyState();
    refreshApiKeysList();

    showToast({
        type: 'info',
        title: 'Backend Key Mode',
        message: 'Browser API key input is disabled. Configure Gemini keys only in backend .env variables.',
        duration: 5500
    });
}

function removeApiKey(keyId) {
    void keyId;
    clearLegacyBrowserApiKeyState();
    refreshApiKeysList();
    updateStatusIndicator();
}

function toggleBuiltInKey() {
    clearLegacyBrowserApiKeyState();
    refreshApiKeysList();
    updateStatusIndicator();
}

function saveApiKey() {
    const model = document.getElementById('gemini-model').value;
    localStorage.setItem('gemini_model', model);

    showToast({
        type: 'success',
        title: 'Settings Saved',
        message: 'Server key mode enabled. AI keys are read from backend .env only.',
        duration: 4000
    });

    refreshApiKeysList();
    updateStatusIndicator();
}

function sleepMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function createAbortSignalWithTimeout(parentSignal, timeoutMs) {
    const controller = new AbortController();
    let timeoutId = null;

    const abortFromParent = () => controller.abort();
    if (parentSignal) {
        if (parentSignal.aborted) {
            controller.abort();
        } else {
            parentSignal.addEventListener('abort', abortFromParent, { once: true });
        }
    }

    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    const cleanup = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (parentSignal) {
            parentSignal.removeEventListener('abort', abortFromParent);
        }
    };

    return { signal: controller.signal, cleanup };
}

function shouldRetryAIRequest(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
        message.includes('service unavailable') ||
        message.includes('request failed') ||
        message.includes('temporarily') ||
        message.includes('timeout') ||
        message.includes('rate limit') ||
        message.includes('429') ||
        message.includes('503') ||
        message.includes('network') ||
        message.includes('failed to fetch')
    );
}

function detectLanguageHint(rawText, persistPreference = true) {
    const message = String(rawText || '').toLowerCase();

    // Explicit preference in the user's latest message overrides everything.
    if (/\b(ilokano|ilocano|iloco)\b/.test(message)) {
        if (persistPreference) setStoredLanguagePreference('ilokano');
        return 'ilokano';
    }
    if (/\b(filipino|tagalog)\b/.test(message)) {
        if (persistPreference) setStoredLanguagePreference('filipino');
        return 'filipino';
    }
    if (/\b(english)\b/.test(message)) {
        if (persistPreference) setStoredLanguagePreference('english');
        return 'english';
    }

    const unsupportedLanguageTerms = [
        'kapampangan', 'pampango', 'bisaya', 'cebuano', 'hiligaynon', 'ilonggo',
        'waray', 'chavacano', 'bicol', 'bikol', 'pangasinan',
        'spanish', 'espanol', 'french', 'german', 'italian', 'portuguese',
        'japanese', 'korean', 'chinese', 'mandarin', 'arabic', 'hindi', 'thai', 'vietnamese'
    ];
    if (unsupportedLanguageTerms.some((term) => message.includes(term))) return 'unsupported';

    // If message contains clearly non-Latin scripts, treat as unsupported for now.
    if (/[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u0980-\u09FF\u3040-\u30FF\u31F0-\u31FF\u4E00-\u9FFF\uAC00-\uD7AF\u0E00-\u0E7F]/.test(message)) {
        return 'unsupported';
    }

    // Lightweight lexical hints.
    if (/\b(adda|haan|wen|anya|kasta|agyaman|manong|manang|kabsat|sika)\b/.test(message)) {
        if (persistPreference) setStoredLanguagePreference('ilokano');
        return 'ilokano';
    }
    if (/\b(ako|ikaw|po|kamusta|salamat|hindi|oo|pwede|gusto)\b/.test(message)) {
        if (persistPreference) setStoredLanguagePreference('filipino');
        return 'filipino';
    }
    if (/\b(hello|hi|hey|thanks|thank you|the|and|is|are|you|please|can|could|what|how|help)\b/.test(message)) {
        if (persistPreference) setStoredLanguagePreference('english');
        return 'english';
    }

    return null;
}

function inferLanguageFromRecentUserTurns() {
    for (let i = conversationHistory.length - 1; i >= 0; i -= 1) {
        const turn = conversationHistory[i];
        if (!turn || turn.role !== 'user') continue;
        const inferred = detectLanguageHint(turn.content, false);
        if (inferred && inferred !== 'unsupported') {
            return inferred;
        }
    }
    return null;
}

function detectFallbackLanguage(text) {
    const immediate = detectLanguageHint(text, true);
    if (immediate) {
        return immediate;
    }

    // Prefer the current conversation's recent user language over old global preference.
    const recentUserLanguage = inferLanguageFromRecentUserTurns();
    if (recentUserLanguage) {
        setStoredLanguagePreference(recentUserLanguage);
        return recentUserLanguage;
    }

    const storedPreference = getStoredLanguagePreference();
    if (storedPreference) {
        return storedPreference;
    }

    // Default to English when unclear.
    return 'english';
}

function buildUnsupportedLanguageNotice() {
    return "Sorry, I can only reply in Ilokano, Filipino, or English for now. I can't reply in that language/dialect yet.";
}

function classifyAIError(error) {
    const message = String(error?.message || '').toLowerCase();
    if (!message) return 'generic';
    if (
        message.includes('usage limit')
        || message.includes('quota')
        || message.includes('rate limit')
        || message.includes('resource exhausted')
        || message.includes('429')
    ) {
        return 'rate_limit';
    }
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('busy')) return 'busy';
    return 'generic';
}

function buildLocalFallbackReply(userMessage, error = null) {
    const language = detectFallbackLanguage(userMessage);
    const errorType = classifyAIError(error);

    if (language === 'unsupported') {
        return buildUnsupportedLanguageNotice();
    }
    if (errorType === 'rate_limit') {
        if (language === 'filipino') {
            return 'Narito pa rin ako para sa iyo. Naabot na ng AI service ang usage limit ngayon. Pakisubukang muli mamaya o i-update ang backend API keys.';
        }
        if (language === 'ilokano') {
            return 'Addaak pay ditoy para kenka. Naal-alaan ti usage limit ti AI service ita. Padasem manen inton ud-udina wenno i-update ti backend API keys.';
        }
        return 'I am still here with you. The AI service reached its usage limit right now. Please try again later or update backend API keys.';
    }
    if (language === 'filipino') {
        return 'Narito pa rin ako para sa iyo. May pansamantalang problema sa koneksyon sa AI service ngayon. Pakisubukang ipadala muli ang mensahe mo pagkalipas ng ilang segundo.';
    }
    if (language === 'ilokano') {
        return 'Addaak pay ditoy para kenka. Adda bassit a parikut iti koneksyon iti AI service ita. Padasem manen ti mensahem kalpasan ti bassit a segundo.';
    }

    return 'I am still here with you. There is a temporary connection issue with the AI service right now. Please try sending your message again in a few seconds.';
}

function extractRequestedItemConstraint(latestUserMessage) {
    const message = String(latestUserMessage || '').toLowerCase();
    const sentencePattern = /\b(sentence|sentences|sentensa|sentensya|pangungusap)\b/;
    const phrasePattern = /\b(phrase|phrases|kataga|parirala)\b/;
    const examplePattern = /\b(example|examples|halimbawa|pagwadan)\b/;
    const concreteItemPattern = /\b(word|words|vocabulary|translate|translation|meaning|meanings|kahulugan|sasao|salita|sao)\b/;
    const asksForConcreteLanguageItems = sentencePattern.test(message)
        || phrasePattern.test(message)
        || examplePattern.test(message)
        || concreteItemPattern.test(message);
    if (!asksForConcreteLanguageItems) {
        return null;
    }

    const unit = sentencePattern.test(message) ? 'sentences'
        : phrasePattern.test(message) ? 'phrases'
        : examplePattern.test(message) ? 'examples'
        : 'words';

    let count = null;
    const digitMatch = message.match(/\b([1-9]\d{0,2})\b/);
    if (digitMatch) {
        count = parseInt(digitMatch[1], 10);
    } else {
        const wordToNumber = {
            one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
            eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
            isa: 1, dalawa: 2, tatlo: 3, apat: 4, lima: 5, anim: 6, pito: 7, walo: 8, siyam: 9, sampu: 10,
            maysa: 1, dua: 2, tallo: 3, uppat: 4, innem: 6, siam: 9, sangapulo: 10
        };
        for (const [word, number] of Object.entries(wordToNumber)) {
            if (new RegExp(`\\b${word}\\b`).test(message)) {
                count = number;
                break;
            }
        }
    }

    return {
        asksForConcreteLanguageItems,
        unit,
        count: count && count > 0 ? Math.min(count, 30) : null
    };
}

function countNumberedItems(text) {
    const content = String(text || '');
    if (!content) return 0;

    // Prefer line-based counting for properly formatted lists.
    const lineMatches = content.match(/^\s*\d{1,2}[.)-]\s+/gm);
    if (lineMatches && lineMatches.length > 0) {
        return lineMatches.length;
    }

    // Fallback for single-line lists such as "1. ... 2. ... 3. ...".
    const inlineMatches = content.match(/(?:^|\s)\d{1,2}[.)-]\s+/g);
    return inlineMatches ? inlineMatches.length : 0;
}

function buildTaskFulfillmentDirective(latestUserMessage, detectedLanguage, constraint) {
    const asksForConcreteLanguageItems = Boolean(constraint?.asksForConcreteLanguageItems);

    if (asksForConcreteLanguageItems) {
        if (constraint?.count) {
            return `TASK MODE: Concrete language help.
- Satisfy the user's request directly.
- Return exactly ${constraint.count} ${constraint.unit}.
- Use a numbered list from 1 to ${constraint.count}.
- No intro text and no ending filler text.
- This is a strict list task; do not use the default 2-4 sentence chat style.
- Keep the whole reply in ${detectedLanguage}.
- Include translations/meanings only if the user explicitly asked for them.`;
        }
        return `TASK MODE: Concrete language help.
- Satisfy the user's request directly.
- Provide at least 5 concrete items when they ask for words/phrases/examples.
- Use a numbered list when possible.
- This is a list task; do not use the default 2-4 sentence chat style.
- Keep the whole reply in ${detectedLanguage}.
- Do not switch to another language unless the user asks to switch.`;
    }

    return `TASK MODE: General response.
- Prioritize answering the user's exact request first.
- Keep the whole reply in ${detectedLanguage}.
- Be concise but complete.`;
}

function getResponseGenerationConfig(constraint) {
    if (constraint?.count) {
        const unitMultiplier = constraint.unit === 'sentences' ? 70 : 40;
        const maxOutputTokens = Math.max(
            LOW_QUOTA_MODE ? 220 : 700,
            Math.min(LOW_QUOTA_MODE ? 650 : 2400, constraint.count * unitMultiplier)
        );
        return {
            temperature: 0.45,
            maxOutputTokens,
            topP: 0.9,
            topK: 32
        };
    }
    if (constraint?.asksForConcreteLanguageItems) {
        return {
            temperature: 0.5,
            maxOutputTokens: LOW_QUOTA_MODE ? 320 : 900,
            topP: 0.9,
            topK: 32
        };
    }

    return {
        temperature: 0.75,
        maxOutputTokens: LOW_QUOTA_MODE ? 220 : 300,
        topP: 0.95,
        topK: 40
    };
}

async function callBackendAIGenerate(prompt, generationConfig = {}, options = {}) {
    const preferredModel = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';
    const payload = {
        prompt: prompt,
        preferredModel: preferredModel,
        generationConfig: {
            temperature: generationConfig.temperature ?? 0.9,
            maxOutputTokens: generationConfig.maxOutputTokens ?? (LOW_QUOTA_MODE ? 220 : 300),
            topP: generationConfig.topP ?? 0.95,
            topK: generationConfig.topK ?? 40
        }
    };

    const retryDelays = [0];
    let lastError = null;

    for (let attempt = 0; attempt < retryDelays.length; attempt++) {
        if (attempt > 0) {
            if (options.signal?.aborted) {
                throw new Error('Request cancelled by user');
            }
            await sleepMs(retryDelays[attempt]);
        }

        const timedRequest = createAbortSignalWithTimeout(options.signal, AI_BACKEND_REQUEST_TIMEOUT_MS);
        try {
            const response = await apiRequest('/api/ai/generate', {
                method: 'POST',
                skipAuth: true,
                body: JSON.stringify(payload),
                signal: timedRequest.signal
            });

            const text = response?.text?.trim?.();
            if (!text) {
                throw new Error('Invalid AI response from backend');
            }
            return text;
        } catch (error) {
            if (error.name === 'AbortError') {
                if (options.signal?.aborted) {
                    throw new Error('Request cancelled by user');
                }
                lastError = new Error('AI request timeout. Please try again.');
            } else {
                lastError = error;
            }

            if (options.signal?.aborted) {
                throw new Error('Request cancelled by user');
            }
            if (attempt === retryDelays.length - 1 || !shouldRetryAIRequest(lastError)) {
                break;
            }
        } finally {
            timedRequest.cleanup();
        }
    }

    throw (lastError || new Error('AI service request failed. Please try again.'));
}

// Generate conversation title from first user message
async function generateConversationTitle(firstMessage) {
    try {
        // Local title generation reduces extra AI calls and lowers error frequency.
        const text = String(firstMessage || '').replace(/\s+/g, ' ').trim();
        if (!text) return null;

        const words = text.split(' ').slice(0, 6);
        let cleanTitle = words.join(' ').replace(/[.,!?;:]+$/, '').trim();
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

    const latestUserMessage = (originalMessages && originalMessages.length > 0)
        ? originalMessages[originalMessages.length - 1]
        : combinedMessage;
    const detectedLanguage = detectFallbackLanguage(latestUserMessage);
    const requestConstraint = extractRequestedItemConstraint(latestUserMessage);
    if (detectedLanguage === 'unsupported') {
        const notice = buildUnsupportedLanguageNotice();
        conversationHistory.push({ role: "assistant", content: notice });
        return notice;
    }
    
    const compactSystemPrompt = `${RESTRICTION}

You are a warm, empathetic emotional wellness companion.
- Keep replies concise and useful (2-4 sentences unless the user asks for a list/count).
- Prioritize the user's exact request and avoid filler.
- Keep language natural and supportive.

${INSTRUCTIONS}`;

    // Richer prompt for normal mode; compact prompt in low-quota mode.
    const richSystemPrompt = `${RESTRICTION}

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
    const systemPrompt = LOW_QUOTA_MODE ? compactSystemPrompt : richSystemPrompt;
    
    const context = conversationHistory.slice(-MAX_CONTEXT_TURNS).map(m => 
        m.role === 'user' ? `User: ${m.content}` : `Assistant: ${m.content}`
    ).join('\n');

    const turnLanguageDirective = `CURRENT TURN LANGUAGE: Reply in ${detectedLanguage}. If the user asks to switch to Ilokano, Filipino, or English, switch immediately.`;
    const taskDirective = buildTaskFulfillmentDirective(latestUserMessage, detectedLanguage, requestConstraint);
    const prompt = `${systemPrompt}\n\n${turnLanguageDirective}\n\n${taskDirective}\n\nConversation history:\n${context}\n\nUser: ${combinedMessage}\nAssistant:`;
    const generationConfig = getResponseGenerationConfig(requestConstraint);

    abortController = new AbortController();
    try {
        let aiResponse = await callBackendAIGenerate(prompt, generationConfig, {
            signal: abortController.signal
        });

        // If user asked for an exact count and response misses it, run strict correction passes.
        if (requestConstraint?.count) {
            let actualCount = countNumberedItems(aiResponse);
            let correctionAttempt = 0;

            while (actualCount !== requestConstraint.count && correctionAttempt < AI_STRICT_CORRECTION_PASSES) {
                const correctionPrompt = `${systemPrompt}\n\n${turnLanguageDirective}\n\nCORRECTION MODE:
- Return exactly ${requestConstraint.count} ${requestConstraint.unit}.
- Number each item from 1 to ${requestConstraint.count}.
- No intro and no outro.
- Keep output in ${detectedLanguage}.
- Ensure all items are complete and not cut off.
- Do not stop until item ${requestConstraint.count} is provided.\n\nUser request:\n${latestUserMessage}\n\nAssistant:`;

                aiResponse = await callBackendAIGenerate(correctionPrompt, {
                    ...generationConfig,
                    temperature: 0.25,
                    maxOutputTokens: Math.max(
                        generationConfig.maxOutputTokens || 0,
                        requestConstraint.count * (requestConstraint.unit === 'sentences' ? 110 : 65)
                    )
                }, {
                    signal: abortController.signal
                });

                actualCount = countNumberedItems(aiResponse);
                correctionAttempt += 1;
            }
        }

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






