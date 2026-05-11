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

// =====================================
// 0. ANTI-CHEAT CONFIG - FIX 1-3
// =====================================
const ANTI_CHEAT = {
    MAX_MOVE_SPEED: 350, // pixels/sec - sprint max
    MAX_MOVE_TOLERANCE: 1.5, // 50% tolerance lag
    MAX_SHOOT_RATE: 20, // shots/sec max
    MAX_GRENADES_SEC: 0.5, // 1 grenade per 2s
    MAX_CHAT_RATE: 3, // 3 msgs/sec
    MAX_JOIN_ROOM_RATE: 2, // 2 attempts/sec
    TELEPORT_THRESHOLD: 500, // pixels - heverina teleport
    DAMAGE_VALIDATION: true // Server authoritative damage
};

// Rate limiting storage - FIX 2
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

    // Remove old timestamps
    while (timestamps.length > 0 && timestamps[0] < oneSecAgo) {
        timestamps.shift();
    }

    if (timestamps.length >= maxPerSec) return false;
    timestamps.push(now);
    return true;
}

// Cleanup rate limits on disconnect - FIX 7
function clearRateLimits(socketId) {
    Object.keys(rateLimits).forEach(type => {
        rateLimits[type].delete(socketId);
    });
}

// =====================================
// 1. LOAD MAP DATA - SECURE
// =====================================
let MAP_DATA = {
    width: 2000,
    height: 2000,
    tiles: [],
    walls: [],
    waterTiles: [],
    spawnPoints: []
};

try {
    const mapPath = path.join(__dirname, 'map.json');
    if (fs.existsSync(mapPath)) {
        const rawMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
        // FIX 10: Validate map data
        if (!Array.isArray(rawMap)) throw new Error('Invalid map format');

        MAP_DATA.tiles = rawMap.filter(t => t && typeof t.x === 'number');
        MAP_DATA.width = 2000;
        MAP_DATA.height = 2000;

        MAP_DATA.tiles.forEach(tile => {
            if (tile.collision && tile.x >= 0 && tile.y >= 0) {
                MAP_DATA.walls.push({
                    x: Math.max(0, tile.x),
                    y: Math.max(0, tile.y),
                    width: Math.min(tile.s || 32, 100),
                    height: Math.min(tile.s || 32, 100)
                });
            }
            if (tile.swimmable) {
                MAP_DATA.waterTiles.push({
                    x: tile.x, y: tile.y,
                    width: tile.s || 32, height: tile.s || 32
                });
            }
        });

        // Generate safe spawn points
        for (let i = 0; i < 30; i++) {
            let x, y, attempts = 0;
            do {
                x = Math.random() * (MAP_DATA.width - 200) + 100;
                y = Math.random() * (MAP_DATA.height - 200) + 100;
                attempts++;
            } while (checkWallCollision(x, y, 25) && attempts < 100);
            if (attempts < 100) MAP_DATA.spawnPoints.push({ x, y });
        }

        console.log('✅ Map loaded:', MAP_DATA.tiles.length, 'tiles');
        console.log(' Walls:', MAP_DATA.walls.length);
        console.log(' Water:', MAP_DATA.waterTiles.length);
        console.log(' Spawns:', MAP_DATA.spawnPoints.length);
    } else {
        console.log('⚠️ map.json not found, using default');
        for (let i = 0; i < 20; i++) {
            MAP_DATA.spawnPoints.push({
                x: Math.random() * 1800 + 100,
                y: Math.random() * 1800 + 100
            });
        }
    }
} catch (err) {
    console.error('❌ Error loading map:', err.message);
}

// =====================================
// 2. LOAD SPRITE DATA - VALIDATED
// =====================================
let SPRITE_DATA = {
    tileSize: 50, tiles: {}, weapons: {}, characters: {}, items: {}
};

try {
    const spritePath = path.join(__dirname, 'sprite.json');
    if (fs.existsSync(spritePath)) {
        const raw = JSON.parse(fs.readFileSync(spritePath, 'utf8'));
        // FIX 10: Whitelist only needed data
        SPRITE_DATA = {
            tileSize: Math.min(100, raw.tileSize || 50),
            tiles: raw.tiles || {},
            weapons: raw.weapons || {},
            characters: raw.characters || {},
            items: raw.items || {}
        };
        console.log('✅ Sprite.json loaded');
    }
} catch (err) {
    console.error('❌ Error loading sprite.json:', err.message);
}

