'use strict';

const CONFIG = {
    version: '4.0.0',
    mpilalaoMax: 100,
    server: 'https://mg-fighter-1.onrender.com'
};

let lalao = {
    vonona: false,
    efijery: 'loading',
    mpampiasa: null,
    socket: null,
    firebase: null,
    db: null,
    auth: null
};

let mpilalao = {
    uid: null,
    anarana: '',
    level: 1,
    xp: 0,
    volamena: 0,
    diamondra: 0,
    fandresena: 0,
    vono: 0,
    fahafatesana: 0,
    lalao: 0,
    hoditra: ['default'],
    hoditraAnkehitriny: 'default'
};

document.addEventListener('DOMContentLoaded', () => {
    manombokaLalao();
});

async function manombokaLalao() {
    try {
        asehoLoading();
        havaozyLoading(10, 'Manomana...');
        
        await miandry(300);
        amboaryEventListeners();
        
        havaozyLoading(30, 'Mifandray amin ny Firebase...');
        await amboaryFirebase();
        
        havaozyLoading(60, 'Manamarina kaonty...');
        await jereoAuth();
        
        havaozyLoading(90, 'Mameno...');
        await miandry(400);
        
        havaozyLoading(100, 'Vonona!');
        await miandry(300);
        
        afenoLoading();
        
        if (lalao.mpampiasa) {
            asehoMenu();
        } else {
            asehoAuth();
        }
        
        lalao.vonona = true;
    } catch (e) {
        console.error(e);
        asehoError('Tsy nety nampiditra');
    }
}

function miandry(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function havaozyLoading(isa, soratra) {
    const feno = document.getElementById('loadingProgress');
    const isan = document.getElementById('loadingPercent');
    const sora = document.getElementById('loadingText');
    if (feno) feno.style.width = isa + '%';
    if (isan) isan.textContent = isa + '%';
    if (sora) sora.textContent = soratra;
}

function asehoLoading() {
    document.getElementById('loadingScreen')?.classList.remove('hidden');
}

function afenoLoading() {
    document.getElementById('loadingScreen')?.classList.add('hidden');
}

async function amboaryFirebase() {
    const firebaseConfig = {
  apiKey: "AIzaSyAfI8xmHFY5UlWO0sn7OeTzfjv7cJARAGY",
  authDomain: "mgfigther-b3760.firebaseapp.com",
  databaseURL: "https://mgfigther-b3760-default-rtdb.firebaseio.com",
  projectId: "mgfigther-b3760",
  storageBucket: "mgfigther-b3760.firebasestorage.app",
  messagingSenderId: "829325634031",
  appId: "1:829325634031:web:b9c13b78ffec75a372ee1a",
  measurementId: "G-30QH3M5E9Z"
};
    
    firebase.initializeApp(config);
    lalao.firebase = firebase;
    lalao.auth = firebase.auth();
    lalao.db = firebase.firestore();
    
    await amboarySocket();
}

async function amboarySocket() {
    return new Promise((resolve, reject) => {
        const socket = io(CONFIG.server, {
            transports: ['websocket'],
            reconnection: true
        });
        
        socket.on('connect', () => {
            lalao.socket = socket;
            console.log('Tafiditra server');
            resolve();
        });
        
        socket.on('connect_error', (err) => {
            reject(err);
        });
    });
}

async function jereoAuth() {
    return new Promise((resolve) => {
        lalao.auth.onAuthStateChanged(async (user) => {
            if (user) {
                lalao.mpampiasa = user;
                await makaDataMpampiasa(user.uid);
            }
            resolve(user);
        });
    });
}

async function hiditraGoogle() {
    try {
        asehoToast('Mifandray amin Google...', 'info');
        const provider = new firebase.auth.GoogleAuthProvider();
        const valiny = await lalao.auth.signInWithPopup(provider);
        const user = valiny.user;
        
        lalao.mpampiasa = user;
        await mamoronaProfile(user);
        await makaDataMpampiasa(user.uid);
        
        asehoToast('Tonga soa ' + user.displayName, 'success');
        asehoMenu();
    } catch (e) {
        asehoToast('Tsy nety niditra', 'error');
    }
}

async function hiditraFacebook() {
    try {
        asehoToast('Mifandray amin Facebook...', 'info');
        const provider = new firebase.auth.FacebookAuthProvider();
        const valiny = await lalao.auth.signInWithPopup(provider);
        const user = valiny.user;
        
        lalao.mpampiasa = user;
        await mamoronaProfile(user);
        await makaDataMpampiasa(user.uid);
        
        asehoToast('Tonga soa ' + user.displayName, 'success');
        asehoMenu();
    } catch (e) {
        asehoToast('Tsy nety niditra', 'error');
    }
}

async function hiditraAnonyme() {
    try {
        asehoToast('Mamorona kaonty vahiny...', 'info');
        const valiny = await lalao.auth.signInAnonymously();
        const user = valiny.user;
        const anarana = 'Vahiny' + Math.floor(Math.random() * 9999);
        
        await user.updateProfile({displayName: anarana});
        lalao.mpampiasa = user;
        
        await mamoronaProfile(user);
        mpilalao.anarana = anarana;
        
        asehoToast('Tafiditra vahiny', 'success');
        asehoMenu();
    } catch (e) {
        asehoToast('Tsy nety', 'error');
    }
}

async function hiditraEmail() {
    const email = document.getElementById('emailInput').value.trim();
    const teny = document.getElementById('passwordInput').value;
    
    if (!email || !teny) {
        asehoAuthError('Fenoy daholo');
        return;
    }
    
    try {
        const valiny = await lalao.auth.signInWithEmailAndPassword(email, teny);
        lalao.mpampiasa = valiny.user;
        await makaDataMpampiasa(valiny.user.uid);
        asehoToast('Tonga soa indray', 'success');
        asehoMenu();
    } catch (e) {
        asehoAuthError('Email na teny diso');
    }
}

async function hisoratraEmail() {
    const email = document.getElementById('emailInput').value.trim();
    const teny = document.getElementById('passwordInput').value;
    const anarana = document.getElementById('usernameInput').value.trim();
    
    if (!email || !teny || !anarana) {
        asehoAuthError('Fenoy daholo');
        return;
    }
    
    if (anarana.length < 3) {
        asehoAuthError('Anarana fohy loatra');
        return;
    }
    
    try {
        const valiny = await lalao.auth.createUserWithEmailAndPassword(email, teny);
        const user = valiny.user;
        await user.updateProfile({displayName: anarana});
        
        lalao.mpampiasa = user;
        mpilalao.anarana = anarana;
        mpilalao.uid = user.uid;
        
        await mamoronaProfile(user);
        asehoToast('Voasoratra!', 'success');
        asehoMenu();
    } catch (e) {
        asehoAuthError('Efa misy io email io');
    }
}

async function hivoaka() {
    await lalao.auth.signOut();
    lalao.mpampiasa = null;
    mpilalao = {
        uid: null,
        anarana: '',
        level: 1,
        xp: 0,
        volamena: 0,
        diamondra: 0,
        fandresena: 0,
        vono: 0,
        fahafatesana: 0,
        lalao: 0,
        hoditra: ['default'],
        hoditraAnkehitriny: 'default'
    };
    asehoToast('Nivoaka', 'info');
    asehoAuth();
}

function asehoAuthError(hafatra) {
    const el = document.getElementById('authError');
    if (el) {
        el.textContent = hafatra;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 4000);
    }
}

async function mamoronaProfile(user) {
    const ref = lalao.db.collection('mpilalao').doc(user.uid);
    const doc = await ref.get();
    
    if (!doc.exists) {
        await ref.set({
            uid: user.uid,
            anarana: user.displayName || mpilalao.anarana,
            email: user.email || null,
            namboarina: firebase.firestore.FieldValue.serverTimestamp(),
            niditraFarany: firebase.firestore.FieldValue.serverTimestamp(),
            level: 1,
            xp: 0,
            volamena: 1000,
            diamondra: 50,
            fandresena: 0,
            vono: 0,
            fahafatesana: 0,
            lalao: 0,
            hoditra: ['default'],
            hoditraAnkehitriny: 'default',
            battlePass: 1,
            battlePassXP: 0
        });
    } else {
        await ref.update({
            niditraFarany: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
}

async function makaDataMpampiasa(uid) {
    const doc = await lalao.db.collection('mpilalao').doc(uid).get();
    if (doc.exists) {
        const data = doc.data();
        mpilalao = {...mpilalao, ...data};
        havaozyUI();
    }
}

async function mitahiryData() {
    if (!lalao.mpampiasa) return;
    
    await lalao.db.collection('mpilalao').doc(lalao.mpampiasa.uid).update({
        anarana: mpilalao.anarana,
        level: mpilalao.level,
        xp: mpilalao.xp,
        volamena: mpilalao.volamena,
        diamondra: mpilalao.diamondra,
        fandresena: mpilalao.fandresena,
        vono: mpilalao.vono,
        fahafatesana: mpilalao.fahafatesana,
        lalao: mpilalao.lalao,
        hoditra: mpilalao.hoditra,
        hoditraAnkehitriny: mpilalao.hoditraAnkehitriny,
        battlePass: mpilalao.battlePass,
        battlePassXP: mpilalao.battlePassXP,
        novaina: firebase.firestore.FieldValue.serverTimestamp()
    });
}

function havaozyUI() {
    const anar = document.getElementById('playerNameMini');
    const lvl = document.getElementById('playerLevelMini');
    const vola = document.getElementById('headerCoins');
    const diam = document.getElementById('headerDiamonds');
    
    if (anar) anar.textContent = mpilalao.anarana;
    if (lvl) lvl.textContent = 'Lv.' + mpilalao.level;
    if (vola) vola.textContent = formatNomera(mpilalao.volamena);
    if (diam) diam.textContent = formatNomera(mpilalao.diamondra);
}

function asehoEfijery(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id)?.classList.remove('hidden');
    lalao.efijery = id;
}

function asehoAuth() {
    asehoEfijery('authScreen');
}

function asehoMenu() {
    asehoEfijery('mainMenu');
    havaozyUI();
    makaOnline();
}

function asehoLobby() {
    asehoEfijery('lobbyScreen');
}

function asehoPanel(id) {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(id)?.classList.remove('hidden');
}

function afenoPanel(id) {
    document.getElementById(id)?.classList.add('hidden');
}

function formatNomera(isa) {
    if (isa >= 1000000) return (isa / 1000000).toFixed(1) + 'M';
    if (isa >= 1000) return (isa / 1000).toFixed(1) + 'K';
    return isa.toString();
}

function asehoToast(hafatra, karazana = 'info', fotoana = 3000) {
    const fito = document.getElementById('toastContainer');
    if (!fito) return;
    
    const t = document.createElement('div');
    t.className = `toast toast-${karazana}`;
    t.textContent = hafatra;
    fito.appendChild(t);
    
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
    }, fotoana);
}

function asehoNotification(lohateny, hafatra, karazana = 'info') {
    const fito = document.getElementById('notificationContainer');
    if (!fito) return;
    
    const n = document.createElement('div');
    n.className = `notification ${karazana}`;
    n.innerHTML = `
        <div class="notification-icon">${saryNotification(karazana)}</div>
        <div class="notification-content">
            <div class="notification-title">${lohateny}</div>
            <div class="notification-message">${hafatra}</div>
        </div>
    `;
    fito.appendChild(n);
    
    setTimeout(() => {
        n.classList.add('fade-out');
        setTimeout(() => n.remove(), 400);
    }, 5000);
}

