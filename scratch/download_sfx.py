import urllib.request
import os

urls = {
    'laugh': 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Laughter_1.mp3',
    'claps': 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Applause.mp3',
    'wow': 'https://files.catbox.moe/0zsc9r.mp3',
    'drumroll': 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Rolling_Drum_1.mp3',
    'fail': 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Sad_Trombone.mp3'
}

sfx_dir = 'public/sfx'
if not os.path.exists(sfx_dir):
    os.makedirs(sfx_dir)

for name, url in urls.items():
    dest = os.path.join(sfx_dir, f'{name}.mp3')
    print(f'Downloading {name} from {url}...')
    try:
        urllib.request.urlretrieve(url, dest)
        print(f'Done: {name}')
    except Exception as e:
        print(f'Error downloading {name}: {e}')