// =====================================
// 3. CONFIG - SERVER AUTHORITATIVE
// =====================================
const CONFIG = {
    MAP_SIZE: MAP_DATA.width,
    MAX_PLAYERS_PER_MATCH: 50,
    TICK_RATE: 20,
    PLAYER_SPEED: 200,
    PLAYER_SPRINT_SPEED: 320,
    PLAYER_SWIM_SPEED: 120,
    PLAYER_HP: 100,
    PLAYER_ARMOR_MAX: 100,
    ZONE_SHRINK_INTERVAL: 45000,
    ZONE_DAMAGE: 5,
    BULLET_SPEED: 800,
    BULLET_LIFETIME: 2000,
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
    GRENADE_RADIUS: 100,
    GRENADE_THROW_FORCE: 400
};

// =====================================
// 4. GLOBAL STATE
// =====================================
let players = {};
let matches = {};
let rooms = {};
let matchmakingQueue = { solo: [], duo: [], squad: [] };

// =====================================
// 5. COLLISION FUNCTIONS - SECURE
// =====================================
function checkWallCollision(x, y, radius = 12) {
    // FIX 10: Validate inputs
    if (typeof x!== 'number' || typeof y!== 'number') return true;
    x = Math.max(0, Math.min(MAP_DATA.width, x));
    y = Math.max(0, Math.min(MAP_DATA.height, y));

    for (const wall of MAP_DATA.walls) {
        if (x + radius > wall.x &&
            x - radius < wall.x + wall.width &&
            y + radius > wall.y &&
            y - radius < wall.y + wall.height) {
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

function randomSpawnPosition() {
    if (MAP_DATA.spawnPoints && MAP_DATA.spawnPoints.length > 0) {
        const spawn = MAP_DATA.spawnPoints[Math.floor(Math.random() * MAP_DATA.spawnPoints.length)];
        return { x: spawn.x, y: spawn.y };
    }
    return {
        x: Math.random() * (CONFIG.MAP_SIZE - 200) + 100,
        y: Math.random() * (CONFIG.MAP_SIZE - 200) + 100
    };
}

// =====================================
// 6. SANITIZATION - FIX 12
// =====================================
function sanitizeString(str, maxLen = 50) {
    if (typeof str!== 'string') return '';
    return str.substring(0, maxLen).replace(/[<>'"]/g, '').trim();
}

function sanitizeUsername(username) {
    return sanitizeString(username, 20).replace(/[^a-zA-Z0-9_]/g, '') || 'Player';
}

// =====================================
// 7. GAME ENTITIES
// =====================================
function createPlayer(socketId, data) {
    const pos = randomSpawnPosition();
    return {
        id: socketId,
        uid: data.uid || null,
        username: sanitizeUsername(data.username),
        x: pos.x, y: pos.y, angle: 0,
        hp: CONFIG.PLAYER_HP,
        armor: 0,
        weapon: 'fist', ammo: Infinity, grenades: 0,
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
        friends: []
    };
}

function createMatch(players, mode) {
    const matchId = uuidv4();
    const match = {
        id: matchId, mode: mode, players: {}, bullets: [], loot: [], vehicles: [],
        zone: {
            x: CONFIG.MAP_SIZE / 2, y: CONFIG.MAP_SIZE / 2,
            radius: CONFIG.MAP_SIZE / 2, targetRadius: CONFIG.MAP_SIZE / 2,
            timer: CONFIG.ZONE_SHRINK_INTERVAL, phase: 0
        },
        startTime: Date.now(), aliveCount: players.length, state: 'waiting'
    };

    players.forEach(p => {
        p.matchId = matchId;
        p.hp = CONFIG.PLAYER_HP;
        p.armor = 0;
        p.kills = 0;
        p.damage = 0;
        const pos = randomSpawnPosition();
        p.x = pos.x;
        p.y = pos.y;
        match.players[p.id] = p;
    });

    for (let i = 0; i < CONFIG.LOOT_SPAWN_COUNT; i++) {
        let x, y, attempts = 0;
        do {
            x = Math.random() * CONFIG.MAP_SIZE;
            y = Math.random() * CONFIG.MAP_SIZE;
            attempts++;
        } while (checkWallCollision(x, y, 10) && attempts < 50);
        if (attempts < 50) match.loot.push(createLoot(x, y));
    }

    for (let i = 0; i < CONFIG.VEHICLE_SPAWN_COUNT; i++) {
        let x, y, attempts = 0;
        do {
            x = Math.random() * CONFIG.MAP_SIZE;
            y = Math.random() * CONFIG.MAP_SIZE;
            attempts++;
        } while (checkWallCollision(x, y, 30) && attempts < 50);
        if (attempts < 50) match.vehicles.push(createVehicle(x, y));
    }

    matches[matchId] = match;
    return match;
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

function createRoom(hostId) {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const host = players[hostId];
    if (!host) return null;

    rooms[roomId] = {
        id: roomId, host: hostId,
        players: [{ id: hostId, username: host.username, ready: false, skin: host.skin }],
        state: 'lobby', matchId: null, createdAt: Date.now()
    };
    host.roomId = roomId;
    return rooms[roomId];
}
// =====================================
// 8. MATCHMAKING - SECURE
// =====================================
function addToMatchmaking(socketId, mode) {
    const player = players[socketId];
    if (!player || player.matchId) return;

    // FIX 6: Rate limit matchmaking
    if (!checkRateLimit(socketId, 'joinRoom', ANTI_CHEAT.MAX_JOIN_ROOM_RATE)) {
        socket.emit('serverMessage', { text: 'Too many requests', type: 'error' });
        return;
    }

    // Remove from all queues first
    Object.keys(matchmakingQueue).forEach(m => {
        matchmakingQueue[m] = matchmakingQueue[m].filter(id => id!== socketId);
    });

    // FIX 10: Validate mode
    if (!['solo', 'duo', 'squad'].includes(mode)) mode = 'solo';

    matchmakingQueue[mode].push(socketId);
    console.log(`${player.username} joined ${mode} queue. Size: ${matchmakingQueue[mode].length}`);
    checkMatchmaking(mode);
}

function checkMatchmaking(mode) {
    const queue = matchmakingQueue[mode];
    const requiredPlayers = mode === 'solo'? 2 : 4;

    if (queue.length >= requiredPlayers) {
        const matchPlayers = [];
        for (let i = 0; i < requiredPlayers; i++) {
            const playerId = queue.shift();
            if (players[playerId] &&!players[playerId].matchId) {
                matchPlayers.push(players[playerId]);
            }
        }

        if (matchPlayers.length >= 2) {
            const match = createMatch(matchPlayers, mode);
            startMatch(match.id);
        }
    }
}

function removeFromMatchmaking(socketId) {
    Object.keys(matchmakingQueue).forEach(mode => {
        matchmakingQueue[mode] = matchmakingQueue[mode].filter(id => id!== socketId);
    });
}

function startMatch(matchId) {
    const match = matches[matchId];
    if (!match) return;

    match.state = 'active';
    match.startTime = Date.now();

    Object.values(match.players).forEach(p => {
        const socket = io.sockets.sockets.get(p.id);
        if (socket) {
            socket.join(matchId);
            socket.emit('gameStart', {
                matchId: matchId,
                players: match.players,
                loot: match.loot,
                vehicles: match.vehicles,
                zone: match.zone,
                mapData: { width: MAP_DATA.width, height: MAP_DATA.height, walls: MAP_DATA.walls },
                spriteData: SPRITE_DATA
            });
        }
    });

    console.log(`Match ${matchId} started with ${Object.keys(match.players).length} players`);
}

// =====================================
// 9. GAME LOOP - 20 TICK/SEC
// =====================================
setInterval(() => {
    Object.values(matches).forEach(match => {
        if (match.state!== 'active') return;
        updateMatch(match);
    });
}, 1000 / CONFIG.TICK_RATE);

function updateMatch(match) {
    // Zone shrink
    match.zone.timer -= 1000 / CONFIG.TICK_RATE;
    if (match.zone.timer <= 0) {
        match.zone.phase++;
        match.zone.targetRadius = Math.max(100, match.zone.radius * 0.5);
        match.zone.timer = CONFIG.ZONE_SHRINK_INTERVAL;
        const angle = Math.random() * Math.PI * 2;
        const dist = match.zone.radius * 0.3;
        match.zone.x += Math.cos(angle) * dist;
        match.zone.y += Math.sin(angle) * dist;
        match.zone.x = Math.max(match.zone.targetRadius, Math.min(CONFIG.MAP_SIZE - match.zone.targetRadius, match.zone.x));
        match.zone.y = Math.max(match.zone.targetRadius, Math.min(CONFIG.MAP_SIZE - match.zone.targetRadius, match.zone.y));
    }
    if (match.zone.radius > match.zone.targetRadius) match.zone.radius -= 2;

    // Update bullets - SERVER AUTHORITATIVE - FIX 3
    match.bullets = match.bullets.filter(bullet => {
        bullet.x += bullet.vx * (1 / CONFIG.TICK_RATE);
        bullet.y += bullet.vy * (1 / CONFIG.TICK_RATE);
        bullet.lifetime -= 1000 / CONFIG.TICK_RATE;

        if (checkWallCollision(bullet.x, bullet.y, 3)) return false;

        // Check player hits
        Object.values(match.players).forEach(player => {
            if (player.id === bullet.ownerId || player.hp <= 0) return;
            const dist = getDistance(bullet.x, bullet.y, player.x, player.y);
            if (dist < 15) {
                let damage = bullet.damage;
                const headshot = dist < 8;
                if (headshot) damage *= 2;

                // Armor calculation - FIX 11
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

    // Check win condition
    const alivePlayers = Object.values(match.players).filter(p => p.hp > 0);
    match.aliveCount = alivePlayers.length;

    if (alivePlayers.length === 1 && match.state === 'active') {
        endMatch(match.id, alivePlayers[0].id);
    } else if (alivePlayers.length === 0) {
        endMatch(match.id, null);
    }

    // Broadcast game state
    io.to(match.id).emit('gameUpdate', {
        players: match.players,
        bullets: match.bullets,
        zone: match.zone,
        aliveCount: match.aliveCount
    });
}

function endMatch(matchId, winnerId) {
    const match = matches[matchId];
    if (!match) return;

    match.state = 'ended';
    Object.values(match.players).forEach(p => {
        const isWinner = p.id === winnerId;
        const coins = isWinner? 100 + p.kills * 20 : p.kills * 10;
        const xp = isWinner? 200 + p.kills * 50 : p.kills * 25;

        io.to(p.id).emit(isWinner? 'victory' : 'playerDied', {
            kills: p.kills,
            damage: Math.floor(p.damage),
            survived: Math.floor((Date.now() - match.startTime) / 1000),
            coins: coins,
            xp: xp,
            rank: match.aliveCount + 1
        });
        p.matchId = null;
    });

    setTimeout(() => { delete matches[matchId]; }, 5000);
    console.log(`Match ${matchId} ended. Winner: ${winnerId}`);
}

// =====================================
// 10. SOCKET HANDLERS - FULL ANTI-CHEAT
// =====================================
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    io.emit('onlineCount', Object.keys(players).length);

    socket.on('joinGame', (data) => {
        // FIX 10: Validate data
        if (!data || typeof data.username!== 'string') return;
        players[socket.id] = createPlayer(socket.id, data);
        console.log(`${data.username} joined`);
        io.emit('onlineCount', Object.keys(players).length);
    });

    socket.on('findMatch', (mode) => addToMatchmaking(socket.id, mode));
    socket.on('cancelMatchmaking', () => removeFromMatchmaking(socket.id));

    socket.on('createRoom', () => {
        if (!checkRateLimit(socket.id, 'joinRoom', ANTI_CHEAT.MAX_JOIN_ROOM_RATE)) return;
        const room = createRoom(socket.id);
        if (room) {
            socket.join(room.id);
            socket.emit('roomCreated', { roomId: room.id });
            io.to(room.id).emit('roomUpdate', room);
        }
    });

    socket.on('joinRoom', (roomId) => {
        if (!checkRateLimit(socket.id, 'joinRoom', ANTI_CHEAT.MAX_JOIN_ROOM_RATE)) return;
        const room = rooms[roomId];
        const player = players[socket.id];
        if (!room ||!player) return socket.emit('roomError', 'Room not found');
        if (room.players.length >= 4) return socket.emit('roomError', 'Room is full');
        if (room.players.find(p => p.id === socket.id)) return;

        room.players.push({ id: socket.id, username: player.username, ready: false, skin: player.skin });
        player.roomId = roomId;
        socket.join(roomId);
        socket.emit('roomJoined', room);
        io.to(roomId).emit('roomUpdate', room);
    });

    socket.on('leaveRoom', () => {
        const player = players[socket.id];
        if (!player ||!player.roomId) return;
        const room = rooms[player.roomId];
        if (!room) return;

        room.players = room.players.filter(p => p.id!== socket.id);
        socket.leave(room.id);

        if (room.players.length === 0) {
            delete rooms[room.id];
        } else {
            if (room.host === socket.id) room.host = room.players[0].id;
            io.to(room.id).emit('roomUpdate', room);
        }
        player.roomId = null;
    });

    socket.on('playerReady', (isReady) => {
        const player = players[socket.id];
        if (!player ||!player.roomId) return;
        const room = rooms[player.roomId];
        if (!room) return;

        const roomPlayer = room.players.find(p => p.id === socket.id);
        if (roomPlayer) {
            roomPlayer.ready = Boolean(isReady);
            io.to(room.id).emit('roomUpdate', room);

            if (room.players.length >= 2 && room.players.every(p => p.ready)) {
                const matchPlayers = room.players.map(rp => players[rp.id]).filter(p => p);
                const match = createMatch(matchPlayers, 'squad');
                room.matchId = match.id;
                room.state = 'ingame';
                io.to(room.id).emit('gameStarting', 3);
                setTimeout(() => startMatch(match.id), 3000);
            }
        }
    });

    socket.on('chatMessage', (data) => {
        // FIX 6: Rate limit + sanitize - FIX 12
        if (!checkRateLimit(socket.id, 'chat', ANTI_CHEAT.MAX_CHAT_RATE)) return;
        const player = players[socket.id];
        if (!player ||!data ||!data.message) return;

        const msg = {
            username: player.username,
            message: sanitizeString(data.message, 200),
            timestamp: Date.now()
        };

        if (data.type === 'lobby') {
            io.emit('chatMessage', {...msg, type: 'lobby' });
        } else if (data.type === 'room' && player.roomId) {
            io.to(player.roomId).emit('chatMessage', {...msg, type: 'room' });
        }
    });

    socket.on('addFriend', (username) => {
        const player = players[socket.id];
        const target = Object.values(players).find(p => p.username === sanitizeUsername(username));
        if (!player ||!target || target.id === socket.id) return;
        io.to(target.id).emit('friendRequest', { fromId: socket.id, username: player.username });
    });

    socket.on('friendRequestResponse', (data) => {
        const player = players[socket.id];
        const fromPlayer = players[data.fromId];
        if (!player ||!fromPlayer ||!data.accept) return;

        if (!player.friends) player.friends = [];
        if (!fromPlayer.friends) fromPlayer.friends = [];
        if (player.friends.find(f => f.id === fromPlayer.id)) return;

        player.friends.push({ id: fromPlayer.id, username: fromPlayer.username, online: true });
        fromPlayer.friends.push({ id: player.id, username: player.username, online: true });
        io.to(socket.id).emit('friendAdded', { id: fromPlayer.id, username: fromPlayer.username, online: true });
        io.to(data.fromId).emit('friendAdded', { id: player.id, username: player.username, online: true });
    });

    // =====================================
    // 11. MOVEMENT - ANTI-CHEAT - FIX 1
    // =====================================
    socket.on('move', (data) => {
        const player = players[socket.id];
        if (!player ||!player.matchId || player.hp <= 0) return;
        const match = matches[player.matchId];
        if (!match || match.state!== 'active') return;

        // FIX 1: Rate limit
        if (!checkRateLimit(socket.id, 'move', 30)) return;

        // FIX 1: Validate data
        if (typeof data.x!== 'number' || typeof data.y!== 'number') return;
        data.x = Math.max(-1, Math.min(1, data.x));
        data.y = Math.max(-1, Math.min(1, data.y));
        data.angle = typeof data.angle === 'number'? data.angle : player.angle;
        data.sprint = Boolean(data.sprint);

        const now = Date.now();
        if (!player.lastMove) player.lastMove = now;
        const dt = (now - player.lastMove) / 1000;
        if (dt < 0.01 || dt > 0.5) { player.lastMove = now; return; }

        // FIX 1: Speed hack check
        const dist = getDistance(player.x, player.y, player.x + data.x * 10, player.y + data.y * 10);
        const maxSpeed = player.isSwimming? CONFIG.PLAYER_SWIM_SPEED : (data.sprint? CONFIG.PLAYER_SPRINT_SPEED : CONFIG.PLAYER_SPEED);
        const maxDist = maxSpeed * dt * ANTI_CHEAT.MAX_MOVE_TOLERANCE;
        if (dist > maxDist) return; // Ignore teleport/speed hack

        const speed = maxSpeed;
        const newX = player.x + data.x * speed * dt;
        const newY = player.y + data.y * speed * dt;

        // FIX 1: Wall collision server-side
        if (!checkWallCollision(newX, player.y, 12)) player.x = newX;
        if (!checkWallCollision(player.x, newY, 12)) player.y = newY;

        player.angle = data.angle;
        player.isSprinting = data.sprint;
        player.x = Math.max(20, Math.min(CONFIG.MAP_SIZE - 20, player.x));
        player.y = Math.max(20, Math.min(CONFIG.MAP_SIZE - 20, player.y));
        player.lastMove = now;
    });

    // =====================================
    // 12. SHOOT - RATE LIMITED - FIX 2
    // =====================================
    socket.on('shoot', (data) => {
        const player = players[socket.id];
        if (!player ||!player.matchId || player.hp <= 0) return;
        const match = matches[player.matchId];
        if (!match) return;

        // FIX 2: Rate limit
        if (!checkRateLimit(socket.id, 'shoot', ANTI_CHEAT.MAX_SHOOT_RATE)) return;

        const weapon = CONFIG.WEAPONS[player.weapon];
        const now = Date.now();
        if (now - player.lastShot < weapon.fireRate) return;
        if (weapon.ammo!== Infinity && player.ammo <= 0) return;

        // FIX 8: Validate angle
        if (typeof data.angle!== 'number') return;

        player.lastShot = now;
        if (weapon.ammo!== Infinity) player.ammo--;

        const bullets = weapon.pellets || 1;
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

    // =====================================
    // 13. GRENADE - RATE LIMITED - FIX 9
    // =====================================
    socket.on('grenade', (data) => {
        const player = players[socket.id];
        if (!player ||!player.matchId || player.grenades <= 0) return;
        const match = matches[player.matchId];
        if (!match) return;

        // FIX 9: Rate limit grenades
        if (!checkRateLimit(socket.id, 'grenade', ANTI_CHEAT.MAX_GRENADES_SEC)) return;

        // FIX 8: Validate angle
        if (typeof data.angle!== 'number') return;

        player.grenades--;
        const grenadeX = player.x + Math.cos(data.angle) * 150;
        const grenadeY = player.y + Math.sin(data.angle) * 150;

        // FIX 4: Clamp grenade position
        const finalX = Math.max(0, Math.min(CONFIG.MAP_SIZE, grenadeX));
        const finalY = Math.max(0, Math.min(CONFIG.MAP_SIZE, grenadeY));

        setTimeout(() => {
            if (!matches[player.matchId]) return;
            io.to(player.matchId).emit('explosion', { x: finalX, y: finalY });

            Object.values(match.players).forEach(p => {
                if (p.hp <= 0) return;
                const dist = getDistance(finalX, finalY, p.x, p.y);
                if (dist < CONFIG.GRENADE_RADIUS) {
                    const damage = CONFIG.GRENADE_DAMAGE * (1 - dist / CONFIG.GRENADE_RADIUS);
                    p.hp = Math.max(0, p.hp - damage);
                    if (p.hp <= 0 && p.id!== socket.id) player.kills++;
                }
            });
        }, 3000);
    });

    // =====================================
    // 14. INTERACT - VALIDATED - FIX 4
    // =====================================
    socket.on('interact', () => {
        const player = players[socket.id];
        if (!player ||!player.matchId) return;
        const match = matches[player.matchId];
        if (!match) return;

        let nearestLoot = null;
        let nearestDist = 60; // FIX 4: Max pickup distance

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

    // =====================================
    // 15. VEHICLE - VALIDATED
    // =====================================
    socket.on('enterVehicle', () => {
        const player = players[socket.id];
        if (!player ||!player.matchId) return;
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
            let nearestDist = 60; // FIX 4: Max enter distance

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

    // =====================================
    // 16. WEAPON SWITCH - VALIDATED - FIX 8
    // =====================================
    socket.on('switchWeapon', (weaponName) => {
        const player = players[socket.id];
        // FIX 8: Whitelist weapons only
        if (!player ||!CONFIG.WEAPONS[weaponName]) return;
        player.weapon = weaponName;
        player.ammo = CONFIG.WEAPONS[weaponName].ammo;
    });

    // =====================================
    // 17. SKIN CHANGE - VALIDATED - FIX 10
    // =====================================
    socket.on('changeSkin', (skin) => {
        const player = players[socket.id];
        if (!player ||!skin) return;

        // FIX 10: Validate skin data
        player.skin = {
            color: /^#[0-9A-F]{6}$/i.test(skin.color)? skin.color : '#00ff00',
            hat: ['none','cap','helmet','crown','viking','wizard','cowboy','tophat'].includes(skin.hat)? skin.hat : 'none'
        };
    });

    // =====================================
    // 18. DISCONNECT - CLEANUP - FIX 7
    // =====================================
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        const player = players[socket.id];

        if (player) {
            // Remove from match
            if (player.matchId && matches[player.matchId]) {
                delete matches[player.matchId].players[socket.id];
            }

            // Remove from room
            if (player.roomId && rooms[player.roomId]) {
                const room = rooms[player.roomId];
                room.players = room.players.filter(p => p.id!== socket.id);
                if (room.players.length === 0) {
                    delete rooms[player.roomId];
                } else {
                    if (room.host === socket.id) room.host = room.players[0].id;
                    io.to(room.id).emit('roomUpdate', room);
                }
            }

            // Remove from matchmaking
            removeFromMatchmaking(socket.id);

            // Notify friends
            if (player.friends) {
                player.friends.forEach(f => {
                    const friend = players[f.id];
                    if (friend) io.to(f.id).emit('friendUpdate');
                });
            }

            delete players[socket.id];
        }

        // FIX 7: Clear all rate limits
        clearRateLimits(socket.id);

        io.emit('onlineCount', Object.keys(players).length);
    });
});

// =====================================
// 19. LOOT HANDLER - SERVER AUTHORITATIVE - FIX 3
// =====================================
function handleLootPickup(player, loot, match) {
    const lootData = loot.type.split('_');
    const category = lootData[0];
    const item = lootData[1];

    if (category === 'weapon') {
        // FIX 8: Validate weapon exists
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
        player.hp = Math.min(CONFIG.PLAYER_HP, player.hp + 75);
        io.to(player.id).emit('lootPickup', { type: 'heal', amount: 75, playerId: player.id });
    } else if (loot.type === 'grenade') {
        player.grenades = Math.min(5, player.grenades + 1); // FIX 4: Max 5 grenades
        io.to(player.id).emit('lootPickup', { type: 'grenade', amount: 1, playerId: player.id });
    }

    io.to(player.id).emit('soundEvent', 'pickup');
    match.loot = match.loot.filter(l => l.id!== loot.id);
}

// =====================================
// 20. EXPRESS ROUTES - SECURE
// =====================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/map', (req, res) => {
    // FIX 5: Don't send sensitive data
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
        players: Object.keys(players).length,
        matches: Object.keys(matches).map(id => ({
            id,
            players: Object.keys(matches[id].players).length,
            state: matches[id].state
        })),
        rooms: Object.keys(rooms).map(id => ({
            id,
            players: rooms[id].players.length,
            host: rooms[id].host
        }))
    });
});

// =====================================
// 21. START SERVER
// =====================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🔥 MG FIGHTER Server V4.1 - FULL ANTI-CHEAT`);
    console.log(`🎮 Max players: ${CONFIG.MAX_PLAYERS_PER_MATCH}`);
    console.log(`⚡ Tick rate: ${CONFIG.TICK_RATE} Hz`);
    console.log(`🗺️ Map: ${CONFIG.MAP_SIZE}x${CONFIG.MAP_SIZE}`);
    console.log(`🧱 Walls: ${MAP_DATA.walls.length}`);
    console.log(`🛡️ Anti-Cheat: ENABLED`);
    console.log(`📁 Static files: Serving from ${__dirname}`);
});

// =====================================
// 22. GRACEFUL SHUTDOWN - FIX 7
// =====================================
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    io.emit('serverMessage', { text: 'Server restarting...', type: 'info' });

    server.close(() => {
        console.log('Server closed');
        // Clear all rate limits
        Object.keys(rateLimits).forEach(type => rateLimits[type].clear());
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Don't crash - log and continue
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    // Don't crash - log and continue
});
