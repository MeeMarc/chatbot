# Neon DB Setup Guide for Emotional AI Support Chatbot

## Step 1: Create Neon DB Project

1. Go to https://neon.tech and sign up/login
2. Click "Create project"
3. Configure your project:
   - **Project name**: `chatbot` (or your preferred name)
   - **Postgres version**: `17` (recommended) or `16`
   - **Cloud provider**: `AWS` (recommended) or `Azure`
   - **Region**: Choose closest to your users (e.g., "AWS Asia Pacific 1 (Singapore)")
   - **Enable Neon Auth**: Leave OFF (we'll handle auth ourselves)
4. Click "Create"

## Step 2: Get Connection String

1. After project creation, go to your project dashboard
2. Click on "Connection Details" or "Connection String"
3. Copy the connection string (looks like):
   ```
   postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
4. **IMPORTANT**: Save this securely - you'll need it for your backend

## Step 3: Run Database Schema

1. In Neon dashboard, go to "SQL Editor"
2. Copy the entire contents of `database_schema.sql`
3. Paste and run it in the SQL Editor
4. Verify tables were created (you should see: users, conversations, messages, etc.)

## Step 4: Backend API Setup

You need to create a backend API to connect your frontend to the database. Choose one:

### Option A: Node.js/Express (Recommended)

**Create `server.js`:**

```javascript
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) console.error('Database connection error:', err);
    else console.log('✅ Database connected:', res.rows[0].now);
});

// Auth endpoints
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
            [name, email, hashedPassword]
        );
        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Update last_login
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
        res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Conversations endpoints
app.get('/api/conversations', async (req, res) => {
    const { user_id } = req.query;
    try {
        const result = await pool.query(
            'SELECT * FROM conversations WHERE user_id = $1 AND is_archived = false ORDER BY updated_at DESC',
            [user_id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/conversations', async (req, res) => {
    const { user_id, title } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
            [user_id, title || 'New Chat']
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/conversations/:id/messages', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY message_order ASC',
            [id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/conversations/:id/messages', async (req, res) => {
    const { id } = req.params;
    const { role, content, message_order } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO messages (conversation_id, role, content, message_order) VALUES ($1, $2, $3, $4) RETURNING *',
            [id, role, content, message_order]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/conversations/:id', async (req, res) => {
    const { id } = req.params;
    const { title } = req.body;
    try {
        const result = await pool.query(
            'UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [title, id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/conversations/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM conversations WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
```

**Create `package.json`:**

```json
{
  "name": "emotional-ai-chatbot-api",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

**Create `.env` file:**

```
DATABASE_URL=postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
PORT=3000
```

### Option B: Python/Flask

**Create `app.py`:**

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import bcrypt
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Database connection
def get_db_connection():
    return psycopg2.connect(
        os.getenv('DATABASE_URL'),
        cursor_factory=RealDictCursor
    )

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        hashed = bcrypt.hashpw(data['password'].encode(), bcrypt.gensalt()).decode()
        cur.execute(
            'INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s) RETURNING id, name, email, created_at',
            (data['name'], data['email'], hashed)
        )
        user = cur.fetchone()
        conn.commit()
        return jsonify({'success': True, 'user': dict(user)})
    except Exception as e:
        return jsonify({'error': str(e)}), 400
    finally:
        cur.close()
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute('SELECT * FROM users WHERE email = %s', (data['email'],))
        user = cur.fetchone()
        if not user or not bcrypt.checkpw(data['password'].encode(), user['password_hash'].encode()):
            return jsonify({'error': 'Invalid credentials'}), 401
        cur.execute('UPDATE users SET last_login = NOW() WHERE id = %s', (user['id'],))
        conn.commit()
        return jsonify({
            'success': True,
            'user': {'id': str(user['id']), 'name': user['name'], 'email': user['email']}
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close()
        conn.close()

# Add other endpoints similarly...

if __name__ == '__main__':
    app.run(port=3000, debug=True)
```

**Create `requirements.txt`:**

```
Flask==3.0.0
flask-cors==4.0.0
psycopg2-binary==2.9.9
bcrypt==4.1.1
python-dotenv==1.0.0
```

## Step 5: Update Frontend Code

You'll need to replace localStorage calls with API calls. Here's what needs to change:

### Files to Update:

1. **`login.html`** - Replace localStorage auth with API calls
2. **`signup.html`** - Replace localStorage signup with API calls  
3. **`script.js`** - Replace localStorage conversation/message storage with API calls

### Example API Integration:

**Create `api.js` (new file):**

```javascript
const API_BASE_URL = 'http://localhost:3000/api'; // Change to your deployed URL

// Auth API
export async function signup(name, email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    });
    return response.json();
}

export async function login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    return response.json();
}

// Conversations API
export async function getConversations(userId) {
    const response = await fetch(`${API_BASE_URL}/conversations?user_id=${userId}`);
    return response.json();
}

export async function createConversation(userId, title) {
    const response = await fetch(`${API_BASE_URL}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, title })
    });
    return response.json();
}

export async function getMessages(conversationId) {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`);
    return response.json();
}

export async function addMessage(conversationId, role, content, messageOrder) {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content, message_order: messageOrder })
    });
    return response.json();
}

export async function updateConversation(conversationId, title) {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
    });
    return response.json();
}

export async function deleteConversation(conversationId) {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}`, {
        method: 'DELETE'
    });
    return response.json();
}
```

## Step 6: Environment Variables

**For Backend (`.env`):**
```
DATABASE_URL=postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
PORT=3000
NODE_ENV=production
```

**For Frontend (if needed):**
Create `config.js`:
```javascript
const config = {
    API_URL: process.env.API_URL || 'http://localhost:3000/api'
};
```

## Step 7: Deployment Checklist

### Backend Deployment (Vercel/Railway/Render):

1. **Vercel** (Recommended for Node.js):
   - Install Vercel CLI: `npm i -g vercel`
   - Run `vercel` in your backend folder
   - Add environment variables in Vercel dashboard
   - Update frontend API_URL to point to Vercel URL

2. **Railway**:
   - Connect GitHub repo
   - Add DATABASE_URL environment variable
   - Deploy automatically

3. **Render**:
   - Create new Web Service
   - Connect repo
   - Add environment variables
   - Deploy

### Frontend Deployment:

1. **Vercel/Netlify**:
   - Connect your frontend repo
   - Set build command (if needed)
   - Set environment variables
   - Deploy

## Step 8: Security Considerations

1. **Never expose DATABASE_URL in frontend code**
2. **Use environment variables** for all sensitive data
3. **Implement JWT tokens** for authentication (recommended)
4. **Add rate limiting** to prevent abuse
5. **Use HTTPS** in production
6. **Validate all inputs** on backend
7. **Use parameterized queries** (already in examples) to prevent SQL injection

## Step 9: Testing

1. Test database connection
2. Test signup/login
3. Test creating conversations
4. Test saving messages
5. Test loading conversations
6. Test deleting conversations

## Quick Start Commands

```bash
# Backend (Node.js)
npm install
npm start

# Backend (Python)
pip install -r requirements.txt
python app.py

# Test database connection
psql "your-connection-string" -c "SELECT version();"
```

## Troubleshooting

- **Connection refused**: Check DATABASE_URL is correct
- **SSL error**: Add `?sslmode=require` to connection string
- **Table not found**: Run database_schema.sql again
- **CORS errors**: Enable CORS in backend (already in examples)

