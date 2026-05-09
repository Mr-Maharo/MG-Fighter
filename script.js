/*
 * MG FIGHTER CLIENT - FIX LOGIN REDIRECT
 */

const socket = io('https://mg-fighter-1.onrender.com');
let myId = null;
let currentUser = null;

// ============================================
// 1. FIREBASE AUTH - IRAY IHANY, TSY MISY DUPLICATE
// ============================================
firebase.auth().onAuthStateChanged(user => {
    console.log('🔥 Auth state changed:', user?.displayName);

    if (user) {
        currentUser = user.displayName || user.email.split('@')[0];

        // 1. Alefa any @ server
        socket.emit('joinGame', {
            name: currentUser,
            skin: 'boy'
        });

        // 2. Ovay UI
        document.getElementById('authScreen')?.classList.add('hidden');
        document.getElementById('lobbyScreen')?.classList.remove('hidden');
        const nameEl = document.getElementById('playerName');
        if(nameEl) nameEl.textContent = currentUser;

        // 3. Save any @ Firestore
        firebase.firestore().collection('users').doc(user.uid).set({
            uid: user.uid,
            name: currentUser,
            email: user.email,
            photo: user.photoURL || "",
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

    } else {
        document.getElementById('authScreen')?.classList.remove('hidden');
        document.getElementById('lobbyScreen')?.classList.add('hidden');
    }
});

// ============================================
// 2. LOGIN FUNCTION - ATAO GLOBAL
// ============================================
window.loginWithGoogle = function() {
    console.log('🔵 Login Google clicked');
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithRedirect(provider);
};

// ============================================
// 3. SOCKET
// ============================================
socket.on('connect', () => {
    myId = socket.id;
    console.log('✅ Socket connected:', myId);
});

socket.on('gameState', (state) => {
    const onlineEl = document.getElementById('onlineCount');
    if(onlineEl) onlineEl.textContent = state.players.length;

    if(!document.getElementById('gameScreen')?.classList.contains('hidden')) {
        renderGame(state);
    }
});

// ============================================
// 4. LOBBY FUNCTIONS
// ============================================
window.findMatch = function(mode) {
    socket.emit('findMatch', mode);
    document.getElementById('matchmakingScreen')?.classList.remove('hidden');
    document.getElementById('lobbyScreen')?.classList.add('hidden');
    const modeEl = document.getElementById('matchmakingMode');
    if(modeEl) modeEl.textContent = mode.toUpperCase();
};

window.cancelMatchmaking = function() {
    socket.emit('cancelMatchmaking');
    document.getElementById('matchmakingScreen')?.classList.add('hidden');
    document.getElementById('lobbyScreen')?.classList.remove('hidden');
};

window.createRoom = function() {
    socket.emit('createRoom', 'custom');
};

window.joinRoom = function() {
    const code = document.getElementById('roomCode')?.value.toUpperCase().trim();
    if(code?.length === 6) socket.emit('joinRoom', code);
};

window.leaveRoom = function() {
    socket.emit('leaveRoom');
    document.getElementById('roomScreen')?.classList.add('hidden');
};

window.ready = function() {
    socket.emit('ready');
    const btn = document.getElementById('readyBtn');
    if(btn) { btn.disabled = true; btn.textContent = 'READY ✅'; }
};

// ============================================
// 5. CHAT
// ============================================
window.sendLobbyChat = function() {
    const input = document.getElementById('lobbyChatInput');
    const msg = input?.value.trim();
    if(msg && msg.length < 200) {
        socket.emit('lobbyChat', msg);
        if(input) input.value = '';
    }
};

window.sendRoomChat = function() {
    const input = document.getElementById('roomChatInput');
    const msg = input?.value.trim();
    if(msg && msg.length < 200) {
        socket.emit('roomChat', msg);
        if(input) input.value = '';
    }
};

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
let canvas, ctx, keys = {};

function initGame() {
    canvas = document.getElementById('game');
    if(!canvas) return;
    ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

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
    requestAnimationFrame(gameLoop);
}

console.log('✅ MG FIGHTER CLIENT loaded');
