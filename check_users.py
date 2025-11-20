import os
import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute('SELECT email, name, created_at FROM users ORDER BY created_at DESC')
    rows = cursor.fetchall()
    
    print(f"Total users in database: {len(rows)}")
    print("\nUsers:")
    for r in rows:
        print(f"  - {r['email']} ({r['name']}) - {r['created_at']}")
    
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")