function saryNotification(k) {
    const s = {success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️'};
    return s[k] || 'ℹ️';
}

function asehoError(hafatra) {
    asehoNotification('Hadisoana', hafatra, 'error');
}

function amboaryEventListeners() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
        }
    });
    window.addEventListener('beforeunload', e => {
        if (lalao.efijery === 'game') {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

function makaOnline() {
    lalao.socket.emit('makaOnline');
    lalao.socket.on('onlineValiny', (isa) => {
        const el = document.getElementById('onlineCount');
        if (el) el.textContent = formatNomera(isa);
    });
}

function manombokaLalaoVaovao(mode) {
    if (!lalao.socket) return;
    
    lalao.socket.emit('mamoronaLobby', {
        mode: mode,
        mpilalao: {
            uid: mpilalao.uid,
            anarana: mpilalao.anarana,
            level: mpilalao.level,
            hoditra: mpilalao.hoditraAnkehitriny
        }
    });
    
    lalao.socket.once('lobbyVoavoatra', (data) => {
        asehoLobby();
        asehoToast('Lobby voaforona', 'success');
    });
}

function miditraLobby(id) {
    lalao.socket.emit('miditraLobby', {
        id: id,
        mpilalao: {
            uid: mpilalao.uid,
            anarana: mpilalao.anarana,
            level: mpilalao.level
        }
    });
}

function mialaLobby() {
    lalao.socket.emit('mialaLobby');
    asehoMenu();
}

function mandefaChat(hafatra) {
    if (!hafatra.trim()) return;
    lalao.socket.emit('chatLobby', {
        hafatra: hafatra.substring(0, 200),
        anarana: mpilalao.anarana,
        fotoana: Date.now()
    });
}

function mifidyMode(mode) {
    lalao.socket.emit('ovayMode', {mode});
}

function mifidyFitaovana(fitaovana) {
    lalao.socket.emit('ovayFitaovana', {fitaovana});
}

function vononaHilalao() {
    lalao.socket.emit('vonona');
}

function mividyZavatra(id, vidiny) {
    if (mpilalao.volamena < vidiny) {
        asehoToast('Tsy ampy volamena', 'error');
        return;
    }
    
    lalao.socket.emit('mividy', {id, vidiny});
    
    lalao.socket.once('vidyValiny', (valiny) => {
        if (valiny.vita) {
            mpilalao.volamena -= vidiny;
            mpilalao.hoditra.push(id);
            mitahiryData();
            havaozyUI();
            asehoToast('Vita ny fividianana', 'success');
        } else {
            asehoToast('Tsy nety', 'error');
        }
    });
}

function manokatraBattlePass() {
    asehoPanel('battlePassMenu');
    lalao.socket.emit('makaBattlePass');
    
    lalao.socket.once('battlePassData', (data) => {
        asehoBattlePass(data);
    });
}

function makaValisoa(level) {
    lalao.socket.emit('makaValisoa', {level});
}

function manokatraInventory() {
    asehoPanel('inventoryMenu');
    asehoInventory();
}

function asehoInventory() {
    const fito = document.getElementById('inventoryGrid');
    if (!fito) return;
    
    fito.innerHTML = '';
    mpilalao.hoditra.forEach(h => {
        const el = document.createElement('div');
        el.className = 'inventory-item';
        el.innerHTML = `<div class="skin-emoji">👤</div><div>${h}</div>`;
        el.onclick = () => mifidyHoditra(h);
        fito.appendChild(el);
    });
}

function mifidyHoditra(hoditra) {
    mpilalao.hoditraAnkehitriny = hoditra;
    mitahiryData();
    asehoToast('Hoditra voafidy', 'success');
    afenoPanel('inventoryMenu');
}

function manokatraSettings() {
    asehoPanel('settingsPanel');
}

function mitahirySettings() {
    const s = mpilalao.settings || {};
    s.sensitivity = parseFloat(document.getElementById('sensitivitySlider').value);
    s.volume = parseInt(document.getElementById('volumeSlider').value);
    mpilalao.settings = s;
    mitahiryData();
    asehoToast('Settings voatahiry', 'success');
}

function manokatraProfile() {
    asehoPanel('profileMenu');
    const anar = document.getElementById('profileUsername');
    if (anar) anar.value = mpilalao.anarana;
}

function manovaAnarana() {
    const vaovao = document.getElementById('profileUsername').value.trim();
    if (vaovao.length < 3) {
        asehoToast('Anarana fohy', 'error');
        return;
    }
    
    mpilalao.anarana = vaovao;
    mitahiryData();
    lalao.mpampiasa.updateProfile({displayName: vaovao});
    havaozyUI();
    asehoToast('Anarana novaina', 'success');
}

function manokatraShop() {
    asehoPanel('shopMenu');
    lalao.socket.emit('makaShop');
    
    lalao.socket.once('shopData', (zavatra) => {
        asehoShop(zavatra);
    });
}

function asehoShop(zavatra) {
    const fito = document.getElementById('shopGrid');
    if (!fito) return;
    
    fito.innerHTML = '';
    zavatra.forEach(z => {
        const el = document.createElement('div');
        el.className = 'shop-item';
        el.innerHTML = `
            <div class="item-image">${z.sary}</div>
            <h4>${z.anarana}</h4>
            <div class="item-price">${z.vidiny} 💰</div>
            <button onclick="mividyZavatra('${z.id}', ${z.vidiny})" class="buy-btn">Vidio</button>
        `;
        fito.appendChild(el);
    });
}

function manokatraLeaderboard() {
    asehoPanel('fullLeaderboard');
    lalao.socket.emit('makaLeaderboard');
    
    lalao.socket.once('leaderboardData', (lisitra) => {
        asehoLeaderboard(lisitra);
    });
}

function asehoLeaderboard(lisitra) {
    const tbody = document.querySelector('#leaderboardTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    lisitra.forEach((p, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${p.anarana}</td>
            <td>${p.level}</td>
            <td>${p.vono}</td>
            <td>${p.fandresena}</td>
        `;
        tbody.appendChild(tr);
    });
}

function mandefaHafatraMail() {
    const hafatra = document.getElementById('mailInput').value;
    if (!hafatra) return;
    
    lalao.socket.emit('mandefaMail', {hafatra});
    asehoToast('Lasa ny hafatra', 'success');
}

function makaMail() {
    lalao.socket.emit('makaMail');
    lalao.socket.once('mailData', (mail) => {
        asehoMail(mail);
    });
}

function asehoMail(mail) {
    const fito = document.getElementById('mailList');
    if (!fito) return;
    
    fito.innerHTML = '';
    mail.forEach(m => {
        const el = document.createElement('div');
        el.className = 'mail-item';
        el.innerHTML = `
            <div class="mail-sender">${m.nandefa}</div>
            <div class="mail-subject">${m.lohateny}</div>
            <div class="mail-preview">${m.votoatiny}</div>
        `;
        fito.appendChild(el);
    });
}

function mialaAdmin() {
    if (confirm('Hiala admin?')) {
        window.location.href = '/';
    }
}

function manokatraCredits() {
    asehoEfijery('creditsScreen');
}

function miverinaMenu() {
    asehoMenu();
}

function kisendrasendra(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function manakana(a, min, max) {
    return Math.max(min, Math.min(max, a));
}

function halavirana(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function mamoronaId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function mamadikaFotoana(segondra) {
    const min = Math.floor(segondra / 60);
    const sec = Math.floor(segondra % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

function mandikaClipboard(soratra) {
    navigator.clipboard.writeText(soratra).then(() => {
        asehoToast('Nadika', 'success');
    });
}

function alefaSon(fe) {
    if (mpilalao.settings?.volume > 0) {
        const audio = new Audio(`/sounds/${fe}.mp3`);
        audio.volume = mpilalao.settings.volume / 100;
        audio.play().catch(() => {});
    }
}

function manombokaLalaoServer(data) {
    asehoEfijery('gameScreen');
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    lalao.socket.on('gameUpdate', (state) => {
        saryLalao(ctx, state);
    });
    
    lalao.socket.on('lalaoTapitra', (vokatra) => {
        asehoVokatra(vokatra);
    });
}

function saryLalao(ctx, state) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#0a0015';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    state.mpilalao.forEach(p => {
        ctx.fillStyle = p.uid === mpilalao.uid ? '#ff006e' : '#9d4edd';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(p.anarana, p.x - 20, p.y - 25);
    });
}

function mihetsika(tari) {
    lalao.socket.emit('mihetsika', {tari});
}

function mitifitra(tari) {
    lalao.socket.emit('mitifitra', {tari});
}

function mamerinaBasy() {
    lalao.socket.emit('reload');
}

function mampiasaFitsaboana() {
    lalao.socket.emit('fahasitranana');
}

function manipyGrenady(tari) {
    lalao.socket.emit('grenady', {tari});
}

function asehoVokatra(vokatra) {
    if (vokatra.fandresena) {
        asehoEfijery('victoryScreen');
        document.getElementById('victoryKills').textContent = vokatra.vono;
    } else {
        asehoEfijery('deathScreen');
        document.getElementById('deathKills').textContent = vokatra.vono;
    }
    
    mpilalao.vono += vokatra.vono;
    mpilalao.lalao += 1;
    if (vokatra.fandresena) mpilalao.fandresena += 1;
    else mpilalao.fahafatesana += 1;
    
    mitahiryData();
}

function miverinaLobby() {
    lalao.socket.emit('miverinaLobby');
    asehoLobby();
}

let lobby = {
    id: null,
    tompony: false,
    mpilalao: [],
    mode: 'battle_royale',
    fitaovana: 'ak47',
    isaMax: 100,
    countdown: 60,
    mandeha: false,
    fotoana: null,
    chat: [],
    vonona: new Set()
};

function amboaryLobbyListeners() {
    if (!lalao.socket) return;

    const s = lalao.socket;

    s.on('lobbyNoforonina', (data) => {
        lobby.id = data.id;
        lobby.tompony = true;
        lobby.mpilalao = data.mpilalao;
        lobby.mode = data.mode;
        asehoLobby();
        havaozyLobby();
        manombokaCountdown(data.countdown);
        asehoToast('Lobby voaforona', 'success');
        alefaSon('lobby');
    });

    s.on('lobbyNiditra', (data) => {
        lobby.id = data.id;
        lobby.tompony = data.tompony;
        lobby.mpilalao = data.mpilalao;
        lobby.mode = data.mode;
        asehoLobby();
        havaozyLobby();
        if (data.countdownMandeha) {
            manombokaCountdown(data.countdown);
        }
        asehoToast('Tafiditra lobby', 'success');
    });

    s.on('mpilalaoNiditra', (data) => {
        lobby.mpilalao.push(data.mpilalao);
        havaozyLobby();
        asehoToast(data.mpilalao.anarana + ' niditra', 'info');
        ampianaChatSystem(data.mpilalao.anarana + ' niditra');
        alefaSon('join');
    });

    s.on('mpilalaoNiala', (data) => {
        const index = lobby.mpilalao.findIndex(p => p.uid === data.uid);
        if (index!== -1) {
            const anar = lobby.mpilalao[index].anarana;
            lobby.mpilalao.splice(index, 1);
            havaozyLobby();
            asehoToast(anar + ' niala', 'info');
            ampianaChatSystem(anar + ' niala');
        }
    });

    s.on('tomponyNiova', (data) => {
        lobby.mpilalao.forEach(p => {
            p.tompony = (p.uid === data.uidVaovao);
        });
        lobby.tompony = (data.uidVaovao === mpilalao.uid);
        havaozyLobby();
        asehoToast('Tompony vaovao: ' + data.anarana, 'info');
        if (lobby.tompony) {
            asehoToast('Ianao no tompony', 'success');
        }
    });

    s.on('lobbyNohavaozina', (data) => {
        if (data.mpilalao) lobby.mpilalao = data.mpilalao;
        if (data.mode) lobby.mode = data.mode;
        if (data.fitaovana) lobby.fitaovana = data.fitaovana;
        havaozyLobby();
    });

    s.on('countdownNohavaozina', (data) => {
        if (data.mandeha) {
            manombokaCountdown(data.fotoana);
        } else {
            atsahatraCountdown();
        }
    });

    s.on('chatLobby', (data) => {
        raisoChat(data);
    });

    s.on('vononaNohavaozina', (data) => {
        if (data.vonona) {
            lobby.vonona.add(data.uid);
        } else {
            lobby.vonona.delete(data.uid);
        }
        havaozyVonona();
    });

    s.on('matchHita', (data) => {
        afenoMatchmaking();
        asehoFanekenaMatch(data);
    });

    s.on('matchManomboka', (data) => {
        asehoToast('Manomboka ao anatin ny 3...', 'success');
        setTimeout(() => {
            manombokaLalaoServer(data);
        }, 3000);
    });

    s.on('matchFoana', (data) => {
        afenoMatchmaking();
        asehoToast('Foana: ' + data.antony, 'warning');
    });
}

function havaozyLobby() {
    havaozyIsanMpilalao();
    asehoMpilalaoLobby();
    havaozyModeAseho();
    havaozyIdLobby();
    havaozyFanarahaMasoTompony();
}

function havaozyIsanMpilalao() {
    const isa = document.getElementById('lobbyPlayerCount');
    const max = document.getElementById('lobbyPlayerMax');
    if (isa) isa.textContent = lobby.mpilalao.length;
    if (max) max.textContent = lobby.isaMax;
}

function asehoMpilalaoLobby() {
    const fito = document.getElementById('lobbyPlayersList');
    if (!fito) return;

    fito.innerHTML = '';

    lobby.mpilalao.forEach(p => {
        const el = document.createElement('div');
        el.className = 'player-tag';
        const vonona = lobby.vonona.has(p.uid)? '✓' : '';
        const satroka = p.tompony? '👑' : '👤';

        el.innerHTML = `
            <span class="player-tag-icon">${satroka}</span>
            <span class="player-tag-name">${p.anarana}</span>
            <span class="player-tag-level">Lv.${p.level}</span>
            <span class="ready-badge">${vonona}</span>
        `;

        if (lobby.tompony &&!p.tompony && p.uid!== mpilalao.uid) {
            el.onclick = () => asehoMenuMpilalao(p);
        }

        fito.appendChild(el);
    });
}

function havaozyModeAseho() {
    const el = document.getElementById('lobbyModeDisplay');
    if (!el) return;

    const anarana = {
        'battle_royale': 'BATTLE ROYALE',
        'team_deathmatch': 'TEAM DEATHMATCH',
        'squad': 'SQUAD'
    };

    el.textContent = anarana[lobby.mode] || lobby.mode.toUpperCase();
}

function havaozyIdLobby() {
    const el = document.getElementById('lobbyRoomId');
    if (el && lobby.id) {
        el.textContent = 'ID: ' + lobby.id.substring(0, 8).toUpperCase();
        el.onclick = () => mandikaClipboard(lobby.id);
    }
}

function havaozyFanarahaMasoTompony() {
    document.querySelectorAll('.host-only').forEach(el => {
        el.style.display = lobby.tompony? 'block' : 'none';
    });
}

function manombokaCountdown(segondra) {
    atsahatraCountdown();

    lobby.countdown = segondra;
    lobby.mandeha = true;

    havaozyCountdown();

    lobby.fotoana = setInterval(() => {
        lobby.countdown--;
        havaozyCountdown();

        if (lobby.countdown <= 0) {
            atsahatraCountdown();
        }
    }, 1000);
}

function atsahatraCountdown() {
    if (lobby.fotoana) {
        clearInterval(lobby.fotoana);
        lobby.fotoana = null;
    }
    lobby.mandeha = false;
}

function havaozyCountdown() {
    const el = document.getElementById('lobbyCountdown');
    const feno = document.getElementById('countdownFill');

    if (el) {
        const min = Math.floor(lobby.countdown / 60);
        const sec = lobby.countdown % 60;
        el.textContent = `${min}:${sec.toString().padStart(2, '0')}`;

        if (lobby.countdown <= 10) {
            el.style.color = '#ff4444';
        } else {
            el.style.color = '';
        }
    }

    if (feno) {
        const isanjato = (lobby.countdown / 60) * 100;
        feno.style.width = isanjato + '%';
    }
}

function mamoronaLobby(mode) {
    if (!lalao.socket) return;

    lalao.socket.emit('mamoronaLobby', {
        mode: mode,
        mpilalao: {
            uid: mpilalao.uid,
            anarana: mpilalao.anarana,
            level: mpilalao.level,
            hoditra: mpilalao.hoditraAnkehitriny
        }
    });
}

function miditraLobbyId(id) {
    if (!lalao.socket ||!id) return;

    lalao.socket.emit('miditraLobby', {
        id: id,
        mpilalao: {
            uid: mpilalao.uid,
            anarana: mpilalao.anarana,
            level: mpilalao.level,
            hoditra: mpilalao.hoditraAnkehitriny
        }
    });
}

function mialaAminLobby() {
    if (lobby.id && lalao.socket) {
        lalao.socket.emit('mialaLobby', {id: lobby.id});
    }

    atsahatraCountdown();
    lobby = {
        id: null,
        tompony: false,
        mpilalao: [],
        mode: 'battle_royale',
        fitaovana: 'ak47',
        isaMax: 100,
        countdown: 60,
        mandeha: false,
        fotoana: null,
        chat: [],
        vonona: new Set()
    };

    afenoChat();
    asehoMenu();
}

function manovaModeLobby(mode) {
    if (!lobby.tompony) {
        asehoToast('Tompony ihany', 'warning');
        return;
    }

    lobby.mode = mode;
    lalao.socket.emit('manovaMode', {
        id: lobby.id,
        mode: mode
    });

    havaozyModeAseho();
}

function manovaFitaovanaLobby(fitaovana) {
    lobby.fitaovana = fitaovana;

    document.querySelectorAll('.weapon-select-btn').forEach(b => {
        b.classList.remove('selected');
    });

    const voafidy = document.querySelector(`[data-weapon="${fitaovana}"]`);
    if (voafidy) voafidy.classList.add('selected');

    const anar = document.getElementById('selectedWeaponName');
    if (anar) anar.textContent = fitaovana.toUpperCase();

    lalao.socket.emit('manovaFitaovana', {
        id: lobby.id,
        fitaovana: fitaovana
    });
}

function manovaVonona() {
    const efaVonona = lobby.vonona.has(mpilalao.uid);

    if (efaVonona) {
        lobby.vonona.delete(mpilalao.uid);
    } else {
        lobby.vonona.add(mpilalao.uid);
    }

    lalao.socket.emit('manovaVonona', {
        id: lobby.id,
        vonona:!efaVonona
    });

    havaozyVonona();
}

function havaozyVonona() {
    const bokotra = document.getElementById('readyButton');
    if (!bokotra) return;

    const vonona = lobby.vonona.has(mpilalao.uid);
    bokotra.textContent = vonona? 'TSY VONONA' : 'VONONA';
    bokotra.className = vonona? 'ready-btn not-ready' : 'ready-btn';
}

function manombokaMatch() {
    if (!lobby.tompony) return;

    lalao.socket.emit('manombokaMatch', {id: lobby.id});
}

function amboaryChat() {
    const soratra = document.getElementById('lobbyChatInput');
    const bokotra = document.getElementById('lobbyChatSend');

    if (soratra) {
        soratra.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                alefaChat();
            }
        });
    }

    if (bokotra) {
        bokotra.addEventListener('click', alefaChat);
    }
}

function alefaChat() {
    const soratra = document.getElementById('lobbyChatInput');
    if (!soratra) return;

    const hafatra = soratra.value.trim();
    if (!hafatra) return;

    if (hafatra.length > 200) {
        asehoToast('Lava loatra', 'warning');
        return;
    }

    lalao.socket.emit('alefaChat', {
        id: lobby.id,
        hafatra: hafatra
    });

    soratra.value = '';
}

function raisoChat(data) {
    lobby.chat.push(data);

    if (lobby.chat.length > 100) {
        lobby.chat.shift();
    }

    asehoChat(data);
}

function asehoChat(data) {
    const fito = document.getElementById('lobbyChatMessages');
    if (!fito) return;

    const el = document.createElement('div');
    el.className = 'chat-message';

    const fotoana = new Date(data.fotoana).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const loko = makaLokoMpilalao(data.uid);

    el.innerHTML = `
        <span class="chat-time">[${fotoana}]</span>
        <span class="chat-username" style="color:${loko}">${data.anarana}:</span>
        <span class="chat-text">${data.hafatra}</span>
    `;

    fito.appendChild(el);
    fito.scrollTop = fito.scrollHeight;

    if (data.uid!== mpilalao.uid) {
        alefaSon('chat');
    }
}

function makaLokoMpilalao(uid) {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    }
    const loko = ['#ff006e', '#9d4edd', '#3a86ff', '#06ffa5', '#ffaa00'];
    return loko[Math.abs(hash) % loko.length];
}

function ampianaChatSystem(hafatra) {
    raisoChat({
        uid: 'system',
        anarana: 'RAFITRA',
        hafatra: hafatra,
        fotoana: Date.now()
    });
}

function afenoChat() {
    const fito = document.getElementById('lobbyChatMessages');
    if (fito) fito.innerHTML = '';
    lobby.chat = [];
}

function mitadyMatchHaingana(mode) {
    if (!lalao.socket) return;

    asehoMatchmaking(mode);

    lalao.socket.emit('mitadyMatch', {
        mode: mode,
        mpilalao: {
            uid: mpilalao.uid,
            anarana: mpilalao.anarana,
            level: mpilalao.level
        }
    });

    manombokaFotoanaMatchmaking();
}

function asehoMatchmaking(mode) {
    const overlay = document.createElement('div');
    overlay.id = 'matchmakingOverlay';
    overlay.className = 'matchmaking-overlay';
    overlay.innerHTML = `
        <div class="matchmaking-content">
            <div class="matchmaking-spinner"></div>
            <h2>Mitady mpilalao...</h2>
            <p>Mode: ${mode.toUpperCase()}</p>
            <p class="matchmaking-timer" id="matchmakingTimer">0:00</p>
            <button onclick="ajanonaMatchmaking()" class="cancel-btn">Ajanona</button>
        </div>
    `;
    document.body.appendChild(overlay);
}

function afenoMatchmaking() {
    const el = document.getElementById('matchmakingOverlay');
    if (el) el.remove();
    atsahatraFotoanaMatchmaking();
}

function manombokaFotoanaMatchmaking() {
    let segondra = 0;
    const el = document.getElementById('matchmakingTimer');

    lobby.fotoanaMatchmaking = setInterval(() => {
        segondra++;
        if (el) {
            el.textContent = mamadikaFotoana(segondra);
        }
    }, 1000);
}

function atsahatraFotoanaMatchmaking() {
    if (lobby.fotoanaMatchmaking) {
        clearInterval(lobby.fotoanaMatchmaking);
        lobby.fotoanaMatchmaking = null;
    }
}

function ajanonaMatchmaking() {
    lalao.socket.emit('ajanonaMitady');
    afenoMatchmaking();
    asehoToast('Najanona', 'info');
}

function asehoFanekenaMatch(data) {
    const hafatra = `Mpilalao: ${data.isa}/${data.max}\nSarintany: ${data.sarintany}\nManomboka afaka 10 segondra`;

    showConfirmDialog('Match Hita!', hafatra,
        () => manaikyMatch(data.id),
        () => mandàMatch(data.id)
    );

    setTimeout(() => {
        const dialog = document.getElementById('confirmDialog');
        if (dialog &&!dialog.classList.contains('hidden')) {
            manaikyMatch(data.id);
        }
    }, 8000);
}

function manaikyMatch(id) {
    lalao.socket.emit('manaikyMatch', {id});
    asehoToast('Nekena', 'success');
    document.getElementById('confirmDialog')?.classList.add('hidden');
}

function mandàMatch(id) {
    lalao.socket.emit('mandàMatch', {id});
    asehoToast('Nolavina', 'info');
    document.getElementById('confirmDialog')?.classList.add('hidden');
}

function asehoMenuMpilalao(p) {
    if (!lobby.tompony) return;

    const safidy = confirm(`${p.anarana}\n\nTe hamoaka?`);
    if (safidy) {
        lalao.socket.emit('avoakaMpilalao', {
            id: lobby.id,
            uid: p.uid
        });
    }
}

function makaLobbyListe() {
    lalao.socket.emit('makaLobbyListe');

    lalao.socket.once('lobbyListe', (lisitra) => {
        asehoLobbyListe(lisitra);
    });
}

function asehoLobbyListe(lisitra) {
    const fito = document.getElementById('lobbyListContainer');
    if (!fito) return;

    fito.innerHTML = '';

    lisitra.forEach(l => {
        const el = document.createElement('div');
        el.className = 'lobby-item';
        el.innerHTML = `
            <div class="lobby-info">
                <div class="lobby-mode">${l.mode}</div>
                <div class="lobby-players">${l.isa}/${l.max}</div>
            </div>
            <button onclick="miditraLobbyId('${l.id}')" class="join-btn">Miditra</button>
        `;
        fito.appendChild(el);
    });
}

function mamerinaLobby() {
    if (lobby.id) {
        lalao.socket.emit('mamerinaLobby', {id: lobby.id});
    }
}

amboaryLobbyListeners();
amboaryChat();

let lalaoEo = {
    canvas: null,
    ctx: null,
    mandeha: false,
    state: null,
    mpilalaoTaloha: new Map(),
    fotoana: 0,
    faritra: {x: 0, y: 0, radius: 5000},
    faritraManaraka: {x: 0, y: 0, radius: 4000},
    sarintany: null,
    fanalahidy: {},
    totozy: {x: 0, y: 0, tsindry: false},
    fakan-tsary: {x: 0, y: 0, zoom: 1}
};

function manombokaLalaoEo(data) {
    lalaoEo.canvas = document.getElementById('gameCanvas');
    lalaoEo.ctx = lalaoEo.canvas.getContext('2d');

    lalaoEo.canvas.width = window.innerWidth;
    lalaoEo.canvas.height = window.innerHeight;

    lalaoEo.mandeha = true;
    lalaoEo.state = data.state;
    lalaoEo.faritra = data.faritra;

    amboaryFanaraha();
    mihainoFanavaozana();
    manombokaRender();

    asehoToast('Lalao manomboka', 'success');
}

function mihainoFanavaozana() {
    lalao.socket.on('fanavaozanaLalao', (data) => {
        lalaoEo.state = data.state;
        lalaoEo.fotoana = data.fotoana;
        if (data.faritra) lalaoEo.faritra = data.faritra;
        if (data.faritraManaraka) lalaoEo.faritraManaraka = data.faritraManaraka;
    });

    lalao.socket.on('mpilalaoMaty', (data) => {
        raisoFahafatesana(data);
    });

    lalao.socket.on('mpilalaoNandresy', (data) => {
        raisoFandresena(data);
    });

    lalao.socket.on('fahasimbana', (data) => {
        raisoFahasimbana(data);
        havaozyFahasalamana(data.fahasalamana);
    });

    lalao.socket.on('balaLany', () => {
        havaozyBala(0);
        alefaSon('reload');
    });

    lalao.socket.on('fitaovanaNovaina', (data) => {
        havaozyFitaovana(data);
    });

    lalao.socket.on('faritraMiova', (data) => {
        lalaoEo.faritraManaraka = data.vaovao;
        asehoFampitandremanaFaritra();
    });
}

function manombokaRender() {
    function render() {
        if (!lalaoEo.mandeha) return;

        saryRehetra();
        havaozyHUD();

        requestAnimationFrame(render);
    }
    render();
}

function saryRehetra() {
    const ctx = lalaoEo.ctx;
    const canvas = lalaoEo.canvas;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0a0015';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!lalaoEo.state) return;

    const ahy = lalaoEo.state.mpilalao.find(p => p.uid === mpilalao.uid);
    if (ahy) {
        lalaoEo.fakan-tsary.x = ahy.x - canvas.width / 2;
        lalaoEo.fakan-tsary.y = ahy.y - canvas.height / 2;
    }

    ctx.save();
    ctx.translate(-lalaoEo.fakan-tsary.x, -lalaoEo.fakan-tsary.y);

    sarySarintany(ctx);
    saryFaritraMena(ctx);
    saryFaritraManaraka(ctx);
    saryLoot(ctx);
    saryBalaRehetra(ctx);
    saryMpilalaoRehetra(ctx);
    saryGrenady(ctx);

    ctx.restore();

    saryTandrifana(ctx);
    saryFamantarana(ctx);
}

function sarySarintany(ctx) {
    ctx.fillStyle = '#1a0033';
    ctx.fillRect(-5000, -5000, 10000, 10000);

    ctx.strokeStyle = '#2a0044';
    ctx.lineWidth = 2;

    for (let x = -5000; x <= 5000; x += 200) {
        ctx.beginPath();
        ctx.moveTo(x, -5000);
        ctx.lineTo(x, 5000);
        ctx.stroke();
    }

    for (let y = -5000; y <= 5000; y += 200) {
        ctx.beginPath();
        ctx.moveTo(-5000, y);
        ctx.lineTo(5000, y);
        ctx.stroke();
    }
}

function saryFaritraMena(ctx) {
    const f = lalaoEo.faritra;

    ctx.fillStyle = 'rgba(255, 0, 110, 0.1)';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ff006e';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#ff006e';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function saryFaritraManaraka(ctx) {
    const f = lalaoEo.faritraManaraka;
    if (!f) return;

    ctx.strokeStyle = 'rgba(157, 78, 221, 0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 20]);
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
}

function saryMpilalaoRehetra(ctx) {
    if (!lalaoEo.state ||!lalaoEo.state.mpilalao) return;

    lalaoEo.state.mpilalao.forEach(p => {
        saryMpilalaoIray(ctx, p);
    });
}

function saryMpilalaoIray(ctx, p) {
    const taloha = lalaoEo.mpilalaoTaloha.get(p.uid) || p;
    const x = taloha.x + (p.x - taloha.x) * 0.3;
    const y = taloha.y + (p.y - taloha.y) * 0.3;

    lalaoEo.mpilalaoTaloha.set(p.uid, {x, y});

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.zoro || 0);

    const loko = p.uid === mpilalao.uid? '#ff006e' : p.ekipa === 'mena'? '#ff4444' : '#9d4edd';

    ctx.fillStyle = loko;
    ctx.shadowColor = loko;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#1a0033';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(p.anarana.substring(0, 8), 0, -35);

    const fahasalamanaIsanjato = p.fahasalamana / 100;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(-25, 28, 50, 6);
    ctx.fillStyle = fahasalamanaIsanjato > 0.5? '#06ffa5' : fahasalamanaIsanjato > 0.2? '#ffaa00' : '#ff4444';
    ctx.fillRect(-25, 28, 50 * fahasalamanaIsanjato, 6);

    if (p.mitifitra) {
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(40, 0);
        ctx.stroke();
    }

    ctx.restore();
}

function saryBalaRehetra(ctx) {
    if (!lalaoEo.state ||!lalaoEo.state.bala) return;

    ctx.fillStyle = '#ffaa00';
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 10;

    lalaoEo.state.bala.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.shadowBlur = 0;
}

function saryGrenady(ctx) {
    if (!lalaoEo.state ||!lalaoEo.state.grenady) return;

    lalaoEo.state.grenady.forEach(g => {
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(g.x, g.y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,68,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.radius || 0, 0, Math.PI * 2);
        ctx.stroke();
    });
}

function saryLoot(ctx) {
    if (!lalaoEo.state ||!lalaoEo.state.loot) return;

    lalaoEo.state.loot.forEach(l => {
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 15;
        ctx.font = '24px Arial';
        ctx.fillText('📦', l.x - 12, l.y + 8);
        ctx.shadowBlur = 0;
    });
}

function saryTandrifana(ctx) {
    const canvas = lalaoEo.canvas;
    ctx.strokeStyle = 'rgba(255, 0, 110, 0.8)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff006e';
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 20, canvas.height / 2);
    ctx.lineTo(canvas.width / 2 + 20, canvas.height / 2);
    ctx.moveTo(canvas.width / 2, canvas.height / 2 - 20);
    ctx.lineTo(canvas.width / 2, canvas.height / 2 + 20);
    ctx.stroke();

    ctx.shadowBlur = 0;
}

function saryFamantarana(ctx) {
    if (!lalaoEo.state) return;

    const ahy = lalaoEo.state.mpilalao.find(p => p.uid === mpilalao.uid);
    if (!ahy) return;

    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Fahasalamana: ${Math.floor(ahy.fahasalamana)}`, 20, 40);
    ctx.fillText(`Bala: ${ahy.bala}`, 20, 65);
    ctx.fillText(`Vono: ${ahy.vono}`, 20, 90);
}

function amboaryFanaraha() {
    window.addEventListener('keydown', (e) => {
        lalaoEo.fanalahidy[e.code] = true;
        alefaHetsika();
    });

    window.addEventListener('keyup', (e) => {
        lalaoEo.fanalahidy[e.code] = false;
        alefaHetsika();
    });

    lalaoEo.canvas.addEventListener('mousemove', (e) => {
        const rect = lalaoEo.canvas.getBoundingClientRect();
        lalaoEo.totozy.x = e.clientX - rect.left;
        lalaoEo.totozy.y = e.clientY - rect.top;

        const ahy = lalaoEo.state.mpilalao.find(p => p.uid === mpilalao.uid);
        if (ahy) {
            const zoro = Math.atan2(
                lalaoEo.totozy.y - lalaoEo.canvas.height / 2,
                lalaoEo.totozy.x - lalaoEo.canvas.width / 2
            );
            lalao.socket.emit('manodina', {zoro});
        }
    });

    lalaoEo.canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            lalaoEo.totozy.tsindry = true;
            alefaTifitra();
        }
    });

    lalaoEo.canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            lalaoEo.totozy.tsindry = false;
            lalao.socket.emit('ajanonaTifitra');
        }
    });

    window.addEventListener('resize', () => {
        lalaoEo.canvas.width = window.innerWidth;
        lalaoEo.canvas.height = window.innerHeight;
    });
}

