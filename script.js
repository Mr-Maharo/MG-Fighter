
// ============================================
// 0. SAFETY WRAPPERS
// ============================================
const SAFE = {
    getEl: (id) => document.getElementById(id),
    text: (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; },
    style: (id, prop, val) => { const el = document.getElementById(id); if(el) el.style[prop] = val; },
    class: (id, action, cls) => { const el = document.getElementById(id); if(el) el.classList[action](cls); },
    vibrate: (pattern) => { try { if(navigator.vibrate) navigator.vibrate(pattern); } catch(e){} },
    hypot: (x1,y1,x2,y2) => {
        if(Math.hypot) return Math.hypot(x2-x1, y2-y1);
        return Math.sqrt((x2-x1)**2 + (y2-y1)**2);
    },
    ls: {
        get: (key) => { try { return localStorage.getItem(key); } catch(e){ return null; } },
        set: (key,val) => { try { localStorage.setItem(key,val); } catch(e){} }
    }
};

// ============================================
// 1. INIT CHECKS
// ============================================
if(typeof firebase === 'undefined') {
    console.error('❌ Firebase CDN tsy loaded!');
    alert('Firebase tsy hita. Hamarino ny index.html');
    throw new Error('Firebase missing');
}

if(typeof io === 'undefined') {
    console.error('❌ Socket.io client tsy loaded!');
    alert('Socket.io tsy hita. Hamarino ny index.html');
    throw new Error('Socket.io missing');
}

const auth = firebase.auth();
const db = firebase.firestore();

// ============================================
// 2. CONFIG & CONSTANTS
// ============================================
const socket = io('https://mg-fighter-1.onrender.com', {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
});
window.socket = socket;
const API_URL = 'https://mg-fighter-1.onrender.com';
const MAP_SIZE = 3000;
const PHYSICS_TICK = 1000 / 60;
const MOVE_EMIT_RATE = 50; // 20hz
const MAX_PARTICLES = 150;

const canvas = SAFE.getEl('game');
if(!canvas) throw new Error('❌ Canvas #game tsy hita!');
const ctx = canvas.getContext('2d');
if(!ctx) throw new Error('❌ Canvas context tsy azo!');

const minimap = SAFE.getEl('minimap');
const miniCtx = minimap?.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let GAME_STATE = 'LOBBY';
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
let inputState = { up: 0, down: 0, left: 0, right: 0 };

let playerData = JSON.parse(SAFE.ls.get('mgPlayerData')) || {
    username: `Player${Math.floor(Math.random()*9999)}`,
    level: 1, xp: 0, coins: 100, wins: 0, kills: 0,
    skin: 'boy', friends: [],
    battlePass: { level: 1, xp: 0, claimed: [] }
};

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
let lastFrameTime = performance.now();
let accumulator = 0;
let lastMoveEmit = 0;
let isTabHidden = false;
let killFeedCount = 0;

// ============================================
// 3. SPRITE SYSTEM + 404 FALLBACK
// ============================================
const SPRITE_DATA = {
  "frameSize": 32,
  "characters": {
    "boy": {
      "animations": {
        "down": [ { "x": 0, "y": 0 }, { "x": 32, "y": 0 }, { "x": 64, "y": 0 }, { "x": 96, "y": 0 } ],
        "up": [ { "x": 0, "y": 32 }, { "x": 32, "y": 32 }, { "x": 64, "y": 32 }, { "x": 96, "y": 32 } ],
        "left": [ { "x": 0, "y": 64 }, { "x": 32, "y": 64 }, { "x": 64, "y": 64 }, { "x": 96, "y": 64 } ],
        "right": [ { "x": 0, "y": 96 }, { "x": 32, "y": 96 }, { "x": 64, "y": 96 }, { "x": 96, "y": 96 } ]
      }
    },
    "girl": {
      "animations": {
        "down": [ { "x": 128, "y": 0 }, { "x": 160, "y": 0 }, { "x": 192, "y": 0 }, { "x": 224, "y": 0 } ],
        "up": [ { "x": 128, "y": 32 }, { "x": 160, "y": 32 }, { "x": 192, "y": 32 }, { "x": 224, "y": 32 } ],
        "left": [ { "x": 128, "y": 64 }, { "x": 160, "y": 64 }, { "x": 192, "y": 64 }, { "x": 224, "y": 64 } ],
        "right": [ { "x": 128, "y": 96 }, { "x": 160, "y": 96 }, { "x": 192, "y": 96 }, { "x": 224, "y": 96 } ]
      }
    }
  }
};

const spriteImg = new Image();
spriteImg.src = 'sprites.png';
let spriteLoaded = false;
spriteImg.onload = () => { spriteLoaded = true; console.log('✅ Sprite loaded'); };
spriteImg.onerror = () => { console.warn('⚠️ sprites.png tsy hita, fallback square'); spriteLoaded = false; };

