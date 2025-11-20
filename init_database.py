"""
Database Initialization Script
Runs the database schema to create all tables in Neon DB
"""

import os
import psycopg2
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection string
DATABASE_URL = os.getenv('DATABASE_URL')

def init_database():
    """Initialize database by running schema.sql"""
    if not DATABASE_URL:
        logger.error("❌ DATABASE_URL not found in .env file")
        print("Please add DATABASE_URL to your .env file")
        return False
    
    try:
        # Connect to database
        logger.info("🔌 Connecting to Neon DB...")
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Read schema file
        logger.info("📖 Reading database_schema.sql...")
        with open('database_schema.sql', 'r', encoding='utf-8') as f:
            schema_sql = f.read()
        
        # Execute schema (split by semicolons to handle errors per statement)
        logger.info("🚀 Creating tables and schema...")
        
        # Split by semicolons and execute statements one by one
        statements = [s.strip() for s in schema_sql.split(';') if s.strip() and not s.strip().startswith('--')]
        
        errors = []
        for i, statement in enumerate(statements, 1):
            try:
                if statement:
                    cursor.execute(statement)
            except psycopg2.Error as e:
                # Only log non-critical errors (like "already exists")
                error_msg = str(e)
                if 'already exists' in error_msg.lower() or 'does not exist' in error_msg.lower():
                    # These are expected if tables/triggers already exist
                    logger.debug(f"   Statement {i}: {error_msg[:60]}")
                else:
                    errors.append(f"Statement {i}: {error_msg}")
                    logger.warning(f"⚠️ Error in statement {i}: {error_msg[:100]}")
        
        if errors:
            logger.warning(f"⚠️ {len(errors)} non-critical errors occurred (some objects may already exist)")
        
        # Verify tables were created
        logger.info("✅ Verifying tables were created...")
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        if tables:
            logger.info("📊 Tables created successfully:")
            for table in tables:
                logger.info(f"   ✓ {table[0]}")
            
            # Check row counts
            logger.info("\n📈 Table row counts:")
            for table in tables:
                table_name = table[0]
                cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
                count = cursor.fetchone()[0]
                logger.info(f"   {table_name}: {count} rows")
        else:
            logger.warning("⚠️ No tables found. Schema may have failed.")
        
        cursor.close()
        conn.close()
        
        logger.info("\n✅ Database initialization complete!")
        return True
        
    except psycopg2.Error as e:
        logger.error(f"❌ Database error: {e}")
        print(f"\nError: {e}")
        return False
    except FileNotFoundError:
        logger.error("❌ database_schema.sql not found")
        print("Please make sure database_schema.sql is in the same directory")
        return False
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        print(f"\nError: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Database Initialization Script")
    print("=" * 60)
    print()
    
    success = init_database()
    
    if success:
        print("\n✅ Database is ready to use!")
    else:
        print("\n❌ Database initialization failed. Please check the errors above.")
        exit(1)

