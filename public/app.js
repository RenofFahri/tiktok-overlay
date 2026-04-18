const socket = io();

// --- NUCLEAR ANTI-ECHO DEDUPLICATOR ---
const processedEventHashes = new Set();
function isDuplicateEvent(type, data) {
    // Generate unique hash based on type + content + timestamp (rounded to 2s)
    const content = data.comment || data.giftName || data.nickname || "";
    const timeKey = Math.floor(Date.now() / 2000); // 2 second window
    const hash = `${type}_${data.uniqueId}_${content}_${timeKey}`;
    
    if (processedEventHashes.has(hash)) {
        console.warn(`[Nuclear] Duplicate ${type} blocked!`);
        return true;
    }
    
    processedEventHashes.add(hash);
    // Cleanup hash setelah 5 detik agar memori tidak penuh
    setTimeout(() => processedEventHashes.delete(hash), 5000);
    return false;
}


// Element Dasar
const setupPanel = document.getElementById('setup-panel');
const dashboardPanel = document.getElementById('dashboard-panel');
const dashboardWrapper = document.getElementById('dashboard-wrapper');
const dashChatList = document.getElementById('dash-chat-list');
const usernameInput = document.getElementById('username-input');
const sessionInput = document.getElementById('session-input');
const connectBtn = document.getElementById('connect-btn');
const skipBtn = document.getElementById('skip-btn');
const btnDisconnect = document.getElementById('btn-disconnect');
const statusText = document.getElementById('status-text');
const socketStatus = document.getElementById('socket-status');
const debugLogList = document.getElementById('debug-log-list');
const idcInput = document.getElementById('idc-input'); 
const setupForm = document.getElementById('setup-form'); // Optional, keep if used, otherwise remove 

// 1. OTOMATIS LOAD DATA LAMA (Remember Me)
if (usernameInput) usernameInput.value = localStorage.getItem('tiktok_username') || '';
if (sessionInput) sessionInput.value = localStorage.getItem('tiktok_session') || '';
if (idcInput) idcInput.value = localStorage.getItem('tiktok_idc') || '';

let lastHeartbeat = Date.now();
let milestoneReached = false;
let heartbeatInterval = null;

// ================= DEBUG LOG =================
function addDebugLog(msg) {
    if (!debugLogList) return;
    const line = document.createElement('div');
    line.innerText = `[${new Date().toLocaleTimeString('id-ID')}] ${msg}`;
    debugLogList.appendChild(line);
    // Limit log entries
    while (debugLogList.childElementCount > 20) {
        debugLogList.removeChild(debugLogList.firstChild);
    }
    debugLogList.scrollTop = debugLogList.scrollHeight;
}

socket.on('connect', () => {
    if (socketStatus) {
        socketStatus.innerText = "📡 ONLINE";
        socketStatus.style.color = "#2ed573";
    }
    addDebugLog("Socket Connected to Server");
    if (typeof startHeartbeatCheck === 'function') startHeartbeatCheck();
});

socket.on('disconnect', () => {
    if (socketStatus) {
        socketStatus.innerText = "📡 OFFLINE";
        socketStatus.style.color = "#ff4757";
    }
    addDebugLog("WARNING: Socket Disconnected");
});

socket.on('heartbeat', (data) => {
    lastHeartbeat = Date.now();
    addDebugLog(`Ping received from stream: @${data.room}`);
});

// Element Dashboard Control
const dashTarget = document.getElementById('dashboard-target');
const dashLimit = document.getElementById('dash-limit');
const dashTheme = document.getElementById('dash-theme');
const dashHideSys = document.getElementById('dash-hidesys');
const dashGoalName = document.getElementById('dash-goal-name');
const dashGoalTarget = document.getElementById('dash-goal-target');
const dashGoalGift = document.getElementById('dash-goal-gift');
const dashSfxEnabled = document.getElementById('dash-sfx-enabled');
const dashTtsEnabled = document.getElementById('dash-tts-enabled');
const dashTtsChatEnabled = document.getElementById('dash-tts-chat-enabled');
const dashTtsFollowEnabled = document.getElementById('dash-tts-follow-enabled');
const dashTtsJoinEnabled = document.getElementById('dash-tts-join-enabled');
const dashEmojiRainEnabled = document.getElementById('dash-emoji-rain-enabled');
const dashEmojiRainCustom = document.getElementById('dash-emoji-rain-custom');

const dashPollQuestion = document.getElementById('dash-poll-question');
const dashPollA = document.getElementById('dash-poll-a');
const dashPollKeyA = document.getElementById('dash-poll-key-a');
const dashPollB = document.getElementById('dash-poll-b');
const dashPollKeyB = document.getElementById('dash-poll-key-b');
const btnTogglePoll = document.getElementById('btn-toggle-poll');

const dashCmdKey = document.getElementById('dash-cmd-key');
const dashCmdVal = document.getElementById('dash-cmd-val');
const btnAddCmd = document.getElementById('btn-add-cmd');
const cmdListContainer = document.getElementById('cmd-list-container');

const dashMediaGift = document.getElementById('dash-media-gift');
const dashMediaFile = document.getElementById('dash-media-file');
const btnUploadMedia = document.getElementById('btn-upload-media');
const txtMediaStatus = document.getElementById('txt-media-status');

const dashSoundPreset = document.getElementById('dash-sound-preset');
const dashSoundUrl = document.getElementById('dash-sound-url');
const dashSoundFile = document.getElementById('dash-sound-file');
const btnUploadSound = document.getElementById('btn-upload-sound');
const dashMarqueeText = document.getElementById('dash-marquee-text');
const dashRainbowEnabled = document.getElementById('dash-rainbow-enabled');
const dashSession = document.getElementById('dash-session');
const dashIdc = document.getElementById('dash-idc');
const dashTtsVoice = document.getElementById('dash-tts-voice');
const btnTestAlert = document.getElementById('btn-test-alert');
const obsLinkOutput = document.getElementById('obs-link-output');

// Element Spotify
const spotifyClientId = document.getElementById('spotify-client-id');
const spotifyClientSecret = document.getElementById('spotify-client-secret');
const btnSaveSpotify = document.getElementById('btn-save-spotify');
const spotifyAuthSection = document.getElementById('spotify-auth-section');
const spotifyWidget = document.getElementById('spotify-widget');
const spotifyArt = document.getElementById('spotify-art');
const spotifyTitle = document.getElementById('spotify-title');
const spotifyArtist = document.getElementById('spotify-artist');
const dashSpotifyGlow = document.getElementById('dash-spotify-glow');
const btnLogoutSpotify = document.getElementById('btn-logout-spotify');


// Request Lagu State
let songQueue = [];
const songQueueContainer = document.getElementById('song-queue-container');

// PRE-FILL Sesi - DIKOSONGKAN JIKA TIDAK ADA DATA LAMA
if(sessionInput && !sessionInput.value) {
    sessionInput.value = "";
    if(idcInput) idcInput.value = ""; 
}

// Element Overlay
const chatArea = document.getElementById('chat-area');
const giftArea = document.getElementById('gift-area');
const milestoneContainer = document.getElementById('milestone-container');
const milestoneTitle = document.getElementById('milestone-title');
const milestoneProgress = document.getElementById('milestone-progress');
const milestoneText = document.getElementById('milestone-text');
const leaderboardList = document.getElementById('leaderboard-list');

// GLOBAL SETTINGS & DATA
let chatLimit = 30;
let isHideSys = false;
let activeRoom = null;
let currentSessionId = null;
let reachedMilestones = { likes: 0, follows: 0, shares: 0 };
let milestoneGoal = { name: "Mawar Goal", target: 50, current: 0 };
let milestoneGiftFilter = ''; // kosong = semua gift, isi nama = hanya gift tersebut
let topGifters = {}; // { nickname: score }
let sfxEnabled = true;
let ttsEnabled = false;
let ttsChatEnabled = false;
let ttsFollowEnabled = false;
let ttsJoinEnabled = false;
let currentTtsVoiceName = "";

// Fitur Baru
let emojiRainEnabled = true;
let emojiRainCustom = "";
let spotifyEnabled = true;
let spotifyGlow = true;

// Supporter Feed State
let supporterQueue = [];
const supporterFeedEl = document.getElementById('supporter-feed');

function addToSupporterFeed(data, action) {
    if (!supporterFeedEl || !userFromUrl) return;

    // Check if Supporter Feed module is allowed in current link
    const modulesParam = new URLSearchParams(window.location.search).get('modules');
    const overlayType = new URLSearchParams(window.location.search).get('type') || 'all';
    if (overlayType === 'all' && modulesParam && !modulesParam.includes('sosmed')) {
        // We reuse 'sosmed' slot or just allow it by default if type=all
    }

    const card = document.createElement('div');
    card.className = 'supporter-card';
    
    const pfp = data.profilePictureUrl || `https://ui-avatars.com/api/?name=${data.nickname}&background=random`;
    
    card.innerHTML = `
        <img src="${pfp}" class="supporter-img">
        <div class="supporter-info">
            <div class="supporter-name">${data.nickname}</div>
            <div class="supporter-action">${action}</div>
        </div>
    `;

    supporterFeedEl.prepend(card);

    // Keep only last 5
    while (supporterFeedEl.childElementCount > 5) {
        supporterFeedEl.removeChild(supporterFeedEl.lastChild);
    }

    // Auto remove after 10s
    setTimeout(() => {
        card.style.animation = 'supporterOut 0.5s ease-in forwards';
        setTimeout(() => { if(card.parentElement) card.parentElement.removeChild(card); }, 500);
    }, 10000);
}

// Toast System
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️')}</span> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.4s forwards';
        setTimeout(() => { if(toast.parentElement) toast.parentElement.removeChild(toast); }, 400);
    }, 4000);
} // Widget visibility toggle
let pollActive = false;
let pollQuestion = "";
let pollNameA = ""; let pollKeyA = "";
let pollNameB = ""; let pollKeyB = "";
let pollVotesA = 0;
let pollVotesB = 0;
let botCmds = [];
let mediaShareGift = "";
let mediaShareUrl = "";

// Cari suara bahasa Indonesia terbaik (Google/Microsoft)
let idnVoice = null;

function populateVoiceList() {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return;

    // Default voice auto-picker (Indonesian)
    idnVoice = voices.find(v => v.lang === 'id-ID' && v.name.includes('Google')) || 
               voices.find(v => v.lang === 'id-ID' && v.name.includes('Microsoft')) || 
               voices.find(v => v.lang.startsWith('id'));

    // Populate Dropdown if on Dashboard
    if (dashTtsVoice) {
        const currentVal = dashTtsVoice.value || currentTtsVoiceName || "[Online] Google Indonesian (Universal)";
        dashTtsVoice.innerHTML = '';
        
        // Inject Online Universal Voice at the TOP
        const onlineOpt = document.createElement('option');
        onlineOpt.value = "[Online] Google Indonesian (Universal)";
        onlineOpt.innerText = "🌐 [Online] Google Indonesia (Sangat Disarankan)";
        onlineOpt.style.color = "#00f2fe";
        onlineOpt.style.fontWeight = "bold";
        if (onlineOpt.value === currentVal) onlineOpt.selected = true;
        dashTtsVoice.appendChild(onlineOpt);

        // Filter: Hanya tampilkan suara Indonesia atau English (biar gak kepanjangan)
        const filteredVoices = voices.filter(v => v.lang.startsWith('id') || v.lang.startsWith('en'));

        
        filteredVoices.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.name;
            opt.innerText = `${v.name} (${v.lang})`;
            opt.style.color = '#000';
            if (v.name === currentVal) opt.selected = true;
            dashTtsVoice.appendChild(opt);
        });
        
        // Simpan default ke global variable jika belum ada
        if (!currentTtsVoiceName && idnVoice) currentTtsVoiceName = idnVoice.name;
    }
}

window.speechSynthesis.onvoiceschanged = populateVoiceList;
// Trigger initial populate if voices are already loaded
if (window.speechSynthesis.getVoices().length > 0) populateVoiceList();

// --- TTS Anti-Echo System ---
let ttsQueue = [];
let isTalking = false;
let lastTtsText = "";
let lastTtsTime = 0;
const dashboardTabId = Math.random().toString(36).substring(2, 10);

// Klaim Speaker Role (Dashboard Only)
const isDashboardTab = !window.location.search.includes('user=');
if (isDashboardTab) {
    // Force claim saat buka/focus
    localStorage.setItem('tts_active_tab', dashboardTabId);
    window.addEventListener('focus', () => {
        localStorage.setItem('tts_active_tab', dashboardTabId);
        ttsQueue = []; // Bersihkan antrean tab yang baru aktif agar tidak sisa lama
    });
}

