# Project Structure

## Top-Level Layout

```text
chatbot/
  app.py                      # Main Flask app entry module
  requirements.txt            # Python dependencies for root deployment
  runtime.txt                 # Python runtime pin for platforms like Render
  render.yaml                 # Render IaC config
  .env.example                # Environment variable template
  database_schema.sql         # SQL schema

  static/                     # Frontend assets
    css/
    js/

  templates/                  # Flask templates

  docs/                       # Operational and setup documentation
```

## Conventions

- Keep secrets only in environment variables.
- Do not place API keys in frontend files under `static/`.
- Keep deployment defaults in root (`render.yaml`, `runtime.txt`, `requirements.txt`).
- Add new guides under `docs/` instead of root.
- Keep helper scripts in root unless a dedicated `scripts/` folder is introduced.