function alefaHetsika() {
    const f = lalaoEo.fanalahidy;
    const hetsika = {
        ambony: f['KeyW'] || f['ArrowUp'],
        ambany: f['KeyS'] || f['ArrowDown'],
        ankavia: f['KeyA'] || f['ArrowLeft'],
        ankavanana: f['KeyD'] || f['ArrowRight'],
        sprint: f['ShiftLeft']
    };

    lalao.socket.emit('hetsika', hetsika);
}

function alefaTifitra() {
    const ahy = lalaoEo.state.mpilalao.find(p => p.uid === mpilalao.uid);
    if (!ahy || ahy.bala <= 0) return;

    const zoro = Math.atan2(
        lalaoEo.totozy.y - lalaoEo.canvas.height / 2,
        lalaoEo.totozy.x - lalaoEo.canvas.width / 2
    );

    lalao.socket.emit('tifitra', {zoro});
    alefaSon('tifitra');
}

function alefaReload() {
    lalao.socket.emit('reload');
    asehoToast('Mamerina bala', 'info');
}

function alefaFitsaboana() {
    lalao.socket.emit('fitsaboana');
}

function alefaGrenady() {
    const zoro = Math.atan2(
        lalaoEo.totozy.y - lalaoEo.canvas.height / 2,
        lalaoEo.totozy.x - lalaoEo.canvas.width / 2
    );
    lalao.socket.emit('grenady', {zoro});
}

