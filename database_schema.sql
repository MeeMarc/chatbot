-- ========================================
-- Emotional AI Support Chatbot - Database Schema
-- PostgreSQL Database for Neon DB
-- ========================================

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- 1. USERS TABLE
-- Stores user authentication and profile data
-- ========================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Hashed password (use bcrypt/argon2)
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- ========================================
-- 2. CONVERSATIONS TABLE
-- Stores conversation metadata (ChatGPT-like conversations)
-- ========================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT false
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(is_archived);

-- ========================================
-- 3. MESSAGES TABLE
-- Stores individual messages in conversations
-- Normalized design for better performance
-- ========================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'ai', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    message_order INTEGER NOT NULL -- Order within conversation
);

-- Indexes for faster message retrieval
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_order ON messages(conversation_id, message_order);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ========================================
-- 4. API_KEYS TABLE (Optional)
-- Store API keys if you want to manage them in database
-- Otherwise, keep embedded in code as current implementation
-- ========================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_value VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    is_builtin BOOLEAN DEFAULT false,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT -- Optional notes about the key
);

CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_builtin ON api_keys(is_builtin);

-- ========================================
-- 5. USER_SETTINGS TABLE (Optional)
-- Store user preferences and settings
-- ========================================
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    preferred_model VARCHAR(100) DEFAULT 'gemini-pro',
    use_builtin_key BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- ========================================
-- 6. SESSIONS TABLE (Optional but Recommended)
-- For managing user sessions and authentication tokens
-- ========================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45), -- IPv6 compatible
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ========================================
-- TRIGGERS
-- Auto-update updated_at timestamps
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at (drop if exists first)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_last_accessed ON sessions;
CREATE TRIGGER update_sessions_last_accessed BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- HELPER VIEWS (Optional but Useful)
-- ========================================

-- View to get conversation with latest message info
CREATE OR REPLACE VIEW conversations_with_latest_message AS
SELECT 
    c.id,
    c.user_id,
    c.title,
    c.created_at,
    c.updated_at,
    c.is_archived,
    COUNT(m.id) as message_count,
    MAX(m.created_at) as last_message_at
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
GROUP BY c.id, c.user_id, c.title, c.created_at, c.updated_at, c.is_archived;

-- ========================================
-- EXAMPLE QUERIES (for reference)
-- ========================================

/*
-- Get all conversations for a user with message count
SELECT 
    c.id,
    c.title,
    c.updated_at,
    COUNT(m.id) as message_count
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
WHERE c.user_id = 'user-uuid-here' AND c.is_archived = false
GROUP BY c.id, c.title, c.updated_at
ORDER BY c.updated_at DESC;

-- Get all messages for a conversation
SELECT 
    m.role,
    m.content,
    m.created_at,
    m.message_order
FROM messages m
WHERE m.conversation_id = 'conversation-uuid-here'
ORDER BY m.message_order ASC;

-- Get user with settings
SELECT 
    u.id,
    u.email,
    u.name,
    COALESCE(us.preferred_model, 'gemini-pro') as preferred_model,
    COALESCE(us.use_builtin_key, true) as use_builtin_key
FROM users u
LEFT JOIN user_settings us ON u.id = us.user_id
WHERE u.email = 'user@example.com';
*/