function processTtsQueue() {
    if (isTalking || ttsQueue.length === 0) return;
    
    // Pastikan ini masih tab aktif yang boleh ngomong (Dashboard Multiple Tabs Fix)
    if (isDashboardTab && localStorage.getItem('tts_active_tab') !== dashboardTabId) {
        ttsQueue = []; 
        return;
    }

    // Set lock segera agar tidak ada pemicu ganda
    isTalking = true;

    const text = ttsQueue[0];
    
    // --- LOGIKA HYBRID (ONLINE vs LOCAL) ---
    if (currentTtsVoiceName === "[Online] Google Indonesian (Universal)") {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=id&client=tw-ob`;
        const audio = new Audio(url);
        
        // 🛡️ KUNCI: Satu flag untuk mencegah double fallback
        let errorHandled = false;
        
        audio.onended = () => {
            isTalking = false;
            ttsQueue.shift();
            setTimeout(processTtsQueue, 200);
        };
        
        // onerror dan .catch() keduanya bisa terpanggil saat gagal — pakai flag!
        const handleFallback = () => {
            if (errorHandled) return; // Sudah ditangani, abaikan!
            errorHandled = true;
            console.warn("[TTS] Online gagal, fallback ke suara lokal.");
            ttsQueue.shift();
            isTalking = false;
            playLocalTts(text);
        };
        
        audio.onerror = handleFallback;
        audio.play().catch(handleFallback);
        
    } else {
        playLocalTts(text, false); 
    }
}

function playLocalTts(text, alreadyLocked = false) {
    if (!alreadyLocked) isTalking = true;
    
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'id-ID';
    
    // Gunakan suara kustom jika terpilih, jika tidak fallback ke idnVoice
    const voices = window.speechSynthesis.getVoices();
    const customVoice = voices.find(v => v.name === currentTtsVoiceName);
    
    if (customVoice) {
        msg.voice = customVoice;
        msg.lang = customVoice.lang;
    } else if (idnVoice) {
        msg.voice = idnVoice;
    }

    msg.rate = 1.1; 

    msg.pitch = 1.0;

    msg.onstart = () => { isTalking = true; };
    msg.onend = () => {
        isTalking = false;
        ttsQueue.shift(); // Hapus item yang sudah dibaca
        setTimeout(processTtsQueue, 100); 
    };
    msg.onerror = () => {
        isTalking = false;
        ttsQueue.shift();
        setTimeout(processTtsQueue, 100);
    };

    window.speechSynthesis.speak(msg);
}

function speakTextNative(text) {
    if (userFromUrl) return; 
    if (!('speechSynthesis' in window)) return;
    
    // 🛡️ Anti-Echo / Anti-Spam (More Robust)
    const now = Date.now();
    const cleanText = text.trim();
    if (cleanText === lastTtsText.trim() && (now - lastTtsTime) < 3000) {
        console.warn("[TTS] Duplicate ignored:", cleanText);
        return;
    }
    
    lastTtsText = cleanText;
    lastTtsTime = now;

    // 📡 DEBUG: Kirim ke server biar saya bisa intip
    if (typeof socket !== 'undefined') {
        socket.emit('client-log', `TTS Triggered: "${cleanText}" (Voice: ${currentTtsVoiceName})`);
    }

    // Masukkan ke antrean
    ttsQueue.push(cleanText);
    processTtsQueue();
}

// Sound Effect — dinamis bisa diganti
let alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
alertSound.volume = 0.5;

function changeSoundTo(url) {
    alertSound = new Audio(url);
    alertSound.volume = 0.5;
}

// ================= IDENTIFIKASI MODE =================
const urlParams = new URLSearchParams(window.location.search);
const userFromUrl = urlParams.get('user');

if (userFromUrl) {
    document.body.classList.add('overlay-mode');
    setupPanel.style.display = "none";
    if (dashboardWrapper) dashboardWrapper.style.display = "none";
    activeRoom = userFromUrl.toLowerCase().trim();
    currentSessionId = urlParams.get('sid') || null;
    let currentIdc = urlParams.get('idc') || null;

    // Inisialisasi awal dari URL (Bisa dari query biasa atau state base64 d)
    const b64Data = urlParams.get('d');
    if (b64Data) {
        try {
            const decodedStr = decodeURIComponent(escape(atob(b64Data)));
            const s = JSON.parse(decodedStr);
            chatLimit = parseInt(s.limit) || 30;
            isHideSys = s.hideSys === true || s.hideSys === "1";
            milestoneGoal.name = s.goalName || "Goal";
            milestoneGoal.target = parseInt(s.goalTarget) || 50;
            milestoneGiftFilter = s.goalGift || '';
            const themeFromUrl = s.theme || 'default';
            if (themeFromUrl !== 'default') document.body.classList.add(`theme-${themeFromUrl}`);
            
            // State poll
            pollActive = s.pollActive || false;
            pollNameA = s.pollA || "A"; pollKeyA = s.pollKeyA || "1";
            pollNameB = s.pollB || "B"; pollKeyB = s.pollKeyB || "2";
            pollQuestion = s.pollQuestion || "Target Goal";
            botCmds = s.botCmds || [];
            mediaShareGift = s.mediaGift || "";
            mediaShareUrl = s.mediaUrl || "";
            if (s.soundUrl) {
                changeSoundTo(s.soundUrl);
                if (dashSoundUrl) dashSoundUrl.value = s.soundUrl;
            }
        } catch(e) { console.error("Bad base64 settings param"); }
    } else {
        chatLimit = parseInt(urlParams.get('limit')) || 30;
        isHideSys = urlParams.get('hidesys') === "1";
        milestoneGoal.name = urlParams.get('goalname') || "Goal";
        milestoneGoal.target = parseInt(urlParams.get('goaltarget')) || 50;
        milestoneGiftFilter = urlParams.get('goalGift') || '';
        const themeFromUrl = urlParams.get('theme') || 'default';
        if (themeFromUrl !== 'default') document.body.classList.add(`theme-${themeFromUrl}`);
    }

    // ---- FILTER TYPE: tampilkan hanya elemen yang relevan ----
    const overlayType = urlParams.get('type') || 'all';
    const modulesParam = urlParams.get('modules');
    const isPreviewMode = urlParams.get('preview') === '1';

    // Jika dibuka dari tombol preview browser (bukan OBS), tampilkan background gelap
    if (isPreviewMode) {
        document.body.classList.add('preview-bg');
    }

    const allOverlayEls = {
        chat:        document.getElementById('chat-area'),
        gift:        document.getElementById('gift-area'),
        leaderboard: document.getElementById('leaderboard-container'),
        milestone:   document.getElementById('milestone-container'),
        marquee:     document.getElementById('marquee-container'),
        hype:        document.getElementById('hype-alert-container'),
        spotify:     document.getElementById('spotify-widget'),
        poll:        document.getElementById('poll-container'),
        sosmed:      document.getElementById('socmed-container'),
        welcome:     document.getElementById('hype-alert-container'), 
        highlight:   document.getElementById('pinned-chat-container')
    };

    if (overlayType !== 'all') {
        // Mode Single Module: Sembunyikan semua kecuali tipe yang dipilih
        Object.values(allOverlayEls).forEach(el => { if(el) el.style.display = 'none'; });
        const target = allOverlayEls[overlayType];
        if (target) {
            target.style.display = (overlayType === 'chat' || overlayType === 'gift') ? 'flex' : 'block';
            if (overlayType === 'marquee') target.style.display = 'block';
        }
    } else {
        // Mode All In 1: Hormati parameter modules jika ada
        if (modulesParam) {
            const allowed = modulesParam.split(',');
            Object.keys(allOverlayEls).forEach(key => {
                const el = allOverlayEls[key];
                if (!el) return;
                
                if (allowed.includes(key)) {
                    el.style.display = (key === 'chat' || key === 'gift') ? 'flex' : 'block';
                    // Apply global animations (Rainbow)
                    const inner = el.querySelector('.socmed-inner, .game-inner, #pinned-chat-content');
                    if (inner && urlParams.get('rainbow') === 'true') {
                        inner.classList.add('rainbow-active');
                    }
                } else {
                    el.style.display = 'none';
                }
            });
        } else {
            // Default All In 1 behavior (Chat, Gift, Milestone, Marquee, Hype)
            if (allOverlayEls.chat) allOverlayEls.chat.style.display = 'flex';
            if (allOverlayEls.gift) allOverlayEls.gift.style.display = 'flex';
            if (allOverlayEls.milestone) allOverlayEls.milestone.style.display = 'block';
            if (allOverlayEls.marquee) allOverlayEls.marquee.style.display = 'block';
            if (allOverlayEls.hype) allOverlayEls.hype.style.display = 'block';
        }
    }

    // Terapkan Marquee Teks dari URL
    const paramMarquee = urlParams.get('marquee');
    if (paramMarquee) {
        const mqInner = document.getElementById('marquee-inner-text');
        if (mqInner) mqInner.innerText = paramMarquee;
    }

    socket.emit('set-username', { username: activeRoom, sessionId: currentSessionId, ttTargetIdc: currentIdc });
    updateMilestoneUI();

    // 🔄 Fetch global settings saat overlay pertama load (biar sosmed langsung jalan)
    fetch('/api/settings')
        .then(r => r.json())
        .then(s => {
            if (s.socMedConfig) startSocMedCycle(s.socMedConfig);
        })
        .catch(e => console.warn('[Overlay] Gagal fetch settings:', e));
} else {
    // Mode Dashboard: Pastikan overlay disembunyikan total
    if (document.getElementById('overlay-container')) {
        document.getElementById('overlay-container').style.display = "none";
    }
}

// ================= LOGIKA DASHBOARD (CONTROLLER) =================

// 2. LOGIKA HUBUNGKAN (DIATUR VIA KLIK / ENTER DI HTML)
if (connectBtn) {
    connectBtn.addEventListener('click', () => {
        let user = usernameInput.value.trim();
        if (user.startsWith('@')) user = user.substring(1);
        const sid = sessionInput ? sessionInput.value.trim() : "";
        const idc = idcInput ? idcInput.value.trim() : "";
        
        if(!user) return;

        // 3. SAVE DATA SAAT BERHASIL/MENCOBA KONEK/STOP RE-LOGIN
        localStorage.setItem('tiktok_username', user);
        localStorage.setItem('tiktok_session', sid);
        localStorage.setItem('tiktok_idc', idc);

        activeRoom = user.toLowerCase();
        currentSessionId = sid;

        socket.emit('set-username', { username: activeRoom, sessionId: currentSessionId, ttTargetIdc: idc });
        statusText.innerText = "🚀 Menghubungkan ke TikTok...";
        statusText.style.color = "#00f2fe";
    });
}

if (skipBtn) {
    skipBtn.addEventListener('click', () => {
        setupPanel.style.display = "none";
        if (dashboardWrapper) dashboardWrapper.style.display = "flex";
        
        let user = usernameInput.value.trim();
        if (user.startsWith('@')) user = user.substring(1);
        
        activeRoom = user || "offline";
        dashTarget.innerText = user ? `Mode Konfigurasi: @${user}` : `Mode Konfigurasi (Tanpa User)`;
        
        renderCmdList();
        updateObsLink();
        
        showToast("Masuk dalam mode konfigurasi offline", "info");
    });
}

if (btnDisconnect) {
    btnDisconnect.addEventListener('click', () => {
        if (!activeRoom) return;
        socket.emit('leave-stream', { room: activeRoom });
        statusText.innerText = "🛑 Memutuskan koneksi...";
        statusText.style.color = "#ff4757";
    });
}

socket.on('tiktok-connected', (user) => {
    if (userFromUrl) return;
    activeRoom = user;
    setupPanel.style.display = "none";
    
    if (dashboardWrapper) {
        dashboardWrapper.style.display = "flex";
    } else {
        dashboardPanel.style.display = "block";
    }

    dashTarget.innerText = `Remote Control: @${user}`;
    
    if(dashSession) dashSession.value = currentSessionId;
    
    renderCmdList();
    updateObsLink();
});

socket.on('tiktok-error', (err) => {
    console.error("TikTok Error:", err);
    statusText.innerText = err;
    statusText.style.color = "#ff4757";
    addDebugLog(`❌ ERROR: ${err}`); // Tampilkan detail error di textarea Debug Log
    if (!userFromUrl) {
        setTimeout(() => {
            setupPanel.style.display = "block";
            if (dashboardWrapper) dashboardWrapper.style.display = "none";
        }, 3000);
    }
});

socket.on('tiktok-disconnected', (msg) => {
    console.log("TikTok Disconnected:", msg);
    statusText.innerText = msg || "Koneksi Terputus.";
    statusText.style.color = "#ffd700";
    if (!userFromUrl) {
        activeRoom = null;
        // Bersihkan list chat
        if (dashChatList) dashChatList.innerHTML = '<p style="color:#666; font-size:12px;">Koneksi terputus.</p>';
        setTimeout(() => {
            setupPanel.style.display = "block";
            if (dashboardWrapper) dashboardWrapper.style.display = "none";
        }, 2000);
    }
});

// Update Settings Real-time
const controls = [dashLimit, dashTheme, dashHideSys, dashGoalName, dashGoalTarget, dashGoalGift, dashSfxEnabled, dashTtsEnabled, dashTtsChatEnabled, dashTtsFollowEnabled, dashTtsJoinEnabled, dashTtsVoice, dashSession, dashMarqueeText, dashEmojiRainEnabled, dashEmojiRainCustom, dashMediaGift];
controls.forEach(el => {
    if(!el) return;
    el.addEventListener('input', () => {
        if (el === dashSession) currentSessionId = el.value.trim();
        if (el === dashTheme) applyThemeToDashboard(el.value);
        if (el === dashTtsVoice) currentTtsVoiceName = el.value;
        if (el === dashEmojiRainEnabled) emojiRainEnabled = el.checked;

        if (el === dashEmojiRainCustom) emojiRainCustom = el.value.trim();
        if (el === dashMediaGift) mediaShareGift = el.value;
        sendSettingsToServer();
        updateObsLink();
    });
});


// Tombol reset counter milestone
const btnResetMilestone = document.getElementById('btn-reset-milestone');
if (btnResetMilestone) {
    btnResetMilestone.addEventListener('click', () => {
        milestoneGoal.current = 0;
        updateMilestoneUI();
        // Broadcast reset ke semua overlay di room
        socket.emit('settings-update', { room: activeRoom, settings: { milestoneReset: true } });
        btnResetMilestone.innerText = "✔ Reset!";
        setTimeout(() => btnResetMilestone.innerText = "🔄 Reset Counter Milestone (ke 0)", 2000);
    });
}


// Logika sound preset
if (dashSoundPreset) {
    dashSoundPreset.addEventListener('change', () => {
        const val = dashSoundPreset.value;
        const customWrapper = document.getElementById('sound-custom-wrapper');
        if (val === 'custom') {
            customWrapper.style.display = 'flex';
        } else {
            customWrapper.style.display = 'none';
            changeSoundTo(val);
            // Preview bunyi saat pilih preset
            alertSound.currentTime = 0;
            alertSound.play().catch(() => {});
        }
    });
}
if (dashSoundUrl) {
    dashSoundUrl.addEventListener('change', () => {
        const url = dashSoundUrl.value.trim();
        if (url) changeSoundTo(url);
    });
}
if (dashSoundFile && btnUploadSound) {
    dashSoundFile.addEventListener('change', () => {
        if (dashSoundFile.files.length > 0) btnUploadSound.style.display = 'block';
        else btnUploadSound.style.display = 'none';
    });

    btnUploadSound.addEventListener('click', async () => {
        const file = dashSoundFile.files[0];
        if (!file) return;

        btnUploadSound.innerText = "⏳...";
        btnUploadSound.disabled = true;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const fileData = e.target.result;
            try {
                const res = await fetch('/upload-sound', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileData, fileName: file.name })
                });
                const data = await res.json();
                if (data.url) {
                    dashSoundUrl.value = data.url;
                    changeSoundTo(data.url);
                    btnUploadSound.innerText = "✔ OK";
                    btnUploadSound.style.background = "#30d158";
                    setTimeout(() => {
                        btnUploadSound.innerText = "Upload";
                        btnUploadSound.style.background = "#00f2fe";
                        btnUploadSound.style.display = "none";
                        btnUploadSound.disabled = false;
                        dashSoundFile.value = "";
                    }, 2000);
                }
            } catch (err) {
                console.error("Upload failed", err);
                alert("Gagal mengunggah file. Pastikan server nyala.");
                btnUploadSound.innerText = "Upload";
                btnUploadSound.disabled = false;
            }
        };
        reader.readAsDataURL(file);
    });
}

// ================= LOGIKA EVENT DASHBOARD (GAMES & BOT) =================
if (btnTogglePoll) {
    btnTogglePoll.addEventListener('click', () => {
        pollActive = !pollActive;
        if (pollActive) {
            btnTogglePoll.innerText = "⏹️ Stop Polling";
            btnTogglePoll.style.background = "#ff4757";
            btnTogglePoll.style.color = "#fff";
            socket.emit('settings-update', { room: activeRoom, settings: { pollReset: true } });
        } else {
            btnTogglePoll.innerText = "▶️ Mulai Polling";
            btnTogglePoll.style.background = "#00f2fe";
            btnTogglePoll.style.color = "#000";
        }
        updateObsLink();
    });
}

if (btnAddCmd) {
    btnAddCmd.addEventListener('click', () => {
        const k = dashCmdKey.value.trim();
        const v = dashCmdVal.value.trim();
        if (k && v) {
            botCmds.push({ key: k, val: v });
            dashCmdKey.value = ""; dashCmdVal.value = "";
            renderCmdList();
            updateObsLink();
            sendSettingsToServer(); // Sinkronkan ke server & overlay
        }
    });
}

function renderCmdList() {
    if (!cmdListContainer) return;
    cmdListContainer.innerHTML = "";
    botCmds.forEach((cmd, i) => {
        const d = document.createElement('div');
        d.style = "display:flex; justify-content:space-between; margin-bottom:5px; border-bottom:1px solid #444; padding-bottom:5px; word-break:break-all; align-items:center;";

        const left = document.createElement('div');
        left.innerHTML = `<span style="color:#00f2fe; font-weight:bold;">${cmd.key}</span>: <span style="color:#aaa;">${cmd.val}</span>`;
        d.appendChild(left);

        const btnDel = document.createElement('button');
        btnDel.innerText = "×";
        btnDel.style = "background:none; border:none; color:red; cursor:pointer; font-size:16px; font-weight:bold; padding:0 5px;";
        btnDel.onclick = () => {
            botCmds.splice(i, 1);
            renderCmdList();
            updateObsLink();
            sendSettingsToServer();
        };
        d.appendChild(btnDel);
        cmdListContainer.appendChild(d);
    });
}

// ================= LIVE STATS & HYPE ALERT LOGIC =================
socket.on('stream-stats', (stats) => {
    // Update Dashboard UI
    const elLikes = document.getElementById('stat-likes');
    const elFollows = document.getElementById('stat-follows');
    const elShares = document.getElementById('stat-shares');
    const elViewers = document.getElementById('stat-viewers');

    if (elLikes) elLikes.innerText = stats.likes.toLocaleString();
    if (elFollows) elFollows.innerText = stats.follows.toLocaleString();
    if (elShares) elShares.innerText = stats.shares.toLocaleString();
    if (elViewers) elViewers.innerText = stats.viewers.toLocaleString();

    // Hype Milestone Logic (ONLY for Overlay mode)
    if (userFromUrl) {
        checkHypeMilestones(stats);
    }
});

function checkHypeMilestones(stats) {
    // Likes Milestone (Every 1000)
    const currentLikeMilestone = Math.floor(stats.likes / 1000);
    if (currentLikeMilestone > reachedMilestones.likes && stats.likes > 0) {
        reachedMilestones.likes = currentLikeMilestone;
        triggerHypeAlert(`Luar Biasa! ✨`, `${stats.likes.toLocaleString()} Likes tercapai!`);
    }

    // Follows Milestone (Every 10)
    const currentFollowMilestone = Math.floor(stats.follows / 10);
    if (currentFollowMilestone > reachedMilestones.follows && stats.follows > 0) {
        reachedMilestones.follows = currentFollowMilestone;
        triggerHypeAlert(`Keluarga Baru! 👥`, `${stats.follows.toLocaleString()} Follower baru bergabung!`);
    }

    // Shares Milestone (Every 5)
    const currentShareMilestone = Math.floor(stats.shares / 5);
    if (currentShareMilestone > reachedMilestones.shares && stats.shares > 0) {
        reachedMilestones.shares = currentShareMilestone;
        triggerHypeAlert(`Makin Rame! 🔄`, `Live sudah di-share ${stats.shares.toLocaleString()} kali!`);
    }
}

window.triggerHypeAlert = function(title, subtitle) {
    const container = document.getElementById('hype-alert-container');
    if (!container) return;
    container.innerHTML = `
        <div style="background: linear-gradient(135deg, rgba(0, 242, 254, 0.95), rgba(92, 0, 210, 0.95)); 
                    padding: 30px 50px; border-radius: 30px; border: 3px solid #fff; 
                    box-shadow: 0 0 50px rgba(0, 242, 254, 0.5); 
                    animation: popUpIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                    position: relative;">
            <div style="font-size: 38px; font-weight: 900; color: #fff; text-shadow: 0 0 10px rgba(0,0,0,0.5);">${title}</div>
            <div style="font-size: 18px; font-weight: 700; color: #ffea00; margin-top: 5px;">${subtitle}</div>
            <div style="position:absolute; top:-20px; right:-20px; font-size:40px;">🎊</div>
            <div style="position:absolute; bottom:-10px; left:-20px; font-size:40px;">⚡</div>
        </div>
    `;
    container.style.display = 'block';
    if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#00f2fe', '#ff0050', '#ffea00', '#1DB954'] });
    if (sfxEnabled) { alertSound.currentTime = 0; alertSound.play().catch(() => {}); }
    setTimeout(() => {
        container.style.animation = 'popUpOut 0.5s ease-in forwards';
        setTimeout(() => { container.style.display = 'none'; container.innerHTML = ''; }, 500);
    }, 4500);
}

const btnTestHype = document.getElementById('btn-test-hype');
if (btnTestHype) {
    btnTestHype.addEventListener('click', () => {
        const room = activeRoom || 'offline';
        socket.emit('settings-update', { 
            room: room, 
            settings: { triggerHypeDemo: true } 
        });
        
        // Tampilkan juga secara lokal di Dashboard agar user tahu animasinya jalan
        triggerHypeAlert("Hype Demo (Lokal)! 🚀", "Mencoba animasi achievement baru...");
        showToast("Hype Alert Demo dikirim!", "success");
    });
}

const hypeStyle = document.createElement('style');
hypeStyle.innerHTML = `
    @keyframes popUpIn {
        0% { opacity: 0; transform: scale(0.5) translateY(50px); filter: blur(10px); }
        100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
    }
    @keyframes popUpOut {
        0% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.2); filter: blur(10px); }
    }
