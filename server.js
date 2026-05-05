
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');



const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

setInterval(gameLoop, 1000 / TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`MG Fighter Server v4.0 running on port ${PORT}`);
});
// ============================================
// 1. DATABASE SETUP
// ============================================
const MONGODB_URI = process.env.MONGODB_URI || '';
let useDB = false;

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    coins: { type: Number, default: 100 },
    wins: { type: Number, default: 0 },
    kills: { type: Number, default: 0 },
    skin: {
        color: { type: String, default: '#00ff00' },
        hat: { type: String, default: 'none' },
        gun: { type: String, default: 'default' }
    },
    friends: [String],
    battlePass: {
        level: { type: Number, default: 1 },
        xp: { type: Number, default: 0 },
        claimed: [Number]
    },
    createdAt: { type: Date, default: Date.now }
});

let User;
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI).then(() => {
        console.log('MongoDB connected');
        useDB = true;
        User = mongoose.model('User', userSchema);
    }).catch(err => {
        console.log('MongoDB failed, using memory:', err.message);
        useDB = false;
    });
}

// Memory fallback
const memoryUsers = new Map();

// ============================================
// 2. GAME CONSTANTS
// ============================================
const MAP_SIZE = 3000;
const TICK_RATE = 20;
const ZONE_SHRINK_INTERVAL = 30000;
const WEAPONS = {
    Fist: { damage: 10, speed: 10, ammo: Infinity, spread: 0, fireRate: 300 },
    Pistol: { damage: 20, speed: 15, ammo: 15, spread: 0.08, fireRate: 400 },
    SMG: { damage: 12, speed: 20, ammo: 40, spread: 0.15, fireRate: 100 },
    AK: { damage: 25, speed: 18, ammo: 30, spread: 0.1, fireRate: 150 },
    Shotgun: { damage: 15, speed: 12, ammo: 8, spread: 0.4, pellets: 5, fireRate: 800 },
    Sniper: { damage: 80, speed: 25, ammo: 10, spread: 0.02, fireRate: 1200 }
};

// ============================================
// 3. GAME STATE
// ============================================
let lobbyPlayers = new Map(); // socketId -> {username, socket}
let rooms = new Map(); // roomId -> Room
let games = new Map(); // roomId -> Game
let matchmaking = {
    solo: [],
    duo: [],
    squad: []
};

class Room {
    constructor(id, host, mode = 'custom') {
        this.id = id;
        this.host = host;
        this.mode = mode;
        this.players = [];
        this.maxPlayers = mode === 'solo'? 1 : mode === 'duo'? 2 : 4;
        this.status = 'waiting';
    }
}

class Game {
    constructor(roomId, players) {
        this.roomId = roomId;
        this.players = {};
        this.bullets = [];
        this.grenades = [];
        this.loot = [];
        this.buildings = [];
        this.bushes = [];
        this.vehicles = [];
        this.zone = { x: 1500, y: 1500, radius: 3000 };
        this.zoneTimer = 30;
        this.lastShotTime = {};
        this.status = 'playing';
        this.startTime = Date.now();
        this.init(players);
    }

    init(players) {
        // Spawn buildings
        for (let i = 0; i < 20; i++) {
            this.buildings.push({
                x: Math.random() * (MAP_SIZE - 200),
                y: Math.random() * (MAP_SIZE - 200),
                w: 80 + Math.random() * 100,
                h: 80 + Math.random() * 100
            });
        }

        // Spawn bushes
        for (let i = 0; i < 30; i++) {
            this.bushes.push({
                x: Math.random() * MAP_SIZE,
                y: Math.random() * MAP_SIZE,
                radius: 30 + Math.random() * 30
            });
        }

        // Spawn vehicles
        for (let i = 0; i < 5; i++) {
            this.vehicles.push({
                id: uuidv4(),
                x: Math.random() * MAP_SIZE,
                y: Math.random() * MAP_SIZE,
                angle: 0,
                driver: null,
                speed: 8,
                hp: 200
            });
        }

        // Spawn loot
        this.spawnLoot();

        // Init players
        players.forEach((p, idx) => {
            const team = this.getTeam(idx, players.length);
            this.players[p.socketId] = {
                id: p.socketId,
                name: p.username,
                x: 200 + Math.random() * (MAP_SIZE - 400),
                y: 200 + Math.random() * (MAP_SIZE - 400),
                angle: 0,
                hp: 100,
                armor: 0,
                weapon: 'Fist',
                ammo: Infinity,
                grenades: 2,
                kills: 0,
                level: p.level || 1,
                xp: p.xp || 0,
                alive: true,
                skin: p.skin || { color: '#00ff00', hat: 'none', gun: 'default' },
                inBush: false,
                inVehicle: null,
                team: team,
                zooming: false,
                sprinting: false
            };
        });
    }

