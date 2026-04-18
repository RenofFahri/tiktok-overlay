import urllib.request
import os

# Link suara yang verifikasinya lebih santai (Wikimedia & Pixabay direct)
# Kita tambahkan User-Agent biar gak dikira bot (403 Forbidden)
urls = {
    'laugh': 'https://upload.wikimedia.org/wikipedia/commons/1/13/Laughing_Crowd.mp3',
    'claps': 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Applause_01.mp3',
    'wow': 'https://files.catbox.moe/0zsc9r.mp3', 
    'drumroll': 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Drum_Roll_1.mp3',
    'fail': 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Sad_Trombone.mp3'
}

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
}

sfx_dir = 'public/sfx'
if not os.path.exists(sfx_dir):
    os.makedirs(sfx_dir)

for name, url in urls.items():
    dest = os.path.join(sfx_dir, f'{name}.mp3')
    print(f'Mendownload {name} dari {url}...')
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            with open(dest, 'wb') as f:
                f.write(response.read())
        print(f'✅ Sukses: {name} (Ukuran: {os.path.getsize(dest)} bytes)')
    except Exception as e:
        print(f'❌ Gagal {name}: {e}')

print("\n--- SELESAI ---")
