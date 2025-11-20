"""
Test signup endpoint to verify it's working
"""
import urllib.request
import urllib.error
import json

url = "http://localhost:3000/api/auth/signup"
data = {
    "name": "Vincent Test",
    "email": "vincent@gmail.com",
    "password": "testpassword123"
}

print("Testing signup endpoint...")
print(f"URL: {url}")
print(f"Data: {json.dumps(data, indent=2)}")
print()

try:
    req_data = json.dumps(data).encode('utf-8')
    request = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"})
    
    with urllib.request.urlopen(request) as response:
        status_code = response.getcode()
        response_data = json.loads(response.read().decode('utf-8'))
        print(f"Status Code: {status_code}")
        print(f"Response: {json.dumps(response_data, indent=2)}")
        
        if status_code == 201:
            print("\n✅ Signup successful!")
        else:
            print(f"\n⚠️  Unexpected status code: {status_code}")
            
except urllib.error.HTTPError as e:
    error_data = json.loads(e.read().decode('utf-8'))
    print(f"Status Code: {e.code}")
    print(f"Response: {json.dumps(error_data, indent=2)}")
    
    if e.code == 400:
        print(f"\n⚠️  Signup failed: {error_data.get('error', 'Unknown error')}")
    else:
        print(f"\n❌ Signup failed with status {e.code}")
        
except Exception as e:
    print(f"❌ Error: {e}")

