
// SOLOY ITY AMIN'NY LINK RENDER-NAO REHEFA VITA NY DEPLOY
const socket = io('https://mg-fighter.onrender.com');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const miniCtx = minimap.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let myId = null;
let players = {};
let bullets = [];
let loot = [];
let zone = { x: 1000, y: 1000, radius: 2000 };
let camera = { x: 0, y: 0 };
let keys = {};

socket.on('init', (data) => {
    myId = data.id;
    players = data.players;
    loot = data.loot;
    zone = data.zone;
});

socket.on('gameState', (data) => {
    players = data.players;
    bullets = data.bullets;
    loot = data.loot;
});

socket.on('zoneUpdate', (newZone) => zone = newZone);

socket.on('lootTaken', (lootId) => {
    loot = loot.filter(l => l.id!== lootId);
});

socket.on('killFeed', (data) => {
    const feed = document.getElementById('killFeed');
    const kill = document.createElement('div');
    kill.className = 'kill';
    kill.textContent = data.killer === 'ZONE'?
        `${data.victim.substring(0,6)} maty @ zone` :
        `${data.killer.substring(0,6)} namono ${data.victim.substring(0,6)}`;
    feed.prepend(kill);
    setTimeout(() => kill.remove(), 5000);
    document.getElementById('alive').textContent = data.playersAlive;
});

window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
window.addEventListener('mousemove', e => {
    if (!players[myId]) return;
    const me = players[myId];
    me.angle = Math.atan2(e.clientY - canvas.height/2, e.clientX - canvas.width/2);
});
window.addEventListener('mousedown', () => socket.emit('shoot'));
window.addEventListener('keypress', e => {
    if (e.key.toLowerCase() === 'e') {
        const me = players[myId];
        let closest = null, minDist = 50;
        loot.forEach(l => {
            const dist = Math.hypot(me.x - l.x, me.y - l.y);
            if (dist < minDist) { minDist = dist; closest = l; }
        });
        if (closest) socket.emit('pickup', closest.id);
    }
});

function update() {
    if (!players[myId]?.alive) return;
    const me = players[myId];
    const speed = 4;

    if (keys['w'] || keys['z']) me.y -= speed;
    if (keys['s']) me.y += speed;
    if (keys['a'] || keys['q']) me.x -= speed;
    if (keys['d']) me.x += speed;

    socket.emit('move', { x: me.x, y: me.y, angle: me.angle });
    camera.x = me.x - canvas.width / 2;
    camera.y = me.y - canvas.height / 2;
}

function draw() {
    ctx.fillStyle = '#1a4a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(zone.x - camera.x, zone.y - camera.y, zone.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,100,255,0.1)';
    ctx.fill();

    loot.forEach(l => {
        ctx.fillStyle = l.type === 'Medkit'? '#00ff00' : l.type === 'Armor'? '#0088ff' : '#ffaa00';
        ctx.fillRect(l.x - camera.x - 10, l.y - camera.y - 10, 20, 20);
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.fillText(l.type, l.x - camera.x - 15, l.y - camera.y - 15);
    });

    ctx.fillStyle = 'yellow';
    bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x - camera.x, b.y - camera.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    for (let id in players) {
        const p = players[id];
        if (!p.alive) continue;

        ctx.save();
        ctx.translate(p.x - camera.x, p.y - camera.y);
        ctx.rotate(p.angle);

        ctx.fillStyle = id === myId? '#00ff00' : '#ff0000';
        ctx.fillRect(-15, -15, 30, 30);
        ctx.fillStyle = '#666';
        ctx.fillRect(15, -3, 20, 6);

        ctx.restore();

        ctx.fillStyle = 'red';
        ctx.fillRect(p.x - camera.x - 20, p.y - camera.y - 30, 40, 4);
        ctx.fillStyle = 'lime';
        ctx.fillRect(p.x - camera.x - 20, p.y - camera.y - 30, 40 * (p.hp/100), 4);
    }

    if (players[myId]) {
        const me = players[myId];
        document.getElementById('hp').textContent = Math.floor(me.hp);
        document.getElementById('armor').textContent = Math.floor(me.armor);
        document.getElementById('weapon').textContent = me.weapon;
        document.getElementById('ammo').textContent = me.ammo;
        document.getElementById('kills').textContent = me.kills;

        if (!me.alive) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'red';
            ctx.font = '60px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('YOU DIED', canvas.width/2, canvas.height/2);
        }
    }

    miniCtx.fillStyle = '#1a4a1a';
    miniCtx.fillRect(0, 0, 150, 150);
    miniCtx.strokeStyle = '#0066ff';
    miniCtx.beginPath();
    miniCtx.arc(zone.x/2000*150, zone.y/2000*150, zone.radius/2000*150, 0, Math.PI*2);
    miniCtx.stroke();
    for (let id in players) {
        if (!players[id].alive) continue;
        miniCtx.fillStyle = id === myId? 'lime' : 'red';
        miniCtx.fillRect(players[id].x/2000*150-2, players[id].y/2000*150-2, 4, 4);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}
gameLoop();

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