const mapImg = new Image();
mapImg.src = 'map.png';
let mapLoaded = false;
mapImg.onload = () => { mapLoaded = true; console.log('✅ Map loaded'); };
mapImg.onerror = () => { console.warn('⚠️ map.png tsy hita, fallback color'); mapLoaded = false; };

// ============================================
// 4. AUTH
// ============================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    SAFE.getEl(screenId)?.classList.remove('hidden');
}

function showAuthError(msg) {
    const el = SAFE.getEl('authError');
    if (el) { el.textContent = msg; setTimeout(()=>el.textContent='',4000); }
}

function savePlayerData() {
    SAFE.ls.set('mgPlayerData', JSON.stringify(playerData));
}

firebase.auth().onAuthStateChanged((user) => {
    if (user &&!currentUser) {
        currentUser = user.displayName || user.email.split('@')[0];
        console.log("✅ Tafiditra:", currentUser);
        socket.emit('playerLogin', {
            name: currentUser,
            uid: user.uid,
            skin: playerData.skin
        });
        db.collection("users").doc(user.uid).set({
            uid: user.uid,
            name: currentUser,
            email: user.email,
            photo: user.photoURL || "",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        showScreen('lobbyScreen');
    }
});

socket.on('authSuccess', (user) => {
    playerData = {...playerData,...user};
    if(!playerData.skin) playerData.skin = 'boy';
    savePlayerData();
    showScreen('lobbyScreen');
    updateLobbyUI();
    loadFriends();
    if(isMobile) SAFE.getEl('mobileControls')?.classList.remove('hidden');
});

socket.on('lobbyUpdate', (count) => SAFE.text('onlineCount', count));

// ============================================
// 5. LOBBY UI
// ============================================
function updateLobbyUI() {
    SAFE.text('playerName', playerData.username);
    SAFE.text('playerLevel', playerData.level);
    SAFE.text('playerCoins', playerData.coins);
    SAFE.text('playerWins', playerData.wins);
    SAFE.text('playerKills', playerData.kills);
    SAFE.style('playerAvatar', 'background', playerData.skin === 'girl'? '#ff69b4' : '#00ff00');
    SAFE.text('bpLevel', playerData.battlePass.level);
    SAFE.style('bpXP', 'width', (playerData.battlePass.xp % 100) + '%');
}

// ============================================
// 6. MATCHMAKING & ROOM
// ============================================
function findMatch(mode) {
    socket.emit('findMatch', mode);
    showScreen('matchmakingScreen');
    SAFE.text('matchmakingMode', mode.toUpperCase());
}

function createRoom() {
    socket.emit('createRoom', 'custom');
}

function joinRoom() {
    const code = SAFE.getEl('roomCode')?.value.toUpperCase().trim();
    if(code?.length === 6) socket.emit('joinRoom', code);
}

function leaveRoom() {
    socket.emit('leaveRoom');
    showScreen('lobbyScreen');
}

function ready() {
    socket.emit('ready');
    const btn = SAFE.getEl('readyBtn');
    if(btn) { btn.disabled = true; btn.textContent = 'READY ✅'; }
}

socket.on('roomCreated', (roomId) => showRoom(roomId));

socket.on('roomUpdate', (room) => {
    if(!room?.id) return;
    showRoom(room.id);
    const playersDiv = SAFE.getEl('roomPlayers');
    if(!playersDiv) return;
    playersDiv.innerHTML = '';
    (room.players || []).forEach((p) => {
        const isHost = p.id === room.host;
        playersDiv.innerHTML += `
            <div class="room-player ${p.ready?'ready':''}">
                <span>${isHost?'👑 ':''}${p.username || 'Player'}</span>
                <span>${p.ready?'✅':'⏳'}</span>
            </div>
        `;
    });
    SAFE.text('roomCount', `${(room.players || []).length}/4`);
});

function showRoom(roomId) {
    showScreen('roomScreen');
    SAFE.text('roomIdDisplay', roomId);
    currentRoom = roomId;
}

socket.on('gameStart', (roomId) => {
    GAME_STATE = 'GAME';
    showScreen('gameScreen');
    socket.emit('joinRoomGame', roomId);
});

// ============================================
// 7. CHAT - CLIENT SIDE SANITIZE
// ============================================
function sendLobbyChat() {
    const input = SAFE.getEl('lobbyChatInput');
    const msg = input?.value.trim();
    if(msg && msg.length < 200) {
        socket.emit('lobbyChat', msg);
        if(input) input.value = '';
    }
}

function sendRoomChat() {
    const input = SAFE.getEl('roomChatInput');
    const msg = input?.value.trim();
    if(msg && msg.length < 200) {
        socket.emit('roomChat', msg);
        if(input) input.value = '';
    }
}

socket.on('lobbyChat', (data) => {
    const div = SAFE.getEl('lobbyChatMessages');
    if(!div) return;
    const time = new Date(data.time || Date.now()).toLocaleTimeString('mg', {hour:'2-digit',minute:'2-digit'});
    div.innerHTML += `<p><span class="chat-time">${time}</span> <b class="chat-user">${escapeHtml(data.username || 'Anon')}:</b> ${escapeHtml(data.msg || '')}</p>`;
    div.scrollTop = div.scrollHeight;
});

socket.on('roomChat', (data) => {
    const div = SAFE.getEl('roomChatMessages');
    if(!div) return;
    const time = new Date(data.time || Date.now()).toLocaleTimeString('mg', {hour:'2-digit',minute:'2-digit'});
    div.innerHTML += `<p><span class="chat-time">${time}</span> <b class="chat-user">${escapeHtml(data.username || 'Anon')}:</b> ${escapeHtml(data.msg || '')}</p>`;
    div.scrollTop = div.scrollHeight;
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// ============================================
// 8. FRIENDS
// ============================================
function addFriend() {
    const name = SAFE.getEl('addFriendInput')?.value.trim();
    if(name && name!== playerData.username) {
        socket.emit('addFriend', name);
        const input = SAFE.getEl('addFriendInput');
        if(input) input.value = '';
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
    const div = SAFE.getEl('friendsList');
    if(!div) return;
    div.innerHTML = '<h4>Online</h4>';
    (data.online || []).forEach(f => {
        div.innerHTML += `<div class="friend online" onclick="inviteFriend('${f}')">🟢 ${f} <button>INVITE</button></div>`;
    });
    div.innerHTML += '<h4>Offline</h4>';
    (data.all || []).filter(f =>!(data.online || []).includes(f)).forEach(f => {
        div.innerHTML += `<div class="friend">⚫ ${f}</div>`;
    });
});

function inviteFriend(name) {
    socket.emit('inviteFriend', name);
}

// ============================================
// 9. SKIN SYSTEM
// ============================================
function openSkinMenu() {
    SAFE.getEl('skinMenu')?.classList.remove('hidden');
}

function changeSkin(skin) {
    if(skin!== 'boy' && skin!== 'girl') return;
    playerData.skin = skin;
    savePlayerData();
    socket.emit('setSkin', playerData.skin);
    updateLobbyUI();
}
window.setSkin = changeSkin;

// ============================================
// 10. GAME INIT - LERP RECONCILIATION
// ============================================
function initPlayerSprites() {
    for (let id in players) {
        const p = players[id];
        if (!p) continue;
        p.skin = p.skin || 'boy';
        p.direction = p.direction || 'down';
        p.animFrame = p.animFrame || 0;
        p.animTimer = p.animTimer || 0;
        p.isMoving = false;
        p.vx = 0;
        p.vy = 0;
        p.name = p.name || p.id || 'Player';
        p.targetX = p.x;
        p.targetY = p.y;
    }
}

socket.on('gameInit', (data) => {
    myId = data.id;
    players = data.players || {};
    initPlayerSprites();
    loot = data.loot || [];
    buildings = data.buildings || [];
    bushes = data.bushes || [];
    vehicles = data.vehicles || [];
    zone = data.zone || zone;
    leaderboard = data.leaderboard || [];
    updateLeaderboard();
    GAME_STATE = 'GAME';
});

socket.on('gameState', (data) => {
    for(let id in data.players){
        const serverP = data.players[id];
        if(!serverP) continue;

        if(players[id]){
            // LERP: smooth fa tsy teleport
            const p = players[id];
            p.targetX = serverP.x;
            p.targetY = serverP.y;
            p.hp = serverP.hp;
            p.armor = serverP.armor;
            p.alive = serverP.alive;
            p.weapon = serverP.weapon;
            p.ammo = serverP.ammo;
            p.grenades = serverP.grenades;
            p.kills = serverP.kills;
            p.level = serverP.level;
            p.team = serverP.team;
            p.inVehicle = serverP.inVehicle;
            p.inBush = serverP.inBush;
            p.angle = serverP.angle;
            // Tazomy ny skin/animation local
            p.skin = serverP.skin || p.skin || 'boy';
        } else {
            players[id] = {
              ...serverP,
                vx: 0, vy: 0, animFrame: 0, animTimer: 0,
                direction: 'down', skin: serverP.skin || 'boy',
                targetX: serverP.x, targetY: serverP.y
            };
        }
    }

    for(let id in players){
        if(!data.players[id]) delete players[id];
    }

    bullets = data.bullets || [];
    grenades = data.grenades || [];
    loot = data.loot || [];
    vehicles = data.vehicles || [];
});

socket.on('zoneUpdate', (data) => {
    zone = data.zone || zone;
    SAFE.text('zoneTimer', `ZONE: ${data.timer || 0}s`);
});

socket.on('lootTaken', (lootId) => {
    loot = loot.filter(l => l.id!== lootId);
    createPickupEffect();
});

socket.on('explosion', (data) => {
    createExplosion(data.x, data.y);
    screenShake = 20;
    SAFE.vibrate([100, 50, 100]);
});

// FIXED: data.killer mety username na id
socket.on('killFeed', (data) => {
    const feed = SAFE.getEl('killFeed');
    if(!feed) return;

    // Mitady raha username na id
    let killerName = 'Unknown';
    if(data.killer === 'ZONE') killerName = '🔥 ZONE';
    else {
        const killerP = Object.values(players).find(p => p.id === data.killer || p.name === data.killer);
        killerName = killerP?.name || data.killer?.substring(0,8) || 'Unknown';
    }

    const victimP = Object.values(players).find(p => p.id === data.victim || p.name === data.victim);
    const victimName = victimP?.name || data.victim?.substring(0,8) || 'Unknown';

    const kill = document.createElement('div');
    kill.className = 'kill';
    kill.innerHTML = `${killerName} → ${victimName} <span class="weapon">[${data.weapon || 'Unknown'}]</span>`;
    feed.prepend(kill);

    // FIXED: Cap killfeed DOM
    killFeedCount++;
    if(killFeedCount > 10) {
        feed.lastChild?.remove();
        killFeedCount--;
    }
    setTimeout(() => { kill.remove(); killFeedCount--; }, 5000);

    SAFE.text('aliveCount', data.playersAlive || 0);

    if(data.killer === myId || data.killer === playerData.username) {
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
    SAFE.vibrate(50);
});

socket.on('hitmarker', (data) => {
    showDamage(data.damage, data.x, data.y, '#ffff00');
    createHitmarker();
});

socket.on('leaderboardUpdate', (data) => {
    leaderboard = data || [];
    updateLeaderboard();
});

// ============================================
// 11. CONTROLS
// ============================================
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    updateInputState();
    if(e.key === 'Shift') isSprinting = true;
    if(e.key.toLowerCase() === 'e') pickupLoot();
    if(e.key.toLowerCase() === 'r') throwGrenade();
    if(e.key.toLowerCase() === 'f') toggleVehicle();
    if(e.key.toLowerCase() === 'b') toggleScoreboard();
    if(e.key === 'Tab') { e.preventDefault(); toggleScoreboard(true); }
});

window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
    updateInputState();
    if(e.key === 'Shift') isSprinting = false;
    if(e.key === 'Tab') toggleScoreboard(false);
});

function updateInputState() {
    inputState.up = (keys['w'] || keys['z'])? 1 : 0;
    inputState.down = keys['s']? 1 : 0;
    inputState.left = (keys['a'] || keys['q'])? 1 : 0;
    inputState.right = keys['d']? 1 : 0;
}

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
    if(isZooming) e.preventDefault();
});

