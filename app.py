"""
Emotional AI Chatbot - Backend API (Python/Flask)
Connects to Neon DB (PostgreSQL) for persistent storage
"""

from flask import Flask, request, jsonify, render_template, send_from_directory, redirect
from flask_cors import CORS
import psycopg2
from psycopg2.pool import SimpleConnectionPool
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app with templates and static folders
app = Flask(__name__, 
            template_folder='templates',
            static_folder='static')

# Enable template auto-reload in development
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # Disable file caching

CORS(app)  # Enable CORS for all routes

# Disable caching for static files in development
@app.after_request
def after_request(response):
    is_dev = os.getenv('FLASK_ENV') == 'development' or os.getenv('NODE_ENV') == 'development'
    if is_dev:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, public, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    else:
        # Production: Cache static files for 1 hour
        if request.endpoint and request.endpoint.startswith('static'):
            response.headers["Cache-Control"] = "public, max-age=3600"
    return response

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL')
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-change-this-in-production')
JWT_EXPIRATION_HOURS = 168  # 7 days
PORT = int(os.getenv('PORT', 3000))

# Database connection pool
db_pool = None

def init_db_pool():
    """Initialize database connection pool"""
    global db_pool
    if not DATABASE_URL:
        logger.error("❌ DATABASE_URL environment variable is not set. Please create a .env file with DATABASE_URL=...")
        return False
    try:
        db_pool = SimpleConnectionPool(
            minconn=1,
            maxconn=20,
            dsn=DATABASE_URL,
            connect_timeout=10
        )
        logger.info("✅ Database connection pool initialized")
        return True
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}")
        logger.error("Check that DATABASE_URL in .env file is correct")
        return False

# Initialize pool on startup
init_db_pool()

def get_db_connection():
    """Get a database connection from the pool"""
    if not DATABASE_URL:
        logger.error("DATABASE_URL environment variable is not set")
        return None
    if not db_pool:
        logger.error("Database connection pool is not initialized. Check DATABASE_URL in .env file")
        return None
    try:
        conn = db_pool.getconn()
        return conn
    except Exception as e:
        logger.error(f"Error getting database connection: {e}")
        return None

def return_db_connection(conn):
    """Return a database connection to the pool"""
    try:
        db_pool.putconn(conn)
    except Exception as e:
        logger.error(f"Error returning database connection: {e}")

def execute_query(query, params=None, fetch=True):
    """Execute a database query"""
    if not DATABASE_URL:
        raise Exception("DATABASE_URL environment variable is not set. Please create a .env file with your database connection string.")
    conn = get_db_connection()
    if not conn:
        if not db_pool:
            raise Exception("Database connection pool not initialized. Check DATABASE_URL in .env file")
        raise Exception("Database connection failed. Check your DATABASE_URL and database server status.")
    
    try:
        # Ensure connection is not in autocommit mode
        if conn.autocommit:
            conn.autocommit = False
            
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, params)
            result = None
            if fetch:
                if query.strip().upper().startswith('SELECT'):
                    result = cursor.fetchall()
                elif query.strip().upper().startswith('INSERT') and 'RETURNING' in query.upper():
                    result = cursor.fetchone()
                elif query.strip().upper().startswith('UPDATE') and 'RETURNING' in query.upper():
                    result = cursor.fetchone()
                elif query.strip().upper().startswith('DELETE') and 'RETURNING' in query.upper():
                    result = cursor.fetchone()
            
            # Always commit for INSERT, UPDATE, DELETE operations
            # For SELECT queries, commit is harmless (no-op)
            conn.commit()
            logger.debug(f"Committed {query.strip().upper().split()[0]} operation")
            
            return result
    except Exception as e:
        conn.rollback()
        logger.error(f"Database query error: {e}")
        logger.error(f"Query: {query[:100]}...")
        if params:
            logger.error(f"Params: {params}")
        raise e
    finally:
        return_db_connection(conn)

# ========================================
# FRONTEND ROUTES (Serve HTML pages)
# ========================================

@app.route('/')
def index():
    """Homepage - explains the system"""
    return render_template('index.html')

@app.route('/login')
def login():
    """Login page"""
    return render_template('login.html')

@app.route('/signup')
def signup():
    """Signup page"""
    return render_template('signup.html')

@app.route('/chat')
def chat():
    """Chat page"""
    return render_template('chat.html')

# ========================================
# HELPER FUNCTIONS
# ========================================

