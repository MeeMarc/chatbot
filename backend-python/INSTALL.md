# Python Backend Installation Guide

## Quick Start

### Step 1: Install Python
Make sure you have Python 3.8+ installed:
```bash
python --version
# or
python3 --version
```

If not installed, download from https://www.python.org/downloads/

### Step 2: Create Virtual Environment (Recommended)
```bash
cd backend-python
python -m venv venv
```

**Activate virtual environment:**
- **Windows:**
  ```bash
  venv\Scripts\activate
  ```
- **macOS/Linux:**
  ```bash
  source venv/bin/activate
  ```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

If you get errors, try:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 4: Setup Environment Variables
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   (On Windows: `copy .env.example .env`)

2. Edit `.env` and add your Neon DB connection string:
   ```
   DATABASE_URL=postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
   PORT=3000
   JWT_SECRET=your-super-secret-key-change-this
   ```

3. Generate a secure JWT secret:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
   Copy the output to `JWT_SECRET` in `.env`.

### Step 5: Run Database Schema
1. Go to your Neon DB dashboard
2. Open SQL Editor
3. Copy and run `../database_schema.sql`
4. Verify tables were created

**If you get `message_order` errors, run:**
```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_order INTEGER;
```

### Step 6: Start Server

**Development mode:**
```bash
python server.py
```

**Production mode (recommended):**
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:3000 server:app
```

### Step 7: Test Connection
Open browser or use curl:
```bash
curl http://localhost:3000/api/health
```

Should return:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "..."
}
```

## Common Issues

**"Module not found" errors:**
- Make sure virtual environment is activated
- Run `pip install -r requirements.txt` again

**"psycopg2" installation fails:**
- On Windows: Install Visual C++ Build Tools or use `pip install psycopg2-binary`
- On macOS: `brew install postgresql`
- On Linux: `sudo apt-get install libpq-dev`

**Database connection errors:**
- Check DATABASE_URL in `.env` is correct
- Make sure connection string includes `?sslmode=require`
- Verify database schema was run successfully

**Port already in use:**
- Change PORT in `.env` to a different port (e.g., 3001)
- Or stop other services using port 3000

**"message_order" column errors:**
- Run this SQL in Neon DB:
  ```sql
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_order INTEGER;
  ```

## Next Steps

Once the backend is running:
1. Update frontend to use this API (instead of localStorage)
2. Test all endpoints
3. Deploy backend to Railway/Render/Heroku
4. Update frontend API_URL to production backend URL

## Production Deployment

**Railway:**
- Connect GitHub repo
- Add environment variables
- Set start command: `gunicorn -w 4 -b 0.0.0.0:$PORT server:app`

**Render:**
- Create Web Service
- Connect repo
- Build: `pip install -r requirements.txt`
- Start: `gunicorn -w 4 -b 0.0.0.0:$PORT server:app`

