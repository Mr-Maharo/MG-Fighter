/*

MG FIGHTER v4.0 - script.js COMPLET FINAL
Map + Sprite Loading + Tile Rendering + Fixes

*/

// ============================================
// 0. GLOBAL FIXES - Apetraho ETO AMBONY INDINDRA
// ============================================

// Fix 1: Functions tsy hita - GLOBAL
window.loadChatMessages = function(chat) {
    const chatBox = document.getElementById('lobbyChatMessages');
    if (chatBox) chatBox.innerHTML = `<p style="color:#666;text-align:center;">${chat.toUpperCase()} chat ready</p>`;
};

window.loadFriendsTab = function(tab) {
    const friendsList = document.getElementById('friendsList');
    if (friendsList) friendsList.innerHTML = `<p style="color:#666;text-align:center;">No ${tab} friends</p>`;
};

window.claimDailyReward = function(day) {
    showToast(`Day ${day} reward claimed! +50 Coins`, 'success');
    if (window.gameState?.player) {
        window.gameState.player.coins += 50;
        document.getElementById('playerCoins').textContent = window.gameState.player.coins;
    }
    event.target.disabled = true;
    event.target.textContent = 'CLAIMED';
};

window.openFullLeaderboard = function() {
    document.getElementById('fullLeaderboard').classList.remove('hidden');
    loadLeaderboardData();
};

window.loadLeaderboardData = function() {
    const tbody = document.getElementById('fullLeaderboardBody');
    if (!tbody) return;
    const mockData = [
        {rank: 1, name: 'ProGamer', level: 50, wins: 120, kills: 2500, kd: 5.2, score: 5000},
        {rank: 2, name: 'EliteSniper', level: 48, wins: 115, kills: 2300, kd: 4.8, score: 4800},
        {rank: 3, name: 'KingSlayer', level: 45, wins: 100, kills: 2100, kd: 4.5, score: 4600},
        {rank: 4, name: 'ShadowStrike', level: 42, wins: 95, kills: 1900, kd: 4.2, score: 4300},
        {rank: 5, name: 'ThunderBolt', level: 40, wins: 88, kills: 1750, kd: 3.9, score: 4100}
    ];
    tbody.innerHTML = mockData.map(p => `
        <tr><td>${p.rank}</td><td>${p.name}</td><td>${p.level}</td><td>${p.wins}</td><td>${p.kills}</td><td>${p.kd}</td><td>${p.score}</td></tr>
    `).join('');
};

window.openInventory = function() {
    document.getElementById('inventoryMenu').classList.remove('hidden');
    const grid = document.getElementById('invSkinsGrid');
    if (grid) grid.innerHTML = '<p style="color:#666;text-align:center;padding:40px;">No items yet. Visit shop!</p>';
};

window.openSettings = function() { document.getElementById('settingsMenu').classList.remove('hidden'); };
window.openShop = function() { 
    document.getElementById('shopMenu').classList.remove('hidden');
    const grid = document.getElementById('shopSkinsGrid');
    if (grid) grid.innerHTML = `
        <div class="shop-item"><div class="item-image">👕</div><h4>Red Skin</h4><p>Rare</p><div class="item-price">100 💰</div><button onclick="buyItem('red_skin', 100)">BUY</button></div>
        <div class="shop-item"><div class="item-image">👑</div><h4>Golden Crown</h4><p>Legendary</p><div class="item-price">500 💰</div><button onclick="buyItem('gold_crown', 500)">BUY</button></div>
    `;
};
window.openProfile = function() { 
    document.getElementById('profileMenu').classList.remove('hidden');
    if (window.gameState) {
        document.getElementById('profileLevel').textContent = window.gameState.player.level || 1;
        document.getElementById('statWins').textContent = window.gameState.player.wins || 0;
        document.getElementById('statKills').textContent = window.gameState.player.kills || 0;
        document.getElementById('statDeaths').textContent = window.gameState.player.deaths || 0;
        document.getElementById('statMatches').textContent = window.gameState.player.matches || 0;
        document.getElementById('profileKDR').textContent = ((window.gameState.player.kills || 0) / (window.gameState.player.deaths || 1)).toFixed(2);
    }
};
window.openMail = function() { 
    document.getElementById('mailMenu').classList.remove('hidden');
    const inbox = document.getElementById('mailInboxList');
    if (inbox) inbox.innerHTML = `<div class="mail-item unread"><div class="mail-item-header"><span class="mail-sender">System</span><span class="mail-date">Today</span></div><div class="mail-subject">Welcome to MG FIGHTER!</div><div class="mail-preview">Thanks for joining. Claim your starter reward!</div></div>`;
};
window.openBattlePass = function() { 
    document.getElementById('battlePassMenu').classList.remove('hidden');
    const container = document.getElementById('bpRewards');
    if (container) {
        let html = '';
        for (let i = 1; i <= 20; i++) {
            html += `<div class="bp-item ${i <= 3 ? 'unlocked' : ''}"><div class="bp-level">${i}</div><div class="bp-reward">🎁</div></div>`;
        }
        container.innerHTML = html;
    }
};

