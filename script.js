```javascript
/*
========================================
MG FIGHTER v4 - FULL CLIENT SCRIPT
Firebase + Socket.IO + Battle Royale
FIXED VERSION
========================================
*/

const socket = io("https://mg-fighter-1.onrender.com");

let myId = null;
let currentUser = null;
let gameState = null;

// =====================================
// FIREBASE INIT
// =====================================
const auth = firebase.auth();
const db = firebase.firestore();

// =====================================
// GOOGLE LOGIN (FIXED + FIRESTORE SAVE)
// =====================================
function loginWithGoogle() {

    const provider = new firebase.auth.GoogleAuthProvider();

    auth.signInWithRedirect(provider);
}

// after redirect
auth.getRedirectResult()
.then(async (result) => {

    const user = result.user;

    if (!user) return;

    currentUser = user.displayName || user.email.split("@")[0];

    console.log("✅ LOGIN:", currentUser);

    const ref = db.collection("players").doc(user.uid);

    const snap = await ref.get();

    if (!snap.exists) {

        await ref.set({
            username: currentUser,
            email: user.email,
            photo: user.photoURL || "",

            level: 1,
            coins: 100,
            wins: 0,
            kills: 0
        });

        console.log("🔥 Player CREATED");
    }

    // UI
    document.getElementById("authScreen")?.classList.add("hidden");
    document.getElementById("lobbyScreen")?.classList.remove("hidden");

    document.getElementById("playerName").textContent = currentUser;

    socket.emit("joinGame", {
        username: currentUser
    });

})
.catch(err => console.error("Auth error:", err));

// =====================================
// AUTH STATE LISTENER
// =====================================
auth.onAuthStateChanged(user => {

    if (!user) return;

    currentUser = user.displayName || "Player";

    document.getElementById("playerName").textContent = currentUser;

});

// =====================================
// SOCKET CONNECT
// =====================================
socket.on("connect", () => {
    myId = socket.id;
    console.log("Socket:", myId);
});

// =====================================
// GAME STATE (SERVER)
// =====================================
socket.on("playersUpdate", (players) => {

    gameState = {
        players: Object.values(players)
    };

    document.getElementById("onlineCount").textContent =
        gameState.players.length;

    if (!document.getElementById("gameScreen")?.classList.contains("hidden")) {
        renderGame(gameState);
    }
});

// =====================================
// MOVE + SHOOT
// =====================================
let keys = {};

window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// movement loop
setInterval(() => {

    if (!myId) return;

    socket.emit("move", {
        up: keys["w"] || keys["z"],
        down: keys["s"],
        left: keys["a"] || keys["q"],
        right: keys["d"]
    });

}, 50);

// shoot
window.addEventListener("click", () => {

    const angle = Math.random() * Math.PI * 2;

    socket.emit("shoot", {
        angle
    });

});

// =====================================
// RENDER GAME
// =====================================
let canvas, ctx;

function initGame() {

    canvas = document.getElementById("game");
    ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    loop();
}

function loop() {
    if (gameState) renderGame(gameState);
    requestAnimationFrame(loop);
}

function renderGame(state) {

    if (!ctx) return;

    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const me = state.players.find(p => p.id === myId);

    if (!me) return;

    const camX = me.x - canvas.width / 2;
    const camY = me.y - canvas.height / 2;

    state.players.forEach(p => {

        ctx.fillStyle = p.id === myId ? "#00ff00" : "#ff4444";

        ctx.fillRect(
            p.x - camX,
            p.y - camY,
            25,
            25
        );

        ctx.fillStyle = "#fff";
        ctx.fillText(
            p.username || "Player",
            p.x - camX,
            p.y - camY - 10
        );
    });
}

// =====================================
// MATCHMAKING
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
// ROOM SYSTEM
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
// CHAT
// =====================================
function sendLobbyChat() {

    const input = document.getElementById("lobbyChatInput");

    if (input?.value) {

        socket.emit("lobbyChat", {
            username: currentUser,
            msg: input.value
        });

        input.value = "";
    }
}

socket.on("lobbyChat", data => {

    const div = document.getElementById("lobbyChatMessages");

    if (!div) return;

    div.innerHTML += `
        <p><b>${data.username}:</b> ${data.msg}</p>
    `;
});

// =====================================
// START GAME
// =====================================
socket.on("gameStart", () => {

    document.getElementById("lobbyScreen")?.classList.add("hidden");
    document.getElementById("gameScreen")?.classList.remove("hidden");

    initGame();
});

// =====================================
// EXPORT TO HTML
// =====================================
window.loginWithGoogle = loginWithGoogle;
window.findMatch = findMatch;
window.cancelMatchmaking = cancelMatchmaking;
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.leaveRoom = leaveRoom;
window.sendLobbyChat = sendLobbyChat;

console.log("🔥 MG FIGHTER CLIENT LOADED");
```
