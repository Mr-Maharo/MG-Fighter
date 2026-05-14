const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.static(__dirname));
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000,
    pingInterval: 25000
});

// ============================================
// 1. CONFIG LOBBY + MATCH
// ============================================
const LOBBY_CONFIG = {
    MIN_REAL_PLAYERS: 2,
    MAX_PLAYERS: 30,
    COUNTDOWN_TIME: 20, // 20s salle
    MAP_SIZE: 3000
};

const MATCH_CONFIG = {
    BR: { ZONE_START: 2900, ZONE_END: 500, TOTAL_TIME: 600 }, // 10min
    CS: { ZONE_START: 2400, ZONE_END: 800, TOTAL_TIME: 300 } // 5min
};

let lobby = {
    state: 'waiting',
    realPlayers: [],
    bots: [],
    countdown: 20,
    matchId: null,
    mode: 'BR'
};

// ============================================
// 2. ADMIN SYSTEM
// ============================================
const ADMIN_USERS = ['AdminMG', 'tony'];
const ADMIN_IPS = [];
const ADMIN_TOKENS = new Map();

// ============================================
// 3. ANTI-CHEAT
// ============================================
const ANTI_CHEAT = {
    MAX_MOVE_SPEED: 350,
    MAX_MOVE_TOLERANCE: 1.5,
    MAX_SHOOT_RATE: 20,
    MAX_GRENADES_SEC: 0.5,
    MAX_CHAT_RATE: 3,
    MAX_JOIN_ROOM_RATE: 2
};

const rateLimits = {
    move: new Map(),
    shoot: new Map(),
    grenade: new Map(),
    chat: new Map(),
    joinRoom: new Map()
};

function checkRateLimit(socketId, type, maxPerSec) {
    const now = Date.now();
    if (!rateLimits[type].has(socketId)) {
        rateLimits[type].set(socketId, []);
    }
    const timestamps = rateLimits[type].get(socketId);
    const oneSecAgo = now - 1000;
    while (timestamps.length > 0 && timestamps[0] < oneSecAgo) {
        timestamps.shift();
    }
    if (timestamps.length >= maxPerSec) return false;
    timestamps.push(now);
    return true;
}

function clearRateLimits(socketId) {
    Object.keys(rateLimits).forEach(type => {
        rateLimits[type].delete(socketId);
    });
}

// ============================================
// 4. LOAD MAP
// ============================================
let MAP_DATA = {
    width: 3000,
    height: 3000,
    tiles: [],
    walls: [],
    waterTiles: [],
    spawnPoints: []
};

try {
    const mapPath = path.join(__dirname, 'map.json');
    if (fs.existsSync(mapPath)) {
        const rawMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
        MAP_DATA.tiles = rawMap.filter(t => t && typeof t.x === 'number');

        MAP_DATA.tiles.forEach(tile => {
            if (tile.collision) {
                MAP_DATA.walls.push({
                    x: tile.x, y: tile.y,
                    width: tile.s || 32, height: tile.s || 32
                });
            }
            if (tile.swimmable) {
                MAP_DATA.waterTiles.push({
                    x: tile.x, y: tile.y,
                    width: tile.s || 32, height: tile.s || 32
                });
            }
        });

        for (let i = 0; i < 30; i++) {
            MAP_DATA.spawnPoints.push({
                x: 1000 + Math.random() * 1000,
                y: 1000 + Math.random() * 1000
            });
        }
        console.log('✅ Map loaded');
    }
} catch (err) {
    console.error('❌ Error loading map:', err.message);
}

// ============================================
// 5. LOAD SPRITES
// ============================================
let SPRITE_DATA = {
    tileSize: 50, tiles: {}, weapons: {}, characters: {}, items: {}
};

try {
    const spritePath = path.join(__dirname, 'sprite.json');
    if (fs.existsSync(spritePath)) {
        SPRITE_DATA = JSON.parse(fs.readFileSync(spritePath, 'utf8'));
        console.log('✅ Sprite loaded');
    }
} catch (err) {
    console.error('❌ Error loading sprite:', err.message);
}

