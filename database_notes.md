# Database Schema for Emotional AI Support Chatbot

## Overview
This document outlines the database schema for connecting the chat application to Neon DB (PostgreSQL).

## Required Tables

### 1. **users** (Required)
- Stores user authentication and profile information
- **Fields**: id, email, password_hash, name, created_at, updated_at, last_login, is_active
- **Notes**: Password should be hashed using bcrypt or argon2 before storage

### 2. **conversations** (Required)
- Stores conversation metadata (like ChatGPT conversations list)
- **Fields**: id, user_id (FK), title, created_at, updated_at, is_archived
- **Relations**: One user can have many conversations

### 3. **messages** (Required)
- Stores individual messages within conversations
- **Fields**: id, conversation_id (FK), role ('user' or 'ai'), content, created_at, message_order
- **Relations**: One conversation can have many messages
- **Notes**: Normalized design allows better querying and performance

### 4. **api_keys** (Optional)
- Store API keys if you want to manage them in database
- **Fields**: id, key_value, is_active, is_builtin, last_used_at, created_at, notes
- **Notes**: Currently API keys are embedded in code. This table is optional if you want server-side management.

### 5. **user_settings** (Optional)
- Store user preferences and settings
- **Fields**: id, user_id (FK), preferred_model, use_builtin_key, created_at, updated_at
- **Notes**: Currently stored in localStorage. This table allows persistent user preferences.

### 6. **sessions** (Recommended for Production)
- Manage user sessions and authentication tokens
- **Fields**: id, user_id (FK), session_token, expires_at, created_at, last_accessed_at, ip_address, user_agent
- **Notes**: Essential for secure authentication in production

## Database Connection Setup

### Step 1: Create Neon DB Database
1. Go to https://neon.tech and create an account
2. Create a new project
3. Copy your connection string (it will look like: `postgresql://user:password@host/dbname?sslmode=require`)

### Step 2: Run the Schema
1. Connect to your Neon DB using the connection string
2. Run the SQL in `database_schema.sql` to create all tables

### Step 3: Environment Variables
Create a `.env` file (never commit this):
```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```

## Next Steps

1. **Backend API** - You'll need to create a backend API (Node.js/Express, Python/Flask, etc.) to:
   - Handle authentication (login/signup)
   - Manage conversations and messages
   - Serve as a proxy between frontend and database

2. **Replace localStorage** - Update the frontend code to call API endpoints instead of localStorage

3. **Password Hashing** - Implement password hashing (bcrypt recommended) before storing in database

4. **Session Management** - Implement JWT tokens or session management for authentication

## Current Data Structure Mapping

### localStorage → Database

| localStorage Key | Database Table |
|-----------------|----------------|
| `users` array | `users` table |
| `currentUser` | Query `users` table by email |
| `isLoggedIn` | Use `sessions` table |
| `conversations_{email}` | `conversations` + `messages` tables |
| `gemini_api_key` | `api_keys` table (optional) |
| `gemini_model` | `user_settings` table |
| `use_builtin_key` | `user_settings` table |

## Sample API Endpoints Needed

```
POST   /api/auth/signup       - Create new user
POST   /api/auth/login        - Authenticate user
POST   /api/auth/logout       - End session
GET    /api/conversations     - Get user's conversations
POST   /api/conversations     - Create new conversation
GET    /api/conversations/:id - Get conversation with messages
POST   /api/conversations/:id/messages - Add message to conversation
PUT    /api/conversations/:id - Update conversation (title, etc.)
DELETE /api/conversations/:id - Delete conversation
GET    /api/settings          - Get user settings
PUT    /api/settings          - Update user settings
```

