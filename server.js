const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const path = require('path');
const puppeteer = require('puppeteer-core');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const querystring = require('querystring');

const fs = require('fs');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// [PENGAMAN GLOBAL] Cegah server mati mendadak jika ada error tak terduga
process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err);
});

// [KONTROL PRIORITAS] Keamanan Header (WAJIB PALING ATAS)
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// --- SPOTIFY CONFIG ---
let spotifyTokens = { access: null, refresh: null, expires: 0 };
let spotifyConfig = { clientId: '', clientSecret: '', redirectUri: '' };

const TOKENS_FILE = path.join(__dirname, 'spotify_tokens.json');
const CONFIG_FILE = path.join(__dirname, 'spotify_config.json');

const GLOBAL_SETTINGS_FILE = path.join(__dirname, 'global_settings.json');

// Default global settings
let globalSettings = {
    theme: 'default',
    limit: 20,
    hideSys: false,
    sfx: true,
    tts: true,
    ttsChat: false,
    ttsFollow: true,
    ttsJoin: true,
    goalName: 'GIFT GOAL',
    goalTarget: 100,
    goalGift: '',
    marqueeText: 'Selamat datang di Live Stream kami! Jangan lupa follow dan share!',
    emojiRain: true,
    emojiRainCustom: '',
    pollActive: false,
    pollQuestion: '',
    pollA: '',
    pollKeyA: '1',
    pollB: '',
    pollKeyB: '2',
    botCmds: [],
    mediaGift: '',
    mediaUrl: '',
    spotifyEnabled: true,
    spotifyGlow: true
};

// Load tokens yang sudah tersimpan
if (fs.existsSync(TOKENS_FILE)) {
    try {
        spotifyTokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
        console.log('[Spotify] Token tersimpan berhasil dimuat.');
    } catch (e) {
        console.error("Gagal memuat token Spotify.");
    }
}

// Load config (clientId, clientSecret) yang sudah tersimpan
if (fs.existsSync(CONFIG_FILE)) {
    try {
        const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        spotifyConfig.clientId = savedConfig.clientId || '';
        spotifyConfig.clientSecret = savedConfig.clientSecret || '';
        console.log('[Spotify] Config tersimpan berhasil dimuat.');
    } catch (e) {
        console.error("Gagal memuat config Spotify.");
    }
}

// Load global settings
if (fs.existsSync(GLOBAL_SETTINGS_FILE)) {
    try {
        const savedSettings = JSON.parse(fs.readFileSync(GLOBAL_SETTINGS_FILE, 'utf8'));
        globalSettings = { ...globalSettings, ...savedSettings };
        console.log('[Settings] Pengaturan global berhasil dimuat.');
    } catch (e) {
        console.error("Gagal memuat pengaturan global.");
    }
}