// ============================================
// 6. GAME CONFIG
// ============================================
const CONFIG = {
    MAP_SIZE: 3000,
    TICK_RATE: 20,
    PLAYER_SPEED: 200,
    PLAYER_SPRINT_SPEED: 320,
    PLAYER_SWIM_SPEED: 120,
    PLAYER_HP: 100,
    PLAYER_ARMOR_MAX: 100,
    ZONE_DAMAGE: 5,
    WEAPONS: {
        fist: { damage: 15, range: 50, fireRate: 500, ammo: Infinity, bulletSpeed: 0 },
        pistol: { damage: 25, range: 400, fireRate: 300, ammo: 12, bulletSpeed: 600 },
        shotgun: { damage: 16, range: 150, fireRate: 800, ammo: 8, pellets: 5, bulletSpeed: 400, spread: 0.3 },
        smg: { damage: 18, range: 300, fireRate: 100, ammo: 30, bulletSpeed: 700 },
        rifle: { damage: 35, range: 600, fireRate: 150, ammo: 30, bulletSpeed: 900 },
        sniper: { damage: 90, range: 1000, fireRate: 1200, ammo: 5, bulletSpeed: 1200 }
    },
    LOOT_SPAWN_COUNT: 50,
    VEHICLE_SPAWN_COUNT: 8,
    GRENADE_DAMAGE: 75,
    GRENADE_RADIUS: 100
};

// ============================================
// 7. GLOBAL STATE
// ============================================
let players = {};
let matches = {};
let rooms = {};

// ============================================
// 8. UTILS
// ============================================
function checkWallCollision(x, y, radius = 12) {
    if (typeof x!== 'number' || typeof y!== 'number') return true;
    x = Math.max(0, Math.min(MAP_DATA.width, x));
    y = Math.max(0, Math.min(MAP_DATA.height, y));
    for (const wall of MAP_DATA.walls) {
        if (x + radius > wall.x && x - radius < wall.x + wall.width &&
            y + radius > wall.y && y - radius < wall.y + wall.height) {
            return true;
        }
    }
    return false;
}

function checkWaterTile(x, y) {
    for (const water of MAP_DATA.waterTiles) {
        if (x > water.x && x < water.x + water.width &&
            y > water.y && y < water.y + water.height) {
            return true;
        }
    }
    return false;
}

function getDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