    getTeam(idx, total) {
        if (total <= 1) return null;
        if (total === 2) return idx < 1? 'A' : 'B';
        if (total === 4) return idx < 2? 'A' : 'B';
        return null;
    }

    spawnLoot() {
        const types = ['Medkit', 'Armor', 'Scope', 'AK', 'Shotgun', 'Sniper', 'SMG', 'Pistol', 'Grenade'];
        for (let i = 0; i < 40; i++) {
            this.loot.push({
                id: uuidv4(),
                x: Math.random() * MAP_SIZE,
                y: Math.random() * MAP_SIZE,
                type: types[Math.floor(Math.random() * types.length)]
            });
        }
    }
}

// ============================================
// 4. AUTH ROUTES
// ============================================
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username ||!password) return res.json({ error: 'Fenoy daholo' });
        if (username.length < 3) return res.json({ error: 'Username 3 lettres minimum' });

        if (useDB) {
            const exists = await User.findOne({ username });
            if (exists) return res.json({ error: 'Username efa misy' });
            const hash = await bcrypt.hash(password, 10);
            const user = new User({ username, password: hash });
            await user.save();
            res.json({ success: true, user: sanitizeUser(user) });
        } else {
            if (memoryUsers.has(username)) return res.json({ error: 'Username efa misy' });
            const hash = await bcrypt.hash(password, 10);
            const user = {
                username, password: hash, level: 1, xp: 0, coins: 100,
                wins: 0, kills: 0, skin: { color: '#00ff00', hat: 'none', gun: 'default' },
                friends: [], battlePass: { level: 1, xp: 0, claimed: [] }
            };
            memoryUsers.set(username, user);
            res.json({ success: true, user: sanitizeUser(user) });
        }
    } catch (err) {
        res.json({ error: 'Erreur serveur' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        let user;

        if (useDB) {
            user = await User.findOne({ username });
        } else {
            user = memoryUsers.get(username);
        }

        if (!user) return res.json({ error: 'User tsy hita' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.json({ error: 'Password diso' });

        res.json({ success: true, user: sanitizeUser(user) });
    } catch (err) {
        res.json({ error: 'Erreur serveur' });
    }
});

function sanitizeUser(user) {
    const u = user.toObject? user.toObject() : user;
    delete u.password;
    return u;
}

// ============================================
// 5. SOCKET HANDLERS
// ============================================
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // AUTH
    socket.on('auth', async (username) => {
        let user;
        if (useDB) {
            user = await User.findOne({ username });
        } else {
            user = memoryUsers.get(username);
        }
        if (user) {
            socket.username = username;
            lobbyPlayers.set(socket.id, { username, socket,...sanitizeUser(user) });
            socket.emit('authSuccess', sanitizeUser(user));
            io.emit('lobbyUpdate', lobbyPlayers.size);
        }
    });

    // LOBBY CHAT
    socket.on('lobbyChat', (msg) => {
        if (!socket.username || msg.length > 200) return;
        io.emit('lobbyChat', {
            username: socket.username,
            msg: msg.substring(0, 200),
            time: Date.now()
        });
    });

    // FRIENDS
    socket.on('addFriend', async (friendName) => {
        if (!socket.username || friendName === socket.username) return;
        const player = lobbyPlayers.get(socket.id);
        if (!player.friends.includes(friendName)) {
            player.friends.push(friendName);
            if (useDB) await User.updateOne({ username: socket.username }, { $push: { friends: friendName } });
            socket.emit('friendAdded', friendName);
        }
    });

    socket.on('getFriends', () => {
        const player = lobbyPlayers.get(socket.id);
        if (!player) return;
        const online = player.friends.filter(f => Array.from(lobbyPlayers.values()).some(p => p.username === f));
        socket.emit('friendsList', { all: player.friends, online });
    });

    // SKIN
    socket.on('setSkin', async (skin) => {
        const player = lobbyPlayers.get(socket.id);
        if (!player) return;
        player.skin = skin;
        if (useDB) await User.updateOne({ username: socket.username }, { skin });
    });

    // MATCHMAKING
    socket.on('findMatch', (mode) => {
        if (!socket.username) return;
        matchmaking[mode].push({ socketId: socket.id, username: socket.username });
        checkMatchmaking(mode);
    });

    socket.on('createRoom', (mode) => {
        if (!socket.username) return;
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const room = new Room(roomId, socket.id, mode);
        room.players.push({ id: socket.id, username: socket.username, ready: false });
        rooms.set(roomId, room);
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        io.to(roomId).emit('roomUpdate', room);
    });

    socket.on('joinRoom', (roomId) => {
        const room = rooms.get(roomId);
        if (!room || room.players.length >= 4) return;
        if (room.players.find(p => p.id === socket.id)) return;
        room.players.push({ id: socket.id, username: socket.username, ready: false });
        socket.join(roomId);
        io.to(roomId).emit('roomUpdate', room);
    });

    socket.on('leaveRoom', () => {
        for (let [roomId, room] of rooms) {
            const idx = room.players.findIndex(p => p.id === socket.id);
            if (idx!== -1) {
                room.players.splice(idx, 1);
                socket.leave(roomId);
                if (room.players.length === 0) rooms.delete(roomId);
                else io.to(roomId).emit('roomUpdate', room);
                break;
            }
        }
    });

    socket.on('ready', () => {
        for (let [roomId, room] of rooms) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.ready = true;
                io.to(roomId).emit('roomUpdate', room);
                if (room.players.every(p => p.ready) && room.players.length >= 2) {
                    startGame(roomId);
                }
                break;
            }
        }
    });

    socket.on('roomChat', (msg) => {
        if (!socket.username || msg.length > 200) return;
        for (let [roomId, room] of rooms) {
            if (room.players.find(p => p.id === socket.id)) {
                io.to(roomId).emit('roomChat', {
                    username: socket.username,
                    msg: msg.substring(0, 200),
                    time: Date.now()
                });
                break;
            }
        }
    });

    // GAME
    socket.on('joinGame', (roomId) => {
        const game = games.get(roomId);
        if (!game) return;
        socket.join(roomId);
        socket.gameId = roomId;
        socket.emit('gameInit', {
            id: socket.id,
            players: game.players,
            loot: game.loot,
            buildings: game.buildings,
            bushes: game.bushes,
            vehicles: game.vehicles,
            zone: game.zone,
            leaderboard: getLeaderboard()
        });
    });

    socket.on('move', (data) => {
        const game = games.get(socket.gameId);
        if (!game ||!game.players[socket.id]?.alive) return;
        const p = game.players[socket.id];
        p.x = Math.max(15, Math.min(MAP_SIZE - 15, data.x));
        p.y = Math.max(15, Math.min(MAP_SIZE - 15, data.y));
        p.angle = data.angle;
        p.zooming = data.zooming;
        p.sprinting = data.sprinting;
        p.inBush = game.bushes.some(b => Math.hypot(p.x - b.x, p.y - b.y) < b.radius);
    });

    socket.on('shoot', () => {
        const game = games.get(socket.gameId);
        if (!game ||!game.players[socket.id]?.alive) return;
        const p = game.players[socket.id];
        const weapon = WEAPONS[p.weapon];
        const now = Date.now();
        if (!game.lastShotTime[socket.id]) game.lastShotTime[socket.id] = 0;
        if (now - game.lastShotTime[socket.id] < weapon.fireRate) return;
        if (p.ammo <= 0 && p.weapon!== 'Fist') return;

        game.lastShotTime[socket.id] = now;
        if (p.weapon!== 'Fist') p.ammo--;

        const pellets = weapon.pellets || 1;
        for (let i = 0; i < pellets; i++) {
            const spread = (Math.random() - 0.5) * weapon.spread;
            game.bullets.push({
                id: uuidv4(),
                x: p.x + Math.cos(p.angle) * 25,
                y: p.y + Math.sin(p.angle) * 25,
                angle: p.angle + spread,
                speedX: Math.cos(p.angle + spread) * weapon.speed,
                speedY: Math.sin(p.angle + spread) * weapon.speed,
                damage: weapon.damage,
                owner: socket.id,
                weapon: p.weapon
            });
        }
    });

    socket.on('throwGrenade', () => {
        const game = games.get(socket.gameId);
        if (!game ||!game.players[socket.id]?.alive) return;
        const p = game.players[socket.id];
        if (p.grenades <= 0) return;
        p.grenades--;
        game.grenades.push({
            id: uuidv4(),
            x: p.x + Math.cos(p.angle) * 40,
            y: p.y + Math.sin(p.angle) * 40,
            vx: Math.cos(p.angle) * 8,
            vy: Math.sin(p.angle) * 8,
            timer: 60,
            owner: socket.id
        });
    });

    socket.on('pickup', (lootId) => {
        const game = games.get(socket.gameId);
        if (!game ||!game.players[socket.id]?.alive) return;
        const p = game.players[socket.id];
        const idx = game.loot.findIndex(l => l.id === lootId);
        if (idx === -1) return;
        const loot = game.loot[idx];
        if (Math.hypot(p.x - loot.x, p.y - loot.y) > 60) return;

        if (loot.type === 'Medkit') p.hp = Math.min(100, p.hp + 50);
        else if (loot.type === 'Armor') p.armor = Math.min(100, p.armor + 50);
        else if (loot.type === 'Grenade') p.grenades++;
        else {
            p.weapon = loot.type;
            p.ammo = WEAPONS[loot.type].ammo;
        }

        game.loot.splice(idx, 1);
        io.to(socket.gameId).emit('lootTaken', lootId);
    });

    socket.on('enterVehicle', (vehicleId) => {
        const game = games.get(socket.gameId);
        if (!game ||!game.players[socket.id]?.alive) return;
        const p = game.players[socket.id];
        const v = game.vehicles.find(v => v.id === vehicleId);
        if (!v || v.driver) return;
        if (Math.hypot(p.x - v.x, p.y - v.y) > 50) return;
        v.driver = socket.id;
        p.inVehicle = vehicleId;
    });

    socket.on('exitVehicle', () => {
        const game = games.get(socket.gameId);
        if (!game ||!game.players[socket.id]) return;
        const p = game.players[socket.id];
        if (!p.inVehicle) return;
        const v = game.vehicles.find(v => v.id === p.inVehicle);
        if (v) v.driver = null;
        p.inVehicle = null;
    });

    // DISCONNECT
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        lobbyPlayers.delete(socket.id);
        io.emit('lobbyUpdate', lobbyPlayers.size);

        // Remove from matchmaking
        for (let mode in matchmaking) {
            matchmaking[mode] = matchmaking[mode].filter(p => p.socketId!== socket.id);
        }

        // Remove from room
        for (let [roomId, room] of rooms) {
            const idx = room.players.findIndex(p => p.id === socket.id);
            if (idx!== -1) {
                room.players.splice(idx, 1);
                if (room.players.length === 0) rooms.delete(roomId);
                else io.to(roomId).emit('roomUpdate', room);
                break;
            }
        }

        // Remove from game
        if (socket.gameId) {
            const game = games.get(socket.gameId);
            if (game && game.players[socket.id]) {
                game.players[socket.id].alive = false;
                checkGameEnd(socket.gameId);
            }
        }
    });
});

