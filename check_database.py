"""
Check Database Structure and Data
Shows all tables, their columns, and current row counts
"""

import os
import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

def check_database():
    """Check database structure and data"""
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found in .env file")
        return
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        print("=" * 70)
        print("DATABASE STRUCTURE AND DATA CHECK")
        print("=" * 70)
        print()
        
        # Get all tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        
        if not tables:
            print("❌ No tables found in database!")
            return
        
        print(f"📊 Found {len(tables)} tables:\n")
        
        for table in tables:
            table_name = table['table_name']
            print("-" * 70)
            print(f"📋 TABLE: {table_name}")
            print("-" * 70)
            
            # Get columns for this table
            cursor.execute("""
                SELECT 
                    column_name,
                    data_type,
                    character_maximum_length,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = %s
                ORDER BY ordinal_position;
            """, (table_name,))
            
            columns = cursor.fetchall()
            
            print("   Columns:")
            for col in columns:
                max_len = f"({col['character_maximum_length']})" if col['character_maximum_length'] else ""
                nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
                default = f" DEFAULT {col['column_default']}" if col['column_default'] else ""
                print(f"     • {col['column_name']:25} {col['data_type']:20} {max_len:8} {nullable:10} {default}")
            
            # Get row count
            cursor.execute(f"SELECT COUNT(*) as count FROM {table_name};")
            count = cursor.fetchone()['count']
            
            print(f"\n   📈 Row Count: {count}")
            
            # Show sample data if any exists
            if count > 0:
                cursor.execute(f"SELECT * FROM {table_name} LIMIT 3;")
                rows = cursor.fetchall()
                print(f"   📝 Sample Data (showing up to 3 rows):")
                for i, row in enumerate(rows, 1):
                    print(f"      Row {i}:")
                    for key, value in row.items():
                        # Truncate long values
                        if value and len(str(value)) > 50:
                            value = str(value)[:47] + "..."
                        print(f"        {key}: {value}")
            else:
                print("   ℹ️  Table is empty (no data yet)")
            
            print()
        
        # Check for views
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.views 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        
        views = cursor.fetchall()
        
        if views:
            print("-" * 70)
            print("📊 VIEWS:")
            print("-" * 70)
            for view in views:
                view_name = view['table_name']
                cursor.execute(f"SELECT COUNT(*) as count FROM {view_name};")
                count = cursor.fetchone()['count']
                print(f"   • {view_name:30} ({count} rows)")
            print()
        
        cursor.close()
        conn.close()
        
        print("=" * 70)
        print("✅ Database check complete!")
        print()
        print("💡 TIP: If tables are empty, they will populate when:")
        print("   1. Users sign up (creates rows in 'users' table)")
        print("   2. Users start conversations (creates rows in 'conversations' table)")
        print("   3. Users send messages (creates rows in 'messages' table)")
        print()
        print("🔍 To view in Neon DB dashboard:")
        print("   1. Go to your Neon project dashboard")
        print("   2. Click 'Tables' in the sidebar")
        print("   3. Click on any table name to see its structure and data")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_database()

