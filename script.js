/*
 * MG FIGHTER CLIENT - FIX LOGIN 100%
 */

const socket = io('https://mg-fighter-1.onrender.com');
let myId = null;
let currentUser = null;

// ============================================
// 1. FIREBASE INIT + AUTH - IRAY IHANY
// ============================================
console.log('🔥 Starting Firebase auth...');

// Miandry kely vao mi-check auth satria redirect
setTimeout(() => {
    firebase.auth().onAuthStateChanged(async (user) => {
        console.log('🔥 Auth state changed:', user?.displayName || 'NULL');

        if (user) {
            currentUser = user.displayName || user.email.split('@')[0];
            console.log('✅ Tafiditra:', currentUser);

            // 1. Alefa any @ server
            socket.emit('joinGame', {
                name: currentUser,
                skin: 'boy'
            });

            // 2. Save @ Firestore - AWAIT mba ho azo antoka
            try {
                await firebase.firestore().collection('users').doc(user.uid).set({
                    uid: user.uid,
                    name: currentUser,
                    email: user.email,
                    photo: user.photoURL || "",
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log('✅ Voatahiry @ Firestore');
            } catch (err) {
                console.error('❌ Firestore error:', err);
            }

            // 3. Ovay UI
            document.getElementById('authScreen')?.classList.add('hidden');
            document.getElementById('lobbyScreen')?.classList.remove('hidden');
            const nameEl = document.getElementById('playerName');
            if(nameEl) nameEl.textContent = currentUser;

        } else {
            console.log('❌ Tsy misy user');
            document.getElementById('authScreen')?.classList.remove('hidden');
            document.getElementById('lobbyScreen')?.classList.add('hidden');
        }
    });

    // Check raha vao avy redirect avy @ Google
    firebase.auth().getRedirectResult().then((result) => {
        if (result.user) {
            console.log('✅ Redirect success:', result.user.displayName);
        }
    }).catch((error) => {
        console.error('❌ Redirect error:', error.code, error.message);
        if(error.code === 'auth/unauthorized-domain') {
            alert('ERROR: Tsy authorized ny domain. Mandehana @ Firebase Console → Authentication → Settings → Authorized domains → Add: mr-maharo.github.io');
        }
    });
}, 1000); // Miandry 1s mba ho ready ny Firebase

// ============================================
// 2. LOGIN FUNCTION
// ============================================
window.loginWithGoogle = function() {
    console.log('🔵 Login Google clicked');
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
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

window.createRoom = function() { socket.emit('createRoom', 'custom'); };
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

socket.on('lobbyChat', (data) => {
    const div = document.getElementById('lobbyChatMessages');
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

console.log('✅ MG FIGHTER CLIENT loaded');
