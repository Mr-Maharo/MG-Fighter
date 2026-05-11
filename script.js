(() => {
    'use strict';

    // ============================================
    // 0. CONFIG & VERSION
    // ============================================
    const CONFIG = {
        SERVER_URL: "https://mg-fighter-1.onrender.com",
        VERSION: "4.2.0",
        MAX_PLAYERS: 50,
        TICK_RATE: 60,
        MAP_WIDTH: 4000,
        MAP_HEIGHT: 4000,
        TILE_SIZE: 32,
        PLAYER_SPEED: 200,
        PLAYER_SPRINT_SPEED: 320,
        PLAYER_SWIM_SPEED: 120,
        PLAYER_HP: 100,
        PLAYER_ARMOR_MAX: 100,
        ZONE_SHRINK_INTERVAL: 45000,
        ZONE_DAMAGE: 5,
        WEAPONS: {
            fist: { damage: 15, range: 50, fireRate: 500, ammo: Infinity, bulletSpeed: 0 },
            pistol: { damage: 25, range: 400, fireRate: 300, ammo: 12, bulletSpeed: 600 },
            shotgun: { damage: 16, range: 150, fireRate: 800, ammo: 8, pellets: 5, bulletSpeed: 400, spread: 0.3 },
            smg: { damage: 18, range: 300, fireRate: 100, ammo: 30, bulletSpeed: 700 },
            rifle: { damage: 35, range: 600, fireRate: 150, ammo: 30, bulletSpeed: 900 },
            sniper: { damage: 90, range: 1000, fireRate: 1200, ammo: 5, bulletSpeed: 1200 }
        },
        GRENADE_DAMAGE: 75,
        GRENADE_RADIUS: 100
    };

    // ============================================
    // 1. SOCKET.IO INIT
    // ============================================
    const socket = io(CONFIG.SERVER_URL, {
        autoConnect: false,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
        timeout: 10000
    });

    // ============================================
    // 2. GLOBAL GAME STATE
    // ============================================
    let gameState = {
        players: {},
        enemies: [],
        bullets: [],
        loot: [],
        vehicles: [],
        particles: [],
        damageNumbers: [],
        zone: { x: 2000, y: 2000, radius: 2000, targetRadius: 2000, timer: 0, phase: 0 },
        aliveCount: 0,
        matchMode: 'solo',
        matchId: null,
        mapData: { width: 4000, height: 4000, walls: [], water: [] },
        mapImage: null,
        mapLoaded: false,
        spriteImage: null,
        spritesLoaded: false,
        player: null,
        isGameRunning: false,
        isPaused: false,
        stats: { fps: 0, ping: 0 }
    };

    // ============================================
    // 3. FIREBASE AUTH
    // ============================================
    const auth = firebase.auth();
    const db = firebase.firestore();
    let myId = null;
    let currentUser = null;
    let currentUserId = null;

    // ============================================
    // 4. ROOM STATE
    // ============================================
    let roomState = {
        id: null,
        players: [],
        isReady: false,
        host: null
    };

    // ============================================
    // 5. INPUT STATE
    // ============================================
    let keys = {};
    let mouseAngle = 0;
    let isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    let joystickActive = false;
    let joystickPos = { x: 0, y: 0 };
    let touchShootInterval = null;
    let lastMoveEmit = 0;
    const MOVE_THROTTLE = 1000 / 20;

    // ============================================
    // 6. CANVAS & RENDERING
    // ============================================
    let canvas, ctx, minimapCanvas, minimapCtx;
    let camera = { x: 0, y: 0, shake: 0 };
    let lastFrameTime = 0;
    let frameCount = 0;
    let fpsTime = 0;

    // ============================================
    // 7. ASSET MANAGEMENT
    // ============================================
    let mapTiles = [];
    let spriteData = {};
    let spriteImage = null;
    let audioContext = null;
    let sounds = {};

    // ============================================
    // 8. UTILS - SECURITY + HELPERS
    // ============================================
    const Utils = {
        sanitizeHTML: (str) => {
            if (typeof str!== 'string') return '';
            const temp = document.createElement('div');
            temp.textContent = str;
            return temp.innerHTML;
        },

        sanitizeUsername: (username) => {
            return Utils.sanitizeHTML(username).replace(/[^a-zA-Z0-9_]/g, '').substring(0, 20) || 'Player';
        },

        formatTime: (seconds) => {
            seconds = Math.max(0, Math.floor(seconds));
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return `${m}:${s.toString().padStart(2, '0')}`;
        },

        getDistance: (x1, y1, x2, y2) => {
            const dx = x2 - x1;
            const dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        },

        clamp: (val, min, max) => Math.min(Math.max(val, min), max),

        lerp: (a, b, t) => a + (b - a) * t,

        randomRange: (min, max) => Math.random() * (max - min) + min,

        randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,

        degToRad: (deg) => deg * Math.PI / 180,

        radToDeg: (rad) => rad * 180 / Math.PI,

        angleDiff: (a, b) => {
            let diff = b - a;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            return diff;
        }
    };

    // ============================================
    // 9. DOM CACHE - PERFORMANCE
    // ============================================
    const DOM = {};
    const DOM_IDS = [
        'authScreen','lobbyScreen','matchmakingScreen','gameScreen','roomScreen','authError',
        'playerName','playerLevel','playerCoins','playerWins','playerKills','playerRank','onlineCount',
        'playerAvatar','bpXP','bpLevel','bpXPText','battlePassMenu','bpRewards','roomIdDisplay',
        'roomCount','roomPlayers','readyBtn','startMatchBtn','roomCode','roomChatMessages',
        'roomChatInput','friendsList','addFriendInput','lobbyChatMessages','lobbyChatInput',
        'matchmakingMode','playersFound','estimatedTime','game','minimap','hp','hpBar','armor',
        'armorBar','weapon','ammo','grenades','kills','level','xp','zoneTimer','playersAlive',
        'killFeed','damageNumbers','zoneWarning','scope','hitmarker','lbList','aliveCount',
        'aliveCountLB','scoreboard','scoreboardBody','victoryScreen','deathScreen','victoryKills',
        'victoryDamage','victoryTime','victoryReward','finalRank','finalKills','finalDamage',
        'finalTime','finalReward','mobileControls','joystick','joystickKnob','shootBtn','scopeBtn',
        'lootBtn','sprintBtn','grenadeBtn','vehicleBtn','reloadBtn','skinMenu','shopMenu',
        'inventoryMenu','settingsMenu','profileMenu','mailMenu','fullLeaderboard','fullLeaderboardBody',
        'termsModal','privacyModal','creditsScreen','notificationContainer','confirmDialog','toastContainer',
        'spectateUI','spectatePlayerName','mailBadge','loadingScreen','loadingText','skinColorTab',
        'skinHatTab','skinOutfitTab','skinEmoteTab','shopSkinsTab','shopHatsTab','shopBundlesTab',
        'shopCoinsTab','invSkinsTab','invHatsTab','invItemsTab','mailInboxTab','mailSystemTab',
        'invSkinsGrid','shopSkinsGrid','profileUsername','profileLevel','statWins','statKills',
        'statDeaths','statMatches','profileKDR','volumeSlider','volumeValue','sfxSlider','sfxValue',
        'sensitivitySlider','sensitivityValue','qualitySelect','fpsSelect'
    ];

    window.addEventListener('DOMContentLoaded', () => {
        DOM_IDS.forEach(id => DOM[id] = document.getElementById(id));
        initEventListeners();
    });

    // ============================================
    // 10. NOTIFICATION SYSTEM
    // ============================================
    const Notify = {
        toast: (msg, type = 'info') => {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = Utils.sanitizeHTML(msg);
            DOM.toastContainer?.appendChild(toast);
            setTimeout(() => toast.classList.add('show'), 10);
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        },

        show: (msg, isError = false) => {
            const div = document.createElement('div');
            div.className = 'levelup';
            div.style.background = isError? 'linear-gradient(135deg, #ff4444, #ff0000)' : 'linear-gradient(135deg, #00ff88, #00aaff)';
            div.innerHTML = `<p>${Utils.sanitizeHTML(msg)}</p>`;
            document.body.appendChild(div);
            setTimeout(() => div.remove(), 3000);
        },

        confirm: (msg, onYes, onNo) => {
            const dialog = DOM.confirmDialog;
            if (!dialog) return;
            dialog.querySelector('p').textContent = Utils.sanitizeHTML(msg);
            dialog.classList.remove('hidden');
            const yesBtn = dialog.querySelector('.btn-yes');
            const noBtn = dialog.querySelector('.btn-no');
            const cleanup = () => {
                dialog.classList.add('hidden');
                yesBtn.onclick = null;
                noBtn.onclick = null;
            };
            yesBtn.onclick = () => { cleanup(); onYes?.(); };
            noBtn.onclick = () => { cleanup(); onNo?.(); };
        }
    };

    // ============================================
    // 11. AUDIO SYSTEM
    // ============================================
    const Audio = {
        init: () => {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('Audio not supported');
            }
        },

        play: (type) => {
            if (!audioContext ||!gameState.player) return;
            const volume = (gameState.player.settings?.sfx || 50) / 100;
            if (volume === 0) return;

            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);

            const sounds = {
                shoot: { freq: 150, duration: 0.1, type: 'square' },
                hit: { freq: 300, duration: 0.05, type: 'sine' },
                pickup: { freq: 600, duration: 0.1, type: 'sine' },
                reload: { freq: 200, duration: 0.2, type: 'sawtooth' },
                death: { freq: 100, duration: 0.5, type: 'sawtooth' },
                victory: { freq: 523, duration: 0.3, type: 'sine' }
            };

            const sound = sounds[type] || sounds.shoot;
            osc.frequency.value = sound.freq;
            osc.type = sound.type;
            gain.gain.setValueAtTime(volume * 0.3, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + sound.duration);
            osc.start();
            osc.stop(audioContext.currentTime + sound.duration);
        }
    };

    // ============================================
    // 12. AUTHENTICATION SYSTEM
    // ============================================
    const Auth = {
        loginWithGoogle: async () => {
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
                    gameState.player = {
                        username: Utils.sanitizeUsername(currentUser),
                        email: user.email,
                        photo: user.photoURL || "",
                        level: 1, coins: 100, wins: 0, kills: 0, deaths: 0, matches: 0, xp: 0,
                        bpLevel: 1, bpXP: 0, rank: "Bronze III",
                        skin: { color: '#00ff00', hat: 'none' },
                        friends: [],
                        settings: { volume: 50, sfx: 50, sensitivity: 50, quality: 'medium', fps: 60 },
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    await ref.set(gameState.player);
                    Notify.show('Welcome to MG FIGHTER!');
                } else {
                    gameState.player = snap.data();
                }

                UI.updateLobby();
                UI.showScreen('lobbyScreen');
                socket.connect();
                socket.emit("joinGame", {
                    username: currentUser,
                    uid: currentUserId,
                    skin: gameState.player.skin,
                    level: gameState.player.level
                });

            } catch (err) {
                console.error("LOGIN ERROR:", err);
                DOM.authError.textContent = 'Login failed. Try again.';
            }
        },

        loginAnonymously: async () => {
            try {
                const result = await auth.signInAnonymously();
                const user = result.user;
                currentUser = "Guest" + Utils.randomInt(1000, 9999);
                currentUserId = user.uid;

                gameState.player = {
                    username: currentUser,
                    level: 1, coins: 100, wins: 0, kills: 0, deaths: 0, matches: 0, xp: 0,
                    bpLevel: 1, bpXP: 0, rank: "Bronze III",
                    skin: { color: '#00ff00', hat: 'none' },
                    friends: [],
                    settings: { volume: 50, sfx: 50, sensitivity: 50, quality: 'medium', fps: 60 },
                    isGuest: true
                };

                UI.updateLobby();
                UI.showScreen('lobbyScreen');
                socket.connect();
                socket.emit("joinGame", {
                    username: currentUser,
                    uid: currentUserId,
                    skin: gameState.player.skin,
                    level: 1
                });

            } catch (err) {
                console.error("GUEST LOGIN ERROR:", err);
                DOM.authError.textContent = 'Guest login failed.';
            }
        },

        savePlayerData: async () => {
            if (!currentUserId || gameState.player?.isGuest) return;
            try {
                await db.collection("players").doc(currentUserId).update({
                    coins: gameState.player.coins,
                    wins: gameState.player.wins,
                    kills: gameState.player.kills,
                    deaths: gameState.player.deaths,
                    matches: gameState.player.matches,
                    xp: gameState.player.xp,
                    level: gameState.player.level,
                    bpLevel: gameState.player.bpLevel,
                    bpXP: gameState.player.bpXP,
                    rank: gameState.player.rank,
                    skin: gameState.player.skin,
                    settings: gameState.player.settings
                });
            } catch (e) {
                console.error('Save failed:', e);
            }
        }
    };

    auth.onAuthStateChanged(async user => {
        if (user &&!currentUser) {
            currentUserId = user.uid;
            currentUser = user.displayName || "Player";
            const ref = db.collection("players").doc(user.uid);
            const snap = await ref.get();
            if (snap.exists) {
                gameState.player = snap.data();
                UI.updateLobby();
                UI.showScreen('lobbyScreen');
                socket.connect();
                socket.emit("joinGame", {
                    username: currentUser,
                    uid: currentUserId,
                    skin: gameState.player.skin,
                    level: gameState.player.level
                });
            }
        } else if (!user) {
            UI.showScreen('authScreen');
            if (socket.connected) socket.disconnect();
        }
    });

    // ============================================
    // 13. SOCKET HANDLERS
    // ============================================
    socket.on("connect", () => {
        myId = socket.id;
        console.log("✅ Connected:", myId);
        Notify.toast('Connected to server!', 'success');
    });

    socket.on("disconnect", () => {
        console.log('❌ Disconnected from server');
        if (gameState.isGameRunning) {
            Notify.show('Connection lost! Reconnecting...', true);
        }
    });

    socket.on("connect_error", (error) => {
        console.error('❌ Connection error:', error);
        Notify.show('Server connection failed!', true);
        DOM.authError.textContent = 'Server offline. Try again later.';
    });

    socket.on("onlineCount", (count) => {
        if (DOM.onlineCount) DOM.onlineCount.textContent = count;
    });

    socket.on("playersUpdate", (players) => {
        gameState.players = players;
        gameState.aliveCount = Object.values(players).filter(p => p.hp > 0).length;
        if (DOM.aliveCount) DOM.aliveCount.textContent = gameState.aliveCount;
        if (DOM.aliveCountLB) DOM.aliveCountLB.textContent = gameState.aliveCount;
        UI.updateLeaderboard();
        if (gameState.isGameRunning) UI.updateScoreboard();
    });

    socket.on("gameStart", async (data) => {
        Object.assign(gameState, data);
        gameState.isGameRunning = true;
        UI.showScreen('gameScreen');
        await Game.init();
        if (isMobile && DOM.mobileControls) DOM.mobileControls.classList.remove('hidden');
        Notify.toast('Match Started!', 'success');
        Audio.play('victory');
    });

    socket.on("gameUpdate", (data) => {
        Object.assign(gameState, data);
    });

    socket.on("killFeed", (data) => {
        UI.addKillFeed(Utils.sanitizeHTML(data.killer), Utils.sanitizeHTML(data.victim), data.weapon);
        Audio.play('hit');
    });

    socket.on("damageNumber", (data) => {
        UI.showDamageNumber(data.x, data.y, data.damage, data.isHeadshot);
    });

    socket.on("hitmarker", () => {
        if (DOM.hitmarker) {
            DOM.hitmarker.classList.remove('hidden');
            setTimeout(() => DOM.hitmarker.classList.add('hidden'), 100);
        }
        Audio.play('hit');
    });

    socket.on("zoneUpdate", (zone) => {
        gameState.zone = zone;
        if (DOM.zoneTimer) DOM.zoneTimer.textContent = `ZONE: ${Utils.formatTime(zone.timer)}`;
        const me = gameState.players[myId];
        if (me && DOM.zoneWarning) {
            const dist = Utils.getDistance(me.x, me.y, zone.x, zone.y);
            if (dist > zone.radius) {
                DOM.zoneWarning.classList.remove('hidden');
            } else {
                DOM.zoneWarning.classList.add('hidden');
            }
        }
    });

    socket.on("playerDied", (data) => {
        if (data.id === myId) {
            gameState.isGameRunning = false;
            if (DOM.finalRank) DOM.finalRank.textContent = data.rank;
            if (DOM.finalKills) DOM.finalKills.textContent = data.kills;
            if (DOM.finalDamage) DOM.finalDamage.textContent = data.damage || 0;
            if (DOM.finalTime) DOM.finalTime.textContent = Utils.formatTime(data.time || 0);
            if (DOM.finalReward) DOM.finalReward.textContent = `+${data.coins} Coins +${data.xp} XP`;
            if (DOM.deathScreen) DOM.deathScreen.classList.remove('hidden');

            gameState.player.coins += data.coins;
            gameState.player.xp += data.xp;
            gameState.player.kills += data.kills;
            gameState.player.deaths++;
            gameState.player.matches++;
            Game.levelUpCheck();
            Auth.savePlayerData();
            UI.updateLobby();
            Audio.play('death');
        }
    });

    socket.on("victory", (data) => {
        gameState.isGameRunning = false;
        if (DOM.victoryKills) DOM.victoryKills.textContent = data.kills;
        if (DOM.victoryDamage) DOM.victoryDamage.textContent = data.damage || 0;
        if (DOM.victoryTime) DOM.victoryTime.textContent = Utils.formatTime(data.survived || 0);
        if (DOM.victoryReward) DOM.victoryReward.textContent = `+${data.coins} Coins +${data.xp} XP`;
        if (DOM.victoryScreen) DOM.victoryScreen.classList.remove('hidden');

        gameState.player.coins += data.coins;
        gameState.player.xp += data.xp;
        gameState.player.kills += data.kills;
        gameState.player.wins++;
        gameState.player.matches++;
        Game.levelUpCheck();
        Auth.savePlayerData();
        UI.updateLobby();
        Audio.play('victory');
    });

    socket.on("lootPickup", (data) => {
        const me = gameState.players[myId];
        if (!me || data.playerId!== myId) return;

        if (data.type === 'weapon') {
            me.weapon = data.item;
            me.ammo = CONFIG.WEAPONS[data.item].ammo;
            Notify.toast(`Picked up ${data.item}!`, 'success');
        } else if (data.type === 'ammo') {
            me.ammo += data.amount;
            Notify.toast(`+${data.amount} Ammo`, 'success');
        } else if (data.type === 'armor') {
            me.armor = Math.min(CONFIG.PLAYER_ARMOR_MAX, me.armor + data.amount);
            Notify.toast(`+${data.amount} Armor`, 'success');
        } else if (data.type === 'heal') {
            me.hp = Math.min(CONFIG.PLAYER_HP, me.hp + data.amount);
            Notify.toast(`+${data.amount} HP`, 'success');
        } else if (data.type === 'grenade') {
            me.grenades = Math.min(5, me.grenades + data.amount);
            Notify.toast(`+${data.amount} Grenade`, 'success');
        }
        Audio.play('pickup');
    });

    socket.on("explosion", (data) => {
        Game.addParticle(data.x, data.y, 'explosion');
        camera.shake = 10;
        Audio.play('hit');
    });

    socket.on("soundEvent", (type) => {
        Audio.play(type);
    });

    socket.on("serverMessage", (data) => {
        Notify.show(data.text, data.type === 'error');
    });

    socket.on("roomUpdate", (room) => {
        roomState = room;
        Lobby.updateRoomUI();
    });

    socket.on("roomError", (error) => {
        Notify.show(`Room error: ${error}`, true);
    });

    socket.on("kickedFromRoom", () => {
        Notify.show('You were kicked from the room', true);
        DOM.roomScreen?.classList.add('hidden');
        roomState = { id: null, players: [], isReady: false };
    });

    socket.on("chatMessage", (data) => {
        if (data.type === 'lobby') Chat.addLobbyMessage(data);
        else if (data.type === 'room') Chat.addRoomMessage(data);
    });

    socket.on("friendRequest", (data) => {
        Notify.confirm(`${data.username} sent you a friend request. Accept?`,
            () => socket.emit('friendRequestResponse', { fromId: data.fromId, accept: true }),
            () => socket.emit('friendRequestResponse', { fromId: data.fromId, accept: false })
        );
    });

    socket.on("friendAdded", (data) => {
        if (!gameState.player.friends) gameState.player.friends = [];
        gameState.player.friends.push(data);
        Notify.toast(`${data.username} is now your friend!`, 'success');
    });

    socket.on("friendUpdate", () => {
        Friends.load();
    });

    // ============================================
    // 14. EVENT LISTENERS INIT
    // ============================================
    function initEventListeners() {
        // Auth buttons
        document.getElementById('googleLoginBtn')?.addEventListener('click', Auth.loginWithGoogle);
        document.getElementById('guestLoginBtn')?.addEventListener('click', Auth.loginAnonymously);

        // Lobby buttons
        document.getElementById('findMatchBtn')?.addEventListener('click', () => Lobby.findMatch('solo'));
        document.getElementById('createRoomBtn')?.addEventListener('click', Lobby.createRoom);
        document.getElementById('joinRoomBtn')?.addEventListener('click', Lobby.joinRoom);
        document.getElementById('cancelMatchmakingBtn')?.addEventListener('click', Lobby.cancelMatchmaking);

        // Room buttons
        DOM.readyBtn?.addEventListener('click', Lobby.ready);
        DOM.startMatchBtn?.addEventListener('click', Lobby.startMatch);
        document.getElementById('leaveRoomBtn')?.addEventListener('click', Lobby.leaveRoom);

        // Chat
        DOM.lobbyChatInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') Chat.sendLobby();
        });
        DOM.roomChatInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') Chat.sendRoom();
        });

        // Friends
        DOM.addFriendInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') Friends.add();
        });

        // Settings sliders
        DOM.volumeSlider?.addEventListener('input', (e) => {
            if (gameState.player) gameState.player.settings.volume = parseInt(e.target.value);
            if (DOM.volumeValue) DOM.volumeValue.textContent = e.target.value;
        });
        DOM.sfxSlider?.addEventListener('input', (e) => {
            if (gameState.player) gameState.player.settings.sfx = parseInt(e.target.value);
            if (DOM.sfxValue) DOM.sfxValue.textContent = e.target.value;
        });
        DOM.sensitivitySlider?.addEventListener('input', (e) => {
            if (gameState.player) gameState.player.settings.sensitivity = parseInt(e.target.value);
            if (DOM.sensitivityValue) DOM.sensitivityValue.textContent = e.target.value;
        });
    }

        // ============================================
    // 15. LOBBY SYSTEM
    // ============================================
    const Lobby = {
        findMatch: (mode) => {
            if (!gameState.player) return;
            gameState.matchMode = mode;
            if (DOM.matchmakingMode) DOM.matchmakingMode.textContent = mode.toUpperCase();
            UI.showScreen('matchmakingScreen');
            socket.emit("findMatch", mode);
        },

        cancelMatchmaking: () => {
            socket.emit("cancelMatchmaking");
            UI.showScreen('lobbyScreen');
        },

        createRoom: () => {
            socket.emit("createRoom");
            DOM.roomScreen?.classList.remove('hidden');
        },

        joinRoom: () => {
            const code = DOM.roomCode?.value.trim().toUpperCase();
            if (!code || code.length!== 6) return Notify.show('Invalid room code', true);
            socket.emit("joinRoom", Utils.sanitizeHTML(code));
            DOM.roomScreen?.classList.remove('hidden');
        },

        leaveRoom: () => {
            socket.emit("leaveRoom");
            DOM.roomScreen?.classList.add('hidden');
            roomState = { id: null, players: [], isReady: false };
        },

        ready: () => {
            roomState.isReady =!roomState.isReady;
            socket.emit("playerReady", roomState.isReady);
            if (DOM.readyBtn) {
                DOM.readyBtn.textContent = roomState.isReady? 'UNREADY' : 'READY';
                DOM.readyBtn.style.background = roomState.isReady? '#ff4444' : 'linear-gradient(135deg, #00ff88, #00ff00)';
            }
        },

        startMatch: () => {
            socket.emit("startMatch");
        },

        updateRoomUI: () => {
            if (!roomState.id) return;
            if (DOM.roomIdDisplay) DOM.roomIdDisplay.textContent = roomState.id;
            if (DOM.roomCount) DOM.roomCount.textContent = `${roomState.players.length}/4`;
            if (DOM.roomPlayers) {
                DOM.roomPlayers.innerHTML = '';
                roomState.players.forEach(p => {
                    const div = document.createElement('div');
                    div.className = 'room-player' + (p.ready? ' ready' : '');
                    div.innerHTML = `
                        <div class="room-player-name">${Utils.sanitizeHTML(p.username)} ${p.id === roomState.host? '👑' : ''}</div>
                        <div class="room-player-status">${p.ready? '✅' : '⏳'}</div>
                    `;
                    DOM.roomPlayers.appendChild(div);
                });
            }

            const allReady = roomState.players.length >= 2 && roomState.players.every(p => p.ready);
            const isHost = roomState.host === myId;
            if (DOM.startMatchBtn) DOM.startMatchBtn.classList.toggle('hidden',!isHost ||!allReady);
            if (DOM.readyBtn) DOM.readyBtn.disabled =!allReady &&!roomState.isReady;
        }
    };

    // ============================================
    // 16. CHAT SYSTEM
    // ============================================
    const Chat = {
        sendLobby: () => {
            const msg = DOM.lobbyChatInput?.value.trim();
            if (!msg) return;
            socket.emit("chatMessage", { type: 'lobby', message: Utils.sanitizeHTML(msg) });
            if (DOM.lobbyChatInput) DOM.lobbyChatInput.value = '';
        },

        sendRoom: () => {
            const msg = DOM.roomChatInput?.value.trim();
            if (!msg) return;
            socket.emit("chatMessage", { type: 'room', message: Utils.sanitizeHTML(msg) });
            if (DOM.roomChatInput) DOM.roomChatInput.value = '';
        },

        addLobbyMessage: (data) => {
            if (!DOM.lobbyChatMessages) return;
            const p = document.createElement('p');
            p.innerHTML = `<span class="chat-time">${new Date().toLocaleTimeString()}</span><span class="chat-user">${Utils.sanitizeHTML(data.username)}:</span> ${Utils.sanitizeHTML(data.message)}`;
            DOM.lobbyChatMessages.appendChild(p);
            DOM.lobbyChatMessages.scrollTop = DOM.lobbyChatMessages.scrollHeight;
        },

        addRoomMessage: (data) => {
            if (!DOM.roomChatMessages) return;
            const p = document.createElement('p');
            p.innerHTML = `<span class="chat-time">${new Date().toLocaleTimeString()}</span><span class="chat-user">${Utils.sanitizeHTML(data.username)}:</span> ${Utils.sanitizeHTML(data.message)}`;
            DOM.roomChatMessages.appendChild(p);
            DOM.roomChatMessages.scrollTop = DOM.roomChatMessages.scrollHeight;
        }
    };

    // ============================================
    // 17. FRIENDS SYSTEM
    // ============================================
    const Friends = {
        add: () => {
            const input = DOM.addFriendInput;
            if (input?.value.trim()) {
                socket.emit("addFriend", Utils.sanitizeHTML(input.value.trim()));
                Notify.toast(`Friend request sent to ${input.value}`, 'success');
                input.value = '';
            }
        },

        load: () => {
            if (!DOM.friendsList ||!gameState.player?.friends) return;
            DOM.friendsList.innerHTML = '';
            gameState.player.friends.forEach(f => {
                const div = document.createElement('div');
                div.className = 'friend-item' + (f.online? ' online' : '');
                div.innerHTML = `
                    <div class="friend-avatar">${f.username[0].toUpperCase()}</div>
                    <div class="friend-info">
                        <div class="friend-name">${Utils.sanitizeHTML(f.username)}</div>
                        <div class="friend-status">${f.online? 'Online' : 'Offline'}</div>
                    </div>
                `;
                DOM.friendsList.appendChild(div);
            });
        }
    };

    // ============================================
    // 18. BATTLE PASS SYSTEM
    // ============================================
    const BattlePass = {
        open: () => {
            DOM.battlePassMenu?.classList.remove('hidden');
            BattlePass.render();
        },

        render: () => {
            const container = DOM.bpRewards;
            if (!container ||!gameState.player) return;
            let html = '';
            for (let i = 1; i <= 50; i++) {
                const unlocked = i <= gameState.player.bpLevel;
                const claimed = i <= gameState.player.bpLevel;
                html += `
                    <div class="bp-item ${unlocked? 'unlocked' : ''} ${claimed? 'claimed' : ''}">
                        <div class="bp-level">${i}</div>
                        <div class="bp-reward">${i % 5 === 0? '💎' : '🎁'}</div>
                        <div class="bp-reward-name">${i % 5 === 0? `${i*10} Coins` : `${i*5} XP`}</div>
                    </div>
                `;
            }
            container.innerHTML = html;
        },

        buy: () => {
            if (gameState.player?.coins >= 500) {
                socket.emit('buyBattlePass');
            } else {
                Notify.toast('Not enough coins! Need 500', 'error');
            }
        }
    };

    // ============================================
    // 19. UI SYSTEM
    // ============================================
    const UI = {
        showScreen: (screenId) => {
            ['authScreen', 'lobbyScreen', 'matchmakingScreen', 'gameScreen', 'roomScreen'].forEach(id => {
                document.getElementById(id)?.classList.add('hidden');
            });
            document.getElementById(screenId)?.classList.remove('hidden');
        },

        updateLobby: () => {
            if (!gameState.player) return;
            const p = gameState.player;
            if (DOM.playerName) DOM.playerName.textContent = Utils.sanitizeHTML(p.username);
            if (DOM.playerLevel) DOM.playerLevel.textContent = p.level;
            if (DOM.playerCoins) DOM.playerCoins.textContent = p.coins;
            if (DOM.playerWins) DOM.playerWins.textContent = p.wins;
            if (DOM.playerKills) DOM.playerKills.textContent = p.kills;
            if (DOM.playerRank) DOM.playerRank.textContent = p.rank;
            if (DOM.bpLevel) DOM.bpLevel.textContent = p.bpLevel;
            if (DOM.bpXP) DOM.bpXP.style.width = `${(p.bpXP % 100)}%`;
            if (DOM.bpXPText) DOM.bpXPText.textContent = `${p.bpXP % 100}/100 XP`;
            if (p.photo && DOM.playerAvatar) {
                DOM.playerAvatar.style.backgroundImage = `url(${p.photo})`;
                DOM.playerAvatar.style.backgroundSize = 'cover';
            }
            Friends.load();
        },

        updateLeaderboard: () => {
            if (!DOM.lbList) return;
            const sorted = Object.values(gameState.players)
              .filter(p => p.hp > 0)
              .sort((a, b) => (b.kills || 0) - (a.kills || 0))
              .slice(0, 10);

            DOM.lbList.innerHTML = '';
            sorted.forEach((p, i) => {
                const li = document.createElement('li');
                if (p.id === myId) li.classList.add('me');
                li.innerHTML = `
                    <span><span class="rank">#${i + 1}</span> ${Utils.sanitizeHTML(p.username)}</span>
                    <span>${p.kills || 0} 💀</span>
                `;
                DOM.lbList.appendChild(li);
            });
        },

        updateScoreboard: () => {
            if (!DOM.scoreboardBody) return;
            const sorted = Object.values(gameState.players).sort((a, b) => (b.kills || 0) - (a.kills || 0));
            DOM.scoreboardBody.innerHTML = '';
            sorted.forEach(p => {
                const tr = document.createElement('tr');
                if (p.id === myId) tr.classList.add('me');
                tr.innerHTML = `
                    <td>${Utils.sanitizeHTML(p.username)}</td>
                    <td>${p.kills || 0}</td>
                    <td>${p.level || 1}</td>
                    <td>${p.hp > 0? '✅ Alive' : '💀 Dead'}</td>
                `;
                DOM.scoreboardBody.appendChild(tr);
            });
        },

        addKillFeed: (killer, victim, weapon) => {
            if (!DOM.killFeed) return;
            const div = document.createElement('div');
            div.className = 'kill';
            div.innerHTML = `${killer} <span class="weapon">[${Utils.sanitizeHTML(weapon)}]</span> ${victim}`;
            DOM.killFeed.appendChild(div);
            setTimeout(() => div.remove(), 5000);
        },

        showDamageNumber: (x, y, damage, isHeadshot) => {
            if (!DOM.damageNumbers) return;
            const div = document.createElement('div');
            div.className = 'damage' + (isHeadshot? ' headshot' : '');
            div.style.left = `${x - camera.x}px`;
            div.style.top = `${y - camera.y}px`;
            div.style.color = isHeadshot? '#ff0000' : '#ffff00';
            div.textContent = damage;
            DOM.damageNumbers.appendChild(div);
            setTimeout(() => div.remove(), 1000);
        }
    };

    // ============================================
    // 20. PARTICLE SYSTEM
    // ============================================
    const Particles = {
        create: (x, y, type) => {
            const particle = {
                x, y,
                vx: Utils.randomRange(-100, 100),
                vy: Utils.randomRange(-200, -50),
                life: 1.0,
                maxLife: 1.0,
                size: Utils.randomRange(2, 5),
                color: type === 'blood'? '#ff0000' : type === 'explosion'? '#ff8800' : '#ffff00'
            };
            gameState.particles.push(particle);
        },

        update: (dt) => {
            gameState.particles = gameState.particles.filter(p => {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += 300 * dt; // Gravity
                p.life -= dt;
                return p.life > 0;
            });
        },

        render: (ctx) => {
            gameState.particles.forEach(p => {
                ctx.globalAlpha = p.life / p.maxLife;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x - camera.x, p.y - camera.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1.0;
        }
    };

    // ============================================
    // 21. GAME CORE - ASSET LOADING FIX
    // ============================================
    const Game = {
        loadAssets: async () => {
            try {
                if (DOM.loadingText) DOM.loadingText.textContent = 'Loading map data...';

                // Load map.json
                const mapResponse = await fetch('./map.json');
                if (mapResponse.ok) {
                    const mapData = await mapResponse.json();
                    gameState.mapData = mapData;
                    mapTiles = mapData.tiles || [];
                    console.log('✅ Map.json loaded:', mapTiles.length, 'tiles');
                }

                // Load sprite.json
                if (DOM.loadingText) DOM.loadingText.textContent = 'Loading sprites...';
                const spriteResponse = await fetch('./sprite.json');
                if (spriteResponse.ok) {
                    spriteData = await spriteResponse.json();
                    console.log('✅ sprite.json loaded');
                }

                // Load map.png - CRITIQUE FIX
                if (DOM.loadingText) DOM.loadingText.textContent = 'Loading map image...';
                const mapImg = new Image();
                mapImg.src = './map.png';
                await new Promise((resolve) => {
                    mapImg.onload = () => {
                        console.log('✅ map.png loaded:', mapImg.width, 'x', mapImg.height);
                        gameState.mapImage = mapImg;
                        gameState.mapLoaded = true;
                        resolve();
                    };
                    mapImg.onerror = () => {
                        console.error('❌ map.png FAILED - Check raha misy ilay fichier');
                        console.error('URL:', mapImg.src);
                        gameState.mapLoaded = false;
                        resolve(); // Continue without map.png
                    };
                    setTimeout(() => {
                        if (!gameState.mapLoaded) {
                            console.warn('⚠️ map.png timeout - using tiles only');
                            resolve();
                        }
                    }, 5000);
                });

                // Load sprites.png
                if (DOM.loadingText) DOM.loadingText.textContent = 'Loading sprites...';
                spriteImage = new Image();
                spriteImage.src = './sprites.png';
                await new Promise((resolve) => {
                    spriteImage.onload = () => {
                        console.log('✅ sprites.png loaded');
                        gameState.spritesLoaded = true;
                        resolve();
                    };
                    spriteImage.onerror = () => {
                        console.warn('⚠️ sprites.png not found');
                        resolve();
                    };
                    setTimeout(resolve, 3000);
                });

                if (DOM.loadingText) DOM.loadingText.textContent = 'Ready!';
                return true;

            } catch (error) {
                console.error('❌ Error loading assets:', error);
                Notify.show('Failed to load game assets. Check console.', true);
                if (DOM.loadingText) DOM.loadingText.textContent = 'Error loading assets';
                return false;
            }
        },

        init: () => {
            canvas = DOM.game;
            ctx = canvas.getContext('2d');
            minimapCanvas = DOM.minimap;
            minimapCtx = minimapCanvas?.getContext('2d');

            Game.resizeCanvas();
            window.addEventListener('resize', Game.resizeCanvas);

            if (isMobile) {
                Game.setupMobileControls();
            } else {
                Game.setupDesktopControls();
            }

            Audio.init();
            lastFrameTime = performance.now();
            requestAnimationFrame(Game.loop);
        },

        resizeCanvas: () => {
            if (!canvas) return;
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        },

        loop: (currentTime) => {
            if (!gameState.isGameRunning) return;

            const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, 0.1);
            lastFrameTime = currentTime;

            // FPS counter
            frameCount++;
            fpsTime += deltaTime;
            if (fpsTime >= 1.0) {
                gameState.stats.fps = frameCount;
                frameCount = 0;
                fpsTime = 0;
            }

            Game.update(deltaTime);
            Game.render();
            Particles.update(deltaTime);

            requestAnimationFrame(Game.loop);
        },

        update: (dt) => {
            const me = gameState.players[myId];
            if (!me) return;

            // Smooth camera follow
            camera.x = Utils.lerp(camera.x, me.x - canvas.width / 2, 0.1);
            camera.y = Utils.lerp(camera.y, me.y - canvas.height / 2, 0.1);

            // Camera shake
            if (camera.shake > 0) {
                camera.x += Utils.randomRange(-camera.shake, camera.shake);
                camera.y += Utils.randomRange(-camera.shake, camera.shake);
                camera.shake *= 0.9;
            }

            // Update UI
            if (DOM.hp) DOM.hp.textContent = Math.max(0, Math.floor(me.hp));
            if (DOM.hpBar) DOM.hpBar.style.width = `${Utils.clamp(me.hp, 0, 100)}%`;
            if (DOM.armor) DOM.armor.textContent = Math.floor(me.armor || 0);
            if (DOM.armorBar) DOM.armorBar.style.width = `${Utils.clamp(me.armor || 0, 0, 100)}%`;
            if (DOM.weapon) DOM.weapon.textContent = me.weapon || 'Fist';
            if (DOM.ammo) DOM.ammo.textContent = me.ammo === Infinity? '∞' : me.ammo || 0;
            if (DOM.grenades) DOM.grenades.textContent = me.grenades || 0;
            if (DOM.kills) DOM.kills.textContent = me.kills || 0;
            if (DOM.level) DOM.level.textContent = me.level || 1;
            if (DOM.xp) DOM.xp.textContent = `${me.xp || 0}/${(me.level || 1) * 100}`;

            Game.handleInput();
        },

        render: () => {
            if (!ctx) return;

            // Clear
            ctx.fillStyle = '#0a1a0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw map.png - FIX CRITIQUE
            if (gameState.mapImage?.complete && gameState.mapImage.naturalWidth > 0) {
                ctx.drawImage(
                    gameState.mapImage,
                    -camera.x, -camera.y,
                    gameState.mapData.width,
                    gameState.mapData.height
                );
            } else {
                // Fallback: draw tiles
                if (mapTiles.length > 0) {
                    const startX = Math.floor(camera.x / CONFIG.TILE_SIZE) - 1;
                    const startY = Math.floor(camera.y / CONFIG.TILE_SIZE) - 1;
                    const endX = Math.ceil((camera.x + canvas.width) / CONFIG.TILE_SIZE) + 1;
                    const endY = Math.ceil((camera.y + canvas.height) / CONFIG.TILE_SIZE) + 1;
                    const mapCols = gameState.mapData.width / CONFIG.TILE_SIZE;

                    for (let y = Math.max(0, startY); y < Math.min(endY, gameState.mapData.height / CONFIG.TILE_SIZE); y++) {
                        for (let x = Math.max(0, startX); x < Math.min(endX, mapCols); x++) {
                            const tileIndex = y * mapCols + x;
                            if (tileIndex >= 0 && tileIndex < mapTiles.length) {
                                const tile = mapTiles[tileIndex];
                                if (!tile) continue;

                                const drawX = tile.x - camera.x;
                                const drawY = tile.y - camera.y;

                                if (tile.collision) ctx.fillStyle = '#444';
                                else if (tile.swimmable) ctx.fillStyle = '#0088ff';
                                else ctx.fillStyle = '#2a2a2a';
                                ctx.fillRect(drawX, drawY, tile.s, tile.s);
                            }
                        }
                    }
                } else {
                    // Fallback grid
                    ctx.strokeStyle = '#1a3a1a';
                    ctx.lineWidth = 1;
                    for (let x = 0; x < canvas.width; x += 50) {
                        ctx.beginPath();
                        ctx.moveTo(x - (camera.x % 50), 0);
                        ctx.lineTo(x - (camera.x % 50), canvas.height);
                        ctx.stroke();
                    }
                    for (let y = 0; y < canvas.height; y += 50) {
                        ctx.beginPath();
                        ctx.moveTo(0, y - (camera.y % 50));
                        ctx.lineTo(canvas.width, y - (camera.y % 50));
                        ctx.stroke();
                    }
                }
            }

            // Draw zone
            if (gameState.zone) {
                ctx.strokeStyle = '#0088ff';
                ctx.lineWidth = 3;
                ctx.setLineDash([10, 5]);
                ctx.beginPath();
                ctx.arc(gameState.zone.x - camera.x, gameState.zone.y - camera.y, gameState.zone.radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Draw loot
            gameState.loot.forEach(loot => {
                const screenX = loot.x - camera.x;
                const screenY = loot.y - camera.y;
                if (screenX < -50 || screenX > canvas.width + 50 || screenY < -50 || screenY > canvas.height + 50) return;

                ctx.fillStyle = '#ffff00';
                ctx.fillRect(screenX - 10, screenY - 10, 20);
                ctx.fillStyle = '#000';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(loot.type.split('_')[1] || 'ITEM', screenX, screenY + 3);
            });

            // Draw vehicles
            gameState.vehicles.forEach(vehicle => {
                const screenX = vehicle.x - camera.x;
                const screenY = vehicle.y - camera.y;
                if (screenX < -50 || screenX > canvas.width + 50 || screenY < -50 || screenY > canvas.height + 50) return;

                ctx.save();
                ctx.translate(screenX, screenY);
                ctx.rotate(vehicle.angle || 0);
                ctx.fillStyle = vehicle.driver? '#ff8800' : '#888888';
                ctx.fillRect(-30, -20, 60, 40);
                ctx.restore();
            });

            // Draw bullets
            gameState.bullets.forEach(bullet => {
                const screenX = bullet.x - camera.x;
                const screenY = bullet.y - camera.y;
                if (screenX < -10 || screenX > canvas.width + 10 || screenY < -10 || screenY > canvas.height + 10) return;

                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
                ctx.fill();
            });

            // Draw players
            Object.values(gameState.players).forEach(p => {
                if (p.hp <= 0) return;
                const x = p.x - camera.x;
                const y = p.y - camera.y;
                if (x < -50 || x > canvas.width + 50 || y < -50 || y > canvas.height + 50) return;

                const isMe = p.id === myId;

                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                ctx.ellipse(x, y + 15, 15, 8, 0, Math.PI * 2);
                ctx.fill();

                // Body
                ctx.fillStyle = isMe? gameState.player.skin.color : '#ff4444';
                ctx.fillRect(x - 12, y - 12, 24, 24);

                // Hat
                if (p.skin?.hat && p.skin.hat!== 'none') {
                    ctx.font = '20px Arial';
                    const hatEmoji = { crown: '👑', helmet: '🪖', cap: '🧢', viking: '🪖', wizard: '🧙' }[p.skin.hat];
                    if (hatEmoji) ctx.fillText(hatEmoji, x - 10, y - 15);
                }

                // Name & HP
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(Utils.sanitizeHTML(p.username), x, y - 25);

                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(x - 20, y - 20, 40, 4);
                ctx.fillStyle = p.hp > 50? '#00ff00' : p.hp > 25? '#ffff00' : '#ff0000';
                ctx.fillRect(x - 20, y - 20, 40 * (p.hp / 100), 4);

                // Armor bar
                if (p.armor > 0) {
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.fillRect(x - 20, y - 26, 40, 3);
                    ctx.fillStyle = '#00aaff';
                    ctx.fillRect(x - 20, y - 26, 40 * (p.armor / 100), 3);
                }

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

            // Draw particles
            Particles.render(ctx);

            // Draw minimap
            Game.renderMinimap();
        },

                renderMinimap: () => {
            if (!minimapCtx ||!minimapCanvas) return;
            minimapCtx.fillStyle = '#000';
            minimapCtx.fillRect(0, 0, 180, 180);

            const scale = 180 / gameState.mapData.width;

            // Draw zone
            if (gameState.zone) {
                minimapCtx.strokeStyle = '#0088ff';
                minimapCtx.lineWidth = 2;
                minimapCtx.beginPath();
                minimapCtx.arc(gameState.zone.x * scale, gameState.zone.y * scale, gameState.zone.radius * scale, 0, Math.PI * 2);
                minimapCtx.stroke();

                // Safe zone
                minimapCtx.strokeStyle = '#00ff00';
                minimapCtx.setLineDash([5, 5]);
                minimapCtx.beginPath();
                minimapCtx.arc(gameState.zone.x * scale, gameState.zone.y * scale, gameState.zone.targetRadius * scale, 0, Math.PI * 2);
                minimapCtx.stroke();
                minimapCtx.setLineDash([]);
            }

            // Draw players
            Object.values(gameState.players).forEach(p => {
                if (p.hp <= 0) return;
                minimapCtx.fillStyle = p.id === myId? '#00ff00' : '#ff0000';
                minimapCtx.beginPath();
                minimapCtx.arc(p.x * scale, p.y * scale, p.id === myId? 4 : 3, 0, Math.PI * 2);
                minimapCtx.fill();
            });

            // Draw loot
            gameState.loot.forEach(loot => {
                minimapCtx.fillStyle = '#ffff00';
                minimapCtx.fillRect(loot.x * scale - 1, loot.y * scale - 1, 2, 2);
            });
        },

        handleInput: () => {
            if (!gameState.isGameRunning) return;

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

            // Normalize diagonal movement
            if (moveX!== 0 && moveY!== 0) {
                moveX *= 0.707;
                moveY *= 0.707;
            }

            const now = Date.now();
            if (now - lastMoveEmit > MOVE_THROTTLE) {
                socket.emit('move', {
                    x: moveX,
                    y: moveY,
                    angle: mouseAngle,
                    sprint: keys['shift'] || false
                });
                lastMoveEmit = now;
            }
        },

        setupDesktopControls: () => {
            window.addEventListener('keydown', (e) => {
                keys[e.key.toLowerCase()] = true;
                if (e.key === 'Tab') {
                    e.preventDefault();
                    DOM.scoreboard?.classList.toggle('hidden');
                }
                if (e.key === 'm' || e.key === 'M') DOM.skinMenu?.classList.toggle('hidden');
                if (e.key === 'b' || e.key === 'B') BattlePass.open();
                if (e.key === 'i' || e.key === 'I') DOM.inventoryMenu?.classList.toggle('hidden');
                if (e.key === 'p' || e.key === 'P') DOM.shopMenu?.classList.toggle('hidden');
                if (e.key === 'r' || e.key === 'R') socket.emit('reload');
                if (e.key === 'g' || e.key === 'G') socket.emit('grenade', { angle: mouseAngle });
                if (e.key === 'f' || e.key === 'F') socket.emit('interact');
                if (e.key === 'e' || e.key === 'E') socket.emit('enterVehicle');
                if (e.key === 'q' || e.key === 'Q') {
                    const me = gameState.players[myId];
                    if (me) {
                        const weapons = ['fist', 'pistol', 'shotgun', 'smg', 'rifle', 'sniper'];
                        const idx = weapons.indexOf(me.weapon);
                        const nextWeapon = weapons[(idx + 1) % weapons.length];
                        socket.emit('switchWeapon', nextWeapon);
                    }
                }
                if (e.key >= '1' && e.key <= '6') {
                    const weapons = ['fist', 'pistol', 'shotgun', 'smg', 'rifle', 'sniper'];
                    socket.emit('switchWeapon', weapons[parseInt(e.key) - 1]);
                }
            });

            window.addEventListener('keyup', (e) => {
                keys[e.key.toLowerCase()] = false;
            });

            canvas?.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                const me = gameState.players[myId];
                if (!me) return;
                const dx = e.clientX - rect.left - canvas.width / 2;
                const dy = e.clientY - rect.top - canvas.height / 2;
                mouseAngle = Math.atan2(dy, dx);
            });

            canvas?.addEventListener('mousedown', (e) => {
                if (e.button === 0) socket.emit('shoot', { angle: mouseAngle });
                if (e.button === 2) socket.emit('scope', true);
            });

            canvas?.addEventListener('mouseup', (e) => {
                if (e.button === 2) socket.emit('scope', false);
            });

            canvas?.addEventListener('contextmenu', (e) => e.preventDefault());

            // Wheel to switch weapons
            canvas?.addEventListener('wheel', (e) => {
                e.preventDefault();
                const me = gameState.players[myId];
                if (!me) return;
                const weapons = ['fist', 'pistol', 'shotgun', 'smg', 'rifle', 'sniper'];
                const idx = weapons.indexOf(me.weapon);
                const nextIdx = e.deltaY > 0? (idx + 1) % weapons.length : (idx - 1 + weapons.length) % weapons.length;
                socket.emit('switchWeapon', weapons[nextIdx]);
            });
        },

        setupMobileControls: () => {
            DOM.mobileControls?.classList.remove('hidden');

            DOM.joystick?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                joystickActive = true;
            });

            DOM.joystick?.addEventListener('touchmove', (e) => {
                if (!joystickActive) return;
                e.preventDefault();
                const touch = e.touches[0];
                const rect = DOM.joystick.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                let dx = touch.clientX - cx;
                let dy = touch.clientY - cy;
                const dist = Math.min(Utils.getDistance(0, 0, dx, dy), 40);
                const angle = Math.atan2(dy, dx);
                dx = Math.cos(angle) * dist;
                dy = Math.sin(angle) * dist;
                joystickPos = { x: dx / 40, y: dy / 40 };
                if (DOM.joystickKnob) DOM.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            });

            DOM.joystick?.addEventListener('touchend', (e) => {
                e.preventDefault();
                joystickActive = false;
                joystickPos = { x: 0, y: 0 };
                if (DOM.joystickKnob) DOM.joystickKnob.style.transform = 'translate(-50%, -50%)';
            });

            DOM.shootBtn?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (touchShootInterval) clearInterval(touchShootInterval);
                socket.emit('shoot', { angle: mouseAngle });
                touchShootInterval = setInterval(() => socket.emit('shoot', { angle: mouseAngle }), 100);
            });

            DOM.shootBtn?.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (touchShootInterval) {
                    clearInterval(touchShootInterval);
                    touchShootInterval = null;
                }
            });

            DOM.scopeBtn?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                socket.emit('scope', true);
            });

            DOM.scopeBtn?.addEventListener('touchend', (e) => {
                e.preventDefault();
                socket.emit('scope', false);
            });

            DOM.lootBtn?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                socket.emit('interact');
            });

            DOM.sprintBtn?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                keys['shift'] = true;
            });

            DOM.sprintBtn?.addEventListener('touchend', (e) => {
                e.preventDefault();
                keys['shift'] = false;
            });

            DOM.grenadeBtn?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                socket.emit('grenade', { angle: mouseAngle });
            });

            DOM.vehicleBtn?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                socket.emit('enterVehicle');
            });

            DOM.reloadBtn?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                socket.emit('reload');
            });
        },

        addParticle: (x, y, type) => {
            Particles.create(x, y, type);
        },

        levelUpCheck: () => {
            if (!gameState.player) return;
            const xpNeeded = gameState.player.level * 100;
            while (gameState.player.xp >= xpNeeded) {
                gameState.player.xp -= xpNeeded;
                gameState.player.level++;
                Notify.show(`LEVEL UP! You are now level ${gameState.player.level}`);
                Audio.play('victory');
            }
            gameState.player.bpXP += 10;
            if (gameState.player.bpXP >= 100) {
                gameState.player.bpXP = 0;
                gameState.player.bpLevel++;
                Notify.show(`Battle Pass Level ${gameState.player.bpLevel} unlocked!`);
            }
            UI.updateLobby();
        }
    };

    // ============================================
    // 22. AI SYSTEM - DYNAMIC DIFFICULTY
    // ============================================
    class AIPlayer {
        constructor(id, spawnX, spawnY, targetPlayerLevel = 1) {
            this.id = id;
            this.name = this.generateBotName();
            this.x = spawnX;
            this.y = spawnY;
            this.hp = 100;
            this.armor = 0;
            this.weapon = 'fist';
            this.ammo = 0;
            this.grenades = 0;
            this.kills = 0;
            this.level = Math.max(1, targetPlayerLevel + Utils.randomInt(-2, 2));
            this.angle = 0;
            this.targetAngle = 0;
            this.username = this.name;

            // Dynamic difficulty
            this.playerLevel = targetPlayerLevel;
            this.difficulty = this.calculateDifficulty();
            this.reactionTime = this.getReactionTime();
            this.accuracy = this.getAccuracy();
            this.aggressiveness = this.getAggressiveness();
            this.lootPriority = 0.7;
            this.survivalInstinct = 0.8;

            // State Machine
            this.state = 'looting';
            this.stateTimer = 0;
            this.target = null;
            this.lastSeenEnemy = null;
            this.lastSeenTime = 0;
            this.memory = [];

            // Movement
            this.velocityX = 0;
            this.velocityY = 0;
            this.moveTarget = null;
            this.stuckTimer = 0;
            this.lastPosition = { x: spawnX, y: spawnY };

            // Combat
            this.lastShotTime = 0;
            this.fireRate = this.getFireRate();
            this.reloadTime = 0;
            this.isReloading = false;
            this.lastDamageTime = 0;
            this.dodgeDirection = 0;

            // Strategy
            this.preferredRange = this.getPreferredRange();
            this.zoneAwareness = 0.9;
            this.teamwork = false;

            // Personality
            this.personality = this.generatePersonality();
            this.skin = {
                color: this.getRandomColor(),
                hat: this.getRandomHat()
            };
        }

        calculateDifficulty() {
            if (this.level <= 5) return 'easy';
            if (this.level <= 15) return 'medium';
            if (this.level <= 30) return 'hard';
            return 'pro';
        }

        generateBotName() {
            const names = [
                'ShadowHunter', 'ProSniper', 'EliteWarrior', 'NightStalker', 'ThunderBolt',
                'CrimsonViper', 'IronFist', 'GhostRider', 'PhoenixRising', 'WolfPack',
                'StormBreaker', 'DarkKnight', 'SilentAssassin', 'FireDragon', 'IceQueen',
                'BloodEagle', 'SteelTitan', 'RapidFire', 'DeathDealer', 'KingSlayer'
            ];
            const suffix = this.level > 20? 'Elite' : this.level > 10? 'Pro' : '';
            return names[Utils.randomInt(0, names.length - 1)] + suffix + Utils.randomInt(1, 99);
        }

        getReactionTime() {
            const base = { easy: 500, medium: 300, hard: 200, pro: 100 };
            const bonus = Math.max(0, 50 - this.playerLevel * 2);
            return Math.max(50, base[this.difficulty] - bonus);
        }

        getAccuracy() {
            const base = { easy: 0.4, medium: 0.65, hard: 0.8, pro: 0.95 };
            const bonus = Math.min(0.2, this.playerLevel * 0.01);
            return Math.min(0.98, base[this.difficulty] + bonus);
        }

        getAggressiveness() {
            const base = { easy: 0.3, medium: 0.6, hard: 0.8, pro: 0.95 };
            const bonus = Math.min(0.15, this.playerLevel * 0.005);
            return Math.min(0.98, base[this.difficulty] + bonus);
        }

        getFireRate() {
            const rates = {
                'pistol': 400, 'shotgun': 800, 'smg': 100,
                'rifle': 150, 'sniper': 1200, 'fist': 600
            };
            let rate = rates[this.weapon] || 400;
            rate = Math.max(50, rate - this.playerLevel * 3);
            return rate;
        }

        getPreferredRange() {
            const ranges = {
                'shotgun': 80, 'smg': 150, 'pistol': 200,
                'rifle': 300, 'sniper': 500, 'fist': 30
            };
            return ranges[this.weapon] || 200;
        }

        getRandomColor() {
            if (this.level > 30) {
                const proColors = ['#ff0000', '#ff00ff', '#00ffff', '#ffd700', '#ff6600'];
                return proColors[Utils.randomInt(0, proColors.length - 1)];
            }
            const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ff8800'];
            return colors[Utils.randomInt(0, colors.length - 1)];
        }

        getRandomHat() {
            if (this.level > 25) {
                const proHats = ['crown', 'viking', 'wizard'];
                return proHats[Utils.randomInt(0, proHats.length - 1)];
            }
            if (this.level > 10) {
                const midHats = ['helmet', 'cowboy', 'tophat'];
                return midHats[Utils.randomInt(0, midHats.length - 1)];
            }
            const hats = ['none', 'cap', 'helmet'];
            return hats[Utils.randomInt(0, hats.length - 1)];
        }

        generatePersonality() {
            const levelFactor = Math.min(1, this.playerLevel / 50);
            return {
                camper: Math.random() < (0.3 - levelFactor * 0.1),
                rusher: Math.random() < (0.2 + levelFactor * 0.3),
                sniper: Math.random() < (0.15 + levelFactor * 0.2),
                looter: Math.random() < (0.5 - levelFactor * 0.2),
                cautious: Math.random() < (0.4 - levelFactor * 0.2)
            };
        }

        calculatePower() {
            let power = 0;
            power += this.hp / 100 * 0.4;
            power += this.armor / 100 * 0.3;
            power += this.accuracy * 0.2;
            power += (this.weapon!== 'fist')? 0.3 : 0;
            power += this.kills * 0.05;
            power += this.level * 0.02;
            return Math.min(1, power);
        }

        calculateThreat(enemy) {
            if (!enemy) return 0;
            let threat = 0;
            threat += (enemy.hp || 100) / 100 * 0.4;
            threat += (enemy.armor || 0) / 100 * 0.3;
            threat += (enemy.weapon!== 'fist')? 0.3 : 0;
            return threat;
        }

        shouldEngage(enemy) {
            if (!enemy) return false;
            const myPower = this.calculatePower();
            const enemyPower = this.calculateThreat(enemy.entity);
            const dist = enemy.distance;
            const confidenceBoost = this.level * 0.01;

            if (myPower + confidenceBoost < 0.3) return false;
            if (enemyPower > myPower * 1.5) return false;
            if (this.aggressiveness > 0.7) return true;
            if (dist < this.preferredRange * 1.2 && dist > this.preferredRange * 0.5) return true;
            return myPower > enemyPower;
        }

        update(dt, gameState, players) {
            this.stateTimer += dt;

            if (this.memory.length > 10) this.memory.shift();

            const me = { x: this.x, y: this.y, hp: this.hp, id: this.id };
            const enemies = Object.values(players).filter(p => p.id!== this.id && p.hp > 0);

            // Find nearest enemy
            let nearestEnemy = null;
            let nearestDist = Infinity;
            enemies.forEach(enemy => {
                const dist = Utils.getDistance(this.x, this.y, enemy.x, enemy.y);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestEnemy = { entity: enemy, distance: dist };
                }
            });

            // State machine
            if (this.hp < 30 && this.survivalInstinct > 0.5) {
                this.state = 'fleeing';
            } else if (nearestEnemy && this.shouldEngage(nearestEnemy)) {
                this.state = 'combat';
                this.target = nearestEnemy;
            } else if (this.lootPriority > 0.5) {
                this.state = 'looting';
            } else {
                this.state = 'roaming';
            }

            this.executeState(dt, gameState, nearestEnemy);
        }

        executeState(dt, gameState, enemy) {
            switch (this.state) {
                case 'combat':
                    this.combatBehavior(dt, enemy);
                    break;
                case 'fleeing':
                    this.fleeBehavior(dt, gameState);
                    break;
                case 'looting':
                    this.lootBehavior(dt, gameState);
                    break;
                default:
                    this.roamBehavior(dt, gameState);
            }
        }

        combatBehavior(dt, enemy) {
            if (!enemy) return;
            const dx = enemy.entity.x - this.x;
            const dy = enemy.entity.y - this.y;
            this.targetAngle = Math.atan2(dy, dx);

            // Move to preferred range
            const dist = enemy.distance;
            if (dist > this.preferredRange * 1.2) {
                this.velocityX = Math.cos(this.targetAngle) * 200 * dt;
                this.velocityY = Math.sin(this.targetAngle) * 200 * dt;
            } else if (dist < this.preferredRange * 0.8) {
                this.velocityX = -Math.cos(this.targetAngle) * 200 * dt;
                this.velocityY = -Math.sin(this.targetAngle) * 200 * dt;
            }

            // Strafe
            if (Math.random() < 0.3) {
                const strafeAngle = this.targetAngle + Math.PI / 2 * (Math.random() < 0.5? 1 : -1);
                this.velocityX += Math.cos(strafeAngle) * 100 * dt;
                this.velocityY += Math.sin(strafeAngle) * 100 * dt;
            }

            // Shoot
            const now = Date.now();
            if (now - this.lastShotTime > this.fireRate) {
                if (Math.random() < this.accuracy) {
                    socket.emit('shoot', { angle: this.targetAngle, botId: this.id });
                }
                this.lastShotTime = now;
            }

            this.x += this.velocityX;
            this.y += this.velocityY;
        }

        fleeBehavior(dt, gameState) {
            const zoneAngle = Math.atan2(gameState.zone.y - this.y, gameState.zone.x - this.x);
            this.velocityX = Math.cos(zoneAngle) * 300 * dt;
            this.velocityY = Math.sin(zoneAngle) * 300 * dt;
            this.x += this.velocityX;
            this.y += this.velocityY;
        }

        lootBehavior(dt, gameState) {
            if (gameState.loot.length > 0) {
                const nearestLoot = gameState.loot.reduce((closest, loot) => {
                    const dist = Utils.getDistance(this.x, this.y, loot.x, loot.y);
                    return dist < closest.dist? { loot, dist } : closest;
                }, { loot: null, dist: Infinity });

                if (nearestLoot.loot) {
                    const angle = Math.atan2(nearestLoot.loot.y - this.y, nearestLoot.loot.x - this.x);
                    this.velocityX = Math.cos(angle) * 250 * dt;
                    this.velocityY = Math.sin(angle) * 250 * dt;
                    this.x += this.velocityX;
                    this.y += this.velocityY;
                }
            }
        }

        roamBehavior(dt, gameState) {
            if (!this.moveTarget || Utils.getDistance(this.x, this.y, this.moveTarget.x, this.moveTarget.y) < 50) {
                this.moveTarget = {
                    x: Utils.randomRange(100, gameState.mapData.width - 100),
                    y: Utils.randomRange(100, gameState.mapData.height - 100)
                };
            }
            const angle = Math.atan2(this.moveTarget.y - this.y, this.moveTarget.x - this.x);
            this.velocityX = Math.cos(angle) * 150 * dt;
            this.velocityY = Math.sin(angle) * 150 * dt;
            this.x += this.velocityX;
            this.y += this.velocityY;
        }

        serialize() {
            return {
                id: this.id,
                name: this.name,
                username: this.name,
                x: this.x,
                y: this.y,
                hp: this.hp,
                armor: this.armor,
                weapon: this.weapon,
                kills: this.kills,
                level: this.level,
                angle: this.targetAngle,
                skin: this.skin,
                isBot: true
            };
        }
    }

    class AIManager {
        constructor() {
            this.bots = new Map();
            this.maxBots = 20;
            this.spawnTimer = 0;
            this.spawnInterval = 5;
        }

        update(dt, gameState, players) {
            this.spawnTimer += dt;
            if (this.spawnTimer > this.spawnInterval) {
                this.trySpawnBot(gameState, players);
                this.spawnTimer = 0;
            }

            this.bots.forEach(bot => {
                if (bot.hp > 0) {
                    bot.update(dt, gameState, players);
                } else {
                    this.bots.delete(bot.id);
                }
            });
        }

        trySpawnBot(gameState, players) {
            const realPlayers = Object.values(players).filter(p =>!p.isBot);
            if (realPlayers.length === 0) return;

            const avgLevel = realPlayers.reduce((sum, p) => sum + (p.level || 1), 0) / realPlayers.length;
            const targetLevel = Math.floor(avgLevel);

            const realPlayerCount = realPlayers.length;
            const targetBotCount = Math.max(0, 50 - realPlayerCount);

            if (this.bots.size >= targetBotCount || this.bots.size >= this.maxBots) {
                return;
            }

            const spawn = this.findSpawnLocation(gameState, players);
            if (!spawn) return;

            const botId = 'bot_' + Date.now() + '_' + Math.random();
            const bot = new AIPlayer(botId, spawn.x, spawn.y, targetLevel);
            this.bots.set(botId, bot);
            console.log(`🤖 Spawned Level ${bot.level} bot: ${bot.name} (${bot.difficulty})`);
        }

        findSpawnLocation(gameState, players) {
            const attempts = 20;
            const minDistFromPlayers = 300;
            const mapWidth = gameState.mapData.width;
            const mapHeight = gameState.mapData.height;

            for (let i = 0; i < attempts; i++) {
                const x = Utils.randomRange(100, mapWidth - 100);
                const y = Utils.randomRange(100, mapHeight - 100);

                let tooClose = false;
                Object.values(players).forEach(player => {
                    const dist = Utils.getDistance(x, y, player.x, player.y);
                    if (dist < minDistFromPlayers) tooClose = true;
                });

                if (!tooClose) {
                    const zoneDist = Utils.getDistance(x, y, gameState.zone.x, gameState.zone.y);
                    if (zoneDist < gameState.zone.radius * 0.8) {
                        return { x, y };
                    }
                }
            }
            return { x: gameState.zone.x, y: gameState.zone.y };
        }

        getAllBots() {
            return Array.from(this.bots.values()).map(bot => bot.serialize());
        }

        getBot(id) {
            return this.bots.get(id);
        }

        removeBot(id) {
            this.bots.delete(id);
        }
    }

     // ============================================
    // 23. GAME CORE - COMPLETE
    // ============================================
    const Game = {
        init: async () => {
            canvas = DOM.game;
            ctx = canvas.getContext('2d');
            minimapCanvas = DOM.minimap;
            minimapCtx = minimapCanvas?.getContext('2d');

            Game.resizeCanvas();
            window.addEventListener('resize', Game.resizeCanvas);

            if (isMobile) {
                Game.setupMobileControls();
            } else {
                Game.setupDesktopControls();
            }

            Audio.init();

            // Load assets alohan'ny hanombohana
            const loaded = await Game.loadAssets();
            if (!loaded) {
                Notify.show('Failed to load game assets', true);
                return;
            }

            lastFrameTime = performance.now();
            requestAnimationFrame(Game.loop);
        },

        resizeCanvas: () => {
            if (!canvas) return;
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        },

        loop: (currentTime) => {
            if (!gameState.isGameRunning) return;

            const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, 0.1);
            lastFrameTime = currentTime;

            // FPS counter
            frameCount++;
            fpsTime += deltaTime;
            if (fpsTime >= 1.0) {
                gameState.stats.fps = frameCount;
                frameCount = 0;
                fpsTime = 0;
            }

            Game.update(deltaTime);
            Game.render();
            Particles.update(deltaTime);

            requestAnimationFrame(Game.loop);
        },

        update: (dt) => {
            const me = gameState.players[myId];
            if (!me) return;

            // Smooth camera follow
            camera.x = Utils.lerp(camera.x, me.x - canvas.width / 2, 0.1);
            camera.y = Utils.lerp(camera.y, me.y - canvas.height / 2, 0.1);

            // Camera shake
            if (camera.shake > 0) {
                camera.x += Utils.randomRange(-camera.shake, camera.shake);
                camera.y += Utils.randomRange(-camera.shake, camera.shake);
                camera.shake *= 0.9;
            }

            // Update UI
            if (DOM.hp) DOM.hp.textContent = Math.max(0, Math.floor(me.hp));
            if (DOM.hpBar) DOM.hpBar.style.width = `${Utils.clamp(me.hp, 0, 100)}%`;
            if (DOM.armor) DOM.armor.textContent = Math.floor(me.armor || 0);
            if (DOM.armorBar) DOM.armorBar.style.width = `${Utils.clamp(me.armor || 0, 0, 100)}%`;
            if (DOM.weapon) DOM.weapon.textContent = me.weapon || 'Fist';
            if (DOM.ammo) DOM.ammo.textContent = me.ammo === Infinity? '∞' : me.ammo || 0;
            if (DOM.grenades) DOM.grenades.textContent = me.grenades || 0;
            if (DOM.kills) DOM.kills.textContent = me.kills || 0;
            if (DOM.level) DOM.level.textContent = me.level || 1;
            if (DOM.xp) DOM.xp.textContent = `${me.xp || 0}/${(me.level || 1) * 100}`;

            Game.handleInput();

            // Update AI
            if (window.aiManager) {
                window.aiManager.update(dt, gameState, gameState.players);
            }
        },

        render: () => {
            if (!ctx) return;

            // Clear
            ctx.fillStyle = '#0a1a0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw map.png - FIX CRITIQUE
            if (gameState.mapImage?.complete && gameState.mapImage.naturalWidth > 0) {
                ctx.drawImage(
                    gameState.mapImage,
                    -camera.x, -camera.y,
                    gameState.mapData.width,
                    gameState.mapData.height
                );
            } else {
                // Fallback: draw tiles
                if (mapTiles.length > 0) {
                    const startX = Math.floor(camera.x / CONFIG.TILE_SIZE) - 1;
                    const startY = Math.floor(camera.y / CONFIG.TILE_SIZE) - 1;
                    const endX = Math.ceil((camera.x + canvas.width) / CONFIG.TILE_SIZE) + 1;
                    const endY = Math.ceil((camera.y + canvas.height) / CONFIG.TILE_SIZE) + 1;
                    const mapCols = gameState.mapData.width / CONFIG.TILE_SIZE;

                    for (let y = Math.max(0, startY); y < Math.min(endY, gameState.mapData.height / CONFIG.TILE_SIZE); y++) {
                        for (let x = Math.max(0, startX); x < Math.min(endX, mapCols); x++) {
                            const tileIndex = y * mapCols + x;
                            if (tileIndex >= 0 && tileIndex < mapTiles.length) {
                                const tile = mapTiles[tileIndex];
                                if (!tile) continue;

                                const drawX = tile.x - camera.x;
                                const drawY = tile.y - camera.y;

                                if (tile.collision) ctx.fillStyle = '#444';
                                else if (tile.swimmable) ctx.fillStyle = '#0088ff';
                                else ctx.fillStyle = '#2a2a2a';
                                ctx.fillRect(drawX, drawY, tile.s, tile.s);
                            }
                        }
                    }
                } else {
                    // Fallback grid
                    ctx.strokeStyle = '#1a3a1a';
                    ctx.lineWidth = 1;
                    for (let x = 0; x < canvas.width; x += 50) {
                        ctx.beginPath();
                        ctx.moveTo(x - (camera.x % 50), 0);
                        ctx.lineTo(x - (camera.x % 50), canvas.height);
                        ctx.stroke();
                    }
                    for (let y = 0; y < canvas.height; y += 50) {
                        ctx.beginPath();
                        ctx.moveTo(0, y - (camera.y % 50));
                        ctx.lineTo(canvas.width, y - (camera.y % 50));
                        ctx.stroke();
                    }
                }
            }

            // Draw zone
            if (gameState.zone) {
                ctx.strokeStyle = '#0088ff';
                ctx.lineWidth = 3;
                ctx.setLineDash([10, 5]);
                ctx.beginPath();
                ctx.arc(gameState.zone.x - camera.x, gameState.zone.y - camera.y, gameState.zone.radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);

                // Safe zone
                ctx.strokeStyle = '#00ff00';
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(gameState.zone.x - camera.x, gameState.zone.y - camera.y, gameState.zone.targetRadius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Draw loot
            gameState.loot.forEach(loot => {
                const screenX = loot.x - camera.x;
                const screenY = loot.y - camera.y;
                if (screenX < -50 || screenX > canvas.width + 50 || screenY < -50 || screenY > canvas.height + 50) return;

                ctx.fillStyle = '#ffff00';
                ctx.fillRect(screenX - 10, screenY - 10, 20, 20);
                ctx.fillStyle = '#000';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(loot.type.split('_')[1] || 'ITEM', screenX, screenY + 3);
            });

            // Draw vehicles
            gameState.vehicles.forEach(vehicle => {
                const screenX = vehicle.x - camera.x;
                const screenY = vehicle.y - camera.y;
                if (screenX < -50 || screenX > canvas.width + 50 || screenY < -50 || screenY > canvas.height + 50) return;

                ctx.save();
                ctx.translate(screenX, screenY);
                ctx.rotate(vehicle.angle || 0);
                ctx.fillStyle = vehicle.driver? '#ff8800' : '#888888';
                ctx.fillRect(-30, -20, 60, 40);
                ctx.restore();
            });

            // Draw bullets
            gameState.bullets.forEach(bullet => {
                const screenX = bullet.x - camera.x;
                const screenY = bullet.y - camera.y;
                if (screenX < -10 || screenX > canvas.width + 10 || screenY < -10 || screenY > canvas.height + 10) return;

                ctx.fillStyle = '#ffff00';
                ctx.beginPath();
                ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
                ctx.fill();
            });

            // Draw players
            Object.values(gameState.players).forEach(p => {
                if (p.hp <= 0) return;
                const x = p.x - camera.x;
                const y = p.y - camera.y;
                if (x < -50 || x > canvas.width + 50 || y < -50 || y > canvas.height + 50) return;

                const isMe = p.id === myId;

                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                ctx.ellipse(x, y + 15, 15, 8, 0, Math.PI * 2);
                ctx.fill();

                // Body
                ctx.fillStyle = isMe? gameState.player.skin.color : '#ff4444';
                ctx.fillRect(x - 12, y - 12, 24);

                // Hat
                if (p.skin?.hat && p.skin.hat!== 'none') {
                    ctx.font = '20px Arial';
                    const hatEmoji = { crown: '👑', helmet: '🪖', cap: '🧢', viking: '🪖', wizard: '🧙' }[p.skin.hat];
                    if (hatEmoji) ctx.fillText(hatEmoji, x - 10, y - 15);
                }

                // Name & HP
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(Utils.sanitizeHTML(p.username), x, y - 25);

                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(x - 20, y - 20, 40, 4);
                ctx.fillStyle = p.hp > 50? '#00ff00' : p.hp > 25? '#ffff00' : '#ff0000';
                ctx.fillRect(x - 20, y - 20, 40 * (p.hp / 100), 4);

                // Armor bar
                if (p.armor > 0) {
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.fillRect(x - 20, y - 26, 40, 3);
                    ctx.fillStyle = '#00aaff';
                    ctx.fillRect(x - 20, y - 26, 40 * (p.armor / 100), 3);
                }

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

            // Draw particles
            Particles.render(ctx);

            // Draw minimap
            Game.renderMinimap();

            // Draw FPS/Ping
            if (DOM.fps) DOM.fps.textContent = gameState.stats.fps;
            if (DOM.ping) DOM.ping.textContent = gameState.stats.ping;
        },

        renderMinimap: () => {
            if (!minimapCtx ||!minimapCanvas) return;
            minimapCtx.fillStyle = '#000';
            minimapCtx.fillRect(0, 0, 180, 180);

            const scale = 180 / gameState.mapData.width;

            // Draw zone
            if (gameState.zone) {
                minimapCtx.strokeStyle = '#0088ff';
                minimapCtx.lineWidth = 2;
                minimapCtx.beginPath();
                minimapCtx.arc(gameState.zone.x * scale, gameState.zone.y * scale, gameState.zone.radius * scale, 0, Math.PI * 2);
                minimapCtx.stroke();

                minimapCtx.strokeStyle = '#00ff00';
                minimapCtx.setLineDash([5, 5]);
                minimapCtx.beginPath();
                minimapCtx.arc(gameState.zone.x * scale, gameState.zone.y * scale, gameState.zone.targetRadius * scale, 0, Math.PI * 2);
                minimapCtx.stroke();
                minimapCtx.setLineDash([]);
            }

            // Draw players
            Object.values(gameState.players).forEach(p => {
                if (p.hp <= 0) return;
                minimapCtx.fillStyle = p.id === myId? '#00ff00' : '#ff0000';
                minimapCtx.beginPath();
                minimapCtx.arc(p.x * scale, p.y * scale, p.id === myId? 4 : 3, 0, Math.PI * 2);
                minimapCtx.fill();
            });

            // Draw loot
            gameState.loot.forEach(loot => {
                minimapCtx.fillStyle = '#ffff00';
                minimapCtx.fillRect(loot.x * scale - 1, loot.y * scale - 1, 2, 2);
            });
        },

        handleInput: () => {
            if (!gameState.isGameRunning) return;

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

            // Normalize diagonal movement
            if (moveX!== 0 && moveY!== 0) {
                moveX *= 0.707;
                moveY *= 0.707;
            }

            const now = Date.now();
            if (now - lastMoveEmit > MOVE_THROTTLE) {
                socket.emit('move', {
                    x: moveX,
                    y: moveY,
                    angle: mouseAngle,
                    sprint: keys['shift'] || false
                });
                lastMoveEmit = now;
            }
        },

        setupDesktopControls: () => {
            window.addEventListener('keydown', (e) => {
                keys[e.key.toLowerCase()] = true;
                if (e.key === 'Tab') {
                    e.preventDefault();
                    DOM.scoreboard?.classList.toggle('hidden');
                }
                if (e.key === 'm' || e.key === 'M') DOM.skinMenu?.classList.toggle('hidden');
                if (e.key === 'b' || e.key === 'B') BattlePass.open();
                if (e.key === 'i' || e.key === 'I') DOM.inventoryMenu?.classList.toggle('hidden');
                if (e.key === 'p' || e.key === 'P') DOM.shopMenu?.classList.toggle('hidden');
                if (e.key === 'r' || e.key === 'R') socket.emit('reload');
                if (e.key === 'g' || e.key === 'G') socket.emit('grenade', { angle: mouseAngle });
                if (e.key === 'f' || e.key === 'F') socket.emit('interact');
                if (e.key === 'e' || e.key === 'E') socket.emit('enterVehicle');
                if (e.key === 'q' || e.key === 'Q') {
                    const me = gameState.players[myId];
                    if (me) {
                        const weapons = ['fist', 'pistol', 'shotgun', 'smg', 'rifle', 'sniper'];
                        const idx = weapons.indexOf(me.weapon);
                        const nextWeapon = weapons[(idx + 1) % weapons.length];
                        socket.emit('switchWeapon', nextWeapon);
                    }
                }
                if (e.key >= '1' && e.key <= '6') {
                    const weapons = ['fist', 'pistol', 'shotgun', 'smg', 'rifle', 'sniper'];
                    socket.emit('switchWeapon', weapons[parseInt(e.key) - 1]);
                }
            });

            window.addEventListener('keyup', (e) => {
                keys[e.key.toLowerCase()] = false;
            });

            canvas?.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                const me = gameState.players[myId];
                if (!me) return;
                const dx = e.clientX - rect.left - canvas.width / 2;
                const dy = e.clientY - rect.top - canvas.height / 2;
                mouseAngle = Math.atan2(dy, dx);
            });

            canvas?.addEventListener('mousedown', (e) => {
                if (e.button === 0) socket.emit('shoot', { angle: mouseAngle });
                if (e.button === 2) socket.emit('scope', true);
            });

            canvas?.addEventListener('mouseup', (e) => {
                if (e.button === 2) socket.emit('scope', false);
            });

            canvas?.addEventListener('contextmenu', (e) => e.preventDefault());

            canvas?.addEventListener('wheel', (e) => {
                e.preventDefault();
                const me = gameState.players[myId];
                if (!me) return;
                const weapons = ['fist', 'pistol', 'shotgun', 'smg', 'rifle', 'sniper'];
                const idx = weapons.indexOf(me.weapon);
                const nextIdx = e.deltaY > 0? (idx + 1) % weapons.length : (idx - 1 + weapons.length) % weapons.length;
                socket.emit('switchWeapon', weapons[nextIdx]);
            });
        },

        setupMobileControls: () => {
            DOM.mobileControls?.classList.remove('hidden');

            DOM.joystick?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                joystickActive = true;
            });

            DOM.joystick?.addEventListener('touchmove', (e) => {
                if (!joystickActive) return;
                e.preventDefault();
                const touch = e.touches[0];
                const rect = DOM.joystick.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                let dx = touch.clientX - cx;
                let dy = touch.clientY - cy;
                const dist = Math.min(Utils.getDistance(0, 0, dx, dy), 40);
                const angle = Math.atan2(dy, dx);
                dx = Math.cos(angle) * dist;
                dy = Math.sin(angle) * dist;
                joystickPos = { x: dx / 40, y: dy / 40 };
                if (DOM.joystickKnob) DOM.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            });

            DOM.joystick?.addEventListener('touchend', (e) => {
                e.preventDefault();
                joystickActive = false;
                joystickPos = { x: 0, y: 0 };
                if (DOM.joystickKnob) DOM.joystickKnob.style.transform = 'translate(-50%, -50%)';
            });

            DOM.shootBtn?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (touchShootInterval) clearInterval(touchShootInterval);
                socket.emit('shoot', { angle: mouseAngle });
                touchShootInterval = setInterval(() => socket.emit('shoot', { angle: mouseAngle }), 100);
            });

            DOM.shootBtn?.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (touchShootInterval) {
                    clearInterval(touchShootInterval);
                    touchShootInterval = null;
                }
            });

            DOM.scopeBtn?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                socket.emit('scope', true);
            });

            DOM.scopeBtn?.addEventListener('touchend', (e) => {
                e.preventDefault();
                socket.emit('scope', false);
            });

            DOM.lootBtn?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                socket.emit('interact');
            });

            DOM.sprintBtn?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                keys['shift'] = true;
            });

            DOM.sprintBtn?.addEventListener('touchend', (e) => {
                e.preventDefault();
                keys['shift'] = false;
            });

            DOM.grenadeBtn?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                socket.emit('grenade', { angle: mouseAngle });
            });

            DOM.vehicleBtn?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                socket.emit('enterVehicle');
            });

            DOM.reloadBtn?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                socket.emit('reload');
            });
        },

        levelUpCheck: () => {
            if (!gameState.player) return;
            const xpNeeded = gameState.player.level * 100;
            while (gameState.player.xp >= xpNeeded) {
                gameState.player.xp -= xpNeeded;
                gameState.player.level++;
                Notify.show(`LEVEL UP! You are now level ${gameState.player.level}`);
                Audio.play('victory');
            }
            gameState.player.bpXP += 10;
            if (gameState.player.bpXP >= 100) {
                gameState.player.bpXP = 0;
                gameState.player.bpLevel++;
                Notify.show(`Battle Pass Level ${gameState.player.bpLevel} unlocked!`);
            }
            UI.updateLobby();
        }
    };

    // ============================================
    // 24. AI SYSTEM - COMPLETE
    // ============================================
    class AIPlayer {
        constructor(id, spawnX, spawnY, targetPlayerLevel = 1) {
            this.id = id;
            this.name = this.generateBotName();
            this.x = spawnX;
            this.y = spawnY;
            this.hp = 100;
            this.armor = 0;
            this.weapon = 'fist';
            this.ammo = 0;
            this.grenades = 0;
            this.kills = 0;
            this.level = Math.max(1, targetPlayerLevel + Utils.randomInt(-2, 2));
            this.angle = 0;
            this.targetAngle = 0;
            this.username = this.name;

            this.playerLevel = targetPlayerLevel;
            this.difficulty = this.calculateDifficulty();
            this.reactionTime = this.getReactionTime();
            this.accuracy = this.getAccuracy();
            this.aggressiveness = this.getAggressiveness();
            this.lootPriority = 0.7;
            this.survivalInstinct = 0.8;

            this.state = 'looting';
            this.stateTimer = 0;
            this.target = null;
            this.lastSeenEnemy = null;
            this.lastSeenTime = 0;
            this.memory = [];

            this.velocityX = 0;
            this.velocityY = 0;
            this.moveTarget = null;
            this.stuckTimer = 0;
            this.lastPosition = { x: spawnX, y: spawnY };

            this.lastShotTime = 0;
            this.fireRate = this.getFireRate();
            this.reloadTime = 0;
            this.isReloading = false;
            this.lastDamageTime = 0;
            this.dodgeDirection = 0;

            this.preferredRange = this.getPreferredRange();
            this.zoneAwareness = 0.9;
            this.teamwork = false;

            this.personality = this.generatePersonality();
            this.skin = {
                color: this.getRandomColor(),
                hat: this.getRandomHat()
            };
        }

        calculateDifficulty() {
            if (this.level <= 5) return 'easy';
            if (this.level <= 15) return 'medium';
            if (this.level <= 30) return 'hard';
            return 'pro';
        }

        generateBotName() {
            const names = [
                'ShadowHunter', 'ProSniper', 'EliteWarrior', 'NightStalker', 'ThunderBolt',
                'CrimsonViper', 'IronFist', 'GhostRider', 'PhoenixRising', 'WolfPack',
                'StormBreaker', 'DarkKnight', 'SilentAssassin', 'FireDragon', 'IceQueen',
                'BloodEagle', 'SteelTitan', 'RapidFire', 'DeathDealer', 'KingSlayer'
            ];
            const suffix = this.level > 20? 'Elite' : this.level > 10? 'Pro' : '';
            return names[Utils.randomInt(0, names.length - 1)] + suffix + Utils.randomInt(1, 99);
        }

        getReactionTime() {
            const base = { easy: 500, medium: 300, hard: 200, pro: 100 };
            const bonus = Math.max(0, 50 - this.playerLevel * 2);
            return Math.max(50, base[this.difficulty] - bonus);
        }

        getAccuracy() {
            const base = { easy: 0.4, medium: 0.65, hard: 0.8, pro: 0.95 };
            const bonus = Math.min(0.2, this.playerLevel * 0.01);
            return Math.min(0.98, base[this.difficulty] + bonus);
        }

        getAggressiveness() {
            const base = { easy: 0.3, medium: 0.6, hard: 0.8, pro: 0.95 };
            const bonus = Math.min(0.15, this.playerLevel * 0.005);
            return Math.min(0.98, base[this.difficulty] + bonus);
        }

        getFireRate() {
            const rates = {
                'pistol': 400, 'shotgun': 800, 'smg': 100,
                'rifle': 150, 'sniper': 1200, 'fist': 600
            };
            let rate = rates[this.weapon] || 400;
            rate = Math.max(50, rate - this.playerLevel * 3);
            return rate;
        }

        getPreferredRange() {
            const ranges = {
                'shotgun': 80, 'smg': 150, 'pistol': 200,
                'rifle': 300, 'sniper': 500, 'fist': 30
            };
            return ranges[this.weapon] || 200;
        }

        getRandomColor() {
            if (this.level > 30) {
                const proColors = ['#ff0000', '#ff00ff', '#00ffff', '#ffd700', '#ff6600'];
                return proColors[Utils.randomInt(0, proColors.length - 1)];
            }
            const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ff8800'];
            return colors[Utils.randomInt(0, colors.length - 1)];
        }

        getRandomHat() {
            if (this.level > 25) {
                const proHats = ['crown', 'viking', 'wizard'];
                return proHats[Utils.randomInt(0, proHats.length - 1)];
            }
            if (this.level > 10) {
                const midHats = ['helmet', 'cowboy', 'tophat'];
                return midHats[Utils.randomInt(0, midHats.length - 1)];
            }
            const hats = ['none', 'cap', 'helmet'];
            return hats[Utils.randomInt(0, hats.length - 1)];
        }

        generatePersonality() {
            const levelFactor = Math.min(1, this.playerLevel / 50);
            return {
                camper: Math.random() < (0.3 - levelFactor * 0.1),
                rusher: Math.random() < (0.2 + levelFactor * 0.3),
                sniper: Math.random() < (0.15 + levelFactor * 0.2),
                looter: Math.random() < (0.5 - levelFactor * 0.2),
                cautious: Math.random() < (0.4 - levelFactor * 0.2)
            };
        }

        calculatePower() {
            let power = 0;
            power += this.hp / 100 * 0.4;
            power += this.armor / 100 * 0.3;
            power += this.accuracy * 0.2;
            power += (this.weapon!== 'fist')? 0.3 : 0;
            power += this.kills * 0.05;
            power += this.level * 0.02;
            return Math.min(1, power);
        }

        calculateThreat(enemy) {
            if (!enemy) return 0;
            let threat = 0;
            threat += (enemy.hp || 100) / 100 * 0.4;
            threat += (enemy.armor || 0) / 100 * 0.3;
            threat += (enemy.weapon!== 'fist')? 0.3 : 0;
            return threat;
        }

        shouldEngage(enemy) {
            if (!enemy) return false;
            const myPower = this.calculatePower();
            const enemyPower = this.calculateThreat(enemy.entity);
            const dist = enemy.distance;
            const confidenceBoost = this.level * 0.01;

            if (myPower + confidenceBoost < 0.3) return false;
            if (enemyPower > myPower * 1.5) return false;
            if (this.aggressiveness > 0.7) return true;
            if (dist < this.preferredRange * 1.2 && dist > this.preferredRange * 0.5) return true;
            return myPower > enemyPower;
        }

        update(dt, gameState, players) {
            this.stateTimer += dt;

            if (this.memory.length > 10) this.memory.shift();

            const me = { x: this.x, y: this.y, hp: this.hp, id: this.id };
            const enemies = Object.values(players).filter(p => p.id!== this.id && p.hp > 0);

            let nearestEnemy = null;
            let nearestDist = Infinity;
            enemies.forEach(enemy => {
                const dist = Utils.getDistance(this.x, this.y, enemy.x, enemy.y);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestEnemy = { entity: enemy, distance: dist };
                }
            });

            if (this.hp < 30 && this.survivalInstinct > 0.5) {
                this.state = 'fleeing';
            } else if (nearestEnemy && this.shouldEngage(nearestEnemy)) {
                this.state = 'combat';
                this.target = nearestEnemy;
            } else if (this.lootPriority > 0.5) {
                this.state = 'looting';
            } else {
                this.state = 'roaming';
            }

            this.executeState(dt, gameState, nearestEnemy);
        }

        executeState(dt, gameState, enemy) {
            switch (this.state) {
                case 'combat':
                    this.combatBehavior(dt, enemy);
                    break;
                case 'fleeing':
                    this.fleeBehavior(dt, gameState);
                    break;
                case 'looting':
                    this.lootBehavior(dt, gameState);
                    break;
                default:
                    this.roamBehavior(dt, gameState);
            }
        }

        combatBehavior(dt, enemy) {
            if (!enemy) return;
            const dx = enemy.entity.x - this.x;
            const dy = enemy.entity.y - this.y;
            this.targetAngle = Math.atan2(dy, dx);

            const dist = enemy.distance;
            if (dist > this.preferredRange * 1.2) {
                this.velocityX = Math.cos(this.targetAngle) * 200 * dt;
                this.velocityY = Math.sin(this.targetAngle) * 200 * dt;
            } else if (dist < this.preferredRange * 0.8) {
                this.velocityX = -Math.cos(this.targetAngle) * 200 * dt;
                this.velocityY = -Math.sin(this.targetAngle) * 200 * dt;
            }

            if (Math.random() < 0.3) {
                const strafeAngle = this.targetAngle + Math.PI / 2 * (Math.random() < 0.5? 1 : -1);
                this.velocityX += Math.cos(strafeAngle) * 100 * dt;
                this.velocityY += Math.sin(strafeAngle) * 100 * dt;
            }

            const now = Date.now();
            if (now - this.lastShotTime > this.fireRate) {
                if (Math.random() < this.accuracy) {
                    socket.emit('shoot', { angle: this.targetAngle, botId: this.id });
                }
                this.lastShotTime = now;
            }

            this.x += this.velocityX;
            this.y += this.velocityY;
        }

        fleeBehavior(dt, gameState) {
            const zoneAngle = Math.atan2(gameState.zone.y - this.y, gameState.zone.x - this.x);
            this.velocityX = Math.cos(zoneAngle) * 300 * dt;
            this.velocityY = Math.sin(zoneAngle) * 300 * dt;
            this.x += this.velocityX;
            this.y += this.velocityY;
        }

        lootBehavior(dt, gameState) {
            if (gameState.loot.length > 0) {
                const nearestLoot = gameState.loot.reduce((closest, loot) => {
                    const dist = Utils.getDistance(this.x, this.y, loot.x, loot.y);
                    return dist < closest.dist? { loot, dist } : closest;
                }, { loot: null, dist: Infinity });

                if (nearestLoot.loot) {
                    const angle = Math.atan2(nearestLoot.loot.y - this.y, nearestLoot.loot.x - this.x);
                    this.velocityX = Math.cos(angle) * 250 * dt;
                    this.velocityY = Math.sin(angle) * 250 * dt;
                    this.x += this.velocityX;
                    this.y += this.velocityY;
                }
            }
        }

        roamBehavior(dt, gameState) {
            if (!this.moveTarget || Utils.getDistance(this.x, this.y, this.moveTarget.x, this.moveTarget.y) < 50) {
                this.moveTarget = {
                    x: Utils.randomRange(100, gameState.mapData.width - 100),
                    y: Utils.randomRange(100, gameState.mapData.height - 100)
                };
            }
            const angle = Math.atan2(this.moveTarget.y - this.y, this.moveTarget.x - this.x);
            this.velocityX = Math.cos(angle) * 150 * dt;
            this.velocityY = Math.sin(angle) * 150 * dt;
            this.x += this.velocityX;
            this.y += this.velocityY;
        }

        serialize() {
            return {
                id: this.id,
                name: this.name,
                username: this.name,
                x: this.x,
                y: this.y,
                hp: this.hp,
                armor: this.armor,
                weapon: this.weapon,
                kills: this.kills,
                level: this.level,
                angle: this.targetAngle,
                skin: this.skin,
                isBot: true
            };
        }
    }

    class AIManager {
        constructor() {
            this.bots = new Map();
            this.maxBots = 20;
            this.spawnTimer = 0;
            this.spawnInterval = 5;
        }

        update(dt, gameState, players) {
            this.spawnTimer += dt;
            if (this.spawnTimer > this.spawnInterval) {
                this.trySpawnBot(gameState, players);
                this.spawnTimer = 0;
            }

            this.bots.forEach(bot => {
                if (bot.hp > 0) {
                    bot.update(dt, gameState, players);
                } else {
                    this.bots.delete(bot.id);
                }
            });
        }

        trySpawnBot(gameState, players) {
            const realPlayers = Object.values(players).filter(p =>!p.isBot);
            if (realPlayers.length === 0) return;

            const avgLevel = realPlayers.reduce((sum, p) => sum + (p.level || 1), 0) / realPlayers.length;
            const targetLevel = Math.floor(avgLevel);

            const realPlayerCount = realPlayers.length;
                        const targetBotCount = Math.max(0, CONFIG.MAX_PLAYERS - realPlayerCount);

            if (this.bots.size >= targetBotCount || this.bots.size >= this.maxBots) {
                return;
            }

            const spawn = this.findSpawnLocation(gameState, players);
            if (!spawn) return;

            const botId = 'bot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const bot = new AIPlayer(botId, spawn.x, spawn.y, targetLevel);
            this.bots.set(botId, bot);
            console.log(`🤖 Spawned Level ${bot.level} bot: ${bot.name} (${bot.difficulty})`);
        }

        findSpawnLocation(gameState, players) {
            const attempts = 20;
            const minDistFromPlayers = 300;
            const mapWidth = gameState.mapData.width;
            const mapHeight = gameState.mapData.height;

            for (let i = 0; i < attempts; i++) {
                const x = Utils.randomRange(100, mapWidth - 100);
                const y = Utils.randomRange(100, mapHeight - 100);

                let tooClose = false;
                Object.values(players).forEach(player => {
                    const dist = Utils.getDistance(x, y, player.x, player.y);
                    if (dist < minDistFromPlayers) tooClose = true;
                });

                if (!tooClose) {
                    const zoneDist = Utils.getDistance(x, y, gameState.zone.x, gameState.zone.y);
                    if (zoneDist < gameState.zone.radius * 0.8) {
                        return { x, y };
                    }
                }
            }
            return { x: gameState.zone.x, y: gameState.zone.y };
        }

        getAllBots() {
            return Array.from(this.bots.values()).map(bot => bot.serialize());
        }

        getBot(id) {
            return this.bots.get(id);
        }

        removeBot(id) {
            this.bots.delete(id);
        }
    }

    // ============================================
    // 25. FRIENDS SYSTEM - COMPLETE
    // ============================================
    const Friends = {
        add: () => {
            const input = DOM.addFriendInput;
            if (input?.value.trim()) {
                socket.emit("addFriend", Utils.sanitizeHTML(input.value.trim()));
                Notify.toast(`Friend request sent to ${input.value}`, 'success');
                input.value = '';
            }
        },

        load: () => {
            if (!DOM.friendsList ||!gameState.player?.friends) return;
            DOM.friendsList.innerHTML = '';
            if (gameState.player.friends.length === 0) {
                DOM.friendsList.innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No friends yet</p>';
                return;
            }
            gameState.player.friends.forEach(f => {
                const div = document.createElement('div');
                div.className = 'friend-item' + (f.online? ' online' : '');
                div.innerHTML = `
                    <div class="friend-avatar">${f.username[0].toUpperCase()}</div>
                    <div class="friend-info">
                        <div class="friend-name">${Utils.sanitizeHTML(f.username)}</div>
                        <div class="friend-status">${f.online? 'Online' : 'Offline'}</div>
                    </div>
                    ${f.online? '<button class="btn-invite" onclick="Friends.invite(\'' + f.id + '\')">INVITE</button>' : ''}
                `;
                DOM.friendsList.appendChild(div);
            });
        },

        invite: (friendId) => {
            if (roomState.id) {
                socket.emit("inviteFriend", { friendId, roomId: roomState.id });
                Notify.toast('Invite sent!', 'success');
            } else {
                Notify.toast('Create a room first!', 'error');
            }
        }
    };

    // ============================================
    // 26. SHOP SYSTEM - COMPLETE
    // ============================================
    const Shop = {
        open: () => {
            DOM.shopMenu?.classList.remove('hidden');
            Shop.renderSkins();
        },

        renderSkins: () => {
            const grid = DOM.shopSkinsGrid;
            if (!grid) return;
            const items = [
                { id: 'red_skin', name: 'Red Skin', price: 100, rarity: 'common', emoji: '👕' },
                { id: 'blue_skin', name: 'Blue Skin', price: 100, rarity: 'common', emoji: '👔' },
                { id: 'gold_skin', name: 'Golden Skin', price: 500, rarity: 'legendary', emoji: '✨' },
                { id: 'crown', name: 'Golden Crown', price: 500, rarity: 'legendary', emoji: '👑' },
                { id: 'viking', name: 'Viking Helmet', price: 300, rarity: 'epic', emoji: '🪖' },
                { id: 'wizard', name: 'Wizard Hat', price: 300, rarity: 'epic', emoji: '🧙' },
                { id: 'cowboy', name: 'Cowboy Hat', price: 200, rarity: 'rare', emoji: '🤠' },
                { id: 'tophat', name: 'Top Hat', price: 200, rarity: 'rare', emoji: '🎩' }
            ];
            grid.innerHTML = items.map(item => `
                <div class="shop-item ${item.rarity}">
                    <div class="item-image">${item.emoji}</div>
                    <h4>${item.name}</h4>
                    <p class="rarity">${item.rarity.toUpperCase()}</p>
                    <div class="item-price">${item.price} 💰</div>
                    <button onclick="Shop.buy('${item.id}', ${item.price})">BUY</button>
                </div>
            `).join('');
        },

        buy: (id, price) => {
            if (gameState.player?.coins >= price) {
                socket.emit('buyItem', { id, price });
            } else {
                Notify.toast('Not enough coins!', 'error');
            }
        }
    };

    // ============================================
    // 27. INVENTORY SYSTEM
    // ============================================
    const Inventory = {
        open: () => {
            DOM.inventoryMenu?.classList.remove('hidden');
            Inventory.render();
        },

        render: () => {
            const grid = DOM.invSkinsGrid;
            if (!grid ||!gameState.player) return;
            grid.innerHTML = '<p style="color:#666;text-align:center;padding:40px;">No items yet. Visit shop!</p>';
        }
    };

    // ============================================
    // 28. SETTINGS SYSTEM
    // ============================================
    const Settings = {
        open: () => {
            DOM.settingsMenu?.classList.remove('hidden');
            if (gameState.player?.settings) {
                if (DOM.volumeSlider) DOM.volumeSlider.value = gameState.player.settings.volume;
                if (DOM.volumeValue) DOM.volumeValue.textContent = gameState.player.settings.volume;
                if (DOM.sfxSlider) DOM.sfxSlider.value = gameState.player.settings.sfx;
                if (DOM.sfxValue) DOM.sfxValue.textContent = gameState.player.settings.sfx;
                if (DOM.sensitivitySlider) DOM.sensitivitySlider.value = gameState.player.settings.sensitivity;
                if (DOM.sensitivityValue) DOM.sensitivityValue.textContent = gameState.player.settings.sensitivity;
                if (DOM.qualitySelect) DOM.qualitySelect.value = gameState.player.settings.quality;
                if (DOM.fpsSelect) DOM.fpsSelect.value = gameState.player.settings.fps;
            }
        },

        save: () => {
            if (!gameState.player) return;
            gameState.player.settings = {
                volume: parseInt(DOM.volumeSlider?.value) || 50,
                sfx: parseInt(DOM.sfxSlider?.value) || 50,
                sensitivity: parseInt(DOM.sensitivitySlider?.value) || 50,
                quality: DOM.qualitySelect?.value || 'medium',
                fps: parseInt(DOM.fpsSelect?.value) || 60
            };
            Auth.savePlayerData();
            Notify.toast('Settings saved!', 'success');
            Settings.close();
        },

        reset: () => {
            if (DOM.volumeSlider) DOM.volumeSlider.value = 50;
            if (DOM.volumeValue) DOM.volumeValue.textContent = 50;
            if (DOM.sfxSlider) DOM.sfxSlider.value = 50;
            if (DOM.sfxValue) DOM.sfxValue.textContent = 50;
            if (DOM.sensitivitySlider) DOM.sensitivitySlider.value = 50;
            if (DOM.sensitivityValue) DOM.sensitivityValue.textContent = 50;
            if (DOM.qualitySelect) DOM.qualitySelect.value = 'medium';
            if (DOM.fpsSelect) DOM.fpsSelect.value = 60;
            Notify.toast('Settings reset to default', 'info');
        },

        close: () => {
            DOM.settingsMenu?.classList.add('hidden');
        }
    };

    // ============================================
    // 29. PROFILE SYSTEM
    // ============================================
    const Profile = {
        open: () => {
            DOM.profileMenu?.classList.remove('hidden');
            if (gameState.player) {
                if (DOM.profileLevel) DOM.profileLevel.textContent = gameState.player.level || 1;
                if (DOM.statWins) DOM.statWins.textContent = gameState.player.wins || 0;
                if (DOM.statKills) DOM.statKills.textContent = gameState.player.kills || 0;
                if (DOM.statDeaths) DOM.statDeaths.textContent = gameState.player.deaths || 0;
                if (DOM.statMatches) DOM.statMatches.textContent = gameState.player.matches || 0;
                const deaths = gameState.player.deaths || 0;
                const kdr = deaths === 0? (gameState.player.kills > 0? '∞' : '0.00') : (gameState.player.kills / deaths).toFixed(2);
                if (DOM.profileKDR) DOM.profileKDR.textContent = kdr;
                if (DOM.profileUsername) DOM.profileUsername.value = gameState.player.username;
            }
        },

        saveUsername: () => {
            const newName = DOM.profileUsername?.value;
            if (newName && newName.length >= 3) {
                const cleanName = Utils.sanitizeUsername(newName);
                if (DOM.playerName) DOM.playerName.textContent = cleanName;
                if (gameState.player) gameState.player.username = cleanName;
                Notify.toast('Username updated!', 'success');
                socket.emit('updateUsername', cleanName);
            } else {
                Notify.toast('Username must be 3+ characters', 'error');
            }
        },

        close: () => {
            DOM.profileMenu?.classList.add('hidden');
        }
    };

    // ============================================
    // 30. MAIL SYSTEM
    // ============================================
    const Mail = {
        open: () => {
            DOM.mailMenu?.classList.remove('hidden');
            Mail.render();
        },

        render: () => {
            const inbox = DOM.mailInboxList;
            if (inbox) inbox.innerHTML = `
                <div class="mail-item unread">
                    <div class="mail-item-header">
                        <span class="mail-sender">System</span>
                        <span class="mail-date">Today</span>
                    </div>
                    <div class="mail-subject">Welcome to MG FIGHTER!</div>
                    <div class="mail-preview">Thanks for joining. Claim your starter reward!</div>
                    <button onclick="Mail.claim(1)" class="btn-claim">CLAIM 100 COINS</button>
                </div>
            `;
        },

        claim: (mailId) => {
            if (gameState.player) {
                gameState.player.coins += 100;
                UI.updateLobby();
                Notify.toast('Claimed 100 coins!', 'success');
                DOM.mailBadge?.classList.add('hidden');
            }
        },

        claimAll: () => {
            Notify.toast('All rewards claimed!', 'success');
            DOM.mailBadge?.classList.add('hidden');
        },

        deleteRead: () => {
            Notify.toast('Read mail deleted', 'info');
        },

        close: () => {
            DOM.mailMenu?.classList.add('hidden');
        }
    };

    // ============================================
    // 31. LEADERBOARD SYSTEM
    // ============================================
    const Leaderboard = {
        open: () => {
            DOM.fullLeaderboard?.classList.remove('hidden');
            Leaderboard.load();
        },

        load: () => {
            const tbody = DOM.fullLeaderboardBody;
            if (!tbody) return;
            const mockData = [
                {rank: 1, name: 'ProGamer', level: 50, wins: 120, kills: 2500, kd: 5.2, score: 5000},
                {rank: 2, name: 'EliteSniper', level: 48, wins: 115, kills: 2300, kd: 4.8, score: 4800},
                {rank: 3, name: 'KingSlayer', level: 45, wins: 100, kills: 2100, kd: 4.5, score: 4600},
                {rank: 4, name: 'ShadowStrike', level: 42, wins: 95, kills: 1900, kd: 4.2, score: 4300},
                {rank: 5, name: 'ThunderBolt', level: 40, wins: 88, kills: 1750, kd: 3.9, score: 4100}
            ];
            tbody.innerHTML = mockData.map(p => `
                <tr><td>${p.rank}</td><td>${Utils.sanitizeHTML(p.name)}</td><td>${p.level}</td><td>${p.wins}</td><td>${p.kills}</td><td>${p.kd}</td><td>${p.score}</td></tr>
            `).join('');
        },

        close: () => {
            DOM.fullLeaderboard?.classList.add('hidden');
        },

        filter: (type, e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            if (e?.target) e.target.classList.add('active');
            Leaderboard.load();
        }
    };

    // ============================================
    // 32. EVENT LISTENERS SETUP
    // ============================================
    function initEventListeners() {
        // Auth
        document.getElementById('googleLoginBtn')?.addEventListener('click', Auth.loginWithGoogle);
        document.getElementById('guestLoginBtn')?.addEventListener('click', Auth.loginAnonymously);

        // Lobby
        document.getElementById('findMatchBtn')?.addEventListener('click', () => Lobby.findMatch('solo'));
        document.getElementById('createRoomBtn')?.addEventListener('click', Lobby.createRoom);
        document.getElementById('joinRoomBtn')?.addEventListener('click', Lobby.joinRoom);
        document.getElementById('cancelMatchmakingBtn')?.addEventListener('click', Lobby.cancelMatchmaking);

        // Room
        DOM.readyBtn?.addEventListener('click', Lobby.ready);
        DOM.startMatchBtn?.addEventListener('click', Lobby.startMatch);
        document.getElementById('leaveRoomBtn')?.addEventListener('click', Lobby.leaveRoom);

        // Chat
        DOM.lobbyChatInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') Chat.sendLobby();
        });
        DOM.roomChatInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') Chat.sendRoom();
        });

        // Friends
        DOM.addFriendInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') Friends.add();
        });

        // Settings sliders
        DOM.volumeSlider?.addEventListener('input', (e) => {
            if (gameState.player) gameState.player.settings.volume = parseInt(e.target.value);
            if (DOM.volumeValue) DOM.volumeValue.textContent = e.target.value;
        });
        DOM.sfxSlider?.addEventListener('input', (e) => {
            if (gameState.player) gameState.player.settings.sfx = parseInt(e.target.value);
            if (DOM.sfxValue) DOM.sfxValue.textContent = e.target.value;
        });
        DOM.sensitivitySlider?.addEventListener('input', (e) => {
            if (gameState.player) gameState.player.settings.sensitivity = parseInt(e.target.value);
            if (DOM.sensitivityValue) DOM.sensitivityValue.textContent = e.target.value;
        });

        // Prevent zoom on mobile
        document.addEventListener('touchmove', (e) => {
            if (e.scale!== 1) e.preventDefault();
        }, { passive: false });

        // Prevent context menu
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // ============================================
    // 33. GLOBAL WINDOW FUNCTIONS
    // ============================================
    window.loginWithGoogle = Auth.loginWithGoogle;
    window.loginAnonymously = Auth.loginAnonymously;
    window.findMatch = Lobby.findMatch;
    window.cancelMatchmaking = Lobby.cancelMatchmaking;
    window.createRoom = Lobby.createRoom;
    window.joinRoom = Lobby.joinRoom;
    window.leaveRoom = Lobby.leaveRoom;
    window.ready = Lobby.ready;
    window.startMatch = Lobby.startMatch;
    window.sendLobbyChat = Chat.sendLobby;
    window.sendRoomChat = Chat.sendRoom;
    window.addFriend = Friends.add;
    window.inviteFriend = Friends.invite;
    window.openBattlePass = BattlePass.open;
    window.buyBattlePass = BattlePass.buy;
    window.openShop = Shop.open;
    window.buyItem = Shop.buy;
    window.openInventory = Inventory.open;
    window.openSettings = Settings.open;
    window.saveSettings = Settings.save;
    window.resetSettings = Settings.reset;
    window.closeSettings = Settings.close;
    window.openProfile = Profile.open;
    window.saveUsername = Profile.saveUsername;
    window.closeProfile = Profile.close;
    window.openMail = Mail.open;
    window.claimAllMail = Mail.claimAll;
    window.deleteReadMail = Mail.deleteRead;
    window.closeMail = Mail.close;
    window.openFullLeaderboard = Leaderboard.open;
    window.loadLeaderboardData = Leaderboard.load;
    window.closeFullLeaderboard = Leaderboard.close;
    window.filterLeaderboard = Leaderboard.filter;
    window.returnToLobby = () => {
        DOM.victoryScreen?.classList.add('hidden');
        DOM.deathScreen?.classList.add('hidden');
        DOM.scoreboard?.classList.add('hidden');
        DOM.spectateUI?.classList.add('hidden');
        UI.showScreen('lobbyScreen');
        gameState.isGameRunning = false;
        if (socket.connected) socket.disconnect();
        setTimeout(() => socket.connect(), 500);
    };
    window.playAgain = () => {
        window.returnToLobby();
        setTimeout(() => Lobby.findMatch(gameState.matchMode), 1000);
    };
    window.spectate = () => {
        DOM.deathScreen?.classList.add('hidden');
        DOM.spectateUI?.classList.remove('hidden');
        Notify.toast('Spectating...', 'info');
    };
    window.changeSkinColor = (color) => {
        if (gameState.player) gameState.player.skin.color = color;
        socket.emit("changeSkin", gameState.player.skin);
        Notify.toast('Skin color changed!');
    };
    window.changeSkinHat = (hat) => {
        if (gameState.player) gameState.player.skin.hat = hat;
        socket.emit("changeSkin", gameState.player.skin);
        Notify.toast('Hat changed!');
    };

    // ============================================
    // 34. INIT GAME
    // ============================================
    window.addEventListener('load', async () => {
        console.log('MG FIGHTER v4.2 Loaded');
        if (DOM.loadingText) DOM.loadingText.textContent = 'Loading assets...';

        await Game.loadAssets();

        if (DOM.loadingText) DOM.loadingText.textContent = 'Ready!';
        setTimeout(() => {
            DOM.loadingScreen?.classList.add('hidden');
            UI.showScreen('authScreen');
        }, 500);

        if (isMobile) {
            document.body.classList.add('mobile');
        }

        // Instantiate AI Manager
        window.aiManager = new AIManager();
    });

    // ============================================
    // 35. CLEANUP ON EXIT
    // ============================================
    window.addEventListener('beforeunload', () => {
        if (touchShootInterval) clearInterval(touchShootInterval);
        socket.disconnect();
    });

    console.log('🔥 MG FIGHTER v4.2.0 - ALL SYSTEMS READY');
    console.log('📱 Mobile:', isMobile);
    console.log('🎮 Controls: WASD/Arrows = Move, Mouse = Aim, Click = Shoot, R = Reload, G = Grenade, F = Interact, 1-6 = Weapons');
})();