function alefaMitsambikina() {
    lalao.socket.emit('mitsambikina');
}

function alefaMiondrika() {
    lalao.socket.emit('miondrika');
}

function havaozyHUD() {
    if (!lalaoEo.state) return;

    const ahy = lalaoEo.state.mpilalao.find(p => p.uid === mpilalao.uid);
    if (!ahy) return;

    const fahasalamana = document.getElementById('healthFill');
    const fahasalamanaIsa = document.getElementById('healthValue');
    const bala = document.getElementById('ammoCount');
    const balaMax = document.getElementById('ammoMax');

    if (fahasalamana) {
        fahasalamana.style.width = ahy.fahasalamana + '%';
    }
    if (fahasalamanaIsa) {
        fahasalamanaIsa.textContent = Math.floor(ahy.fahasalamana);
    }
    if (bala) {
        bala.textContent = ahy.bala;
    }
    if (balaMax) {
        balaMax.textContent = ahy.balaMax || 30;
    }
}

function havaozyFahasalamana(isa) {
    const el = document.getElementById('healthFill');
    if (el) el.style.width = isa + '%';
}

function havaozyBala(isa) {
    const el = document.getElementById('ammoCount');
    if (el) el.textContent = isa;
}

function havaozyFitaovana(data) {
    const el = document.getElementById('currentWeaponName');
    if (el) el.textContent = data.anarana.toUpperCase();
}

function havaozySarintanyKely() {
    const canvas = document.getElementById('minimapCanvas');
    if (!canvas ||!lalaoEo.state) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 200, 200);

    ctx.fillStyle = '#0a0015';
    ctx.fillRect(0, 0, 200, 200);

    const scale = 200 / 10000;

    ctx.strokeStyle = '#ff006e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
        100 + lalaoEo.faritra.x * scale,
        100 + lalaoEo.faritra.y * scale,
        lalaoEo.faritra.radius * scale,
        0, Math.PI * 2
    );
    ctx.stroke();

    lalaoEo.state.mpilalao.forEach(p => {
        const x = 100 + p.x * scale;
        const y = 100 + p.y * scale;

        ctx.fillStyle = p.uid === mpilalao.uid? '#ff006e' : '#9d4edd';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

function raisoFahasimbana(data) {
    asehoHitmarker();
    alefaSon('hit');

    if (data.avyAmin) {
        const el = document.createElement('div');
        el.className = 'damage-number damage-normal';
        el.textContent = '-' + data.isa;
        el.style.left = '50%';
        el.style.top = '40%';
        document.getElementById('damageNumbers').appendChild(el);

        setTimeout(() => el.remove(), 1200);
    }
}

function raisoFahafatesana(data) {
    lalaoEo.mandeha = false;
    asehoVokatra({
        fandresena: false,
        vono: data.vono,
        laharana: data.laharana
    });
    alefaSon('maty');
}

function raisoFandresena(data) {
    lalaoEo.mandeha = false;
    asehoVokatra({
        fandresena: true,
        vono: data.vono,
        laharana: 1
    });
    alefaSon('fandresena');
}

function asehoHitmarker() {
    const el = document.getElementById('hitmarker');
    if (!el) return;

    el.innerHTML = '<div class="hitmarker-cross"></div>';
    el.style.display = 'block';

    setTimeout(() => {
        el.style.display = 'none';
        el.innerHTML = '';
    }, 200);
}

function asehoFampitandremanaFaritra() {
    const el = document.getElementById('zoneWarning');
    if (!el) return;

    el.classList.remove('hidden');
    alefaSon('faritra');

    setTimeout(() => {
        el.classList.add('hidden');
    }, 3000);
}

function atsahatraLalao() {
    lalaoEo.mandeha = false;
    lalao.socket.removeAllListeners('fanavaozanaLalao');
    lalaoEo.mpilalaoTaloha.clear();
}

document.addEventListener('keydown', (e) => {
    if (!lalaoEo.mandeha) return;

    switch(e.code) {
        case 'KeyR':
            alefaReload();
            break;
        case 'KeyH':
            alefaFitsaboana();
            break;
        case 'KeyG':
            alefaGrenady();
            break;
        case 'Space':
            e.preventDefault();
            alefaMitsambikina();
            break;
        case 'KeyC':
            alefaMiondrika();
            break;
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
            lalao.socket.emit('ovayFitaovana', {laharana: parseInt(e.code[5])});
            break;
    }
});

setInterval(() => {
    if (lalaoEo.mandeha) {
        havaozySarintanyKely();
    }
}, 200);


let shopData = {
    zavatra: [],
    sokajy: 'rehetra',
    fotoana: 0
};

let inventoryData = {
    zavatra: [],
    voafidy: null
};

let battlePassData = {
    level: 1,
    xp: 0,
    premium: false,
    valisoa: []
};

let mailData = {
    hafatra: [],
    tsyVakiana: 0
};

let leaderboardData = {
    lisitra: [],
    toerana: 0
};

function makaShopData() {
    lalao.socket.emit('makaShop');

    lalao.socket.once('shopValiny', (data) => {
        shopData.zavatra = data.zavatra;
        shopData.fotoana = data.fotoanaMiverina;
        asehoShop();
        manombokaFotoanaShop();
    });
}

function asehoShop() {
    const fito = document.getElementById('shopGrid');
    if (!fito) return;

    fito.innerHTML = '';

    const voasivana = shopData.sokajy === 'rehetra' 
        ? shopData.zavatra 
        : shopData.zavatra.filter(z => z.sokajy === shopData.sokajy);

    voasivana.forEach(z => {
        const el = document.createElement('div');
        el.className = 'shop-item' + (z.featured? ' featured' : '');

        const manana = mpilalao.hoditra.includes(z.id);
        const vidiny = z.vidinyFihena || z.vidiny;

        el.innerHTML = `
            ${z.featured? '<div class="item-badge">FEATURED</div>' : ''}
            ${z.vaovao? '<div class="item-badge">VAOVAO</div>' : ''}
            <div class="item-image">${z.sary}</div>
            <h4>${z.anarana}</h4>
            <div class="item-rarity ${z.rarity}">${z.rarity.toUpperCase()}</div>
            <div class="item-desc">${z.famaritana}</div>
            ${z.vidinyFihena? `<div class="item-price-old">${z.vidiny} 💰</div>` : ''}
            <div class="item-price">${vidiny} ${z.vola === 'diamondra'? '💎' : '💰'}</div>
            <button class="buy-btn" ${manana? 'disabled' : ''} onclick="vidioZavatra('${z.id}')">
                ${manana? 'EFA MANANA' : 'VIDIO'}
            </button>
        `;

        fito.appendChild(el);
    });

    havaozyFotoanaShop();
}

function manovaSokajyShop(sokajy) {
    shopData.sokajy = sokajy;

    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active');
    });

    const voafidy = document.querySelector(`[data-filter="${sokajy}"]`);
    if (voafidy) voafidy.classList.add('active');

    asehoShop();
}

