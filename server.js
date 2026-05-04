// OVAY ITY AMIN'NY LINK RENDER-NAO
const socket = io('https://mg-fighter-xxx.onrender.com');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const miniCtx = minimap.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let myId = null;
let players = {};
let bullets = [];
let grenades = [];
let loot = [];
let buildings = [];
let bushes = [];
let vehicles = [];
let zone = { x: 1500, y: 1500, radius: 3000 };
let camera = { x: 0, y: 0 };
let keys = {};
let isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
let joystickActive = false;
let joystickData = { x: 0, y: 0 };
let isSprinting = false;
let isZooming = false;
let myTeam = null;
let leaderboard = [];

// LOAD SAVED DATA
let currentSkin = JSON.parse(localStorage.getItem('mgSkin')) || {color:'#00ff00', hat:'none'};
let battlePass = JSON.parse(localStorage.getItem('mgBattlePass')) || {level:1, xp:0};
let playerName = localStorage.getItem('mgName') || `Player${Math.floor(Math.random()*9999)}`;

// SHOW MOBILE CONTROLS
if (isMobile) {
    document.getElementById('mobileControls').classList.remove('hidden');
}

// SOCKET EVENTS
socket.on('connect', () => {
    socket.emit('setName', playerName);
    socket.emit('setSkin', currentSkin);
});

socket.on('init', (data) => {
    myId = data.id;
    players = data.players;
    loot = data.loot;
    buildings = data.buildings;
    bushes = data.bushes;
    vehicles = data.vehicles;
    zone = data.zone;
    leaderboard = data.leaderboard;
    updateLeaderboard();
});

socket.on('gameState', (data) => {
    players = data.players;
    bullets = data.bullets;
    grenades = data.grenades;
    loot = data.loot;
    vehicles = data.vehicles;
});

socket.on('zoneUpdate', (data) => {
    zone = data.zone;
    document.getElementById('zoneTimer').textContent = `ZONE: ${data.timer}s`;
});

socket.on('lootTaken', (lootId) => {
    loot = loot.filter(l => l.id!== lootId);
});

socket.on('explosion', (data) => {
    createExplosion(data.x, data.y);
    if (navigator.vibrate) navigator.vibrate(100);
});

socket.on('killFeed', (data) => {
    const feed = document.getElementById('killFeed');
    const kill = document.createElement('div');
    kill.className = 'kill';
    kill.textContent = data.killer === 'ZONE'?
        `${data.victim.substring(0,6)} ZONE` :
        `${data.killer.substring(0,6)} → ${data.victim.substring(0,6)} [${data.weapon}]`;
    feed.prepend(kill);
    setTimeout(() => kill.remove(), 5000);
    document.getElementById('alive').textContent = `ALIVE: ${data.playersAlive}`;
});

socket.on('gameEnd', (data) => {
    if (data.winner === myId) {
        document.getElementById('victoryScreen').classList.remove('hidden');
        document.getElementById('totalPlayers').textContent = Object.keys(players).length;
    }
});

socket.on('hit', (data) => {
    showDamage(data.damage, data.x, data.y, '#ff0000');
    if (navigator.vibrate) navigator.vibrate(50);
});

socket.on('hitmarker', (data) => {
    showDamage(data.damage, data.x, data.y, '#ffff00');
});

socket.on('teamCreated', (data) => {
    myTeam = data.code;
    document.getElementById('teamCodeDisplay').textContent = `TEAM: ${data.code}`;
});

socket.on('teamJoined', (data) => {
    myTeam = data.code;
    document.getElementById('teamCodeDisplay').textContent = `TEAM: ${data.code} (${data.members}/4)`;
});

socket.on('teamUpdate', (members) => {
    console.log('Team:', members);
});

socket.on('leaderboardUpdate', (data) => {
    leaderboard = data;
    updateLeaderboard();
});

// DAMAGE NUMBERS
function showDamage(dmg, x, y, color) {
    const dmgDiv = document.createElement('div');
    dmgDiv.className = 'damage';
    dmgDiv.textContent = Math.floor(dmg);
    dmgDiv.style.color = color;
    dmgDiv.style.left = (x - camera.x) + 'px';
    dmgDiv.style.top = (y - camera.y) + 'px';
    document.getElementById('damageNumbers').appendChild(dmgDiv);
    setTimeout(() => dmgDiv.remove(), 1000);
}