// ============================================
// 6. GAME LOGIC
// ============================================
function checkMatchmaking(mode) {
    const queue = matchmaking[mode];
    const needed = mode === 'solo'? 1 : mode === 'duo'? 2 : 4;
    if (queue.length >= needed) {
        const players = queue.splice(0, needed);
        const roomId = uuidv4();
        const room = new Room(roomId, players[0].socketId, mode);
        players.forEach(p => {
            room.players.push({ id: p.socketId, username: p.username, ready: true });
            const sock = io.sockets.sockets.get(p.socketId);
            if (sock) sock.join(roomId);
        });
        rooms.set(roomId, room);
        startGame(roomId);
    }
}

function startGame(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    const players = room.players.map(p => {
        const lp = lobbyPlayers.get(p.id);
        return { socketId: p.id, username: p.username, level: lp?.level, xp: lp?.xp, skin: lp?.skin };
    });
    const game = new Game(roomId, players);
    games.set(roomId, game);
    io.to(roomId).emit('gameStart', roomId);
    rooms.delete(roomId);
}

function gameLoop() {
    for (let [roomId, game] of games) {
        if (game.status!== 'playing') continue;

        // Update bullets
        game.bullets = game.bullets.filter(b => {
            b.x += b.speedX;
            b.y += b.speedY;

            // Check collision with players
            for (let pid in game.players) {
                if (pid === b.owner ||!game.players[pid].alive) continue;
                const p = game.players[pid];
                if (game.players[b.owner]?.team && p.team === game.players[b.owner].team) continue;
                if (Math.hypot(b.x - p.x, b.y - p.y) < 20) {
                    let dmg = b.damage;
                    if (p.armor > 0) {
                        const absorbed = Math.min(p.armor, dmg * 0.7);
                        p.armor -= absorbed;
                        dmg -= absorbed;
                    }
                    p.hp -= dmg;
                    io.to(pid).emit('hit', { damage: dmg, x: b.x, y: b.y });
                    io.to(b.owner).emit('hitmarker', { damage: dmg, x: b.x, y: b.y });

                    if (p.hp <= 0) {
                        p.alive = false;
                        game.players[b.owner].kills++;
                        game.players[b.owner].xp += 50;
                        io.to(roomId).emit('killFeed', {
                            killer: game.players[b.owner].name,
                            victim: p.name,
                            weapon: b.weapon,
                            playersAlive: Object.values(game.players).filter(pl => pl.alive).length
                        });
                        updatePlayerStats(b.owner, 'kill');
                        checkGameEnd(roomId);
                    }
                    return false;
                }
            }

            // Check bounds
            return b.x > 0 && b.x < MAP_SIZE && b.y > 0 && b.y < MAP_SIZE;
        });

        // Update grenades
        game.grenades = game.grenades.filter(g => {
            g.x += g.vx;
            g.y += g.vy;
            g.vx *= 0.98;
            g.vy *= 0.98;
            g.timer--;

            if (g.timer <= 0) {
                // Explosion
                io.to(roomId).emit('explosion', { x: g.x, y: g.y });
                for (let pid in game.players) {
                    const p = game.players[pid];
                    if (!p.alive) continue;
                    const dist = Math.hypot(g.x - p.x, g.y - p.y);
                    if (dist < 80) {
                        const dmg = 100 * (1 - dist / 80);
                        let finalDmg = dmg;
                        if (p.armor > 0) {
                            const absorbed = Math.min(p.armor, finalDmg * 0.7);
                            p.armor -= absorbed;
                            finalDmg -= absorbed;
                        }
                        p.hp -= finalDmg;
                        io.to(pid).emit('hit', { damage: finalDmg, x: g.x, y: g.y });

                        if (p.hp <= 0 && pid!== g.owner) {
                            p.alive = false;
                            if (game.players[g.owner]) {
                                game.players[g.owner].kills++;
                                game.players[g.owner].xp += 50;
                            }
                            io.to(roomId).emit('killFeed', {
                                killer: game.players[g.owner]?.name || 'Grenade',
                                victim: p.name,
                                weapon: 'Grenade',
                                playersAlive: Object.values(game.players).filter(pl => pl.alive).length
                            });
                            checkGameEnd(roomId);
                        }
                    }
                }
                return false;
            }
            return true;
        });

        // Update vehicles
        game.vehicles.forEach(v => {
            if (v.driver && game.players[v.driver]?.alive) {
                const p = game.players[v.driver];
                v.x = p.x;
                v.y = p.y;
                v.angle = p.angle;
            }
        });

        // Zone shrink
        game.zoneTimer--;
        if (game.zoneTimer <= 0) {
            game.zone.radius = Math.max(100, game.zone.radius - 100);
            game.zoneTimer = 150;
            io.to(roomId).emit('zoneUpdate', { zone: game.zone, timer: game.zoneTimer / TICK_RATE });
        }

        // Zone damage
        for (let pid in game.players) {
            const p = game.players[pid];
            if (!p.alive) continue;
            const dist = Math.hypot(p.x - game.zone.x, p.y - game.zone.y);
            if (dist > game.zone.radius) {
                p.hp -= 0.5;
                if (p.hp <= 0) {
                    p.alive = false;
                    io.to(roomId).emit('killFeed', {
                        killer: 'ZONE',
                        victim: p.name,
                        weapon: 'Zone',
                        playersAlive: Object.values(game.players).filter(pl => pl.alive).length
                    });
                    checkGameEnd(roomId);
                }
            }
        }

        // Broadcast game state
        io.to(roomId).emit('gameState', {
            players: game.players,
            bullets: game.bullets,
            grenades: game.grenades,
            loot: game.loot,
            vehicles: game.vehicles
        });
    }
}