function vidioZavatra(id) {
    const zavatra = shopData.zavatra.find(z => z.id === id);
    if (!zavatra) return;

    const vidiny = zavatra.vidinyFihena || zavatra.vidiny;
    const vola = zavatra.vola === 'diamondra'? mpilalao.diamondra : mpilalao.volamena;

    if (vola < vidiny) {
        asehoToast('Tsy ampy vola', 'error');
        alefaSon('error');
        return;
    }

    if (mpilalao.hoditra.includes(id)) {
        asehoToast('Efa manana', 'warning');
        return;
    }

    lalao.socket.emit('mividyZavatra', {id: id});

    lalao.socket.once('fividiananaValiny', (valiny) => {
        if (valiny.vita) {
            if (zavatra.vola === 'diamondra') {
                mpilalao.diamondra -= vidiny;
            } else {
                mpilalao.volamena -= vidiny;
            }

            mpilalao.hoditra.push(id);
            mitahiryData();
            havaozyUI();
            asehoShop();

            asehoToast('Vita fividianana!', 'success');
            alefaSon('vidy');
            asehoNotification('Fividianana', `Nahazo ${zavatra.anarana}`, 'success');
        } else {
            asehoToast(valiny.antony || 'Tsy nety', 'error');
        }
    });
}

function manombokaFotoanaShop() {
    const el = document.getElementById('shopTimer');
    if (!el ||!shopData.fotoana) return;

    function havaozy() {
        const sisa = shopData.fotoana - Date.now();
        if (sisa <= 0) {
            el.textContent = 'Miverina...';
            makaShopData();
            return;
        }

        const ora = Math.floor(sisa / 3600000);
        const min = Math.floor((sisa % 3600000) / 60000);
        const sec = Math.floor((sisa % 60000) / 1000);

        el.textContent = `${ora.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    havaozy();
    setInterval(havaozy, 1000);
}

function havaozyFotoanaShop() {
    const el = document.getElementById('shopRefreshTime');
    if (el && shopData.fotoana) {
        const daty = new Date(shopData.fotoana);
        el.textContent = daty.toLocaleTimeString('fr-FR');
    }
}

function makaInventoryData() {
    lalao.socket.emit('makaInventory');

    lalao.socket.once('inventoryValiny', (data) => {
        inventoryData.zavatra = data.zavatra;
        asehoInventory();
    });
}

function asehoInventory() {
    const fito = document.getElementById('inventoryGrid');
    if (!fito) return;

    fito.innerHTML = '';

    const sokajy = document.querySelector('.inv-tab.active')?.dataset.tab || 'rehetra';
    const voasivana = sokajy === 'rehetra'
        ? inventoryData.zavatra
        : inventoryData.zavatra.filter(z => z.karazana === sokajy);

    voasivana.forEach(z => {
        const el = document.createElement('div');
        el.className = 'inventory-item' + (z.ampiasaina? ' equipped' : '');

        el.innerHTML = `
            <div class="item-icon">${z.sary}</div>
            <div class="item-name">${z.anarana}</div>
            <div class="item-rarity ${z.rarity}">${z.rarity}</div>
            ${z.ampiasaina? '<div class="equipped-badge">✓</div>' : ''}
        `;

        el.onclick = () => mifidyZavatraInventory(z);

        fito.appendChild(el);
    });
}

function mifidyZavatraInventory(zavatra) {
    inventoryData.voafidy = zavatra;

    document.querySelectorAll('.inventory-item').forEach(el => {
        el.classList.remove('selected');
    });

    event.target.closest('.inventory-item').classList.add('selected');

    const info = document.getElementById('itemInfo');
    if (info) {
        info.innerHTML = `
            <h3>${zavatra.anarana}</h3>
            <p>${zavatra.famaritana}</p>
            <button onclick="mampiasaZavatra('${zavatra.id}')" class="use-btn">
                ${zavatra.ampiasaina? 'ESORINA' : 'AMPIASAINA'}
            </button>
        `;
    }
}

function mampiasaZavatra(id) {
    lalao.socket.emit('mampiasaZavatra', {id: id});

    lalao.socket.once('fampiasanaValiny', (valiny) => {
        if (valiny.vita) {
            inventoryData.zavatra.forEach(z => {
                if (z.karazana === valiny.karazana) {
                    z.ampiasaina = (z.id === id);
                }
            });

            if (valiny.karazana === 'hoditra') {
                mpilalao.hoditraAnkehitriny = id;
                mitahiryData();
            }

            asehoInventory();
            asehoToast('Vita', 'success');
        }
    });
}

function manovaTabilaoInventory(tabilao) {
    document.querySelectorAll('.inv-tab').forEach(t => {
        t.classList.remove('active');
    });

    const voafidy = document.querySelector(`[data-tab="${tabilao}"]`);
    if (voafidy) voafidy.classList.add('active');

    asehoInventory();
}

function makaBattlePassData() {
    lalao.socket.emit('makaBattlePass');

    lalao.socket.once('battlePassValiny', (data) => {
        battlePassData = data;
        asehoBattlePass();
    });
}

function asehoBattlePass() {
    const level = document.getElementById('bpLevelNumber');
    const xpText = document.getElementById('bpProgressText');
    const xpFill = document.getElementById('bpProgressFill');

    if (level) level.textContent = battlePassData.level;
    if (xpText) xpText.textContent = `${battlePassData.xp} / 1000 XP`;
    if (xpFill) xpFill.style.width = (battlePassData.xp / 10) + '%';

    const premiumSection = document.getElementById('bpPremiumSection');
    if (premiumSection) {
        premiumSection.style.display = battlePassData.premium? 'none' : 'block';
    }

    asehoValisoaBattlePass();
}

function asehoValisoaBattlePass() {
    const fito = document.getElementById('bpRewardsTrack');
    if (!fito) return;

    fito.innerHTML = '';

    for (let i = 1; i <= 50; i++) {
        const valisoa = battlePassData.valisoa.find(v => v.level === i);
        const azo = i <= battlePassData.level;
        const nalaina = valisoa?.nalaina || false;

        const el = document.createElement('div');
        el.className = 'bp-reward-item' + (azo? ' unlocked' : '') + (valisoa?.premium? ' premium' : '');

        el.innerHTML = `
            <div class="reward-level">${i}</div>
            <div class="reward-icon">${valisoa?.sary || '🎁'}</div>
            <div class="reward-name">${valisoa?.anarana || 'Mystery'}</div>
            ${azo &&!nalaina? `<button class="reward-claim-btn" onclick="makaValisoaBP(${i})">Alaina</button>` : ''}
            ${nalaina? '<div class="claimed">✓</div>' : ''}
        `;

        fito.appendChild(el);
    }
}

function makaValisoaBP(level) {
    lalao.socket.emit('makaValisoaBP', {level: level});

    lalao.socket.once('valisoaValiny', (valiny) => {
        if (valiny.vita) {
            const valisoa = battlePassData.valisoa.find(v => v.level === level);
            if (valisoa) valisoa.nalaina = true;

            if (valiny.karazana === 'volamena') {
                mpilalao.volamena += valiny.isa;
            } else if (valiny.karazana === 'diamondra') {
                mpilalao.diamondra += valiny.isa;
            } else if (valiny.karazana === 'hoditra') {
                mpilalao.hoditra.push(valiny.id);
            }

            mitahiryData();
            havaozyUI();
            asehoBattlePass();

            asehoToast('Valisoa azo!', 'success');
            alefaSon('valisoa');
        }
    });
}

function mividyBattlePassPremium() {
    if (mpilalao.diamondra < 500) {
        asehoToast('Tsy ampy diamondra', 'error');
        return;
    }

    lalao.socket.emit('mividyBPPremium');

    lalao.socket.once('bpPremiumValiny', (valiny) => {
        if (valiny.vita) {
            mpilalao.diamondra -= 500;
            battlePassData.premium = true;
            mitahiryData();
            havaozyUI();
            asehoBattlePass();

            asehoToast('Premium voavidy!', 'success');
            asehoNotification('Battle Pass', 'Premium activated', 'success');
        }
    });
}

function makaProfileData() {
    lalao.socket.emit('makaProfile');

    lalao.socket.once('profileValiny', (data) => {
        asehoProfile(data);
    });
}

function asehoProfile(data) {
    const stats = data.statistika;

    document.getElementById('profileWins').textContent = stats.fandresena || 0;
    document.getElementById('profileKills').textContent = stats.vono || 0;
    document.getElementById('profileMatches').textContent = stats.lalao || 0;
    document.getElementById('profileKD').textContent = stats.lalao > 0? (stats.vono / stats.lalao).toFixed(2) : '0.00';

    const winrate = stats.lalao > 0? Math.round((stats.fandresena / stats.lalao) * 100) : 0;
    document.getElementById('profileWinrate').textContent = winrate + '%';

    asehoZavaBita(data.zavaBita);
}

function asehoZavaBita(lisitra) {
    const fito = document.getElementById('achievementsGrid');
    if (!fito) return;

    fito.innerHTML = '';

    lisitra.forEach(z => {
        const el = document.createElement('div');
        el.className = 'achievement-item' + (z.vita? ' unlocked' : ' locked');

        el.innerHTML = `
            <div class="achievement-icon">${z.sary}</div>
            <div class="achievement-info">
                <div class="achievement-name">${z.anarana}</div>
                <div class="achievement-desc">${z.famaritana}</div>
            </div>
            <div class="achievement-reward">${z.valisoa} 💰</div>
        `;

        fito.appendChild(el);
    });
}

function makaMailData() {
    lalao.socket.emit('makaMail');

    lalao.socket.once('mailValiny', (data) => {
        mailData.hafatra = data.hafatra;
        mailData.tsyVakiana = data.hafatra.filter(m =>!m.vakiana).length;
        asehoMail();
        havaozyMailBadge();
    });
}

function asehoMail() {
    const fito = document.getElementById('mailList');
    if (!fito) return;

    fito.innerHTML = '';

    const sokajy = document.querySelector('.mail-tab.active')?.dataset.tab || 'rehetra';
    let voasivana = mailData.hafatra;

    if (sokajy === 'tsyVakiana') {
        voasivana = voasivana.filter(m =>!m.vakiana);
    } else if (sokajy === 'valisoa') {
        voasivana = voasivana.filter(m => m.valisoa);
    }

    voasivana.forEach(m => {
        const el = document.createElement('div');
        el.className = 'mail-item' + (!m.vakiana? ' unread' : '');

        const daty = new Date(m.fotoana).toLocaleDateString('fr-FR');

        el.innerHTML = `
            <div class="mail-item-header">
                <span class="mail-sender">${m.nandefa}</span>
                <span class="mail-time">${daty}</span>
            </div>
            <div class="mail-subject">${m.lohateny}</div>
            <div class="mail-preview">${m.votoatiny.substring(0, 80)}...</div>
            ${m.valisoa? `<div class="mail-reward">🎁 ${m.valisoa.anarana}</div>` : ''}
        `;

        el.onclick = () => mamakyMail(m.id);

        fito.appendChild(el);
    });

    if (voasivana.length === 0) {
        fito.innerHTML = '<div class="mail-empty">Tsy misy hafatra</div>';
    }
}

function mamakyMail(id) {
    const mail = mailData.hafatra.find(m => m.id === id);
    if (!mail) return;

    lalao.socket.emit('mamakyMail', {id: id});

    if (!mail.vakiana) {
        mail.vakiana = true;
        mailData.tsyVakiana--;
        havaozyMailBadge();
    }

    asehoMailDetail(mail);
}

function asehoMailDetail(mail) {
    const modal = document.getElementById('mailDetailModal');
    if (!modal) return;

    document.getElementById('mailDetailSender').textContent = mail.nandefa;
    document.getElementById('mailDetailSubject').textContent = mail.lohateny;
    document.getElementById('mailDetailBody').textContent = mail.votoatiny;
    document.getElementById('mailDetailTime').textContent = new Date(mail.fotoana).toLocaleString('fr-FR');

    const valisoaBtn = document.getElementById('mailClaimBtn');
    if (mail.valisoa &&!mail.valisoa.nalaina) {
        valisoaBtn.style.display = 'block';
        valisoaBtn.onclick = () => makaValisoaMail(mail.id);
    } else {
        valisoaBtn.style.display = 'none';
    }

    modal.classList.remove('hidden');
}

function makaValisoaMail(id) {
    lalao.socket.emit('makaValisoaMail', {id: id});

    lalao.socket.once('valisoaMailValiny', (valiny) => {
        if (valiny.vita) {
            const mail = mailData.hafatra.find(m => m.id === id);
            if (mail && mail.valisoa) {
                mail.valisoa.nalaina = true;

                if (valiny.karazana === 'volamena') {
                    mpilalao.volamena += valiny.isa;
                } else if (valiny.karazana === 'diamondra') {
                    mpilalao.diamondra += valiny.isa;
                }

                mitahiryData();
                havaozyUI();
                asehoMail();
                document.getElementById('mailDetailModal').classList.add('hidden');

                asehoToast('Valisoa azo', 'success');
            }
        }
    });
}

function mamafaMailVakiana() {
    const vakiana = mailData.hafatra.filter(m => m.vakiana).map(m => m.id);

    if (vakiana.length === 0) {
        asehoToast('Tsy misy', 'info');
        return;
    }

    lalao.socket.emit('mamafaMail', {ids: vakiana});

    lalao.socket.once('famafanaValiny', (valiny) => {
        if (valiny.vita) {
            mailData.hafatra = mailData.hafatra.filter(m =>!m.vakiana);
            asehoMail();
            asehoToast('Voafafa', 'success');
        }
    });
}

function havaozyMailBadge() {
    const badge = document.getElementById('mailBadge');
    if (badge) {
        if (mailData.tsyVakiana > 0) {
            badge.textContent = mailData.tsyVakiana;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
}

function manovaTabilaoMail(tabilao) {
    document.querySelectorAll('.mail-tab').forEach(t => {
        t.classList.remove('active');
    });

    const voafidy = document.querySelector(`[data-tab="${tabilao}"]`);
    if (voafidy) voafidy.classList.add('active');

    asehoMail();
}

function makaLeaderboardData(sokajy = 'vono') {
    lalao.socket.emit('makaLeaderboard', {sokajy: sokajy});

    lalao.socket.once('leaderboardValiny', (data) => {
        leaderboardData.lisitra = data.lisitra;
        leaderboardData.toerana = data.toerana;
        asehoLeaderboard();
    });
}

function asehoLeaderboard() {
    const tbody = document.querySelector('#leaderboardFullTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    leaderboardData.lisitra.forEach((p, i) => {
        const tr = document.createElement('tr');
        const isAhy = p.uid === mpilalao.uid;

        tr.className = isAhy? 'my-row' : '';
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${p.anarana} ${isAhy? '(Ianao)' : ''}</td>
            <td>Lv.${p.level}</td>
            <td>${p.vono}</td>
            <td>${p.fandresena}</td>
            <td>${p.lalao}</td>
            <td>${p.lalao > 0? ((p.vono / p.lalao).toFixed(2)) : '0.00'}</td>
        `;

        tbody.appendChild(tr);
    });

    const toeranaEl = document.getElementById('myRankValue');
    if (toeranaEl) {
        toeranaEl.textContent = '#' + leaderboardData.toerana;
    }
}