def generate_token(user_id, email):
    """Generate JWT token"""
    payload = {
        'id': str(user_id),
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        'iat': datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_token(token):
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        raise Exception("Token expired")
    except jwt.InvalidTokenError:
        raise Exception("Invalid token")

def authenticate_token(f):
    """Decorator to verify JWT token"""
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Access token required'}), 401
        
        try:
            token = auth_header.split(' ')[1]  # Remove 'Bearer ' prefix
            user = verify_token(token)
            request.user = user
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': str(e)}), 403
    
    decorated_function.__name__ = f.__name__
    return decorated_function

# ========================================
# HEALTH CHECK
# ========================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Check database connection"""
    try:
        result = execute_query('SELECT NOW() as now')
        return jsonify({
            'status': 'ok',
            'database': 'connected',
            'timestamp': result[0]['now'].isoformat() if result else None
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# ========================================
# AUTH ENDPOINTS
# ========================================

@app.route('/api/auth/signup', methods=['POST'])
def signup_api():
    """Create new user account"""
    data = request.get_json()
    
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    
    # Validate input
    if not name or not email or not password:
        return jsonify({'error': 'Name, email, and password are required'}), 400
    
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    try:
        # Check if user already exists
        existing = execute_query(
            'SELECT id FROM users WHERE email = %s',
            (email,)
        )
        
        if existing:
            return jsonify({'error': 'User with this email already exists'}), 400
        
        # Hash password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Insert user
        logger.info(f'Creating user: {email} ({name})')
        user = execute_query(
            '''INSERT INTO users (name, email, password_hash)
               VALUES (%s, %s, %s)
               RETURNING id, name, email, created_at''',
            (name, email, hashed_password)
        )
        
        if not user:
            logger.error('User insertion returned no data')
            return jsonify({'error': 'Failed to create user: No data returned'}), 500
        
        logger.info(f'✅ User created successfully: {user["email"]} (ID: {user["id"]})')
        
        # Generate JWT token
        token = generate_token(user['id'], user['email'])
        
        return jsonify({
            'success': True,
            'user': {
                'id': str(user['id']),
                'name': user['name'],
                'email': user['email'],
                'createdAt': user['created_at'].isoformat()
            },
            'token': token
        }), 201
        
    except Exception as e:
        import traceback
        logger.error(f'Signup error: {e}')
        logger.error(traceback.format_exc())
        return jsonify({'error': f'Failed to create user: {str(e)}'}), 500

@app.route('/api/auth/login', methods=['POST'])
def login_api():
    """Login user"""
    data = request.get_json()
    
    email = data.get('email')
    password = data.get('password')
    
    # Validate input
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    
    try:
        # Find user
        users = execute_query(
            'SELECT * FROM users WHERE email = %s AND is_active = true',
            (email,)
        )
        
        if not users:
            return jsonify({'error': 'Invalid email or password'}), 401
        
        user = users[0]
        
        # Verify password
        if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Update last_login
        execute_query(
            'UPDATE users SET last_login = NOW() WHERE id = %s',
            (user['id'],),
            fetch=False
        )
        
        # Generate JWT token
        token = generate_token(user['id'], user['email'])
        
        return jsonify({
            'success': True,
            'user': {
                'id': str(user['id']),
                'name': user['name'],
                'email': user['email']
            },
            'token': token
        })
        
    except Exception as e:
        logger.error(f'Login error: {e}')
        return jsonify({'error': f'Login failed: {str(e)}'}), 500

@app.route('/api/auth/verify', methods=['GET'])
@authenticate_token
def verify():
    """Verify JWT token"""
    return jsonify({
        'success': True,
        'user': request.user
    })

# ========================================
# CONVERSATIONS ENDPOINTS
# ========================================

@app.route('/api/conversations', methods=['GET'])
@authenticate_token
def get_conversations():
    """Get all conversations for a user"""
    user_id = request.user['id']
    
    try:
        conversations = execute_query(
            '''SELECT 
                c.id, 
                c.title, 
                c.created_at, 
                c.updated_at,
                COUNT(m.id) as message_count
             FROM conversations c
             LEFT JOIN messages m ON c.id = m.conversation_id
             WHERE c.user_id = %s AND c.is_archived = false
             GROUP BY c.id, c.title, c.created_at, c.updated_at
             ORDER BY c.updated_at DESC''',
            (user_id,)
        )
        
        result = []
        for conv in conversations:
            result.append({
                'id': str(conv['id']),
                'title': conv['title'],
                'createdAt': conv['created_at'].isoformat(),
                'updatedAt': conv['updated_at'].isoformat(),
                'messageCount': int(conv['message_count'])
            })
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f'Get conversations error: {e}')
        return jsonify({'error': f'Failed to fetch conversations: {str(e)}'}), 500

@app.route('/api/conversations', methods=['POST'])
@authenticate_token
def create_conversation():
    """Create new conversation"""
    user_id = request.user['id']
    data = request.get_json()
    title = data.get('title', 'New Chat')
    
    try:
        conv = execute_query(
            'INSERT INTO conversations (user_id, title) VALUES (%s, %s) RETURNING *',
            (user_id, title)
        )
        
        return jsonify({
            'id': str(conv['id']),
            'title': conv['title'],
            'createdAt': conv['created_at'].isoformat(),
            'updatedAt': conv['updated_at'].isoformat()
        }), 201
        
    except Exception as e:
        logger.error(f'Create conversation error: {e}')
        return jsonify({'error': f'Failed to create conversation: {str(e)}'}), 500

@app.route('/api/conversations/<conversation_id>', methods=['GET'])
@authenticate_token
def get_conversation(conversation_id):
    """Get single conversation with messages"""
    user_id = request.user['id']
    
    try:
        # Verify conversation belongs to user
        conv_check = execute_query(
            'SELECT id FROM conversations WHERE id = %s AND user_id = %s',
            (conversation_id, user_id)
        )
        
        if not conv_check:
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Get conversation
        conv = execute_query(
            'SELECT * FROM conversations WHERE id = %s',
            (conversation_id,)
        )[0]
        
        # Get messages
        messages = execute_query(
            '''SELECT id, role, content, created_at, message_order
               FROM messages 
               WHERE conversation_id = %s 
               ORDER BY message_order ASC''',
            (conversation_id,)
        )
        
        result = {
            'id': str(conv['id']),
            'title': conv['title'],
            'createdAt': conv['created_at'].isoformat(),
            'updatedAt': conv['updated_at'].isoformat(),
            'messages': [
                {
                    'role': msg['role'],
                    'content': msg['content'],
                    'createdAt': msg['created_at'].isoformat()
                }
                for msg in messages
            ]
        }
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f'Get conversation error: {e}')
        return jsonify({'error': f'Failed to fetch conversation: {str(e)}'}), 500

@app.route('/api/conversations/<conversation_id>', methods=['PUT'])
@authenticate_token
def update_conversation(conversation_id):
    """Update conversation title"""
    user_id = request.user['id']
    data = request.get_json()
    title = data.get('title')
    
    if not title:
        return jsonify({'error': 'Title is required'}), 400
    
    try:
        # Verify conversation belongs to user
        conv_check = execute_query(
            'SELECT id FROM conversations WHERE id = %s AND user_id = %s',
            (conversation_id, user_id)
        )
        
        if not conv_check:
            return jsonify({'error': 'Conversation not found'}), 404
        
        conv = execute_query(
            'UPDATE conversations SET title = %s, updated_at = NOW() WHERE id = %s RETURNING *',
            (title, conversation_id)
        )
        
        return jsonify({
            'id': str(conv['id']),
            'title': conv['title'],
            'updatedAt': conv['updated_at'].isoformat()
        })
        
    except Exception as e:
        logger.error(f'Update conversation error: {e}')
        return jsonify({'error': f'Failed to update conversation: {str(e)}'}), 500

@app.route('/api/conversations/<conversation_id>', methods=['DELETE'])
@authenticate_token
def delete_conversation(conversation_id):
    """Delete conversation and all its messages from database"""
    user_id = request.user['id']
    
    try:
        # Verify conversation belongs to user
        conv_check = execute_query(
            'SELECT id FROM conversations WHERE id = %s AND user_id = %s',
            (conversation_id, user_id)
        )
        
        if not conv_check:
            logger.warning(f'Conversation {conversation_id} not found for user {user_id}')
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Get message count before deletion for logging
        msg_count = execute_query(
            'SELECT COUNT(*) as count FROM messages WHERE conversation_id = %s',
            (conversation_id,)
        )
        message_count = msg_count[0]['count'] if msg_count else 0
        
        # Delete conversation (messages will be deleted automatically due to CASCADE)
        execute_query(
            'DELETE FROM conversations WHERE id = %s',
            (conversation_id,),
            fetch=False
        )
        
        logger.info(f'✅ Deleted conversation {conversation_id} (and {message_count} messages) for user {user_id}')
        return jsonify({
            'success': True,
            'message': f'Conversation and {message_count} message(s) deleted successfully'
        })
        
    except Exception as e:
        logger.error(f'❌ Delete conversation error: {e}')
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'error': f'Failed to delete conversation: {str(e)}'}), 500

