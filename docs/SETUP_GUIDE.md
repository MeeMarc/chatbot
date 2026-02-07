# Setup Guide

## Prerequisites

- Python 3.12.x
- pip
- Neon PostgreSQL database

## 1. Install Dependencies

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Configure Environment

Create `.env` from `.env.example` and fill these minimum values:

```env
DATABASE_URL=postgresql://username:password@host/dbname?sslmode=require
JWT_SECRET=replace_with_long_random_secret
GEMINI_API_KEYS=AIza...key1,AIza...key2
```

Optional:

```env
PORT=3000
FLASK_ENV=development
NODE_ENV=development
```

## 3. Initialize Database

Run the SQL in `database_schema.sql` inside Neon SQL editor.

## 4. Run the App

```bash
python app.py
```

Then open:

- `http://localhost:3000`
- `http://localhost:3000/api/health`

## 5. Deployment (Render)

Use either:

- `render.yaml` Blueprint deployment
- manual Web Service config with:
  - Build: `pip install -r requirements.txt`
  - Start: `gunicorn -w 4 -b 0.0.0.0:$PORT app:app`

Set env vars in Render:

- `DATABASE_URL`
- `JWT_SECRET`
- `GEMINI_API_KEYS` (or numbered keys)
- `PYTHON_VERSION=3.12.7`

## Security Checklist

- Do not hardcode Gemini keys in frontend files.
- Keep `.env` local and out of Git.
- Rotate any keys previously exposed in repository history.