`;
document.head.appendChild(hypeStyle);

if (dashMediaFile && btnUploadMedia) {
    dashMediaFile.addEventListener('change', () => {
        btnUploadMedia.style.display = dashMediaFile.files.length > 0 ? 'block' : 'none';
    });

    btnUploadMedia.addEventListener('click', () => {
        const file = dashMediaFile.files[0];
        if (!file) return;
        if (file.size > 40 * 1024 * 1024) {
            txtMediaStatus.innerText = "⚠️ Ukuran file maksimal 40MB";
            return;
        }

        btnUploadMedia.innerText = "⏳ Uploading...";
        btnUploadMedia.disabled = true;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const res = await fetch('/upload-media', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileData: e.target.result, fileName: file.name })
                });
                const data = await res.json();
                if (data.url) {
                    mediaShareUrl = data.url;
                    txtMediaStatus.innerText = "✅ Media siap digunakan! Buka Overlay untuk testing.";
                    updateObsLink();
                    socket.emit('settings-update', { room: activeRoom, settings: { triggerMediaPreview: true, mediaUrl: mediaShareUrl } });
                } else {
                    txtMediaStatus.innerText = "❌ Gagal: " + (data.error || 'Server error');
                }
            } catch (err) {
                txtMediaStatus.innerText = "❌ Error upload";
            }
            btnUploadMedia.innerText = "Upload Media Jumpscare";
            btnUploadMedia.disabled = false;
        };
        reader.readAsDataURL(file);
    });
}

function applyThemeToDashboard(theme) {
    const chatList = document.getElementById('dash-chat-list');
    if (!chatList) return;
    // Hapus semua class tema lama
    chatList.className = '';
    chatList.classList.add('dash-preview-' + theme);
}

function sendSettingsToServer(withToast = false) {
    if (!activeRoom) {
        if (withToast) showToast('Gagal: Hubungkan ke TikTok dulu!', 'error');
        return;
    }
    const settings = {
        limit: dashLimit ? (parseInt(dashLimit.value) || 30) : 30,
        theme: dashTheme ? dashTheme.value : 'default',
        hideSys: dashHideSys ? dashHideSys.checked : false,
        goalName: dashGoalName ? dashGoalName.value : 'Goal',
        goalTarget: dashGoalTarget ? (parseInt(dashGoalTarget.value) || 50) : 50,
        goalGift: dashGoalGift ? dashGoalGift.value : "",
        sfx: dashSfxEnabled ? dashSfxEnabled.checked : true,
        tts: dashTtsEnabled ? dashTtsEnabled.checked : false,
        ttsChat: dashTtsChatEnabled ? dashTtsChatEnabled.checked : false,
        ttsFollow: dashTtsFollowEnabled ? dashTtsFollowEnabled.checked : false,
        ttsJoin: dashTtsJoinEnabled ? dashTtsJoinEnabled.checked : false,
        marqueeText: dashMarqueeText ? dashMarqueeText.value : "",
        emojiRain: dashEmojiRainEnabled ? dashEmojiRainEnabled.checked : true,
        emojiRainCustom: dashEmojiRainCustom ? dashEmojiRainCustom.value : "",
        pollActive: pollActive,
        pollQuestion: dashPollQuestion ? dashPollQuestion.value : "Target Goal",
        pollA: dashPollA ? dashPollA.value : "A",
        pollKeyA: dashPollKeyA ? dashPollKeyA.value : "1",
        pollB: dashPollB ? dashPollB.value : "B",
        pollKeyB: dashPollKeyB ? dashPollKeyB.value : "2",
        botCmds: botCmds,
        mediaGift: dashMediaGift ? dashMediaGift.value : "",
        mediaUrl: mediaShareUrl,
        soundUrl: dashSoundUrl ? dashSoundUrl.value : "",
        spotifyEnabled: spotifyEnabled,
        spotifyGlow: dashSpotifyGlow ? dashSpotifyGlow.checked : true,
        ttsVoiceName: dashTtsVoice ? dashTtsVoice.value : ""
    };
    socket.emit('settings-update', { room: activeRoom, settings });
    if (withToast) showToast('Pengaturan berhasil disimpan!', 'success');
}

// Global Save Button Listener
const btnSaveTampilan = document.getElementById('btn-save-tampilan');
if (btnSaveTampilan) {
    btnSaveTampilan.addEventListener('click', () => {
        sendSettingsToServer(true);
        updateObsLink();
    });
}

// Spotify Glow Listener
if (dashSpotifyGlow) {
    dashSpotifyGlow.addEventListener('change', () => {
        sendSettingsToServer();
    });
}

// Spotify Configuration Save
if (btnSaveSpotify) {
    btnSaveSpotify.addEventListener('click', async () => {
        const clientId = spotifyClientId.value.trim();
        const clientSecret = spotifyClientSecret.value.trim();
        if (!clientId || !clientSecret) return alert("Isi Client ID & Secret dulu!");

        btnSaveSpotify.innerText = "⏳ Menyimpan...";
        btnSaveSpotify.disabled = true;

        try {
            const res = await fetch('/api/spotify/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, clientSecret })
            });
            const data = await res.json();
            if (data.success) {
                spotifyAuthSection.style.display = 'block';
                btnSaveSpotify.innerText = "✅ TERSIMPAN";
                btnSaveSpotify.style.background = "#444";
                btnSaveSpotify.disabled = false;
                // Simpan ke localStorage juga sebagai backup
                localStorage.setItem('spotify_client_id', clientId);
            }
        } catch (e) {
            alert("Gagal konek ke server!");
            btnSaveSpotify.innerText = "💾 SIMPAN & AKTIFKAN";
            btnSaveSpotify.disabled = false;
        }
    });
}

// Spotify Logout Listener
// Spotify Logout Listener
window.logoutSpotify = async function() {
    const btn = document.getElementById('btn-logout-spotify');
    if (btn) btn.innerText = "⏳ Loging out...";
    try {
        await fetch('/api/spotify/logout', { method: 'POST' });
        location.reload(); 
    } catch(e) {
        if (btn) btn.innerText = "🔴 DISCONNECT SPOTIFY";
    }
};

// Auto-load Spotify config tersimpan saat halaman dibuka
(async () => {
    try {
        const res = await fetch('/api/spotify/config');
        const data = await res.json();
        if (data.clientId && spotifyClientId) {
            spotifyClientId.value = data.clientId;
        }
        if (data.clientSecret && spotifyClientSecret) {
            spotifyClientSecret.value = data.clientSecret;
        }
        if (data.clientId && data.clientSecret) {
            // Config sudah ada, tampilkan tombol Connect langsung
            if (spotifyAuthSection) spotifyAuthSection.style.display = 'block';
            if (btnSaveSpotify) {
                btnSaveSpotify.innerText = "✅ TERSIMPAN";
                btnSaveSpotify.style.background = "#444";
            }
        }
        if (data.isConnected) {
            // Sudah login Spotify juga
            if (btnSaveSpotify) {
                btnSaveSpotify.innerText = "✅ TERHUBUNG KE SPOTIFY";
                btnSaveSpotify.style.background = "#1DB954";
            }
            if (btnLogoutSpotify) btnLogoutSpotify.style.display = "block";
        }
    } catch(e) {
        // Gagal load config, biarkan form kosong
    }
})();

// Handle Hash Feedback
window.addEventListener('hashchange', () => {
    if (window.location.hash === '#spotify-success') {
        alert("✅ Spotify Berhasil Terhubung!");
        window.location.hash = "";
    } else if (window.location.hash === '#spotify-error') {
        alert("❌ Gagal Menghubungkan Spotify. Cek Client ID/Secret Anda.");
        window.location.hash = "";
    }
});
if (window.location.hash.startsWith('#spotify')) window.dispatchEvent(new Event('hashchange'));

window.toggleAllModules = function(checked) {
    document.querySelectorAll('.mod-chk').forEach(chk => {
        chk.checked = checked;
    });
    updateObsLink();
}

function updateObsLink() {
    const userVal = activeRoom || (usernameInput ? usernameInput.value.trim() : "");
    if (!userVal) {
        // Jika benar-benar kosong, baru return (sembunyikan)
        document.querySelectorAll('.obs-link-input').forEach(el => el.value = "");
        return;
    }
    let urlProtocolStr = window.location.protocol;
    let urlHostStr = window.location.host;
    
    if (urlHostStr.includes('localhost')) {
        urlHostStr = urlHostStr.replace('localhost', '127.0.0.1');
    }
    
    let origin = urlProtocolStr + "//" + urlHostStr + window.location.pathname;
    
    const settingsObj = {
        limit: dashLimit ? dashLimit.value : 30,
        hideSys: dashHideSys ? dashHideSys.checked : false,
        theme: dashTheme ? dashTheme.value : 'default',
        goalName: dashGoalName ? dashGoalName.value : 'Goal',
        goalTarget: dashGoalTarget ? dashGoalTarget.value : 50,
        goalGift: dashGoalGift ? dashGoalGift.value : '',
        marqueeText: dashMarqueeText ? dashMarqueeText.value : '',
        emojiRain: dashEmojiRainEnabled ? dashEmojiRainEnabled.checked : true,
        emojiRainCustom: dashEmojiRainCustom ? dashEmojiRainCustom.value : "",
        pollActive: pollActive,
        pollQuestion: dashPollQuestion ? dashPollQuestion.value : "Target Goal",
        pollA: dashPollA ? dashPollA.value : "A",
        pollKeyA: dashPollKeyA ? dashPollKeyA.value : "1",
        pollB: dashPollB ? dashPollB.value : "B",
        pollKeyB: dashPollKeyB ? dashPollKeyB.value : "2",
        botCmds: botCmds,
        mediaGift: dashMediaGift ? dashMediaGift.value : "",
        mediaUrl: mediaShareUrl,
        soundUrl: dashSoundUrl ? dashSoundUrl.value : "",
        rainbow: dashRainbowEnabled ? dashRainbowEnabled.checked : false
    };
    
    const b64Settings = btoa(unescape(encodeURIComponent(JSON.stringify(settingsObj))));
    const currentIdc = dashIdc ? dashIdc.value.trim() : "";
    const currentSid = currentSessionId || '';
    
    let base = `${origin}?user=${userVal}&d=${b64Settings}`;
    if (currentSid) base += `&sid=${currentSid}`;
    if (currentIdc) base += `&idc=${currentIdc}`;

    const types = ['chat', 'gift', 'leaderboard', 'milestone', 'marquee', 'interactive', 'sosmed', 'feed', 'welcome'];
    types.forEach(t => {
        const el = document.getElementById(`obs-link-${t}`);
        if(el) el.value = `${base}&type=${t}`;
    });
    
    const linkSpotify = document.getElementById('obs-link-spotify');
    if (linkSpotify) linkSpotify.value = `${base}&type=spotify`;

    const linkAll = document.getElementById('obs-link-all');
    if (linkAll) {
        // Build modular param
        const selectedModules = Array.from(document.querySelectorAll('.mod-chk:checked')).map(chk => chk.value);
        if (selectedModules.length > 0) {
            let modulesLink = `${base}&type=all&modules=${selectedModules.join(',')}`;
            if (dashRainbowEnabled && dashRainbowEnabled.checked) modulesLink += `&rainbow=true`;
            linkAll.value = modulesLink;
        } else {
            linkAll.value = `${base}&type=all`; // Default all
        }
    }
}

function initGlobalSettings() {
    fetch('/api/settings')
        .then(res => res.json())
        .then(settings => {
            if (settings) {
                if (dashTheme) dashTheme.value = settings.theme || 'default';
                if (dashLimit) dashLimit.value = settings.limit || 20;
                if (dashHideSys) dashHideSys.checked = settings.hideSys || false;
                if (dashSfx) dashSfx.checked = settings.sfx !== undefined ? settings.sfx : true;
                if (dashTts) dashTts.checked = settings.tts !== undefined ? settings.tts : true;
                if (dashTtsChat) dashTtsChat.checked = settings.ttsChat || false;
                if (dashTtsFollow) dashTtsFollow.checked = settings.ttsFollow !== undefined ? settings.ttsFollow : true;
                if (dashTtsJoin) dashTtsJoin.checked = settings.ttsJoin !== undefined ? settings.ttsJoin : true;
                if (dashGoalName) dashGoalName.value = settings.goalName || 'GIFT GOAL';
                if (dashGoalTarget) dashGoalTarget.value = settings.goalTarget || 100;
                if (dashGoalGift) dashGoalGift.value = settings.goalGift || '';
                if (dashMarqueeText) dashMarqueeText.value = settings.marqueeText || '';
                if (dashEmojiRainEnabled) dashEmojiRainEnabled.checked = settings.emojiRain !== undefined ? settings.emojiRain : true;
                if (dashEmojiRainCustom) dashEmojiRainCustom.value = settings.emojiRainCustom || '';
                if (dashPollQuestion) dashPollQuestion.value = settings.pollQuestion || '';
                if (dashPollA) dashPollA.value = settings.pollA || '';
                if (dashPollKeyA) dashPollKeyA.value = settings.pollKeyA || '1';
                if (dashPollB) dashPollB.value = settings.pollB || '';
                if (dashPollKeyB) dashPollKeyB.value = settings.pollKeyB || '2';
                if (dashMediaGift) dashMediaGift.value = settings.mediaGift || '';
                if (dashMediaUrl) dashMediaUrl.value = settings.mediaUrl || '';
                if (dashSpotifyGlow) dashSpotifyGlow.checked = settings.spotifyGlow !== undefined ? settings.spotifyGlow : true;
                
                botCmds = settings.botCmds || [];
                renderCmdList();

                chatLimit = settings.limit;
                isHideSys = settings.hideSys;
                sfxEnabled = settings.sfx;
                ttsEnabled = settings.tts;
                spotifyGlow = settings.spotifyGlow !== undefined ? settings.spotifyGlow : true;
            }
        });
}
initGlobalSettings();

// Tab Switcher
window.switchTab = (tabId, btn) => {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    if (btn) btn.classList.add('active');
};

if (btnTestAlert) {
    btnTestAlert.addEventListener('click', () => {
        // Putar di sini dulu biar user tahu link-nya ganti
        alertSound.currentTime = 0;
        alertSound.play().then(() => {
            btnTestAlert.innerText = "🔊 Playing...";
            setTimeout(() => btnTestAlert.innerText = "🔊 Test Sound Alert", 2000);
        }).catch(err => {
            console.error("Audio Play Error:", err);
            statusText.innerText = "Klik dulu di mana saja untuk aktifkan suara!";
            statusText.style.color = "red";
        });

        // Kirim sinyal ke OBS
        socket.emit('settings-update', { room: activeRoom, settings: { triggerTest: true } });
    });
}

// ================= LOGIKA OVERLAY (REAKTIF) =================

socket.on('settings-updated', (settings) => {
    if (settings.triggerTest) {
        alertSound.play();
        if (typeof spawnEmojiRain === 'function') spawnEmojiRain('🎁', true); 
        
        // Munculkan popup gift contoh saat Testing
        showGiftAlert({
            nickname: 'PENONTON TEST',
            giftName: 'Mawar',
            repeatCount: 1,
            giftPictureUrl: 'https://p16-va.lemon8cdn.com/obj/tos-alisg-v-a3e477-sg/ob3AHzEn9DIf8A2fEIIDAgB4IEA2fEIDggIAAA'
        });
        return;
    }
    if (settings.pollReset) {
        pollVotesA = 0; pollVotesB = 0;
        updatePollUI();
        return;
    }
    if (settings.triggerMediaPreview) {
        triggerMediaShare(settings.mediaUrl);
        return;
    }
    if (settings.milestoneReset) {
        milestoneGoal.current = 0;
        updateMilestoneUI();
        return;
    }

    chatLimit = settings.limit;
    isHideSys = settings.hideSys;
    sfxEnabled = settings.sfx;
    ttsEnabled = settings.tts;
    if (settings.ttsChat !== undefined) ttsChatEnabled = settings.ttsChat;
    if (settings.ttsFollow !== undefined) ttsFollowEnabled = settings.ttsFollow;
    if (settings.ttsJoin !== undefined) ttsJoinEnabled = settings.ttsJoin;
    if (settings.ttsVoiceName !== undefined) {
        currentTtsVoiceName = settings.ttsVoiceName;
        if (dashTtsVoice) dashTtsVoice.value = currentTtsVoiceName;
    }
    milestoneGoal.name = settings.goalName;
    milestoneGoal.target = settings.goalTarget;
    if (settings.goalGift !== undefined) milestoneGiftFilter = settings.goalGift || '';
    if (settings.marqueeText !== undefined) {
        const mqInner = document.getElementById('marquee-inner-text');
        if (mqInner) mqInner.innerText = settings.marqueeText;
    }

    // Tangkap perintah Pin Chat
    if (settings.triggerPin && settings.pinData) {
        showPinnedChat(settings.pinData);
        return; // Jangan jalankan update tema dsb
    }

    if (settings.emojiRain !== undefined) emojiRainEnabled = settings.emojiRain;
    if (settings.emojiRainCustom !== undefined) {
        emojiRainCustom = settings.emojiRainCustom;
        if (dashEmojiRainCustom) dashEmojiRainCustom.value = emojiRainCustom;
    }
    if (settings.pollActive !== undefined) pollActive = settings.pollActive;
    if (settings.pollQuestion !== undefined) pollQuestion = settings.pollQuestion;
    if (settings.pollA !== undefined) pollNameA = settings.pollA;
    if (settings.pollKeyA !== undefined) pollKeyA = settings.pollKeyA;
    if (settings.pollB !== undefined) pollNameB = settings.pollB;
    if (settings.pollKeyB !== undefined) pollKeyB = settings.pollKeyB;
    if (settings.botCmds !== undefined) {
        botCmds = settings.botCmds;
        renderCmdList(); // Update UI di dashboard lain/overlay jika ada update
    }
    if (settings.mediaGift !== undefined) mediaShareGift = settings.mediaGift;
    if (settings.mediaUrl !== undefined) mediaShareUrl = settings.mediaUrl;
    
    if (settings.soundUrl !== undefined) {
        changeSoundTo(settings.soundUrl);
        if (dashSoundUrl) dashSoundUrl.value = settings.soundUrl;
    }

    if (settings.spotifyEnabled !== undefined) spotifyEnabled = settings.spotifyEnabled;
    if (settings.spotifyGlow !== undefined) {
        spotifyGlow = settings.spotifyGlow;
        if (spotifyWidget) {
            if (spotifyGlow) spotifyWidget.classList.add('glow-active');
            else spotifyWidget.classList.remove('glow-active');
        }
    }
    
    updatePollUI();

    // Hanya apply tema jika ini mode OVERLAY (OBS), bukan dashboard
    if (userFromUrl) {
        document.body.className = document.body.className
            .split(' ')
            .filter(c => !c.startsWith('theme-'))
            .join(' ');
        if (settings.theme && settings.theme !== 'default') {
            document.body.classList.add(`theme-${settings.theme}`);
        }
    }

    updateMilestoneUI();

    if (settings.triggerHypeDemo && userFromUrl) {
        triggerHypeAlert("Hype Demo Aktif! 🚀", "Mencoba animasi achievement baru...");
    }

    if (settings.triggerHighlight && userFromUrl) {
        showHighlight(settings.highlightData);
    }

    if (settings.triggerGame && userFromUrl) {
        startTypingGame(settings.gameWord);
    }

    if (settings.socMedConfig && userFromUrl) {
        startSocMedCycle(settings.socMedConfig);
    }
});

// ================= LOGIKA EMOJI RAIN =================
function spawnEmojiRain(pictureUrl, force = false) {
    // Hanya buat hujan kalau ini mode OVERLAY (OBS), atau DIPAKSA (untuk Testing di Dashboard)
    if (!userFromUrl && !force) return;

    const urlParams = new URLSearchParams(window.location.search);
    const oType = urlParams.get('type') || 'all';
    
    // Jangan filter tipe kalau sedang testing (force)
    if (!force && oType !== 'all' && oType !== 'interactive' && oType !== 'gift') return;

    const customEmojis = emojiRainCustom ? emojiRainCustom.split(/[,|\s]+/).filter(x => x.trim()) : [];

    for (let i = 0; i < 20; i++) {
        const el = document.createElement('div');
        
        if (customEmojis.length > 0) {
            // Gunakan emoji kustom acak dari list
            const randEmoji = customEmojis[Math.floor(Math.random() * customEmojis.length)];
            el.innerText = randEmoji;
        } else if (pictureUrl && pictureUrl.startsWith('http')) {
            // Default: Gunakan gambar gift
            el.innerHTML = `<img src="${pictureUrl}" style="width:100%; height:100%; object-fit:contain;">`;
        } else {
            el.innerText = '🎁';
        }
        
        document.body.appendChild(el);
        
        const size = Math.random() * 30 + 30; // 30-60px
        const left = Math.random() * 100;
        const delay = Math.random() * 1.5;
        const duration = Math.random() * 2 + 3; // 3-5 seconds
        
        el.style.position = 'fixed';
        el.style.left = left + 'vw';
        el.style.top = '-80px';
        el.style.width = size + 'px';
        el.style.height = size + 'px';
        el.style.fontSize = size + 'px';
        el.style.zIndex = 99999;
        el.style.pointerEvents = 'none';
        el.style.color = '#fff';
        el.style.textShadow = '0 0 10px rgba(0,0,0,0.5), 2px 2px 5px rgba(0,0,0,0.8)';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        
        el.animate([
            { transform: 'translateY(0) rotate(0deg)' },
            { transform: `translateY(110vh) rotate(${Math.random()*360}deg)` }
        ], {
            duration: duration * 1000,
            delay: delay * 1000,
            fill: 'forwards',
            easing: 'linear'
        });
        
        setTimeout(() => { if (el.parentElement) el.parentElement.removeChild(el); }, 6000);
    }
}

// ================= LOGIKA OVERLAY MEDIA SHARE (JUMPSCARE) =================
function triggerMediaShare(url) {
    const urlParams = new URLSearchParams(window.location.search);
    const oType = urlParams.get('type') || 'all';
    if (oType !== 'all' && oType !== 'interactive') return;

    const vid = document.getElementById('overlay-media-share');
    const img = document.getElementById('overlay-image-share');
    if (!vid || !img) return;
    
    if (url.match(/\.(mp4|webm)$/i)) {
        vid.src = url;
        vid.style.display = 'block';
        vid.play().catch(e => console.warn("Video autoplay blocked", e));
        vid.onended = () => { vid.style.display = 'none'; };
    } else {
        img.src = url;
        img.style.display = 'block';
        setTimeout(() => { img.style.display = 'none'; }, 5000); // GIF show for 5 seconds
    }
}

// ================= REAKSI SOCKET EVENT =================



function updateMilestoneUI() {
    if(!milestoneContainer) return;
    milestoneTitle.innerText = milestoneGoal.name;
    const pct = Math.min((milestoneGoal.current / milestoneGoal.target) * 100, 100);
    
    // Smooth update for liquid bar
    const bar = document.getElementById('milestone-progress');
    if (bar) {
        bar.style.width = pct + "%";
        // Add a "pulse" class temporarily on update
        bar.classList.add('bobbing-active');
        setTimeout(() => bar.classList.remove('bobbing-active'), 1000);
    }
    
    milestoneText.innerText = `${milestoneGoal.current} / ${milestoneGoal.target}`;
}

function updateLeaderboardUI() {
    const sorted = Object.entries(topGifters).sort((a,b) => b[1] - a[1]).slice(0, 5);
    leaderboardList.innerHTML = sorted.map(([name, score]) => `
        <div class="leader-item">
            <span class="leader-name">${name}</span>
            <span class="leader-score">${score} pts</span>
        </div>
    `).join('') || '<p style="color:#666; font-size:11px;">Belum ada sultan...</p>';
}

// ================= TIKTOK EVENTS =================

// Debug logging dihapus untuk mencegah spinner tab browser

socket.on('chat', (data) => {
    if (isDuplicateEvent('chat', data)) return;
    
    // 📊 Logika Polling
    if (pollActive) {
        const txt = data.comment.trim().toLowerCase();
        if (txt === pollKeyA.toLowerCase()) pollVotesA++;
        else if (txt === pollKeyB.toLowerCase()) pollVotesB++;
        updatePollUI();
    }

    let shouldReadChat = true;

    // 🤖 Logika Custom Bot Auto-Responder (Pake .find biar cuma 1 yang ngerespon)
    const matchedCmd = botCmds.find(cmd => data.comment.trim().toLowerCase() === cmd.key.toLowerCase());
    
    if (matchedCmd) {
        shouldReadChat = false; 
        setTimeout(() => {
            createChatBubble({ nickname: '🤖 Bot', comment: matchedCmd.val }, true);
            speakTextNative(`Jawaban Bot: ${matchedCmd.val}`);
        }, 500); 
    }

    // 🎵 Logika Song Request (!lagu)
    if (data.comment.trim().toLowerCase().startsWith('!lagu ') || data.comment.trim().toLowerCase().startsWith('!request ')) {
        const query = data.comment.split(' ').slice(1).join(' ');
        if (query) {
            addSongToQueue(data.nickname, query);
            shouldReadChat = false; 
        }
    }

    createChatBubble(data, false, !shouldReadChat);

    // 🏁 Logika Pemenang Game Ketik
    if (currentGameWord && data.comment.trim().toUpperCase() === currentGameWord) {
        // Hentikan game
        currentGameWord = ""; 
        const container = document.getElementById('typing-game-container');
        const winnerSec = document.getElementById('typing-winner-section');
        const winnerName = document.getElementById('typing-winner-name');
        
        if (container && winnerSec && winnerName) {
            winnerName.innerText = data.nickname;
            winnerSec.style.display = 'block';
            
            // Effect kembang api tipis-tipis
            if (typeof confetti === 'function') {
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            }

            setTimeout(() => {
                container.style.animation = 'popUpOut 0.5s ease-in forwards';
                setTimeout(() => { container.style.display = 'none'; }, 500);
            }, 5000);
        }
    }
});
socket.on('like', (data) => createChatBubble({ nickname: data.nickname, comment: `Telah mengirimkan ${data.likeCount} Likes!` }, true));

socket.on('member', (data) => {
    if (isDuplicateEvent('member', data)) return;
    
    createChatBubble({ nickname: data.nickname, comment: `Bergabung ke dalam Live Stream!` }, true);
    if (ttsJoinEnabled) {
        speakTextNative(`${data.nickname} bergabung di live`);
    }
    showWelcome(data);
});

socket.on('follow', (data) => {
    if (isDuplicateEvent('follow', data)) return;
    
    createChatBubble({ nickname: data.nickname, comment: `Baru saja mem-follow!` }, true);
    if (ttsFollowEnabled) {
        speakTextNative(`Terima kasih kak ${data.nickname} sudah follow`);
    }
    showWelcome(data);
});

const knownGifts = new Set();

socket.on('gift', (data) => {
    if (isDuplicateEvent('gift', data)) return;
    
    const rawGiftName = data.giftName || '';
    
    // Tambahkan otomatis ke dropdown autocomplete jika belum ada
    if (rawGiftName && !knownGifts.has(rawGiftName)) {
        knownGifts.add(rawGiftName);
        const datalist = document.getElementById('gift-names-list');
        if (datalist) {
            const option = document.createElement('option');
            option.value = rawGiftName;
            datalist.appendChild(option);
        }
    }

    // 1. Cek filter gift untuk milestone
    const giftNameLower = rawGiftName.toLowerCase();
    const filterLower = milestoneGiftFilter.toLowerCase().trim();
    const matchesFilter = !filterLower || giftNameLower.includes(filterLower);

    if (matchesFilter) {
        milestoneGoal.current += data.repeatCount;
        updateMilestoneUI();

        // 🎇 Confetti Party Effect!
        if (milestoneGoal.current >= milestoneGoal.target && !milestoneReached) {
            milestoneReached = true;
            if (typeof confetti === 'function') {
                confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 }, zIndex: 99999 });
                setTimeout(() => confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 }, zIndex: 99999 }), 600);
                setTimeout(() => confetti({ particleCount: 100, spread: 80, origin: { y: 0.7 }, zIndex: 99999 }), 1200);
            }
        }
    }


    // 2. Update Leaderboard (semua gift)
    topGifters[data.nickname] = (topGifters[data.nickname] || 0) + (data.repeatCount * 10);
    updateLeaderboardUI();

    // 3. Sound Effect & TTS
    // SFX dimainkan di OBS agar stabil
    if (userFromUrl && sfxEnabled) {
        alertSound.currentTime = 0;
        alertSound.play().catch(e => console.warn("Audio blocked:", e));
    }
    
    // TTS membaca (Ini akan otomatis difilter di dalam speakTextNative khusus dashboard)
    if (ttsEnabled) {
        speakTextNative(`Terima kasih ${data.nickname} atas ${data.giftName}`);
    }

    // 4. Visual Alert
    showGiftAlert(data);
    addToSupporterFeed(data, `MENGIRIM ${data.giftName}`);

    // ☔ 5. Emoji Rain
    if (emojiRainEnabled && userFromUrl) {
        spawnEmojiRain(data.giftPictureUrl); // Gunakan gambar gift asli sebagai partikel hujan!
    }

    // 👻 6. Media Jumpscare Share
    if (mediaShareUrl && userFromUrl && data.giftName.toLowerCase() === mediaShareGift.toLowerCase()) {
        triggerMediaShare(mediaShareUrl);
    }
});

// Duplicate follow removed.


// ================= SPOTIFY REAL-TIME UPDATE =================

function msToTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

let spotifyProgressInterval = null;
let spotifyLocalProgress = 0;
let spotifyLocalDuration = 0;
let spotifyLocalPlaying = false;

function tickSpotifyProgress() {
    if (!spotifyLocalPlaying || spotifyLocalDuration <= 0) return;
    spotifyLocalProgress = Math.min(spotifyLocalProgress + 1000, spotifyLocalDuration);
    const pct = (spotifyLocalProgress / spotifyLocalDuration) * 100;
    const fill = document.getElementById('spotify-progress-fill');
    const timeCur = document.getElementById('spotify-time-current');
    if (fill) fill.style.width = pct + '%';
    if (timeCur) timeCur.innerText = msToTime(spotifyLocalProgress);
}

socket.on('spotify-update', (data) => {
    if (!spotifyWidget) return;
    
    const urlParams2 = new URLSearchParams(window.location.search);
    const oType2 = urlParams2.get('type') || 'all';

    // Jika mode overlay spotify saja, widget tampil bar penuh di bawah
    if (oType2 === 'spotify' && spotifyWidget) {
        spotifyWidget.style.position = 'fixed';
        spotifyWidget.style.bottom = '0';
        spotifyWidget.style.left = '0';
        spotifyWidget.style.width = '100%';
        spotifyWidget.style.borderRadius = '0';
        spotifyWidget.style.maxWidth = '100%';
    }
    
    const artRing = document.getElementById('spotify-art-ring');
    const eqDiv = document.getElementById('spotify-eq');
    const timeCur = document.getElementById('spotify-time-current');
    const timeTotal = document.getElementById('spotify-time-total');
    const progressFill = document.getElementById('spotify-progress-fill');

    if (data && data.isPlaying && spotifyEnabled) {
        spotifyWidget.style.display = 'block';
        if (spotifyArt && data.albumArt) spotifyArt.src = data.albumArt;
        if (spotifyTitle) spotifyTitle.innerText = data.title || '';
        if (spotifyArtist) spotifyArtist.innerText = data.artist || '';

        // Vinyl spin saat playing
        if (artRing) artRing.classList.add('playing');
        // EQ animasi aktif
        if (eqDiv) eqDiv.style.opacity = '1';

        // Update progress bar dari server data
        spotifyLocalProgress = data.progressMs || 0;
        spotifyLocalDuration = data.durationMs || 0;
        spotifyLocalPlaying = true;

        if (timeTotal) timeTotal.innerText = msToTime(spotifyLocalDuration);
        if (progressFill && spotifyLocalDuration > 0) {
            progressFill.style.width = ((spotifyLocalProgress / spotifyLocalDuration) * 100) + '%';
        }
        if (timeCur) timeCur.innerText = msToTime(spotifyLocalProgress);

        // Start local ticker supaya progress bar smooth antara poll
        if (spotifyProgressInterval) clearInterval(spotifyProgressInterval);
        spotifyProgressInterval = setInterval(tickSpotifyProgress, 1000);

    } else {
        spotifyLocalPlaying = false;
        if (spotifyProgressInterval) { clearInterval(spotifyProgressInterval); spotifyProgressInterval = null; }

        if (artRing) artRing.classList.remove('playing');
        if (eqDiv) eqDiv.style.opacity = '0.3';

        if (oType2 === 'spotify') {
            spotifyWidget.style.display = 'block';
            if (spotifyTitle) spotifyTitle.innerText = '⏸ Tidak ada lagu';
            if (spotifyArtist) spotifyArtist.innerText = 'Putar lagu di Spotify...';
            if (progressFill) progressFill.style.width = '0%';
        } else {
            spotifyWidget.style.display = 'none';
        }
    }
});

// Jika mode type=spotify, sembunyikan semua elemen lain
if (userFromUrl) {
    const urlParamsSp = new URLSearchParams(window.location.search);
    if (urlParamsSp.get('type') === 'spotify') {
        ['chat-area','gift-area','leaderboard-container','milestone-container','marquee-container'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        if (spotifyWidget) {
            spotifyWidget.style.display = 'block';
            spotifyWidget.style.position = 'fixed';
            spotifyWidget.style.bottom = '0';
            spotifyWidget.style.left = '0';
            spotifyWidget.style.width = '100%';
            spotifyWidget.style.borderRadius = '0';
            if (spotifyTitle) spotifyTitle.innerText = '🎵 Menunggu lagu...';
            if (spotifyArtist) spotifyArtist.innerText = '';
        }
    }
}

// Fungsi preview widget Spotify di dashboard
window.previewSpotifyWidget = function() {
    if (!activeRoom) {
        alert('Hubungkan TikTok dulu agar link overlay-nya terbuat!');
        return;
    }
    const linkEl = document.getElementById('obs-link-spotify');
    if (!linkEl || !linkEl.value) {
        alert('Link Spotify belum tersedia. Pastikan sudah terhubung ke TikTok.');
        return;
    }
    // Buka di tab baru dengan background hitam untuk lihat widgetnya
    const previewUrl = linkEl.value + '&preview=1';
    window.open(previewUrl, '_blank', 'width=400,height=200,left=100,top=100');
};

function showGiftAlert(data) {
    if (!giftArea) return;
    const giftEl = document.createElement('div');
    giftEl.className = 'gift-alert'; 
    giftEl.innerHTML = `
        <img src="${data.giftPictureUrl}" class="gift-icon">
        <div class="gift-text">
            <div class="gift-title">${data.nickname}</div>
            <div class="gift-desc">MENGIRIM ${data.giftName.toUpperCase()} x${data.repeatCount}</div>
        </div>
    `;
    giftArea.appendChild(giftEl);
    setTimeout(() => { if(giftEl.parentElement) giftEl.parentElement.removeChild(giftEl); }, 6000);
}

// Update UI Polling Khusus
function updatePollUI() {
    const urlParams = new URLSearchParams(window.location.search);
    const oType = urlParams.get('type') || 'all';
    
    const pCont = document.getElementById('poll-container');
    if (!pCont) return;
    if (pollActive && userFromUrl && (oType === 'all' || oType === 'interactive')) {
        pCont.style.display = 'block';
        document.getElementById('poll-title').innerText = pollQuestion;
        document.getElementById('poll-name-a').innerText = pollNameA;
        document.getElementById('poll-name-b').innerText = pollNameB;
        document.getElementById('poll-votes-a').innerText = pollVotesA;
        document.getElementById('poll-votes-b').innerText = pollVotesB;
        const total = pollVotesA + pollVotesB;
        if (total > 0) {
            document.getElementById('poll-bar-a').style.width = ((pollVotesA / total) * 100) + "%";
            document.getElementById('poll-bar-b').style.width = ((pollVotesB / total) * 100) + "%";
        } else {
            document.getElementById('poll-bar-a').style.width = "0%";
            document.getElementById('poll-bar-b').style.width = "0%";
        }
    } else {
        pCont.style.display = 'none';
        pollVotesA = 0;
        pollVotesB = 0;
    }
}

function createChatBubble(data, isSystemMessage, muteTts = false) {
    if (isSystemMessage && isHideSys) return;

    // 🌟 Deteksi jika user ini ada di Top 5 (VIP)
    const top5Names = Object.entries(topGifters)
                            .sort((a,b) => b[1] - a[1])
                            .slice(0, 5)
                            .map(entry => entry[0]);
    const isVip = top5Names.includes(data.nickname);

    // 1. Logic untuk Overlay (Existing)
    const el = document.createElement('div');
    el.className = 'chat-item';
    if(isSystemMessage) el.style.borderLeftColor = '#ffea00';
    if(isVip && !isSystemMessage) el.classList.add('chat-vip');

    const pfpHtml = data.profilePictureUrl 
        ? `<img src="${data.profilePictureUrl}" class="chat-pfp" onerror="this.src='https://ui-avatars.com/api/?name=${data.nickname}&background=random'">` 
        : `<div class="chat-pfp" style="background:#444; color:#fff; display:flex; align-items:center; justify-content:center; font-size:16px;">💬</div>`;
    
    el.innerHTML = `
        ${pfpHtml}
        <div class="chat-content">
            <span class="chat-nick" style="${isSystemMessage ? 'color:#ffea00;' : ''}">${data.nickname}</span>
            <span class="chat-msg">${data.comment}</span>
        </div>
    `;
    
    // 🔊 TTS Chat
    if (ttsChatEnabled && !isSystemMessage && !muteTts) {
        speakTextNative(`${data.nickname} bilang ${data.comment}`);
    }
    
    if (chatArea) {
        chatArea.appendChild(el);
        while (chatArea.childElementCount > chatLimit) {
            chatArea.removeChild(chatArea.firstChild);
        }
        setTimeout(() => { if(el.parentElement) el.parentElement.removeChild(el); }, 16000); 
    }

    // 2. Logic untuk Dashboard Preview (Kecil & Compact)
    if (!userFromUrl && dashChatList) {
        // Hapus tulisan "Menunggu chat..." jika ada
        if (dashChatList.innerText.includes("Menunggu")) dashChatList.innerHTML = "";

        const dashEl = document.createElement('div');
        dashEl.className = 'dash-chat-item';
        // Terapkan warna berdasarkan tema aktif
        const activeTheme = dashTheme ? dashTheme.value : 'default';
        const themeStyles = {
            'default':    { bg: 'rgba(255,255,255,0.05)', border: '#00f2fe', nick: '#00f2fe', msg: '#ddd' },
            'cyberpunk':  { bg: '#1a1a1a', border: '#ff003c', nick: '#fce205', msg: '#fff' },
            'pink':       { bg: 'rgba(255,182,193,0.2)', border: '#ff69b4', nick: '#ff1493', msg: '#ffe0f0' },
            'light':      { bg: 'rgba(255,255,255,0.9)', border: '#333', nick: '#333', msg: '#000' },
            'retro':      { bg: '#0000aa', border: '#fff', nick: '#ffff55', msg: '#fff' },
            'glass':      { bg: 'rgba(255,255,255,0.1)', border: '#fff', nick: '#fff', msg: '#f0f0f0' }
        };
        const ts = themeStyles[activeTheme] || themeStyles['default'];
        const borderColor = isSystemMessage ? '#ffea00' : ts.border;
        dashEl.style.cssText = `background: ${ts.bg}; padding: 8px; border-radius: 8px; font-size: 13px; border-left: 3px solid ${borderColor};`;
        
        dashEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                <div style="flex:1;">
                    <strong style="color: ${isSystemMessage ? '#ffea00' : (isVip ? 'gold' : ts.nick)}; font-size: 11px;">
                        ${isVip ? '👑' : ''}${data.nickname}:
                    </strong>
                    <span style="color: ${ts.msg};">${data.comment}</span>
                </div>
                ${!isSystemMessage ? `<button class="btn-highlight" style="background:rgba(255,255,255,0.1); border:none; color:gold; font-size:10px; cursor:pointer; padding:2px 5px; border-radius:4px; margin-left:5px;">🌟</button>` : ''}
            </div>
        `;
        
        // 📌 Fitur Highlight Chat (Click 🌟)
        if (!isSystemMessage) {
            const btnH = dashEl.querySelector('.btn-highlight');
            if (btnH) {
                btnH.addEventListener('click', (e) => {
                    e.stopPropagation();
                    socket.emit('settings-update', { room: activeRoom, settings: { triggerHighlight: true, highlightData: data } });
                    showToast("Pesan di-highlight ke Overlay!", "success");
                });
            }

            // Click pada bubble = Pin Chat (Lama)
            dashEl.addEventListener('click', () => {
                socket.emit('settings-update', { room: activeRoom, settings: { triggerPin: true, pinData: data } });
            });
        }

        dashChatList.appendChild(dashEl);
        // Auto scroll ke bawah
        dashChatList.scrollTop = dashChatList.scrollHeight;

        // Limit preview agar tidak berat
        while (dashChatList.childElementCount > 100) {
            dashChatList.removeChild(dashChatList.firstChild);
        }
    }
}

