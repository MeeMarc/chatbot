# Backend Installation Guide

## Quick Start

### Step 1: Install Node.js
Make sure you have Node.js 18+ installed:
```bash
node --version
```

If not installed, download from https://nodejs.org/

### Step 2: Install Dependencies
```bash
cd backend
npm install
```

### Step 3: Setup Environment Variables
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Neon DB connection string:
   ```
   DATABASE_URL=postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
   PORT=3000
   JWT_SECRET=your-super-secret-key-change-this
   ```

### Step 4: Run Database Schema
1. Go to your Neon DB dashboard
2. Open SQL Editor
3. Copy and run `../database_schema.sql`
4. Verify tables were created

### Step 5: Start Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

### Step 6: Test Connection
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

## Troubleshooting

**"Cannot find module" errors:**
- Run `npm install` again
- Make sure you're in the `backend` directory

**Database connection errors:**
- Check DATABASE_URL in `.env` is correct
- Make sure connection string includes `?sslmode=require`
- Verify database schema was run successfully

**Port already in use:**
- Change PORT in `.env` to a different port (e.g., 3001)
- Or stop other services using port 3000

## Next Steps

Once the backend is running:
1. Update frontend to use this API (instead of localStorage)
2. Test all endpoints
3. Deploy backend to Vercel/Railway/Render
4. Update frontend API_URL to production backend URL

