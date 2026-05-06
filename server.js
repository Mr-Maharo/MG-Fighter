const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://mr-maharo.github.io",
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: "https://mr-maharo.github.io" }));
app.use(express.static('public'));

// --- MAP ---
let MAP_DATA = [];
try {
  MAP_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'map.json'), 'utf8'));
  console.log('✅ Map:', MAP_DATA.length, 'tiles');
} catch(e) {
  console.log('⚠️ map.json tsy hita');
}

class Game {
  constructor() {
    this.players = new Map();
    this.bullets = [];
    this.grenades = [];
    this.buildings = MAP_DATA.filter(t => t.collision).map(t => ({x:t.x, y:t.y, w:t.s, h:t.s}));
    this.water = MAP_DATA.filter(t => t.swimmable).map(t => ({x:t.x, y:t.y, w:t.s, h:t.s}));
  }
  addPlayer(id, data) {
    this.players.set(id, {
      id, x: 400 + Math.random()*200, y: 400 + Math.random()*200,
      hp: 100, name: data.name || 'Player', kills: 0, skin: data.skin || 'boy'
    });
  }
  removePlayer(id) { this.players.delete(id); }
  move(id, dir) {
    const p = this.players.get(id); if(!p) return;
    let nx = p.x, ny = p.y; const s = 5;
    if(dir.up) ny -= s; if(dir.down) ny += s; if(dir.left) nx -= s; if(dir.right) nx += s;
    // collision simple
    if(!this.buildings.some(b => nx < b.x+b.w && nx+30 > b.x && ny < b.y+b.h && ny+30 > b.y)) {
      p.x = nx; p.y = ny;
    }
  }
  shoot(id, angle) {
    const p = this.players.get(id); if(!p) return;
    this.bullets.push({ id: uuidv4(), x: p.x+15, y: p.y+15, vx: Math.cos(angle)*10, vy: Math.sin(angle)*10, owner: id });
  }
  update() {
    this.bullets = this.bullets.filter(b => {
      b.x += b.vx; b.y += b.vy;
      for(const [pid, pl] of this.players) {
        if(pid !== b.owner && Math.hypot(pl.x-b.x, pl.y-b.y) < 25) {
          pl.hp -= 25;
          if(pl.hp <= 0) {
            const killer = this.players.get(b.owner);
            if(killer) killer.kills++;
            pl.hp = 100; pl.x = 400; pl.y = 400;
          }
          return false;
        }
      }
      return b.x>0 && b.x<2000 && b.y>0 && b.y<2000;
    });
  }
  state() {
    return {
      players: Array.from(this.players.values()),
      bullets: this.bullets,
      buildings: this.buildings,
      water: this.water
    };
  }
}

const game = new Game();

io.on('connection', socket => {
  socket.on('joinGame', data => {
    game.addPlayer(socket.id, data);
  });
  socket.on('move', dir => game.move(socket.id, dir));
  socket.on('shoot', a => game.shoot(socket.id, a));
  socket.on('disconnect', () => game.removePlayer(socket.id));
});

setInterval(() => {
  game.update();
  io.emit('gameState', game.state());
}, 1000/30);

app.get('/', (req,res) => res.send('MG Fighter Running'));

server.listen(process.env.PORT || 3000, () => console.log('🚀 MG Fighter Ready'));