// 📌 Tampilkan Pinned Chat
let pinnedChatTimeout;
function showPinnedChat(data) {
    const pinnedContainer = document.getElementById('pinned-chat-container');
    const pinnedContent = document.getElementById('pinned-chat-content');
    if (!pinnedContainer || !pinnedContent) return;
    
    // Terapkan profile picture dan inner HTML yang membesar
    const pfpHtml = data.profilePictureUrl 
        ? `<img src="${data.profilePictureUrl}" class="chat-pfp" onerror="this.src='https://ui-avatars.com/api/?name=${data.nickname}&background=random'">` 
        : `<div class="chat-pfp" style="background:#444; color:#fff; display:flex; align-items:center; justify-content:center; font-size:24px;">💬</div>`;
        
    pinnedContent.innerHTML = `
        <div class="pinned-badge">PINNED CHAT</div>
        ${pfpHtml}
        <div class="chat-content" style="width:100%;">
            <span class="chat-nick">${data.nickname}</span>
            <span class="chat-msg">${data.comment}</span>
        </div>
    `;

    pinnedContainer.style.display = 'block';

    // Auto-hide setelah 12 detik
    clearTimeout(pinnedChatTimeout);
    pinnedChatTimeout = setTimeout(() => {
        pinnedContainer.style.display = 'none';
        pinnedContent.innerHTML = '';
    }, 12000);
}