// EXPLOSION EFFECT
function createExplosion(x, y) {
    const particles = [];
    for(let i=0;i<20;i++){
        particles.push({
            x: x - camera.x,
            y: y - camera.y,
            vx: (Math.random()-0.5)*10,
            vy: (Math.random()-0.5)*10,
            life: 30
        });
    }
    function animExplosion(){
        particles.forEach(p=>{
            ctx.fillStyle=`rgba(255,${100+p.life*5},0,${p.life/30})`;
            ctx.beginPath();
            ctx.arc(p.x,p.y,p.life/2,0,Math.PI*2);
            ctx.fill();
            p.x+=p.vx; p.y+=p.vy; p.life--;
        });
        if(particles.some(p=>p.life>0)) requestAnimationFrame(animExplosion);
    }
    animExplosion();
}

// SKIN SYSTEM
function changeSkin(color, hat='none') {
    currentSkin = {color, hat};
    localStorage.setItem('mgSkin', JSON.stringify(currentSkin));
    socket.emit('setSkin', currentSkin);
}

// TEAM SYSTEM
function createTeam() {
    socket.emit('createTeam', 'squad');
}
function joinTeam() {
    const code = document.getElementById('teamCode').value.toUpperCase();
    socket.emit('joinTeam', code);
}

// LEADERBOARD
function updateLeaderboard() {
    const list = document.getElementById('lbList');
    list.innerHTML = '';
    leaderboard.forEach((p, i) => {
        const li = document.createElement('li');
        li.textContent = `${i+1}. ${p.name} - ${p.kills} Kills`;
        list.appendChild(li);
    });
}

// BATTLE PASS
function updateBattlePass() {
    if (players[myId]) {
        battlePass.xp = players[myId].xp;
        battlePass.level = players[myId].level;
        localStorage.setItem('mgBattlePass', JSON.stringify(battlePass));
        document.getElementById('bpLevel').textContent = battlePass.level;
        document.getElementById('bpXP').style.width = (battlePass.xp) + '%';
    }
}

// PC CONTROLS
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Shift') isSprinting = true;
    if (e.key.toLowerCase() === 'e') pickupLoot();
    if (e.key.toLowerCase() === 'r') socket.emit('throwGrenade');
    if (e.key.toLowerCase() === 'f') toggleVehicle();
});
window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
    if (e.key === 'Shift') isSprinting = false;
});

window.addEventListener('mousemove', e => {
    if (!players[myId] || isMobile) return;
    const me = players[myId];
    me.angle = Math.atan2(e.clientY - canvas.height/2, e.clientX - canvas.width/2);
});

window.addEventListener('mousedown', e => {
    if (e.button === 0) socket.emit('shoot');
    if (e.button === 2) toggleScope(true);
});
window.addEventListener('mouseup', e => {
    if (e.button === 2) toggleScope(false);
});
window.addEventListener('contextmenu', e => e.preventDefault());

// MOBILE CONTROLS
if (isMobile) {
    const joystick = document.getElementById('joystick');
    const knob = document.getElementById('joystickKnob');

    joystick.addEventListener('touchstart', (e) => {
        joystickActive = true;
        handleJoystick(e.touches[0]);
    });

    joystick.addEventListener('touchmove', (e) => {
        if (joystickActive) handleJoystick(e.touches[0]);
    });

    joystick.addEventListener('touchend', () => {
        joystickActive = false;
        joystickData = { x: 0, y: 0 };
        knob.style.transform = 'translate(-50%, -50%)';
    });

    function handleJoystick(touch) {
        const rect = joystick.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let dx = touch.clientX - centerX;
        let dy = touch.clientY - centerY;
        const dist = Math.min(Math.hypot(dx, dy), 40);
        const angle = Math.atan2(dy, dx);
        dx = Math.cos(angle) * dist;
        dy = Math.sin(angle) * dist;
        joystickData = { x: dx / 40, y: dy / 40 };
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    document.getElementById('shootBtn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        socket.emit('shoot');
        if (navigator.vibrate) navigator.vibrate(30);
    });

    document.getElementById('scopeBtn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleScope(true);
    });
    document.getElementById('scopeBtn').addEventListener('touchend', (e) => {
        e.preventDefault();
        toggleScope(false);
    });

    document.getElementById('lootBtn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        pickupLoot();
    });

    document.getElementById('sprintBtn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        isSprinting = true;
    });
    document.getElementById('sprintBtn').addEventListener('touchend', (e) => {
        e.preventDefault();
        isSprinting = false;
    });

    document.getElementById('grenadeBtn')?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        socket.emit('throwGrenade');
    });

    document.getElementById('vehicleBtn')?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleVehicle();
    });
}