window.buyItem = function(id, price) {
    if (window.gameState?.player?.coins >= price) {
        window.gameState.player.coins -= price;
        document.getElementById('playerCoins').textContent = window.gameState.player.coins;
        showToast('Item purchased!', 'success');
    } else {
        showToast('Not enough coins!', 'error');
    }
};

window.buyBattlePass = function() {
    if (window.gameState?.player?.coins >= 500) {
        window.gameState.player.coins -= 500;
        document.getElementById('playerCoins').textContent = window.gameState.player.coins;
        showToast('Premium Battle Pass unlocked!', 'success');
    } else {
        showToast('Not enough coins! Need 500', 'error');
    }
};

window.addFriend = function() {
    const input = document.getElementById('addFriendInput');
    if (input?.value.trim()) {
        showToast(`Friend request sent to ${input.value}`, 'success');
        input.value = '';
    }
};

window.filterLeaderboard = function(type) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    loadLeaderboardData();
};

window.prevLeaderboardPage = () => showToast('Previous page', 'info');
window.nextLeaderboardPage = () => showToast('Next page', 'info');

window.saveUsername = function() {
    const newName = document.getElementById('profileUsername').value;
    if (newName && newName.length >= 3) {
        document.getElementById('playerName').textContent = newName;
        if (window.gameState) window.gameState.player.name = newName;
        showToast('Username updated!', 'success');
    } else {
        showToast('Username must be 3+ characters', 'error');
    }
};

