import urllib.request
import os

# Link RAW GitHub yang sudah diverifikasi strukturnya
urls = {
    'laugh': 'https://raw.githubusercontent.com/jonjonsson/SoundMonster/master/Public%20domain/Laughter/laughter.mp3',
    'claps': 'https://raw.githubusercontent.com/jonjonsson/SoundMonster/master/Public%20domain/Applause/applause_audience.mp3',
    'wow': 'https://files.catbox.moe/0zsc9r.mp3', 
    'drumroll': 'https://raw.githubusercontent.com/arnofaure/free-sfx/master/Alert/success.mp3',
    'fail': 'https://raw.githubusercontent.com/arnofaure/free-sfx/master/Voice/oh_no.mp3'
}

# Gunakan User-Agent asli agar tidak diblokir GitHub/Catbox
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

sfx_dir = 'public/sfx'
if not os.path.exists(sfx_dir):
    os.makedirs(sfx_dir)

print("--- MEMULAI DOWNLOAD SFX (ANTI-BLOCK) ---")

for name, url in urls.items():
    dest = os.path.join(sfx_dir, f'{name}.mp3')
    print(f'Sedang mengambil {name}...')
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as response:
            with open(dest, 'wb') as f:
                f.write(response.read())
        print(f'SUCCESS: {name} terunduh.')
    except Exception as e:
        print(f'FAILED {name}: {str(e)}')

print("\n--- PROSES SELESAI ---")
