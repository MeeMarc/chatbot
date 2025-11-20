# Emotional AI Chatbot - Backend API (Python/Flask)

Python/Flask backend API for connecting the frontend to Neon DB (PostgreSQL).

## Features

- ✅ User authentication (signup/login) with JWT tokens
- ✅ Password hashing with bcrypt
- ✅ Conversations management (CRUD operations)
- ✅ Messages storage and retrieval
- ✅ User settings management
- ✅ Bulk message insertion for batched messages
- ✅ Automatic conversation title generation
- ✅ Secure database queries with parameterization
- ✅ Connection pooling for better performance

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Neon DB account and connection string

## Setup

### 1. Install Python Dependencies

```bash
cd backend-python
pip install -r requirements.txt
```

Or use a virtual environment (recommended):

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
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

### 3. Generate JWT Secret (Optional)

Generate a secure random secret:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output to `JWT_SECRET` in your `.env` file.

### 4. Run Database Schema

Make sure you've run `../database_schema.sql` in your Neon DB SQL Editor to create all tables.

**Note:** If you get errors about `message_order` column, add it to the messages table:

```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_order INTEGER;
```

### 5. Start Server

**Development mode:**
```bash
python server.py
```

**Production mode (using gunicorn):**
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:3000 server:app
```

Server will run on `http://localhost:3000`

## API Endpoints

Same as Node.js version:

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

Same format as Node.js version. See Node.js README for examples.

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

### Deploy to Railway

1. Connect your GitHub repo
2. Add environment variables in Railway dashboard
3. Set start command: `gunicorn -w 4 -b 0.0.0.0:$PORT server:app`
4. Railway will auto-detect Python and install dependencies

### Deploy to Render

1. Create new Web Service
2. Connect your repo
3. Add environment variables
4. Set build command: `pip install -r requirements.txt`
5. Set start command: `gunicorn -w 4 -b 0.0.0.0:$PORT server:app`

### Deploy to Heroku

1. Create `Procfile`:
   ```
   web: gunicorn -w 4 -b 0.0.0.0:$PORT server:app
   ```

2. Deploy:
   ```bash
   heroku create your-app-name
   heroku config:set DATABASE_URL=your-neon-connection-string
   heroku config:set JWT_SECRET=your-secret-key
   git push heroku main
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon DB connection string | Yes |
| `PORT` | Server port (default: 3000) | No |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `NODE_ENV` | Environment (development/production) | No |

## Troubleshooting

- **Module not found**: Run `pip install -r requirements.txt`
- **Connection refused**: Check DATABASE_URL is correct
- **SSL error**: Ensure `?sslmode=require` is in connection string
- **Table not found**: Run `database_schema.sql` in Neon DB
- **message_order error**: Add column: `ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_order INTEGER;`
- **CORS errors**: CORS is enabled for all origins (configure in production)

## Differences from Node.js Version

- Uses `psycopg2` for PostgreSQL connection
- Uses `Flask-CORS` instead of `cors` package
- Uses `bcrypt` Python library (same algorithm, different API)
- Uses `PyJWT` instead of `jsonwebtoken`
- Connection pooling with `SimpleConnectionPool`

## Production Considerations

1. Use `gunicorn` or `uWSGI` as WSGI server (not Flask's built-in server)
2. Set `NODE_ENV=production` in production
3. Use environment-specific `.env` files
4. Enable HTTPS in production
5. Set up proper logging (file-based or cloud logging)
6. Use a reverse proxy (nginx) in front of the app
7. Monitor database connection pool usage