function sanitizeString(str, maxLen = 50) {
    if (typeof str!== 'string') return '';
    return str.substring(0, maxLen).replace(/[<>'"]/g, '').trim();
}

function sanitizeUsername(username) {
    return sanitizeString(username, 20).replace(/[^a-zA-Z0-9_]/g, '') || 'Player';
}

// ============================================
// 9. CREATE ENTITIES
// ============================================
function createPlayer(socketId, data) {
    return {
        id: socketId,
        uid: data.uid || null,
        username: sanitizeUsername(data.username),
        x: 1500, y: 1500, angle: 0,
        hp: CONFIG.PLAYER_HP,
        armor: 0,
        weapon: data.startWeapon || 'pistol',
        ammo: CONFIG.WEAPONS[data.startWeapon || 'pistol'].ammo,
        grenades: 2,
        medkits: 0,
        kills: 0, damage: 0,
        level: Math.max(1, Math.min(100, data.level || 1)),
        xp: 0,
        skin: {
            color: /^#[0-9A-F]{6}$/i.test(data.skin?.color)? data.skin.color : '#00ff00',
            hat: ['none','cap','helmet','crown'].includes(data.skin?.hat)? data.skin.hat : 'none'
        },
        matchId: null, roomId: null, inVehicle: null,
        isScoping: false, isSwimming: false,
        lastShot: 0, lastMove: Date.now(), lastGrenade: 0,
        velocity: { x: 0, y: 0 },
        isSprinting: false,
        friends: [],
        isBot: false,
        inLobby: true
    };
}

function createLoot(x, y) {
    const types = ['weapon_pistol', 'weapon_shotgun', 'weapon_smg', 'weapon_rifle', 'weapon_sniper',
                   'ammo_light', 'ammo_heavy', 'armor', 'medkit', 'grenade'];
    const type = types[Math.floor(Math.random() * types.length)];
    return { id: uuidv4(), type: type, x: x, y: y, picked: false };
}

function createVehicle(x, y) {
    return {
        id: uuidv4(), x: x, y: y, angle: 0, speed: 0,
        hp: 200, driver: null, passengers: [], type: 'motorcycle'
    };
}

// ============================================
// 10. LOBBY FUNCTIONS
// ============================================
function startMatchCountdown() {
    lobby.state = 'countdown';
    lobby.countdown = LOBBY_CONFIG.COUNTDOWN_TIME;
    lobby.matchId = Date.now().toString();

    const countdownInterval = setInterval(() => {
        lobby.countdown--;
        io.emit('lobbyCountdown', { time: lobby.countdown });
        if (lobby.countdown <= 0) {
            clearInterval(countdownInterval);
            startMatch();
        }
    }, 1000);
}

function startMatch() {
    lobby.state = 'ingame';
    const hasSquads = lobby.realPlayers.some(id => players[id]?.squadId);
    lobby.mode = hasSquads? 'CS' : 'BR';
    const cfg = MATCH_CONFIG[lobby.mode];

    // Fenoina bots ho 30
    const botsNeeded = LOBBY_CONFIG.MAX_PLAYERS - lobby.realPlayers.length;
    for (let i = 0; i < botsNeeded; i++) {
        const botId = 'bot_' + i + '_' + Date.now();
        lobby.bots.push(botId);
        players[botId] = {
            id: botId, uid: botId, username: 'BOT_' + (i + 1),
            x: 1000 + Math.random() * 1000, y: 1000 + Math.random() * 1000,
            hp: 100, armor: 0, weapon: 'fist', ammo: Infinity,
            skin: { color: '#888888', hat: 'none' }, level: 1,
            squadId: null, team: null, angle: 0, isMoving: false, isSprinting: false,
            isBot: true, inLobby: false, kills: 0, xp: 0, matchId: lobby.matchId,
            grenades: 0, medkits: 0
        };
    }

    // Teleport vraie players
    lobby.realPlayers.forEach(playerId => {
        const p = players[playerId];
        if (p) {
            p.inLobby = false;
            p.matchId = lobby.matchId;
            p.x = 1200 + Math.random() * 600;
            p.y = 1200 + Math.random() * 600;
        }
    });

    // Zone
    const shrinkDistance = cfg.ZONE_START - cfg.ZONE_END;
    const matchZone = {
        x: 1500, y: 1500,
        radius: cfg.ZONE_START,
        targetRadius: cfg.ZONE_END,
        shrinkSpeed: shrinkDistance / cfg.TOTAL_TIME,
        isActive: true,
        startTime: Date.now(),
        totalTime: cfg.TOTAL_TIME
    };

    matches[lobby.matchId] = {
        id: lobby.matchId,
        players: players,
        zone: matchZone,
        bullets: [],
        loot: [],
        vehicles: [],
        state: 'active'
    };

    // Spawn loot + vehicles
    for (let i = 0; i < CONFIG.LOOT_SPAWN_COUNT; i++) {
        let x, y, attempts = 0;
        do {
            x = Math.random() * CONFIG.MAP_SIZE;
            y = Math.random() * CONFIG.MAP_SIZE;
            attempts++;
        } while (checkWallCollision(x, y, 10) && attempts < 50);
        if (attempts < 50) matches[lobby.matchId].loot.push(createLoot(x, y));
    }

    for (let i = 0; i < CONFIG.VEHICLE_SPAWN_COUNT; i++) {
        let x, y, attempts = 0;
        do {
            x = Math.random() * CONFIG.MAP_SIZE;
            y = Math.random() * CONFIG.MAP_SIZE;
            attempts++;
        } while (checkWallCollision(x, y, 30) && attempts < 50);
        if (attempts < 50) matches[lobby.matchId].vehicles.push(createVehicle(x, y));
    }

    io.emit('matchLaunched', {
        mode: lobby.mode,
        totalPlayers: 30,
        realPlayers: lobby.realPlayers.length,
        zoneTime: cfg.TOTAL_TIME
    });

    startBotAI();
    startZoneTimer();
}

function startBotAI() {
    setInterval(() => {
        if (lobby.state!== 'ingame') return;
        lobby.bots.forEach(botId => {
            const bot = players[botId];
            if (!bot || bot.hp <= 0 || bot.inLobby) return;
            if (Math.random() < 0.3) {
                bot.angle = Math.random() * Math.PI * 2;
                bot.isMoving = true;
                bot.x += Math.cos(bot.angle) * 3;
                bot.y += Math.sin(bot.angle) * 3;
                bot.x = Math.max(50, Math.min(2950, bot.x));
                bot.y = Math.max(50, Math.min(2950, bot.y));
            }
            const match = matches[lobby.matchId];
            if (!match) return;
            const distToZone = getDistance(bot.x, bot.y, match.zone.x, match.zone.y);
            if (distToZone > match.zone.radius) {
                bot.hp -= 1;
                if (bot.hp <= 0) io.emit('playerDied', { id: botId, reason: 'zone' });
            }
        });
    }, 200);
}

function startZoneTimer() {
    const zoneInterval = setInterval(() => {
        const match = matches[lobby.matchId];
        if (lobby.state!== 'ingame' ||!match) {
            clearInterval(zoneInterval);
            return;
        }
        const elapsed = (Date.now() - match.zone.startTime) / 1000;
        const timeLeft = Math.max(0, match.zone.totalTime - elapsed);
        if (match.zone.radius > match.zone.targetRadius) {
            match.zone.radius -= match.zone.shrinkSpeed / 10;
        }
        io.emit('zoneUpdate', { timeLeft: Math.floor(timeLeft), radius: Math.floor(match.zone.radius) });
        Object.values(players).forEach(p => {
            if (p.hp > 0 &&!p.inLobby &&!p.isBot && p.matchId === lobby.matchId) {
                const dist = getDistance(p.x, p.y, match.zone.x, match.zone.y);
                if (dist > match.zone.radius) {
                    p.hp -= 0.5;
                    if (p.hp <= 0) io.emit('playerDied', { id: p.id, reason: 'zone' });
                }
            }
        });
        checkMatchEnd();
    }, 100);
}

function checkMatchEnd() {
    const alivePlayers = Object.values(players).filter(p => p.hp > 0 &&!p.inLobby && p.matchId === lobby.matchId);
    const aliveReal = alivePlayers.filter(p =>!p.isBot);
    if (aliveReal.length <= 1 && lobby.state === 'ingame') {
        io.emit('matchEnd', { winner: alivePlayers[0]?.username || 'Nobody', isBot: alivePlayers[0]?.isBot || false });
        setTimeout(() => resetLobby(), 5000);
    }
}

function resetLobby() {
    lobby = { state: 'waiting', realPlayers: [], bots: [], countdown: 20, matchId: null, mode: 'BR' };
    Object.keys(players).forEach(id => {
        if (players[id].isBot) delete players[id];
        else {
            players[id].inLobby = true;
            players[id].matchId = null;
            players[id].hp = CONFIG.PLAYER_HP;
            players[id].armor = 0;
            players[id].kills = 0;
        }
    });
    if (matches[lobby.matchId]) delete matches[lobby.matchId];
    io.emit('returnToLobby', { message: 'Match tapitra. Miandry players vaovao.' });
}

// ============================================
// 11. SOCKET HANDLERS
// ============================================
io.on('connection', (socket) => {
    console.log('✅ Connected:', socket.id);

    // ADMIN
    socket.on('requestAdminAccess', (data) => {
        const player = players[socket.id];
        if (!player) {
            socket.emit('adminAccessResult', { granted: false });
            return;
        }
        const isAdminUser = ADMIN_USERS.includes(player.username);
        const clientIP = socket.handshake.address;
        const isAdminIP = ADMIN_IPS.length === 0 || ADMIN_IPS.includes(clientIP);
        if (isAdminUser && isAdminIP) {
            ADMIN_TOKENS.set(socket.id, Date.now());
            socket.emit('adminAccessResult', { granted: true });
            console.log(`👑 ADMIN GRANTED: ${player.username} (${clientIP})`);
        } else {
            socket.emit('adminAccessResult', { granted: false });
            console.log(`❌ ADMIN DENIED: ${player.username} (${clientIP})`);
        }
    });

    // JOIN GAME -> LOBBY
    socket.on("joinGame", (data) => {
        if (lobby.state === 'ingame') {
            socket.emit('matchInProgress', { message: 'Efa nanomboka. Andraso ny manaraka.' });
            return;
        }
        lobby.realPlayers.push(socket.id);
        players[socket.id] = createPlayer(socket.id, data);
        socket.emit('joinedLobby', {
            players: lobby.realPlayers.length,
            maxPlayers: LOBBY_CONFIG.MAX_PLAYERS,
            countdown: lobby.countdown
        });
        io.emit('lobbyUpdate', {
            realPlayers: lobby.realPlayers.length,
            totalPlayers: lobby.realPlayers.length + lobby.bots.length,
            players: Object.values(players).filter(p => p.inLobby)
        });
        if (lobby.realPlayers.length >= LOBBY_CONFIG.MIN_REAL_PLAYERS && lobby.state === 'waiting') {
            startMatchCountdown();
        }
        io.emit("gameState", { players: players });
        io.emit('onlineCount', Object.keys(players).filter(id =>!players[id].isBot).length);
    });

    // MOVEMENT
    socket.on('move', (data) => {
        const player = players[socket.id];
        if (!player || player.hp <= 0 || player.inLobby) return;
        if (!checkRateLimit(socket.id, 'move', 30)) return;
        if (typeof data.x!== 'number' || typeof data.y!== 'number') return;
        data.x = Math.max(-1, Math.min(1, data.x));
        data.y = Math.max(-1, Math.min(1, data.y));
        data.angle = typeof data.angle === 'number'? data.angle : player.angle;
        data.sprint = Boolean(data.sprint);
        const now = Date.now();
        if (!player.lastMove) player.lastMove = now;
        const dt = (now - player.lastMove) / 1000;
        if (dt < 0.01 || dt > 0.5) { player.lastMove = now; return; }
        const dist = getDistance(player.x, player.y, player.x + data.x * 10, player.y + data.y * 10);
        const maxSpeed = player.isSwimming? CONFIG.PLAYER_SWIM_SPEED : (data.sprint? CONFIG.PLAYER_SPRINT_SPEED : CONFIG.PLAYER_SPEED);
        const maxDist = maxSpeed * dt * ANTI_CHEAT.MAX_MOVE_TOLERANCE;
        if (dist > maxDist) return;
        const speed = maxSpeed;
        const newX = player.x + data.x * speed * dt;
        const newY = player.y + data.y * speed * dt;
        if (!checkWallCollision(newX, player.y, 12)) player.x = newX;
        if (!checkWallCollision(player.x, newY, 12)) player.y = newY;
        player.angle = data.angle;
        player.isSprinting = data.sprint;
        player.x = Math.max(20, Math.min(CONFIG.MAP_SIZE - 20, player.x));
        player.y = Math.max(20, Math.min(CONFIG.MAP_SIZE - 20, player.y));
        player.lastMove = now;
        player.isSwimming = checkWaterTile(player.x, player.y);
    });

    // SHOOT
    socket.on('shoot', (data) => {
        const player = players[socket.id];
        if (!player || player.hp <= 0 || player.inLobby) return;
        if (!checkRateLimit(socket.id, 'shoot', ANTI_CHEAT.MAX_SHOOT_RATE)) return;
        const weapon = CONFIG.WEAPONS[player.weapon];
        const now = Date.now();
        if (now - player.lastShot < weapon.fireRate) return;
        if (weapon.ammo!== Infinity && player.ammo <= 0) return;
        if (typeof data.angle!== 'number') return;
        player.lastShot = now;
        if (weapon.ammo!== Infinity) player.ammo--;
        const bullets = weapon.pellets || 1;
        const match = matches[player.matchId];
        if (!match) return;
        for (let i = 0; i < bullets; i++) {
            const spread = weapon.spread || 0;
            const angle = data.angle + (Math.random() - 0.5) * spread;
            match.bullets.push({
                id: uuidv4(),
                ownerId: socket.id,
                x: player.x, y: player.y,
                vx: Math.cos(angle) * weapon.bulletSpeed,
                vy: Math.sin(angle) * weapon.bulletSpeed,
                damage: weapon.damage,
                lifetime: weapon.range / weapon.bulletSpeed * 1000
            });
        }
    });

    socket.on('scope', (isScoping) => {
        const player = players[socket.id];
        if (player) player.isScoping = Boolean(isScoping);
    });

    socket.on('reload', () => {
        const player = players[socket.id];
        if (!player) return;
        const weapon = CONFIG.WEAPONS[player.weapon];
        if (weapon && weapon.ammo!== Infinity) {
            player.ammo = weapon.ammo;
        }
    });

    // GRENADE
    socket.on('grenade', (data) => {
        const player = players[socket.id];
        if (!player || player.grenades <= 0 || player.inLobby) return;
        if (!checkRateLimit(socket.id, 'grenade', ANTI_CHEAT.MAX_GRENADES_SEC)) return;
        if (typeof data.angle!== 'number') return;
        player.grenades--;
        const grenadeX = player.x + Math.cos(data.angle) * 150;
        const grenadeY = player.y + Math.sin(data.angle) * 150;
        const finalX = Math.max(0, Math.min(CONFIG.MAP_SIZE, grenadeX));
        const finalY = Math.max(0, Math.min(CONFIG.MAP_SIZE, grenadeY));
        setTimeout(() => {
            io.emit('explosion', { x: finalX, y: finalY });
            Object.values(players).forEach(p => {
                if (p.hp <= 0 || p.inLobby) return;
                const dist = getDistance(finalX, finalY, p.x, p.y);
                if (dist < CONFIG.GRENADE_RADIUS) {
                    const damage = CONFIG.GRENADE_DAMAGE * (1 - dist / CONFIG.GRENADE_RADIUS);
                    p.hp = Math.max(0, p.hp - damage);
                    if (p.hp <= 0 && p.id!== socket.id) player.kills++;
                }
            });
        }, 3000);
    });

    // MEDKIT
    socket.on('useMedkit', () => {
        const player = players[socket.id];
        if (!player || player.medkits <= 0 || player.hp >= 100) return;
        player.medkits--;
        player.hp = Math.min(100, player.hp + 75);
        socket.emit('medkitUpdate', { count: player.medkits });
        socket.emit('healEffect', { amount: 75 });
    });

    // INTERACT
    socket.on('interact', () => {
        const player = players[socket.id];
        if (!player || player.inLobby) return;
        const match = matches[player.matchId];
        if (!match) return;
        let nearestLoot = null;
        let nearestDist = 60;
        match.loot.forEach(loot => {
            if (loot.picked) return;
            const dist = getDistance(player.x, player.y, loot.x, loot.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestLoot = loot;
            }
        });
        if (nearestLoot) {
            nearestLoot.picked = true;
            handleLootPickup(player, nearestLoot, match);
        }
    });

    function handleLootPickup(player, loot, match) {
        const lootData = loot.type.split('_');
        const category = lootData[0];
        const item = lootData[1];
        if (category === 'weapon') {
            if (CONFIG.WEAPONS[item]) {
                player.weapon = item;
                player.ammo = CONFIG.WEAPONS[item].ammo;
                io.to(player.id).emit('lootPickup', { type: 'weapon', item: item, playerId: player.id });
            }
        } else if (category === 'ammo') {
            const amount = item === 'light'? 30 : 20;
            player.ammo += amount;
            io.to(player.id).emit('lootPickup', { type: 'ammo', amount: amount, playerId: player.id });
        } else if (loot.type === 'armor') {
            player.armor = Math.min(CONFIG.PLAYER_ARMOR_MAX, player.armor + 50);
            io.to(player.id).emit('lootPickup', { type: 'armor', amount: 50, playerId: player.id });
        } else if (loot.type === 'medkit') {
            player.medkits = Math.min(5, (player.medkits || 0) + 1);
            io.to(player.id).emit('medkitUpdate', { count: player.medkits });
            io.to(player.id).emit('lootPickup', { type: 'medkit', amount: 1, playerId: player.id });
        } else if (loot.type === 'grenade') {
            player.grenades = Math.min(5, player.grenades + 1);
            io.to(player.id).emit('lootPickup', { type: 'grenade', amount: 1, playerId: player.id });
        }
        io.to(player.id).emit('soundEvent', 'pickup');
        match.loot = match.loot.filter(l => l.id!== loot.id);
    }

    // VEHICLE
    socket.on('enterVehicle', () => {
        const player = players[socket.id];
        if (!player || player.inLobby) return;
        const match = matches[player.matchId];
        if (!match) return;
        if (player.inVehicle) {
            const vehicle = match.vehicles.find(v => v.id === player.inVehicle);
            if (vehicle) {
                vehicle.driver = null;
                player.inVehicle = null;
            }
        } else {
            let nearestVehicle = null;
            let nearestDist = 60;
            match.vehicles.forEach(v => {
                if (v.driver) return;
                const dist = getDistance(player.x, player.y, v.x, v.y);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestVehicle = v;
                }
            });
            if (nearestVehicle) {
                nearestVehicle.driver = socket.id;
                player.inVehicle = nearestVehicle.id;
            }
        }
    });

    // WEAPON SWITCH
    socket.on('switchWeapon', (weaponName) => {
        const player = players[socket.id];
        if (!player ||!CONFIG.WEAPONS[weaponName]) return;
        player.weapon = weaponName;
        player.ammo = CONFIG.WEAPONS[weaponName].ammo;
    });

    // SKIN CHANGE
    socket.on('changeSkin', (skin) => {
        const player = players[socket.id];
        if (!player ||!skin) return;
        player.skin = {
            color: /^#[0-9A-F]{6}$/i.test(skin.color)? skin.color : '#00ff00',
            hat: ['none','cap','helmet','crown','viking','wizard','cowboy','tophat'].includes(skin.hat)? skin.hat : 'none'
        };
    });

    // CHAT
    socket.on('chatMessage', (data) => {
        if (!checkRateLimit(socket.id, 'chat', ANTI_CHEAT.MAX_CHAT_RATE)) return;
        const player = players[socket.id];
        if (!player ||!data ||!data.message) return;
        const msg = {
            username: player.username,
            message: sanitizeString(data.message, 200),
            timestamp: Date.now()
        };
        io.emit('chatMessage', {...msg, type: 'lobby' });
    });

    // DISCONNECT
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        const player = players[socket.id];
        if (player) {
            lobby.realPlayers = lobby.realPlayers.filter(id => id!== socket.id);
            if (lobby.realPlayers.length === 0 && lobby.state!== 'waiting') {
                resetLobby();
            }
            delete players[socket.id];
        }
        ADMIN_TOKENS.delete(socket.id);
        clearRateLimits(socket.id);
        io.emit('onlineCount', Object.keys(players).filter(id =>!players[id].isBot).length);
    });
});

