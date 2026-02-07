# Quick Setup Checklist

## 1. Environment

- [ ] Create `.env` from `.env.example`
- [ ] Set `DATABASE_URL`
- [ ] Set `JWT_SECRET`
- [ ] Add Gemini keys as `GEMINI_API_KEYS` or `GEMINI_API_KEY_1..20`

## 2. Dependencies

- [ ] Create and activate virtual environment
- [ ] Run `pip install -r requirements.txt`

## 3. Database

- [ ] Run `database_schema.sql` in Neon SQL editor
- [ ] Confirm tables exist (`users`, `conversations`, `messages`, `user_settings`)

## 4. Run Locally

- [ ] Start app with `python app.py`
- [ ] Open `http://localhost:3000`
- [ ] Check `/api/health`

## 5. Deploy (Render)

- [ ] Push code
- [ ] Create Render web service (or Blueprint)
- [ ] Set env vars (`DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEYS`)
- [ ] Verify `/api/health` on deployed URL
