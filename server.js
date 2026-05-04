

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: "*" }
});

app.use(express.static('public'));

const MAP_SIZE = 2000;
const PLAYERS = {};
const BULLETS = [];
const LOOT = [];
let ZONE = { x: MAP_SIZE/2, y: MAP_SIZE/2, radius: MAP_SIZE };
let gameStarted = false;

function spawnLoot() {
    const types = ['AK', 'Shotgun', 'Pistol', 'Medkit', 'Armor'];
    for(let i = 0; i < 30; i++) {
        LOOT.push({
            id: Math.random().toString(36),
            type: types[Math.floor(Math.random() * types.length)],
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE
        });
    }
}

function shrinkZone() {
    if (ZONE.radius > 200) {
        ZONE.radius -= 15;
        ZONE.x += (Math.random() - 0.5) * 50;
        ZONE.y += (Math.random() - 0.5) * 50;
        io.emit('zoneUpdate', ZONE);
    }
}

setInterval(shrinkZone, 10000);

io.on('connection', (socket) => {
    console.log('Player niditra:', socket.id);

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
        alive: true
    };

    if (Object.keys(PLAYERS).length >= 2 &&!gameStarted) {
        gameStarted = true;
        spawnLoot();
        io.emit('gameStart');
    }

    socket.emit('init', { players: PLAYERS, loot: LOOT, zone: ZONE, id: socket.id });

    socket.on('move', (data) => {
        if (!PLAYERS[socket.id]?.alive) return;
        PLAYERS[socket.id].x = Math.max(0, Math.min(MAP_SIZE, data.x));
        PLAYERS[socket.id].y = Math.max(0, Math.min(MAP_SIZE, data.y));
        PLAYERS[socket.id].angle = data.angle;
    });

    socket.on('shoot', () => {
        const p = PLAYERS[socket.id];
        if (!p?.alive || p.ammo <= 0 && p.weapon!== 'Fist') return;

        if (p.weapon!== 'Fist') p.ammo--;

        const speed = 15;
        const damage = p.weapon === 'AK'? 25 : p.weapon === 'Shotgun'? 40 : p.weapon === 'Pistol'? 15 : 10;

        BULLETS.push({
            x: p.x,
            y: p.y,
            angle: p.angle,
            speedX: Math.cos(p.angle) * speed,
            speedY: Math.sin(p.angle) * speed,
            owner: socket.id,
            damage: damage
        });
    });

    socket.on('pickup', (lootId) => {
        const p = PLAYERS[socket.id];
        const item = LOOT.find(l => l.id === lootId);
        if (!p?.alive ||!item) return;

        const dist = Math.hypot(p.x - item.x, p.y - item.y);
        if (dist < 40) {
            if (item.type === 'Medkit') p.hp = Math.min(100, p.hp + 50);
            else if (item.type === 'Armor') p.armor = 100;
            else {
                p.weapon = item.type;
                p.ammo = item.type === 'Shotgun'? 8 : 30;
            }
            LOOT.splice(LOOT.indexOf(item), 1);
            io.emit('lootTaken', lootId);
        }
    });

    socket.on('disconnect', () => {
        delete PLAYERS[socket.id];
    });
});

setInterval(() => {
    for (let i = BULLETS.length - 1; i >= 0; i--) {
        const b = BULLETS[i];
        b.x += b.speedX;
        b.y += b.speedY;

        for (let id in PLAYERS) {
            const p = PLAYERS[id];
            if (!p.alive || id === b.owner) continue;

            if (Math.hypot(b.x - p.x, b.y - p.y) < 20) {
                let dmg = b.damage;
                if (p.armor > 0) {
                    p.armor -= dmg;
                    if (p.armor < 0) {
                        p.hp += p.armor;
                        p.armor = 0;
                    }
                } else {
                    p.hp -= dmg;
                }

                if (p.hp <= 0) {
                    p.alive = false;
                    if (PLAYERS[b.owner]) PLAYERS[b.owner].kills++;
                    io.emit('killFeed', {
                        killer: b.owner,
                        victim: id,
                        playersAlive: Object.values(PLAYERS).filter(pl => pl.alive).length
                    });
                }
                BULLETS.splice(i, 1);
                break;
            }
        }

        if (b.x < 0 || b.x > MAP_SIZE || b.y < 0 || b.y > MAP_SIZE) {
            BULLETS.splice(i, 1);
        }
    }

    for (let id in PLAYERS) {
        const p = PLAYERS[id];
        if (!p.alive) continue;
        const distFromZone = Math.hypot(p.x - ZONE.x, p.y - ZONE.y);
        if (distFromZone > ZONE.radius) {
            p.hp -= 0.5;
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
http.listen(PORT, '0.0.0.0', () => console.log(`Server mandeha @ port ${PORT}`));