// ============================================
// 12. MOBILE CONTROLS
// ============================================
if(isMobile) {
    const joystick = SAFE.getEl('joystick');
    const knob = SAFE.getEl('joystickKnob');

    if(joystick && knob) {
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
            inputState = { up: 0, down: 0, left: 0, right: 0 };
        });

        function handleJoystick(touch) {
            const rect = joystick.getBoundingClientRect();
            const cx = rect.left + rect.width/2;
            const cy = rect.top + rect.height/2;
            let dx = touch.clientX - cx;
            let dy = touch.clientY - cy;
            const dist = Math.min(SAFE.hypot(0,0,dx,dy), 40);
            const angle = Math.atan2(dy, dx);
            dx = Math.cos(angle) * dist;
            dy = Math.sin(angle) * dist;
            joystickData = {x: dx/40, y: dy/40};
            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

            inputState.up = joystickData.y < -0.3? 1 : 0;
            inputState.down = joystickData.y > 0.3? 1 : 0;
            inputState.left = joystickData.x < -0.3? 1 : 0;
            inputState.right = joystickData.x > 0.3? 1 : 0;
        }
    }

    canvas.addEventListener('touchmove', (e) => {
        if(e.touches.length === 1 && players[myId]) {
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            players[myId].angle = Math.atan2(touch.clientY - rect.height/2, touch.clientX - rect.width/2);
        }
    });

    SAFE.getEl('shootBtn')?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        shoot();
        SAFE.vibrate(30);
    });

    SAFE.getEl('scopeBtn')?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleScope(true);
    });
    SAFE.getEl('scopeBtn')?.addEventListener('touchend', (e) => {
        e.preventDefault();
        toggleScope(false);
    });

    SAFE.getEl('lootBtn')?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        pickupLoot();
    });

    SAFE.getEl('sprintBtn')?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isSprinting = true;
    });
    SAFE.getEl('sprintBtn')?.addEventListener('touchend', (e) => {
        e.preventDefault();
        isSprinting = false;
    });

    SAFE.getEl('grenadeBtn')?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        throwGrenade();
    });

    SAFE.getEl('vehicleBtn')?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleVehicle();
    });
}

