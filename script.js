/*
 * ============================================================================
 * MG FIGHTER v4.0 ULTIMATE - CLIENT COMPLET
 * ============================================================================
 * Features: Lobby, Auth, Matchmaking, Room, Chat, Friends, Skins, Grenades,
 * Vehicles, Teams, Leaderboard, Battle Pass, Mobile + PC
 * Lines: ~2100
 * Author: Mr Maharo
 * ============================================================================
 */
const firebaseConfig = {
  apiKey: "AIzaSyAfI8xmHFY5UlWO0sn7OeTzfjv7cJARAGY",
  authDomain: "mgfigther-b3760.firebaseapp.com",
  databaseURL: "https://mgfigther-b3760-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mgfigther-b3760",
  storageBucket: "mgfigther-b3760.firebasestorage.app",
  messagingSenderId: "829325634031",
  appId: "1:829325634031:web:b9c13b78ffec75a372ee1a"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ============================================
// 1. CONFIG & GLOBAL VARIABLES
// ============================================
const socket = io('https://mg-fighter-1.onrender.com'); // OVAY ITO
const API_URL = 'https://mg-fighter-1.onrender.com';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const miniCtx = minimap?.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let GAME_STATE = 'LOBBY'; // LOBBY, ROOM, GAME
let myId = null;
let currentUser = null;
let currentRoom = null;
let myTeam = null;

// Game Objects
let players = {};
let bullets = [];
let grenades = [];
let loot = [];
let buildings = [];
let bushes = [];
let vehicles = [];
let zone = { x: 1500, y: 1500, radius: 3000 };
let camera = { x: 0, y: 0 };
let leaderboard = [];

// Controls
let keys = {};
let mousePos = { x: 0, y: 0 };
let isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
let joystickActive = false;
let joystickData = { x: 0, y: 0 };
let isSprinting = false;
let isZooming = false;
let touchStartTime = 0;

// Player Data
let playerData = JSON.parse(localStorage.getItem('mgPlayerData')) || {
    username: `Player${Math.floor(Math.random()*9999)}`,
    password: '',
    level: 1,
    xp: 0,
    coins: 100,
    wins: 0,
    kills: 0,
    skin: { color: '#00ff00', hat: 'none', gun: 'default' },
    friends: [],
    battlePass: { level: 1, xp: 0, claimed: [] }
};

// Skins Database
const SKINS = {
    colors: ['#00ff00', '#ff0000', '#0088ff', '#ffff00', '#ff00ff', '#ff6600', '#00ffff', '#ffffff'],
    hats: ['none', 'crown', 'cap', 'helmet', 'ninja', 'viking'],
    guns: ['default', 'gold', 'diamond', 'rainbow']
};

// Weapons Database
const WEAPONS = {
    Fist: { damage: 10, speed: 10, ammo: Infinity, spread: 0, fireRate: 300 },
    Pistol: { damage: 20, speed: 15, ammo: 15, spread: 0.08, fireRate: 400 },
    SMG: { damage: 12, speed: 20, ammo: 40, spread: 0.15, fireRate: 100 },
    AK: { damage: 25, speed: 18, ammo: 30, spread: 0.1, fireRate: 150 },
    Shotgun: { damage: 15, speed: 12, ammo: 8, spread: 0.4, pellets: 5, fireRate: 800 },
    Sniper: { damage: 80, speed: 25, ammo: 10, spread: 0.02, fireRate: 1200 },
    Grenade: { damage: 100, radius: 80, ammo: 1, fireRate: 1000 }
};

let lastShotTime = 0;
let particles = [];
let screenShake = 0;

// ============================================
// 2. AUTH - FIREBASE GOOGLE (VERSION PROPRE)
// ============================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId)?.classList.remove('hidden');
}

function showAuthError(msg) {
    const el = document.getElementById('authError');
    if (el) { el.textContent = msg; setTimeout(()=>el.textContent='',4000); }
}

function savePlayerData() {
    localStorage.setItem('mgPlayerData', JSON.stringify(playerData));
}

import { getRedirectResult } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

getRedirectResult(auth).then((result) => {
  if (result && result.user) {
    console.log("✅ Logged in via redirect");

    if (typeof onUserLogin === 'function') onUserLogin(result.user);
  }
}).catch(console.error);

async function loginWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        currentUser = user.displayName || user.email.split('@')[0];
        playerData.username = currentUser;
        playerData.photo = user.photoURL;

        // Alefa any amin'ny serveur Render ny UID Google
        socket.emit('auth', {
          uid: user.uid,
          username: currentUser,
          photo: user.photoURL
        });

    } catch(e) {
        console.error(e);
        showAuthError('Erreur Google');
    }
}

// Auto-login raha efa connecté
auth.onAuthStateChanged(user => {
    if (user && GAME_STATE === 'LOBBY') {
        // Aza miantso loginWithGoogle indray (miteraka loop)
        // Alefa mivantana
        currentUser = user.displayName || user.email.split('@')[0];
        socket.emit('auth', {
          uid: user.uid,
          username: currentUser,
          photo: user.photoURL
        });
    }
});

// Compatibility amin'ny bouton taloha
async function login(){ loginWithGoogle(); }
async function register(){ loginWithGoogle(); }

socket.on('authSuccess', (user) => {
    playerData = {...playerData,...user};
    savePlayerData();
    showScreen('lobbyScreen');
    updateLobbyUI();
    loadFriends();
    if(isMobile) document.getElementById('mobileControls')?.classList.remove('hidden');
});

socket.on('lobbyUpdate', (count) => {
    const el = document.getElementById('onlineCount');
    if(el) el.textContent = count;
});


// ============================================
// 3. LOBBY UI UPDATE
// ============================================