function toggleScope(state) {
    isZooming = state;
    document.getElementById('scope').classList.toggle('hidden',!state);
}

function pickupLoot() {
    const me = players[myId];
    if (!me) return;
    let closest = null, minDist = 60;
    loot.forEach(l => {
        const dist = Math.hypot(me.x - l.x, me.y - l.y);
        if (dist < minDist) { minDist = dist; closest = l; }
    });
    if (closest) socket.emit('pickup', closest.id);
}

function toggleVehicle() {
    const me = players[myId];
    if (!me) return;
    if (me.inVehicle) {
        socket.emit('exitVehicle');
    } else {
        const v = vehicles.find(v =>!v.driver && Math.hypot(me.x - v.x, me.y - v.y) < 50);
        if (v) socket.emit('enterVehicle', v.id);
    }
}

// GAME UPDATE
function update() {
    if (!players[myId]?.alive) return;
    const me = players[myId];
    let speed = isSprinting? 6 : 4;
    if (me.inVehicle) {
        const v = vehicles.find(v => v.id === me.inVehicle);
        if (v) speed = v.speed;
    }
    if (isZooming) speed *= 0.5;

    if (isMobile) {
        me.x += joystickData.x * speed;
        me.y += joystickData.y * speed;
        // Auto-aim
        let closestEnemy = null, minDist = 300;
        for (let id in players) {
            if (id === myId ||!players[id].alive) continue;
            if (myTeam && players[id].team === myTeam) continue; // No team aim
            const dist = Math.hypot(players[id].x - me.x, players[id].y - me.y);
            if (dist < minDist) { minDist = dist; closestEnemy = players[id]; }
        }
        if (closestEnemy) {
            me.angle = Math.atan2(closestEnemy.y - me.y, closestEnemy.x - me.x);
        }
    } else {
        if (keys['w'] || keys['z']) me.y -= speed;
        if (keys['s']) me.y += speed;
        if (keys['a'] || keys['q']) me.x -= speed;
        if (keys['d']) me.x += speed;
    }

    socket.emit('move', { x: me.x, y: me.y, angle: me.angle, zooming: isZooming, sprinting: isSprinting });
    camera.x = me.x - canvas.width / 2;
    camera.y = me.y - canvas.height / 2;

    me.inBush = bushes.some(b => Math.hypot(me.x - b.x, me.y - b.y) < b.radius);
    updateBattlePass();
}