function manovaSokajyLeaderboard(sokajy) {
    document.querySelectorAll('.leaderboard-filter').forEach(b => {
        b.classList.remove('active');
    });

    const voafidy = document.querySelector(`[data-sort="${sokajy}"]`);
    if (voafidy) voafidy.classList.add('active');

    makaLeaderboardData(sokajy);
}

function mitadyMpilalaoLeaderboard() {
    const anarana = document.getElementById('leaderboardSearch').value.trim();
    if (!anarana) {
        makaLeaderboardData();
        return;
    }

    lalao.socket.emit('mitadyMpilalao', {anarana: anarana});

    lalao.socket.once('fikarohanaValiny', (data) => {
        if (data.hita) {
            leaderboardData.lisitra = [data.mpilalao];
            asehoLeaderboard();
        } else {
            asehoToast('Tsy hita', 'warning');
        }
    });
}


let adminData = {
    mpilalaoAnjara: [],
    statistika: {},
    fanarahaMaso: true
};

let dailyData = {
    andro: 0,
    nalaina: false,
    valisoa: []
};

let friendsData = {
    namana: [],
    fangatahana: [],
    sosoKevi: []
};

let clanData = {
    anarana: null,
    mpikambana: [],
    level: 1,
    xp: 0
};

function makaAdminData() {
    if (!mpilalao.admin) return;

    lalao.socket.emit('makaAdminData');

    lalao.socket.once('adminValiny', (data) => {
        adminData.statistika = data.statistika;
        adminData.mpilalaoAnjara = data.mpilalao;
        asehoAdminDashboard();
    });
}

function asehoAdminDashboard() {
    document.getElementById('adminTotalPlayers').textContent = adminData.statistika.totalMpilalao || 0;
    document.getElementById('adminOnlinePlayers').textContent = adminData.statistika.mifandray || 0;
    document.getElementById('adminTotalMatches').textContent = adminData.statistika.totalLalao || 0;
    document.getElementById('adminActiveLobbies').textContent = adminData.statistika.lobbyMavitrika || 0;

    const fito = document.getElementById('adminPlayersList');
    if (!fito) return;

    fito.innerHTML = '';

    adminData.mpilalaoAnjara.forEach(p => {
        const el = document.createElement('div');
        el.className = 'admin-player-item';
        el.innerHTML = `
            <span>${p.anarana}</span>
            <span>Lv.${p.level}</span>
            <span>${p.mifandray? '🟢' : '⚫'}</span>
            <button onclick="adminJereoMpilalao('${p.uid}')">Jereo</button>
        `;
        fito.appendChild(el);
    });
}

function adminJereoMpilalao(uid) {
    lalao.socket.emit('adminJereoMpilalao', {uid: uid});

    lalao.socket.once('mpilalaoInfo', (data) => {
        const info = `
Anarana: ${data.anarana}
Level: ${data.level}
Vono: ${data.vono}
Fandresena: ${data.fandresena}
Volamena: ${data.volamena}
Diamondra: ${data.diamondra}
Niditra farany: ${new Date(data.niditraFarany).toLocaleString()}
        `;
        alert(info);
    });
}

function adminAvoakaMpilalao(uid) {
    if (!confirm('Avoaka ity mpilalao ity?')) return;

    lalao.socket.emit('adminAvoaka', {uid: uid});

    lalao.socket.once('avoakaValiny', (valiny) => {
        if (valiny.vita) {
            asehoToast('Voavoaka', 'success');
            makaAdminData();
        }
    });
}

function adminOmeVolamena(uid, isa) {
    const vola = parseInt(prompt('Ohatrinona?'));
    if (!vola || vola <= 0) return;

    lalao.socket.emit('adminOmeVolamena', {uid: uid, isa: vola});

    lalao.socket.once('omeValiny', (valiny) => {
        if (valiny.vita) {
            asehoToast('Vita', 'success');
        }
    });
}

function adminBanMpilalao(uid) {
    const antony = prompt('Antony ban?');
    if (!antony) return;

    if (!confirm('Ban ity mpilalao ity?')) return;

    lalao.socket.emit('adminBan', {uid: uid, antony: antony});

    lalao.socket.once('banValiny', (valiny) => {
        if (valiny.vita) {
            asehoToast('Voaban', 'success');
            makaAdminData();
        }
    });
}

function adminAlefaHafatra() {
    const hafatra = document.getElementById('adminBroadcastMessage').value.trim();
    if (!hafatra) return;

    lalao.socket.emit('adminBroadcast', {hafatra: hafatra});

    lalao.socket.once('broadcastValiny', (valiny) => {
        if (valiny.vita) {
            asehoToast('Lasa ny hafatra', 'success');
            document.getElementById('adminBroadcastMessage').value = '';
        }
    });
}

function adminAtsahatraServer() {
    if (!confirm('Atsahatra ny server?')) return;
    if (!confirm('Tena azo antoka?')) return;

    lalao.socket.emit('adminAtsahatra');
}

function makaDailyReward() {
    lalao.socket.emit('makaDaily');

    lalao.socket.once('dailyValiny', (data) => {
        dailyData = data;
        asehoDailyReward();
    });
}

function asehoDailyReward() {
    const modal = document.getElementById('dailyRewardModal');
    if (!modal) return;

    const andro = document.getElementById('dailyDay');
    const valisoa = document.getElementById('dailyRewardItem');
    const bokotra = document.getElementById('dailyClaimBtn');

    if (andro) andro.textContent = `Andro ${dailyData.andro + 1}`;
    if (valisoa) valisoa.textContent = dailyData.valisoa[dailyData.andro]?.sary || '🎁';

    if (bokotra) {
        bokotra.disabled = dailyData.nalaina;
        bokotra.textContent = dailyData.nalaina? 'Efa nalaina' : 'Alaina';
        bokotra.onclick = makaDailyAnkehitriny;
    }

    modal.classList.remove('hidden');
}

function makaDailyAnkehitriny() {
    if (dailyData.nalaina) return;

    lalao.socket.emit('makaDailyAnkehitriny');

    lalao.socket.once('dailyAlaValiny', (valiny) => {
        if (valiny.vita) {
            dailyData.nalaina = true;

            if (valiny.karazana === 'volamena') {
                mpilalao.volamena += valiny.isa;
            } else if (valiny.karazana === 'diamondra') {
                mpilalao.diamondra += valiny.isa;
            }

            mitahiryData();
            havaozyUI();
            asehoDailyReward();

            asehoToast(`Nahazo ${valiny.isa} ${valiny.karazana}`, 'success');
            alefaSon('valisoa');

            setTimeout(() => {
                document.getElementById('dailyRewardModal').classList.add('hidden');
            }, 2000);
        }
    });
}

function afenoDailyReward() {
    document.getElementById('dailyRewardModal').classList.add('hidden');
}

function makaFriendsData() {
    lalao.socket.emit('makaNamana');

    lalao.socket.once('namanaValiny', (data) => {
        friendsData.namana = data.namana;
        friendsData.fangatahana = data.fangatahana;
        friendsData.sosoKevi = data.sosoKevi;
        asehoFriends();
    });
}

function asehoFriends() {
    const fitoNamana = document.getElementById('friendsList');
    const fitoFangatahana = document.getElementById('friendRequests');
    const fitoSoso = document.getElementById('friendSuggestions');

    if (fitoNamana) {
        fitoNamana.innerHTML = '';

        if (friendsData.namana.length === 0) {
            fitoNamana.innerHTML = '<div class="empty">Tsy misy namana</div>';
        } else {
            friendsData.namana.forEach(n => {
                const el = document.createElement('div');
                el.className = 'friend-item';
                el.innerHTML = `
                    <div class="friend-info">
                        <span class="friend-name">${n.anarana}</span>
                        <span class="friend-level">Lv.${n.level}</span>
                        <span class="friend-status">${n.mifandray? '🟢 Mifandray' : '⚫ Tsy mifandray'}</span>
                    </div>
                    <div class="friend-actions">
                        <button onclick="manasaHilalao('${n.uid}')">Manasa</button>
                        <button onclick="esoryNamana('${n.uid}')">Esory</button>
                    </div>
                `;
                fitoNamana.appendChild(el);
            });
        }
    }

    if (fitoFangatahana) {
        fitoFangatahana.innerHTML = '';

        friendsData.fangatahana.forEach(f => {
            const el = document.createElement('div');
            el.className = 'friend-request';
            el.innerHTML = `
                <span>${f.anarana} (Lv.${f.level})</span>
                <div>
                    <button onclick="ekenaNamana('${f.uid}')">Ekena</button>
                    <button onclick="lavinaNamana('${f.uid}')">Lavina</button>
                </div>
            `;
            fitoFangatahana.appendChild(el);
        });
    }

    if (fitoSoso) {
        fitoSoso.innerHTML = '';

        friendsData.sosoKevi.slice(0, 5).forEach(s => {
            const el = document.createElement('div');
            el.className = 'friend-suggestion';
            el.innerHTML = `
                <span>${s.anarana} (Lv.${s.level})</span>
                <button onclick="angatahoNamana('${s.uid}')">Ampiana</button>
            `;
            fitoSoso.appendChild(el);
        });
    }
}

