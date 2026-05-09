/*

MG FIGHTER v4.0 - script.js COMPLET
Google Login Only + Multiplayer + Lobby + Room + Game
3000+ lignes no tanjona, eto ny version complet optimisé

*/

(() => {
    // =====================================
    // 1. CONFIG & GLOBAL STATE
    // =====================================
    const SERVER_URL = "https://mg-fighter-1.onrender.com";
    const socket = io(SERVER_URL, { autoConnect: false });

    const auth = firebase.auth();
    const db = firebase.firestore();
    
    // Game state
    let myId = null;
    let currentUser = null;
    let currentUserId = null;
    let playerData = {
        username: "Player",
        level: 1,
        coins: 100,
        wins: 0,
        kills: 0,
        xp: 0,
        bpLevel: 1,
        bpXP: 0,
        skin: { color: '#00ff00', hat: 'none' }
    };
    
    let gameState = {
        players: {},
        bullets: [],
        loot: [],
        vehicles: [],
        zone: { x: 2000, y: 2000, radius: 2000, targetRadius: 2000, timer: 0 },
        aliveCount: 0,
        matchMode: 'solo'
    };
    
    let roomState = {
        id: null,
        players: [],
        isReady: false,
        host: null
    };
    
    let keys = {};
    let mouseAngle = 0;
    let isGameRunning = false;
    let isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    let canvas, ctx, minimapCtx;
    let camera = { x: 0, y: 0 };
    let lastFrameTime = 0;
    
    // Mobile joystick
    let joystickActive = false;
    let joystickPos = { x: 0, y: 0 };
    
    // =====================================
    // 2. DOM ELEMENTS CACHE
    // =====================================
    const DOM = {
        // Screens
        authScreen: document.getElementById('authScreen'),
        lobbyScreen: document.getElementById('lobbyScreen'),
        matchmakingScreen: document.getElementById('matchmakingScreen'),
        gameScreen: document.getElementById('gameScreen'),
        roomScreen: document.getElementById('roomScreen'),
        
        // Auth
        authError: document.getElementById('authError'),
        
        // Lobby Profile
        playerName: document.getElementById('playerName'),
        playerLevel: document.getElementById('playerLevel'),
        playerCoins: document.getElementById('playerCoins'),
        playerWins: document.getElementById('playerWins'),
        playerKills: document.getElementById('playerKills'),
        onlineCount: document.getElementById('onlineCount'),
        playerAvatar: document.getElementById('playerAvatar'),
        
        // Battle Pass
        bpXP: document.getElementById('bpXP'),
        bpLevel: document.getElementById('bpLevel'),
        battlePassMenu: document.getElementById('battlePassMenu'),
        bpRewards: document.getElementById('bpRewards'),
        
        // Room
        roomIdDisplay: document.getElementById('roomIdDisplay'),
        roomCount: document.getElementById('roomCount'),
        roomPlayers: document.getElementById('roomPlayers'),
        readyBtn: document.getElementById('readyBtn'),
        roomCode: document.getElementById('roomCode'),
        roomChatMessages: document.getElementById('roomChatMessages'),
        roomChatInput: document.getElementById('roomChatInput'),
        
        // Friends & Chat
        friendsList: document.getElementById('friendsList'),
        addFriendInput: document.getElementById('addFriendInput'),
        lobbyChatMessages: document.getElementById('lobbyChatMessages'),
        lobbyChatInput: document.getElementById('lobbyChatInput'),
        
        // Matchmaking
        matchmakingMode: document.getElementById('matchmakingMode'),
        
        // Game UI
        game: document.getElementById('game'),
        minimap: document.getElementById('minimap'),
        hp: document.getElementById('hp'),
        hpBar: document.getElementById('hpBar'),
        armor: document.getElementById('armor'),
        armorBar: document.getElementById('armorBar'),
        weapon: document.getElementById('weapon'),
        ammo: document.getElementById('ammo'),
        grenades: document.getElementById('grenades'),
        kills: document.getElementById('kills'),
        level: document.getElementById('level'),
        xp: document.getElementById('xp'),
        zoneTimer: document.getElementById('zoneTimer'),
        killFeed: document.getElementById('killFeed'),
        damageNumbers: document.getElementById('damageNumbers'),
        zoneWarning: document.getElementById('zoneWarning'),
        scope: document.getElementById('scope'),
        hitmarker: document.getElementById('hitmarker'),
        lbList: document.getElementById('lbList'),
        aliveCount: document.getElementById('aliveCount'),
        scoreboard: document.getElementById('scoreboard'),
        scoreboardBody: document.getElementById('scoreboardBody'),
        
        // End Screens
        victoryScreen: document.getElementById('victoryScreen'),
        deathScreen: document.getElementById('deathScreen'),
        victoryKills: document.getElementById('victoryKills'),
        victoryReward: document.getElementById('victoryReward'),
        finalRank: document.getElementById('finalRank'),
        finalKills: document.getElementById('finalKills'),
        finalReward: document.getElementById('finalReward'),
        
        // Mobile
        mobileControls: document.getElementById('mobileControls'),
        joystick: document.getElementById('joystick'),
        joystickKnob: document.getElementById('joystickKnob'),
        shootBtn: document.getElementById('shootBtn'),
        scopeBtn: document.getElementById('scopeBtn'),
        lootBtn: document.getElementById('lootBtn'),
        sprintBtn: document.getElementById('sprintBtn'),
        grenadeBtn: document.getElementById('grenadeBtn'),
        vehicleBtn: document.getElementById('vehicleBtn'),
        
        // Skin
        skinMenu: document.getElementById('skinMenu')
    };

    // =====================================
    // 3. UTILITY FUNCTIONS
    // =====================================
    function showScreen(screenId) {
        ['authScreen', 'lobbyScreen', 'matchmakingScreen', 'gameScreen'].forEach(id => {
            document.getElementById(id).classList.add('hidden');
        });
        document.getElementById(screenId).classList.remove('hidden');
    }
    
    function showNotification(msg, isError = false) {
        const div = document.createElement('div');
        div.className = 'levelup';
        div.style.background = isError ? 'linear-gradient(135deg, #ff4444, #ff0000)' : 'linear-gradient(135deg, #00ff88, #00aaff)';
        div.innerHTML = `<p>${msg}</p>`;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }
    
    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
    
    function getPlayerById(id) {
        return gameState.players[id] || null;
    }
    
    function getMyPlayer() {
        return gameState.players[myId] || null;
    }

    // =====================================
    // 4. AUTHENTICATION - GOOGLE ONLY
    // =====================================
    window.loginWithGoogle = async function() {
        const provider = new firebase.auth.GoogleAuthProvider();
        DOM.authError.textContent = 'Connecting...';
        
        try {
            const result = await auth.signInWithPopup(provider);
            const user = result.user;
            if (!user) throw new Error('No user');
            
            currentUser = user.displayName || user.email.split("@")[0];
            currentUserId = user.uid;
            
            // Load or create player data
            const ref = db.collection("players").doc(user.uid);
            const snap = await ref.get();
            
            if (!snap.exists) {
                playerData = {
                    username: currentUser,
                    email: user.email,
                    photo: user.photoURL || "",
                    level: 1,
                    coins: 100,
                    wins: 0,
                    kills: 0,
                    xp: 0,
                    bpLevel: 1,
                    bpXP: 0,
                    skin: { color: '#00ff00', hat: 'none' },
                    friends: [],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await ref.set(playerData);
                showNotification('Welcome to MG FIGHTER!');
            } else {
                playerData = snap.data();
            }
            
            updateLobbyUI();
            showScreen('lobbyScreen');
            
            // Connect to game server
            socket.connect();
            socket.emit("joinGame", {
                username: currentUser,
                uid: currentUserId,
                skin: playerData.skin
            });
            
        } catch (err) {
            console.error("LOGIN ERROR:", err);
            DOM.authError.textContent = 'Login failed. Try again.';
        }
    };
    
    auth.onAuthStateChanged(async user => {
        if (user && !currentUser) {
            currentUserId = user.uid;
            currentUser = user.displayName || "Player";
            const ref = db.collection("players").doc(user.uid);
            const snap = await ref.get();
            if (snap.exists) {
                playerData = snap.data();
                updateLobbyUI();
                showScreen('lobbyScreen');
                socket.connect();
                socket.emit("joinGame", {
                    username: currentUser,
                    uid: currentUserId,
                    skin: playerData.skin
                });
            }
        } else if (!user) {
            showScreen('authScreen');
            if (socket.connected) socket.disconnect();
        }
    });
    
    function updateLobbyUI() {
        DOM.playerName.textContent = playerData.username;
        DOM.playerLevel.textContent = playerData.level;
        DOM.playerCoins.textContent = playerData.coins;
        DOM.playerWins.textContent = playerData.wins;
        DOM.playerKills.textContent = playerData.kills;
        DOM.bpLevel.textContent = playerData.bpLevel;
        DOM.bpXP.style.width = `${(playerData.bpXP % 100)}%`;
        if (playerData.photo) {
            DOM.playerAvatar.style.backgroundImage = `url(${playerData.photo})`;
            DOM.playerAvatar.style.backgroundSize = 'cover';
        }
        loadFriendsList();
    }
    
    async function savePlayerData() {
        if (!currentUserId) return;
        await db.collection("players").doc(currentUserId).update(playerData);
    }

    // =====================================
    // 5. SOCKET.IO EVENTS
    // =====================================
    socket.on("connect", () => {
        myId = socket.id;
        console.log("Connected to server:", myId);
    });
    
    socket.on("onlineCount", (count) => {
        DOM.onlineCount.textContent = count;
    });
    
    socket.on("playersUpdate", (players) => {
        gameState.players = players;
        gameState.aliveCount = Object.values(players).filter(p => p.hp > 0).length;
        DOM.aliveCount.textContent = gameState.aliveCount;
        updateLeaderboard();
        if (isGameRunning) updateScoreboard();
    });
    
    socket.on("gameStart", (data) => {
        gameState = { ...gameState, ...data };
        showScreen('gameScreen');
        initGame();
        isGameRunning = true;
        if (isMobile) DOM.mobileControls.classList.remove('hidden');
    });
    
    socket.on("gameUpdate", (data) => {
        Object.assign(gameState, data);
    });
    
    socket.on("killFeed", (data) => {
        addKillFeed(data.killer, data.victim, data.weapon);
    });
    
    socket.on("damageNumber", (data) => {
        showDamageNumber(data.x, data.y, data.damage, data.isHeadshot);
    });
    
    socket.on("hitmarker", () => {
        DOM.hitmarker.classList.remove('hidden');
        setTimeout(() => DOM.hitmarker.classList.add('hidden'), 100);
    });
    
    socket.on("zoneUpdate", (zone) => {
        gameState.zone = zone;
        DOM.zoneTimer.textContent = `ZONE: ${formatTime(zone.timer)}`;
        const me = getMyPlayer();
        if (me) {
            const dist = Math.hypot(me.x - zone.x, me.y - zone.y);
            if (dist > zone.radius) {
                DOM.zoneWarning.classList.remove('hidden');
            } else {
                DOM.zoneWarning.classList.add('hidden');
            }
        }
    });
    
    socket.on("playerDied", (data) => {
        if (data.id === myId) {
            isGameRunning = false;
            DOM.finalRank.textContent = data.rank;
            DOM.finalKills.textContent = data.kills;
            DOM.finalReward.textContent = `+${data.coins} Coins +${data.xp} XP`;
            DOM.deathScreen.classList.remove('hidden');
            
            playerData.coins += data.coins;
            playerData.xp += data.xp;
            playerData.kills += data.kills;
            levelUpCheck();
            savePlayerData();
        }
    });
    
    socket.on("victory", (data) => {
        isGameRunning = false;
        DOM.victoryKills.textContent = data.kills;
        DOM.victoryReward.textContent = `+${data.coins} Coins +${data.xp} XP`;
        DOM.victoryScreen.classList.remove('hidden');
        
        playerData.coins += data.coins;
        playerData.xp += data.xp;
        playerData.wins++;
        playerData.kills += data.kills;
        levelUpCheck();
        savePlayerData();
    });
    
    socket.on("roomUpdate", (room) => {
        roomState = room;
        updateRoomUI();
    });
    
    socket.on("chatMessage", (data) => {
        if (data.type === 'lobby') addLobbyChat(data);
        else if (data.type === 'room') addRoomChat(data);
    });
    
    socket.on("friendUpdate", () => {
        loadFriendsList();
    });

    // =====================================
    // 6. LOBBY FUNCTIONS
    // =====================================
    window.findMatch = function(mode) {
        gameState.matchMode = mode;
        DOM.matchmakingMode.textContent = mode.toUpperCase();
        showScreen('matchmakingScreen');
        socket.emit("findMatch", mode);
    };
    
    window.cancelMatchmaking = function() {
        socket.emit("cancelMatchmaking");
        showScreen('lobbyScreen');
    };
    
    window.createRoom = function() {
        socket.emit("createRoom");
        DOM.roomScreen.classList.remove('hidden');
    };
    
    window.joinRoom = function() {
        const code = DOM.roomCode.value.trim().toUpperCase();
        if (code.length !== 6) return showNotification('Invalid room code', true);
        socket.emit("joinRoom", code);
        DOM.roomScreen.classList.remove('hidden');
    };
    
    window.leaveRoom = function() {
        socket.emit("leaveRoom");
        DOM.roomScreen.classList.add('hidden');
        roomState = { id: null, players: [], isReady: false };
    };
    
    window.ready = function() {
        roomState.isReady = !roomState.isReady;
        socket.emit("playerReady", roomState.isReady);
        DOM.readyBtn.textContent = roomState.isReady ? 'UNREADY' : 'READY';
        DOM.readyBtn.style.background = roomState.isReady ? '#ff4444' : 'linear-gradient(135deg, #00ff88, #00ff00)';
    };
    
    function updateRoomUI() {
        if (!roomState.id) return;
        DOM.roomIdDisplay.textContent = roomState.id;
        DOM.roomCount.textContent = `${roomState.players.length}/4`;
        DOM.roomPlayers.innerHTML = '';
        
        roomState.players.forEach(p => {
            const div = document.createElement('div');
            div.className = 'room-player' + (p.ready ? ' ready' : '');
            div.innerHTML = `
                <div class="room-player-name">${p.username} ${p.id === roomState.host ? '👑' : ''}</div>
                <div class="room-player-status">${p.ready ? '✅' : '⏳'}</div>
            `;
            DOM.roomPlayers.appendChild(div);
        });
        
        const allReady = roomState.players.length >= 2 && roomState.players.every(p => p.ready);
        DOM.readyBtn.disabled = !allReady && !roomState.isReady;
    }

    // =====================================
    // 7. CHAT FUNCTIONS
    // =====================================
    window.sendLobbyChat = function() {
        const msg = DOM.lobbyChatInput.value.trim();
        if (!msg) return;
        socket.emit("chatMessage", { type: 'lobby', message: msg });
        DOM.lobbyChatInput.value = '';
    };
    
    window.sendRoomChat = function() {
        const msg = DOM.roomChatInput.value.trim();
        if (!msg) return;
        socket.emit("chatMessage", { type: 'room', message: msg });
        DOM.roomChatInput.value = '';
    };
    
    function addLobbyChat(data) {
        const p = document.createElement('p');
        p.innerHTML = `<span class="chat-time">${new Date().toLocaleTimeString()}</span><span class="chat-user">${data.username}:</span> ${data.message}`;
        DOM.lobbyChatMessages.appendChild(p);
        DOM.lobbyChatMessages.scrollTop = DOM.lobbyChatMessages.scrollHeight;
    }
    
    function addRoomChat(data) {
        const p = document.createElement('p');
        p.innerHTML = `<span class="chat-time">${new Date().toLocaleTimeString()}</span><span class="chat-user">${data.username}:</span> ${data.message}`;
        DOM.roomChatMessages.appendChild(p);
        DOM.roomChatMessages.scrollTop = DOM.roomChatMessages.scrollHeight;
    }

    // =====================================
    // 8. FRIENDS SYSTEM
    // =====================================
    window.addFriend = async function() {
        const username = DOM.addFriendInput.value.trim();
        if (!username) return;
        socket.emit("addFriend", username);
        DOM.addFriendInput.value = '';
        showNotification('Friend request sent!');
    };
    
    async function loadFriendsList() {
        if (!playerData.friends) playerData.friends = [];
        DOM.friendsList.innerHTML = '<h4>Online</h4>';
        const online = playerData.friends.filter(f => f.online);
        const offline = playerData.friends.filter(f => !f.online);
        
        online.forEach(f => {
            const div = document.createElement('div');
            div.className = 'friend online';
            div.innerHTML = `${f.username} <button onclick="inviteFriend('${f.id}')">Invite</button>`;
            DOM.friendsList.appendChild(div);
        });
        
        DOM.friendsList.innerHTML += '<h4>Offline</h4>';
        offline.forEach(f => {
            const div = document.createElement('div');
            div.className = 'friend';
            div.innerHTML = `${f.username}`;
            DOM.friendsList.appendChild(div);
        });
    }
    
    window.inviteFriend = function(friendId) {
        socket.emit("inviteFriend", friendId);
        showNotification('Invite sent!');
    };

    // =====================================
    // 9. BATTLE PASS & SKINS
    // =====================================
    window.openBattlePass = function() {
        DOM.battlePassMenu.classList.remove('hidden');
        renderBattlePass();
    };
    
    function renderBattlePass() {
        DOM.bpRewards.innerHTML = '';
        for (let i = 1; i <= 100; i++) {
            const div = document.createElement('div');
            div.className = 'bp-item';
            if (i <= playerData.bpLevel) div.classList.add('unlocked');
            const rewards = ['💰50', '🎨Skin', '👑Hat', '💎100', '🔫Weapon'];
            div.innerHTML = `
                <div class="bp-level">LV ${i}</div>
                <div class="bp-reward">${rewards[i % rewards.length]}</div>
            `;
            DOM.bpRewards.appendChild(div);
        }
    }
    
    window.changeSkinColor = function(color) {
        playerData.skin.color = color;
        socket.emit("changeSkin", playerData.skin);
        savePlayerData();
        showNotification('Skin color changed!');
    };
    
    window.changeSkinHat = function(hat) {
        playerData.skin.hat = hat;
        socket.emit("changeSkin", playerData.skin);
        savePlayerData();
        showNotification('Hat changed!');
    };
    
    function levelUpCheck() {
        const xpNeeded = playerData.level * 100;
        while (playerData.xp >= xpNeeded) {
            playerData.xp -= xpNeeded;
            playerData.level++;
            showNotification(`LEVEL UP! You are now level ${playerData.level}`);
        }
        playerData.bpXP += 10;
        if (playerData.bpXP >= 100) {
            playerData.bpXP = 0;
            playerData.bpLevel++;
            showNotification(`Battle Pass Level ${playerData.bpLevel} unlocked!`);
        }
        updateLobbyUI();
    }

    // =====================================
    // 10. GAME FUNCTIONS
    // =====================================
    function initGame() {
        canvas = DOM.game;
        ctx = canvas.getContext('2d');
        minimapCtx = DOM.minimap.getContext('2d');
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        if (isMobile) {
            setupMobileControls();
        } else {
            setupDesktopControls();
        }
        
        lastFrameTime = performance.now();
        requestAnimationFrame(gameLoop);
    }
    
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    function gameLoop(currentTime) {
        if (!isGameRunning) return;
        
        const deltaTime = (currentTime - lastFrameTime) / 1000;
        lastFrameTime = currentTime;
        
        updateGame(deltaTime);
        renderGame();
        
        requestAnimationFrame(gameLoop);
    }
    
    function updateGame(dt) {
        const me = getMyPlayer();
        if (!me) return;
        
        // Camera follow
        camera.x = me.x - canvas.width / 2;
        camera.y = me.y - canvas.height / 2;
        
        // Update UI
        DOM.hp.textContent = Math.max(0, Math.floor(me.hp));
        DOM.hpBar.style.width = `${me.hp}%`;
        DOM.armor.textContent = Math.floor(me.armor || 0);
        DOM.armorBar.style.width = `${me.armor || 0}%`;
        DOM.weapon.textContent = me.weapon || 'Fist';
        DOM.ammo.textContent = me.ammo === Infinity ? '∞' : me.ammo || 0;
        DOM.grenades.textContent = me.grenades || 0;
        DOM.kills.textContent = me.kills || 0;
        DOM.level.textContent = me.level || 1;
        DOM.xp.textContent = `${me.xp || 0}/${(me.level || 1) * 100}`;
        
        // Send input
        handleInput();
    }
    
    function renderGame() {
        if (!ctx) return;
        
        // Clear
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = 'rgba(0,255,136,0.1)';
        ctx.lineWidth = 1;
        const gridSize = 100;
        for (let x = -camera.x % gridSize; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = -camera.y % gridSize; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // Draw zone
        if (gameState.zone) {
            ctx.strokeStyle = '#0088ff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(gameState.zone.x - camera.x, gameState.zone.y - camera.y, gameState.zone.radius, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.fillStyle = 'rgba(255,0,0,0.1)';
            ctx.beginPath();
            ctx.arc(gameState.zone.x - camera.x, gameState.zone.y - camera.y, gameState.zone.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw loot
        gameState.loot.forEach(l => {
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(l.x - camera.x - 10, l.y - camera.y - 10, 20, 20);
        });
        
        // Draw vehicles
        gameState.vehicles.forEach(v => {
            ctx.fillStyle = '#888888';
            ctx.fillRect(v.x - camera.x - 30, v.y - camera.y - 20, 60, 40);
        });
        
        // Draw bullets
        gameState.bullets.forEach(b => {
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(b.x - camera.x, b.y - camera.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Draw players
        Object.values(gameState.players).forEach(p => {
            if (p.hp <= 0) return;
            
            const x = p.x - camera.x;
            const y = p.y - camera.y;
            const isMe = p.id === myId;
            
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(x, y + 15, 15, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Body
            ctx.fillStyle = isMe ? playerData.skin.color : '#ff4444';
            ctx.fillRect(x - 12, y - 12, 24, 24);
            
            // Hat
            if (p.skin?.hat && p.skin.hat !== 'none') {
                ctx.font = '20px Arial';
                const hatEmoji = { crown: '👑', helmet: '🪖', cap: '🧢' }[p.skin.hat];
                ctx.fillText(hatEmoji, x - 10, y - 15);
            }
            
            // Name & HP
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(p.username, x, y - 25);
            
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(x - 20, y - 20, 40, 4);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(x - 20, y - 20, 40 * (p.hp / 100), 4);
            
            // Weapon direction
            if (p.angle !== undefined) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(p.angle) * 20, y + Math.sin(p.angle) * 20);
                ctx.stroke();
            }
        });
        
        renderMinimap();
    }
    
    function renderMinimap() {
        if (!minimapCtx) return;
        
        minimapCtx.fillStyle = '#000';
        minimapCtx.fillRect(0, 0, 180, 180);
        
        const scale = 180 / 4000;
        
        // Zone
        if (gameState.zone) {
            minimapCtx.strokeStyle = '#0088ff';
            minimapCtx.lineWidth = 2;
            minimapCtx.beginPath();
            minimapCtx.arc(gameState.zone.x * scale, gameState.zone.y * scale, gameState.zone.radius * scale, 0, Math.PI * 2);
            minimapCtx.stroke();
        }
        
        // Players
        Object.values(gameState.players).forEach(p => {
            if (p.hp <= 0) return;
            minimapCtx.fillStyle = p.id === myId ? '#00ff00' : '#ff0000';
            minimapCtx.beginPath();
            minimapCtx.arc(p.x * scale, p.y * scale, 3, 0, Math.PI * 2);
            minimapCtx.fill();
        });
    }
    
    // =====================================
    // 11. INPUT HANDLING
    // =====================================
    function setupDesktopControls() {
        window.addEventListener('keydown', (e) => {
            keys[e.key.toLowerCase()] = true;
            
            if (e.key === 'Tab') {
                e.preventDefault();
                DOM.scoreboard.classList.toggle('hidden');
            }
            if (e.key === 'm') {
                DOM.skinMenu.classList.toggle('hidden');
            }
            if (e.key === 'b') {
                openBattlePass();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            keys[e.key.toLowerCase()] = false;
        });
        
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const me = getMyPlayer();
            if (!me) return;
            const dx = e.clientX - rect.left - canvas.width / 2;
            const dy = e.clientY - rect.top - canvas.height / 2;
            mouseAngle = Math.atan2(dy, dx);
        });
        
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) socket.emit('shoot', { angle: mouseAngle });
            if (e.button === 2) socket.emit('scope', true);
        });
        
        canvas.addEventListener('mouseup', (e) => {
            if (e.button === 2) socket.emit('scope', false);
        });
        
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    function setupMobileControls() {
        // Joystick
        DOM.joystick.addEventListener('touchstart', (e) => {
            joystickActive = true;
        });
        
        DOM.joystick.addEventListener('touchmove', (e) => {
            if (!joystickActive) return;
            const touch = e.touches[0];
            const rect = DOM.joystick.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            let dx = touch.clientX - cx;
            let dy = touch.clientY - cy;
            const dist = Math.min(Math.hypot(dx, dy), 40);
            const angle = Math.atan2(dy, dx);
            dx = Math.cos(angle) * dist;
            dy = Math.sin(angle) * dist;
            joystickPos = { x: dx / 40, y: dy / 40 };
            DOM.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        });
        
        DOM.joystick.addEventListener('touchend', () => {
            joystickActive = false;
            joystickPos = { x: 0, y: 0 };
            DOM.joystickKnob.style.transform = 'translate(-50%, -50%)';
        });
        
        // Buttons
        DOM.shootBtn.addEventListener('touchstart', () => socket.emit('shoot', { angle: mouseAngle }));
        DOM.scopeBtn.addEventListener('touchstart', () => socket.emit('scope', true));
        DOM.scopeBtn.addEventListener('touchend', () => socket.emit('scope', false));
        DOM.lootBtn.addEventListener('touchstart', () => socket.emit('interact'));
        DOM.sprintBtn.addEventListener('touchstart', () => keys['shift'] = true);
        DOM.sprintBtn.addEventListener('touchend', () => keys['shift'] = false);
        DOM.grenadeBtn.addEventListener('touchstart', () => socket.emit('grenade', { angle: mouseAngle }));
        DOM.vehicleBtn.addEventListener('touchstart', () => socket.emit('enterVehicle'));
    }
    
    function handleInput() {
        if (!isGameRunning) return;
        
        let moveX = 0, moveY = 0;
        
        if (isMobile && joystickActive) {
            moveX = joystickPos.x;
            moveY = joystickPos.y;
        } else {
            if (keys['w'] || keys['z'] || keys['arrowup']) moveY = -1;
            if (keys['s'] || keys['arrowdown']) moveY = 1;
            if (keys['a'] || keys['q'] || keys['arrowleft']) moveX = -1;
            if (keys['d'] || keys['arrowright']) moveX = 1;
        }
        
        socket.emit('move', {
            x: moveX,
            y: moveY,
            angle: mouseAngle,
            sprint: keys['shift'] || false
        });
    }

    // =====================================
    // 12. UI UPDATES
    // =====================================
    function addKillFeed(killer, victim, weapon) {
        const div = document.createElement('div');
        div.className = 'kill';
        div.innerHTML = `${killer} <span class="weapon">[${weapon}]</span> ${victim}`;
        DOM.killFeed.appendChild(div);
        setTimeout(() => div.remove(), 5000);
    }
    
    function showDamageNumber(x, y, damage, isHeadshot) {
        const div = document.createElement('div');
        div.className = 'damage';
        div.style.left = `${x - camera.x}px`;
        div.style.top = `${y - camera.y}px`;
        div.style.color = isHeadshot ? '#ff0000' : '#ffff00';
        div.textContent = damage;
        DOM.damageNumbers.appendChild(div);
        setTimeout(() => div.remove(), 1000);
    }
    
    function updateLeaderboard() {
        const sorted = Object.values(gameState.players)
            .filter(p => p.hp > 0)
            .sort((a, b) => (b.kills || 0) - (a.kills || 0))
            .slice(0, 10);
        
        DOM.lbList.innerHTML = '';
        sorted.forEach((p, i) => {
            const li = document.createElement('li');
            if (p.id === myId) li.classList.add('me');
            li.innerHTML = `
                <span><span class="rank">#${i + 1}</span> ${p.username}</span>
                <span>${p.kills || 0} 💀</span>
            `;
            DOM.lbList.appendChild(li);
        });
    }
    
    function updateScoreboard() {
        const sorted = Object.values(gameState.players).sort((a, b) => (b.kills || 0) - (a.kills || 0));
        DOM.scoreboardBody.innerHTML = '';
        sorted.forEach(p => {
            const tr = document.createElement('tr');
            if (p.id === myId) tr.classList.add('me');
            tr.innerHTML = `
                <td>${p.username}</td>
                <td>${p.kills || 0}</td>
                <td>${p.level || 1}</td>
                <td>${p.hp > 0 ? '✅ Alive' : '💀 Dead'}</td>
            `;
            DOM.scoreboardBody.appendChild(tr);
        });
    }

        // =====================================
    // 13. WEAPON SYSTEM & COMBAT
    // =====================================
    const WEAPONS = {
        fist: { damage: 15, range: 50, fireRate: 500, ammo: Infinity, name: 'Fist' },
        pistol: { damage: 25, range: 400, fireRate: 300, ammo: 12, name: 'Pistol' },
        shotgun: { damage: 80, range: 150, fireRate: 800, ammo: 8, pellets: 5, name: 'Shotgun' },
        smg: { damage: 18, range: 300, fireRate: 100, ammo: 30, name: 'SMG' },
        rifle: { damage: 35, range: 600, fireRate: 150, ammo: 30, name: 'Rifle' },
        sniper: { damage: 90, range: 1000, fireRate: 1200, ammo: 5, name: 'Sniper' }
    };

    let currentWeapon = 'fist';
    let lastShotTime = 0;
    let isReloading = false;
    let isScoping = false;

    window.addEventListener('keydown', (e) => {
        if (!isGameRunning) return;
        const key = e.key;
        if (key >= '1' && key <= '6') {
            const weapons = ['fist', 'pistol', 'shotgun', 'smg', 'rifle', 'sniper'];
            switchWeapon(weapons[parseInt(key) - 1]);
        }
        if (key === 'r') reloadWeapon();
        if (key === 'g') throwGrenade();
        if (key === 'f') interactWithLoot();
        if (key === 'e') enterVehicle();
    });

    function switchWeapon(weaponName) {
        if (!WEAPONS[weaponName]) return;
        currentWeapon = weaponName;
        socket.emit('switchWeapon', weaponName);
        DOM.weapon.textContent = WEAPONS[weaponName].name;
        updateAmmoUI();
    }

    function reloadWeapon() {
        if (isReloading || currentWeapon === 'fist') return;
        isReloading = true;
        DOM.ammo.textContent = 'Reloading...';
        setTimeout(() => {
            socket.emit('reload');
            isReloading = false;
        }, 2000);
    }

    function updateAmmoUI() {
        const me = getMyPlayer();
        if (!me) return;
        const weapon = WEAPONS[currentWeapon];
        DOM.ammo.textContent = weapon.ammo === Infinity? '∞' : (me.ammo || weapon.ammo);
    }

    function throwGrenade() {
        const me = getMyPlayer();
        if (!me || (me.grenades || 0) <= 0) return;
        socket.emit('grenade', { angle: mouseAngle });
    }

    function interactWithLoot() {
        socket.emit('interact');
    }

    function enterVehicle() {
        socket.emit('enterVehicle');
    }

    // =====================================
    // 14. LOOT & VEHICLE SYSTEM
    // =====================================
    const LOOT_TYPES = {
        weapon_pistol: { type: 'weapon', item: 'pistol', icon: '🔫' },
        weapon_shotgun: { type: 'weapon', item: 'shotgun', icon: '🔫' },
        weapon_smg: { type: 'weapon', item: 'smg', icon: '🔫' },
        weapon_rifle: { type: 'weapon', item: 'rifle', icon: '🔫' },
        weapon_sniper: { type: 'weapon', item: 'sniper', icon: '🔫' },
        ammo_light: { type: 'ammo', amount: 30, icon: '📦' },
        ammo_heavy: { type: 'ammo', amount: 20, icon: '📦' },
        armor: { type: 'armor', amount: 50, icon: '🛡️' },
        medkit: { type: 'heal', amount: 75, icon: '💊' },
        grenade: { type: 'grenade', amount: 1, icon: '💣' }
    };

    socket.on('lootPickup', (data) => {
        const me = getMyPlayer();
        if (!me || data.playerId!== myId) return;

        if (data.type === 'weapon') {
            currentWeapon = data.item;
            DOM.weapon.textContent = WEAPONS[data.item].name;
            showNotification(`Picked up ${WEAPONS[data.item].name}!`);
        } else if (data.type === 'ammo') {
            showNotification(`+${data.amount} Ammo`);
        } else if (data.type === 'armor') {
            showNotification(`+${data.amount} Armor`);
        } else if (data.type === 'heal') {
            showNotification(`+${data.amount} HP`);
        } else if (data.type === 'grenade') {
            showNotification(`+${data.amount} Grenade`);
        }
        updateAmmoUI();
    });

    socket.on('vehicleUpdate', (vehicles) => {
        gameState.vehicles = vehicles;
    });

    // =====================================
    // 15. ADVANCED ROOM SYSTEM
    // =====================================
    socket.on('roomCreated', (data) => {
        roomState.id = data.roomId;
        roomState.host = myId;
        roomState.players = [{ id: myId, username: currentUser, ready: false }];
        updateRoomUI();
        showNotification(`Room created: ${data.roomId}`);
    });

    socket.on('roomJoined', (data) => {
        roomState = data;
        DOM.roomScreen.classList.remove('hidden');
        updateRoomUI();
        showNotification(`Joined room: ${data.id}`);
    });

    socket.on('roomError', (error) => {
        showNotification(error, true);
        DOM.roomScreen.classList.add('hidden');
    });

    socket.on('gameStarting', (countdown) => {
        showNotification(`Game starting in ${countdown}...`);
    });

    // =====================================
    // 16. FRIEND SYSTEM COMPLET
    // =====================================
    socket.on('friendRequest', (data) => {
        const accept = confirm(`${data.username} wants to be your friend. Accept?`);
        socket.emit('friendRequestResponse', { fromId: data.fromId, accept });
    });

    socket.on('friendAdded', (friend) => {
        if (!playerData.friends) playerData.friends = [];
        playerData.friends.push(friend);
        savePlayerData();
        loadFriendsList();
        showNotification(`${friend.username} is now your friend!`);
    });

    socket.on('friendInvite', (data) => {
        const accept = confirm(`${data.username} invited you to join their room. Join?`);
        if (accept) {
            socket.emit('joinRoom', data.roomId);
            DOM.roomScreen.classList.remove('hidden');
        }
    });

    window.inviteFriend = function(friendId) {
        if (!roomState.id) return showNotification('Create a room first!', true);
        socket.emit('inviteFriend', { friendId, roomId: roomState.id });
        showNotification('Invite sent!');
    };

    // =====================================
    // 17. BATTLE PASS SYSTEM COMPLET
    // =====================================
    const BP_REWARDS = [
        { level: 1, type: 'coins', amount: 50 },
        { level: 2, type: 'skin', item: '#ff0000' },
        { level: 3, type: 'coins', amount: 100 },
        { level: 4, type: 'hat', item: 'cap' },
        { level: 5, type: 'coins', amount: 150 },
        { level: 10, type: 'skin', item: '#0088ff' },
        { level: 15, type: 'hat', item: 'helmet' },
        { level: 20, type: 'coins', amount: 500 },
        { level: 25, type: 'skin', item: '#ff00ff' },
        { level: 30, type: 'hat', item: 'crown' },
        { level: 50, type: 'coins', amount: 1000 },
        { level: 75, type: 'skin', item: '#ffff00' },
        { level: 100, type: 'title', item: 'LEGEND' }
    ];

    function renderBattlePass() {
        DOM.bpRewards.innerHTML = '';
        BP_REWARDS.forEach(reward => {
            const div = document.createElement('div');
            div.className = 'bp-item';
            if (reward.level <= playerData.bpLevel) div.classList.add('unlocked');

            let icon = '💰';
            if (reward.type === 'skin') icon = '🎨';
            else if (reward.type === 'hat') icon = '👑';
            else if (reward.type === 'title') icon = '🏆';

            div.innerHTML = `
                <div class="bp-level">LV ${reward.level}</div>
                <div class="bp-reward">${icon}</div>
                <div style="font-size:11px">${reward.type === 'coins'? reward.amount : reward.item}</div>
            `;

            if (reward.level <= playerData.bpLevel) {
                div.onclick = () => claimBPReward(reward);
            }
            DOM.bpRewards.appendChild(div);
        });
    }

    function claimBPReward(reward) {
        if (reward.type === 'coins') {
            playerData.coins += reward.amount;
            showNotification(`Claimed ${reward.amount} coins!`);
        } else if (reward.type === 'skin') {
            playerData.skin.color = reward.item;
            showNotification(`Unlocked skin color!`);
        } else if (reward.type === 'hat') {
            playerData.skin.hat = reward.item;
            showNotification(`Unlocked hat: ${reward.item}!`);
        }
        savePlayerData();
        updateLobbyUI();
        socket.emit('changeSkin', playerData.skin);
    }

    // =====================================
    // 18. STATISTICS & ACHIEVEMENTS
    // =====================================
    function updateStats(kills, damage, survived) {
        playerData.kills += kills;
        playerData.xp += kills * 50 + damage + survived * 10;
        levelUpCheck();
        savePlayerData();
        updateLobbyUI();
    }

    socket.on('matchEnd', (data) => {
        updateStats(data.kills, data.damage, data.survived);
    });

    // =====================================
    // 19. SOUND SYSTEM
    // =====================================
    const sounds = {
        shoot: new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='),
        hit: new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='),
        pickup: new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='),
        victory: new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=')
    };

    function playSound(soundName) {
        if (sounds[soundName]) {
            sounds[soundName].currentTime = 0;
            sounds[soundName].play().catch(() => {});
        }
    }

    socket.on('soundEvent', (event) => {
        playSound(event);
    });

    // =====================================
    // 20. PARTICLE SYSTEM
    // =====================================
    let particles = [];

    function createParticle(x, y, color, velocity) {
        particles.push({
            x, y, color,
            vx: velocity.x,
            vy: velocity.y,
            life: 1.0,
            size: Math.random() * 4 + 2
        });
    }

    function updateParticles(dt) {
        particles = particles.filter(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 200 * dt;
            p.life -= dt * 2;
            return p.life > 0;
        });
    }

    function renderParticles() {
        particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x - camera.x, p.y - camera.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    socket.on('explosion', (data) => {
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 * i) / 30;
            const speed = Math.random() * 200 + 100;
            createParticle(data.x, data.y, '#ff6600', {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed
            });
        }
    });

    // =====================================
    // 21. MOBILE CONTROLS ADVANCED
    // =====================================
    function setupMobileControls() {
        DOM.mobileControls.classList.remove('hidden');

        let touchShootInterval = null;
        DOM.shootBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            socket.emit('shoot', { angle: mouseAngle });
            touchShootInterval = setInterval(() => {
                socket.emit('shoot', { angle: mouseAngle });
            }, 100);
        });

        DOM.shootBtn.addEventListener('touchend', () => {
            if (touchShootInterval) clearInterval(touchShootInterval);
        });

        // Auto aim for mobile
        setInterval(() => {
            if (!isMobile ||!isGameRunning) return;
            const me = getMyPlayer();
            if (!me) return;

            let closestEnemy = null;
            let closestDist = Infinity;

            Object.values(gameState.players).forEach(p => {
                if (p.id === myId || p.hp <= 0) return;
                const dist = Math.hypot(p.x - me.x, p.y - me.y);
                if (dist < closestDist && dist < 300) {
                    closestDist = dist;
                    closestEnemy = p;
                }
            });

            if (closestEnemy) {
                mouseAngle = Math.atan2(closestEnemy.y - me.y, closestEnemy.x - me.x);
            }
        }, 100);
    }

    // =====================================
    // 22. GAME END & RETURN
    // =====================================
    window.returnToLobby = function() {
        DOM.victoryScreen.classList.add('hidden');
        DOM.deathScreen.classList.add('hidden');
        DOM.scoreboard.classList.add('hidden');
        showScreen('lobbyScreen');
        isGameRunning = false;
        if (socket.connected) socket.disconnect();
        setTimeout(() => socket.connect(), 500);
    };

    // =====================================
    // 23. ERROR HANDLING & RECONNECT
    // =====================================
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        if (isGameRunning) {
            showNotification('Connection lost! Reconnecting...', true);
        }
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        showNotification('Server connection failed!', true);
    });

    socket.on('reconnect', () => {
        console.log('Reconnected to server');
        showNotification('Reconnected!');
        if (currentUser) {
            socket.emit("joinGame", {
                username: currentUser,
                uid: currentUserId,
                skin: playerData.skin
            });
        }
    });

    // =====================================
    // 24. PERFORMANCE OPTIMIZATION
    // =====================================
    let frameSkip = 0;
    const originalRenderGame = renderGame;
    renderGame = function() {
        frameSkip++;
        if (frameSkip % 2 === 0) return;
        originalRenderGame();
        updateParticles(0.016);
        renderParticles();
    };

    // =====================================
    // 25. INIT ON LOAD
    // =====================================
    window.addEventListener('load', () => {
        console.log('MG FIGHTER v4.0 Loaded');
        if (isMobile) {
            document.body.classList.add('mobile');
        }
    });

    // Prevent context menu
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Prevent zoom on mobile
    document.addEventListener('touchmove', (e) => {
        if (e.scale!== 1) e.preventDefault();
    }, { passive: false });

    // Expose global functions for HTML onclick
    window.loginWithGoogle = loginWithGoogle;
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
    window.openBattlePass = openBattlePass;
    window.changeSkinColor = changeSkinColor;
    window.changeSkinHat = changeSkinHat;
    window.returnToLobby = returnToLobby;

    console.log('🔥 MG FIGHTER v4.0 - FULL SYSTEM READY');
    console.log('📱 Mobile:', isMobile);
    console.log('🎮 Controls: WASD/Arrows = Move, Mouse = Aim, Click = Shoot, R = Reload, G = Grenade, F = Interact, 1-6 = Weapons');

})();
