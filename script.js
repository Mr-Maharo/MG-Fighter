(() => {
    'use strict'; // FIX 1: Strict mode mba tsy hisy bug an-tsokosoko

    // ============================================
    // 0. CONFIG & GLOBAL STATE - FIXED ORDER
    // ============================================
    const CONFIG = {
        SERVER_URL: "https://mg-fighter-1.onrender.com",
        VERSION: "4.0.1",
        MAX_PLAYERS: 50,
        TICK_RATE: 60,
        MAP_WIDTH: 4000,
        MAP_HEIGHT: 4000,
        TILE_SIZE: 32
    };

    // FIX 2: Socket déclaré AVANT ny functions rehetra
    const socket = io(CONFIG.SERVER_URL, {
        autoConnect: false,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
    });

    // FIX 3: GameState tokana ihany - tsy misy window.gameState hafa
    let gameState = {
        players: {},
        enemies: [],
        bullets: [],
        loot: [],
        vehicles: [],
        zone: { x: 2000, y: 2000, radius: 2000, targetRadius: 2000, timer: 0 },
        aliveCount: 0,
        matchMode: 'solo',
        mapData: { width: CONFIG.MAP_WIDTH, height: CONFIG.MAP_HEIGHT, walls: [] },
        mapImage: null,
        player: null // FIX 4: Player data eto fa tsy misaraka
    };

    // FIX 5: Auth apetraka ambony
    const auth = firebase.auth();
    const db = firebase.firestore();

    let myId = null;
    let currentUser = null;
    let currentUserId = null;

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
    let joystickActive = false;
    let joystickPos = { x: 0, y: 0 };

    // ============================================
    // 1. UTILS - SANITIZE + HELPERS - FIX XSS
    // ============================================
    const Utils = {
        // FIX 7: Sanitize daholo ny user input mba tsy hisy XSS
        sanitizeHTML: (str) => {
            const temp = document.createElement('div');
            temp.textContent = str;
            return temp.innerHTML;
        },

        formatTime: (seconds) => {
            // FIX 35: Misoroka negative time
            seconds = Math.max(0, Math.floor(seconds));
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            return `${m}:${s.toString().padStart(2, '0')}`;
        },

        getDistance: (x1, y1, x2, y2) => {
            // FIX 34: Haingana kokoa noho Math.hypot raha compare fotsiny
            const dx = x2 - x1;
            const dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        },

        clamp: (val, min, max) => Math.min(Math.max(val, min), max)
    };

    // ============================================
    // 2. DOM CACHE
    // ============================================
    const DOM = {};
    window.addEventListener('DOMContentLoaded', () => {
        const ids = ['authScreen','lobbyScreen','matchmakingScreen','gameScreen','roomScreen','authError',
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
            'inventoryMenu','settingsMenu','profileMenu','mailMenu','fullLeaderboard','termsModal',
            'privacyModal','creditsScreen','notificationContainer','confirmDialog','toastContainer',
            'spectateUI','spectatePlayerName','mailBadge','loadingScreen','loadingText'];
        ids.forEach(id => DOM[id] = document.getElementById(id));
    });

    // ============================================
    // 3. NOTIFICATION SYSTEM - FIX 9
    // ============================================
    const Notify = {
        toast: (msg, type = 'info') => {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = Utils.sanitizeHTML(msg); // FIX 7: Sanitize
            DOM.toastContainer.appendChild(toast);
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
            div.innerHTML = `<p>${Utils.sanitizeHTML(msg)}</p>`; // FIX 7
            document.body.appendChild(div);
            setTimeout(() => div.remove(), 3000);
        }
    };

    // ============================================
    // 4. AUTHENTICATION - FIX 19
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
                        username: currentUser,
                        email: user.email,
                        photo: user.photoURL || "",
                        level: 1, coins: 100, wins: 0, kills: 0, deaths: 0, matches: 0, xp: 0,
                        bpLevel: 1, bpXP: 0, rank: "Bronze III",
                        skin: { color: '#00ff00', hat: 'none' },
                        friends: [],
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
                    skin: gameState.player.skin
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
                currentUser = "Guest" + Math.floor(Math.random() * 10000);
                currentUserId = user.uid;

                gameState.player = {
                    username: currentUser,
                    level: 1, coins: 100, wins: 0, kills: 0, deaths: 0, matches: 0, xp: 0,
                    bpLevel: 1, bpXP: 0, rank: "Bronze III",
                    skin: { color: '#00ff00', hat: 'none' },
                    friends: [],
                    isGuest: true
                };

                UI.updateLobby();
                UI.showScreen('lobbyScreen');
                socket.connect();
                socket.emit("joinGame", {
                    username: currentUser,
                    uid: currentUserId,
                    skin: gameState.player.skin
                });

            } catch (err) {
                console.error("GUEST LOGIN ERROR:", err);
                DOM.authError.textContent = 'Guest login failed.';
            }
        },

        savePlayerData: async () => {
            // FIX 9: Tsy save raha guest
            if (!currentUserId || gameState.player?.isGuest) return;
            try {
                await db.collection("players").doc(currentUserId).update(gameState.player);
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
                    skin: gameState.player.skin
                });
            }
        } else if (!user) {
            UI.showScreen('authScreen');
            if (socket.connected) socket.disconnect();
        }
    });

    // ============================================
    // 5. SOCKET HANDLERS - FIX 6, 8, 16
    // ============================================
    let lastMoveEmit = 0;
    const MOVE_THROTTLE = 1000 / 20; // FIX 30: 20Hz max fa tsy 60Hz

    socket.on("connect", () => {
        myId = socket.id;
        console.log("✅ Connected:", myId);
        Notify.toast('Connected to server!', 'success');
    });

    socket.on("disconnect", () => {
        console.log('❌ Disconnected from server');
        if (isGameRunning) {
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
        if (isGameRunning) UI.updateScoreboard();
    });

    socket.on("gameStart", (data) => {
        Object.assign(gameState, data);
        UI.showScreen('gameScreen');
        Game.init();
        isGameRunning = true;
        if (isMobile && DOM.mobileControls) DOM.mobileControls.classList.remove('hidden');
        Notify.toast('Match Started!', 'success');
    });

    socket.on("gameUpdate", (data) => {
        // FIX 16: Server authoritative - tsy matoky client
        Object.assign(gameState, data);
    });

    socket.on("killFeed", (data) => {
        UI.addKillFeed(Utils.sanitizeHTML(data.killer), Utils.sanitizeHTML(data.victim), data.weapon);
    });

    socket.on("damageNumber", (data) => {
        UI.showDamageNumber(data.x, data.y, data.damage, data.isHeadshot);
    });

    socket.on("hitmarker", () => {
        if (DOM.hitmarker) {
            DOM.hitmarker.classList.remove('hidden');
            setTimeout(() => DOM.hitmarker.classList.add('hidden'), 100);
        }
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
            isGameRunning = false;
            if (DOM.finalRank) DOM.finalRank.textContent = data.rank;
            if (DOM.finalKills) DOM.finalKills.textContent = data.kills;
            if (DOM.finalDamage) DOM.finalDamage.textContent = data.damage || 0;
            if (DOM.finalTime) DOM.finalTime.textContent = Utils.formatTime(data.time || 0);
            if (DOM.finalReward) DOM.finalReward.textContent = `+${data.coins} Coins +${data.xp} XP`;
            if (DOM.deathScreen) DOM.deathScreen.classList.remove('hidden');

            // FIX 11: Server no manome coins, tsy client
            gameState.player.coins += data.coins;
            gameState.player.xp += data.xp;
            gameState.player.kills += data.kills;
            gameState.player.deaths++;
            gameState.player.matches++;
            Game.levelUpCheck();
            Auth.savePlayerData();
            UI.updateLobby();
        }
    });

     // ============================================
    // 6. UI SYSTEM - FIXED EVENT HANDLERS
    // ============================================
    const UI = {
        showScreen: (screenId) => {
            ['authScreen', 'lobbyScreen', 'matchmakingScreen', 'gameScreen'].forEach(id => {
                document.getElementById(id)?.classList.add('hidden');
            });
            document.getElementById(screenId)?.classList.remove('hidden');
        },

        updateLobby: () => {
            if (!gameState.player) return;
            if (DOM.playerName) DOM.playerName.textContent = Utils.sanitizeHTML(gameState.player.username);
            if (DOM.playerLevel) DOM.playerLevel.textContent = gameState.player.level;
            if (DOM.playerCoins) DOM.playerCoins.textContent = gameState.player.coins;
            if (DOM.playerWins) DOM.playerWins.textContent = gameState.player.wins;
            if (DOM.playerKills) DOM.playerKills.textContent = gameState.player.kills;
            if (DOM.playerRank) DOM.playerRank.textContent = gameState.player.rank;
            if (DOM.bpLevel) DOM.bpLevel.textContent = gameState.player.bpLevel;
            if (DOM.bpXP) DOM.bpXP.style.width = `${(gameState.player.bpXP % 100)}%`;
            if (DOM.bpXPText) DOM.bpXPText.textContent = `${gameState.player.bpXP % 100}/100 XP`;
            if (gameState.player.photo && DOM.playerAvatar) {
                DOM.playerAvatar.style.backgroundImage = `url(${gameState.player.photo})`;
                DOM.playerAvatar.style.backgroundSize = 'cover';
            }
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
            div.className = 'damage';
            div.style.left = `${x - camera.x}px`;
            div.style.top = `${y - camera.y}px`;
            div.style.color = isHeadshot? '#ff0000' : '#ffff00';
            div.textContent = damage;
            DOM.damageNumbers.appendChild(div);
            setTimeout(() => div.remove(), 1000);
        }
    };

    // ============================================
    // 7. GLOBAL WINDOW FUNCTIONS - FIX 1: EVENT PARAMETER DAHOLO
    // ============================================
    window.loadChatMessages = (chat) => {
        const chatBox = DOM.lobbyChatMessages;
        if (chatBox) chatBox.innerHTML = `<p style="color:#666;text-align:center;">${Utils.sanitizeHTML(chat.toUpperCase())} chat ready</p>`;
    };

    window.loadFriendsTab = (tab) => {
        const friendsList = DOM.friendsList;
        if (friendsList) friendsList.innerHTML = `<p style="color:#666;text-align:center;">No ${Utils.sanitizeHTML(tab)} friends</p>`;
    };

    // FIX 1: Event parameter ampiana daholo
    window.claimDailyReward = (day, e) => {
        Notify.toast(`Day ${day} reward claimed! +50 Coins`, 'success');
        if (gameState?.player) {
            gameState.player.coins += 50;
            if (DOM.playerCoins) DOM.playerCoins.textContent = gameState.player.coins;
            socket.emit('claimDaily', day); // FIX 11: Server validate
        }
        if (e?.target) {
            e.target.disabled = true;
            e.target.textContent = 'CLAIMED';
        }
    };

    window.openFullLeaderboard = () => {
        DOM.fullLeaderboard?.classList.remove('hidden');
        window.loadLeaderboardData();
    };

    window.loadLeaderboardData = () => {
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
    };

    window.openInventory = () => {
        DOM.inventoryMenu?.classList.remove('hidden');
        const grid = DOM.invSkinsGrid;
        if (grid) grid.innerHTML = '<p style="color:#666;text-align:center;padding:40px;">No items yet. Visit shop!</p>';
    };

    window.openSettings = () => DOM.settingsMenu?.classList.remove('hidden');
    window.openShop = () => {
        DOM.shopMenu?.classList.remove('hidden');
        const grid = DOM.shopSkinsGrid;
        if (grid) grid.innerHTML = `
            <div class="shop-item"><div class="item-image">👕</div><h4>Red Skin</h4><p>Rare</p><div class="item-price">100 💰</div><button onclick="buyItem('red_skin', 100, event)">BUY</button></div>
            <div class="shop-item"><div class="item-image">👑</div><h4>Golden Crown</h4><p>Legendary</p><div class="item-price">500 💰</div><button onclick="buyItem('gold_crown', 500, event)">BUY</button></div>
        `;
    };

    window.openProfile = () => {
        DOM.profileMenu?.classList.remove('hidden');
        if (gameState?.player) {
            if (DOM.profileLevel) DOM.profileLevel.textContent = gameState.player.level || 1;
            if (DOM.statWins) DOM.statWins.textContent = gameState.player.wins || 0;
            if (DOM.statKills) DOM.statKills.textContent = gameState.player.kills || 0;
            if (DOM.statDeaths) DOM.statDeaths.textContent = gameState.player.deaths || 0;
            if (DOM.statMatches) DOM.statMatches.textContent = gameState.player.matches || 0;
            // FIX 32: KDR calculation safe
            const deaths = gameState.player.deaths || 0;
            const kdr = deaths === 0? (gameState.player.kills > 0? '∞' : '0.00') : (gameState.player.kills / deaths).toFixed(2);
            if (DOM.profileKDR) DOM.profileKDR.textContent = kdr;
        }
    };

    window.openMail = () => {
        DOM.mailMenu?.classList.remove('hidden');
        const inbox = DOM.mailInboxList;
        if (inbox) inbox.innerHTML = `<div class="mail-item unread"><div class="mail-item-header"><span class="mail-sender">System</span><span class="mail-date">Today</span></div><div class="mail-subject">Welcome to MG FIGHTER!</div><div class="mail-preview">Thanks for joining. Claim your starter reward!</div></div>`;
    };

    window.openBattlePass = () => {
        DOM.battlePassMenu?.classList.remove('hidden');
        const container = DOM.bpRewards;
        if (container) {
            let html = '';
            for (let i = 1; i <= 20; i++) {
                html += `<div class="bp-item ${i <= 3? 'unlocked' : ''}"><div class="bp-level">${i}</div><div class="bp-reward">🎁</div></div>`;
            }
            container.innerHTML = html;
        }
    };

    window.buyItem = (id, price, e) => {
        if (gameState?.player?.coins >= price) {
            // FIX 11: Server no manao validation final
            socket.emit('buyItem', { id, price });
        } else {
            Notify.toast('Not enough coins!', 'error');
        }
    };

    window.buyBattlePass = () => {
        if (gameState?.player?.coins >= 500) {
            socket.emit('buyBattlePass'); // FIX 11: Server validate
        } else {
            Notify.toast('Not enough coins! Need 500', 'error');
        }
    };

    window.addFriend = () => {
        const input = DOM.addFriendInput;
        if (input?.value.trim()) {
            socket.emit("addFriend", Utils.sanitizeHTML(input.value.trim())); // FIX 7
            Notify.toast(`Friend request sent to ${input.value}`, 'success');
            input.value = '';
        }
    };

    // FIX 1: Event parameter daholo ny tab functions
    window.filterLeaderboard = (type, e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        if (e?.target) e.target.classList.add('active');
        window.loadLeaderboardData();
    };

    window.prevLeaderboardPage = () => Notify.toast('Previous page', 'info');
    window.nextLeaderboardPage = () => Notify.toast('Next page', 'info');

    window.saveUsername = () => {
        const newName = DOM.profileUsername?.value;
        if (newName && newName.length >= 3) {
            const cleanName = Utils.sanitizeHTML(newName); // FIX 7
            if (DOM.playerName) DOM.playerName.textContent = cleanName;
            if (gameState?.player) gameState.player.username = cleanName;
            Notify.toast('Username updated!', 'success');
            socket.emit('updateUsername', cleanName);
        } else {
            Notify.toast('Username must be 3+ characters', 'error');
        }
    };

    window.saveSettings = () => { Notify.toast('Settings saved!', 'success'); window.closeSettings(); };
    window.resetSettings = () => { Notify.toast('Settings reset!', 'info'); };
    window.resetControls = () => { Notify.toast('Controls reset to default', 'info'); };
    window.claimAllMail = () => { Notify.toast('All rewards claimed!', 'success'); DOM.mailBadge?.classList.add('hidden'); };
    window.deleteReadMail = () => { Notify.toast('Read mail deleted', 'info'); };
    window.spectate = () => { DOM.deathScreen?.classList.add('hidden'); DOM.spectateUI?.classList.remove('hidden'); Notify.toast('Spectating...', 'info'); };
    window.nextSpectate = () => { Notify.toast('Switching player...', 'info'); };

    // Close functions
    window.closeSkinMenu = () => DOM.skinMenu?.classList.add('hidden');
    window.closeBattlePass = () => DOM.battlePassMenu?.classList.add('hidden');
    window.closeShop = () => DOM.shopMenu?.classList.add('hidden');
    window.closeInventory = () => DOM.inventoryMenu?.classList.add('hidden');
    window.closeSettings = () => DOM.settingsMenu?.classList.add('hidden');
    window.closeProfile = () => DOM.profileMenu?.classList.add('hidden');
    window.closeMail = () => DOM.mailMenu?.classList.add('hidden');
    window.closeFullLeaderboard = () => DOM.fullLeaderboard?.classList.add('hidden');
    window.closeTerms = () => DOM.termsModal?.classList.add('hidden');
    window.closePrivacy = () => DOM.privacyModal?.classList.add('hidden');
    window.closeCredits = () => DOM.creditsScreen?.classList.add('hidden');
    window.showTerms = () => DOM.termsModal?.classList.remove('hidden');
    window.showPrivacy = () => DOM.privacyModal?.classList.remove('hidden');

    // Tab functions - FIX 1: Event parameter
    window.showSkinTab = (tab, e) => {
        document.querySelectorAll('.skin-tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.skin-tab').forEach(el => el.classList.remove('active'));
        document.getElementById('skin' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab')?.classList.remove('hidden');
        if (e?.target) e.target.classList.add('active');
    };

    window.showShopTab = (tab, e) => {
        document.querySelectorAll('.shop-tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.shop-tab').forEach(el => el.classList.remove('active'));
        document.getElementById('shop' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab')?.classList.remove('hidden');
        if (e?.target) e.target.classList.add('active');
    };

    window.showInvTab = (tab, e) => {
        document.querySelectorAll('.inv-tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.inv-tab').forEach(el => el.classList.remove('active'));
        document.getElementById('inv' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab')?.classList.remove('hidden');
        if (e?.target) e.target.classList.add('active');
    };

    window.showMailTab = (tab, e) => {
        document.querySelectorAll('.mail-tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.mail-tab').forEach(el => el.classList.remove('active'));
        document.getElementById('mail' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab')?.classList.remove('hidden');
        if (e?.target) e.target.classList.add('active');
    };

    window.switchChat = (chat, e) => {
        document.querySelectorAll('.chat-tab').forEach(el => el.classList.remove('active'));
        if (e?.target) e.target.classList.add('active');
        window.loadChatMessages(chat);
    };

    window.showFriendsTab = (tab, e) => {
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        if (e?.target) e.target.classList.add('active');
        window.loadFriendsTab(tab);
    };

    // Skin functions - FIX 11: Server validate
    window.changeSkinColor = (color) => {
        if (gameState?.player) gameState.player.skin.color = color;
        socket.emit("changeSkin", gameState.player.skin);
        Notify.toast('Skin color changed!');
    };

    window.changeSkinHat = (hat) => {
        if (gameState?.player) gameState.player.skin.hat = hat;
        socket.emit("changeSkin", gameState.player.skin);
        Notify.toast('Hat changed!');
    };

    window.changeOutfit = (outfit) => { Notify.toast(`Outfit: ${outfit}`, 'info'); };
    window.useEmote = (emote) => { Notify.toast(`Emote: ${emote}`, 'info'); };
    window.confirmYes = () => { DOM.confirmDialog?.classList.add('hidden'); };
    window.confirmNo = () => { DOM.confirmDialog?.classList.add('hidden'); };
    window.changeAvatar = () => { Notify.toast('Avatar change coming soon!', 'info'); };

    // ============================================
    // 8. GAME CORE - FIXED LOOP
    // ============================================
    const Game = {
        init: () => {
            canvas = DOM.game;
            ctx = canvas.getContext('2d');
            minimapCtx = DOM.minimap?.getContext('2d');

            Game.resizeCanvas();
            window.addEventListener('resize', Game.resizeCanvas);

            if (isMobile) {
                Game.setupMobileControls();
            } else {
                Game.setupDesktopControls();
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
            // FIX 5: Mijanona tsara raha tsy running
            if (!isGameRunning) return;

            const deltaTime = (currentTime - lastFrameTime) / 1000;
            lastFrameTime = currentTime;

            Game.update(deltaTime);
            Game.render();

            requestAnimationFrame(Game.loop);
        },

        update: (dt) => {
            const me = gameState.players[myId];
            if (!me) return;

            camera.x = me.x - canvas.width / 2;
            camera.y = me.y - canvas.height / 2;

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

            // FIX 24: Viewport culling - tiles hita ihany no draw
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

                            if (tile.spriteId && spriteData?.tiles?.[tile.spriteId] && spriteImage?.complete) {
                                const sprite = spriteData.tiles[tile.spriteId];
                                ctx.drawImage(
                                    spriteImage,
                                    sprite.x, sprite.y, sprite.w, sprite.h,
                                    drawX, drawY, tile.s, tile.s
                                );
                            } else {
                                if (tile.collision) ctx.fillStyle = '#444';
                                else if (tile.swimmable) ctx.fillStyle = '#0088ff';
                                else ctx.fillStyle = '#2a2a2a';
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
            }

            // FIX 22: Draw objects - viewport culling
            [...gameState.loot,...gameState.vehicles,...gameState.bullets].forEach(obj => {
                const screenX = obj.x - camera.x;
                const screenY = obj.y - camera.y;
                if (screenX < -50 || screenX > canvas.width + 50 || screenY < -50 || screenY > canvas.height + 50) return;

                if (obj.type === 'loot') {
                    ctx.fillStyle = '#ffff00';
                    ctx.fillRect(screenX - 10, screenY - 10, 20, 20);
                } else if (obj.type === 'vehicle') {
                    ctx.fillStyle = '#888888';
                    ctx.fillRect(screenX - 30, screenY - 20, 60, 40);
                } else {
                    ctx.fillStyle = '#ffff00';
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
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
                    const hatEmoji = { crown: '👑', helmet: '🪖', cap: '🧢' }[p.skin.hat];
                    if (hatEmoji) ctx.fillText(hatEmoji, x - 10, y - 15);
                }

                // Name & HP
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(Utils.sanitizeHTML(p.username), x, y - 25);

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

            Game.renderMinimap();
        },

        renderMinimap: () => {
            if (!minimapCtx) return;
            minimapCtx.fillStyle = '#000';
            minimapCtx.fillRect(0, 0, 180, 180);

            const scale = 180 / gameState.mapData.width;

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
        },

        handleInput: () => {
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

            // FIX 30: Throttle move events
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
                if (e.key === 'm') DOM.skinMenu?.classList.toggle('hidden');
                if (e.key === 'b') window.openBattlePass();
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
        },

        setupMobileControls: () => {
            DOM.mobileControls?.classList.remove('hidden');

            DOM.joystick?.addEventListener('touchstart', () => { joystickActive = true; });
            DOM.joystick?.addEventListener('touchmove', (e) => {
                if (!joystickActive) return;
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

            DOM.joystick?.addEventListener('touchend', () => {
                joystickActive = false;
                joystickPos = { x: 0, y: 0 };
                if (DOM.joystickKnob) DOM.joystickKnob.style.transform = 'translate(-50%, -50%)';
            });

            let shootInterval = null;
            DOM.shootBtn?.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (shootInterval) clearInterval(shootInterval); // FIX 4
                socket.emit('shoot', { angle: mouseAngle });
                shootInterval = setInterval(() => socket.emit('shoot', { angle: mouseAngle }), 100);
            });

            DOM.shootBtn?.addEventListener('touchend', () => {
                if (shootInterval) {
                    clearInterval(shootInterval); // FIX 4
                    shootInterval = null;
                }
            });

            DOM.scopeBtn?.addEventListener('touchstart', () => socket.emit('scope', true));
            DOM.scopeBtn?.addEventListener('touchend', () => socket.emit('scope', false));
            DOM.lootBtn?.addEventListener('touchstart', () => socket.emit('interact'));
            DOM.sprintBtn?.addEventListener('touchstart', () => keys['shift'] = true);
            DOM.sprintBtn?.addEventListener('touchend', () => keys['shift'] = false);
            DOM.grenadeBtn?.addEventListener('touchstart', () => socket.emit('grenade', { angle: mouseAngle }));
            DOM.vehicleBtn?.addEventListener('touchstart', () => socket.emit('enterVehicle'));
            DOM.reloadBtn?.addEventListener('touchstart', () => socket.emit('reload'));
        },

        levelUpCheck: () => {
            const xpNeeded = gameState.player.level * 100;
            while (gameState.player.xp >= xpNeeded) {
                gameState.player.xp -= xpNeeded;
                gameState.player.level++;
                Notify.show(`LEVEL UP! You are now level ${gameState.player.level}`);
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
    // 9. AI ADVERSARY - DYNAMIC DIFFICULTY - FIX 38
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
            // FIX 38: Misoroka level negative
            this.level = Math.max(1, targetPlayerLevel + Math.floor(Math.random() * 5) - 2);
            this.angle = 0;
            this.targetAngle = 0;
            this.username = this.name;

            // DYNAMIC DIFFICULTY
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
            return names[Math.floor(Math.random() * names.length)] + suffix + Math.floor(Math.random() * 99);
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
                return proColors[Math.floor(Math.random() * proColors.length)];
            }
            const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ff8800'];
            return colors[Math.floor(Math.random() * colors.length)];
        }

        getRandomHat() {
            if (this.level > 25) {
                const proHats = ['crown', 'viking', 'wizard'];
                return proHats[Math.floor(Math.random() * proHats.length)];
            }
            if (this.level > 10) {
                const midHats = ['helmet', 'cowboy', 'tophat'];
                return midHats[Math.floor(Math.random() * midHats.length)];
            }
            const hats = ['none', 'cap', 'helmet'];
            return hats[Math.floor(Math.random() * hats.length)];
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

            // FIX 22: Memory management
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

            // Execute state
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
                    x: Math.random() * gameState.mapData.width,
                    y: Math.random() * gameState.mapData.height
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
                const x = Math.random() * (mapWidth - 200) + 100;
                const y = Math.random() * (mapHeight - 200) + 100;

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
    // 10. LOBBY & MATCHMAKING - FIXED
    // ============================================
    const Lobby = {
        findMatch: (mode) => {
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
            socket.emit("joinRoom", Utils.sanitizeHTML(code)); // FIX 7
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

    // Socket events for lobby
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

    // ============================================
    // 11. CHAT SYSTEM - FIX 7 XSS
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

    socket.on("chatMessage", (data) => {
        if (data.type === 'lobby') Chat.addLobbyMessage(data);
        else if (data.type === 'room') Chat.addRoomMessage(data);
    });

    // ============================================
    // 12. GAME END
    // ============================================
    window.returnToLobby = () => {
        DOM.victoryScreen?.classList.add('hidden');
        DOM.deathScreen?.classList.add('hidden');
        DOM.scoreboard?.classList.add('hidden');
        DOM.spectateUI?.classList.add('hidden');
        UI.showScreen('lobbyScreen');
        isGameRunning = false;
        if (socket.connected) socket.disconnect();
        setTimeout(() => socket.connect(), 500);
    };

    window.playAgain = () => {
        window.returnToLobby();
        setTimeout(() => Lobby.findMatch(gameState.matchMode), 1000);
    };

    // ============================================
    // 13. INIT & CLEANUP - FIX 28
    // ============================================
    window.addEventListener('load', async () => {
        console.log('MG FIGHTER v4.0 Loaded');
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
    });

    // FIX 28: Cleanup event listeners
    window.addEventListener('beforeunload', () => {
        if (touchShootInterval) clearInterval(touchShootInterval);
        socket.disconnect();
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => {
        if (e.scale!== 1) e.preventDefault();
    }, { passive: false });

    // ============================================
    // 14. EXPOSE GLOBALS FOR HTML
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

    // Instantiate AI Manager
    const aiManager = new AIManager();
    window.aiManager = aiManager;

    console.log('🔥 MG FIGHTER v4.0 - FULL SYSTEM READY');
    console.log('📱 Mobile:', isMobile);
    console.log('🎮 Controls: WASD/Arrows = Move, Mouse = Aim, Click = Shoot, R = Reload, G = Grenade, F = Interact, 1-6 = Weapons');
})();