document.querySelectorAll('#btn-disconnect').forEach(btn => {
    btn.addEventListener('click', () => {
        if (activeRoom) {
            socket.emit('leave-room', activeRoom);
        }
        if (dashboardWrapper) dashboardWrapper.style.display = "none";
        setupPanel.style.display = "block";
        activeRoom = null;
        statusText.innerText = "Koneksi diputus.";
        // Kosongkan semua link
        ['chat','gift','leaderboard','milestone', 'marquee', 'interactive', 'spotify', 'all'].forEach(t => {
            const el = document.getElementById(`obs-link-${t}`);
            if (el) el.value = '';
        });
    });
});

// Copy link per tipe
window.copyObsLink = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input || !input.value) return;
    input.select();
    document.execCommand('copy');
    const orig = btn.innerText;
    btn.innerText = "✔";
    btn.style.background = "#28a745";
    setTimeout(() => { btn.innerText = orig; btn.style.background = "#5c00d2"; }, 1800);
}

// Buka overlay di tab baru dengan parameter preview
window.openOverlayNewTab = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input || !input.value) {
        alert("Hubungkan ke TikTok Live dulu untuk generate link!");
        return;
    }
    // Tambah &preview=1 supaya background gelap saat di browser (bukan aplikasi streaming)
    const previewUrl = input.value + '&preview=1';
    window.open(previewUrl, '_blank');
}


