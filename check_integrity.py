"""
Project Integrity Checker
Run this script to verify that all necessary files and dependencies are present.
Usage: python check_integrity.py
"""
import os
import sys
import importlib.util
from pathlib import Path

def check_path(path, name, optional=False):
    """Check if a file or directory exists"""
    exists = os.path.exists(path)
    icon = "✅" if exists else "⚠️" if optional else "❌"
    status = "Found" if exists else "Missing"
    
    # Print status
    print(f"{icon} {name:<25} : {status}")
    
    if not exists and not optional:
        return False
    return True

def check_package(package_name):
    """Check if a Python package is installed"""
    spec = importlib.util.find_spec(package_name)
    if spec is None:
        print(f"❌ {package_name:<25} : Not Installed")
        return False
    print(f"✅ {package_name:<25} : Installed")
    return True

def main():
    print("=" * 60)
    print("🔍 EMOTIONAL AI CHATBOT - INTEGRITY CHECK")
    print("=" * 60)
    
    root_dir = Path(__file__).parent.absolute()
    print(f"📂 Project Root: {root_dir}\n")
    
    all_passed = True
    
    # 1. Check Core Files
    print("--- Core Files ---")
    if not check_path(root_dir / "app.py", "app.py"): all_passed = False
    if not check_path(root_dir / ".env", ".env (Config)", optional=True): 
        print("   (Note: .env is required for the app to run, but might not exist in fresh clones)")
    
    # 2. Check Templates
    print("\n--- HTML Templates ---")
    templates_dir = root_dir / "templates"
    if check_path(templates_dir, "templates/"):
        required_templates = ["index.html", "login.html", "signup.html", "chat.html"]
        for t in required_templates:
            if not check_path(templates_dir / t, t): all_passed = False
    else:
        all_passed = False

    # 3. Check Static Assets
    print("\n--- Static Assets ---")
    static_dir = root_dir / "static"
    if check_path(static_dir, "static/"):
        if not check_path(static_dir / "js" / "script.js", "js/script.js"): all_passed = False
        if not check_path(static_dir / "css" / "chat.css", "css/chat.css"): all_passed = False
        if not check_path(static_dir / "css" / "common.css", "css/common.css"): all_passed = False
    else:
        all_passed = False

    # 4. Check Database Scripts (Optional)
    print("\n--- Database Utilities (Optional) ---")
    check_path(root_dir / "init_database.py", "init_database.py", optional=True)
    check_path(root_dir / "check_database.py", "check_database.py", optional=True)
    check_path(root_dir / "database_schema.sql", "database_schema.sql", optional=True)

    # 5. Check Python Dependencies
    print("\n--- Python Dependencies ---")
    dependencies = ["flask", "flask_cors", "psycopg2", "dotenv", "jwt", "bcrypt"]
    for dep in dependencies:
        if not check_package(dep):
            all_passed = False

    print("\n" + "=" * 60)
    if all_passed:
        print("✅ SYSTEM CHECK PASSED")
        print("   The project structure appears intact.")
        print("   You can start the server with: python app.py")
    else:
        print("❌ SYSTEM CHECK FAILED")
        print("   Some required files or dependencies are missing.")
        print("   Please restore the missing files or run 'pip install -r requirements.txt'")
    print("=" * 60)

if __name__ == "__main__":
    main()