function updateLobbyUI() {
    document.getElementById('playerName').textContent = playerData.username;
    document.getElementById('playerLevel').textContent = playerData.level;
    document.getElementById('playerCoins').textContent = playerData.coins;
    document.getElementById('playerWins').textContent = playerData.wins;
    document.getElementById('playerKills').textContent = playerData.kills;
    document.getElementById('playerAvatar').style.background = playerData.skin.color;
    document.getElementById('bpLevel').textContent = playerData.battlePass.level;
    document.getElementById('bpXP').style.width = (playerData.battlePass.xp % 100) + '%';
}

// ============================================
// 4. MATCHMAKING & ROOM SYSTEM
// ============================================

function findMatch(mode) {
    socket.emit('findMatch', mode);
    showScreen('matchmakingScreen');
    document.getElementById('matchmakingMode').textContent = mode.toUpperCase();
}

function createRoom() {
    socket.emit('createRoom', 'custom');
}

function joinRoom() {
    const code = document.getElementById('roomCode').value.toUpperCase().trim();
    if(code.length === 6) socket.emit('joinRoom', code);
}

function leaveRoom() {
    socket.emit('leaveRoom');
    showScreen('lobbyScreen');
}

function ready() {
    socket.emit('ready');
    document.getElementById('readyBtn').disabled = true;
    document.getElementById('readyBtn').textContent = 'READY ✅';
}

socket.on('roomCreated', (roomId) => {
    showRoom(roomId);
});

socket.on('roomUpdate', (room) => {
    showRoom(room.id);
    const playersDiv = document.getElementById('roomPlayers');
    playersDiv.innerHTML = '';
    room.players.forEach((p, i) => {
        const isHost = p.id === room.host;
        playersDiv.innerHTML += `
            <div class="room-player ${p.ready?'ready':''}">
                <span>${isHost?'👑 ':''}${p.username}</span>
                <span>${p.ready?'✅':'⏳'}</span>
            </div>
        `;
    });
    document.getElementById('roomCount').textContent = `${room.players.length}/4`;
});

function showRoom(roomId) {
    showScreen('roomScreen');
    document.getElementById('roomIdDisplay').textContent = roomId;
    currentRoom = roomId;
}

socket.on('gameStart', (roomId) => {
    GAME_STATE = 'GAME';
    showScreen('gameScreen');
    socket.emit('joinGame', roomId);
});

// ============================================
// 5. CHAT SYSTEM
// ============================================

function sendLobbyChat() {
    const input = document.getElementById('lobbyChatInput');
    const msg = input.value.trim();
    if(msg && msg.length < 200) {
        socket.emit('lobbyChat', msg);
        input.value = '';
    }
}

function sendRoomChat() {
    const input = document.getElementById('roomChatInput');
    const msg = input.value.trim();
    if(msg && msg.length < 200) {
        socket.emit('roomChat', msg);
        input.value = '';
    }
}

socket.on('lobbyChat', (data) => {
    const div = document.getElementById('lobbyChatMessages');
    const time = new Date(data.time).toLocaleTimeString('mg', {hour:'2-digit',minute:'2-digit'});
    div.innerHTML += `<p><span class="chat-time">${time}</span> <b class="chat-user">${data.username}:</b> ${escapeHtml(data.msg)}</p>`;
    div.scrollTop = div.scrollHeight;
});

socket.on('roomChat', (data) => {
    const div = document.getElementById('roomChatMessages');
    const time = new Date(data.time).toLocaleTimeString('mg', {hour:'2-digit',minute:'2-digit'});
    div.innerHTML += `<p><span class="chat-time">${time}</span> <b class="chat-user">${data.username}:</b> ${escapeHtml(data.msg)}</p>`;
    div.scrollTop = div.scrollHeight;
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// 6. FRIENDS SYSTEM
// ============================================

function addFriend() {
    const name = document.getElementById('addFriendInput').value.trim();
    if(name && name!== playerData.username) {
        socket.emit('addFriend', name);
        document.getElementById('addFriendInput').value = '';
    }
}

function loadFriends() {
    socket.emit('getFriends');
}

socket.on('friendAdded', (name) => {
    if(!playerData.friends.includes(name)) {
        playerData.friends.push(name);
        savePlayerData();
        loadFriends();
    }
});

socket.on('friendsList', (data) => {
    const div = document.getElementById('friendsList');
    div.innerHTML = '<h4>Online</h4>';
    data.online.forEach(f => {
        div.innerHTML += `<div class="friend online" onclick="inviteFriend('${f}')">🟢 ${f} <button>INVITE</button></div>`;
    });
    div.innerHTML += '<h4>Offline</h4>';
    data.all.filter(f =>!data.online.includes(f)).forEach(f => {
        div.innerHTML += `<div class="friend">⚫ ${f}</div>`;
    });
});

function inviteFriend(name) {
    socket.emit('inviteFriend', name);
}

// ============================================
// 7. SKIN SYSTEM
// ============================================

function openSkinMenu() {
    document.getElementById('skinMenu').classList.remove('hidden');
}

function changeSkinColor(color) {
    playerData.skin.color = color;
    savePlayerData();
    socket.emit('setSkin', playerData.skin);
    updateLobbyUI();
}

function changeSkinHat(hat) {
    playerData.skin.hat = hat;
    savePlayerData();
    socket.emit('setSkin', playerData.skin);
}

// ============================================
// 8. GAME INITIALIZATION
// ============================================

socket.on('gameInit', (data) => {
    myId = data.id;
    players = data.players;
    loot = data.loot;
    buildings = data.buildings;
    bushes = data.bushes;
    vehicles = data.vehicles;
    zone = data.zone;
    leaderboard = data.leaderboard;
    updateLeaderboard();
    GAME_STATE = 'GAME';
});

socket.on('gameState', (data) => {
    players = data.players;
    bullets = data.bullets;
    grenades = data.grenades;
    loot = data.loot;
    vehicles = data.vehicles;
});

socket.on('zoneUpdate', (data) => {
    zone = data.zone;
    document.getElementById('zoneTimer').textContent = `ZONE: ${data.timer}s`;
});

socket.on('lootTaken', (lootId) => {
    loot = loot.filter(l => l.id!== lootId);
    createPickupEffect();
});

socket.on('explosion', (data) => {
    createExplosion(data.x, data.y);
    screenShake = 20;
    if(navigator.vibrate) navigator.vibrate([100, 50, 100]);
});

socket.on('killFeed', (data) => {
    const feed = document.getElementById('killFeed');
    const kill = document.createElement('div');
    kill.className = 'kill';
    const killer = data.killer === 'ZONE'? '🔥 ZONE' : data.killer.substring(0,8);
    const victim = data.victim.substring(0,8);
    kill.innerHTML = `${killer} → ${victim} <span class="weapon">[${data.weapon}]</span>`;
    feed.prepend(kill);
    setTimeout(() => kill.remove(), 5000);
    document.getElementById('aliveCount').textContent = data.playersAlive;

    if(data.killer === myId) {
        playerData.kills++;
        playerData.xp += 50;
        checkLevelUp();
    }
});

socket.on('gameEnd', (data) => {
    if(data.winner === myId) {
        playerData.wins++;
        playerData.coins += 100;
        playerData.xp += 200;
        checkLevelUp();
        showVictoryScreen();
    } else {
        showDefeatScreen(data.rank);
    }
    savePlayerData();
});

socket.on('hit', (data) => {
    showDamage(data.damage, data.x, data.y, '#ff0000');
    screenShake = 5;
    if(navigator.vibrate) navigator.vibrate(50);
});

socket.on('hitmarker', (data) => {
    showDamage(data.damage, data.x, data.y, '#ffff00');
    createHitmarker();
});

socket.on('leaderboardUpdate', (data) => {
    leaderboard = data;
    updateLeaderboard();
});

// ============================================
// 9. GAME CONTROLS - PC
// ============================================

window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if(e.key === 'Shift') isSprinting = true;
    if(e.key.toLowerCase() === 'e') pickupLoot();
    if(e.key.toLowerCase() === 'r') throwGrenade();
    if(e.key.toLowerCase() === 'f') toggleVehicle();
    if(e.key.toLowerCase() === 'b') toggleScoreboard();
    if(e.key === 'Tab') { e.preventDefault(); toggleScoreboard(true); }
});