// ================= OVERLAY PREVIEW MODAL =================

let currentPreviewW = 1920, currentPreviewH = 1080;

// Preview per tipe (chat/gift/leaderboard/milestone)
window.previewOverlay = function(type) {
    const input = document.getElementById(`obs-link-${type}`);
    if (!input || !input.value || !activeRoom) {
        alert("Hubungkan ke TikTok Live dulu untuk generate link!"); 
        return;
    }
    loadPreviewModal(input.value, type);
}

function loadPreviewModal(url, label) {
    const modal = document.getElementById('overlay-preview-modal');
    const iframe = document.getElementById('overlay-preview-iframe');
    const loading = document.getElementById('preview-loading');
    const previewLabel = document.getElementById('preview-label');

    // Toggle Preview Mockup Background Context
    const wrapper = document.getElementById('preview-frame-wrapper');
    if (wrapper) {
        if (['chat','gift','milestone','feed','welcome','sosmed'].includes(label)) {
            wrapper.classList.add('mockup-active');
        } else {
            wrapper.classList.remove('mockup-active');
        }
    }

    // Reset state
    iframe.style.display = 'none';
    loading.style.display = 'flex';
    iframe.src = '';

    // Update label
    const labelMap = { 
        chat: '💬 Chat Feed', 
        gift: '🎁 Gift Alert', 
        leaderboard: '🏆 Leaderboard', 
        milestone: '🎯 Milestone Goal',
        marquee: '📜 Teks Berjalan',
        interactive: '🎮 Game Interaktif',
        all: '🌟 Overlay All-In-One'
    };
    if (previewLabel) previewLabel.innerText = labelMap[label] || label;

    // Tampilkan modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Scale iframe agar fit ke wrapper (simulasi resolusi)
    applyPreviewScale();

    // Load iframe
    setTimeout(() => {
        iframe.src = url;
        iframe.onload = () => {
            loading.style.display = 'none';
            iframe.style.display = 'block';
        };
    }, 100);
}