window.saveSettings = function() { showToast('Settings saved!', 'success'); closeSettings(); };
window.resetSettings = function() { showToast('Settings reset!', 'info'); };
window.resetControls = function() { showToast('Controls reset to default', 'info'); };
window.claimAllMail = function() { showToast('All rewards claimed!', 'success'); document.getElementById('mailBadge').classList.add('hidden'); };
window.deleteReadMail = function() { showToast('Read mail deleted', 'info'); };
window.spectate = function() { document.getElementById('deathScreen').classList.add('hidden'); document.getElementById('spectateUI').classList.remove('hidden'); showToast('Spectating...', 'info'); };
window.nextSpectate = function() { showToast('Switching player...', 'info'); };
window.closeSkinMenu = () => document.getElementById('skinMenu').classList.add('hidden');
window.closeBattlePass = () => document.getElementById('battlePassMenu').classList.add('hidden');
window.closeShop = () => document.getElementById('shopMenu').classList.add('hidden');
window.closeInventory = () => document.getElementById('inventoryMenu').classList.add('hidden');
window.closeSettings = () => document.getElementById('settingsMenu').classList.add('hidden');
window.closeProfile = () => document.getElementById('profileMenu').classList.add('hidden');
window.closeMail = () => document.getElementById('mailMenu').classList.add('hidden');
window.closeFullLeaderboard = () => document.getElementById('fullLeaderboard').classList.add('hidden');
window.closeTerms = () => document.getElementById('termsModal').classList.add('hidden');
window.closePrivacy = () => document.getElementById('privacyModal').classList.add('hidden');
window.closeCredits = () => document.getElementById('creditsScreen').classList.add('hidden');
window.showTerms = () => document.getElementById('termsModal').classList.remove('hidden');
window.showPrivacy = () => document.getElementById('privacyModal').classList.remove('hidden');
window.showSkinTab = function(tab) {
    document.querySelectorAll('.skin-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.skin-tab').forEach(el => el.classList.remove('active'));
    document.getElementById('skin' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab').classList.remove('hidden');
    event.target.classList.add('active');
};
window.showShopTab = function(tab) {
    document.querySelectorAll('.shop-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.shop-tab').forEach(el => el.classList.remove('active'));
    document.getElementById('shop' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab').classList.remove('hidden');
    event.target.classList.add('active');
};
window.showInvTab = function(tab) {
    document.querySelectorAll('.inv-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.inv-tab').forEach(el => el.classList.remove('active'));
    document.getElementById('inv' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab').classList.remove('hidden');
    event.target.classList.add('active');
};
window.showMailTab = function(tab) {
    document.querySelectorAll('.mail-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.mail-tab').forEach(el => el.classList.remove('active'));
    document.getElementById('mail' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab').classList.remove('hidden');
    event.target.classList.add('active');
};
window.switchChat = function(chat) {
    document.querySelectorAll('.chat-tab').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
    loadChatMessages(chat);
};
window.showFriendsTab = function(tab) {
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
    loadFriendsTab(tab);
};
window.changeSkinColor = function(color) {
    if (window.gameState) window.gameState.player.skin.color = color;
    socket.emit("changeSkin", window.gameState?.player?.skin);
    showToast('Skin color changed!');
};
window.changeSkinHat = function(hat) {
    if (window.gameState) window.gameState.player.skin.hat = hat;
    socket.emit("changeSkin", window.gameState?.player?.skin);
    showToast('Hat changed!');
};
window.changeOutfit = function(outfit) { showToast(`Outfit: ${outfit}`, 'info'); };
window.useEmote = function(emote) { showToast(`Emote: ${emote}`, 'info'); };
window.confirmYes = function() { document.getElementById('confirmDialog').classList.add('hidden'); };
window.confirmNo = function() { document.getElementById('confirmDialog').classList.add('hidden'); };
window.changeAvatar = function() { showToast('Avatar change coming soon!', 'info'); };

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
        deaths: 0,
        matches: 0,
        xp: 0,
        bpLevel: 1,
        bpXP: 0,
        rank: "Bronze III",
        skin: { color: '#00ff00', hat: 'none' },
        friends: []
    };

    let gameState = {
        players: {},
        enemies: [],
        bullets: [],
        loot: [],
        vehicles: [],
        zone: { x: 2000, y: 2000, radius: 2000, targetRadius: 2000, timer: 0 },
        aliveCount: 0,
        matchMode: 'solo',
        mapData: { width: 4000, height: 4000, walls: [] }
    };

    // Eo ambanin'ny let gameState
    let aiManager = new AIManager();
    window.aiManager = aiManager;

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
        playerRank: document.getElementById('playerRank'),
        onlineCount: document.getElementById('onlineCount'),
        playerAvatar: document.getElementById('playerAvatar'),
        bpXP: document.getElementById('bpXP'),
        bpLevel: document.getElementById('bpLevel'),
        bpXPText: document.getElementById('bpXPText'),
        battlePassMenu: document.getElementById('battlePassMenu'),
        bpRewards: document.getElementById('bpRewards'),
        roomIdDisplay: document.getElementById('roomIdDisplay'),
        roomCount: document.getElementById('roomCount'),
        roomPlayers: document.getElementById('roomPlayers'),
        readyBtn: document.getElementById('readyBtn'),
        startMatchBtn: document.getElementById('startMatchBtn'),
        roomCode: document.getElementById('roomCode'),
        roomChatMessages: document.getElementById('roomChatMessages'),
        roomChatInput: document.getElementById('roomChatInput'),
        friendsList: document.getElementById('friendsList'),
        addFriendInput: document.getElementById('addFriendInput'),
        lobbyChatMessages: document.getElementById('lobbyChatMessages'),
        lobbyChatInput: document.getElementById('lobbyChatInput'),
        matchmakingMode: document.getElementById('matchmakingMode'),
        playersFound: document.getElementById('playersFound'),
        estimatedTime: document.getElementById('estimatedTime'),
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
        playersAlive: document.getElementById('playersAlive'),
        killFeed: document.getElementById('killFeed'),
        damageNumbers: document.getElementById('damageNumbers'),
        zoneWarning: document.getElementById('zoneWarning'),
        scope: document.getElementById('scope'),
        hitmarker: document.getElementById('hitmarker'),
        lbList: document.getElementById('lbList'),
        aliveCount: document.getElementById('aliveCount'),
        aliveCountLB: document.getElementById('aliveCountLB'),
        scoreboard: document.getElementById('scoreboard'),
        scoreboardBody: document.getElementById('scoreboardBody'),
        victoryScreen: document.getElementById('victoryScreen'),
        deathScreen: document.getElementById('deathScreen'),
        victoryKills: document.getElementById('victoryKills'),
        victoryDamage: document.getElementById('victoryDamage'),
        victoryTime: document.getElementById('victoryTime'),
        victoryReward: document.getElementById('victoryReward'),
        finalRank: document.getElementById('finalRank'),
        finalKills: document.getElementById('finalKills'),
        finalDamage: document.getElementById('finalDamage'),
        finalTime: document.getElementById('finalTime'),
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
        reloadBtn: document.getElementById('reloadBtn'),
        skinMenu: document.getElementById('skinMenu'),
        shopMenu: document.getElementById('shopMenu'),
        inventoryMenu: document.getElementById('inventoryMenu'),
        settingsMenu: document.getElementById('settingsMenu'),
        profileMenu: document.getElementById('profileMenu'),
        mailMenu: document.getElementById('mailMenu'),
        fullLeaderboard: document.getElementById('fullLeaderboard'),
        termsModal: document.getElementById('termsModal'),
        privacyModal: document.getElementById('privacyModal'),
        creditsScreen: document.getElementById('creditsScreen'),
        notificationContainer: document.getElementById('notificationContainer'),
        confirmDialog: document.getElementById('confirmDialog'),
        toastContainer: document.getElementById('toastContainer'),
        spectateUI: document.getElementById('spectateUI'),
        spectatePlayerName: document.getElementById('spectatePlayerName'),
        mailBadge: document.getElementById('mailBadge'),
        mailInboxList: document.getElementById('mailInboxList'),
        mailSentList: document.getElementById('mailSentList'),
        mailRewardsList: document.getElementById('mailRewardsList'),
        fullLeaderboardBody: document.getElementById('fullLeaderboardBody'),
        leaderboardPage: document.getElementById('leaderboardPage'),
        bpLevelDisplay: document.getElementById('bpLevelDisplay'),
        bpXPBar: document.getElementById('bpXPBar'),
        bpCurrentXP: document.getElementById('bpCurrentXP'),
        bpRequiredXP: document.getElementById('bpRequiredXP'),
        shopFeaturedTab: document.getElementById('shopFeaturedTab'),
        shopSkinsTab: document.getElementById('shopSkinsTab'),
        shopWeaponsTab: document.getElementById('shopWeaponsTab'),
        shopBundlesTab: document.getElementById('shopBundlesTab'),
        shopSkinsGrid: document.getElementById('shopSkinsGrid'),
        shopWeaponsGrid: document.getElementById('shopWeaponsGrid'),
        shopBundlesGrid: document.getElementById('shopBundlesGrid'),
        invSkinsTab: document.getElementById('invSkinsTab'),
        invWeaponsTab: document.getElementById('invWeaponsTab'),
        invEmotesTab: document.getElementById('invEmotesTab'),
        invItemsTab: document.getElementById('invItemsTab'),
        invSkinsGrid: document.getElementById('invSkinsGrid'),
        invWeaponsGrid: document.getElementById('invWeaponsGrid'),
        invEmotesGrid: document.getElementById('invEmotesGrid'),
        invItemsGrid: document.getElementById('invItemsGrid'),
        mailInboxTab: document.getElementById('mailInboxTab'),
        mailSentTab: document.getElementById('mailSentTab'),
        mailRewardsTab: document.getElementById('mailRewardsTab'),
        profileAvatarLarge: document.getElementById('profileAvatarLarge'),
        profileUsername: document.getElementById('profileUsername'),
        profileLevel: document.getElementById('profileLevel'),
        profileRank: document.getElementById('profileRank'),
        profileKDR: document.getElementById('profileKDR'),
        statWins: document.getElementById('statWins'),
        statKills: document.getElementById('statKills'),
        statDeaths: document.getElementById('statDeaths'),
        statMatches: document.getElementById('statMatches'),
        statDamage: document.getElementById('statDamage'),
        statTime: document.getElementById('statTime'),
        achievementsGrid: document.getElementById('achievementsGrid'),
        sensitivitySlider: document.getElementById('sensitivitySlider'),
        sensitivityValue: document.getElementById('sensitivityValue'),
        autoSprintToggle: document.getElementById('autoSprintToggle'),
        aimAssistToggle: document.getElementById('aimAssistToggle'),
        masterVolume: document.getElementById('masterVolume'),
        masterVolumeValue: document.getElementById('masterVolumeValue'),
        musicVolume: document.getElementById('musicVolume'),
        musicVolumeValue: document.getElementById('musicVolumeValue'),
        sfxVolume: document.getElementById('sfxVolume'),
        sfxVolumeValue: document.getElementById('sfxVolumeValue'),
        voiceChatToggle: document.getElementById('voiceChatToggle'),
        graphicsQuality: document.getElementById('graphicsQuality'),
        fpsLimit: document.getElementById('fpsLimit'),
        showFPSToggle: document.getElementById('showFPSToggle'),
        fullscreenToggle: document.getElementById('fullscreenToggle'),
        showMinimapToggle: document.getElementById('showMinimapToggle'),
        showDamageToggle: document.getElementById('showDamageToggle'),
        confirmTitle: document.getElementById('confirmTitle'),
        confirmMessage: document.getElementById('confirmMessage'),
        loadingScreen: document.getElementById('loadingScreen'),
        loadingText: document.getElementById('loadingText'),
        skinColorsTab: document.getElementById('skinColorsTab'),
        skinHatsTab: document.getElementById('skinHatsTab'),
        skinOutfitsTab: document.getElementById('skinOutfitsTab'),
        skinEmotesTab: document.getElementById('skinEmotesTab'),
        roomMode: document.getElementById('roomMode'),
        roomMap: document.getElementById('roomMap')
    };

// =====================================
// 2. ASSET LOADING - FIXED
// =====================================
let mapTiles = [];
let mapLoaded = false;
let spriteImage = null;
let spriteData = null;

async function loadAssets() {
    try {
        console.log('🔄 Loading assets...');

        // 1. LOAD MAP.JSON
        const mapResponse = await fetch('map.json');
        if (mapResponse.ok) {
            const mapData = await mapResponse.json();
            gameState.mapData = mapData;
            mapTiles = mapData.tiles || [];
            mapLoaded = true;
            console.log('✅ Map.json loaded:', mapTiles.length, 'tiles');
        } else {
            console.warn('⚠️ map.json not found');
        }

        // 2. LOAD SPRITE.JSON
        const spriteResponse = await fetch('sprite.json');
        if (spriteResponse.ok) {
            spriteData = await spriteResponse.json();
            console.log('✅ sprite.json loaded');
        } else {
            console.warn('⚠️ sprite.json not found');
        }

        // 3. LOAD MAP.PNG - AMPIRINAO IZAO
        const mapImg = new Image();
        mapImg.src = 'map.png';
        mapImg.onload = () => {
            console.log('✅ map.png loaded:', mapImg.width, 'x', mapImg.height);
            gameState.mapImage = mapImg;
        };
        mapImg.onerror = () => {
            console.warn('⚠️ map.png not found - using tiles only');
        };

        // 4. LOAD SPRITES.PNG - AMPIRINAO IZAO
        spriteImage = new Image();
        spriteImage.src = 'sprites.png';
        spriteImage.onload = () => {
            console.log('✅ sprites.png loaded:', spriteImage.width, 'x', spriteImage.height);
        };
        spriteImage.onerror = () => {
            console.warn('⚠️ sprites.png not found - using colored rectangles');
        };

        console.log('✅ Assets loading complete');

    } catch (error) {
        console.error('❌ Error loading assets:', error);
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

    window.showToast = function(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        DOM.toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

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

    function getDistance(x1, y1, x2, y2) {
        return Math.hypot(x2 - x1, y2 - y1);
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
                    level: 1, coins: 100, wins: 0, kills: 0, deaths: 0, matches: 0, xp: 0,
                    bpLevel: 1, bpXP: 0, rank: "Bronze III",
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

    window.loginAnonymously = async function() {
        try {
            const result = await auth.signInAnonymously();
            const user = result.user;
            currentUser = "Guest" + Math.floor(Math.random() * 10000);
            currentUserId = user.uid;

            playerData = {
                username: currentUser,
                level: 1, coins: 100, wins: 0, kills: 0, deaths: 0, matches: 0, xp: 0,
                bpLevel: 1, bpXP: 0, rank: "Bronze III",
                skin: { color: '#00ff00', hat: 'none' },
                friends: [],
                isGuest: true
            };

            updateLobbyUI();
            showScreen('lobbyScreen');

            socket.connect();
            socket.emit("joinGame", {
                username: currentUser,
                uid: currentUserId,
                skin: playerData.skin
            });

        } catch (err) {
            console.error("GUEST LOGIN ERROR:", err);
            DOM.authError.textContent = 'Guest login failed.';
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
        DOM.playerRank.textContent = playerData.rank;
        DOM.bpLevel.textContent = playerData.bpLevel;
        DOM.bpXP.style.width = `${(playerData.bpXP % 100)}%`;
        DOM.bpXPText.textContent = `${playerData.bpXP % 100}/100 XP`;
        if (playerData.photo) {
            DOM.playerAvatar.style.backgroundImage = `url(${playerData.photo})`;
            DOM.playerAvatar.style.backgroundSize = 'cover';
        }
        loadFriendsList();
    }

    async function savePlayerData() {
        if (!currentUserId || playerData.isGuest) return;
        await db.collection("players").doc(currentUserId).update(playerData);
    }

    // =====================================
    // 6. SOCKET.IO EVENTS
    // =====================================
    socket.on("connect", () => {
        myId = socket.id;
        console.log("✅ Connected:", myId);
        showToast('Connected to server!', 'success');
    });

    socket.on("disconnect", () => {
        console.log('❌ Disconnected from server');
        if (isGameRunning) {
            showNotification('Connection lost! Reconnecting...', true);
        }
    });

    socket.on("connect_error", (error) => {
        console.error('❌ Connection error:', error);
        showNotification('Server connection failed!', true);
        DOM.authError.textContent = 'Server offline. Try again later.';
    });

    socket.on("reconnect", (attemptNumber) => {
        console.log('✅ Reconnected to server');
        showNotification('Reconnected!', 'success');
        if (currentUser) {
            socket.emit("joinGame", {
                username: currentUser,
                uid: currentUserId,
                skin: playerData.skin
            });
        }
    });

    socket.on("reconnect_attempt", () => {
        console.log('🔄 Reconnecting...');
    });

    socket.on("onlineCount", (count) => {
        DOM.onlineCount.textContent = count;
    });

    socket.on("playersUpdate", (players) => {
        gameState.players = players;
        gameState.aliveCount = Object.values(players).filter(p => p.hp > 0).length;
        DOM.aliveCount.textContent = gameState.aliveCount;
        DOM.aliveCountLB.textContent = gameState.aliveCount;
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
        showToast('Match Started!', 'success');
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
            DOM.finalDamage.textContent = data.damage || 0;
            DOM.finalTime.textContent = formatTime(data.time || 0);
            DOM.finalReward.textContent = `+${data.coins} Coins +${data.xp} XP`;
            DOM.deathScreen.classList.remove('hidden');

            playerData.coins += data.coins;
            playerData.xp += data.xp;
            playerData.kills += data.kills;
            playerData.deaths++;
            playerData.matches++;
            levelUpCheck();
            savePlayerData();
            updateLobbyUI();
        }
    });

    socket.on("victory", (data) => {
        isGameRunning = false;
        DOM.victoryKills.textContent = data.kills;
        DOM.victoryDamage.textContent = data.damage || 0;
        DOM.victoryTime.textContent = formatTime(data.time || 0);
        DOM.victoryReward.textContent = `+${data.coins} Coins +${data.xp} XP`;
        DOM.victoryScreen.classList.remove('hidden');

        playerData.coins += data.coins;
        playerData.xp += data.xp;
        playerData.wins++;
        playerData.kills += data.kills;
        playerData.matches++;
        levelUpCheck();
        savePlayerData();
        updateLobbyUI();
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
        showToast('Friends list updated!', 'info');
    });

    socket.on("friendRequest", (data) => {
        showNotification(`Friend request from ${data.username}!`, false);
    });

    socket.on("friendInvite", (data) => {
        showNotification(`${data.username} invited you to play!`, false);
    });

    socket.on("matchmakingUpdate", (data) => {
        if (DOM.playersFound) DOM.playersFound.textContent = data.found;
        if (DOM.estimatedTime) DOM.estimatedTime.textContent = formatTime(data.eta);
    });

    socket.on("matchmakingFailed", (reason) => {
        showNotification(`Matchmaking failed: ${reason}`, true);
        showScreen('lobbyScreen');
    });

    socket.on("roomError", (error) => {
        showNotification(`Room error: ${error}`, true);
    });

    socket.on("kickedFromRoom", () => {
        showNotification('You were kicked from the room', true);
        DOM.roomScreen.classList.add('hidden');
        roomState = { id: null, players: [], isReady: false };
    });

    socket.on("serverMessage", (msg) => {
        showNotification(msg.text, msg.type === 'error');
    });

    socket.on("levelUp", (data) => {
        showNotification(`LEVEL UP! You are now level ${data.level}`, false);
        playerData.level = data.level;
        updateLobbyUI();
    });

    socket.on("achievementUnlocked", (data) => {
        showNotification(`🏆 Achievement Unlocked: ${data.name}`, false);
    });

    socket.on("battlePassLevelUp", (data) => {
        showNotification(`Battle Pass Level ${data.level} unlocked!`, false);
        playerData.bpLevel = data.level;
        updateLobbyUI();
    });

    socket.on("itemUnlocked", (data) => {
        showNotification(`New item unlocked: ${data.name}!`, false);
    });

    socket.on("coinsEarned", (amount) => {
        playerData.coins += amount;
        DOM.playerCoins.textContent = playerData.coins;
        showToast(`+${amount} Coins!`, 'success');
    });

    socket.on("xpEarned", (amount) => {
        playerData.xp += amount;
        levelUpCheck();
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

    window.startMatch = function() {
        socket.emit("startMatch");
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
        const isHost = roomState.host === myId;
        DOM.startMatchBtn.classList.toggle('hidden',!isHost ||!allReady);
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
            if (reward.level <= playerData.bpLevel) div.classList.add('claimed');
            let icon = '💰';
            if (reward.type === 'skin') icon = '🎨';
            else if (reward.type === 'hat') icon = '👑';
            else if (reward.type === 'title') icon = '🏆';
            div.innerHTML = `
                <div class="bp-level">LV ${reward.level}</div>
                <div class="bp-reward">${icon}</div>
                <div style="font-size:11px">${reward.type === 'coins'? reward.amount : reward.item}</div>
            `;
            if (reward.level <= playerData.bpLevel &&!div.classList.contains('claimed')) {
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
        renderBattlePass();
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


        if (aiManager && isGameRunning) {
        aiManager.update(dt, gameState, gameState.players);
        const aiBots = aiManager.getAllBots();
        aiBots.forEach(bot => {
            gameState.players[bot.id] = bot;
        });
    }
        handleInput();
    }

    function renderGame() {
        if (!ctx) return;

        // Clear
        ctx.fillStyle = '#0a1a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw tiles from map.json
        if (mapLoaded && mapTiles.length > 0) {
        const startX = Math.floor(camera.x / TILE_SIZE) - 1;
        const startY = Math.floor(camera.y / TILE_SIZE) - 1;
        const endX = Math.ceil((camera.x + canvas.width) / TILE_SIZE) + 1;
        const endY = Math.ceil((camera.y + canvas.height) / TILE_SIZE) + 1;

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const tileIndex = y * (gameState.mapData.width / TILE_SIZE) + x;
                if (tileIndex >= 0 && tileIndex < mapTiles.length) {
                    const tile = mapTiles[tileIndex];
                    if (!tile) continue;

                    const drawX = tile.x - camera.x;
                    const drawY = tile.y - camera.y;

                    // DRAW SPRITE IF AVAILABLE
                    if (tile.spriteId && spriteData?.tiles?.[tile.spriteId] && spriteImage?.complete) {
                        const sprite = spriteData.tiles[tile.spriteId];
                        ctx.drawImage(
                            spriteImage,
                            sprite.x, sprite.y, sprite.w, sprite.h,
                            drawX, drawY, tile.s, tile.s
                        );
                    } else {
                        // FALLBACK COLOR
                        if (tile.collision) ctx.fillStyle = '#444';
                        else if (tile.swimmable) ctx.fillStyle = '#0088ff';
                        else ctx.fillStyle = '#2a';
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

        // Draw loot - ✅ FIXED
        gameState.loot.forEach(l => {
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(l.x - camera.x - 10, l.y - camera.y - 10, 20, 20);
        });

        // Draw vehicles - ✅ FIXED
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
            ctx.ellipse(x, y + 15, 15, 8, 0, Math.PI * 2);
            ctx.fill();

            // Body
            ctx.fillStyle = isMe? playerData.skin.color : '#ff4444';
            ctx.fillRect(x - 12, y - 12, 24);

            // Hat
            if (p.skin?.hat && p.skin.hat!== 'none') {
                ctx.font = '20px Arial';
                const hatEmoji = { crown: '👑', helmet: '🪖', cap: '🧢' }[p.skin.hat];
                if (hatEmoji) ctx.fillText(hatEmoji, x - 10, y - 15);
            }

            // Weapon sprite
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

        const scale = 180 / (gameState.mapData.width || 4000);

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
        DOM.reloadBtn.addEventListener('touchstart', () => socket.emit('reload'));

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
        DOM.spectateUI.classList.add('hidden');
        showScreen('lobbyScreen');
        isGameRunning = false;
        if (socket.connected) socket.disconnect();
        setTimeout(() => socket.connect(), 500);
    };

    window.playAgain = function() {
        returnToLobby();
        setTimeout(() => findMatch(gameState.matchMode), 1000);
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
        DOM.loadingText.textContent = 'Loading assets...';
        await loadAssets();
        DOM.loadingText.textContent = 'Ready!';
        setTimeout(() => {
            DOM.loadingScreen.classList.add('hidden');
            showScreen('authScreen');
        }, 500);

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
    window.loginAnonymously = loginAnonymously;
    window.findMatch = findMatch;
    window.cancelMatchmaking = cancelMatchmaking;
    window.createRoom = createRoom;
    window.joinRoom = joinRoom;
    window.leaveRoom = leaveRoom;
    window.ready = ready;
    window.startMatch = startMatch;
    window.sendLobbyChat = sendLobbyChat;
    window.sendRoomChat = sendRoomChat;
    window.addFriend = addFriend;
    window.inviteFriend = inviteFriend;
    window.openBattlePass = openBattlePass;
    window.changeSkinColor = changeSkinColor;
    window.changeSkinHat = changeSkinHat;
    window.changeOutfit = changeOutfit;
    window.useEmote = useEmote;
    window.returnToLobby = returnToLobby;
    window.playAgain = playAgain;

    console.log('🔥 MG FIGHTER v4.0 - FULL SYSTEM READY');
    console.log('📱 Mobile:', isMobile);
    console.log('🎮 Controls: WASD/Arrows = Move, Mouse = Aim, Click = Shoot, R = Reload, G = Grenade, F = Interact, 1-6 = Weapons');

})();

/* ============================================
   AI ADVERSARY - DYNAMIC DIFFICULTY
   Manaraka ny niveau an'ilay player
   ============================================ */

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
        this.level = Math.max(1, targetPlayerLevel + Math.floor(Math.random() * 5) - 2); // ±2 levels
        this.angle = 0;
        this.targetAngle = 0;

        // DYNAMIC DIFFICULTY MANARAKA PLAYER LEVEL
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

        // Personality traits - mihamafy rehefa miakatra level
        this.personality = this.generatePersonality();
        this.skin = {
            color: this.getRandomColor(),
            hat: this.getRandomHat()
        };
    }

    calculateDifficulty() {
        // Level 1-5: easy, 6-15: medium, 16-30: hard, 31+: pro
        if (this.playerLevel <= 5) return 'easy';
        if (this.playerLevel <= 15) return 'medium';
        if (this.playerLevel <= 30) return 'hard';
        return 'pro';
    }

    generateBotName() {
        const names = [
            'ShadowHunter', 'ProSniper', 'EliteWarrior', 'NightStalker', 'ThunderBolt',
            'CrimsonViper', 'IronFist', 'GhostRider', 'PhoenixRising', 'WolfPack',
            'StormBreaker', 'DarkKnight', 'SilentAssassin', 'FireDragon', 'IceQueen',
            'BloodEagle', 'SteelTitan', 'RapidFire', 'DeathDealer', 'KingSlayer'
        ];
        const suffix = this.playerLevel > 20 ? 'Elite' : this.playerLevel > 10 ? 'Pro' : '';
        return names[Math.floor(Math.random() * names.length)] + suffix + Math.floor(Math.random() * 99);
    }

    getReactionTime() {
        // Mihafaingana rehefa miakatra level
        const base = { easy: 500, medium: 300, hard: 200, pro: 100 };
        const bonus = Math.max(0, 50 - this.playerLevel * 2); // -2ms per level
        return Math.max(50, base[this.difficulty] - bonus);
    }

    getAccuracy() {
        // Mihamarina rehefa miakatra level
        const base = { easy: 0.4, medium: 0.65, hard: 0.8, pro: 0.95 };
        const bonus = Math.min(0.2, this.playerLevel * 0.01); // +1% per level, max 20%
        return Math.min(0.98, base[this.difficulty] + bonus);
    }

    getAggressiveness() {
        // Mihamafy rehefa miakatra level
        const base = { easy: 0.3, medium: 0.6, hard: 0.8, pro: 0.95 };
        const bonus = Math.min(0.15, this.playerLevel * 0.005); // +0.5% per level
        return Math.min(0.98, base[this.difficulty] + bonus);
    }

    getFireRate() {
        const rates = {
            'pistol': 400, 'shotgun': 800, 'smg': 100,
            'rifle': 150, 'sniper': 1200, 'fist': 600
        };
        let rate = rates[this.weapon] || 400;
        // Mihafaingana ny fire rate rehefa miakatra level
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
        // Mihamafy ny loko rehefa miakatra level
        if (this.playerLevel > 30) {
            const proColors = ['#ff0000', '#ff00ff', '#00ffff', '#ffd700', '#ff6600'];
            return proColors[Math.floor(Math.random() * proColors.length)];
        }
        const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ff8800'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    getRandomHat() {
        // Hats tsara kokoa rehefa miakatra level
        if (this.playerLevel > 25) {
            const proHats = ['crown', 'viking', 'wizard'];
            return proHats[Math.floor(Math.random() * proHats.length)];
        }
        if (this.playerLevel > 10) {
            const midHats = ['helmet', 'cowboy', 'tophat'];
            return midHats[Math.floor(Math.random() * midHats.length)];
        }
        const hats = ['none', 'cap', 'helmet'];
        return hats[Math.floor(Math.random() * hats.length)];
    }

    generatePersonality() {
        // Miova ny personality rehefa miakatra level
        const levelFactor = Math.min(1, this.playerLevel / 50);
        return {
            camper: Math.random() < (0.3 - levelFactor * 0.1), // Mihena
            rusher: Math.random() < (0.2 + levelFactor * 0.3), // Mitombo
            sniper: Math.random() < (0.15 + levelFactor * 0.2), // Mitombo
            looter: Math.random() < (0.5 - levelFactor * 0.2), // Mihena
            cautious: Math.random() < (0.4 - levelFactor * 0.2) // Mihena
        };
    }

    // ... TOHINY NY METHODS HAFA (tsy miova) ...

    calculatePower() {
        let power = 0;
        power += this.hp / 100 * 0.4;
        power += this.armor / 100 * 0.3;
        power += this.accuracy * 0.2;
        power += (this.weapon !== 'fist') ? 0.3 : 0;
        power += this.kills * 0.05;
        power += this.level * 0.02; // BONUS LEVEL
        return Math.min(1, power);
    }

    shouldEngage(enemy) {
        if (!enemy) return false;

        const myPower = this.calculatePower();
        const enemyPower = this.calculateThreat(enemy.entity);
        const dist = enemy.distance;

        // Mihamafy ny confidence rehefa miakatra level
        const confidenceBoost = this.level * 0.01;
        
        if (myPower + confidenceBoost < 0.3) return false;
        if (enemyPower > myPower * 1.5) return false;
        if (this.aggressiveness > 0.7) return true;
        if (dist < this.preferredRange * 1.2 && dist > this.preferredRange * 0.5) return true;

        return myPower > enemyPower;
    }

    // ... TOHINY NY METHODS HAFA REHETRA ...
}

/* ============================================
   AI MANAGER - DYNAMIC SPAWN
   ============================================ */
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
        // Tadiavo ny level an'ilay real player
        const realPlayers = Object.values(players).filter(p => !p.isBot);
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

        // SPAWN AI MANARAKA NY LEVEL
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
                const dist = Math.hypot(x - player.x, y - player.y);
                if (dist < minDistFromPlayers) tooClose = true;
            });

            if (!tooClose) {
                const zoneDist = Math.hypot(x - gameState.zone.x, y - gameState.zone.y);
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

// Export
window.AIPlayer = AIPlayer;
window.AIManager = AIManager;

console.log('🤖 AI Adversary System Loaded - Dynamic Difficulty Enabled');