window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
    if(e.key === 'Shift') isSprinting = false;
    if(e.key === 'Tab') toggleScoreboard(false);
});

window.addEventListener('mousemove', e => {
    mousePos.x = e.clientX;
    mousePos.y = e.clientY;
    if(players[myId] &&!isMobile) {
        players[myId].angle = Math.atan2(e.clientY - canvas.height/2, e.clientX - canvas.width/2);
    }
});

window.addEventListener('mousedown', e => {
    if(GAME_STATE!== 'GAME') return;
    if(e.button === 0) shoot();
    if(e.button === 2) toggleScope(true);
});

window.addEventListener('mouseup', e => {
    if(e.button === 2) toggleScope(false);
});

window.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('wheel', e => {
    if(isZooming) {
        e.preventDefault();
        // Zoom logic
    }
});

// ============================================
// 10. GAME CONTROLS - MOBILE
// ============================================

if(isMobile) {
    const joystick = document.getElementById('joystick');
    const knob = document.getElementById('joystickKnob');
    const shootBtn = document.getElementById('shootBtn');
    const scopeBtn = document.getElementById('scopeBtn');
    const lootBtn = document.getElementById('lootBtn');
    const sprintBtn = document.getElementById('sprintBtn');
    const grenadeBtn = document.getElementById('grenadeBtn');
    const vehicleBtn = document.getElementById('vehicleBtn');

    joystick.addEventListener('touchstart', (e) => {
        joystickActive = true;
        handleJoystick(e.touches[0]);
    });

    joystick.addEventListener('touchmove', (e) => {
        if(joystickActive) handleJoystick(e.touches[0]);
    });

    joystick.addEventListener('touchend', () => {
        joystickActive = false;
        joystickData = {x:0, y:0};
        knob.style.transform = 'translate(-50%, -50%)';
    });

    function handleJoystick(touch) {
        const rect = joystick.getBoundingClientRect();
        const cx = rect.left + rect.width/2;
        const cy = rect.top + rect.height/2;
        let dx = touch.clientX - cx;
        let dy = touch.clientY - cy;
        const dist = Math.min(Math.hypot(dx, dy), 40);
        const angle = Math.atan2(dy, dx);
        dx = Math.cos(angle) * dist;
        dy = Math.sin(angle) * dist;
        joystickData = {x: dx/40, y: dy/40};
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    // Auto-aim on mobile
    canvas.addEventListener('touchmove', (e) => {
        if(e.touches.length === 1 && players[myId]) {
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            players[myId].angle = Math.atan2(touch.clientY - rect.height/2, touch.clientX - rect.width/2);
        }
    });

    shootBtn?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        shoot();
        if(navigator.vibrate) navigator.vibrate(30);
    });

    scopeBtn?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleScope(true);
    });
    scopeBtn?.addEventListener('touchend', (e) => {
        e.preventDefault();
        toggleScope(false);
    });

    lootBtn?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        pickupLoot();
    });

    sprintBtn?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isSprinting = true;
    });
    sprintBtn?.addEventListener('touchend', (e) => {
        e.preventDefault();
        isSprinting = false;
    });

    grenadeBtn?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        throwGrenade();
    });

    vehicleBtn?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleVehicle();
    });
}

// ============================================
// 11. GAME ACTIONS
// ============================================