window.closeOverlayPreview = function() {
    const modal = document.getElementById('overlay-preview-modal');
    const iframe = document.getElementById('overlay-preview-iframe');
    modal.style.display = 'none';
    iframe.src = '';
    document.body.style.overflow = '';
}

window.setPreviewSize = function(w, h) {
    currentPreviewW = w;
    currentPreviewH = h;

    document.querySelectorAll('.prev-size-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(h === 720 ? 'btn-720' : 'btn-1080').classList.add('active');

    applyPreviewScale();
}

function applyPreviewScale() {
    const wrapper = document.getElementById('preview-frame-wrapper');
    const iframe = document.getElementById('overlay-preview-iframe');

    const wrapperW = wrapper.offsetWidth || window.innerWidth * 0.95;
    const scale = wrapperW / currentPreviewW;

    iframe.style.width = currentPreviewW + 'px';
    iframe.style.height = currentPreviewH + 'px';
    iframe.style.transform = `scale(${scale})`;
    iframe.style.transformOrigin = 'top left';
    iframe.style.display = 'block';

    wrapper.style.height = (currentPreviewH * scale) + 'px';
}

// Tutup modal saat klik backdrop
document.getElementById('overlay-preview-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('overlay-preview-modal')) closeOverlayPreview();
});

// Shortcut ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeOverlayPreview();
});

// ================= LIVE PREVIEW & SONG REQUEST LOGIC =================

window.openLiveInNewTab = function() {
    if (!activeRoom) {
        alert("Hubungkan ke TikTok Live dulu!");
        return;
    }
    const url = `https://www.tiktok.com/@${activeRoom}/live`;
    
    // Konfigurasi Standalone App Mode (Menghilangkan URL bar & Toolbar)
    const features = 'width=450,height=800,left=50,top=50,popup=1,toolbar=no,location=no,status=no,menubar=no,resizable=yes';
    const monitorWin = window.open(url, 'TikTokMonitor', features);
    
    if (!monitorWin) {
        alert("Pop-up diblokir browser! Izinkan pop-up di browser agar fitur Monitor bisa terbuka.");
    } else {
        monitorWin.focus();
    }
}

function addSongToQueue(user, title) {
    songQueue.push({ user, title, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) });
    renderSongQueue();
    // Beri notifikasi di Dashboard preview jika di dashboard
    if (!userFromUrl) {
        createChatBubble({ nickname: '🎵 Request', comment: `${user} merequest lagu: ${title}` }, true);
    }
}

window.clearSongQueue = function() {
    if (confirm("Hapus semua antrean lagu?")) {
        songQueue = [];
        renderSongQueue();
    }
}

window.removeSong = function(index) {
    songQueue.splice(index, 1);
    renderSongQueue();
}

function renderSongQueue() {
    if (!songQueueContainer) return;
    if (songQueue.length === 0) {
        songQueueContainer.innerHTML = `<p style="color:#666; font-size:11px; text-align:center; margin-top:50px;">Belum ada request lagu...</p>`;
        return;
    }

    songQueueContainer.innerHTML = songQueue.map((item, index) => {
        const isUrl = /^(http|https|www\.)/i.test(item.title);
        const searchUrl = isUrl ? (item.title.startsWith('www') ? 'https://' + item.title : item.title) : `https://www.youtube.com/results?search_query=${encodeURIComponent(item.title + " ncs")}`;
        const btnLabel = isUrl ? '🔗 Buka Link' : '🔍 Cari';
        const btnColor = isUrl ? '#ff0050' : 'rgba(255,255,255,0.1)';

        return `
            <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:8px; border-left:3px solid #00f2fe; display:flex; justify-content:space-between; align-items:center;">
                <div style="flex:1; overflow:hidden; padding-right:10px;">
                    <div style="font-size:12px; font-weight:bold; color:#00f2fe; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title}</div>
                    <div style="font-size:10px; color:#888;">Requested by ${item.user} • ${item.time}</div>
                </div>
                <div style="display:flex; gap:5px;">
                    <button onclick="window.open('${searchUrl}', '_blank')" 
                        style="background:${btnColor}; border:1px solid #444; border-radius:4px; color:#fff; padding:4px 8px; cursor:pointer; font-size:10px; white-space:nowrap;">${btnLabel}</button>
                    <button onclick="removeSong(${index})" style="background:#00f2fe; border:none; border-radius:4px; color:#000; font-weight:bold; padding:4px 8px; cursor:pointer; font-size:10px;">OK ✅</button>
                </div>
            </div>
        `;
    }).join('');
}


// ================= ENGAGEMENT & INTERACTION SUITE =================