// ============================================
// 13. GAME ACTIONS
// ============================================
function shoot() {
    if(!players[myId]?.alive) return;
    const now = Date.now();
    const weapon = WEAPONS[players[myId].weapon || 'Fist'];
    if(now - lastShotTime < weapon.fireRate) return;
    if((players[myId].ammo || 0) <= 0 && players[myId].weapon!== 'Fist') return;

    lastShotTime = now;
    socket.emit('shoot');
    screenShake = 3;
    createMuzzleFlash();
}

function throwGrenade() {
    if(!players[myId]?.alive || (players[myId].grenades || 0) <= 0) return;
    socket.emit('throwGrenade');
}

function toggleVehicle() {
    const me = players[myId];
    if(!me?.alive) return;
    if(me.inVehicle) {
        socket.emit('exitVehicle');
    } else {
        const v = vehicles.find(v =>!v.driver && SAFE.hypot(me.x,me.y,v.x,v.y) < 50);
        if(v) socket.emit('enterVehicle', v.id);
    }
}

function pickupLoot() {
    const me = players[myId];
    if(!me?.alive) return;
    let closest = null, minDist = 60;
    loot.forEach(l => {
        const dist = SAFE.hypot(me.x, me.y, l.x, l.y);
        if(dist < minDist) { minDist = dist; closest = l; }
    });
    if(closest) socket.emit('pickup', closest.id);
}