function shoot() {
    if(!players[myId]?.alive) return;
    const now = Date.now();
    const weapon = WEAPONS[players[myId].weapon];
    if(now - lastShotTime < weapon.fireRate) return;
    if(players[myId].ammo <= 0 && players[myId].weapon!== 'Fist') return;

    lastShotTime = now;
    socket.emit('shoot');
    screenShake = 3;
    createMuzzleFlash();
}

function throwGrenade() {
    if(!players[myId]?.alive || players[myId].grenades <= 0) return;
    socket.emit('throwGrenade');
}

function toggleVehicle() {
    const me = players[myId];
    if(!me?.alive) return;
    if(me.inVehicle) {
        socket.emit('exitVehicle');
    } else {
        const v = vehicles.find(v =>!v.driver && Math.hypot(me.x - v.x, me.y - v.y) < 50);
        if(v) socket.emit('enterVehicle', v.id);
    }
}

function pickupLoot() {
    const me = players[myId];
    if(!me?.alive) return;
    let closest = null, minDist = 60;
    loot.forEach(l => {
        const dist = Math.hypot(me.x - l.x, me.y - l.y);
        if(dist < minDist) { minDist = dist; closest = l; }
    });
    if(closest) socket.emit('pickup', closest.id);
}

function toggleScope(state) {
    isZooming = state;
    document.getElementById('scope')?.classList.toggle('hidden',!state);
}

function toggleScoreboard(show) {
    document.getElementById('scoreboard')?.classList.toggle('hidden',!show);
}

// ============================================
// 12. GAME UPDATE LOOP
// ============================================

function update() {
    if(GAME_STATE!== 'GAME' ||!players[myId]?.alive) return;
    const me = players[myId];

    // Movement
    let speed = isSprinting? 6 : 4;
    if(me.inVehicle) {
        const v = vehicles.find(v => v.id === me.inVehicle);
        if(v) speed = v.speed;
    }
    if(isZooming) speed *= 0.5;

    if(isMobile) {
        me.x += joystickData.x * speed;
        me.y += joystickData.y * speed;
        // Auto-aim nearest enemy
        autoAim();
    } else {
        if(keys['w'] || keys['z']) me.y -= speed;
        if(keys['s']) me.y += speed;
        if(keys['a'] || keys['q']) me.x -= speed;
        if(keys['d']) me.x += speed;
    }

    // Clamp position
    me.x = Math.max(15, Math.min(MAP_SIZE - 15, me.x));
    me.y = Math.max(15, Math.min(MAP_SIZE - 15, me.y));

    // Check bush
    me.inBush = bushes.some(b => Math.hypot(me.x - b.x, me.y - b.y) < b.radius);

    // Send to server
    socket.emit('move', {
        x: me.x, y: me.y, angle: me.angle,
        zooming: isZooming, sprinting: isSprinting
    });

    // Camera follow
    camera.x = me.x - canvas.width/2;
    camera.y = me.y - canvas.height/2;

    // Update particles
    updateParticles();

    // Screen shake decay
    if(screenShake > 0) screenShake *= 0.9;
}

function autoAim() {
    if(!isMobile ||!players[myId]) return;
    let closest = null, minDist = 300;
    for(let id in players) {
        if(id === myId ||!players[id].alive) continue;
        if(myTeam && players[id].team === myTeam) continue;
        const dist = Math.hypot(players[id].x - players[myId].x, players[id].y - players[myId].y);
        if(dist < minDist) { minDist = dist; closest = players[id]; }
    }
    if(closest) {
        players[myId].angle = Math.atan2(closest.y - players[myId].y, closest.x - players[myId].x);
    }
}

// ============================================
// 13. RENDERING
// ============================================

function draw() {
    if(GAME_STATE!== 'GAME') return;

    // Screen shake
    ctx.save();
    if(screenShake > 0.5) {
        ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake);
    }

 // Background MAP.PNG
