# Deploying to Render

This guide will help you deploy your Emotional AI Support Chatbot to Render.

## Prerequisites

1. A GitHub repository with your code
2. A Neon PostgreSQL database (or any PostgreSQL database)
3. A Render account (free tier available)

## Step 1: Prepare Your Code

Your project is already set up with:
- ✅ `requirements.txt` (includes gunicorn for production)
- ✅ `render.yaml` (optional - for infrastructure as code)
- ✅ `Procfile` (alternative deployment method)

## Step 2: Create a Neon Database (if you don't have one)

1. Go to [Neon Console](https://console.neon.tech/)
2. Create a new project
3. Copy your connection string (DATABASE_URL)
4. Run the `database_schema.sql` file in the SQL Editor to create tables

## Step 3: Deploy to Render

### Option A: Using Render Dashboard (Recommended)

1. **Go to Render Dashboard**
   - Visit [dashboard.render.com](https://dashboard.render.com/)
   - Sign in with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your repository

3. **Configure the Service**
   - **Name**: `emotional-ai-chatbot` (or your preferred name)
   - **Environment**: `Python 3`
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave empty (or `.` if needed)
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn -w 4 -b 0.0.0.0:$PORT app:app`

4. **Add Environment Variables**
   Click "Advanced" → "Add Environment Variable":
   
   - **DATABASE_URL**: Your Neon PostgreSQL connection string
     ```
     postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
     ```
   
   - **JWT_SECRET**: Generate a secure secret key
     ```bash
     python -c "import secrets; print(secrets.token_urlsafe(32))"
     ```
     Or use Render's "Generate" button
   
   - **PORT**: `10000` (Render will override this, but good to have)
   
   - **PYTHON_VERSION**: `3.12.0` (optional, for consistency)

5. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy your app
   - Watch the build logs for any errors

### Option B: Using render.yaml (Infrastructure as Code)

1. **Push render.yaml to your repository**
   - Already included in your project

2. **Create Blueprint**
   - Go to Render Dashboard
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Render will detect `render.yaml` and use it

3. **Update Environment Variables**
   - Add `DATABASE_URL` manually in the dashboard
   - Other variables are auto-configured from `render.yaml`

## Step 4: Initialize Database

After deployment, you need to run the database schema:

1. **Option A: Using Render Shell**
   - Go to your service → "Shell"
   - Run:
     ```bash
     python init_database.py
     ```
   
2. **Option B: Using Neon SQL Editor**
   - Go to your Neon Console
   - Open SQL Editor
   - Copy and paste contents of `database_schema.sql`
   - Execute the script

## Step 5: Verify Deployment

1. **Check Health Endpoint**
   ```
   https://your-app-name.onrender.com/api/health
   ```
   Should return: `{"status":"ok"}`

2. **Test the Application**
   - Visit: `https://your-app-name.onrender.com`
   - You should see the home/login page

## Environment Variables Summary

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `JWT_SECRET` | Secret key for JWT tokens | Generate with `secrets.token_urlsafe(32)` |
| `PORT` | Server port (set by Render) | `10000` |
| `PYTHON_VERSION` | Python version | `3.12.0` |

## Troubleshooting

### Build Fails
- Check build logs in Render dashboard
- Ensure `requirements.txt` is correct
- Verify Python version compatibility

### Database Connection Errors
- Verify `DATABASE_URL` is correct
- Check if database allows connections from Render's IPs
- Ensure SSL is enabled (`sslmode=require`)

### Application Errors
- Check service logs in Render dashboard
- Verify all environment variables are set
- Test database connection locally with same `DATABASE_URL`

### 502 Bad Gateway
- Usually means app crashed on startup
- Check logs for errors
- Verify `gunicorn` command is correct
- Ensure `PORT` environment variable is used

## Free Tier Limitations

- **Spin down**: Service spins down after 15 minutes of inactivity
- **Cold starts**: First request after spin-down takes ~30 seconds
- **Database**: Use Neon free tier or Render PostgreSQL (free for 90 days)

## Updating Your App

1. Push changes to GitHub
2. Render automatically detects changes
3. Triggers new deployment
4. Monitor build logs for success

## Custom Domain (Optional)

1. Go to your service settings
2. Click "Custom Domains"
3. Add your domain
4. Update DNS records as instructed

## SSL/HTTPS

Render provides free SSL certificates automatically for all services.

---

**Need Help?**
- Render Docs: https://render.com/docs
- Render Community: https://community.render.com

