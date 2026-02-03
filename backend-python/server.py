"""
Backend entrypoint for Render when using the backend-python directory.
This wraps the root Flask app to avoid duplicate logic.
"""

import os
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app import app  # noqa: E402


if __name__ == "__main__":
    port = int(os.getenv("PORT", "3000"))
    debug_mode = os.getenv("FLASK_ENV") == "development" or os.getenv("NODE_ENV") == "development"
    app.run(
        host="0.0.0.0",
        port=port,
        debug=debug_mode,
        use_reloader=debug_mode,
        use_debugger=debug_mode,
    )