function checkGameEnd(roomId) {
    const game = games.get(roomId);
    if (!game) return;
    const alive = Object.values(game.players).filter(p => p.alive);
    if (alive.length <= 1) {
        game.status = 'ended';
        if (alive.length === 1) {
            const winner = alive[0];
            updatePlayerStats(winner.id, 'win');
            io.to(roomId).emit('gameEnd', { winner: winner.id, rank: 1 });
        }
        setTimeout(() => games.delete(roomId), 5000);
    }
}

async function updatePlayerStats(socketId, type) {
    const player = lobbyPlayers.get(socketId);
    if (!player) return;
    if (type === 'kill') player.kills++;
    if (type === 'win') {
        player.wins++;
        player.coins += 100;
        player.xp += 200;
    }
    if (player.xp >= 100) {
        player.level++;
        player.xp -= 100;
        player.coins += 50;
    }
    if (useDB) {
        await User.updateOne({ username: player.username }, {
            $inc: { kills: type === 'kill'? 1 : 0, wins: type === 'win'? 1 : 0 },
            $set: { level: player.level, xp: player.xp, coins: player.coins }
        });
    }
    io.emit('leaderboardUpdate', getLeaderboard());
}

function getLeaderboard() {
    const all = Array.from(lobbyPlayers.values()).map(p => ({
        name: p.username,
        kills: p.kills,
        wins: p.wins,
        level: p.level
    }));
    return all.sort((a, b) => b.wins - a.wins || b.kills - a.kills).slice(0, 10);
}

// ============================================
// 7. START SERVER
// ============================================
setInterval(gameLoop, 1000 / TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`MG Fighter Server v4.0 running on port ${PORT}`);
    console.log(`Tick rate: ${TICK_RATE}Hz`);
});
// Serve static files
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