if (mapLoaded) {
    ctx.drawImage(
        mapImg,
        camera.x, camera.y, canvas.width, canvas.height, // source crop
        0, 0, canvas.width, canvas.height                 // dest
    );
} else {
    ctx.fillStyle = '#1a3a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for(let x = -camera.x%50; x < canvas.width; x+=50) {
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
    }
    for(let y = -camera.y%50; y < canvas.height; y+=50) {
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
    }

    // Zone
    ctx.strokeStyle = '#0088ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(zone.x - camera.x, zone.y - camera.y, zone.radius, 0, Math.PI*2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,100,255,0.05)';
    ctx.fill();

    // Danger zone
    ctx.strokeStyle = 'rgba(255,0,0,0.3)';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Bushes
    bushes.forEach(b => {
        ctx.fillStyle = 'rgba(0,80,0,0.6)';
        ctx.beginPath();
        ctx.arc(b.x - camera.x, b.y - camera.y, b.radius, 0, Math.PI*2);
        ctx.fill();
        // Grass texture
        for(let i=0; i<5; i++) {
            const angle = (i/5)*Math.PI*2;
            const x = b.x - camera.x + Math.cos(angle)*b.radius*0.7;
            const y = b.y - camera.y + Math.sin(angle)*b.radius*0.7;
            ctx.strokeStyle = 'rgba(0,100,0,0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y-10);
            ctx.stroke();
        }
    });

    // Buildings
    buildings.forEach(b => {
        ctx.fillStyle = '#444';
        ctx.fillRect(b.x - camera.x, b.y - camera.y, b.w, b.h);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x - camera.x, b.y - camera.y, b.w, b.h);
        // Windows
        ctx.fillStyle = '#222';
        for(let wx=b.x+20; wx<b.x+b.w-20; wx+=40) {
            for(let wy=b.y+20; wy<b.y+b.h-20; wy+=40) {
                ctx.fillRect(wx-camera.x, wy-camera.y, 20, 20);
            }
        }
    });

    // Vehicles
    vehicles.forEach(v => {
        ctx.save();
        ctx.translate(v.x - camera.x, v.y - camera.y);
        ctx.rotate(v.angle);
        // Body
        ctx.fillStyle = v.driver? '#ff6600' : '#666';
        ctx.fillRect(-30, -15, 60, 30);
        // Wheels
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(-20, -15, 8, 0, Math.PI*2);
        ctx.arc(-20, 15, 8, 0, Math.PI*2);
        ctx.arc(20, -15, 8, 0, Math.PI*2);
        ctx.arc(20, 15, 8, 0, Math.PI*2);
        ctx.fill();
        // Windshield
        ctx.fillStyle = 'rgba(100,200,255,0.3)';
        ctx.fillRect(-10, -12, 20, 10);
        ctx.restore();
    });

    // Loot
    loot.forEach(l => {
        const colors = {
            Medkit:'#00ff00', Armor:'#0088ff', Scope:'#ff00ff',
            AK:'#ffaa00', Shotgun:'#ff6600', Sniper:'#aa00ff',
            SMG:'#00ffff', Pistol:'#ffff00', Grenade:'#ff0000'
        };
        // Glow
        ctx.shadowColor = colors[l.type] || '#ffffff';
        ctx.shadowBlur = 15;
        ctx.fillStyle = colors[l.type] || '#ffffff';
        ctx.fillRect(l.x - camera.x - 12, l.y - camera.y - 12, 24, 24);
        ctx.shadowBlur = 0;
        // Text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeText(l.type, l.x - camera.x, l.y - camera.y - 18);
        ctx.fillText(l.type, l.x - camera.x, l.y - camera.y - 18);
    });

    // Grenades
    ctx.fillStyle = '#ff0000';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 10;
    grenades.forEach(g => {
        ctx.beginPath();
        ctx.arc(g.x - camera.x, g.y - camera.y, 6, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Bullets
    ctx.fillStyle = '#ffff00';
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 5;
    bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x - camera.x, b.y - camera.y, 4, 0, Math.PI*2);
        ctx.fill();
        // Trail
        ctx.strokeStyle = 'rgba(255,255,0,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x - camera.x, b.y - camera.y);
        ctx.lineTo(b.x - camera.x - b.speedX*2, b.y - camera.y - b.speedY*2);
        ctx.stroke();
    });
    ctx.shadowBlur = 0;

    // Players
    for(let id in players) {
        const p = players[id];
        if(!p.alive) continue;
        if(p.inBush && id!== myId && (!myTeam || p.team!== myTeam)) continue;

        ctx.save();
        ctx.translate(p.x - camera.x, p.y - camera.y);
        ctx.rotate(p.angle);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-15, -15, 30, 30);

        // Body
        ctx.fillStyle = p.skin?.color || '#00ff00';
        ctx.fillRect(-15, -15, 30, 30);

        // Border
        ctx.strokeStyle = id === myId? '#00ff88' : (myTeam && p.team === myTeam? '#00ffff' : '#ff0000');
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -15, 30, 30);

        // Hat
        if(p.skin?.hat === 'crown') {
            ctx.fillStyle = 'gold';
            ctx.fillRect(-12, -25, 24, 10);
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(-6, -20, 3, 0, Math.PI*2);
            ctx.arc(0, -20, 3, 0, Math.PI*2);
            ctx.arc(6, -20, 3, 0, Math.PI*2);
            ctx.fill();
        } else if(p.skin?.hat === 'helmet') {
            ctx.fillStyle = '#666';
            ctx.fillRect(-15, -20, 30, 8);
        }

        // Gun
        ctx.fillStyle = '#555';
        ctx.fillRect(15, -4, 25, 8);
        // Muzzle
        ctx.fillStyle = '#333';
        ctx.fillRect(38, -2, 4, 4);

        ctx.restore();

        // Name + Team
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        const teamTag = p.team? `[${p.team}] ` : '';
        const nameText = teamTag + p.name;
        ctx.strokeText(nameText, p.x - camera.x, p.y - camera.y - 50);
        ctx.fillText(nameText, p.x - camera.x, p.y - camera.y - 50);

        // HP Bar
        const barWidth = 40;
        const barHeight = 5;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(p.x - camera.x - barWidth/2, p.y - camera.y - 35, barWidth, barHeight);
        ctx.fillStyle = p.hp > 50? '#00ff00' : p.hp > 25? '#ffff00' : '#ff0000';
        ctx.fillRect(p.x - camera.x - barWidth/2, p.y - camera.y - 35, barWidth * (p.hp/100), barHeight);
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x - camera.x - barWidth/2, p.y - camera.y - 35, barWidth, barHeight);

        // Armor Bar
        if(p.armor > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(p.x - camera.x - barWidth/2, p.y - camera.y - 42, barWidth, 3);
            ctx.fillStyle = '#0088ff';
            ctx.fillRect(p.x - camera.x - barWidth/2, p.y - camera.y - 42, barWidth * (p.armor/100), 3);
        }
    }

    // Particles
    drawParticles();

    ctx.restore();

    // UI Overlay
    drawUI();

    // Minimap
    drawMinimap();
}

function drawParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        ctx.fillStyle = `rgba(${p.color},${p.life/30})`;
        ctx.beginPath();
        ctx.arc(p.x - camera.x, p.y - camera.y, p.size, 0, Math.PI*2);
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life--;
        p.size *= 0.95;
    });
}