// Buat direktori uploads jika belum ada
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Endpoint Upload Custom Sound
app.post('/upload-sound', (req, res) => {
    try {
        const { fileData, fileName } = req.body;
        if (!fileData) return res.status(400).json({ error: 'No data' });
        
        // Ekstrak base64 (format: data:audio/mp3;base64,xxxx...)
        const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ error: 'Invalid format' });
        }
        
        const buffer = Buffer.from(matches[2], 'base64');
        const safeName = Date.now() + '_' + fileName.replace(/[^a-zA-Z0-9.]/g, '_');
        const filePath = path.join(uploadsDir, safeName);
        fs.writeFileSync(filePath, buffer);
        res.json({ url: '/uploads/' + safeName });
    } catch (err) {
        console.error("Error upload sound:", err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Endpoint Upload Custom Media (Video/GIF)
app.post('/upload-media', (req, res) => {
    try {
        const { fileData, fileName } = req.body;
        if (!fileData) return res.status(400).json({ error: 'No data' });
        
        // Ekstrak base64 (format: data:video/mp4;base64,xxxx...)
        const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ error: 'Invalid format' });
        }
        
        const buffer = Buffer.from(matches[2], 'base64');
        const safeName = Date.now() + '_' + fileName.replace(/[^a-zA-Z0-9.]/g, '_');
        const filePath = path.join(uploadsDir, safeName);
        
        fs.writeFileSync(filePath, buffer);
        res.json({ url: '/uploads/' + safeName });
    } catch (err) {
        console.error("Error upload media:", err);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- SPOTIFY ROUTES ---

// GET: Kirim config tersimpan ke frontend (tanpa secret penuh, hanya untuk auto-fill)
app.get('/api/spotify/config', (req, res) => {
    res.json({
        clientId: spotifyConfig.clientId || '',
        clientSecret: spotifyConfig.clientSecret || '',
        isConnected: !!spotifyTokens.access
    });
});

app.get('/api/settings', (req, res) => {
    res.json(globalSettings);
});

app.post('/api/spotify/config', (req, res) => {
    const { clientId, clientSecret } = req.body;
    if (!clientId || !clientSecret) return res.status(400).json({ error: 'Data tidak lengkap' });
    
    spotifyConfig.clientId = clientId;
    spotifyConfig.clientSecret = clientSecret;
    // Tentukan redirect URI otomatis berdasarkan host req, dukung proxy ngrok (https)
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    spotifyConfig.redirectUri = `${protocol}://${host}/spotify-callback`;
    
    // Simpan config ke file agar tidak hilang saat server restart
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({
            clientId: spotifyConfig.clientId,
            clientSecret: spotifyConfig.clientSecret
            // redirectUri TIDAK disimpan karena akan di-generate ulang sesuai host aktif
        }, null, 2));
    } catch(e) {
        console.error('[Spotify] Gagal menyimpan config:', e.message);
    }
    
    console.log(`[Spotify] Config berhasil diset. Redirect URI: ${spotifyConfig.redirectUri}`);
    console.log(`[Spotify] ⚠️  PASTIKAN Redirect URI ini sudah ditambahkan di Spotify Developer Dashboard!`);
    
    res.json({ success: true, redirectUri: spotifyConfig.redirectUri });
});

app.get('/spotify-login', (req, res) => {
    if (!spotifyConfig.clientId) return res.send('Client ID belum diset di Dashboard! Silakan isi Client ID dan Client Secret terlebih dahulu.');
    
    // Selalu generate ulang redirect URI dari request yang aktif (fix masalah ngrok URL lama)
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    spotifyConfig.redirectUri = `${protocol}://${host}/spotify-callback`;
    
    const scope = 'user-read-currently-playing user-read-playback-state';
    const authUrl = 'https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: spotifyConfig.clientId,
            scope: scope,
            redirect_uri: spotifyConfig.redirectUri
        });
    
    console.log(`[Spotify] Login dimulai. Redirect URI aktif: ${spotifyConfig.redirectUri}`);
    res.redirect(authUrl);
});