function angatahoNamana(uid) {
    lalao.socket.emit('angatahoNamana', {uid: uid});

    lalao.socket.once('fangatahanaValiny', (valiny) => {
        if (valiny.vita) {
            asehoToast('Lasa ny fangatahana', 'success');
            makaFriendsData();
        } else {
            asehoToast(valiny.antony || 'Tsy nety', 'error');
        }
    });
}

function ekenaNamana(uid) {
    lalao.socket.emit('ekenaNamana', {uid: uid});

    lalao.socket.once('ekenaValiny', (valiny) => {
        if (valiny.vita) {
            asehoToast('Namana vaovao', 'success');
            makaFriendsData();
        }
    });
}

function lavinaNamana(uid) {
    lalao.socket.emit('lavinaNamana', {uid: uid});

    lalao.socket.once('lavinaValiny', (valiny) => {
        if (valiny.vita) {
            makaFriendsData();
        }
    });
}

function esoryNamana(uid) {
    if (!confirm('Esorina ity namana ity?')) return;

    lalao.socket.emit('esoryNamana', {uid: uid});

    lalao.socket.once('esoryValiny', (valiny) => {
        if (valiny.vita) {
            asehoToast('Voafafa', 'info');
            makaFriendsData();
        }
    });
}

function manasaHilalao(uid) {
    if (!lobby.id) {
        asehoToast('Mamorona lobby aloha', 'warning');
        return;
    }

    lalao.socket.emit('manasaNamana', {uid: uid, lobbyId: lobby.id});

    lalao.socket.once('fanasanaValiny', (valiny) => {
        if (valiny.vita) {
            asehoToast('Lasa ny fanasana', 'success');
        }
    });
}

function mitadyNamana() {
    const anarana = document.getElementById('friendSearchInput').value.trim();
    if (!anarana || anarana.length < 3) {
        asehoToast('Soraty anarana', 'warning');
        return;
    }

    lalao.socket.emit('mitadyNamana', {anarana: anarana});

    lalao.socket.once('fikarohanaNamanaValiny', (data) => {
        const fito = document.getElementById('friendSearchResults');
        if (!fito) return;

        fito.innerHTML = '';

        if (data.vokatra.length === 0) {
            fito.innerHTML = '<div class="empty">Tsy hita</div>';
            return;
        }

        data.vokatra.forEach(p => {
            const el = document.createElement('div');
            el.className = 'search-result';
            el.innerHTML = `
                <span>${p.anarana} (Lv.${p.level})</span>
                <button onclick="angatahoNamana('${p.uid}')">Ampiana</button>
            `;
            fito.appendChild(el);
        });
    });
}

function makaClanData() {
    lalao.socket.emit('makaClan');

    lalao.socket.once('clanValiny', (data) => {
        clanData = data;
        asehoClan();
    });
}

function asehoClan() {
    const anaranaEl = document.getElementById('clanName');
    const levelEl = document.getElementById('clanLevel');
    const mpikambanaEl = document.getElementById('clanMembers');

    if (!clanData.anarana) {
        document.getElementById('clanNoClan').style.display = 'block';
        document.getElementById('clanHasClan').style.display = 'none';
        return;
    }

    document.getElementById('clanNoClan').style.display = 'none';
    document.getElementById('clanHasClan').style.display = 'block';

    if (anaranaEl) anaranaEl.textContent = clanData.anarana;
    if (levelEl) levelEl.textContent = 'Level ' + clanData.level;

    if (mpikambanaEl) {
        mpikambanaEl.innerHTML = '';
        clanData.mpikambana.forEach(m => {
            const el = document.createElement('div');
            el.className = 'clan-member';
            el.innerHTML = `
                <span>${m.anarana} ${m.tompony? '👑' : ''}</span>
                <span>Lv.${m.level}</span>
                <span>${m.mifandray? '🟢' : '⚫'}</span>
            `;
            mpikambanaEl.appendChild(el);
        });
    }
}

function mamoronaClan() {
    const anarana = prompt('Anaran ny clan:');
    if (!anarana || anarana.length < 3 || anarana.length > 20) {
        asehoToast('Anarana tsy mety', 'error');
        return;
    }

    if (mpilalao.volamena < 5000) {
        asehoToast('Mila 5000 volamena', 'error');
        return;
    }

    lalao.socket.emit('mamoronaClan', {anarana: anarana});

    lalao.socket.once('clanForonina', (valiny) => {
        if (valiny.vita) {
            mpilalao.volamena -= 5000;
            mitahiryData();
            havaozyUI();
            makaClanData();
            asehoToast('Clan voaforona', 'success');
        } else {
            asehoToast(valiny.antony, 'error');
        }
    });
}

function miditraClan(id) {
    lalao.socket.emit('miditraClan', {id: id});

    lalao.socket.once('miditraClanValiny', (valiny) => {
        if (valiny.vita) {
            makaClanData();
            asehoToast('Tafiditra clan', 'success');
        }
    });
}

function mialaClan() {
    if (!confirm('Hiala amin ny clan?')) return;

    lalao.socket.emit('mialaClan');

    lalao.socket.once('mialaClanValiny', (valiny) => {
        if (valiny.vita) {
            clanData = {anarana: null, mpikambana: [], level: 1, xp: 0};
            asehoClan();
            asehoToast('Niala clan', 'info');
        }
    });
}

function mitahirySettingsRehetra() {
    const settings = {
        sensitivity: parseFloat(document.getElementById('sensitivitySlider').value),
        aimSensitivity: parseFloat(document.getElementById('aimSensitivitySlider').value),
        masterVolume: parseInt(document.getElementById('masterVolumeSlider').value),
        musicVolume: parseInt(document.getElementById('musicVolumeSlider').value),
        sfxVolume: parseInt(document.getElementById('sfxVolumeSlider').value),
        graphics: document.getElementById('graphicsSelect').value,
        fpsLimit: parseInt(document.getElementById('fpsSelect').value),
        showFPS: document.getElementById('showFPSCheck').checked,
        showPing: document.getElementById('showPingCheck').checked,
        autoSprint: document.getElementById('autoSprintCheck').checked,
        aimAssist: document.getElementById('aimAssistCheck').checked
    };

    mpilalao.settings = settings;
    mitahiryData();

    lalao.socket.emit('mitahirySettings', {settings: settings});

    asehoToast('Settings voatahiry', 'success');
    afenoPanel('settingsPanel');
}

function mamerinaSettings() {
    if (!confirm('Averina default?')) return;

    mpilalao.settings = {
        sensitivity: 1.0,
        aimSensitivity: 1.0,
        masterVolume: 100,
        musicVolume: 50,
        sfxVolume: 100,
        graphics: 'medium',
        fpsLimit: 60,
        showFPS: false,
        showPing: true,
        autoSprint: false,
        aimAssist: true
    };

    mitahiryData();
    mampiditraSettingsAminUI();
    asehoToast('Naverina', 'info');
}

function mampiditraSettingsAminUI() {
    const s = mpilalao.settings || {};

    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox') el.checked = value;
            else el.value = value;
        }
    };

    setValue('sensitivitySlider', s.sensitivity || 1.0);
    setValue('aimSensitivitySlider', s.aimSensitivity || 1.0);
    setValue('masterVolumeSlider', s.masterVolume || 100);
    setValue('musicVolumeSlider', s.musicVolume || 50);
    setValue('sfxVolumeSlider', s.sfxVolume || 100);
    setValue('graphicsSelect', s.graphics || 'medium');
    setValue('fpsSelect', s.fpsLimit || 60);
    setValue('showFPSCheck', s.showFPS || false);
    setValue('showPingCheck', s.showPing !== false);
    setValue('autoSprintCheck', s.autoSprint || false);
    setValue('aimAssistCheck', s.aimAssist !== false);
}

function manovaFeo() {
    const master = parseInt(document.getElementById('masterVolumeSlider').value);
    const music = parseInt(document.getElementById('musicVolumeSlider').value);
    const sfx = parseInt(document.getElementById('sfxVolumeSlider').value);

    document.getElementById('masterVolumeValue').textContent = master + '%';
    document.getElementById('musicVolumeValue').textContent = music + '%';
    document.getElementById('sfxVolumeValue').textContent = sfx + '%';

    if (mpilalao.settings) {
        mpilalao.settings.masterVolume = master;
        mpilalao.settings.musicVolume = music;
        mpilalao.settings.sfxVolume = sfx;
    }
}

function manovaSensitivity() {
    const sens = parseFloat(document.getElementById('sensitivitySlider').value);
    const aim = parseFloat(document.getElementById('aimSensitivitySlider').value);

    document.getElementById('sensitivityValue').textContent = sens.toFixed(1);
    document.getElementById('aimSensitivityValue').textContent = aim.toFixed(1);
}

let adminData = {
    mpilalaoAnjara: [],
    statistika: {},
    fanarahaMaso: true
};

let dailyData = {
    andro: 0,
    nalaina: false,
    valisoa: []
};

let friendsData = {
    namana: [],
    fangatahana: [],
    sosoKevi: []
};

let clanData = {
    anarana: null,
    mpikambana: [],
    level: 1,
    xp: 0
};

function makaAdminData() {
    if (!mpilalao.admin) return;

    lalao.socket.emit('makaAdminData');

    lalao.socket.once('adminValiny', (data) => {
        adminData.statistika = data.statistika;
        adminData.mpilalaoAnjara = data.mpilalao;
        asehoAdminDashboard();
    });
}

function asehoAdminDashboard() {
    document.getElementById('adminTotalPlayers').textContent = adminData.statistika.totalMpilalao || 0;
    document.getElementById('adminOnlinePlayers').textContent = adminData.statistika.mifandray || 0;
    document.getElementById('adminTotalMatches').textContent = adminData.statistika.totalLalao || 0;
    document.getElementById('adminActiveLobbies').textContent = adminData.statistika.lobbyMavitrika || 0;

    const fito = document.getElementById('adminPlayersList');
    if (!fito) return;

    fito.innerHTML = '';

    adminData.mpilalaoAnjara.forEach(p => {
        const el = document.createElement('div');
        el.className = 'admin-player-item';
        el.innerHTML = `
            <span>${p.anarana}</span>
            <span>Lv.${p.level}</span>
            <span>${p.mifandray? '🟢' : '⚫'}</span>
            <button onclick="adminJereoMpilalao('${p.uid}')">Jereo</button>
        `;
        fito.appendChild(el);
    });
}

function adminJereoMpilalao(uid) {
    lalao.socket.emit('adminJereoMpilalao', {uid: uid});

    lalao.socket.once('mpilalaoInfo', (data) => {
        const info = `
Anarana: ${data.anarana}
Level: ${data.level}
Vono: ${data.vono}
Fandresena: ${data.fandresena}
Volamena: ${data.volamena}
Diamondra: ${data.diamondra}
Niditra farany: ${new Date(data.niditraFarany).toLocaleString()}
        `;
        alert(info);
    });
}

function adminAvoakaMpilalao(uid) {
    if (!confirm('Avoaka ity mpilalao ity?')) return;

    lalao.socket.emit('adminAvoaka', {uid: uid});

    lalao.socket.once('avoakaValiny', (valiny) => {
        if (valiny.vita) {
            asehoToast('Voavoaka', 'success');
            makaAdminData();
        }
    });
}

function adminOmeVolamena(uid, isa) {
    const vola = parseInt(prompt('Ohatrinona?'));
    if (!vola || vola <= 0) return;

    lalao.socket.emit('adminOmeVolamena', {uid: uid, isa: vola});

    lalao.socket.once('omeValiny', (valiny) => {
        if (valiny.vita) {
            asehoToast('Vita', 'success');
        }
    });
}

function adminBanMpilalao(uid) {
    const antony = prompt('Antony ban?');
    if (!antony) return;

    if (!confirm('Ban ity mpilalao ity?')) return;

    lalao.socket.emit('adminBan', {uid: uid, antony: antony});

    lalao.socket.once('banValiny', (valiny) => {
        if (valiny.vita) {
            asehoToast('Voaban', 'success');
            makaAdminData();
        }
    });
}

function adminAlefaHafatra() {
    const hafatra = document.getElementById('adminBroadcastMessage').value.trim();
    if (!hafatra) return;

    lalao.socket.emit('adminBroadcast', {hafatra: hafatra});

    lalao.socket.once('broadcastValiny', (valiny) => {
        if (valiny.vita) {
            asehoToast('Lasa ny hafatra', 'success');
            document.getElementById('adminBroadcastMessage').value = '';
        }
    });
}

function adminAtsahatraServer() {
    if (!confirm('Atsahatra ny server?')) return;
    if (!confirm('Tena azo antoka?')) return;

    lalao.socket.emit('adminAtsahatra');
}

