/*

MG FIGHTER v4.0 - script.js COMPLET
Map + Sprite Loading + Tile Rendering

*/

(() => {
    // =====================================
    // 1. CONFIG & GLOBAL STATE
    // =====================================
    const SERVER_URL = "https://mg-fighter-1.onrender.com";
    const socket = io(SERVER_URL, { autoConnect: false });

    const auth = firebase.auth();
    const db = firebase.firestore();

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
        matchMode: 'solo',
        mapData: { width: 2000, height: 2000, walls: [] }
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

    // Map & Sprite assets
    let mapTiles = [];
    let spriteImage = null;
    let mapLoaded = false;
    const TILE_SIZE = 50;

    let spriteData = {};
    let spritesLoaded = false;

    // =====================================
    // 2. DOM ELEMENTS CACHE
    // =====================================
    const DOM = {
        authScreen: document.getElementById('authScreen'),
        lobbyScreen: document.getElementById('lobbyScreen'),
        matchmakingScreen: document.getElementById('matchmakingScreen'),
        gameScreen: document.getElementById('gameScreen'),
        roomScreen: document.getElementById('roomScreen'),
        authError: document.getElementById('authError'),
        playerName: document.getElementById('playerName'),
        playerLevel: document.getElementById('playerLevel'),
        playerCoins: document.getElementById('playerCoins'),
        playerWins: document.getElementById('playerWins'),
        playerKills: document.getElementById('playerKills'),
        onlineCount: document.getElementById('onlineCount'),
        playerAvatar: document.getElementById('playerAvatar'),
        bpXP: document.getElementById('bpXP'),
        bpLevel: document.getElementById('bpLevel'),
        battlePassMenu: document.getElementById('battlePassMenu'),
        bpRewards: document.getElementById('bpRewards'),
        roomIdDisplay: document.getElementById('roomIdDisplay'),
        roomCount: document.getElementById('roomCount'),
        roomPlayers: document.getElementById('roomPlayers'),
        readyBtn: document.getElementById('readyBtn'),
        roomCode: document.getElementById('roomCode'),
        roomChatMessages: document.getElementById('roomChatMessages'),
        roomChatInput: document.getElementById('roomChatInput'),
        friendsList: document.getElementById('friendsList'),
        addFriendInput: document.getElementById('addFriendInput'),
        lobbyChatMessages: document.getElementById('lobbyChatMessages'),
        lobbyChatInput: document.getElementById('lobbyChatInput'),
        matchmakingMode: document.getElementById('matchmakingMode'),
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
        victoryScreen: document.getElementById('victoryScreen'),
        deathScreen: document.getElementById('deathScreen'),
        victoryKills: document.getElementById('victoryKills'),
        victoryReward: document.getElementById('victoryReward'),
        finalRank: document.getElementById('finalRank'),
        finalKills: document.getElementById('finalKills'),
        finalReward: document.getElementById('finalReward'),
        mobileControls: document.getElementById('mobileControls'),
        joystick: document.getElementById('joystick'),
        joystickKnob: document.getElementById('joystickKnob'),
        shootBtn: document.getElementById('shootBtn'),
        scopeBtn: document.getElementById('scopeBtn'),
        lootBtn: document.getElementById('lootBtn'),
        sprintBtn: document.getElementById('sprintBtn'),
        grenadeBtn: document.getElementById('grenadeBtn'),
        vehicleBtn: document.getElementById('vehicleBtn'),
        skinMenu: document.getElementById('skinMenu')
    };

    // =====================================
    // 3. ASSET LOADING
    // =====================================
    async function loadAssets() {
    try {
        // Load map.json
        const mapResponse = await fetch('/map.json');
        if (mapResponse.ok) {
            mapTiles = await mapResponse.json();
            console.log('✅ Map loaded:', mapTiles.length, 'tiles');
        }

        // Load sprite.json
        const spriteResponse = await fetch('/sprite.json');
        if (spriteResponse.ok) {
            spriteData = await spriteResponse.json();
            console.log('✅ Sprite data loaded');
        }

        // Load sprites.png
        spriteImage = new Image();
        spriteImage.src = '/sprites.png';
        await new Promise((resolve, reject) => {
            spriteImage.onload = resolve;
            spriteImage.onerror = reject;
        });
        console.log('✅ Sprites image loaded');

        mapLoaded = true;
        spritesLoaded = true;
    } catch (err) {
        console.error('❌ Asset loading error:', err);
    }
}

    // =====================================
    // 4. UTILITY FUNCTIONS
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
        div.style.background = isError? 'linear-gradient(135deg, #ff4444, #ff0000)' : 'linear-gradient(135deg, #00ff88, #00aaff)';
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
    // 5. AUTHENTICATION
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

            const ref = db.collection("players").doc(user.uid);
            const snap = await ref.get();

            if (!snap.exists) {
                playerData = {
                    username: currentUser,
                    email: user.email,
                    photo: user.photoURL || "",
                    level: 1, coins: 100, wins: 0, kills: 0, xp: 0,
                    bpLevel: 1, bpXP: 0,
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
        if (user &&!currentUser) {
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
    // 6. SOCKET.IO EVENTS
    // =====================================
    socket.on("connect", () => {
        myId = socket.id;
        console.log("Connected:", myId);
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
        gameState = {...gameState,...data };
        if (data.mapData) {
            gameState.mapData = data.mapData;
        }
        if (data.spriteData) {
        spriteData = data.spriteData;
        }
            
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
    // 7. LOBBY FUNCTIONS
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
        if (code.length!== 6) return showNotification('Invalid room code', true);
        socket.emit("joinRoom", code);
        DOM.roomScreen.classList.remove('hidden');
    };

    window.leaveRoom = function() {
        socket.emit("leaveRoom");
        DOM.roomScreen.classList.add('hidden');
        roomState = { id: null, players: [], isReady: false };
    };

    window.ready = function() {
        roomState.isReady =!roomState.isReady;
        socket.emit("playerReady", roomState.isReady);
        DOM.readyBtn.textContent = roomState.isReady? 'UNREADY' : 'READY';
        DOM.readyBtn.style.background = roomState.isReady? '#ff4444' : 'linear-gradient(135deg, #00ff88, #00ff00)';
    };

    function updateRoomUI() {
        if (!roomState.id) return;
        DOM.roomIdDisplay.textContent = roomState.id;
        DOM.roomCount.textContent = `${roomState.players.length}/4`;
        DOM.roomPlayers.innerHTML = '';

        roomState.players.forEach(p => {
            const div = document.createElement('div');
            div.className = 'room-player' + (p.ready? ' ready' : '');
            div.innerHTML = `
                <div class="room-player-name">${p.username} ${p.id === roomState.host? '👑' : ''}</div>
                <div class="room-player-status">${p.ready? '✅' : '⏳'}</div>
            `;
            DOM.roomPlayers.appendChild(div);
        });

        const allReady = roomState.players.length >= 2 && roomState.players.every(p => p.ready);
        DOM.readyBtn.disabled =!allReady &&!roomState.isReady;
    }

    // =====================================
    // 8. CHAT FUNCTIONS
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
    // 9. FRIENDS SYSTEM
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
        const offline = playerData.friends.filter(f =>!f.online);

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
    // 10. BATTLE PASS & SKINS
    // =====================================
    window.openBattlePass = function() {
        DOM.battlePassMenu.classList.remove('hidden');
        renderBattlePass();
    };

    function renderBattlePass() {
        DOM.bpRewards.innerHTML = '';
        const rewards = [
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

        rewards.forEach(reward => {
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
    // 11. GAME FUNCTIONS
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

        camera.x = me.x - canvas.width / 2;
        camera.y = me.y - canvas.height / 2;

        DOM.hp.textContent = Math.max(0, Math.floor(me.hp));
        DOM.hpBar.style.width = `${me.hp}%`;
        DOM.armor.textContent = Math.floor(me.armor || 0);
        DOM.armorBar.style.width = `${me.armor || 0}%`;
        DOM.weapon.textContent = me.weapon || 'Fist';
        DOM.ammo.textContent = me.ammo === Infinity? '∞' : me.ammo || 0;
        DOM.grenades.textContent = me.grenades || 0;
        DOM.kills.textContent = me.kills || 0;
        DOM.level.textContent = me.level || 1;
        DOM.xp.textContent = `${me.xp || 0}/${(me.level || 1) * 100}`;

        handleInput();
    }

    function renderGame() {
        if (!ctx) return;

        // Clear
        ctx.fillStyle = '#0a1a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw tiles from map.json
        // Draw tiles from map.json miaraka amin'ny sprites
if (mapLoaded && spritesLoaded && mapTiles.length > 0) {
    const startX = Math.floor(camera.x / TILE_SIZE) - 1;
    const startY = Math.floor(camera.y / TILE_SIZE) - 1;
    const endX = Math.ceil((camera.x + canvas.width) / TILE_SIZE) + 1;
    const endY = Math.ceil((camera.y + canvas.height) / TILE_SIZE) + 1;

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const tileIndex = y * (MAP_DATA.width / TILE_SIZE) + x;
            if (tileIndex >= 0 && tileIndex < mapTiles.length) {
                const tile = mapTiles[tileIndex];
                if (!tile) continue;

                const drawX = tile.x - camera.x;
                const drawY = tile.y - camera.y;

                // Mampiasa sprite.json raha misy
                if (tile.spriteId && spriteData.tiles && spriteData.tiles[tile.spriteId]) {
                    const sprite = spriteData.tiles[tile.spriteId];
                    ctx.drawImage(
                        spriteImage,
                        sprite.x, sprite.y, sprite.w, sprite.h,
                        drawX, drawY, tile.s, tile.s
                    );
                } else {
                    // Fallback color
                    if (tile.collision) {
                        ctx.fillStyle = '#444';
                    } else if (tile.swimmable) {
                        ctx.fillStyle = '#0088ff';
                    } else {
                        ctx.fillStyle = '#2a2a2a';
                    }
                    ctx.fillRect(drawX, drawY, tile.s, tile.s);
                }
            }
        }
    }
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
            ctx.fillRect(l.x - camera.x - 10, l.y - camera.y - 10, 20);
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
            ctx.fillStyle = isMe? playerData.skin.color : '#ff4444';
            ctx.fillRect(x - 12, y - 12, 24, 24);

            // Hat
            if (p.skin?.hat && p.skin.hat!== 'none') {
                ctx.font = '20px Arial';
                const hatEmoji = { crown: '👑', helmet: '🪖', cap: '🧢' }[p.skin.hat];
                ctx.fillText(hatEmoji, x - 10, y - 15);
            }

            // Draw weapon miaraka amin'ny sprite
           if (p.weapon && p.weapon!== 'fist' && spriteData.weapons && spriteData.weapons[p.weapon] && spriteImage) {
           const weaponSprite = spriteData.weapons[p.weapon];
           ctx.save();
           ctx.translate(x, y);
           ctx.rotate(p.angle);
           ctx.drawImage(
           spriteImage,
           weaponSprite.x, weaponSprite.y, weaponSprite.w, weaponSprite.h,
           12, -5, 30, 10
           );
           ctx.restore();
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
            if (p.angle!== undefined) {
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

        const scale = 180 / MAP_DATA.width;

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
            minimapCtx.fillStyle = p.id === myId? '#00ff00' : '#ff0000';
            minimapCtx.beginPath();
            minimapCtx.arc(p.x * scale, p.y * scale, 3, 0, Math.PI * 2);
            minimapCtx.fill();
        });
    }

    // =====================================
    // 12. INPUT HANDLING
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
        DOM.mobileControls.classList.remove('hidden');

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

        DOM.scopeBtn.addEventListener('touchstart', () => socket.emit('scope', true));
        DOM.scopeBtn.addEventListener('touchend', () => socket.emit('scope', false));
        DOM.lootBtn.addEventListener('touchstart', () => socket.emit('interact'));
        DOM.sprintBtn.addEventListener('touchstart', () => keys['shift'] = true);
        DOM.sprintBtn.addEventListener('touchend', () => keys['shift'] = false);
        DOM.grenadeBtn.addEventListener('touchstart', () => socket.emit('grenade', { angle: mouseAngle }));
        DOM.vehicleBtn.addEventListener('touchstart', () => socket.emit('enterVehicle'));

        // Auto aim for mobile
        setInterval(() => {
            if (!isMobile ||!isGameRunning) return;
            const me = getMyPlayer();
            if (!me) return;

            let closestEnemy = null;
            let closestDist = Infinity;

            Object.values(gameState.players).forEach(p => {
                if (p.id === myId || p.hp <= 0) return;
                const dist = getDistance(p.x, p.y, me.x, me.y);
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
    // 13. UI UPDATES
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
        div.style.color = isHeadshot? '#ff0000' : '#ffff00';
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
                <td>${p.hp > 0? '✅ Alive' : '💀 Dead'}</td>
            `;
            DOM.scoreboardBody.appendChild(tr);
        });
    }

    // =====================================
    // 14. GAME END & RETURN
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
    // 15. ERROR HANDLING & RECONNECT
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
    // 16. KEYBOARD SHORTCUTS
    // =====================================
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
        socket.emit('switchWeapon', weaponName);
    }

    function reloadWeapon() {
        socket.emit('reload');
    }

    function throwGrenade() {
        socket.emit('grenade', { angle: mouseAngle });
    }

    function interactWithLoot() {
        socket.emit('interact');
    }

    function enterVehicle() {
        socket.emit('enterVehicle');
    }

    // =====================================
    // 17. INIT ON LOAD
    // =====================================
    window.addEventListener('load', async () => {
        console.log('MG FIGHTER v4.0 Loaded');
        await loadAssets();
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