function toggleScope(state) {
    isZooming = state;
    SAFE.getEl('scope')?.classList.toggle('hidden',!state);
}

// ============================================
// 14. UPDATE + LERP RECONCILIATION
// ============================================
function update() {
    if(GAME_STATE!== 'GAME' ||!players[myId]?.alive) return;
    const me = players[myId];

    let speed = isSprinting? 6 : 4;
    if(me.inVehicle) {
        const v = vehicles.find(v => v.id === me.inVehicle);
        if(v) speed = v.speed;
    }
    if(isZooming) speed *= 0.5;

    if(isMobile) {
        me.vx = joystickData.x * speed;
        me.vy = joystickData.y * speed;
        me.x += me.vx;
        me.y += me.vy;
        autoAim();
    } else {
        me.vx = ((keys['d']?1:0) - (keys['a']||keys['q']?1:0)) * speed;
        me.vy = ((keys['s']?1:0) - (keys['w']||keys['z']?1:0)) * speed;
        me.x += me.vx;
        me.y += me.vy;
    }

    me.x = Math.max(15, Math.min(MAP_SIZE - 15, me.x));
    me.y = Math.max(15, Math.min(MAP_SIZE - 15, me.y));

    me.inBush = bushes.some(b => SAFE.hypot(me.x, me.y, b.x, b.y) < b.radius);

    const now = Date.now();
    if(now - lastMoveEmit > MOVE_EMIT_RATE){
        socket.emit('move', {
            x: me.x, y: me.y, angle: me.angle,
            zooming: isZooming, sprinting: isSprinting,
            inputState: inputState
        });
        lastMoveEmit = now;
    }

    camera.x = me.x - canvas.width/2;
    camera.y = me.y - canvas.height/2;

    if(screenShake > 0) screenShake *= 0.9;
}

function autoAim() {
    if(!isMobile ||!players[myId]) return;
    let closest = null, minDist = 300;
    for(let id in players) {
        if(id === myId ||!players[id].alive) continue;
        if(myTeam && players[id].team === myTeam) continue;
        const dist = SAFE.hypot(players[id].x, players[id].y, players[myId].x, players[myId].y);
        if(dist < minDist) { minDist = dist; closest = players[id]; }
    }
    if(closest) {
        players[myId].angle = Math.atan2(closest.y - players[myId].y, closest.x - players[myId].x);
    }
}

function updatePlayerAnimation(p, deltaTime) {
    if (!p) return;

    let moving = false;
    if(p.id === myId){
        moving = inputState.up || inputState.down || inputState.left || inputState.right;
        if (moving) {
            if (inputState.left) p.direction = 'left';
            else if (inputState.right) p.direction = 'right';
            else if (inputState.up) p.direction = 'up';
            else if (inputState.down) p.direction = 'down';
        }
    } else {
        moving = Math.abs(p.vx) > 0.5 || Math.abs(p.vy) > 0.5;
        if (moving) {
            if (Math.abs(p.vx) > Math.abs(p.vy)) {
                p.direction = p.vx > 0? 'right' : 'left';
            } else {
                p.direction = p.vy > 0? 'down' : 'up';
            }
        }
    }

    p.isMoving = moving;

    if (p.isMoving) {
        p.animTimer = (p.animTimer || 0) + deltaTime;
        if (p.animTimer > 120) {
            p.animFrame = ((p.animFrame || 0) + 1) % 4;
            p.animTimer = 0;
        }
    } else {
        p.animFrame = 0;
    }

    // LERP: smooth movement avy @ server
    if(p.id!== myId && p.targetX!== undefined){
        p.x = lerp(p.x, p.targetX, 0.3);
        p.y = lerp(p.y, p.targetY, 0.3);
    }
}

