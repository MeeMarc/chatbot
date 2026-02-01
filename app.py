"""
Emotional AI Chatbot - Backend API (Python/Flask)
Connects to Neon DB (PostgreSQL) for persistent storage
"""

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import psycopg
from psycopg.rows import dict_row
from psycopg.pool import ConnectionPool
import os
from dotenv import load_dotenv
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
import logging
from functools import wraps

# -------------------------
# Load environment variables
# -------------------------
load_dotenv()  # loads .env locally; on Render use Environment tab

# -------------------------
# Configure logging
# -------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# -------------------------
# Flask app setup
# -------------------------
app = Flask(
    __name__,
    template_folder='templates',
    static_folder='static'
)
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

CORS(app)

@app.after_request
def after_request(response):
    is_dev = os.getenv('FLASK_ENV') == 'development' or os.getenv('NODE_ENV') == 'development'
    if is_dev:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, public, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    else:
        if request.endpoint and request.endpoint.startswith('static'):
            response.headers["Cache-Control"] = "public, max-age=3600"
    return response

# -------------------------
# Environment variables
# -------------------------
DATABASE_URL = os.getenv('DATABASE_URL')
JWT_SECRET = os.getenv('JWT_SECRET', 'mySuperSecretKey_2026')
JWT_EXPIRATION_HOURS = 168  # 7 days
PORT = int(os.getenv('PORT', 3000))

# -------------------------
# Database connection pool
# -------------------------
db_pool = None

def init_db_pool():
    global db_pool
    if not DATABASE_URL:
        logger.error("❌ DATABASE_URL environment variable is not set!")
        return False
    try:
        db_pool = ConnectionPool(
            conninfo=DATABASE_URL,
            min_size=1,
            max_size=20,
            row_factory=dict_row
        )
        logger.info("✅ Database connection pool initialized")
        return True
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}")
        return False

if not init_db_pool():
    logger.warning("⚠️ Database pool not initialized. App may fail if database is accessed.")

def execute_query(query, params=None, fetch=True):
    if not db_pool:
        raise Exception("Database pool not initialized")
    try:
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
                if fetch:
                    if query.strip().upper().startswith('SELECT'):
                        return cur.fetchall()
                    elif query.strip().upper().startswith(('INSERT','UPDATE','DELETE')) and 'RETURNING' in query.upper():
                        return cur.fetchone()
                return None
    except Exception as e:
        logger.error(f"DB query error: {e}")
        raise e

# -------------------------
# JWT helper functions
# -------------------------
def generate_token(user_id, email):
    payload = {
        'id': str(user_id),
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        'iat': datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_token(token):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        raise Exception("Token expired")
    except jwt.InvalidTokenError:
        raise Exception("Invalid token")

def authenticate_token(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Access token required'}), 401
        try:
            token = auth_header.split(' ')[1]
            request.user = verify_token(token)
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': str(e)}), 403
    return decorated_function

# -------------------------
# Basic routes
# -------------------------
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/signup')
def signup():
    return render_template('signup.html')

@app.route('/chat')
def chat():
    return render_template('chat.html')

@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        result = execute_query('SELECT NOW() as now')
        return jsonify({
            'status': 'ok',
            'database': 'connected',
            'timestamp': result[0]['now'].isoformat()
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# -------------------------
# Start server safely
# -------------------------
if __name__ == '__main__':
    # Test DB connection before starting
    try:
        test_result = execute_query('SELECT NOW()')
        logger.info("✅ Database connection successful")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")

    logger.info(f"🚀 Server starting on http://0.0.0.0:{PORT}")
    debug_mode = os.getenv('FLASK_ENV') == 'development' or os.getenv('NODE_ENV') == 'development'
    app.run(host='0.0.0.0', port=PORT, debug=debug_mode)
