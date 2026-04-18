import urllib.request
import os

sfx_dir = 'public/sfx'
if not os.path.exists(sfx_dir):
    os.makedirs(sfx_dir)

url = 'https://archive.org/download/taco-bell-bong-sfx/Taco%20Bell%20Bong%20SFX.mp3'
headers = {'User-Agent': 'Mozilla/5.0'}

print(f"Downloading from {url}...")
try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as response:
        with open('public/sfx/taco-bell.mp3', 'wb') as f:
            f.write(response.read())
    print("✅ Taco Bell sound saved to public/sfx/taco-bell.mp3")
except Exception as e:
    print(f"❌ Error: {e}")