// ============================================
// GAME LOOP
// ============================================
setInterval(() => {
    Object.values(matches).forEach(match => {
        if (match.state!== 'active') return;

        // Zone shrink
        match.zone.timer -= 1000 / CONFIG.TICK_RATE;
        if (match.zone.timer <= 0) {
            match.zone.phase++;
            match.zone.targetRadius = Math.max(100, match.zone.radius * 0.5);
            match.zone.timer = 45000;
            const angle = Math.random() * Math.PI * 2;
            const dist = match.zone.radius * 0.3;
            match.zone.x += Math.cos(angle) * dist;
            match.zone.y += Math.sin(angle) * dist;
            match.zone.x = Math.max(match.zone.targetRadius, Math.min(CONFIG.MAP_SIZE - match.zone.targetRadius, match.zone.x));
            match.zone.y = Math.max(match.zone.targetRadius, Math.min(CONFIG.MAP_SIZE - match.zone.targetRadius, match.zone.y));
        }
        if (match.zone.radius > match.zone.targetRadius) match.zone.radius -= 2;

        // Update bullets
        match.bullets = match.bullets.filter(bullet => {
            bullet.x += bullet.vx * (1 / CONFIG.TICK_RATE);
            bullet.y += bullet.vy * (1 / CONFIG.TICK_RATE);
            bullet.lifetime -= 1000 / CONFIG.TICK_RATE;
            if (checkWallCollision(bullet.x, bullet.y, 3)) return false;
            Object.values(match.players).forEach(player => {
                if (player.id === bullet.ownerId || player.hp <= 0) return;
                const dist = getDistance(bullet.x, bullet.y, player.x, player.y);
                if (dist < 15) {
                    let damage = bullet.damage;
                    const headshot = dist < 8;
                    if (headshot) damage *= 2;
                    if (player.armor > 0) {
                        const armorAbsorb = Math.min(player.armor, damage * 0.7);
                        player.armor = Math.max(0, player.armor - armorAbsorb);
                        damage -= armorAbsorb;
                    }
                    player.hp = Math.max(0, player.hp - damage);
                    const owner = match.players[bullet.ownerId];
                    if (owner) {
                        owner.damage += damage;
                        if (player.hp <= 0) {
                            owner.kills++;
                            io.to(match.id).emit('killFeed', {
                                killer: owner.username, victim: player.username, weapon: owner.weapon
                            });
                        }
                    }
                    io.to(bullet.ownerId).emit('hitmarker');
                    io.to(player.id).emit('damageNumber', {
                        x: player.x, y: player.y, damage: Math.floor(damage), isHeadshot: headshot
                    });
                    bullet.lifetime = 0;
                }
            });
            return bullet.lifetime > 0 && bullet.x > 0 && bullet.x < CONFIG.MAP_SIZE && bullet.y > 0 && bullet.y < CONFIG.MAP_SIZE;
        });

        // Zone damage + swim check
        Object.values(match.players).forEach(player => {
            if (player.hp <= 0) return;
            const dist = getDistance(player.x, player.y, match.zone.x, match.zone.y);
            if (dist > match.zone.radius) {
                player.hp = Math.max(0, player.hp - CONFIG.ZONE_DAMAGE * (1 / CONFIG.TICK_RATE));
            }
            player.isSwimming = checkWaterTile(player.x, player.y);
        });

        // Broadcast
        io.to(match.id).emit('gameUpdate', {
            players: match.players,
            bullets: match.bullets,
            loot: match.loot,
            vehicles: match.vehicles,
            zone: match.zone,
            aliveCount: Object.values(match.players).filter(p => p.hp > 0).length
        });
    });
}, 1000 / CONFIG.TICK_RATE);

