const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static('public'));
app.use(express.json());

const MAP_SIZE = 3000;
const PLAYERS = {};
const BULLETS = [];
const GRENADES = [];
const LOOT = [];
const BUILDINGS = [];
const BUSHES = [];
const VEHICLES = [];
const TEAMS = {}; // teamCode: [playerIds]
let LEADERBOARD = []; // Top 10
let ZONE = { x: MAP_SIZE/2, y: MAP_SIZE/2, radius: MAP_SIZE };
let gameTimer = 0;

// MAP GENERATION
function generateMap() {
    // Buildings
    for(let i = 0; i < 15; i++) {
        BUILDINGS.push({
            id: Math.random().toString(36),
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            w: 100 + Math.random() * 100,
            h: 100 + Math.random() * 100
        });
    }
    // Bushes
    for(let i = 0; i < 40; i++) {
        BUSHES.push({ x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE, radius: 30 + Math.random() * 20 });
    }
    // Vehicles - Moto
    for(let i = 0; i < 3; i++) {
        VEHICLES.push({
            id: Math.random().toString(36),
            type: 'Moto',
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            angle: 0,
            hp: 100,
            driver: null,
            speed: 8
        });
    }
    // Loot
    const weapons = ['AK', 'Shotgun', 'Sniper', 'SMG', 'Pistol', 'Grenade'];
    for(let i = 0; i < 60; i++) {
        LOOT.push({
            id: Math.random().toString(36),
            type: Math.random() > 0.2? weapons[Math.floor(Math.random() * weapons.length)] : ['Medkit', 'Armor', 'Scope'][Math.floor(Math.random() * 3)],
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE
        });
    }
}

function checkCollision(x, y, size = 15) {
    for(let b of BUILDINGS) {
        if(x + size > b.x && x - size < b.x + b.w && y + size > b.y && y - size < b.y + b.h) return true;
    }
    return false;
}

function updateLeaderboard() {
    const allPlayers = Object.values(PLAYERS).sort((a,b) => b.totalKills - a.totalKills);
    LEADERBOARD = allPlayers.slice(0, 10).map(p => ({ name: p.name, kills: p.totalKills, wins: p.wins }));
    io.emit('leaderboardUpdate', LEADERBOARD);
}

setInterval(() => {
    if (ZONE.radius > 300) {
        ZONE.radius -= 20;
        gameTimer++;
        io.emit('zoneUpdate', {zone: ZONE, timer: gameTimer});
    }
}, 8000);

generateMap();

