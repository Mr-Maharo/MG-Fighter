/*
 * ============================================================================
 * MG FIGHTER SIMPLE - MATCH HTML EXISTANT
 * Login + Lobby + Room + Chat + Matchmaking
 * Tsy ovaina ny HTML-nao
 * ============================================================================
 */

// ============================================
// 1. GLOBALS
// ============================================
const socket = io('https://mg-fighter-1.onrender.com', {
    reconnection: true,
    reconnectionDelay: 1000
});

let myId = null;
let currentUser = null;
let currentRoom = null;
let onlineCount = 0;

const MAP_SIZE = 3000;

// ============================================
// 2. FIREBASE AUTH - EFA AO @ HTML FA MIANO LISTENER ETO
// ============================================
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        currentUser = user.displayName || user.email.split('@')[0];
        console.log("✅ Tafiditra:", currentUser);

        socket.emit('playerLogin', {
            name: currentUser,
            uid: user.uid,
            skin: 'boy'
        });
    }
});

socket.on('loginSuccess', (data) => {
    myId = data.id;
    console.log('✅ Server nanaiky:', data);
});

// ============================================
// 3. LOBBY UPDATE
// ============================================
socket.on('lobbyUpdate', (count) => {
    onlineCount = count;
    const el = document.getElementById('onlineCount');
    if(el) el.textContent = count;
});

// ============================================
// 4. MATCHMAKING
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

socket.on('matchFound', (roomId) => {
    alert('Match hita! Room: ' + roomId);
    document.getElementById('matchmakingScreen')?.classList.add('hidden');
    // Eto ianao miantso game start
});

// ============================================
// 5. ROOM SYSTEM
// ============================================
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
    currentRoom = roomId;
}

socket.on('gameStart', (roomId) => {
    alert('Game manomboka! Room: ' + roomId);
    // Eto ianao miantso game init
});

// ============================================
// 6. CHAT
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
// 7. FRIENDS
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

socket.on('friendAdded', (name) => {
    loadFriends();
});

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
// 8. SKIN SYSTEM
// ============================================
function openSkinMenu() {
    document.getElementById('skinMenu')?.classList.remove('hidden');
}

function changeSkinColor(color) {
    socket.emit('setSkinColor', color);
}

function changeSkinHat(hat) {
    socket.emit('setSkinHat', hat);
}

// ============================================
// 9. BATTLE PASS
// ============================================
function openBattlePass() {
    document.getElementById('battlePassMenu')?.classList.remove('hidden');
    socket.emit('getBattlePass');
}

socket.on('battlePassData', (data) => {
    const container = document.getElementById('bpRewards');
    if(!container) return;
    container.innerHTML = '';
    for(let i=1; i<=100; i++) {
        const claimed = (data.claimed || []).includes(i);
        const unlocked = data.level >= i;
        const div = document.createElement('div');
        div.className = `bp-item ${claimed?'claimed':''} ${unlocked?'unlocked':''}`;
        div.innerHTML = `
            <div class="bp-level">LV ${i}</div>
            <div class="bp-reward">${getBPReward(i)}</div>
            ${unlocked &&!claimed?`<button onclick="claimBP(${i})">CLAIM</button>`:''}
        `;
        container.appendChild(div);
    }
    const bpLevel = document.getElementById('bpLevel');
    if(bpLevel) bpLevel.textContent = data.level;
    const bpXP = document.getElementById('bpXP');
    if(bpXP) bpXP.style.width = (data.xp % 100) + '%';
});

function getBPReward(level) {
    if(level % 10 === 0) return '🎩 Skin Special';
    if(level % 5 === 0) return '💰 50 Coins';
    return '💰 10 Coins';
}

function claimBP(level) {
    socket.emit('claimBP', level);
}

// ============================================
// 10. UTILS
// ============================================
window.loginWithGoogle = function() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithRedirect(provider);
};

// Export functions ho an'ny HTML onclick
window.findMatch = findMatch;
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.leaveRoom = leaveRoom;
window.ready = ready;
window.sendLobbyChat = sendLobbyChat;
window.sendRoomChat = sendRoomChat;
window.addFriend = addFriend;
window.inviteFriend = inviteFriend;
window.openSkinMenu = openSkinMenu;
window.changeSkinColor = changeSkinColor;
window.changeSkinHat = changeSkinHat;
window.openBattlePass = openBattlePass;
window.claimBP = claimBP;
window.cancelMatchmaking = cancelMatchmaking;

console.log('✅ MG FIGHTER SIMPLE loaded');
