# Render Deployment

## Recommended: Use `render.yaml`

This repository includes Render config at `render.yaml`.

### Included config

- Runtime: Python
- Build: `pip install -r requirements.txt`
- Start: `gunicorn -w 4 -b 0.0.0.0:$PORT app:app`
- Python version: `3.12.7`

## Environment Variables

Set these in Render dashboard:

- `DATABASE_URL` (required)
- `JWT_SECRET` (required)
- `GEMINI_API_KEYS` (recommended) or `GEMINI_API_KEY_1..20`

## Deploy Steps

1. Push code to GitHub.
2. In Render, create `New +` -> `Blueprint` (or Web Service).
3. Connect repository.
4. Set required env vars.
5. Deploy.

## Post-Deploy Checks

- `GET /api/health` returns `status: ok`.
- App loads at `/`.
- Authentication and chat flows work.

## Troubleshooting

- Build failure: verify `requirements.txt` and Python version.
- DB connection failure: validate `DATABASE_URL` with `sslmode=require`.
- 502/startup failure: confirm Gunicorn command and env vars are present.