// 🌟 SMART HIGHLIGHT (SHOUTOUT)
let highlightTimeout;
function showHighlight(data) {
    if (!userFromUrl) return;
    
    // Check if highlight module is allowed in current link
    const modulesParam = new URLSearchParams(window.location.search).get('modules');
    const overlayType = new URLSearchParams(window.location.search).get('type') || 'all';
    if (overlayType === 'all' && modulesParam && !modulesParam.includes('highlight')) return;
    if (overlayType !== 'all' && overlayType !== 'highlight') return;

    const container = document.getElementById('pinned-chat-container');

    clearTimeout(highlightTimeout);
    
    const pfp = data.profilePictureUrl || `https://ui-avatars.com/api/?name=${data.nickname}&background=random&color=fff&size=128`;
    
    content.innerHTML = `
        <div style="position:relative;">
            <img src="${pfp}" style="width:120px; height:120px; border-radius:50%; border:4px solid #00f2fe; box-shadow:0 0 30px rgba(0,242,254,0.6);">
            <div style="position:absolute; bottom:-10px; right:0; background:#00f2fe; color:#000; padding:2px 8px; border-radius:10px; font-weight:bold; font-size:12px;">SHOUTOUT!</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:5px;">
            <span style="font-size:20px; color:#00f2fe; font-weight:bold; text-transform:uppercase; letter-spacing:2px;">${data.nickname}</span>
            <span style="font-size:32px; color:#fff; font-weight:900; line-height:1.2; text-shadow:2px 2px 10px rgba(0,0,0,0.5);">${data.comment}</span>
        </div>
    `;

    container.style.display = 'block';
    container.style.animation = 'popUpIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';

    // Play sound if in overlay
    if (userFromUrl && sfxEnabled) {
        alertSound.currentTime = 0;
        alertSound.play().catch(() => {});
    }

    highlightTimeout = setTimeout(() => {
        container.style.animation = 'popUpOut 0.5s ease-in forwards';
        setTimeout(() => { container.style.display = 'none'; }, 500);
    }, 8000);
}

// 👋 WELCOME BOT
let welcomeQueue = [];
let isWelcoming = false;
function showWelcome(data) {
    if (!userFromUrl) return;

    // Check if welcome module is allowed in current link
    const modulesParam = new URLSearchParams(window.location.search).get('modules');
    const overlayType = new URLSearchParams(window.location.search).get('type') || 'all';
    if (overlayType === 'all' && modulesParam && !modulesParam.includes('welcome')) return;
    if (overlayType !== 'all' && overlayType !== 'welcome') return;

    welcomeQueue.push(data);
    if (!isWelcoming) processWelcomeQueue();
}

function processWelcomeQueue() {
    if (welcomeQueue.length === 0) {
        isWelcoming = false;
        return;
    }
    isWelcoming = true;
    const data = welcomeQueue.shift();
    
    // Gunakan hype-alert-container untuk welcome bubble kecil di atas
    const hypeContainer = document.getElementById('hype-alert-container');
    if (!hypeContainer) return;

    const welcomeEl = document.createElement('div');
    welcomeEl.style.cssText = `
        background: rgba(0,0,0,0.85);
        border: 1px solid #00f2fe;
        color: #fff;
        padding: 8px 20px;
        border-radius: 50px;
        font-size: 14px;
        font-weight: bold;
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
        animation: popUpIn 0.5s ease-out;
    `;
    welcomeEl.innerHTML = `<span style="font-size:18px;">👋</span> Welcome <span style="color:#00f2fe;">${data.nickname}</span> !`;

    hypeContainer.appendChild(welcomeEl);
    hypeContainer.style.display = 'block';

    setTimeout(() => {
        welcomeEl.style.animation = 'popUpOut 0.5s ease-in forwards';
        setTimeout(() => {
            welcomeEl.remove();
            if (hypeContainer.childElementCount === 0) hypeContainer.style.display = 'none';
            processWelcomeQueue();
        }, 500);
    }, 3000);
}

// 📱 SOCIAL MEDIA CYCLE (Global Settings Driven)
let socmedInterval;
let socmedIndex = 0;
let currentSocMedConfig = null;

function startSocMedCycle(config) {
    if (!userFromUrl) return;
    if (!config) return;
    
    currentSocMedConfig = config;
    clearInterval(socmedInterval);

    if (!config.ig && !config.yt && !config.dc) {
        const container = document.getElementById('socmed-container');
        if (container) container.style.display = 'none';
        return;
    }

    const platforms = [];
    if (config.ig) platforms.push({ key: 'Instagram', val: config.ig, icon: '📸', color: '#E1306C' });
    if (config.yt) platforms.push({ key: 'YouTube', val: config.yt, icon: '🎬', color: '#FF0000' });
    if (config.dc) platforms.push({ key: 'Discord', val: config.dc, icon: '💬', color: '#5865F2' });

    if (platforms.length === 0) return;

    // Helper function to run one cycle
    const runCycle = () => {
        const p = platforms[socmedIndex];
        const container = document.getElementById('socmed-container');
        const platformEl = document.getElementById('socmed-platform');
        const handleEl = document.getElementById('socmed-handle');
        const iconEl = document.getElementById('socmed-icon');
        const bubble = document.getElementById('socmed-bubble');

        if (!container) return;

        platformEl.innerText = p.key;
        platformEl.style.color = p.color;
        handleEl.innerText = p.val;
        iconEl.innerText = p.icon;
        bubble.style.borderColor = p.color;

        container.style.display = 'block';
        container.style.animation = 'popUpIn 0.5s ease-out forwards';

        setTimeout(() => {
            container.style.animation = 'popUpOut 0.5s ease-in forwards';
            setTimeout(() => { 
                if (container) container.style.display = 'none'; 
            }, 500);
        }, 6000);

        socmedIndex = (socmedIndex + 1) % platforms.length;
    };

    // Run first cycle immediately
    runCycle();

    // Then set interval
    socmedInterval = setInterval(runCycle, (parseInt(config.interval) || 120) * 1000);
}

// 🏁 FAST TYPING GAME
let currentGameWord = "";
function startTypingGame(word) {
    if (!userFromUrl) return;
    currentGameWord = word;
    
    const container = document.getElementById('typing-game-container');
    const targetWordEl = document.getElementById('typing-target-word');
    const winnerSec = document.getElementById('typing-winner-section');
    
    if (!container) return;

    targetWordEl.innerText = word;
    winnerSec.style.display = 'none';
    container.style.display = 'block';
    container.style.animation = 'popUpIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';

    // Auto close after 30s if no winner
    setTimeout(() => {
        if (container.style.display === 'block' && winnerSec.style.display === 'none') {
            container.style.animation = 'popUpOut 0.5s ease-in forwards';
            setTimeout(() => { container.style.display = 'none'; }, 500);
        }
    }, 30000);
}

// 🎮 DASHBOARD BUTTONS WIRING
function initDashboardControls() {
    if (userFromUrl) {
        // Initial start if config provided in b64
        return;
    }

    // Polling Controls
    const btnStartPoll = document.getElementById('btn-start-poll');
    const btnStopPoll = document.getElementById('btn-stop-poll');
    if (btnStartPoll) {
        btnStartPoll.addEventListener('click', () => {
             socket.emit('settings-update', { room: activeRoom, settings: { pollActive: true, pollQuestion: dashPollQuestion.value, pollA: dashPollA.value, pollB: dashPollB.value, pollKeyA: dashPollKeyA.value, pollKeyB: dashPollKeyB.value } });
             btnStartPoll.style.display = 'none';
             btnStopPoll.style.display = 'block';
             showToast("Polling Dimulai!", "success");
        });
    }
    if (btnStopPoll) {
        btnStopPoll.addEventListener('click', () => {
             socket.emit('settings-update', { room: activeRoom, settings: { pollActive: false } });
             btnStartPoll.style.display = 'block';
             btnStopPoll.style.display = 'none';
             showToast("Polling Dihentikan!", "info");
        });
    }

    // Fast Typing Game
    const btnStartGame = document.getElementById('btn-start-game');
    const gameWordInp = document.getElementById('dash-game-word');
    if (btnStartGame) {
        btnStartGame.addEventListener('click', () => {
            const randomWords = ["GACOR", "SULTAN", "MANTAP", "TIKTOK", "OVERLAY", "SEMANGAT", "TERIMAKASIH", "HADIAH"];
            const word = gameWordInp.value.trim().toUpperCase() || randomWords[Math.floor(Math.random() * randomWords.length)];
            socket.emit('settings-update', { room: activeRoom, settings: { triggerGame: true, gameWord: word } });
            showToast(`Game Dimulai! Kata: ${word}`, "success");
        });
    }

    // Social Media Cycle — pre-fill dari server
    const btnSaveSoc = document.getElementById('btn-save-sosmed');
    if (btnSaveSoc) {
        // Load nilai lama dari server saat pertama buka dashboard
        fetch('/api/settings')
            .then(r => r.json())
            .then(s => {
                if (s.socMedConfig) {
                    const c = s.socMedConfig;
                    const igEl = document.getElementById('dash-soc-ig');
                    const ytEl = document.getElementById('dash-soc-yt');
                    const dcEl = document.getElementById('dash-soc-dc');
                    const intEl = document.getElementById('dash-soc-interval');
                    if (igEl) igEl.value = c.ig || '';
                    if (ytEl) ytEl.value = c.yt || '';
                    if (dcEl) dcEl.value = c.dc || '';
                    if (intEl) intEl.value = c.interval || 120;
                }
            })
            .catch(() => {});

        btnSaveSoc.addEventListener('click', () => {
            const newConfig = {
                ig: document.getElementById('dash-soc-ig').value.trim(),
                yt: document.getElementById('dash-soc-yt').value.trim(),
                dc: document.getElementById('dash-soc-dc').value.trim(),
                interval: parseInt(document.getElementById('dash-soc-interval').value) || 120
            };

            // 🎯 FIX: Jika belum connect/skip, ambil target room dari input username
            let targetRoom = activeRoom;
            if (!targetRoom || targetRoom === 'null') {
                targetRoom = (usernameInput.value.trim().toLowerCase().startsWith('@') ? 
                              usernameInput.value.trim().toLowerCase().substring(1) : 
                              usernameInput.value.trim().toLowerCase()) || 'offline';
            }

            // Save to server for all overlays
            socket.emit('settings-update', { room: targetRoom, settings: { socMedConfig: newConfig } });
            showToast("Sosmed Berhasil Disimpan & Disinkronkan! ✅", "success");
        });
    }
}

// Panggil initialization dashboard
initDashboardControls();

// Duplicate settings listener removed.


// ================= LIVE EVENT SIMULATOR =================

window.simulateFollow = function() {
    console.log("[Simulation] Follow triggered");
    if (!activeRoom) {
         showToast("Hubungkan ke TikTok dulu bang!", "error");
         return;
    }
    const packet = { uniqueId: 'test_user', nickname: 'Sultan Testing 👤' };
    socket.emit('simulate-event', { room: activeRoom, type: 'follow', packet });
    showToast("Simulasi: FOLLOW terkirim! ✨", "success");
}

window.simulateGift = function(coins = 1) {
    console.log("[Simulation] Gift triggered:", coins);
    if (!activeRoom) {
         showToast("Hubungkan ke TikTok dulu bang!", "error");
         return;
    }
    const packet = {
        uniqueId: 'sultan_test',
        nickname: 'Sultan Ganteng 💎',
        giftName: coins >= 1000 ? 'TikTok Universe' : 'Mawar Merah',
        repeatCount: 1,
        diamondCount: coins,
        giftPictureUrl: 'https://p16-va.lemon8cdn.com/obj/lemon8-content-us/7106346741757827845'
    };
    socket.emit('simulate-event', { room: activeRoom, type: 'gift', packet });
    showToast(`Simulasi: GIFT (${coins}) terkirim! 🎁`, "success");
}

window.simulateChat = function() {
    console.log("[Simulation] Chat triggered");
    if (!activeRoom) {
         showToast("Hubungkan ke TikTok dulu bang!", "error");
         return;
    }
    const packet = {
        uniqueId: 'chat_bot',
        nickname: 'Penonton Gabut 💬',
        comment: 'Halo bang! Overlay-nya keren banget parah sih ini! 🔥'
    };
    socket.emit('simulate-event', { room: activeRoom, type: 'chat', packet });
    showToast("Simulasi: CHAT terkirim! 💬", "success");
}

window.simulateLike = function() {
    if (!activeRoom) return showToast("Hubungkan dulu!", "error");
    socket.emit('simulate-event', { room: activeRoom, type: 'like', packet: { nickname: 'Liker ❤️', likeCount: 100 } });
    showToast("Simulasi: LIKE terkirim! ❤️", "success");
}

window.simulateShare = function() {
    if (!activeRoom) return showToast("Hubungkan dulu!", "error");
    socket.emit('simulate-event', { room: activeRoom, type: 'share', packet: { nickname: 'Sharer 🔗' } });
    showToast("Simulasi: SHARE terkirim! 🔗", "success");
}
