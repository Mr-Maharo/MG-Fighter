

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000,
    pingInterval: 25000
});

// =====================================
// 1. LOAD MAP DATA
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
        MAP_DATA.tiles = rawMap;
        MAP_DATA.width = 2000;
        MAP_DATA.height = 2000;

        rawMap.forEach(tile => {
            if (tile.collision) {
                MAP_DATA.walls.push({
                    x: tile.x,
                    y: tile.y,
                    width: tile.s,
                    height: tile.s
                });
            }
            if (tile.swimmable) {
                MAP_DATA.waterTiles.push({
                    x: tile.x,
                    y: tile.y,
                    width: tile.s,
                    height: tile.s
                });
            }
        });

        for (let i = 0; i < 20; i++) {
            let x, y, attempts = 0;
            do {
                x = Math.random() * (MAP_DATA.width - 100) + 50;
                y = Math.random() * (MAP_DATA.height - 100) + 50;
                attempts++;
            } while (checkWallCollision(x, y, 25) && attempts < 50);
            MAP_DATA.spawnPoints.push({ x, y });
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
// LOAD SPRITE DATA
// =====================================
let SPRITE_DATA = {
    tileSize: 50,
    tiles: {},
    weapons: {},
    characters: {},
    items: {}
};

try {
    const spritePath = path.join(__dirname, 'sprite.json');
    if (fs.existsSync(spritePath)) {
        SPRITE_DATA = JSON.parse(fs.readFileSync(spritePath, 'utf8'));
        console.log('✅ Sprite.json loaded');
        console.log(' Tiles:', Object.keys(SPRITE_DATA.tiles || {}).length);
        console.log(' Weapons:', Object.keys(SPRITE_DATA.weapons || {}).length);
    } else {
        console.log('⚠️ sprite.json not found, using defaults');
    }
} catch (err) {
    console.error('❌ Error loading sprite.json:', err.message);
}
// =====================================
// 2. CONFIG
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
// 3. GLOBAL STATE
// =====================================
let players = {};
let matches = {};
let rooms = {};
let matchmakingQueue = { solo: [], duo: [], squad: [] };

// =====================================
// 4. COLLISION FUNCTIONS
// =====================================
function checkWallCollision(x, y, radius = 12) {
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
    return Math.hypot(x2 - x1, y2 - y1);
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
// 5. GAME ENTITIES
// =====================================
function createPlayer(socketId, data) {
    const pos = randomSpawnPosition();
    return {
        id: socketId, uid: data.uid || null, username: data.username || 'Player',
        x: pos.x, y: pos.y, angle: 0, hp: CONFIG.PLAYER_HP, armor: 0,
        weapon: 'fist', ammo: Infinity, grenades: 0,
        kills: 0, damage: 0, level: data.level || 1, xp: 0,
        skin: data.skin || { color: '#00ff00', hat: 'none' },
        matchId: null, roomId: null, inVehicle: null,
        isScoping: false, isSwimming: false, lastShot: 0,
        velocity: { x: 0, y: 0 }, isSprinting: false, friends: []
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
        match.loot.push(createLoot(x, y));
    }

    for (let i = 0; i < CONFIG.VEHICLE_SPAWN_COUNT; i++) {
        let x, y, attempts = 0;
        do {
            x = Math.random() * CONFIG.MAP_SIZE;
            y = Math.random() * CONFIG.MAP_SIZE;
            attempts++;
        } while (checkWallCollision(x, y, 30) && attempts < 50);
        match.vehicles.push(createVehicle(x, y));
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
// 6. MATCHMAKING
// =====================================
function addToMatchmaking(socketId, mode) {
    const player = players[socketId];
    if (!player || player.matchId) return;

    Object.keys(matchmakingQueue).forEach(m => {
        matchmakingQueue[m] = matchmakingQueue[m].filter(id => id!== socketId);
    });

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
            if (players[playerId]) matchPlayers.push(players[playerId]);
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
        io.to(p.id).emit('gameStart', {
            matchId: matchId, players: match.players,
            loot: match.loot, vehicles: match.vehicles, zone: match.zone,
            mapData: { width: MAP_DATA.width, height: MAP_DATA.height, walls: MAP_DATA.walls }
        });
    });

    console.log(`Match ${matchId} started with ${Object.keys(match.players).length} players`);
}
     Object.values(match.players).forEach(p => {
    io.to(p.id).emit('gameStart', {
        matchId: matchId, players: match.players,
        loot: match.loot, vehicles: match.vehicles, zone: match.zone,
        mapData: { width: MAP_DATA.width, height: MAP_DATA.height, walls: MAP_DATA.walls },
        spriteData: SPRITE_DATA // ← AMPIO ITY
    });
});

// =====================================
// 7. GAME LOOP
// =====================================
setInterval(() => {
    Object.values(matches).forEach(match => {
        if (match.state!== 'active') return;
        updateMatch(match);
    });
}, 1000 / CONFIG.TICK_RATE);

function updateMatch(match) {
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

    match.bullets = match.bullets.filter(bullet => {
        bullet.x += bullet.vx * (1 / CONFIG.TICK_RATE);
        bullet.y += bullet.vy * (1 / CONFIG.TICK_RATE);
        bullet.lifetime -= 1000 / CONFIG.TICK_RATE;

        if (checkWallCollision(bullet.x, bullet.y, 3)) {
            return false;
        }

        Object.values(match.players).forEach(player => {
            if (player.id === bullet.ownerId || player.hp <= 0) return;
            const dist = getDistance(bullet.x, bullet.y, player.x, player.y);
            if (dist < 15) {
                let damage = bullet.damage;
                const headshot = dist < 8;
                if (headshot) damage *= 2;

                if (player.armor > 0) {
                    const armorAbsorb = Math.min(player.armor, damage * 0.7);
                    player.armor -= armorAbsorb;
                    damage -= armorAbsorb;
                }

                player.hp -= damage;
                player.hp = Math.max(0, player.hp);

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

    Object.values(match.players).forEach(player => {
        if (player.hp <= 0) return;
        const dist = getDistance(player.x, player.y, match.zone.x, match.zone.y);
        if (dist > match.zone.radius) {
            player.hp -= CONFIG.ZONE_DAMAGE * (1 / CONFIG.TICK_RATE);
            player.hp = Math.max(0, player.hp);
        }
        player.isSwimming = checkWaterTile(player.x, player.y);
    });

    const alivePlayers = Object.values(match.players).filter(p => p.hp > 0);
    match.aliveCount = alivePlayers.length;

    if (alivePlayers.length === 1 && match.state === 'active') {
        endMatch(match.id, alivePlayers[0].id);
    } else if (alivePlayers.length === 0) {
        endMatch(match.id, null);
    }

    io.to(match.id).emit('gameUpdate', {
        players: match.players, bullets: match.bullets,
        zone: match.zone, aliveCount: match.aliveCount
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
            kills: p.kills, damage: Math.floor(p.damage),
            survived: Math.floor((Date.now() - match.startTime) / 1000),
            coins: coins, xp: xp, rank: match.aliveCount + 1
        });
        p.matchId = null;
    });

    setTimeout(() => { delete matches[matchId]; }, 5000);
    console.log(`Match ${matchId} ended. Winner: ${winnerId}`);
}

// =====================================
// 8. SOCKET HANDLERS
// =====================================
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    io.emit('onlineCount', Object.keys(players).length);

    socket.on('joinGame', (data) => {
        players[socket.id] = createPlayer(socket.id, data);
        console.log(`${data.username} joined`);
        io.emit('onlineCount', Object.keys(players).length);
    });

    socket.on('findMatch', (mode) => addToMatchmaking(socket.id, mode));
    socket.on('cancelMatchmaking', () => removeFromMatchmaking(socket.id));

    socket.on('createRoom', () => {
        const room = createRoom(socket.id);
        if (room) {
            socket.join(room.id);
            socket.emit('roomCreated', { roomId: room.id });
            io.to(room.id).emit('roomUpdate', room);
        }
    });

    socket.on('joinRoom', (roomId) => {
        const room = rooms[roomId];
        const player = players[socket.id];
        if (!room ||!player) return socket.emit('roomError', 'Room not found');
        if (room.players.length >= 4) return socket.emit('roomError', 'Room is full');

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
            roomPlayer.ready = isReady;
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
        const player = players[socket.id];
        if (!player) return;
        const msg = { username: player.username, message: data.message.substring(0, 200), timestamp: Date.now() };
        if (data.type === 'lobby') {
            io.emit('chatMessage', {...msg, type: 'lobby' });
        } else if (data.type === 'room' && player.roomId) {
            io.to(player.roomId).emit('chatMessage', {...msg, type: 'room' });
        }
    });

    socket.on('addFriend', (username) => {
        const player = players[socket.id];
        const target = Object.values(players).find(p => p.username === username);
        if (!player ||!target || target.id === socket.id) return;
        io.to(target.id).emit('friendRequest', { fromId: socket.id, username: player.username });
    });

    socket.on('friendRequestResponse', (data) => {
        const player = players[socket.id];
        const fromPlayer = players[data.fromId];
        if (!player ||!fromPlayer) return;
        if (data.accept) {
            if (!player.friends) player.friends = [];
            if (!fromPlayer.friends) fromPlayer.friends = [];
            player.friends.push({ id: fromPlayer.id, username: fromPlayer.username, online: true });
            fromPlayer.friends.push({ id: player.id, username: player.username, online: true });
            io.to(socket.id).emit('friendAdded', { id: fromPlayer.id, username: fromPlayer.username, online: true });
            io.to(data.fromId).emit('friendAdded', { id: player.id, username: player.username, online: true });
        }
    });

    socket.on('inviteFriend', (data) => {
        const player = players[socket.id];
        if (!player ||!player.roomId) return;
        io.to(data.friendId).emit('friendInvite', { username: player.username, roomId: player.roomId });
    });

    socket.on('move', (data) => {
        const player = players[socket.id];
        if (!player ||!player.matchId || player.hp <= 0) return;
        const match = matches[player.matchId];
        if (!match || match.state!== 'active') return;

        let speed = player.isSwimming? CONFIG.PLAYER_SWIM_SPEED : (player.isSprinting? CONFIG.PLAYER_SPRINT_SPEED : CONFIG.PLAYER_SPEED);
        const dt = 1 / CONFIG.TICK_RATE;

        const newX = player.x + data.x * speed * dt;
        const newY = player.y + data.y * speed * dt;

        if (!checkWallCollision(newX, player.y, 12)) player.x = newX;
        if (!checkWallCollision(player.x, newY, 12)) player.y = newY;

        player.angle = data.angle;
        player.isSprinting = data.sprint;
        player.x = Math.max(20, Math.min(CONFIG.MAP_SIZE - 20, player.x));
        player.y = Math.max(20, Math.min(CONFIG.MAP_SIZE - 20, player.y));
    });

    socket.on('shoot', (data) => {
        const player = players[socket.id];
        if (!player ||!player.matchId || player.hp <= 0) return;
        const match = matches[player.matchId];
        if (!match) return;

        const weapon = CONFIG.WEAPONS[player.weapon];
        const now = Date.now();
        if (now - player.lastShot < weapon.fireRate) return;
        if (weapon.ammo!== Infinity && player.ammo <= 0) return;

        player.lastShot = now;
        if (weapon.ammo!== Infinity) player.ammo--;

        const bullets = weapon.pellets || 1;
        for (let i = 0; i < bullets; i++) {
            const spread = weapon.spread || 0;
            const angle = data.angle + (Math.random() - 0.5) * spread;
            match.bullets.push({
                id: uuidv4(), ownerId: socket.id, x: player.x, y: player.y,
                vx: Math.cos(angle) * weapon.bulletSpeed,
                vy: Math.sin(angle) * weapon.bulletSpeed,
                damage: weapon.damage, lifetime: weapon.range / weapon.bulletSpeed * 1000
            });
        }
        io.to(player.matchId).emit('soundEvent', 'shoot');
    });

    socket.on('scope', (isScoping) => {
        const player = players[socket.id];
        if (player) player.isScoping = isScoping;
    });

    socket.on('reload', () => {
        const player = players[socket.id];
        if (!player) return;
        const weapon = CONFIG.WEAPONS[player.weapon];
        if (weapon.ammo!== Infinity) player.ammo = weapon.ammo;
    });

    socket.on('grenade', (data) => {
        const player = players[socket.id];
        if (!player ||!player.matchId || player.grenades <= 0) return;
        const match = matches[player.matchId];
        if (!match) return;

        player.grenades--;
        const grenadeX = player.x + Math.cos(data.angle) * 150;
        const grenadeY = player.y + Math.sin(data.angle) * 150;

        setTimeout(() => {
            if (!matches[player.matchId]) return;
            io.to(player.matchId).emit('explosion', { x: grenadeX, y: grenadeY });
            Object.values(match.players).forEach(p => {
                if (p.hp <= 0) return;
                const dist = getDistance(grenadeX, grenadeY, p.x, p.y);
                if (dist < CONFIG.GRENADE_RADIUS) {
                    const damage = CONFIG.GRENADE_DAMAGE * (1 - dist / CONFIG.GRENADE_RADIUS);
                    p.hp -= damage;
                    p.hp = Math.max(0, p.hp);
                    if (p.hp <= 0 && p.id!== socket.id) player.kills++;
                }
            });
        }, 3000);
    });

    socket.on('interact', () => {
        const player = players[socket.id];
        if (!player ||!player.matchId) return;
        const match = matches[player.matchId];
        if (!match) return;

        let nearestLoot = null;
        let nearestDist = 50;
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

    socket.on('switchWeapon', (weaponName) => {
        const player = players[socket.id];
        if (!player ||!CONFIG.WEAPONS[weaponName]) return;
        player.weapon = weaponName;
        player.ammo = CONFIG.WEAPONS[weaponName].ammo;
    });

    socket.on('changeSkin', (skin) => {
        const player = players[socket.id];
        if (player) player.skin = skin;
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        const player = players[socket.id];
        if (player) {
            if (player.matchId && matches[player.matchId]) {
                delete matches[player.matchId].players[socket.id];
            }
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
            removeFromMatchmaking(socket.id);
            if (player.friends) {
                player.friends.forEach(f => {
                    const friend = players[f.id];
                    if (friend) io.to(f.id).emit('friendUpdate');
                });
            }
            delete players[socket.id];
        }
        io.emit('onlineCount', Object.keys(players).length);
    });
});

// =====================================
// 9. LOOT HANDLER
// =====================================
function handleLootPickup(player, loot, match) {
    const lootData = loot.type.split('_');
    const category = lootData[0];
    const item = lootData[1];

    if (category === 'weapon') {
        player.weapon = item;
        player.ammo = CONFIG.WEAPONS[item].ammo;
        io.to(player.id).emit('lootPickup', { type: 'weapon', item: item, playerId: player.id });
    } else if (category === 'ammo') {
        player.ammo += item === 'light'? 30 : 20;
        io.to(player.id).emit('lootPickup', { type: 'ammo', amount: item === 'light'? 30 : 20, playerId: player.id });
    } else if (loot.type === 'armor') {
        player.armor = Math.min(CONFIG.PLAYER_ARMOR_MAX, player.armor + 50);
        io.to(player.id).emit('lootPickup', { type: 'armor', amount: 50, playerId: player.id });
    } else if (loot.type === 'medkit') {
        player.hp = Math.min(CONFIG.PLAYER_HP, player.hp + 75);
        io.to(player.id).emit('lootPickup', { type: 'heal', amount: 75, playerId: player.id });
    } else if (loot.type === 'grenade') {
        player.grenades++;
        io.to(player.id).emit('lootPickup', { type: 'grenade', amount: 1, playerId: player.id });
    }

    io.to(player.id).emit('soundEvent', 'pickup');
    match.loot = match.loot.filter(l => l.id!== loot.id);
}

// =====================================
// 10. EXPRESS ROUTES
// =====================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/map', (req, res) => {
    res.json(MAP_DATA);
});

app.get('/api/sprites', (req, res) => {
    res.json(SPRITE_DATA);
});

app.get('/api/stats', (req, res) => {
    res.json({
        players: Object.keys(players).length,
        matches: Object.keys(matches).map(id => ({
            id, players: Object.keys(matches[id].players).length, state: matches[id].state
        })),
        rooms: Object.keys(rooms).map(id => ({
            id, players: rooms[id].players.length, host: rooms[id].host
        }))
    });
});

// =====================================
// 11. START SERVER
// =====================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🔥 MG FIGHTER Server V3 running on port ${PORT}`);
    console.log(`🎮 Max players: ${CONFIG.MAX_PLAYERS_PER_MATCH}`);
    console.log(`⚡ Tick rate: ${CONFIG.TICK_RATE} Hz`);
    console.log(`🗺️ Map: ${CONFIG.MAP_SIZE}x${CONFIG.MAP_SIZE}`);
    console.log(`🧱 Walls: ${MAP_DATA.walls.length}`);
    console.log(`📁 Static files: Serving from ${__dirname}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