function makaDailyReward() {
    lalao.socket.emit('makaDaily');

    lalao.socket.once('dailyValiny', (data) => {
        dailyData = data;
        asehoDailyReward();
    });
}

function asehoDailyReward() {
    const modal = document.getElementById('dailyRewardModal');
    if (!modal) return;

    const andro = document.getElementById('dailyDay');
    const valisoa = document.getElementById('dailyRewardItem');
    const bokotra = document.getElementById('dailyClaimBtn');

    if (andro) andro.textContent = `Andro ${dailyData.andro + 1}`;
    if (valisoa) valisoa.textContent = dailyData.valisoa[dailyData.andro]?.sary || '🎁';

    if (bokotra) {
        bokotra.disabled = dailyData.nalaina;
        bokotra.textContent = dailyData.nalaina? 'Efa nalaina' : 'Alaina';
        bokotra.onclick = makaDailyAnkehitriny;
    }

    modal.classList.remove('hidden');
}

function makaDailyAnkehitriny() {
    if (dailyData.nalaina) return;

    lalao.socket.emit('makaDailyAnkehitriny');

    lalao.socket.once('dailyAlaValiny', (valiny) => {
        if (valiny.vita) {
            dailyData.nalaina = true;

            if (valiny.karazana === 'volamena') {
                mpilalao.volamena += valiny.isa;
            } else if (valiny.karazana === 'diamondra') {
                mpilalao.diamondra += valiny.isa;
            }

            mitahiryData();
            havaozyUI();
            asehoDailyReward();

            asehoToast(`Nahazo ${valiny.isa} ${valiny.karazana}`, 'success');
            alefaSon('valisoa');

            setTimeout(() => {
                document.getElementById('dailyRewardModal').classList.add('hidden');
            }, 2000);
        }
    });
}

function afenoDailyReward() {
    document.getElementById('dailyRewardModal').classList.add('hidden');
}

function makaFriendsData() {
    lalao.socket.emit('makaNamana');

    lalao.socket.once('namanaValiny', (data) => {
        friendsData.namana = data.namana;
        friendsData.fangatahana = data.fangatahana;
        friendsData.sosoKevi = data.sosoKevi;
        asehoFriends();
    });
}

function asehoFriends() {
    const fitoNamana = document.getElementById('friendsList');
    const fitoFangatahana = document.getElementById('friendRequests');
    const fitoSoso = document.getElementById('friendSuggestions');

    if (fitoNamana) {
        fitoNamana.innerHTML = '';

        if (friendsData.namana.length === 0) {
            fitoNamana.innerHTML = '<div class="empty">Tsy misy namana</div>';
        } else {
            friendsData.namana.forEach(n => {
                const el = document.createElement('div');
                el.className = 'friend-item';
                el.innerHTML = `
                    <div class="friend-info">
                        <span class="friend-name">${n.anarana}</span>
                        <span class="friend-level">Lv.${n.level}</span>
                        <span class="friend-status">${n.mifandray? '🟢 Mifandray' : '⚫ Tsy mifandray'}</span>
                    </div>
                    <div class="friend-actions">
                        <button onclick="manasaHilalao('${n.uid}')">Manasa</button>
                        <button onclick="esoryNamana('${n.uid}')">Esory</button>
                    </div>
                `;
                fitoNamana.appendChild(el);
            });
        }
    }

    if (fitoFangatahana) {
        fitoFangatahana.innerHTML = '';

        friendsData.fangatahana.forEach(f => {
            const el = document.createElement('div');
            el.className = 'friend-request';
            el.innerHTML = `
                <span>${f.anarana} (Lv.${f.level})</span>
                <div>
                    <button onclick="ekenaNamana('${f.uid}')">Ekena</button>
                    <button onclick="lavinaNamana('${f.uid}')">Lavina</button>
                </div>
            `;
            fitoFangatahana.appendChild(el);
        });
    }

    if (fitoSoso) {
        fitoSoso.innerHTML = '';

        friendsData.sosoKevi.slice(0, 5).forEach(s => {
            const el = document.createElement('div');
            el.className = 'friend-suggestion';
            el.innerHTML = `
                <span>${s.anarana} (Lv.${s.level})</span>
                <button onclick="angatahoNamana('${s.uid}')">Ampiana</button>
            `;
            fitoSoso.appendChild(el);
        });
    }
}

function angatahoNamana(uid) {
    lalao.socket.emit('angatahoNamana', {uid: uid});

    lalao.socket.once('fangatahanaValiny', (valiny) => {
        if (valiny.vita) {
            asehoToast('Lasa ny fangatahana', 'success');
            makaFriendsData();
        } else {
            asehoToast(valiny.antony || 'Tsy nety', 'error');
        }
    });
}

function ekenaNamana(uid) {
    lalao.socket.emit('ekenaNamana', {uid: uid});

    lalao.socket.once('ekenaValiny', (valiny) => {
        if (valiny.vita) {
            asehoToast('Namana vaovao', 'success');
            makaFriendsData();
        }
    });
}

function lavinaNamana(uid) {
    lalao.socket.emit('lavinaNamana', {uid: uid});

    lalao.socket.once('lavinaValiny', (valiny) => {
        if (valiny.vita) {
            makaFriendsData();
        }
    });
}

function esoryNamana(uid) {
    if (!confirm('Esorina ity namana ity?')) return;

    lalao.socket.emit('esoryNamana', {uid: uid});

    lalao.socket.once('esoryValiny', (valiny) => {
        if (valiny.vita) {
            asehoToast('Voafafa', 'info');
            makaFriendsData();
        }
    });
}

function manasaHilalao(uid) {
    if (!lobby.id) {
        asehoToast('Mamorona lobby aloha', 'warning');
        return;
    }

    lalao.socket.emit('manasaNamana', {uid: uid, lobbyId: lobby.id});

    lalao.socket.once('fanasanaValiny', (valiny) => {
        if (valiny.vita) {
            asehoToast('Lasa ny fanasana', 'success');
        }
    });
}

function mitadyNamana() {
    const anarana = document.getElementById('friendSearchInput').value.trim();
    if (!anarana || anarana.length < 3) {
        asehoToast('Soraty anarana', 'warning');
        return;
    }

    lalao.socket.emit('mitadyNamana', {anarana: anarana});

    lalao.socket.once('fikarohanaNamanaValiny', (data) => {
        const fito = document.getElementById('friendSearchResults');
        if (!fito) return;

        fito.innerHTML = '';

        if (data.vokatra.length === 0) {
            fito.innerHTML = '<div class="empty">Tsy hita</div>';
            return;
        }

        data.vokatra.forEach(p => {
            const el = document.createElement('div');
            el.className = 'search-result';
            el.innerHTML = `
                <span>${p.anarana} (Lv.${p.level})</span>
                <button onclick="angatahoNamana('${p.uid}')">Ampiana</button>
            `;
            fito.appendChild(el);
        });
    });
}

function makaClanData() {
    lalao.socket.emit('makaClan');

    lalao.socket.once('clanValiny', (data) => {
        clanData = data;
        asehoClan();
    });
}

function asehoClan() {
    const anaranaEl = document.getElementById('clanName');
    const levelEl = document.getElementById('clanLevel');
    const mpikambanaEl = document.getElementById('clanMembers');

    if (!clanData.anarana) {
        document.getElementById('clanNoClan').style.display = 'block';
        document.getElementById('clanHasClan').style.display = 'none';
        return;
    }

    document.getElementById('clanNoClan').style.display = 'none';
    document.getElementById('clanHasClan').style.display = 'block';

    if (anaranaEl) anaranaEl.textContent = clanData.anarana;
    if (levelEl) levelEl.textContent = 'Level ' + clanData.level;

    if (mpikambanaEl) {
        mpikambanaEl.innerHTML = '';
        clanData.mpikambana.forEach(m => {
            const el = document.createElement('div');
            el.className = 'clan-member';
            el.innerHTML = `
                <span>${m.anarana} ${m.tompony? '👑' : ''}</span>
                <span>Lv.${m.level}</span>
                <span>${m.mifandray? '🟢' : '⚫'}</span>
            `;
            mpikambanaEl.appendChild(el);
        });
    }
}

function mamoronaClan() {
    const anarana = prompt('Anaran ny clan:');
    if (!anarana || anarana.length < 3 || anarana.length > 20) {
        asehoToast('Anarana tsy mety', 'error');
        return;
    }

    if (mpilalao.volamena < 5000) {
        asehoToast('Mila 5000 volamena', 'error');
        return;
    }

    lalao.socket.emit('mamoronaClan', {anarana: anarana});

    lalao.socket.once('clanForonina', (valiny) => {
        if (valiny.vita) {
            mpilalao.volamena -= 5000;
            mitahiryData();
            havaozyUI();
            makaClanData();
            asehoToast('Clan voaforona', 'success');
        } else {
            asehoToast(valiny.antony, 'error');
        }
    });
}

function miditraClan(id) {
    lalao.socket.emit('miditraClan', {id: id});

    lalao.socket.once('miditraClanValiny', (valiny) => {
        if (valiny.vita) {
            makaClanData();
            asehoToast('Tafiditra clan', 'success');
        }
    });
}

function mialaClan() {
    if (!confirm('Hiala amin ny clan?')) return;

    lalao.socket.emit('mialaClan');

    lalao.socket.once('mialaClanValiny', (valiny) => {
        if (valiny.vita) {
            clanData = {anarana: null, mpikambana: [], level: 1, xp: 0};
            asehoClan();
            asehoToast('Niala clan', 'info');
        }
    });
}

function mitahirySettingsRehetra() {
    const settings = {
        sensitivity: parseFloat(document.getElementById('sensitivitySlider').value),
        aimSensitivity: parseFloat(document.getElementById('aimSensitivitySlider').value),
        masterVolume: parseInt(document.getElementById('masterVolumeSlider').value),
        musicVolume: parseInt(document.getElementById('musicVolumeSlider').value),
        sfxVolume: parseInt(document.getElementById('sfxVolumeSlider').value),
        graphics: document.getElementById('graphicsSelect').value,
        fpsLimit: parseInt(document.getElementById('fpsSelect').value),
        showFPS: document.getElementById('showFPSCheck').checked,
        showPing: document.getElementById('showPingCheck').checked,
        autoSprint: document.getElementById('autoSprintCheck').checked,
        aimAssist: document.getElementById('aimAssistCheck').checked
    };

    mpilalao.settings = settings;
    mitahiryData();

    lalao.socket.emit('mitahirySettings', {settings: settings});

    asehoToast('Settings voatahiry', 'success');
    afenoPanel('settingsPanel');
}

function mamerinaSettings() {
    if (!confirm('Averina default?')) return;

    mpilalao.settings = {
        sensitivity: 1.0,
        aimSensitivity: 1.0,
        masterVolume: 100,
        musicVolume: 50,
        sfxVolume: 100,
        graphics: 'medium',
        fpsLimit: 60,
        showFPS: false,
        showPing: true,
        autoSprint: false,
        aimAssist: true
    };

    mitahiryData();
    mampiditraSettingsAminUI();
    asehoToast('Naverina', 'info');
}

function mampiditraSettingsAminUI() {
    const s = mpilalao.settings || {};

    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox') el.checked = value;
            else el.value = value;
        }
    };

    setValue('sensitivitySlider', s.sensitivity || 1.0);
    setValue('aimSensitivitySlider', s.aimSensitivity || 1.0);
    setValue('masterVolumeSlider', s.masterVolume || 100);
    setValue('musicVolumeSlider', s.musicVolume || 50);
    setValue('sfxVolumeSlider', s.sfxVolume || 100);
    setValue('graphicsSelect', s.graphics || 'medium');
    setValue('fpsSelect', s.fpsLimit || 60);
    setValue('showFPSCheck', s.showFPS || false);
    setValue('showPingCheck', s.showPing !== false);
    setValue('autoSprintCheck', s.autoSprint || false);
    setValue('aimAssistCheck', s.aimAssist !== false);
}

function manovaFeo() {
    const master = parseInt(document.getElementById('masterVolumeSlider').value);
    const music = parseInt(document.getElementById('musicVolumeSlider').value);
    const sfx = parseInt(document.getElementById('sfxVolumeSlider').value);

    document.getElementById('masterVolumeValue').textContent = master + '%';
    document.getElementById('musicVolumeValue').textContent = music + '%';
    document.getElementById('sfxVolumeValue').textContent = sfx + '%';

    if (mpilalao.settings) {
        mpilalao.settings.masterVolume = master;
        mpilalao.settings.musicVolume = music;
        mpilalao.settings.sfxVolume = sfx;
    }
}

function manovaSensitivity() {
    const sens = parseFloat(document.getElementById('sensitivitySlider').value);
    const aim = parseFloat(document.getElementById('aimSensitivitySlider').value);

    document.getElementById('sensitivityValue').textContent = sens.toFixed(1);
    document.getElementById('aimSensitivityValue').textContent = aim.toFixed(1);
}

