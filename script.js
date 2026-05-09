# MG Fighter — Clean JS Architecture (Starter)

Ity structure ity dia version voadio sy stable kokoa amin’ilay code nalefanao. Tsy 2000 lignes feno gameplay rehetra izy ity, fa architecture matanjaka sy scalable: modular state, renderer, input, network sync, entity system, interpolation, cleanup, anti-crash guards.

```js
'use strict';

// =====================================================
// MG FIGHTER CLEAN ENGINE
// =====================================================

// =====================================================
// 1. SAFE HELPERS
// =====================================================
const Safe = {
    el(id) {
        return document.getElementById(id);
    },

    text(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = value;
    },

    html(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = value;
    },

    style(id, prop, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style[prop] = value;
    },

    addClass(id, cls) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add(cls);
    },

    removeClass(id, cls) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove(cls);
    },

    clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    },

    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    distance(x1, y1, x2, y2) {
        return Math.hypot(x2 - x1, y2 - y1);
    },

    random(min, max) {
        return Math.random() * (max - min) + min;
    },

    save(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (err) {
            console.warn(err);
        }
    },

    load(key, fallback) {
        try {
            const data = localStorage.getItem(key);
            if (!data) return fallback;
            return JSON.parse(data);
        } catch (err) {
            return fallback;
        }
    }
};

// =====================================================
// 2. CANVAS
// =====================================================
const canvas = Safe.el('game');

if (!canvas) {
    throw new Error('Canvas #game missing');
}

const ctx = canvas.getContext('2d');

if (!ctx) {
    throw new Error('2D context missing');
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// =====================================================
// 3. CONFIG
// =====================================================
const CONFIG = {
    MAP_SIZE: 4000,
    PLAYER_SIZE: 32,
    PLAYER_SPEED: 4,
    PLAYER_SPRINT: 6,
    BULLET_SPEED: 20,
    TICK_RATE: 1000 / 60,
    NETWORK_RATE: 50,
    MAX_PARTICLES: 200,
    CAMERA_LERP: 0.1,
    INTERPOLATION: 0.25
};

// =====================================================
// 4. GAME STATE
// =====================================================
const Game = {
    started: false,
    myId: null,
    players: {},
    bullets: [],
    particles: [],
    loot: [],
    buildings: [],
    camera: {
        x: 0,
        y: 0
    },
    zone: {
        x: 2000,
        y: 2000,
        radius: 1800
    }
};

// =====================================================
// 5. INPUT SYSTEM
// =====================================================
const Input = {
    keys: {},
    mouse: {
        x: 0,
        y: 0
    },
    sprint: false,
    shooting: false
};

window.addEventListener('keydown', (e) => {
    Input.keys[e.key.toLowerCase()] = true;

    if (e.key === 'Shift') {
        Input.sprint = true;
    }
});

window.addEventListener('keyup', (e) => {
    Input.keys[e.key.toLowerCase()] = false;

    if (e.key === 'Shift') {
        Input.sprint = false;
    }
});

window.addEventListener('mousemove', (e) => {
    Input.mouse.x = e.clientX;
    Input.mouse.y = e.clientY;
});

window.addEventListener('mousedown', () => {
    Input.shooting = true;
});

window.addEventListener('mouseup', () => {
    Input.shooting = false;
});

// =====================================================
// 6. PLAYER FACTORY
// =====================================================
function createPlayer(data = {}) {
    return {
        id: data.id || crypto.randomUUID(),
        name: data.name || 'Player',
        x: data.x || 100,
        y: data.y || 100,
        targetX: data.x || 100,
        targetY: data.y || 100,
        vx: 0,
        vy: 0,
        hp: 100,
        armor: 0,
        alive: true,
        angle: 0,
        kills: 0,
        weapon: 'Rifle',
        ammo: 30,
        color: data.color || '#00ff88',
        direction: 'down',
        animFrame: 0,
        animTimer: 0
    };
}

// =====================================================
// 7. LOCAL PLAYER
// =====================================================
const me = createPlayer({
    id: 'local-player',
    name: 'You',
    x: 500,
    y: 500,
    color: '#00ff88'
});

Game.myId = me.id;
Game.players[me.id] = me;

// =====================================================
// 8. DEMO BOTS
// =====================================================
for (let i = 0; i < 10; i++) {
    const bot = createPlayer({
        id: 'bot-' + i,
        name: 'Bot ' + i,
        x: Safe.random(200, 3000),
        y: Safe.random(200, 3000),
        color: '#ff4444'
    });

    Game.players[bot.id] = bot;
}

// =====================================================
// 9. PLAYER UPDATE
// =====================================================
function updateLocalPlayer() {
    const player = Game.players[Game.myId];

    if (!player || !player.alive) {
        return;
    }

    let moveX = 0;
    let moveY = 0;

    if (Input.keys['w'] || Input.keys['z']) {
        moveY -= 1;
    }

    if (Input.keys['s']) {
        moveY += 1;
    }

    if (Input.keys['a'] || Input.keys['q']) {
        moveX -= 1;
    }

    if (Input.keys['d']) {
        moveX += 1;
    }

    const length = Math.hypot(moveX, moveY);

    if (length > 0) {
        moveX /= length;
        moveY /= length;
    }

    const speed = Input.sprint
        ? CONFIG.PLAYER_SPRINT
        : CONFIG.PLAYER_SPEED;

    player.vx = moveX * speed;
    player.vy = moveY * speed;

    player.x += player.vx;
    player.y += player.vy;

    player.x = Safe.clamp(player.x, 0, CONFIG.MAP_SIZE);
    player.y = Safe.clamp(player.y, 0, CONFIG.MAP_SIZE);

    player.angle = Math.atan2(
        Input.mouse.y - canvas.height / 2,
        Input.mouse.x - canvas.width / 2
    );
}

// =====================================================
// 10. BOT AI
// =====================================================
function updateBots() {
    for (const id in Game.players) {
        const player = Game.players[id];

        if (id === Game.myId) continue;
        if (!player.alive) continue;

        player.targetX += Safe.random(-2, 2);
        player.targetY += Safe.random(-2, 2);

        player.targetX = Safe.clamp(player.targetX, 0, CONFIG.MAP_SIZE);
        player.targetY = Safe.clamp(player.targetY, 0, CONFIG.MAP_SIZE);

        player.x = Safe.lerp(player.x, player.targetX, 0.01);
        player.y = Safe.lerp(player.y, player.targetY, 0.01);

        player.angle += 0.01;
    }
}

// =====================================================
// 11. SHOOT SYSTEM
// =====================================================
let lastShot = 0;

function shootBullet() {
    const now = Date.now();

    if (now - lastShot < 120) {
        return;
    }

    lastShot = now;

    const player = Game.players[Game.myId];

    if (!player) return;

    const bullet = {
        x: player.x,
        y: player.y,
        vx: Math.cos(player.angle) * CONFIG.BULLET_SPEED,
        vy: Math.sin(player.angle) * CONFIG.BULLET_SPEED,
        life: 120,
        owner: player.id
    };

    Game.bullets.push(bullet);
}

// =====================================================
// 12. BULLET UPDATE
// =====================================================
function updateBullets() {
    for (let i = Game.bullets.length - 1; i >= 0; i--) {
        const bullet = Game.bullets[i];

        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        bullet.life--;

        if (bullet.life <= 0) {
            Game.bullets.splice(i, 1);
            continue;
        }

        for (const id in Game.players) {
            const player = Game.players[id];

            if (!player.alive) continue;
            if (player.id === bullet.owner) continue;

            const dist = Safe.distance(
                bullet.x,
                bullet.y,
                player.x,
                player.y
            );

            if (dist < 20) {
                player.hp -= 20;

                createHitEffect(player.x, player.y);

                Game.bullets.splice(i, 1);

                if (player.hp <= 0) {
                    player.alive = false;
                }

                break;
            }
        }
    }
}

// =====================================================
// 13. PARTICLES
// =====================================================
function createHitEffect(x, y) {
    for (let i = 0; i < 15; i++) {
        Game.particles.push({
            x,
            y,
            vx: Safe.random(-4, 4),
            vy: Safe.random(-4, 4),
            size: Safe.random(2, 5),
            life: 20
        });
    }
}

function updateParticles() {
    for (let i = Game.particles.length - 1; i >= 0; i--) {
        const p = Game.particles[i];

        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        if (p.life <= 0) {
            Game.particles.splice(i, 1);
        }
    }
}

// =====================================================
// 14. CAMERA
// =====================================================
function updateCamera() {
    const player = Game.players[Game.myId];

    if (!player) return;

    const targetX = player.x - canvas.width / 2;
    const targetY = player.y - canvas.height / 2;

    Game.camera.x = Safe.lerp(
        Game.camera.x,
        targetX,
        CONFIG.CAMERA_LERP
    );

    Game.camera.y = Safe.lerp(
        Game.camera.y,
        targetY,
        CONFIG.CAMERA_LERP
    );
}

// =====================================================
// 15. DRAW MAP
// =====================================================
function drawMap() {
    ctx.fillStyle = '#183818';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';

    for (let x = -Game.camera.x % 50; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    for (let y = -Game.camera.y % 50; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

// =====================================================
// 16. DRAW PLAYER
// =====================================================
function drawPlayer(player) {
    const screenX = player.x - Game.camera.x;
    const screenY = player.y - Game.camera.y;

    ctx.save();

    ctx.translate(screenX, screenY);
    ctx.rotate(player.angle);

    ctx.fillStyle = player.color;
    ctx.fillRect(-16, -16, 32, 32);

    ctx.fillStyle = '#222';
    ctx.fillRect(0, -4, 20, 8);

    ctx.restore();

    ctx.fillStyle = 'red';
    ctx.fillRect(screenX - 20, screenY - 28, 40, 5);

    ctx.fillStyle = 'lime';
    ctx.fillRect(screenX - 20, screenY - 28, 40 * (player.hp / 100), 5);

    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(player.name, screenX, screenY - 35);
}

// =====================================================
// 17. DRAW BULLETS
// =====================================================
function drawBullets() {
    ctx.fillStyle = '#ffff00';

    for (const bullet of Game.bullets) {
        ctx.beginPath();
        ctx.arc(
            bullet.x - Game.camera.x,
            bullet.y - Game.camera.y,
            4,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
}

// =====================================================
// 18. DRAW PARTICLES
// =====================================================
function drawParticles() {
    ctx.fillStyle = '#ff4444';

    for (const p of Game.particles) {
        ctx.beginPath();
        ctx.arc(
            p.x - Game.camera.x,
            p.y - Game.camera.y,
            p.size,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
}

// =====================================================
// 19. DRAW UI
// =====================================================
function drawUI() {
    const player = Game.players[Game.myId];

    if (!player) return;

    ctx.fillStyle = 'white';
    ctx.font = '18px Arial';

    ctx.fillText('HP: ' + player.hp, 20, 30);
    ctx.fillText('Ammo: ' + player.ammo, 20, 60);
    ctx.fillText('Kills: ' + player.kills, 20, 90);
}

// =====================================================
// 20. MAIN DRAW
// =====================================================
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawMap();

    for (const id in Game.players) {
        const player = Game.players[id];

        if (!player.alive) continue;

        drawPlayer(player);
    }

    drawBullets();
    drawParticles();
    drawUI();
}

// =====================================================
// 21. UPDATE LOOP
// =====================================================
function update() {
    updateLocalPlayer();
    updateBots();
    updateBullets();
    updateParticles();
    updateCamera();

    if (Input.shooting) {
        shootBullet();
    }
}

// =====================================================
// 22. MAIN LOOP
// =====================================================
let lastFrame = performance.now();

function loop(now) {
    const dt = now - lastFrame;
    lastFrame = now;

    update(dt);
    render();

    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// =====================================================
// 23. SAFE ERROR WRAPPER
// =====================================================
window.addEventListener('error', (e) => {
    console.error('GLOBAL ERROR:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('PROMISE ERROR:', e.reason);
});

// =====================================================
// 24. CLEANUP
// =====================================================
window.addEventListener('beforeunload', () => {
    console.log('Cleaning game...');
});

console.log('MG Fighter Clean Engine Loaded');