function drawUI() {
    if(!players[myId]) return;
    const me = players[myId];

    // HP
    document.getElementById('hp').textContent = Math.floor(me.hp);
    document.getElementById('hpBar').style.width = me.hp + '%';

    // Armor
    document.getElementById('armor').textContent = Math.floor(me.armor);
    document.getElementById('armorBar').style.width = me.armor + '%';

    // Weapon
    document.getElementById('weapon').textContent = me.weapon;
    document.getElementById('ammo').textContent = me.ammo === Infinity? '∞' : me.ammo;
    document.getElementById('grenades').textContent = me.grenades;

       // Stats
    document.getElementById('kills').textContent = me.kills;
    document.getElementById('level').textContent = me.level;
    document.getElementById('xp').textContent = me.xp + '/100';

    // Zone warning
    const distToZone = Math.hypot(me.x - zone.x, me.y - zone.y);
    if(distToZone > zone.radius) {
        document.getElementById('zoneWarning').classList.remove('hidden');
    } else {
        document.getElementById('zoneWarning').classList.add('hidden');
    }

    // Death screen
    if(!me.alive) {
        document.getElementById('deathScreen').classList.remove('hidden');
        document.getElementById('finalRank').textContent = Object.values(players).filter(p => p.alive).length + 1;
        document.getElementById('finalKills').textContent = me.kills;
    }
}

function drawMinimap() {
    if(!miniCtx) return;
    miniCtx.fillStyle = '#0a1a0a';
    miniCtx.fillRect(0, 0, 180, 180);

    // Zone
    miniCtx.strokeStyle = '#0088ff';
    miniCtx.lineWidth = 2;
    miniCtx.beginPath();
    miniCtx.arc(zone.x/3000*180, zone.y/3000*180, zone.radius/3000*180, 0, Math.PI*2);
    miniCtx.stroke();

    // Danger zone
    miniCtx.strokeStyle = 'rgba(255,0,0,0.5)';
    miniCtx.lineWidth = 4;
    miniCtx.stroke();

    // Buildings
    miniCtx.fillStyle = '#666';
    buildings.forEach(b => {
        miniCtx.fillRect(b.x/3000*180, b.y/3000*180, b.w/3000*180, b.h/3000*180);
    });

    // Vehicles
    miniCtx.fillStyle = '#ff6600';
    vehicles.forEach(v => {
        miniCtx.fillRect(v.x/3000*180-2, v.y/3000*180-2, 4, 4);
    });

    // Players
    for(let id in players) {
        if(!players[id].alive) continue;
        if(players[id].inBush && id!== myId && (!myTeam || players[id].team!== myTeam)) continue;
        miniCtx.fillStyle = id === myId? '#00ff00' : (myTeam && players[id].team === myTeam? '#00ffff' : '#ff0000');
        miniCtx.beginPath();
        miniCtx.arc(players[id].x/3000*180, players[id].y/3000*180, 3, 0, Math.PI*2);
        miniCtx.fill();
    }

    // Direction indicator
    if(players[myId]) {
        const me = players[myId];
        miniCtx.strokeStyle = '#00ff00';
        miniCtx.lineWidth = 2;
        miniCtx.beginPath();
        miniCtx.moveTo(me.x/3000*180, me.y/3000*180);
        miniCtx.lineTo(
            me.x/3000*180 + Math.cos(me.angle)*10,
            me.y/3000*180 + Math.sin(me.angle)*10
        );
        miniCtx.stroke();
    }
}

// ============================================
// 14. VISUAL EFFECTS
// ============================================

function showDamage(dmg, x, y, color) {
    const dmgDiv = document.createElement('div');
    dmgDiv.className = 'damage';
    dmgDiv.textContent = Math.floor(dmg);
    dmgDiv.style.color = color;
    dmgDiv.style.left = (x - camera.x) + 'px';
    dmgDiv.style.top = (y - camera.y) + 'px';
    dmgDiv.style.fontSize = (16 + dmg/5) + 'px';
    document.getElementById('damageNumbers').appendChild(dmgDiv);
    setTimeout(() => dmgDiv.remove(), 1000);
}

function createExplosion(x, y) {
    for(let i=0; i<30; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random()-0.5)*12,
            vy: (Math.random()-0.5)*12,
            life: 30,
            size: Math.random()*8+4,
            color: '255,100,0'
        });
    }
}

function createMuzzleFlash() {
    if(!players[myId]) return;
    const me = players[myId];
    for(let i=0; i<5; i++) {
        particles.push({
            x: me.x + Math.cos(me.angle)*30,
            y: me.y + Math.sin(me.angle)*30,
            vx: Math.cos(me.angle + (Math.random()-0.5)*0.5)*8,
            vy: Math.sin(me.angle + (Math.random()-0.5)*0.5)*8,
            life: 10,
            size: Math.random()*4+2,
            color: '255,255,0'
        });
    }
}

function createHitmarker() {
    const hitmarker = document.getElementById('hitmarker');
    if(hitmarker) {
        hitmarker.classList.remove('hidden');
        setTimeout(() => hitmarker.classList.add('hidden'), 100);
    }
}

function createPickupEffect() {
    if(!players[myId]) return;
    const me = players[myId];
    for(let i=0; i<10; i++) {
        particles.push({
            x: me.x,
            y: me.y,
            vx: (Math.random()-0.5)*6,
            vy: (Math.random()-0.5)*6 - 3,
            life: 20,
            size: Math.random()*3+1,
            color: '0,255,136'
        });
    }
}

// ============================================
// 15. LEVEL SYSTEM
// ============================================

function checkLevelUp() {
    if(playerData.xp >= 100) {
        playerData.level++;
        playerData.xp -= 100;
        playerData.coins += 50;
        savePlayerData();
        updateLobbyUI();
        showLevelUpAnimation();
    }
}