# ========================================
# MESSAGES ENDPOINTS
# ========================================

@app.route('/api/conversations/<conversation_id>/messages', methods=['POST'])
@authenticate_token
def add_message(conversation_id):
    """Add message to conversation"""
    user_id = request.user['id']
    data = request.get_json()
    
    role = data.get('role')
    content = data.get('content')
    
    # Validate input
    if not role or not content:
        return jsonify({'error': 'Role and content are required'}), 400
    
    if role not in ['user', 'ai', 'system']:
        return jsonify({'error': 'Role must be user, ai, or system'}), 400
    
    try:
        # Verify conversation belongs to user
        conv_check = execute_query(
            'SELECT id FROM conversations WHERE id = %s AND user_id = %s',
            (conversation_id, user_id)
        )
        
        if not conv_check:
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Get next message order
        order_result = execute_query(
            'SELECT COALESCE(MAX(message_order), 0) + 1 as next_order FROM messages WHERE conversation_id = %s',
            (conversation_id,)
        )
        message_order = order_result[0]['next_order']
        
        # Insert message (user_id is tracked through conversation)
        msg = execute_query(
            'INSERT INTO messages (conversation_id, role, content, message_order) VALUES (%s, %s, %s, %s) RETURNING *',
            (conversation_id, role, content, message_order)
        )
        
        # Update conversation updated_at
        execute_query(
            'UPDATE conversations SET updated_at = NOW() WHERE id = %s',
            (conversation_id,),
            fetch=False
        )
        
        # If first message and title is still "New Chat", update title
        if role == 'user' and message_order == 1:
            title_preview = content[:50] + ('...' if len(content) > 50 else '')
            execute_query(
                '''UPDATE conversations 
                   SET title = CASE WHEN title = 'New Chat' THEN %s ELSE title END,
                       updated_at = NOW()
                   WHERE id = %s''',
                (title_preview, conversation_id),
                fetch=False
            )
        
        return jsonify({
            'id': str(msg['id']),
            'role': msg['role'],
            'content': msg['content'],
            'createdAt': msg['created_at'].isoformat(),
            'messageOrder': msg['message_order']
        }), 201
        
    except Exception as e:
        logger.error(f'Add message error: {e}')
        return jsonify({'error': f'Failed to add message: {str(e)}'}), 500