app.get('/spotify-callback', async (req, res) => {
    const code = req.query.code || null;
    if (!code) return res.redirect('/#spotify-error');

    try {
        const authOptions = {
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            data: querystring.stringify({
                code: code,
                redirect_uri: spotifyConfig.redirectUri,
                grant_type: 'authorization_code'
            }),
            headers: {
                'Authorization': 'Basic ' + (Buffer.from(spotifyConfig.clientId + ':' + spotifyConfig.clientSecret).toString('base64')),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        const response = await axios(authOptions);
        spotifyTokens.access = response.data.access_token;
        spotifyTokens.refresh = response.data.refresh_token;
        spotifyTokens.expires = Date.now() + (response.data.expires_in * 1000);

        fs.writeFileSync(TOKENS_FILE, JSON.stringify(spotifyTokens));
        res.redirect('/#spotify-success');
    } catch (error) {
        console.error("Spotify Auth Error:", error.response ? error.response.data : error.message);
        res.redirect('/#spotify-error');
    }
});

app.post('/api/spotify/logout', (req, res) => {
    spotifyTokens = { access: null, refresh: null, expires: 0 };
    spotifyConfig.clientId = '';
    spotifyConfig.clientSecret = '';
    if (fs.existsSync(TOKENS_FILE)) {
        try { fs.unlinkSync(TOKENS_FILE); } catch(e) {}
    }
    if (fs.existsSync(CONFIG_FILE)) {
        try { fs.unlinkSync(CONFIG_FILE); } catch(e) {}
    }
    res.json({ success: true });
});

async function refreshSpotifyToken() {
    if (!spotifyTokens.refresh) return false;
    try {
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            data: querystring.stringify({
                grant_type: 'refresh_token',
                refresh_token: spotifyTokens.refresh
            }),
            headers: {
                'Authorization': 'Basic ' + (Buffer.from(spotifyConfig.clientId + ':' + spotifyConfig.clientSecret).toString('base64')),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        spotifyTokens.access = response.data.access_token;
        spotifyTokens.expires = Date.now() + (response.data.expires_in * 1000);
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(spotifyTokens));
        return true;
    } catch (error) {
        console.error("Gagal refresh token Spotify");
        return false;
    }
}

let lastSong = null;
async function pollSpotify() {
    if (!spotifyTokens.access) return;
    if (Date.now() > spotifyTokens.expires - 60000) {
        await refreshSpotifyToken();
    }

    try {
        const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { 'Authorization': 'Bearer ' + spotifyTokens.access }
        });

        if (response.status === 200 && response.data.item) {
            // Cek apakah yang sedang diputar adalah iklan
            const currentType = response.data.currently_playing_type;
            if (currentType === 'ad') {
                // Iklan sedang diputar — kirim null agar widget disembunyikan
                if (lastSong !== null) {
                    lastSong = null;
                    io.emit('spotify-update', null);
                    console.log('[Spotify] 🔇 Iklan terdeteksi, widget disembunyikan.');
                }
                return;
            }

            const track = response.data.item;
            const songData = {
                title: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                albumArt: track.album.images[0] ? track.album.images[0].url : '',
                albumName: track.album.name,
                isPlaying: response.data.is_playing,
                progressMs: response.data.progress_ms || 0,
                durationMs: track.duration_ms || 0,
            };
            
            // Selalu broadcast setiap poll agar progress bar selalu update
            lastSong = songData;
            io.emit('spotify-update', songData);
        } else {
            if (lastSong !== null) {
                lastSong = null;
                io.emit('spotify-update', null);
            }
        }
    } catch (e) {
        // console.error("Spotify Poll Error");
    }
}

setInterval(pollSpotify, 5000);


// Global Map: streamerUsername -> { connection: WebcastPushConnection, activeSockets: Set }
const activeStreams = new Map();

/**
 * Kirim data langsung ke tiap socket ID agar lebih handal dibanding Room
 */
function broadcastToStream(streamUsername, event, data) {
    if (!streamUsername) return;
    io.to(streamUsername.toLowerCase().trim()).emit(event, data);
}

// Monitor State: streamerUsername -> { browser, page, interval }
const activeMonitors = new Map();

