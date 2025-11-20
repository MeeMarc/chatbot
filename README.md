# Emotional AI Support Chatbot

Python/Flask backend application with Neon DB (PostgreSQL) integration.

## Project Structure

```
Emotional AI Support Chatbot/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── .env.example          # Environment variables template
├── database_schema.sql   # Database schema
├── templates/            # HTML templates
│   ├── index.html
│   ├── login.html
│   ├── signup.html
│   └── chat.html
└── static/              # Static files
    ├── css/            # Stylesheets
    │   ├── common.css
    │   ├── chat.css
    │   └── login.css
    └── js/             # JavaScript files
        └── script.js
```

## Quick Start

### 1. Install Dependencies

```bash
# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Setup Environment Variables

Copy `.env.example` to `.env` and update with your Neon DB connection string:

```bash
# Windows
copy .env.example .env

# macOS/Linux
cp .env.example .env
```

Edit `.env`:
```
DATABASE_URL=postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
PORT=3000
JWT_SECRET=your-secret-key-here
```

Generate a secure JWT secret:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. Setup Database

Run `database_schema.sql` in your Neon DB SQL Editor to create all tables.

### 4. Run the Application

```bash
python app.py
```

The server will start on `http://localhost:3000`

## API Endpoints

### Frontend Routes
- `GET /` - Home/Redirect page
- `GET /login` - Login page
- `GET /signup` - Signup page
- `GET /chat` - Chat interface

### API Routes
- `GET /api/health` - Health check
- `POST /api/auth/signup` - Create new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify JWT token
- `GET /api/conversations` - Get all conversations
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id` - Get conversation
- `PUT /api/conversations/:id` - Update conversation
- `DELETE /api/conversations/:id` - Delete conversation
- `GET /api/conversations/:id/messages` - Get messages
- `POST /api/conversations/:id/messages` - Add message
- `POST /api/conversations/:id/messages/bulk` - Bulk add messages
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings

## Deployment

### Railway
1. Connect your GitHub repo
2. Add environment variables in Railway dashboard
3. Set start command: `python app.py`
4. Deploy

### Render
1. Create new Web Service
2. Connect your repo
3. Add environment variables
4. Build command: `pip install -r requirements.txt`
5. Start command: `python app.py`

### Heroku
1. Create `Procfile`:
   ```
   web: python app.py
   ```

2. Deploy:
   ```bash
   heroku create your-app-name
   heroku config:set DATABASE_URL=your-neon-connection-string
   heroku config:set JWT_SECRET=your-secret-key
   git push heroku main
   ```

## Development

Run in development mode:
```bash
python app.py
```

The server will auto-reload on file changes when `NODE_ENV=development` is set.

## Production

For production, use a WSGI server like gunicorn:

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:3000 app:app
```

## License

MIT