// RENDER
function draw() {
    ctx.fillStyle = '#1a3a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Zone
    ctx.strokeStyle = '#0088ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(zone.x - camera.x, zone.y - camera.y, zone.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,100,255,0.05)';
    ctx.fill();

    // Bushes
    bushes.forEach(b => {
        ctx.fillStyle = 'rgba(0,80,0,0.6)';
        ctx.beginPath();
        ctx.arc(b.x - camera.x, b.y - camera.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    // Buildings
    ctx.fillStyle = '#444';
    buildings.forEach(b => {
        ctx.fillRect(b.x - camera.x, b.y - camera.y, b.w, b.h);
        ctx.strokeStyle = '#666';
        ctx.strokeRect(b.x - camera.x, b.y - camera.y, b.w, b.h);
    });

    // Vehicles
    vehicles.forEach(v => {
        ctx.save();
        ctx.translate(v.x - camera.x, v.y - camera.y);
        ctx.rotate(v.angle);
        ctx.fillStyle = v.driver? '#ff6600' : '#666';
        ctx.fillRect(-30, -15, 60, 30); // Moto
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(-20, 0, 8, 0, Math.PI * 2); // Wheel
        ctx.arc(20, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // Loot
    loot.forEach(l => {
        const colors = {Medkit:'#00ff00',Armor:'#0088ff',Scope:'#ff00ff',AK:'#ffaa00',Shotgun:'#ff6600',Sniper:'#aa00ff',SMG:'#00ffff',Pistol:'#ffff00',Grenade:'#ff0000'};
        ctx.fillStyle = colors[l.type] || '#ffffff';
        ctx.fillRect(l.x - camera.x - 12, l.y - camera.y - 12, 24, 24);
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(l.type, l.x - camera.x, l.y - camera.y - 18);
    });

    // Grenades
    ctx.fillStyle = '#ff0000';
    grenades.forEach(g => {
        ctx.beginPath();
        ctx.arc(g.x - camera.x, g.y - camera.y, 6, 0, Math.PI * 2);
        ctx.fill();
    });

    // Bullets
    ctx.fillStyle = 'yellow';
    bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x - camera.x, b.y - camera.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // Players
    for (let id in players) {
        const p = players[id];
        if (!p.alive) continue;
        if (p.inBush && id!== myId && (!myTeam || p.team!== myTeam)) continue; // Hide enemies in bush

        ctx.save();
        ctx.translate(p.x - camera.x, p.y - camera.y);
        ctx.rotate(p.angle);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-15, -15, 30, 30);

        // Body - SKIN COLOR
        ctx.fillStyle = p.skin.color;
        ctx.fillRect(-15, -15, 30, 30);

        // Hat
        if (p.skin.hat === 'crown') {
            ctx.fillStyle = 'gold';
            ctx.fillRect(-12, -25, 24, 10);
        }

        // Gun
        ctx.fillStyle = '#555';
        ctx.fillRect(15, -4, 25, 8);

        ctx.restore();

        // Name + Team
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        const teamTag = p.team? `[${p.team}] ` : '';
        ctx.fillText(teamTag + p.name, p.x - camera.x, p.y - camera.y - 50);

        // HP Bar
        ctx.fillStyle = 'red';
        ctx.fillRect(p.x - camera.x - 20, p.y - camera.y - 35, 40, 5);
        ctx.fillStyle = 'lime';
        ctx.fillRect(p.x - camera.x - 20, p.y - camera.y - 35, 40 * (p.hp/100), 5);

        // Armor Bar
        if (p.armor > 0) {
            ctx.fillStyle = '#0066ff';
            ctx.fillRect(p.x - camera.x - 20, p.y - camera.y - 42, 40 * (p.armor/100), 3);
        }
    }

    // UI Update
    if (players[myId]) {
        const me = players[myId];
        document.getElementById('hp').textContent = Math.floor(me.hp);
        document.getElementById('armor').textContent = Math.floor(me.armor);
        document.getElementById('hpBar').style.width = me.hp + '%';
        document.getElementById('armorBar').style.width = me.armor + '%';
        document.getElementById('weapon').textContent = me.weapon;
        document.getElementById('ammo').textContent = me.ammo + (me.grenades? ` | 💣${me.grenades}` : '');
        document.getElementById('kills').textContent = me.kills;

        if (!me.alive) {
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'red';
            ctx.font = 'bold 60px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('ELIMINATED', canvas.width/2, canvas.height/2);
            ctx.font = '20px Arial';
            ctx.fillText(`Rank #${Object.values(players).filter(p => p.alive).length + 1}`, canvas.width/2, canvas.height/2 + 50);
        }
    }

    // Minimap
    miniCtx.fillStyle = '#0a1a0a';
    miniCtx.fillRect(0, 0, 180, 180);

    miniCtx.strokeStyle = '#0088ff';
    miniCtx.lineWidth = 2;
    miniCtx.beginPath();
    miniCtx.arc(zone.x/3000*180, zone.y/3000*180, zone.radius/3000*180, 0, Math.PI*2);
    miniCtx.stroke();

    miniCtx.fillStyle = '#666';
    buildings.forEach(b => {
        miniCtx.fillRect(b.x/3000*180, b.y/3000*180, b.w/3000*180, b.h/3000*180);
    });

    for (let id in players) {
        if (!players[id].alive) continue;
        if (players[id].inBush && id!== myId && (!myTeam || players[id].team!== myTeam)) continue;
        miniCtx.fillStyle = id === myId? 'lime' : (myTeam && players[id].team === myTeam? 'cyan' : 'red');
        miniCtx.beginPath();
        miniCtx.arc(players[id].x/3000*180, players[id].y/3000*180, 3, 0, Math.PI*2);
        miniCtx.fill();
    }

    vehicles.forEach(v => {
        miniCtx.fillStyle = 'orange';
        miniCtx.fillRect(v.x/3000*180-2, v.y/3000*180-2, 4, 4);
    });
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

// INIT
updateBattlePass();
updateLeaderboard();
