
/*
========================================
MG FIGHTER CLIENT vFULL FIXED
Socket.IO + Firebase Auth + BR sync
========================================
*/

const socket = io("https://mg-fighter-1.onrender.com");

let myId = null;
let currentUser = null;
let gameState = null;

// =====================================
// 1. FIREBASE AUTH (GOOGLE LOGIN)
// =====================================
firebase.auth().onAuthStateChanged(user => {
    if (user) {

        currentUser = user.displayName || user.email.split("@")[0];

        console.log("✅ Login:", currentUser);

        // IMPORTANT: match server.js => name
        socket.emit("joinGame", {
            username: currentUser
        });

        // UI switch
        document.getElementById("authScreen")?.classList.add("hidden");
        document.getElementById("lobbyScreen")?.classList.remove("hidden");

        const nameEl = document.getElementById("playerName");
        if (nameEl) nameEl.textContent = currentUser;
    }
});

// =====================================
// 2. SOCKET CONNECT
// =====================================
socket.on("connect", () => {
    myId = socket.id;
    console.log("✅ Connected:", myId);
});

// IMPORTANT: match server.js => playersUpdate (NOT gameState)
socket.on("playersUpdate", (players) => {

    gameState = {
        players: Object.values(players),
        bullets: [],
        buildings: [],
        water: []
    };

    const onlineEl = document.getElementById("onlineCount");
    if (onlineEl) onlineEl.textContent = gameState.players.length;

    if (!document.getElementById("gameScreen")?.classList.contains("hidden")) {
        renderGame(gameState);
    }
});

// =====================================
// 3. MOVE + SHOOT
// =====================================
let keys = {};

window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// MOVE LOOP
setInterval(() => {
    if (!myId) return;

    socket.emit("move", {
        up: keys["w"] || keys["z"],
        down: keys["s"],
        left: keys["a"] || keys["q"],
        right: keys["d"]
    });

}, 50);

// SHOOT
window.addEventListener("click", (e) => {
    if (!gameState) return;

    const angle = Math.random() * Math.PI * 2;

    socket.emit("shoot", {
        angle: angle
    });
});

// =====================================
// 4. GAME RENDER
// =====================================
let canvas, ctx;

function initGame() {
    canvas = document.getElementById("game");
    ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    requestAnimationFrame(loop);
}

function loop() {
    if (gameState) renderGame(gameState);
    requestAnimationFrame(loop);
}

function renderGame(state) {

    if (!ctx) return;

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const me = state.players.find(p => p.id === myId);
    if (!me) return;

    const camX = me.x - canvas.width / 2;
    const camY = me.y - canvas.height / 2;

    // PLAYERS
    state.players.forEach(p => {
        ctx.fillStyle = p.id === myId ? "#00ff00" : "#ff4444";

        ctx.fillRect(
            p.x - camX,
            p.y - camY,
            25,
            25
        );

        ctx.fillStyle = "#fff";
        ctx.font = "12px Arial";
        ctx.fillText(
            p.username || "P",
            p.x - camX,
            p.y - camY - 10
        );
    });
}

// =====================================
// 5. MATCH SYSTEM
// =====================================
function findMatch(mode) {
    socket.emit("findMatch", mode);

    document.getElementById("matchmakingScreen")?.classList.remove("hidden");
    document.getElementById("lobbyScreen")?.classList.add("hidden");
}

function cancelMatchmaking() {
    socket.emit("cancelMatchmaking");

    document.getElementById("matchmakingScreen")?.classList.add("hidden");
    document.getElementById("lobbyScreen")?.classList.remove("hidden");
}

// =====================================
// 6. ROOM SYSTEM
// =====================================
function createRoom() {
    socket.emit("createRoom");
}

function joinRoom() {
    const code = document.getElementById("roomCode")?.value;
    socket.emit("joinRoom", code);
}

function leaveRoom() {
    socket.emit("leaveRoom");
}

// =====================================
// 7. CHAT
// =====================================
function sendLobbyChat() {
    const input = document.getElementById("lobbyChatInput");

    if (input?.value) {
        socket.emit("lobbyChat", input.value);
        input.value = "";
    }
}

socket.on("lobbyChat", (data) => {
    const div = document.getElementById("lobbyChatMessages");
    if (!div) return;

    div.innerHTML += `
        <p><b>${data.username}:</b> ${data.msg}</p>
    `;
});

// =====================================
// 8. START GAME
// =====================================
socket.on("gameStart", () => {

    document.getElementById("lobbyScreen")?.classList.add("hidden");
    document.getElementById("gameScreen")?.classList.remove("hidden");

    initGame();
});

// =====================================
// EXPORT
// =====================================
window.findMatch = findMatch;
window.cancelMatchmaking = cancelMatchmaking;
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.leaveRoom = leaveRoom;
window.sendLobbyChat = sendLobbyChat;
window.loginWithGoogle = function () {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithRedirect(provider);
};

console.log("🔥 MG FIGHTER CLIENT READY");