function showLevelUpAnimation() {
    const div = document.createElement('div');
    div.className = 'levelup';
    div.innerHTML = `<h1>LEVEL UP!</h1><p>Level ${playerData.level}</p><p>+50 Coins</p>`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

// ============================================
// 16. LEADERBOARD
// ============================================

function updateLeaderboard() {
    const list = document.getElementById('lbList');
    if(!list) return;
    list.innerHTML = '';
    leaderboard.slice(0, 10).forEach((p, i) => {
        const li = document.createElement('li');
        li.className = p.name === playerData.username? 'me' : '';
        li.innerHTML = `
            <span class="rank">#${i+1}</span>
            <span class="name">${p.name}</span>
            <span class="stats">${p.kills} K / ${p.wins} W</span>
        `;
        list.appendChild(li);
    });
}

// ============================================
// 17. SCOREBOARD
// ============================================

function toggleScoreboard(show) {
    const sb = document.getElementById('scoreboard');
    if(!sb) return;
    if(show === undefined) sb.classList.toggle('hidden');
    else sb.classList.toggle('hidden',!show);

    if(!sb.classList.contains('hidden')) {
        updateScoreboard();
    }
}

function updateScoreboard() {
    const tbody = document.getElementById('scoreboardBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const sorted = Object.values(players).sort((a,b) => b.kills - a.kills);
    sorted.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = p.id === myId? 'me' : '';
        tr.innerHTML = `
            <td>${p.name}</td>
            <td>${p.kills}</td>
            <td>${p.level}</td>
            <td>${p.alive? '✅' : '💀'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ============================================
// 18. VICTORY/DEFEAT SCREENS
// ============================================

function showVictoryScreen() {
    document.getElementById('victoryScreen').classList.remove('hidden');
    document.getElementById('victoryKills').textContent = players[myId].kills;
    document.getElementById('victoryReward').textContent = '+100 Coins +200 XP';
    createFireworks();
}

function showDefeatScreen(rank) {
    document.getElementById('deathScreen').classList.remove('hidden');
    document.getElementById('finalRank').textContent = rank;
    document.getElementById('finalKills').textContent = players[myId].kills;
    document.getElementById('finalReward').textContent = `+${players[myId].kills * 10} Coins +${players[myId].kills * 5} XP`;
}

function createFireworks() {
    for(let i=0; i<50; i++) {
        setTimeout(() => {
            particles.push({
                x: Math.random() * canvas.width + camera.x,
                y: Math.random() * canvas.height + camera.y,
                vx: (Math.random()-0.5)*15,
                vy: (Math.random()-0.5)*15,
                life: 40,
                size: Math.random()*6+3,
                color: `${Math.random()*255},${Math.random()*255},${Math.random()*255}`
            });
        }, i * 50);
    }
}

function returnToLobby() {
    GAME_STATE = 'LOBBY';
    showScreen('lobbyScreen');
    location.reload();
}

// ============================================
// 19. BATTLE PASS
// ============================================

function openBattlePass() {
    document.getElementById('battlePassMenu').classList.remove('hidden');
    updateBattlePassUI();
}

function updateBattlePassUI() {
    const container = document.getElementById('bpRewards');
    if(!container) return;
    container.innerHTML = '';
    for(let i=1; i<=100; i++) {
        const claimed = playerData.battlePass.claimed.includes(i);
        const unlocked = playerData.battlePass.level >= i;
        const div = document.createElement('div');
        div.className = `bp-item ${claimed?'claimed':''} ${unlocked?'unlocked':''}`;
        div.innerHTML = `
            <div class="bp-level">LV ${i}</div>
            <div class="bp-reward">${getBPReward(i)}</div>
            ${unlocked &&!claimed?'<button onclick="claimBP('+i+')">CLAIM</button>':''}
        `;
        container.appendChild(div);
    }
}

function getBPReward(level) {
    if(level % 10 === 0) return '🎩 Special Hat';
    if(level % 5 === 0) return '🔫 Gun Skin';
    return '💰 10 Coins';
}

function claimBP(level) {
    if(playerData.battlePass.level >= level &&!playerData.battlePass.claimed.includes(level)) {
        playerData.battlePass.claimed.push(level);
        if(level % 10 === 0) playerData.skin.hat = 'crown';
        else if(level % 5 === 0) playerData.skin.gun = 'gold';
        else playerData.coins += 10;
        savePlayerData();
        updateLobbyUI();
        updateBattlePassUI();
    }
}

// ============================================
// 20. MAIN GAME LOOP
// ============================================

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start game loop
gameLoop();

// ============================================
// 21. WINDOW EVENTS
// ============================================

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

window.addEventListener('beforeunload', () => {
    savePlayerData();
});

// ============================================
// 22. UTILITY FUNCTIONS
// ============================================

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2,'0')}`;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}


// ==================== MG FIGHTER SPRITE SYSTEM ====================
// Apetraho @ farany @ script.js anao ity

// 1. SPRITE DATA
const SPRITE_DATA = {
  "frameSize": 32,
  "characters": {
    "boy": {
      "offsetX": 0,
      "animations": {
        "down": [ { "x": 0, "y": 0 }, { "x": 32, "y": 0 }, { "x": 64, "y": 0 }, { "x": 96, "y": 0 } ],
        "up": [ { "x": 0, "y": 32 }, { "x": 32, "y": 32 }, { "x": 64, "y": 32 }, { "x": 96, "y": 32 } ],
        "left": [ { "x": 0, "y": 64 }, { "x": 32, "y": 64 }, { "x": 64, "y": 64 }, { "x": 96, "y": 64 } ],
        "right": [ { "x": 0, "y": 96 }, { "x": 32, "y": 96 }, { "x": 64, "y": 96 }, { "x": 96, "y": 96 } ]
      }
    },
    "girl": {
      "offsetX": 128,
      "animations": {
        "down": [ { "x": 128, "y": 0 }, { "x": 160, "y": 0 }, { "x": 192, "y": 0 }, { "x": 224, "y": 0 } ],
        "up": [ { "x": 128, "y": 32 }, { "x": 160, "y": 32 }, { "x": 192, "y": 32 }, { "x": 224, "y": 32 } ],
        "left": [ { "x": 128, "y": 64 }, { "x": 160, "y": 64 }, { "x": 192, "y": 64 }, { "x": 224, "y": 64 } ],
        "right": [ { "x": 128, "y": 96 }, { "x": 160, "y": 96 }, { "x": 192, "y": 96 }, { "x": 224, "y": 96 } ]
      }
    }
  }
};

// 2. LOAD SPRITE IMAGE - SOLOY NY ANARANA RAHA TSY "sprites.png"
const spriteImg = new Image();
spriteImg.src = 'sprites.png'; // Ataovy ao @ public/ na root an'ny GitHub Pages
let spriteLoaded = false;
spriteImg.onload = () => {
    spriteLoaded = true;
    console.log('✅ Sprite loaded');
};
spriteImg.onerror = () => console.error('❌ Tsy hita ny sprites.png');

// 3. OVERRIDE NY PLAYER OBJECT REHEFA CREATE
const originalCreatePlayer = window.createPlayer || function(id, x, y) {
    return { id, x, y, vx: 0, vy: 0, hp: 100 };
};

window.createPlayer = function(id, x, y, skin = 'boy') {
    let p = originalCreatePlayer(id, x, y);
    p.skin = skin;
    p.direction = 'down';
    p.animFrame = 0;
    p.animTimer = 0;
    p.isMoving = false;
    p.username = id;
    return p;
};

// Ataovy boy daholo ny player efa misy
if (typeof player!== 'undefined') {
    player.skin = player.skin || 'boy';
    player.direction = player.direction || 'down';
    player.animFrame = 0;
    player.animTimer = 0;
}

// 4. ANIMATION UPDATE
function updatePlayerAnimation(p, deltaTime) {
    if (!p) return;

    // Farito ny direction
    if (Math.abs(p.vx) > 0.5 || Math.abs(p.vy) > 0.5) {
        p.isMoving = true;
        if (Math.abs(p.vx) > Math.abs(p.vy)) {
            p.direction = p.vx > 0? 'right' : 'left';
        } else {
            p.direction = p.vy > 0? 'down' : 'up';
        }
    } else {
        p.isMoving = false;
    }

    // Avance-o ny frame
    if (p.isMoving) {
        p.animTimer += deltaTime;
        if (p.animTimer > 120) { // 120ms = haingana kely
            p.animFrame = (p.animFrame + 1) % 4;
            p.animTimer = 0;
        }
    } else {
        p.animFrame = 0; // Mijoro
    }
}

// 5. DRAW PLAYER VAOVAO - MANOLO NY TALOHA
window.drawPlayer = function(p) {
    if (!p ||!ctx) return;

    // Raha tsy mbola load ny sprite dia efajoro mena vonjimaika
    if (!spriteLoaded) {
        ctx.fillStyle = p.id === player?.id? 'cyan' : 'red';
        ctx.fillRect(p.x - 16, p.y - 16, 32, 32);
        return;
    }

    const char = SPRITE_DATA.characters[p.skin] || SPRITE_DATA.characters['boy'];
    const anim = char.animations[p.direction] || char.animations['down'];
    const frame = anim[p.animFrame] || anim[0];
    const size = SPRITE_DATA.frameSize;
    const drawSize = size * 2; // x2 ny habe

    ctx.drawImage(
        spriteImg,
        frame.x, frame.y, size, size,
        p.x - drawSize/2, p.y - drawSize/2,
        drawSize, drawSize
    );

    // HP Bar
    if (p.hp < 100) {
        ctx.fillStyle = 'red';
        ctx.fillRect(p.x - 20, p.y - drawSize/2 - 10, 40, 4);
        ctx.fillStyle = 'lime';
        ctx.fillRect(p.x - 20, p.y - drawSize/2 - 10, 40 * (p.hp/100), 4);
    }

    // Anarana
    ctx.fillStyle = p.id === player?.id? '#00ff00' : 'white';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.strokeText(p.username || p.id, p.x, p.y - drawSize/2 - 15);
    ctx.fillText(p.username || p.id, p.x, p.y - drawSize/2 - 15);
};

// 6. HOOK @ GAME LOOP - MI-UPDATE AUTOMATIQUE
let lastSpriteUpdate = 0;
const originalGameLoop = window.gameLoop || window.update || window.render;

function spriteGameLoopHook(timestamp) {
    const deltaTime = timestamp - lastSpriteUpdate;
    lastSpriteUpdate = timestamp;

    // Update animation an'ny player rehetra
    if (typeof player!== 'undefined') updatePlayerAnimation(player, deltaTime);
    if (typeof otherPlayers!== 'undefined') {
        for (let id in otherPlayers) {
            updatePlayerAnimation(otherPlayers[id], deltaTime);
        }
    }

    // Miantso ny game loop original raha misy
    if (originalGameLoop) originalGameLoop(timestamp);
    else requestAnimationFrame(spriteGameLoopHook);
}

// Start raha tsy misy game loop
if (!originalGameLoop) requestAnimationFrame(spriteGameLoopHook);

// 7. COMMAND HANOVANA SKIN @ CONSOLE
window.setSkin = function(skin) {
    if (player) {
        player.skin = skin;
        if (socket) socket.emit('updateSkin', { skin: skin });
        console.log('Skin niova ho:', skin);
    }
};

console.log('🎮 Sprite System Loaded! Mampiasà setSkin("boy") na setSkin("girl") @ console');
// ==================== TAPITRA ====================
// ============================================
// 23. INITIALIZATION
// ============================================

updateLobbyUI();
updateLeaderboard();
updateBattlePassUI();

console.log('%c🎮 MG FIGHTER v4.0 LOADED', 'color:#00ff88;font-size:20px;font-weight:bold;');
console.log('%cFeatures: Lobby, Skins, Grenades, Vehicles, Teams', 'color:#00aaff;font-size:14px;');