@app.route('/api/conversations/<conversation_id>/messages', methods=['GET'])
@authenticate_token
def get_messages(conversation_id):
    """Get all messages for a conversation"""
    user_id = request.user['id']
    
    try:
        # Verify conversation belongs to user
        conv_check = execute_query(
            'SELECT id FROM conversations WHERE id = %s AND user_id = %s',
            (conversation_id, user_id)
        )
        
        if not conv_check:
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Get messages
        messages = execute_query(
            '''SELECT id, role, content, created_at, message_order
               FROM messages 
               WHERE conversation_id = %s 
               ORDER BY message_order ASC''',
            (conversation_id,)
        )
        
        result = []
        for msg in messages:
            result.append({
                'id': str(msg['id']),
                'role': msg['role'],
                'content': msg['content'],
                'createdAt': msg['created_at'].isoformat()
            })
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f'Get messages error: {e}')
        return jsonify({'error': f'Failed to fetch messages: {str(e)}'}), 500

@app.route('/api/conversations/<conversation_id>/messages/bulk', methods=['POST'])
@authenticate_token
def bulk_add_messages(conversation_id):
    """Bulk add messages (for batched messages)"""
    user_id = request.user['id']
    data = request.get_json()
    messages_data = data.get('messages', [])
    
    if not isinstance(messages_data, list) or len(messages_data) == 0:
        return jsonify({'error': 'Messages array is required'}), 400
    
    try:
        # Verify conversation belongs to user
        conv_check = execute_query(
            'SELECT id FROM conversations WHERE id = %s AND user_id = %s',
            (conversation_id, user_id)
        )
        
        if not conv_check:
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Get starting message order
        order_result = execute_query(
            'SELECT COALESCE(MAX(message_order), 0) as max_order FROM messages WHERE conversation_id = %s',
            (conversation_id,)
        )
        message_order = order_result[0]['max_order']
        
        # Insert all messages
        inserted_messages = []
        for msg in messages_data:
            message_order += 1
            
            inserted = execute_query(
                'INSERT INTO messages (conversation_id, role, content, message_order) VALUES (%s, %s, %s, %s) RETURNING *',
                (conversation_id, msg['role'], msg['content'], message_order)
            )
            
            inserted_messages.append({
                'id': str(inserted['id']),
                'role': inserted['role'],
                'content': inserted['content'],
                'createdAt': inserted['created_at'].isoformat()
            })
            
            # Update title from first user message
            if msg['role'] == 'user' and message_order == 1:
                title_preview = msg['content'][:50] + ('...' if len(msg['content']) > 50 else '')
                execute_query(
                    '''UPDATE conversations 
                       SET title = CASE WHEN title = 'New Chat' THEN %s ELSE title END,
                           updated_at = NOW()
                       WHERE id = %s''',
                    (title_preview, conversation_id),
                    fetch=False
                )
        
        # Update conversation updated_at
        execute_query(
            'UPDATE conversations SET updated_at = NOW() WHERE id = %s',
            (conversation_id,),
            fetch=False
        )
        
        return jsonify({
            'success': True,
            'messages': inserted_messages
        }), 201
        
    except Exception as e:
        logger.error(f'Bulk add messages error: {e}')
        return jsonify({'error': f'Failed to add messages: {str(e)}'}), 500