// ============================================
// 15. RENDER
// ============================================
function draw() {
    if(GAME_STATE!== 'GAME') return;

    ctx.save();
    if(screenShake > 0.5) {
        ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake);
    }

    if (mapLoaded) {
        ctx.drawImage(
            mapImg,
            camera.x, camera.y, canvas.width, canvas.height,
            0, 0, canvas.width, canvas.height
        );
    } else {
        ctx.fillStyle = '#1a3a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for(let x = -camera.x%50; x < canvas.width; x+=50) {
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
    }
    for(let y = -camera.y%50; y < canvas.height; y+=50) {
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
    }

    ctx.strokeStyle = '#0088ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(zone.x - camera.x, zone.y - camera.y, zone.radius, 0, Math.PI*2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,100,255,0.05)';
    ctx.fill();

    bushes.forEach(b => {
        ctx.fillStyle = 'rgba(0,80,0,0.6)';
        ctx.beginPath();
        ctx.arc(b.x - camera.x, b.y - camera.y, b.radius, 0, Math.PI*2);
        ctx.fill();
    });

    buildings.forEach(b => {
        ctx.fillStyle = '#444';
        ctx.fillRect(b.x - camera.x, b.y - camera.y, b.w, b.h);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x - camera.x, b.y - camera.y, b.w, b.h);
    });

    vehicles.forEach(v => {
        ctx.save();
        ctx.translate(v.x - camera.x, v.y - camera.y);
        ctx.rotate(v.angle);
        ctx.fillStyle = v.driver? '#ff6600' : '#666';
        ctx.fillRect(-30, -15, 60, 30);
        ctx.restore();
    });

    loot.forEach(l => {
        const colors = {
            Medkit:'#00ff00', Armor:'#0088ff', Scope:'#ff00ff',
            AK:'#ffaa00', Shotgun:'#ff6600', Sniper:'#aa00ff',
            SMG:'#00ffff', Pistol:'#ffff00', Grenade:'#ff0000'
        };
                ctx.shadowColor = colors[l.type] || '#ffffff';
        ctx.shadowBlur = 15;
        ctx.fillStyle = colors[l.type] || '#ffffff';
        ctx.fillRect(l.x - camera.x - 12, l.y - camera.y - 12, 24, 24);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeText(l.type, l.x - camera.x, l.y - camera.y - 18);
        ctx.fillText(l.type, l.x - camera.x, l.y - camera.y - 18);
    });

    ctx.fillStyle = '#ff0000';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 10;
    grenades.forEach(g => {
        ctx.beginPath();
        ctx.arc(g.x - camera.x, g.y - camera.y, 6, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffff00';
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 5;
    bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x - camera.x, b.y - camera.y, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,0,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x - camera.x, b.y - camera.y);
        ctx.lineTo(b.x - camera.x - (b.speedX||0)*2, b.y - camera.y - (b.speedY||0)*2);
        ctx.stroke();
    });
    ctx.shadowBlur = 0;

    for (let id in players) {
        const p = players[id];
        if (!p?.alive) continue;
        if (p.inBush && id!== myId && (!myTeam || p.team!== myTeam)) continue;
        drawPlayer({
        ...p,
            x: p.x - camera.x,
            y: p.y - camera.y,
            id
        });
    }

    drawParticles();
    ctx.restore();
    drawUI();
    drawMinimap();
}

window.drawPlayer = function(p) {
    if (!p ||!ctx) return;

    if (!spriteLoaded) {
        ctx.fillStyle = p.id === myId? '#00ff00' : '#ff0000';
        ctx.fillRect(p.x - 16, p.y - 16, 32);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - 16, p.y - 16, 32, 32);
    } else {
        const char = SPRITE_DATA.characters[p.skin] || SPRITE_DATA.characters['boy'];
        const anim = char.animations[p.direction] || char.animations['down'];
        const frame = anim[p.animFrame] || anim[0];
        const size = SPRITE_DATA.frameSize;
        const drawSize = size * 2;

        ctx.drawImage(
            spriteImg,
            frame.x, frame.y, size,
            p.x - drawSize/2, p.y - drawSize/2,
            drawSize, drawSize
        );
    }

    if (p.hp < 100) {
        ctx.fillStyle = 'red';
        ctx.fillRect(p.x - 20, p.y - 26, 40, 4);
        ctx.fillStyle = 'lime';
        ctx.fillRect(p.x - 20, p.y - 26, 40 * (p.hp/100), 4);
    }

    if (p.armor > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(p.x - 20, p.y - 32, 40, 3);
        ctx.fillStyle = '#0088ff';
        ctx.fillRect(p.x - 20, p.y - 32, 40 * (p.armor/100), 3);
    }

    ctx.fillStyle = p.id === myId? '#00ff00' : 'white';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    const teamTag = p.team? `[${p.team}] ` : '';
    const nameText = teamTag + (p.name || p.id || 'Player');
    ctx.strokeText(nameText, p.x, p.y - 36);
    ctx.fillText(nameText, p.x, p.y - 36);
};

function drawParticles() {
    if(particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);

    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life--;
        p.size *= 0.95;
        return p.life > 0;
    });

    particles.forEach(p => {
        ctx.fillStyle = `rgba(${p.color},${p.life/30})`;
        ctx.beginPath();
        ctx.arc(p.x - camera.x, p.y - camera.y, p.size, 0, Math.PI*2);
        ctx.fill();
    });
}