io.on('connection', (socket) => {
    PLAYERS[socket.id] = {
        id: socket.id,
        name: `Player${Math.floor(Math.random()*9999)}`,
        x: Math.random() * MAP_SIZE,
        y: Math.random() * MAP_SIZE,
        hp: 100, armor: 0, angle: 0,
        weapon: 'Fist', ammo: 0,
        grenades: 0,
        kills: 0, totalKills: 0, wins: 0,
        level: 1, xp: 0,
        alive: true, inBush: false, hasScope: false,
        skin: { color: '#00ff00', hat: 'none' },
        team: null,
        inVehicle: null
    };

    socket.emit('init', {
        players: PLAYERS, loot: LOOT, buildings: BUILDINGS,
        bushes: BUSHES, vehicles: VEHICLES, zone: ZONE,
        leaderboard: LEADERBOARD, id: socket.id
    });

    socket.on('setName', (name) => { if(PLAYERS[socket.id]) PLAYERS[socket.id].name = name.substring(0,12); });
    socket.on('setSkin', (skin) => { if(PLAYERS[socket.id]) PLAYERS[socket.id].skin = skin; });

    socket.on('createTeam', (mode) => {
        const code = Math.random().toString(36).substring(2, 7).toUpperCase();
        TEAMS[code] = [socket.id];
        PLAYERS[socket.id].team = code;
        socket.emit('teamCreated', {code, mode});
    });

    socket.on('joinTeam', (code) => {
        if (TEAMS[code] && TEAMS[code].length < 4) {
            TEAMS[code].push(socket.id);
            PLAYERS[socket.id].team = code;
            socket.emit('teamJoined', {code, members: TEAMS[code].length});
            TEAMS[code].forEach(id => io.to(id).emit('teamUpdate', TEAMS[code].map(pid => PLAYERS[pid].name)));
        }
    });

    socket.on('move', (data) => {
        const p = PLAYERS[socket.id];
        if (!p?.alive) return;

        let speed = data.sprinting? 6 : 4;
        if (p.inVehicle) {
            const v = VEHICLES.find(v => v.id === p.inVehicle);
            if (v) speed = v.speed;
        }

        let newX = Math.max(15, Math.min(MAP_SIZE - 15, data.x));
        let newY = Math.max(15, Math.min(MAP_SIZE - 15, data.y));

        if (!p.inVehicle &&!checkCollision(newX, newY)) {
            p.x = newX; p.y = newY;
        } else if (p.inVehicle) {
            p.x = newX; p.y = newY;
            const v = VEHICLES.find(v => v.id === p.inVehicle);
            if (v) { v.x = newX; v.y = newY; v.angle = data.angle; }
        }
        p.angle = data.angle;
        p.inBush = BUSHES.some(b => Math.hypot(p.x - b.x, p.y - b.y) < b.radius);
    });

    socket.on('shoot', () => {
        const p = PLAYERS[socket.id];
        if (!p?.alive || (p.ammo <= 0 && p.weapon!== 'Fist')) return;
        if (p.weapon!== 'Fist') p.ammo--;

        const stats = {AK:{d:25,s:18},Shotgun:{d:15,s:12,p:5},Sniper:{d:80,s:25},SMG:{d:12,s:20},Pistol:{d:20,s:15},Fist:{d:10,s:10}}[p.weapon];
        const pellets = stats.p || 1;
        for(let i=0;i<pellets;i++){
            BULLETS.push({x:p.x,y:p.y,angle:p.angle,speedX:Math.cos(p.angle)*stats.s,speedY:Math.sin(p.angle)*stats.s,owner:socket.id,damage:stats.d,weapon:p.weapon});
        }
    });

    socket.on('throwGrenade', () => {
        const p = PLAYERS[socket.id];
        if (!p?.alive || p.grenades <= 0) return;
        p.grenades--;
        GRENADES.push({x:p.x,y:p.y,angle:p.angle,speedX:Math.cos(p.angle)*10,speedY:Math.sin(p.angle)*10,owner:socket.id,timer:180});
    });

    socket.on('enterVehicle', (vehicleId) => {
        const p = PLAYERS[socket.id];
        const v = VEHICLES.find(v => v.id === vehicleId);
        if (!p?.alive ||!v || v.driver) return;
        if (Math.hypot(p.x - v.x, p.y - v.y) < 50) {
            v.driver = socket.id;
            p.inVehicle = vehicleId;
        }
    });

    socket.on('exitVehicle', () => {
        const p = PLAYERS[socket.id];
        if (p.inVehicle) {
            const v = VEHICLES.find(v => v.id === p.inVehicle);
            if (v) v.driver = null;
            p.inVehicle = null;
        }
    });

    socket.on('pickup', (lootId) => {
        const p = PLAYERS[socket.id];
        const item = LOOT.find(l => l.id === lootId);
        if (!p?.alive ||!item || Math.hypot(p.x - item.x, p.y - item.y) > 50) return;

        if (item.type === 'Medkit') p.hp = Math.min(100, p.hp + 50);
        else if (item.type === 'Armor') p.armor = 100;
        else if (item.type === 'Scope') p.hasScope = true;
        else if (item.type === 'Grenade') p.grenades++;
        else { p.weapon = item.type; p.ammo = {Sniper:10,Shotgun:8,AK:30,SMG:40,Pistol:15}[item.type]||30; }

        LOOT.splice(LOOT.indexOf(item), 1);
        io.emit('lootTaken', lootId);
    });

    socket.on('disconnect', () => {
        if (PLAYERS[socket.id]?.team) {
            const team = TEAMS[PLAYERS[socket.id].team];
            if (team) TEAMS[PLAYERS[socket.id].team] = team.filter(id => id!== socket.id);
        }
        delete PLAYERS[socket.id];
    });
});

