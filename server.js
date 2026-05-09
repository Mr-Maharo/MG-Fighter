/*
 * ============================================================================
 * MG FIGHTER CLIENT - MATCH SERVER EXISTANT
 * Mifanaraka @ server.js joinGame + gameState
 * ============================================================================
 */

const socket = io('https://mg-fighter-1.onrender.com');
let myId = null;
let currentUser = null;
let gameState = null;

// ============================================
// 1. AUTH - EFA AO @ HTML FA MIANO LISTENER ETO
// ============================================
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        currentUser = user.displayName || user.email.split('@')[0];
        console.log("✅ Tafiditra:", currentUser);

        // Alefa any @ server - MATCH @ server.js
        socket.emit('joinGame', {
            name: currentUser,
            skin: 'boy' // default, ovaina any @ skin menu
        });

        // UI: Afindra lobby
        document.getElementById('authScreen')?.classList.add('hidden');
        document.getElementById('lobbyScreen')?.classList.remove('hidden');
        const nameEl = document.getElementById('playerName');
        if(nameEl) nameEl.textContent = currentUser;
    }
});

// ============================================
// 2. SOCKET EVENTS AVY @ SERVER
// ============================================
socket.on('connect', () => {
    myId = socket.id;
    console.log('✅ Connected:', myId);
});

socket.on('gameState', (state) => {
    gameState = state;

    // Update online count = isan'ny players
    const onlineEl = document.getElementById('onlineCount');
    if(onlineEl) onlineEl.textContent = state.players.length;

    // Raha ao @ game dia render
    if(!document.getElementById('gameScreen')?.classList.contains('hidden')) {
        renderGame(state);
    }
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected');
});

// ============================================
// 3. LOBBY FUNCTIONS
// ============================================
function findMatch(mode) {
    socket.emit('findMatch', mode);
    document.getElementById('matchmakingScreen')?.classList.remove('hidden');
    document.getElementById('lobbyScreen')?.classList.add('hidden');
    const modeEl = document.getElementById('matchmakingMode');
    if(modeEl) modeEl.textContent = mode.toUpperCase();
}

function cancelMatchmaking() {
    socket.emit('cancelMatchmaking');
    document.getElementById('matchmakingScreen')?.classList.add('hidden');
    document.getElementById('lobbyScreen')?.classList.remove('hidden');
}

function createRoom() {
    socket.emit('createRoom', 'custom');
}

function joinRoom() {
    const code = document.getElementById('roomCode')?.value.toUpperCase().trim();
    if(code?.length === 6) socket.emit('joinRoom', code);
}

function leaveRoom() {
    socket.emit('leaveRoom');
    document.getElementById('roomScreen')?.classList.add('hidden');
}

function ready() {
    socket.emit('ready');
    const btn = document.getElementById('readyBtn');
    if(btn) { btn.disabled = true; btn.textContent = 'READY ✅'; }
}

// ============================================
// 4. CHAT
// ============================================
function sendLobbyChat() {
    const input = document.getElementById('lobbyChatInput');
    const msg = input?.value.trim();
    if(msg && msg.length < 200) {
        socket.emit('lobbyChat', msg);
        if(input) input.value = '';
    }
}

function sendRoomChat() {
    const input = document.getElementById('roomChatInput');
    const msg = input?.value.trim();
    if(msg && msg.length < 200) {
        socket.emit('roomChat', msg);
        if(input) input.value = '';
    }
}

socket.on('lobbyChat', (data) => {
    const div = document.getElementById('lobbyChatMessages');
    if(!div) return;
    const time = new Date(data.time || Date.now()).toLocaleTimeString('mg', {hour:'2-digit',minute:'2-digit'});
    div.innerHTML += `<p><span class="chat-time">${time}</span> <b class="chat-user">${escapeHtml(data.username || 'Anon')}:</b> ${escapeHtml(data.msg || '')}</p>`;
    div.scrollTop = div.scrollHeight;
});

