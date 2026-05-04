const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static('public'));

const MAP_SIZE = 3000;
const PLAYERS = {};
const BULLETS = [];
const LOOT = [];
const BUILDINGS = [];
const BUSHES = [];
let ZONE = { x: MAP_SIZE/2, y: MAP_SIZE/2, radius: MAP_SIZE };
let gameStarted = false;
let gameTimer = 0;

// GENERATE MAP PRO
function generateMap() {
    // Buildings
    for(let i = 0; i < 15; i++) {
        BUILDINGS.push({
            id: Math.random().toString(36),
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            w: 100 + Math.random() * 100,
            h: 100 + Math.random() * 100,
            doors: [{x: 0.5, y: 1, open: false}]
        });
    }

    // Bushes
    for(let i = 0; i < 40; i++) {
        BUSHES.push({
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            radius: 30 + Math.random() * 20
        });
    }

    // Loot
    const weapons = ['AK', 'Shotgun', 'Sniper', 'SMG', 'Pistol'];
    for(let i = 0; i < 50; i++) {
        LOOT.push({
            id: Math.random().toString(36),
            type: Math.random() > 0.3? weapons[Math.floor(Math.random() * weapons.length)] : ['Medkit', 'Armor', 'Scope'][Math.floor(Math.random() * 3)],
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE
        });
    }
}

function checkCollision(x, y, size = 15) {
    for(let b of BUILDINGS) {
        if(x + size > b.x && x - size < b.x + b.w &&
           y + size > b.y && y - size < b.y + b.h) return true;
    }
    return false;
}

function shrinkZone() {
    if (ZONE.radius > 300) {
        ZONE.radius -= 20;
        gameTimer++;
        io.emit('zoneUpdate', {zone: ZONE, timer: gameTimer});
    }
}

setInterval(shrinkZone, 8000);
generateMap();

io.on('connection', (socket) => {
    PLAYERS[socket.id] = {
        id: socket.id,
        x: Math.random() * MAP_SIZE,
        y: Math.random() * MAP_SIZE,
        hp: 100,
        armor: 0,
        angle: 0,
        weapon: 'Fist',
        ammo: 0,
        kills: 0,
        alive: true,
        inBush: false,
        hasScope: false,
        zooming: false
    };

    if (Object.keys(PLAYERS).length >= 2 &&!gameStarted) {
        gameStarted = true;
        io.emit('gameStart');
    }

    socket.emit('init', {
        players: PLAYERS,
        loot: LOOT,
        buildings: BUILDINGS,
        bushes: BUSHES,
        zone: ZONE,
        id: socket.id
    });

    socket.on('move', (data) => {
        const p = PLAYERS[socket.id];
        if (!p?.alive) return;

        let newX = Math.max(15, Math.min(MAP_SIZE - 15, data.x));
        let newY = Math.max(15, Math.min(MAP_SIZE - 15, data.y));

        if (!checkCollision(newX, newY)) {
            p.x = newX;
            p.y = newY;
        }
        p.angle = data.angle;
        p.zooming = data.zooming;

        // Check if in bush
        p.inBush = BUSHES.some(b => Math.hypot(p.x - b.x, p.y - b.y) < b.radius);
    });

    socket.on('shoot', () => {
        const p = PLAYERS[socket.id];
        if (!p?.alive || (p.ammo <= 0 && p.weapon!== 'Fist')) return;

        if (p.weapon!== 'Fist') p.ammo--;

        const weaponStats = {
            AK: {damage: 25, speed: 18, spread: 0.1},
            Shotgun: {damage: 15, speed: 12, spread: 0.4, pellets: 5},
            Sniper: {damage: 80, speed: 25, spread: 0.02},
            SMG: {damage: 12, speed: 20, spread: 0.15},
            Pistol: {damage: 20, speed: 15, spread: 0.08},
            Fist: {damage: 10, speed: 10, spread: 0}
        };

        const stats = weaponStats[p.weapon];
        const pellets = stats.pellets || 1;

        for(let i = 0; i < pellets; i++) {
            const angle = p.angle + (Math.random() - 0.5) * stats.spread;
            BULLETS.push({
                x: p.x,
                y: p.y,
                angle: angle,
                speedX: Math.cos(angle) * stats.speed,
                speedY: Math.sin(angle) * stats.speed,
                owner: socket.id,
                damage: stats.damage,
                weapon: p.weapon
            });
        }
    });

    socket.on('pickup', (lootId) => {
        const p = PLAYERS[socket.id];
        const item = LOOT.find(l => l.id === lootId);
        if (!p?.alive ||!item) return;

        const dist = Math.hypot(p.x - item.x, p.y - item.y);
        if (dist < 50) {
            if (item.type === 'Medkit') p.hp = Math.min(100, p.hp + 50);
            else if (item.type === 'Armor') p.armor = 100;
            else if (item.type === 'Scope') p.hasScope = true;
            else {
                p.weapon = item.type;
                const ammoCount = {Sniper: 10, Shotgun: 8, AK: 30, SMG: 40, Pistol: 15};
                p.ammo = ammoCount[item.type] || 30;
            }
            LOOT.splice(LOOT.indexOf(item), 1);
            io.emit('lootTaken', lootId);
        }
    });

    socket.on('disconnect', () => {
        delete PLAYERS[socket.id];
        const alivePlayers = Object.values(PLAYERS).filter(p => p.alive);
        if (alivePlayers.length === 1 && gameStarted) {
            io.emit('gameEnd', {winner: alivePlayers[0].id});
            gameStarted = false;
        }
    });
});

