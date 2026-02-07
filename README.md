# Emotional AI Support Chatbot

A Flask-based emotional support chatbot with Neon PostgreSQL persistence, JWT auth, and a browser frontend.

## Tech Stack

- Backend: Python, Flask, Gunicorn
- Database: PostgreSQL (Neon)
- Frontend: HTML, CSS, JavaScript

## Repository Structure

```text
chatbot/
  app.py
  requirements.txt
  runtime.txt
  render.yaml
  Procfile
  database_schema.sql
  .env.example
  templates/
  static/
  backend/
  backend-python/
  docs/
```

## Quick Start

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Create a local env file:

```bash
copy .env.example .env
```

4. Fill in `.env` values (`DATABASE_URL`, `JWT_SECRET`, Gemini keys).
5. Initialize database tables with `database_schema.sql`.
6. Run locally:

```bash
python app.py
```

App runs at `http://localhost:3000`.

## Security Notes

- Do not hardcode API keys in `static/js/script.js`.
- Keep Gemini keys in environment variables only.
- Never commit `.env`.
- Rotate any key that was previously exposed in frontend code.

## Deployment

- Render config: `render.yaml`
- Runtime version: `runtime.txt`
- WSGI entrypoint: `app:app` via Gunicorn

See deployment guide: `docs/RENDER_DEPLOYMENT.md`.

## Documentation

- `docs/README.md` - docs index
- `docs/QUICK_SETUP.md` - condensed setup checklist
- `docs/SETUP_GUIDE.md` - full setup flow
- `docs/RENDER_DEPLOYMENT.md` - Render deployment
- `docs/PROJECT_STRUCTURE.md` - folder layout and conventions

## License

MIT
