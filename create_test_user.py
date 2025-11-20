"""
Create a test user in the database to verify data saving works
This will demonstrate that data appears in Neon DB
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import bcrypt
from datetime import datetime, timedelta, timezone

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

def create_test_user():
    """Create a test user to demonstrate data saving"""
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found in .env file")
        return
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        print("=" * 70)
        print("CREATING TEST USER")
        print("=" * 70)
        print()
        
        # Test user credentials
        test_email = "test@example.com"
        test_name = "Test User"
        test_password = "TestPassword123!"
        
        # Check if user already exists
        cursor.execute("SELECT id FROM users WHERE email = %s", (test_email,))
        existing = cursor.fetchone()
        
        if existing:
            print(f"⚠️  User with email '{test_email}' already exists!")
            print("   Deleting old test user...")
            cursor.execute("DELETE FROM users WHERE email = %s", (test_email,))
            conn.commit()
        
        # Hash password using bcrypt (same as your app.py)
        print("🔐 Hashing password...")
        password_hash = bcrypt.hashpw(test_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        print(f"   Original password: {test_password}")
        print(f"   Hashed password: {password_hash[:50]}...")
        print()
        
        # Create user
        print("👤 Creating test user...")
        cursor.execute("""
            INSERT INTO users (email, password_hash, name, created_at, is_active)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, email, name, created_at;
        """, (test_email, password_hash, test_name, datetime.now(timezone.utc), True))
        
        user = cursor.fetchone()
        conn.commit()
        
        print(f"✅ Test user created successfully!")
        print(f"   ID: {user['id']}")
        print(f"   Email: {user['email']}")
        print(f"   Name: {user['name']}")
        print(f"   Created: {user['created_at']}")
        print()
        
        # Create a test conversation
        print("💬 Creating test conversation...")
        cursor.execute("""
            INSERT INTO conversations (user_id, title, created_at, updated_at)
            VALUES (%s, %s, %s, %s)
            RETURNING id, title, created_at;
        """, (user['id'], "Test Conversation", datetime.now(timezone.utc), datetime.now(timezone.utc)))
        
        conversation = cursor.fetchone()
        conn.commit()
        
        print(f"✅ Test conversation created!")
        print(f"   ID: {conversation['id']}")
        print(f"   Title: {conversation['title']}")
        print()
        
        # Create test messages
        print("📝 Creating test messages...")
        messages = [
            ("user", "Hello! This is a test message."),
            ("ai", "Hi! I'm an AI assistant. This is a test response.")
        ]
        
        for i, (role, content) in enumerate(messages, 1):
            cursor.execute("""
                INSERT INTO messages (conversation_id, role, content, created_at, message_order)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, role, content;
            """, (conversation['id'], role, content, datetime.now(timezone.utc), i))
            
            msg = cursor.fetchone()
            print(f"   ✅ Message {i} ({msg['role']}): {msg['content'][:50]}...")
        
        conn.commit()
        print()
        
        # Verify data in database
        print("🔍 Verifying data in database...")
        
        cursor.execute("SELECT COUNT(*) as count FROM users;")
        user_count = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM conversations;")
        conv_count = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM messages;")
        msg_count = cursor.fetchone()['count']
        
        print(f"   Users: {user_count}")
        print(f"   Conversations: {conv_count}")
        print(f"   Messages: {msg_count}")
        print()
        
        # Show what admin will see (without exposing password hash fully)
        print("=" * 70)
        print("WHAT ADMIN WILL SEE IN NEON DB:")
        print("=" * 70)
        print()
        
        cursor.execute("SELECT id, email, name, created_at, is_active FROM users ORDER BY created_at DESC LIMIT 5;")
        users = cursor.fetchall()
        
        print("📊 USERS TABLE:")
        print("-" * 70)
        for u in users:
            print(f"   Email: {u['email']}")
            print(f"   Name: {u['name']}")
            print(f"   ID: {u['id']}")
            print(f"   Created: {u['created_at']}")
            print(f"   Active: {u['is_active']}")
            print(f"   Password: [ENCRYPTED - Not visible]")
            print()
        
        cursor.execute("""
            SELECT c.id, c.title, c.created_at, u.email as user_email, COUNT(m.id) as message_count
            FROM conversations c
            JOIN users u ON c.user_id = u.id
            LEFT JOIN messages m ON c.id = m.conversation_id
            GROUP BY c.id, c.title, c.created_at, u.email
            ORDER BY c.created_at DESC LIMIT 5;
        """)
        conversations = cursor.fetchall()
        
        print("💬 CONVERSATIONS TABLE:")
        print("-" * 70)
        for c in conversations:
            print(f"   Title: {c['title']}")
            print(f"   User: {c['user_email']}")
            print(f"   Messages: {c['message_count']}")
            print(f"   Created: {c['created_at']}")
            print()
        
        cursor.close()
        conn.close()
        
        print("=" * 70)
        print("✅ Test data created successfully!")
        print()
        print("💡 Next steps:")
        print("   1. Refresh your Neon DB dashboard")
        print("   2. Click on 'users' table - you should now see 1 row")
        print("   3. Click on 'conversations' table - you should see 1 row")
        print("   4. Click on 'messages' table - you should see 2 rows")
        print()
        print("🔒 Security Note:")
        print("   - Passwords are encrypted with bcrypt (one-way hash)")
        print("   - Admin can see user info but NOT the original passwords")
        print("   - The 'password_hash' column shows the encrypted value only")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    create_test_user()