setInterval(() => {
    // Update bullets
    for (let i = BULLETS.length - 1; i >= 0; i--) {
        const b = BULLETS[i];
        b.x += b.speedX;
        b.y += b.speedY;

        if (checkCollision(b.x, b.y, 3)) {
            BULLETS.splice(i, 1);
            continue;
        }

        for (let id in PLAYERS) {
            const p = PLAYERS[id];
            if (!p.alive || id === b.owner) continue;

            if (Math.hypot(b.x - p.x, b.y - p.y) < 20) {
                let dmg = b.damage;
                if (p.armor > 0) {
                    p.armor -= dmg;
                    if (p.armor < 0) { p.hp += p.armor; p.armor = 0; }
                } else p.hp -= dmg;

                io.to(id).emit('hit', {damage: dmg, x: b.x, y: b.y});
                io.to(b.owner).emit('hitmarker', {x: p.x, y: p.y, damage: dmg});

                if (p.hp <= 0) {
                    p.alive = false;
                    if (PLAYERS[b.owner]) PLAYERS[b.owner].kills++;
                    const aliveCount = Object.values(PLAYERS).filter(pl => pl.alive).length;
                    io.emit('killFeed', {
                        killer: b.owner,
                        victim: id,
                        weapon: b.weapon,
                        playersAlive: aliveCount
                    });

                    if (aliveCount === 1) {
                        const winner = Object.values(PLAYERS).find(pl => pl.alive);
                        io.emit('gameEnd', {winner: winner.id});
                        gameStarted = false;
                    }
                }
                BULLETS.splice(i, 1);
                break;
            }
        }

        if (b.x < 0 || b.x > MAP_SIZE || b.y < 0 || b.y > MAP_SIZE) {
            BULLETS.splice(i, 1);
        }
    }

    // Zone damage
    for (let id in PLAYERS) {
        const p = PLAYERS[id];
        if (!p.alive) continue;
        const distFromZone = Math.hypot(p.x - ZONE.x, p.y - ZONE.y);
        if (distFromZone > ZONE.radius) {
            p.hp -= 0.8;
            if (p.hp <= 0) {
                p.alive = false;
                io.emit('killFeed', {
                    killer: 'ZONE',
                    victim: id,
                    playersAlive: Object.values(PLAYERS).filter(pl => pl.alive).length
                });
            }
        }
    }

    io.emit('gameState', { players: PLAYERS, bullets: BULLETS, loot: LOOT });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => console.log(`MG Fighter Pro Server @ ${PORT}`));