// ============================================
// EXPRESS ROUTES
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/map', (req, res) => {
    res.json({
        width: MAP_DATA.width,
        height: MAP_DATA.height,
        walls: MAP_DATA.walls,
        waterTiles: MAP_DATA.waterTiles
    });
});

app.get('/api/sprites', (req, res) => {
    res.json(SPRITE_DATA);
});

app.get('/api/stats', (req, res) => {
    res.json({
        players: Object.keys(players).filter(id =>!players[id].isBot).length,
        matches: Object.keys(matches).map(id => ({
            id,
            players: Object.keys(matches[id].players).length,
            state: matches[id].state
        })),
        lobby: {
            state: lobby.state,
            realPlayers: lobby.realPlayers.length,
            bots: lobby.bots.length
        }
    });
});

// ============================================
// START SERVER - Tohiny
// ============================================
    console.log(`⏱️ CS: ${MATCH_CONFIG.CS.TOTAL_TIME/60}min`);
    console.log(`🗺️ Map: ${CONFIG.MAP_SIZE}x${CONFIG.MAP_SIZE}`);
    console.log(`🧱 Walls: ${MAP_DATA.walls.length}`);
    console.log(`🛡️ Anti-Cheat: ENABLED`);
    console.log(`📁 Static: ${__dirname}`);
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    io.emit('serverMessage', { text: 'Server restarting...', type: 'info' });
    server.close(() => {
        console.log('Server closed');
        Object.keys(rateLimits).forEach(type => rateLimits[type].clear());
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});