// GAME LOOP
setInterval(() => {
    // Grenades
    for(let i=GRENADES.length-1;i>=0;i--){
        const g = GRENADES[i];
        g.x += g.speedX; g.y += g.speedY; g.speedX *= 0.98; g.speedY *= 0.98; g.timer--;
        if(g.timer<=0){
            for(let id in PLAYERS){
                if(!PLAYERS[id].alive) continue;
                const dist = Math.hypot(g.x-PLAYERS[id].x, g.y-PLAYERS[id].y);
                if(dist<80){
                    const dmg = 100 - dist;
                    PLAYERS[id].hp -= dmg;
                    if(PLAYERS[id].hp<=0){PLAYERS[id].alive=false;if(PLAYERS[g.owner])PLAYERS[g.owner].kills++;}
                }
            }
            io.emit('explosion', {x:g.x,y:g.y});
            GRENADES.splice(i,1);
        }
    }

    // Bullets
    for (let i = BULLETS.length - 1; i >= 0; i--) {
        const b = BULLETS[i];
        b.x += b.speedX; b.y += b.speedY;
        if (checkCollision(b.x, b.y, 3)) { BULLETS.splice(i, 1); continue; }

        for (let id in PLAYERS) {
            const p = PLAYERS[id];
            if (!p.alive || id === b.owner) continue;
            if (Math.hypot(b.x - p.x, b.y - p.y) < 20) {
                // Team damage OFF
                if (p.team && PLAYERS[b.owner]?.team === p.team) continue;

                let dmg = b.damage;
                if (p.armor > 0) { p.armor -= dmg; if(p.armor<0){p.hp+=p.armor;p.armor=0;} } else p.hp -= dmg;

                if (p.hp <= 0) {
                    p.alive = false;
                    if (PLAYERS[b.owner]) {
                        PLAYERS[b.owner].kills++;
                        PLAYERS[b.owner].totalKills++;
                        PLAYERS[b.owner].xp += 50;
                        if(PLAYERS[b.owner].xp>=100){PLAYERS[b.owner].level++;PLAYERS[b.owner].xp=0;}
                    }
                    const aliveCount = Object.values(PLAYERS).filter(pl=>pl.alive).length;
                    io.emit('killFeed', {killer:b.owner,victim:id,weapon:b.weapon,playersAlive:aliveCount});
                    if(aliveCount===1){const w=Object.values(PLAYERS).find(pl=>pl.alive);w.wins++;w.xp+=200;io.emit('gameEnd',{winner:w.id});}
                    updateLeaderboard();
                }
                BULLETS.splice(i, 1); break;
            }
        }
        if (b.x<0||b.x>MAP_SIZE||b.y<0||b.y>MAP_SIZE) BULLETS.splice(i,1);
    }

    // Zone damage
    for (let id in PLAYERS) {
        const p = PLAYERS[id];
        if (!p.alive) continue;
        if (Math.hypot(p.x-ZONE.x,p.y-ZONE.y)>ZONE.radius) {
            p.hp -= 0.8;
            if(p.hp<=0)p.alive=false;
        }
    }

    io.emit('gameState', { players:PLAYERS, bullets:BULLETS, grenades:GRENADES, loot:LOOT, vehicles:VEHICLES });
}, 1000/60);

// API Leaderboard
app.get('/leaderboard', (req,res) => res.json(LEADERBOARD));

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => console.log(`MG Fighter Ultimate @ ${PORT}`));