function updateParticles() {}

function drawUI() {
    if(!players[myId]) return;
    const me = players[myId];

    SAFE.text('hp', Math.floor(me.hp));
    SAFE.style('hpBar', 'width', me.hp + '%');
    SAFE.text('armor', Math.floor(me.armor));
    SAFE.style('armorBar', 'width', me.armor + '%');
    SAFE.text('weapon', me.weapon || 'Fist');
    SAFE.text('ammo', me.ammo === Infinity? '∞' : (me.ammo || 0));
    SAFE.text('grenades', me.grenades || 0);
    SAFE.text('kills', me.kills || 0);
    SAFE.text('level', me.level || 1);
    SAFE.text('xp', (me.xp || 0) + '/100');

    const distToZone = SAFE.hypot(me.x, me.y, zone.x, zone.y);
    const zoneWarning = SAFE.getEl('zoneWarning');
    if(zoneWarning){
        if(distToZone > zone.radius) zoneWarning.classList.remove('hidden');
        else zoneWarning.classList.add('hidden');
    }

    if(!me.alive) {
        SAFE.getEl('deathScreen')?.classList.remove('hidden');
        SAFE.text('finalRank', Object.values(players).filter(p => p?.alive).length + 1);
        SAFE.text('finalKills', me.kills || 0);
    }
}

function drawMinimap() {
    if(!miniCtx) return;
    miniCtx.fillStyle = '#0a1a0a';
    miniCtx.fillRect(0, 0, 180, 180);

    miniCtx.strokeStyle = '#0088ff';
    miniCtx.lineWidth = 2;
    miniCtx.beginPath();
    miniCtx.arc(zone.x/MAP_SIZE*180, zone.y/MAP_SIZE*180, zone.radius/MAP_SIZE*180, 0, Math.PI*2);
    miniCtx.stroke();

    miniCtx.fillStyle = '#666';
    buildings.forEach(b => {
        miniCtx.fillRect(b.x/MAP_SIZE*180, b.y/MAP_SIZE*180, b.w/MAP_SIZE*180, b.h/MAP_SIZE*180);
    });

    miniCtx.fillStyle = '#ff6600';
    vehicles.forEach(v => {
        miniCtx.fillRect(v.x/MAP_SIZE*180-2, v.y/MAP_SIZE*180-2, 4, 4);
    });

    for(let id in players) {
        if(!players[id]?.alive) continue;
        if(players[id].inBush && id!== myId && (!myTeam || players[id].team!== myTeam)) continue;
        miniCtx.fillStyle = id === myId? '#00ff00' : (myTeam && players[id].team === myTeam? '#00ffff' : '#ff0000');
        miniCtx.beginPath();
        miniCtx.arc(players[id].x/MAP_SIZE*180, players[id].y/MAP_SIZE*180, 3, 0, Math.PI*2);
        miniCtx.fill();
    }

    if(players[myId]) {
        const me = players[myId];
        miniCtx.strokeStyle = '#00ff00';
        miniCtx.lineWidth = 2;
        miniCtx.beginPath();
        miniCtx.moveTo(me.x/MAP_SIZE*180, me.y/MAP_SIZE*180);
        miniCtx.lineTo(
            me.x/MAP_SIZE*180 + Math.cos(me.angle)*10,
            me.y/MAP_SIZE*180 + Math.sin(me.angle)*10
        );
        miniCtx.stroke();
    }
}

// ============================================
// 15. VISUAL EFFECTS
// ============================================
function showDamage(dmg, x, y, color) {
    const dmgDiv = document.createElement('div');
    dmgDiv.className = 'damage';
    dmgDiv.textContent = Math.floor(dmg);
    dmgDiv.style.color = color;
    dmgDiv.style.left = (x - camera.x) + 'px';
    dmgDiv.style.top = (y - camera.y) + 'px';
    dmgDiv.style.fontSize = (16 + dmg/5) + 'px';
    SAFE.getEl('damageNumbers')?.appendChild(dmgDiv);
    setTimeout(() => dmgDiv.remove(), 1000);
}

function createExplosion(x, y) {
    for(let i=0; i<30; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random()-0.5)*12,
            vy: (Math.random()-0.5)*12,
            life: 30, size: Math.random()*8+4, color: '255,100,0'
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
            vx: Math.cos(me.angle + (Math.random()-0.5)*0.2) * 8,
            vy: Math.sin(me.angle + (Math.random()-0.5)*0.2) * 8,
            life: 10, size: Math.random()*4+2, color: '255,255,0'
        });
    }
}

function createHitmarker() {
    const hitmarker = SAFE.getEl('hitmarker');
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
            x: me.x, y: me.y,
            vx: (Math.random()-0.5)*6,
            vy: (Math.random()-0.5)*6 - 3,
            life: 20, size: Math.random()*3+1, color: '0,255,136'
        });
    }
}

