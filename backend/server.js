import express from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Database connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Neon DB
    }
});

// Test database connection
pool.on('connect', () => {
    console.log('✅ Connected to Neon DB');
});

pool.on('error', (err) => {
    console.error('❌ Database connection error:', err);
});

// Test endpoint to verify database connection
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ 
            status: 'ok', 
            database: 'connected',
            timestamp: result.rows[0].now
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// JWT Secret (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Middleware to verify JWT token (optional - for protected routes)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// ========================================
// AUTH ENDPOINTS
// ========================================

// Signup
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        // Check if user already exists
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const result = await pool.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
            [name, email, hashedPassword]
        );

        const user = result.rows[0];

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                createdAt: user.created_at
            },
            token
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Failed to create user: ' + error.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // Find user
        const result = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update last_login
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed: ' + error.message });
    }
});

// Verify token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ 
        success: true, 
        user: req.user 
    });
});

// ========================================
// CONVERSATIONS ENDPOINTS
// ========================================

// Get all conversations for a user
app.get('/api/conversations', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await pool.query(
            `SELECT 
                c.id, 
                c.title, 
                c.created_at, 
                c.updated_at,
                COUNT(m.id) as message_count
             FROM conversations c
             LEFT JOIN messages m ON c.id = m.conversation_id
             WHERE c.user_id = $1 AND c.is_archived = false
             GROUP BY c.id, c.title, c.created_at, c.updated_at
             ORDER BY c.updated_at DESC`,
            [userId]
        );

        res.json(result.rows.map(row => ({
            id: row.id,
            title: row.title,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            messageCount: parseInt(row.message_count)
        })));
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Failed to fetch conversations: ' + error.message });
    }
});

// Create new conversation
app.post('/api/conversations', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { title } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
            [userId, title || 'New Chat']
        );

        const conversation = result.rows[0];
        res.status(201).json({
            id: conversation.id,
            title: conversation.title,
            createdAt: conversation.created_at,
            updatedAt: conversation.updated_at
        });
    } catch (error) {
        console.error('Create conversation error:', error);
        res.status(500).json({ error: 'Failed to create conversation: ' + error.message });
    }
});

// Get single conversation with messages
app.get('/api/conversations/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Verify conversation belongs to user
        const convCheck = await pool.query(
            'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (convCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Get conversation
        const convResult = await pool.query(
            'SELECT * FROM conversations WHERE id = $1',
            [id]
        );

        // Get messages
        const messagesResult = await pool.query(
            'SELECT id, role, content, created_at, message_order FROM messages WHERE conversation_id = $1 ORDER BY message_order ASC',
            [id]
        );

        const conversation = convResult.rows[0];
        res.json({
            id: conversation.id,
            title: conversation.title,
            createdAt: conversation.created_at,
            updatedAt: conversation.updated_at,
            messages: messagesResult.rows.map(msg => ({
                role: msg.role,
                content: msg.content,
                createdAt: msg.created_at
            }))
        });
    } catch (error) {
        console.error('Get conversation error:', error);
        res.status(500).json({ error: 'Failed to fetch conversation: ' + error.message });
    }
});

// Update conversation (title)
app.put('/api/conversations/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { title } = req.body;

    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }

    try {
        // Verify conversation belongs to user
        const convCheck = await pool.query(
            'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (convCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const result = await pool.query(
            'UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [title, id]
        );

        const conversation = result.rows[0];
        res.json({
            id: conversation.id,
            title: conversation.title,
            updatedAt: conversation.updated_at
        });
    } catch (error) {
        console.error('Update conversation error:', error);
        res.status(500).json({ error: 'Failed to update conversation: ' + error.message });
    }
});

