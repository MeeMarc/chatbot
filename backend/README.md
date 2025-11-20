# Emotional AI Chatbot - Backend API

Node.js/Express backend API for connecting the frontend to Neon DB (PostgreSQL).

## Features

- ✅ User authentication (signup/login) with JWT tokens
- ✅ Password hashing with bcrypt
- ✅ Conversations management (CRUD operations)
- ✅ Messages storage and retrieval
- ✅ User settings management
- ✅ Bulk message insertion for batched messages
- ✅ Automatic conversation title generation
- ✅ Secure database queries with parameterization

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and update with your Neon DB connection string:

```bash
cp .env.example .env
```

Edit `.env`:
```
DATABASE_URL=postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
PORT=3000
JWT_SECRET=your-secret-key-here
```

### 3. Run Database Schema

Make sure you've run `database_schema.sql` in your Neon DB SQL Editor to create all tables.

### 4. Start Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server will run on `http://localhost:3000`

## API Endpoints

### Health Check
- `GET /api/health` - Check database connection

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify JWT token (requires authentication)

### Conversations
- `GET /api/conversations` - Get all user conversations (requires authentication)
- `POST /api/conversations` - Create new conversation (requires authentication)
- `GET /api/conversations/:id` - Get conversation with messages (requires authentication)
- `PUT /api/conversations/:id` - Update conversation title (requires authentication)
- `DELETE /api/conversations/:id` - Delete conversation (requires authentication)

### Messages
- `GET /api/conversations/:id/messages` - Get all messages in conversation (requires authentication)
- `POST /api/conversations/:id/messages` - Add single message (requires authentication)
- `POST /api/conversations/:id/messages/bulk` - Add multiple messages at once (requires authentication)

### Settings
- `GET /api/settings` - Get user settings (requires authentication)
- `PUT /api/settings` - Update user settings (requires authentication)

## Request/Response Examples

### Signup
```bash
POST /api/auth/signup
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "jwt-token-here"
}
```

### Login
```bash
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "token": "jwt-token-here"
}
```

### Create Conversation
```bash
POST /api/conversations
Authorization: Bearer jwt-token-here
{
  "title": "New Chat"
}

Response:
{
  "id": "conversation-uuid",
  "title": "New Chat",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Add Message
```bash
POST /api/conversations/:id/messages
Authorization: Bearer jwt-token-here
{
  "role": "user",
  "content": "Hello, I need help"
}

Response:
{
  "id": "message-uuid",
  "role": "user",
  "content": "Hello, I need help",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "messageOrder": 1
}
```

### Bulk Add Messages
```bash
POST /api/conversations/:id/messages/bulk
Authorization: Bearer jwt-token-here
{
  "messages": [
    {"role": "user", "content": "Message 1"},
    {"role": "user", "content": "Message 2"}
  ]
}

Response:
{
  "success": true,
  "messages": [...]
}
```

## Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer your-jwt-token-here
```

## Testing

Test the health endpoint:
```bash
curl http://localhost:3000/api/health
```

Test signup:
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"test123"}'
```

## Deployment

### Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the backend directory
3. Add environment variables in Vercel dashboard
4. Deploy

### Deploy to Railway

1. Connect your GitHub repo
2. Add environment variables in Railway dashboard
3. Railway will auto-detect Node.js and deploy

### Deploy to Render

1. Create new Web Service
2. Connect your repo
3. Add environment variables
4. Set build command: `npm install`
5. Set start command: `npm start`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon DB connection string | Yes |
| `PORT` | Server port (default: 3000) | No |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `NODE_ENV` | Environment (development/production) | No |

## Troubleshooting

- **Connection refused**: Check DATABASE_URL is correct
- **SSL error**: Ensure `?sslmode=require` is in connection string
- **Table not found**: Run `database_schema.sql` in Neon DB
- **CORS errors**: CORS is enabled for all origins (configure in production)