socket.on('roomChat', (data) => {
    const div = document.getElementById('roomChatMessages');
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
// 5. FRIENDS
// ============================================
function addFriend() {
    const name = document.getElementById('addFriendInput')?.value.trim();
    if(name && name!== currentUser) {
        socket.emit('addFriend', name);
        const input = document.getElementById('addFriendInput');
        if(input) input.value = '';
    }
}

function loadFriends() {
    socket.emit('getFriends');
}

socket.on('friendsList', (data) => {
    const div = document.getElementById('friendsList');
    if(!div) return;
    div.innerHTML = '<h4>Online</h4>';
    (data.online || []).forEach(f => {
        div.innerHTML += `<div class="friend online" onclick="inviteFriend('${f}')">🟢 ${escapeHtml(f)} <button>INVITE</button></div>`;
    });
    div.innerHTML += '<h4>Offline</h4>';
    (data.all || []).filter(f =>!(data.online || []).includes(f)).forEach(f => {
        div.innerHTML += `<div class="friend">⚫ ${escapeHtml(f)}</div>`;
    });
});

function inviteFriend(name) {
    socket.emit('inviteFriend', name);
}

// ============================================
// 6. ROOM EVENTS
// ============================================
socket.on('roomCreated', (roomId) => {
    showRoom(roomId);
});

socket.on('roomUpdate', (room) => {
    if(!room?.id) return;
    showRoom(room.id);
    const playersDiv = document.getElementById('roomPlayers');
    if(!playersDiv) return;
    playersDiv.innerHTML = '';
    (room.players || []).forEach((p) => {
        const isHost = p.id === room.host;
        playersDiv.innerHTML += `
            <div class="room-player ${p.ready?'ready':''}">
                <span>${isHost?'👑 ':''}${escapeHtml(p.username || 'Player')}</span>
                <span>${p.ready?'✅':'⏳'}</span>
            </div>
        `;
    });
    const countEl = document.getElementById('roomCount');
    if(countEl) countEl.textContent = `${(room.players || []).length}/4`;
});

function showRoom(roomId) {
    document.getElementById('roomScreen')?.classList.remove('hidden');
    const idEl = document.getElementById('roomIdDisplay');
    if(idEl) idEl.textContent = roomId;
}

socket.on('gameStart', () => {
    document.getElementById('roomScreen')?.classList.add('hidden');
    document.getElementById('matchmakingScreen')?.classList.add('hidden');
    document.getElementById('gameScreen')?.classList.remove('hidden');
    initGame();
});

// ============================================
// 7. GAME SIMPLE
// ============================================
let canvas, ctx;
let keys = {};

function initGame() {
    canvas = document.getElementById('game');
    if(!canvas) return;
    ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Controls
    window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
    window.addEventListener('click', e => {
        const rect = canvas.getBoundingClientRect();
        const angle = Math.atan2(e.clientY - canvas.height/2, e.clientX - canvas.width/2);
        socket.emit('shoot', angle);
    });

    gameLoop();
}

function update() {
    const dir = {
        up: keys['w'] || keys['z'],
        down: keys['s'],
        left: keys['a'] || keys['q'],
        right: keys['d']
    };
    if(dir.up || dir.down || dir.left || dir.right) {
        socket.emit('move', dir);
    }
}

function renderGame(state) {
    if(!ctx ||!canvas) return;
    ctx.fillStyle = '#1a3a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const me = state.players.find(p => p.id === myId);
    if(!me) return;

    const camX = me.x - canvas.width/2;
    const camY = me.y - canvas.height/2;

    // Buildings
    ctx.fillStyle = '#444';
    state.buildings.forEach(b => {
        ctx.fillRect(b.x - camX, b.y - camY, b.w, b.h);
    });

    // Water
    ctx.fillStyle = 'rgba(0,100,255,0.5)';
    state.water.forEach(w => {
        ctx.fillRect(w.x - camX, w.y - camY, w.w, w.h);
    });

    // Players
    state.players.forEach(p => {
        ctx.fillStyle = p.id === myId? '#00ff00' : '#ff0000';
        ctx.fillRect(p.x - camX, p.y - camY, 30, 30);
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, p.x - camX + 15, p.y - camY - 5);
    });

    // Bullets
    ctx.fillStyle = '#ffff00';
    state.bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x - camX, b.y - camY, 4, 0, Math.PI*2);
        ctx.fill();
    });
}

function gameLoop() {
    update();
    if(gameState) renderGame(gameState);
    requestAnimationFrame(gameLoop);
}

// ============================================
// 8. EXPORT HO AN'NY HTML
// ============================================
window.loginWithGoogle = function() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithRedirect(provider);
};

window.findMatch = findMatch;
window.cancelMatchmaking = cancelMatchmaking;
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.leaveRoom = leaveRoom;
window.ready = ready;
window.sendLobbyChat = sendLobbyChat;
window.sendRoomChat = sendRoomChat;
window.addFriend = addFriend;
window.inviteFriend = inviteFriend;

console.log('✅ MG FIGHTER CLIENT loaded');