// Delete conversation
app.delete('/api/conversations/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Verify conversation belongs to user
        const convCheck = await pool.query(
            'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (convCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Delete conversation (messages will be deleted automatically due to CASCADE)
        await pool.query('DELETE FROM conversations WHERE id = $1', [id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete conversation error:', error);
        res.status(500).json({ error: 'Failed to delete conversation: ' + error.message });
    }
});

// ========================================
// MESSAGES ENDPOINTS
// ========================================

// Add message to conversation
app.post('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { role, content } = req.body;

    // Validate input
    if (!role || !content) {
        return res.status(400).json({ error: 'Role and content are required' });
    }

    if (!['user', 'ai', 'system'].includes(role)) {
        return res.status(400).json({ error: 'Role must be user, ai, or system' });
    }

    try {
        // Verify conversation belongs to user
        const convCheck = await pool.query(
            'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (convCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Get next message order
        const orderResult = await pool.query(
            'SELECT COALESCE(MAX(message_order), 0) + 1 as next_order FROM messages WHERE conversation_id = $1',
            [id]
        );
        const messageOrder = orderResult.rows[0].next_order;

        // Insert message
        const result = await pool.query(
            'INSERT INTO messages (conversation_id, role, content, message_order) VALUES ($1, $2, $3, $4) RETURNING *',
            [id, role, content, messageOrder]
        );

        // Update conversation updated_at
        await pool.query(
            'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
            [id]
        );

        // If first message and title is still "New Chat", update title
        if (role === 'user' && messageOrder === 1) {
            const titlePreview = content.substring(0, 50) + (content.length > 50 ? '...' : '');
            await pool.query(
                `UPDATE conversations 
                 SET title = CASE WHEN title = 'New Chat' THEN $1 ELSE title END,
                     updated_at = NOW()
                 WHERE id = $2`,
                [titlePreview, id]
            );
        }

        const message = result.rows[0];
        res.status(201).json({
            id: message.id,
            role: message.role,
            content: message.content,
            createdAt: message.created_at,
            messageOrder: message.message_order
        });
    } catch (error) {
        console.error('Add message error:', error);
        res.status(500).json({ error: 'Failed to add message: ' + error.message });
    }
});

// Get all messages for a conversation
app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Verify conversation belongs to user
        const convCheck = await pool.query(
            'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (convCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const result = await pool.query(
            'SELECT id, role, content, created_at, message_order FROM messages WHERE conversation_id = $1 ORDER BY message_order ASC',
            [id]
        );

        res.json(result.rows.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.created_at
        })));
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages: ' + error.message });
    }
});

// Bulk add messages (for batched messages)
app.post('/api/conversations/:id/messages/bulk', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { messages } = req.body; // Array of {role, content}

    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages array is required' });
    }

    try {
        // Verify conversation belongs to user
        const convCheck = await pool.query(
            'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (convCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Get starting message order
        const orderResult = await pool.query(
            'SELECT COALESCE(MAX(message_order), 0) as max_order FROM messages WHERE conversation_id = $1',
            [id]
        );
        let messageOrder = orderResult.rows[0].max_order;

        // Insert all messages
        const insertedMessages = [];
        for (const msg of messages) {
            messageOrder++;
            const result = await pool.query(
                'INSERT INTO messages (conversation_id, role, content, message_order) VALUES ($1, $2, $3, $4) RETURNING *',
                [id, msg.role, msg.content, messageOrder]
            );
            insertedMessages.push({
                id: result.rows[0].id,
                role: result.rows[0].role,
                content: result.rows[0].content,
                createdAt: result.rows[0].created_at
            });

            // Update title from first user message
            if (msg.role === 'user' && messageOrder === 1) {
                const titlePreview = msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '');
                await pool.query(
                    `UPDATE conversations 
                     SET title = CASE WHEN title = 'New Chat' THEN $1 ELSE title END,
                         updated_at = NOW()
                     WHERE id = $2`,
                    [titlePreview, id]
                );
            }
        }

        // Update conversation updated_at
        await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [id]);

        res.status(201).json({
            success: true,
            messages: insertedMessages
        });
    } catch (error) {
        console.error('Bulk add messages error:', error);
        res.status(500).json({ error: 'Failed to add messages: ' + error.message });
    }
});

// ========================================
// USER SETTINGS ENDPOINTS (Optional)
// ========================================

// Get user settings
app.get('/api/settings', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await pool.query(
            'SELECT * FROM user_settings WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            // Return defaults if no settings exist
            res.json({
                preferredModel: 'gemini-pro',
                useBuiltinKey: true
            });
        } else {
            const settings = result.rows[0];
            res.json({
                preferredModel: settings.preferred_model,
                useBuiltinKey: settings.use_builtin_key
            });
        }
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings: ' + error.message });
    }
});

// Update user settings
app.put('/api/settings', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { preferredModel, useBuiltinKey } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO user_settings (user_id, preferred_model, use_builtin_key)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id) 
             DO UPDATE SET preferred_model = $2, use_builtin_key = $3, updated_at = NOW()
             RETURNING *`,
            [userId, preferredModel || 'gemini-pro', useBuiltinKey !== undefined ? useBuiltinKey : true]
        );

        const settings = result.rows[0];
        res.json({
            preferredModel: settings.preferred_model,
            useBuiltinKey: settings.use_builtin_key
        });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings: ' + error.message });
    }
});

// ========================================
// ERROR HANDLING
// ========================================

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// ========================================
// START SERVER
// ========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📝 API endpoints available at /api/*`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing database pool...');
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, closing database pool...');
    await pool.end();
    process.exit(0);
});