# ========================================
# USER SETTINGS ENDPOINTS
# ========================================

@app.route('/api/settings', methods=['GET'])
@authenticate_token
def get_settings():
    """Get user settings"""
    user_id = request.user['id']
    
    try:
        settings = execute_query(
            'SELECT * FROM user_settings WHERE user_id = %s',
            (user_id,)
        )
        
        if not settings:
            # Return defaults if no settings exist
            return jsonify({
                'preferredModel': 'gemini-pro',
                'useBuiltinKey': True
            })
        
        setting = settings[0]
        return jsonify({
            'preferredModel': setting.get('preferred_model', 'gemini-pro'),
            'useBuiltinKey': setting.get('use_builtin_key', True)
        })
        
    except Exception as e:
        logger.error(f'Get settings error: {e}')
        return jsonify({'error': f'Failed to fetch settings: {str(e)}'}), 500

@app.route('/api/settings', methods=['PUT'])
@authenticate_token
def update_settings():
    """Update user settings"""
    user_id = request.user['id']
    data = request.get_json()
    
    preferred_model = data.get('preferredModel', 'gemini-pro')
    use_builtin_key = data.get('useBuiltinKey', True)
    
    try:
        # Insert or update user settings (user_id is UNIQUE in schema)
        setting = execute_query(
            '''INSERT INTO user_settings (user_id, preferred_model, use_builtin_key)
               VALUES (%s, %s, %s)
               ON CONFLICT (user_id) 
               DO UPDATE SET preferred_model = EXCLUDED.preferred_model, 
                             use_builtin_key = EXCLUDED.use_builtin_key, 
                             updated_at = NOW()
               RETURNING *''',
            (user_id, preferred_model, use_builtin_key)
        )
        
        return jsonify({
            'preferredModel': setting.get('preferred_model', 'gemini-pro'),
            'useBuiltinKey': setting.get('use_builtin_key', True)
        })
        
    except Exception as e:
        logger.error(f'Update settings error: {e}')
        return jsonify({'error': f'Failed to update settings: {str(e)}'}), 500

# ========================================
# ERROR HANDLING
# ========================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f'Internal server error: {error}')
    return jsonify({
        'error': 'Internal server error',
        'message': str(error) if os.getenv('NODE_ENV') == 'development' else 'Something went wrong'
    }), 500

# ========================================
# START SERVER
# ========================================

if __name__ == '__main__':
    # Test database connection
    try:
        test_result = execute_query('SELECT NOW()')
        logger.info("✅ Database connection successful")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        logger.error("Make sure DATABASE_URL is set correctly in .env file")
    
    logger.info(f"🚀 Server starting on http://localhost:{PORT}")
    logger.info(f"📊 Health check: http://localhost:{PORT}/api/health")
    logger.info(f"📝 API endpoints available at /api/*")
    logger.info(f"🌐 Frontend available at http://localhost:{PORT}/")
    
    # Enable debug mode and auto-reload for development
    debug_mode = os.getenv('FLASK_ENV') == 'development' or os.getenv('NODE_ENV') == 'development' or True
    app.run(host='0.0.0.0', port=PORT, debug=debug_mode, use_reloader=True, use_debugger=debug_mode)