// Helper to determine Chrome path on Windows
function getChromePath() {
    const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];
    for (let p of paths) {
        if (require('fs').existsSync(p)) return p;
    }
    return null;
}

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    let currentRoom = null;

    socket.on('set-username', (data) => {
        if (!data) return;
        
        let username, sessionId, ttTargetIdc;
        if (typeof data === 'string') {
            username = data.toLowerCase().trim();
        } else {
            username = data.username ? data.username.toLowerCase().trim() : null;
            sessionId = data.sessionId ? data.sessionId.trim() : null;
            ttTargetIdc = data.ttTargetIdc ? data.ttTargetIdc.trim() : null;
        }

        if (username && username.startsWith('@')) username = username.substring(1);

        if (!username) return;
        
        // Keluarkan dari room sebelumnya jika ganti user
        if (currentRoom && currentRoom !== username) {
            leaveStream(currentRoom, socket);
        }

        currentRoom = username;
        socket.join(username);
        console.log(`[Socket ${socket.id}] joined room: ${username}`);
        console.log(`[Socket ${socket.id}] rooms:`, socket.rooms);
        socket.emit('tiktok-connecting', username);

        // Jika streamer ini BELUM punya koneksi backend, buat baru
        if (!activeStreams.has(username)) {
            console.log(`[Backend] Membuat koneksi BARU ke TikTok Live: ${username}`);
            
            // Opsi Tambahan untuk Session ID (ANTI-BLOCK) - HANYA divalidasi jika KEDUANYA diisi
            const options = {};
            if (sessionId && ttTargetIdc) {
                options.sessionId = sessionId;
                options.ttTargetIdc = ttTargetIdc;
            }

            let tikTokConnection;
            try {
                tikTokConnection = new WebcastPushConnection(username, options);
            } catch (err) {
                console.error(`[Backend] Error inisialisasi koneksi ${username}:`, err.message);
                socket.emit('tiktok-error', `Sistem Error: ${err.message}. Pastikan isian Anda benar.`);
                return;
            }
            
            activeStreams.set(username, {
                connection: tikTokConnection,
                activeSockets: new Set([socket.id]),
                stats: { likes: 0, follows: 0, shares: 0, viewers: 0 }
            });

            // Hubungkan ke TikTok API
            tikTokConnection.connect().then(state => {
                console.info(`[Backend] Berhasil masuk Room ID ${state.roomId} untuk ${username}`);
                broadcastToStream(username, 'tiktok-connected', username);
            }).catch(err => {
                const errMsg = err ? err.toString() : 'Unknown Error';
                console.error(`[Backend] TIKTOK ERROR [${username}]: ${errMsg}`);
                
                let userFriendlyMsg = 'Gagal menghubungkan. Pastikan username benar dan sedang live!';
                if (errMsg.includes('200')) {
                    userFriendlyMsg = 'TikTok menolak koneksi (Error 200). Pastikan Anda SUDAH LIVE dan coba lagi dlm 1 menit.';
                } else if (errMsg.includes('404')) {
                    userFriendlyMsg = 'Username tidak ditemukan. Cek ejaan ID TikTok Anda.';
                } else if (errMsg.includes('offline') || errMsg.includes('online')) {
                    userFriendlyMsg = 'Streamer sedang OFFLINE. Harap mulai siaran / live terlebih dahulu di TikTok!';
                } else {
                    userFriendlyMsg += ` (Detail: ${errMsg})`;
                }

                broadcastToStream(username, 'tiktok-error', userFriendlyMsg);
                // Hapus dari map jika gagal
                activeStreams.delete(username);
            });

            // Pengaman Server dari Crash jika TikTok Socket memutus secara pihak
            tikTokConnection.on('error', err => {
                const safeErr = err.exception ? err.exception.toString() : (err.message || err.toString());
                if (!safeErr.toLowerCase().includes('offline')) {
                    console.error(`[Backend] Peringatan Internal pada ${username}:`, safeErr);
                }
            });

            // Forward Events secara spesifik HANYA ke room username tersebut
            tikTokConnection.on('chat', data => {
                const roomName = username.toLowerCase();
                const packet = {
                    uniqueId: data.uniqueId,
                    nickname: data.nickname,
                    comment: data.comment,
                    profilePictureUrl: data.profilePictureUrl,
                    followRole: data.followRole,
                    isModerator: data.isModerator,
                    isNewGifter: data.isNewGifter,
                    isSubscriber: data.isSubscriber
                };

                broadcastToStream(roomName, 'chat', packet);
            });

            // Heartbeat room (Direct)
            const heartbeat = setInterval(() => {
                if (activeStreams.has(username)) {
                    broadcastToStream(username, 'heartbeat', { time: Date.now(), room: username });
                } else {
                    clearInterval(heartbeat);
                }
            }, 5000);

            tikTokConnection.on('gift', data => {
                console.log(`[Gift][DirectSend: ${username}] ${data.nickname} mengirim ${data.giftName}`);
                broadcastToStream(username, 'gift', data);
            });
            
            tikTokConnection.on('like', data => {
                const streamData = activeStreams.get(username);
                if (streamData) {
                    streamData.stats.likes += (data.likeCount || 1);
                    broadcastToStream(username, 'stream-stats', streamData.stats);
                }
                broadcastToStream(username, 'like', {
                    uniqueId: data.uniqueId,
                    nickname: data.nickname,
                    likeCount: data.likeCount
                });
            });
            
            tikTokConnection.on('member', data => {
                broadcastToStream(username, 'member', {
                    uniqueId: data.uniqueId,
                    nickname: data.nickname
                });
            });

            tikTokConnection.on('follow', data => {
                const streamData = activeStreams.get(username);
                if (streamData) {
                    streamData.stats.follows += 1;
                    broadcastToStream(username, 'stream-stats', streamData.stats);
                }
                broadcastToStream(username, 'follow', {
                    uniqueId: data.uniqueId,
                    nickname: data.nickname
                });
            });

            tikTokConnection.on('share', data => {
                const streamData = activeStreams.get(username);
                if (streamData) {
                    streamData.stats.shares += 1;
                    broadcastToStream(username, 'stream-stats', streamData.stats);
                }
                broadcastToStream(username, 'share', {
                    uniqueId: data.uniqueId,
                    nickname: data.nickname
                });
            });

            tikTokConnection.on('roomUser', data => {
                const streamData = activeStreams.get(username);
                if (streamData) {
                    streamData.stats.viewers = data.viewerCount || 0;
                    broadcastToStream(username, 'stream-stats', streamData.stats);
                }
            });
            
            tikTokConnection.on('streamEnd', () => {
                broadcastToStream(username, 'tiktok-disconnected', 'Live Stream telah usai.');
                try { tikTokConnection.disconnect(); } catch(e) {}
                activeStreams.delete(username);
            });

        } else {
            // Jika streamer SUDAH terkoneksi di memori, penonton baru "nebeng" aliran memori yang sama
            console.log(`[Backend] Nebeng koneksi existing untuk: ${username}`);
            const streamData = activeStreams.get(username);
            streamData.activeSockets.add(socket.id);
            
            // Beritahu client bahwa dia berhasil nebeng (koneksi sudah di-establish sebelumnya)
            socket.emit('tiktok-connected', username);
        }
    });

    socket.on('settings-update', (data) => {
        if (!data.settings) return;
        
        // Simpan ke globalSettings di server (merge changes)
        globalSettings = { ...globalSettings, ...data.settings };
        
        // Simpan ke file secara async agar tidak hilang saat mati lampu/restart
        fs.writeFile(GLOBAL_SETTINGS_FILE, JSON.stringify(globalSettings, null, 4), (err) => {
            if (err) console.error('[Settings] Gagal menyimpan file:', err);
        });

        // Hanya broadcast ke room jika room-nya ada (untuk sinkronisasi overlay realtime)
        if (data.room) {
            broadcastToStream(data.room, 'settings-updated', data.settings);
        }
    });



    socket.on('leave-stream', (data) => {
        if (!data || !data.room) return;
        console.log(`[Socket ${socket.id}] Memberikan perintah STOP untuk room: ${data.room}`);
        leaveStream(data.room, socket);
        socket.emit('tiktok-disconnected', 'Koneksi diputus oleh pengguna.');
    });

    socket.on('simulate-event', (data) => {
        if (!data.room || !data.type || !data.packet) return;
        console.log(`[Simulation] Broadcasting ${data.type} to ${data.room}`);
        broadcastToStream(data.room, data.type, data.packet);
    });

    socket.on('client-log', (msg) => {
        console.log(`[ClientLog] ${socket.id}: ${msg}`);
    });

    // ================= VIRTUAL MONITOR LOGIC =================

    socket.on('monitor:start', async (username) => {
        if (!username) return;
        const room = username.toLowerCase().trim();

        if (activeMonitors.has(room)) {
            console.log(`[Monitor] Room ${room} sudah dipantau.`);
            return;
        }

        const chromePath = getChromePath();
        if (!chromePath) {
            socket.emit('monitor:error', 'Chrome tidak ditemukan di sistem XAMPP Anda. Gagal aktivasi Monitor.');
            return;
        }

        console.log(`[Monitor] Memulai monitor virtual untuk: ${room}`);

        try {
            const browser = await puppeteer.launch({
                executablePath: chromePath,
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--mute-audio']
            });

            const page = await browser.newPage();
            await page.setViewport({ width: 450, height: 800 });
            
            console.log(`[Monitor] Mencoba membuka halaman TikTok untuk ${room}...`);
            await page.goto(`https://www.tiktok.com/@${room}/live`, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            // Tunggu elemen video muncul (Target selector hasil riset)
            const videoSelector = 'div[data-testid="live-player-container"]';
            console.log(`[Monitor] Menunggu selector video: ${videoSelector}...`);
            
            try {
                await page.waitForSelector(videoSelector, { timeout: 30000 });
                console.log(`[Monitor] Video ditemukan! Memulai snapshot.`);
            } catch (e) {
                console.warn(`[Monitor] Selector video tidak ditemukan dalam 30 detik. Mencoba snapshot paksa.`);
            }

            // Beri waktu tambahan untuk render awal
            await new Promise(r => setTimeout(r, 3000));

            // Loop snapshot setiap 3 detik
            const interval = setInterval(async () => {
                if (!activeMonitors.has(room)) return clearInterval(interval);
                try {
                    const base64 = await page.screenshot({
                        type: 'jpeg',
                        quality: 40,
                        encoding: 'base64'
                    });
                    io.to(room).emit('monitor:snapshot', base64);
                } catch (e) {
                    console.error(`[Monitor] Gagal ambil snapshot ${room}:`, e.message);
                }
            }, 3000);

            activeMonitors.set(room, { browser, page, interval, ownerSocket: socket.id });
            socket.emit('monitor:ready');

        } catch (err) {
            console.error(`[Monitor] Error:`, err.message);
            socket.emit('monitor:error', 'Gagal memuat siaran TikTok via Virtual Monitor.');
        }
    });

    socket.on('monitor:stop', (username) => {
        const room = username ? username.toLowerCase().trim() : null;
        if (room && activeMonitors.has(room)) {
            stopMonitor(room);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        if (currentRoom) {
            leaveStream(currentRoom, socket);
            
            // Jika yang disconnect adalah yang menyalakan monitor, matikan monitornya
            activeMonitors.forEach((val, room) => {
                if (val.ownerSocket === socket.id) {
                    stopMonitor(room);
                }
            });
        }
    });
});

function stopMonitor(room) {
    const data = activeMonitors.get(room);
    if (data) {
        console.log(`[Monitor] Menghentikan monitor untuk: ${room}`);
        clearInterval(data.interval);
        data.browser.close().catch(() => {});
        activeMonitors.delete(room);
        io.to(room).emit('monitor:stopped');
    }
}

// Sistem Pintar Penghemat RAM Server (Otomatis Putus jika tidak ada yang buka link-nya)
function leaveStream(username, socket) {
    socket.leave(username);
    if (activeStreams.has(username)) {
        const streamData = activeStreams.get(username);
        streamData.activeSockets.delete(socket.id);
        
        console.log(`[Socket ${socket.id}] leave ${username}. Sisa penonton overlay ini: ${streamData.activeSockets.size}`);
        
        if (streamData.activeSockets.size === 0) {
            console.log(`[Backend] Tidak ada yang pasang overlay room ${username}. Memutus WebSocket untuk hemat Memory/RAM server.`);
            try { streamData.connection.disconnect(); } catch(e) {}
            activeStreams.delete(username);
        }
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server API TikTok Overlay MULTI-USER berjalan di http://localhost:${PORT}`);
});