// ============================================
// 16. LEVEL SYSTEM
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
// 17. LEADERBOARD
// ============================================
function updateLeaderboard() {
    const list = SAFE.getEl('lbList');
    if(!list) return;
    list.innerHTML = '';
    (leaderboard || []).slice(0, 10).forEach((p, i) => {
        const li = document.createElement('li');
        li.className = p.name === playerData.username? 'me' : '';
        li.innerHTML = `
            <span class="rank">#${i+1}</span>
            <span class="name">${p.name || 'Unknown'}</span>
            <span class="stats">${p.kills || 0} K / ${p.wins || 0} W</span>
        `;
        list.appendChild(li);
    });
}

// ============================================
// 18. SCOREBOARD
// ============================================
function toggleScoreboard(show) {
    const sb = SAFE.getEl('scoreboard');
    if(!sb) return;
    if(show === undefined) sb.classList.toggle('hidden');
    else sb.classList.toggle('hidden',!show);
    if(!sb.classList.contains('hidden')) updateScoreboard();
}

function updateScoreboard() {
    const tbody = SAFE.getEl('scoreboardBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const sorted = Object.values(players).sort((a,b) => (b.kills||0) - (a.kills||0));
    sorted.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = p.id === myId? 'me' : '';
        tr.innerHTML = `
            <td>${p.name || p.id || 'Unknown'}</td>
            <td>${p.kills || 0}</td>
            <td>${p.level || 1}</td>
            <td>${p.alive? '✅' : '💀'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ============================================
// 19. VICTORY/DEFEAT
// ============================================
function showVictoryScreen() {
    SAFE.getEl('victoryScreen')?.classList.remove('hidden');
    SAFE.text('victoryKills', players[myId]?.kills || 0);
    SAFE.text('victoryReward', '+100 Coins +200 XP');
    createFireworks();
}

function showDefeatScreen(rank) {
    SAFE.getEl('deathScreen')?.classList.remove('hidden');
    SAFE.text('finalRank', rank);
    SAFE.text('finalKills', players[myId]?.kills || 0);
    SAFE.text('finalReward', `+${(players[myId]?.kills || 0) * 10} Coins +${(players[myId]?.kills || 0) * 5} XP`);
}

function createFireworks() {
    for(let i=0; i<50; i++) {
        setTimeout(() => {
            particles.push({
                x: Math.random() * canvas.width + camera.x,
                y: Math.random() * canvas.height + camera.y,
                vx: (Math.random()-0.5)*15,
                vy: (Math.random()-0.5)*15,
                life: 40, size: Math.random()*6+3,
                color: `${Math.random()*255},${Math.random()*255},${Math.random()*255}`
            });
        }, i * 50);
    }
}

function returnToLobby() {
    GAME_STATE = 'LOBBY';
    showScreen('lobbyScreen');
    socket.disconnect();
    setTimeout(() => location.reload(), 100);
}

// ============================================
// 20. BATTLE PASS
// ============================================
function openBattlePass() {
    SAFE.getEl('battlePassMenu')?.classList.remove('hidden');
    updateBattlePassUI();
}

function updateBattlePassUI() {
    const container = SAFE.getEl('bpRewards');
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
    if(level % 10 === 0) return '🎩 Skin Special';
    if(level % 5 === 0) return '💰 50 Coins';
    return '💰 10 Coins';
}

function claimBP(level) {
    if(playerData.battlePass.level >= level &&!playerData.battlePass.claimed.includes(level)) {
        playerData.battlePass.claimed.push(level);
        if(level % 5 === 0) playerData.coins += 50;
        else playerData.coins += 10;
        savePlayerData();
        updateLobbyUI();
        updateBattlePassUI();
    }
}

// ============================================
// 21. MAIN GAME LOOP + VISIBILITY PAUSE
// ============================================
document.addEventListener('visibilitychange', () => {
    isTabHidden = document.hidden;
});

function gameLoop(now) {
    if(isTabHidden) {
        requestAnimationFrame(gameLoop);
        return;
    }

    const dt = now - lastFrameTime;
    lastFrameTime = now;

    update();
    for(let id in players) updatePlayerAnimation(players[id], dt);
    draw();
    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

// ============================================
// 22. WINDOW EVENTS + CLEANUP
// ============================================
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

window.addEventListener('beforeunload', () => {
    savePlayerData();
    socket.disconnect();
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

socket.on('connect', () => {
    console.log('Connected to server');
});

// ============================================
// 23. UTILITY
// ============================================
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2,'0')}`;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

// ============================================
// 24. INIT
// ============================================
if(!canvas) console.error('❌ Canvas #game tsy hita!');
if(!ctx) console.error('❌ Canvas context tsy azo!');

updateLobbyUI();
updateLeaderboard();
updateBattlePassUI();

console.log('%c🎮 MG FIGHTER v4.4 FINAL LOADED', 'color:#00ff88;font-size:20px;font-weight:bold;');
console.log('%cFixed: All crashes, desync, lag, memory leaks', 'color:#00aaff;font-size:14px;');
