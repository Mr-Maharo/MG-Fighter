const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
});

const serviceAccount = require('./firebase-key.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const PORT = process.env.PORT || 3000;

let lobbies = new Map();
let mpilalao = new Map();
let matchmaking = new Map();
let lalaoMavitrika = new Map();

const CONFIG = {
    maxMpilalaoLobby: 100,
    countdownLobby: 60,
    faritraVoalohany: 5000,
    faritraFarany: 500,
    fotoanaFaritra: 300000
};

io.on('connection', (socket) => {
    console.log('Mpilalao niditra:', socket.id);

    mpilalao.set(socket.id, {
        id: socket.id,
        uid: null,
        anarana: 'Vahiny',
        level: 1,
        mifandray: true,
        lobby: null,
        lalao: null,
        fotoana: Date.now()
    });

    socket.on('authenticate', async (data) => {
        const p = mpilalao.get(socket.id);
        if (p) {
            p.uid = data.uid;
            p.anarana = data.username;
            p.level = data.level;
            mpilalao.set(socket.id, p);
        }
    });

    socket.on('mamoronaLobby', (data) => {
        const id = mamoronaId();
        const lobby = {
            id: id,
            tompony: socket.id,
            mpilalao: [],
            mode: data.mode || 'battle_royale',
            max: CONFIG.maxMpilalaoLobby,
            countdown: CONFIG.countdownLobby,
            mandeha: false,
            noforonina: Date.now()
        };

        const p = mpilalao.get(socket.id);
        const mpilalaoLobby = {
            id: socket.id,
            uid: p.uid,
            anarana: data.mpilalao.anarana,
            level: data.mpilalao.level,
            hoditra: data.mpilalao.hoditra,
            tompony: true,
            vonona: false
        };

        lobby.mpilalao.push(mpilalaoLobby);
        lobbies.set(id, lobby);

        p.lobby = id;
        mpilalao.set(socket.id, p);

        socket.join(id);
        socket.emit('lobbyNoforonina', {
            id: id,
            mpilalao: lobby.mpilalao,
            mode: lobby.mode
        });

        manombokaCountdownLobby(id);
    });

    socket.on('miditraLobby', (data) => {
        const lobby = lobbies.get(data.id);
        if (!lobby) {
            socket.emit('hadisoana', {hafatra: 'Lobby tsy hita'});
            return;
        }

        if (lobby.mpilalao.length >= lobby.max) {
            socket.emit('hadisoana', {hafatra: 'Feno'});
            return;
        }

        const p = mpilalao.get(socket.id);
        const mpilalaoLobby = {
            id: socket.id,
            uid: p.uid,
            anarana: data.mpilalao.anarana,
            level: data.mpilalao.level,
            hoditra: data.mpilalao.hoditra,
            tompony: false,
            vonona: false
        };

        lobby.mpilalao.push(mpilalaoLobby);
        lobbies.set(data.id, lobby);

        p.lobby = data.id;
        mpilalao.set(socket.id, p);

        socket.join(data.id);
        socket.emit('lobbyNiditra', {
            id: data.id,
            mpilalao: lobby.mpilalao,
            mode: lobby.mode,
            tompony: false,
            countdownMandeha: lobby.mandeha,
            countdown: lobby.countdown
        });

        socket.to(data.id).emit('mpilalaoNiditra', {
            mpilalao: mpilalaoLobby
        });
    });

    socket.on('mialaLobby', (data) => {
        mialaLobby(socket);
    });

    socket.on('manovaVonona', (data) => {
        const lobby = lobbies.get(data.id);
        if (!lobby) return;

        const mp = lobby.mpilalao.find(m => m.id === socket.id);
        if (mp) {
            mp.vonona = data.vonona;
            io.to(data.id).emit('vononaNohavaozina', {
                uid: mp.uid,
                vonona: data.vonona
            });
        }
    });

    socket.on('alefaChat', (data) => {
        const p = mpilalao.get(socket.id);
        io.to(data.id).emit('chatLobby', {
            uid: p.uid,
            anarana: p.anarana,
            hafatra: data.hafatra.substring(0, 200),
            fotoana: Date.now()
        });
    });

    socket.on('manombokaMatch', (data) => {
        const lobby = lobbies.get(data.id);
        if (!lobby || lobby.tompony!== socket.id) return;

        manombokaLalao(lobby);
    });

    socket.on('mitadyMatch', (data) => {
        const fangatahana = {
            socketId: socket.id,
            mode: data.mode,
            mpilalao: data.mpilalao,
            fotoana: Date.now()
        };

        matchmaking.set(socket.id, fangatahana);
        socket.emit('matchmakingStarted', {});

        mitadyMpifanandrina(data.mode);
    });

    socket.on('ajanonaMitady', () => {
        matchmaking.delete(socket.id);
    });

    socket.on('manaikyMatch', (data) => {
        const lalao = lalaoMavitrika.get(data.id);
        if (lalao) {
            lalao.nanaiky.add(socket.id);
            if (lalao.nanaiky.size === lalao.mpilalao.length) {
                manombokaLalaoAvyMatchmaking(lalao);
            }
        }
    });

    socket.on('hetsika', (data) => {
        const p = mpilalao.get(socket.id);
        if (!p ||!p.lalao) return;

        const lalao = lalaoMavitrika.get(p.lalao);
        if (!lalao) return;

        const mp = lalao.state.mpilalao.find(m => m.id === socket.id);
        if (mp) {
            mp.hetsika = data;
        }
    });

    socket.on('tifitra', (data) => {
        const p = mpilalao.get(socket.id);
        if (!p ||!p.lalao) return;

        const lalao = lalaoMavitrika.get(p.lalao);
        if (!lalao) return;

        const mp = lalao.state.mpilalao.find(m => m.id === socket.id);
        if (mp && mp.bala > 0) {
            mp.bala--;
            mp.mitifitra = true;
            mp.zoro = data.zoro;

            const bala = {
                id: mamoronaId(),
                x: mp.x,
                y: mp.y,
                zoro: data.zoro,
                tompony: socket.id,
                fahasimbana: 25
            };

            lalao.state.bala.push(bala);
            io.to(p.lalao).emit('vibration', {laharana: [30]});
        }
    });

    socket.on('ajanonaTifitra', () => {
        const p = mpilalao.get(socket.id);
        if (!p ||!p.lalao) return;

        const lalao = lalaoMavitrika.get(p.lalao);
        if (!lalao) return;

        const mp = lalao.state.mpilalao.find(m => m.id === socket.id);
        if (mp) mp.mitifitra = false;
    });

    socket.on('reload', () => {
        const p = mpilalao.get(socket.id);
        if (!p ||!p.lalao) return;

        const lalao = lalaoMavitrika.get(p.lalao);
        if (!lalao) return;

        const mp = lalao.state.mpilalao.find(m => m.id === socket.id);
        if (mp) {
            setTimeout(() => {
                mp.bala = mp.balaMax || 30;
                socket.emit('balaLany', {});
            }, 2000);
        }
    });

    socket.on('manodina', (data) => {
        const p = mpilalao.get(socket.id);
        if (!p ||!p.lalao) return;

        const lalao = lalaoMavitrika.get(p.lalao);
        if (!lalao) return;

        const mp = lalao.state.mpilalao.find(m => m.id === socket.id);
        if (mp) mp.zoro = data.zoro;
    });

    socket.on('makaShop', async () => {
        const shop = await makaShopAvyFirebase();
        socket.emit('shopValiny', shop);
    });

    socket.on('mividyZavatra', async (data) => {
        const p = mpilalao.get(socket.id);
        if (!p ||!p.uid) return;

        const valiny = await mividyZavatra(p.uid, data.id);
        socket.emit('fividiananaValiny', valiny);
    });

    socket.on('makaStatistika', async () => {
        const p = mpilalao.get(socket.id);
        if (!p ||!p.uid) return;

        const statistika = await makaStatistikaAvyFirebase(p.uid);
        socket.emit('statistikaValiny', statistika);
    });

    socket.on('disconnect', () => {
        console.log('Mpilalao niala:', socket.id);
        mialaLobby(socket);
        matchmaking.delete(socket.id);
        mpilalao.delete(socket.id);
    });

    socket.emit('mifandray', {id: socket.id});
});

function mialaLobby(socket) {
    const p = mpilalao.get(socket.id);
    if (!p ||!p.lobby) return;

    const lobby = lobbies.get(p.lobby);
    if (!lobby) return;

    lobby.mpilalao = lobby.mpilalao.filter(m => m.id!== socket.id);

    socket.leave(p.lobby);
    socket.to(p.lobby).emit('mpilalaoNiala', {uid: p.uid});

    if (lobby.mpilalao.length === 0) {
        lobbies.delete(p.lobby);
    } else if (lobby.tompony === socket.id) {
        lobby.tompony = lobby.mpilalao[0].id;
        lobby.mpilalao[0].tompony = true;
        io.to(p.lobby).emit('tomponyNiova', {
            uidVaovao: lobby.mpilalao[0].uid,
            anarana: lobby.mpilalao[0].anarana
        });
    }

    p.lobby = null;
    mpilalao.set(socket.id, p);
}

function manombokaCountdownLobby(id) {
    const lobby = lobbies.get(id);
    if (!lobby) return;

    lobby.mandeha = true;
    let fotoana = lobby.countdown;

    const interval = setInterval(() => {
        fotoana--;
        lobby.countdown = fotoana;

        io.to(id).emit('countdownNohavaozina', {
            mandeha: true,
            fotoana: fotoana
        });

        if (fotoana <= 0 || lobby.mpilalao.length === 0) {
            clearInterval(interval);
            lobby.mandeha = false;

            if (lobby.mpilalao.length >= 2) {
                manombokaLalao(lobby);
            }
        }
    }, 1000);
}

function manombokaLalao(lobby) {
    const id = mamoronaId();
    const lalao = {
        id: id,
        lobbyId: lobby.id,
        mpilalao: lobby.mpilalao.map(m => m.id),
        nanaiky: new Set(),
        state: {
            mpilalao: [],
            bala: [],
            grenady: [],
            loot: []
        },
        faritra: {
            x: 0,
            y: 0,
            radius: CONFIG.faritraVoalohany
        },
        manomboka: Date.now()
    };

    lobby.mpilalao.forEach((m, i) => {
        const angle = (i / lobby.mpilalao.length) * Math.PI * 2;
        const radius = 1000;

        lalao.state.mpilalao.push({
            id: m.id,
            uid: m.uid,
            anarana: m.anarana,
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            zoro: 0,
            fahasalamana: 100,
            bala: 30,
            balaMax: 30,
            vono: 0,
            velona: true,
            hetsika: {}
        });

        const p = mpilalao.get(m.id);
        if (p) {
            p.lalao = id;
            p.lobby = null;
            mpilalao.set(m.id, p);
        }
    });

    for (let i = 0; i < 50; i++) {
        lalao.state.loot.push({
            id: mamoronaId(),
            x: (Math.random() - 0.5) * 8000,
            y: (Math.random() - 0.5) * 8000,
            karazana: 'bala'
        });
    }

    lalaoMavitrika.set(id, lalao);
    lobbies.delete(lobby.id);

    io.to(lobby.id).emit('matchManomboka', {
        id: id,
        state: lalao.state,
        faritra: lalao.faritra
    });

    lobby.mpilalao.forEach(m => {
        const sock = io.sockets.sockets.get(m.id);
        if (sock) {
            sock.join(id);
            sock.leave(lobby.id);
        }
    });

    manombokaLoopLalao(id);
}

function manombokaLoopLalao(id) {
    const lalao = lalaoMavitrika.get(id);
    if (!lalao) return;

    const interval = setInterval(() => {
        havaozyLalao(lalao);

        io.to(id).emit('fanavaozanaLalao', {
            state: lalao.state,
            fotoana: Date.now() - lalao.manomboka,
            faritra: lalao.faritra
        });

        const velona = lalao.state.mpilalao.filter(m => m.velona);
        if (velona.length <= 1) {
            clearInterval(interval);
            faranoLalao(lalao, velona[0]);
        }
    }, 1000 / 30);
}

function havaozyLalao(lalao) {
    lalao.state.mpilalao.forEach(mp => {
        if (!mp.velona) return;

        const h = mp.hetsika || {};
        const haingana = h.sprint? 5 : 3;

        if (h.ambony) mp.y -= haingana;
        if (h.ambany) mp.y += haingana;
        if (h.ankavia) mp.x -= haingana;
        if (h.ankavanana) mp.x += haingana;

        mp.x = Math.max(-5000, Math.min(5000, mp.x));
        mp.y = Math.max(-5000, Math.min(5000, mp.y));

        const halavirana = Math.sqrt(mp.x * mp.x + mp.y * mp.y);
        if (halavirana > lalao.faritra.radius) {
            mp.fahasalamana -= 0.5;
            if (mp.fahasalamana <= 0) {
                mp.velona = false;
                mp.fahasalamana = 0;
            }
        }
    });

    lalao.state.bala = lalao.state.bala.filter(b => {
        b.x += Math.cos(b.zoro) * 15;
        b.y += Math.sin(b.zoro) * 15;

        let voa = false;
        lalao.state.mpilalao.forEach(mp => {
            if (mp.id!== b.tompony && mp.velona) {
                const dist = Math.sqrt((mp.x - b.x) ** 2 + (mp.y - b.y) ** 2);
                if (dist < 25) {
                    mp.fahasalamana -= b.fahasimbana;
                    voa = true;

                    const tompony = lalao.state.mpilalao.find(m => m.id === b.tompony);
                    if (tompony) {
                        io.to(b.tompony).emit('fahasimbana', {
                            isa: b.fahasimbana,
                            avyAmin: mp.id
                        });
                    }

                    if (mp.fahasalamana <= 0) {
                        mp.velona = false;
                        mp.fahasalamana = 0;
                        if (tompony) tompony.vono++;

                        io.to(mp.id).emit('mpilalaoMaty', {
                            vono: mp.vono,
                            laharana: lalao.state.mpilalao.filter(m => m.velona).length + 1
                        });
                    }
                }
            }
        });

        return!voa && Math.abs(b.x) < 6000 && Math.abs(b.y) < 6000;
    });

    const fotoana = Date.now() - lalao.manomboka;
    const fandrosoana = Math.min(1, fotoana / CONFIG.fotoanaFaritra);
    lalao.faritra.radius = CONFIG.faritraVoalohany - (CONFIG.faritraVoalohany - CONFIG.faritraFarany) * fandrosoana;
}

function faranoLalao(lalao, mpandresy) {
    lalao.state.mpilalao.forEach(mp => {
        const sock = io.sockets.sockets.get(mp.id);
        if (sock) {
            sock.leave(lalao.id);
            const p = mpilalao.get(mp.id);
            if (p) {
                p.lalao = null;
                mpilalao.set(mp.id, p);
            }
        }

        if (mp.id === mpandresy?.id) {
            io.to(mp.id).emit('mpilalaoNandresy', {
                vono: mp.vono
            });
        }
    });

    lalaoMavitrika.delete(lalao.id);
}

function mitadyMpifanandrina(mode) {
    const miandry = Array.from(matchmaking.values()).filter(m => m.mode === mode);

    if (miandry.length >= 2) {
        const vondrona = miandry.slice(0, Math.min(100, miandry.length));
        const id = mamoronaId();

        const lalao = {
            id: id,
            mpilalao: vondrona.map(v => v.socketId),
            nanaiky: new Set()
        };

        lalaoMavitrika.set(id, lalao);

        vondrona.forEach(v => {
            matchmaking.delete(v.socketId);
            io.to(v.socketId).emit('matchHita', {
                id: id,
                isa: vondrona.length,
                max: 100,
                sarintany: 'Madagascar'
            });
        });
    }
}

function mamoronaId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

async function makaShopAvyFirebase() {
    const snapshot = await db.collection('shop').get();
    const zavatra = [];
    snapshot.forEach(doc => {
        zavatra.push({id: doc.id,...doc.data()});
    });
    return {
        zavatra: zavatra,
        fotoanaMiverina: Date.now() + 86400000
    };
}

async function mividyZavatra(uid, zavatraId) {
    const userRef = db.collection('mpilalao').doc(uid);
    const user = await userRef.get();

    if (!user.exists) return {vita: false, antony: 'Tsy hita'};

    const data = user.data();
    const zavatra = await db.collection('shop').doc(zavatraId).get();

    if (!zavatra.exists) return {vita: false, antony: 'Zavatra tsy hita'};

    const z = zavatra.data();
    const vidiny = z.vidinyFihena || z.vidiny;
    const vola = z.vola === 'diamondra'? data.diamondra : data.volamena;

    if (vola < vidiny) return {vita: false, antony: 'Tsy ampy vola'};

    if (data.hoditra && data.hoditra.includes(zavatraId)) {
        return {vita: false, antony: 'Efa manana'};
    }

    const fanavaozana = {};
    if (z.vola === 'diamondra') {
        fanavaozana.diamondra = admin.firestore.FieldValue.increment(-vidiny);
    } else {
        fanavaozana.volamena = admin.firestore.FieldValue.increment(-vidiny);
    }
    fanavaozana.hoditra = admin.firestore.FieldValue.arrayUnion(zavatraId);

    await userRef.update(fanavaozana);

    return {vita: true};
}

async function makaStatistikaAvyFirebase(uid) {
    const doc = await db.collection('statistika').doc(uid).get();
    return doc.exists? doc.data() : {ankapobeny: {}, fitaovana: {}, sarintany: {}};
}

app.get('/', (req, res) => {
    res.json({
        anarana: 'MG Fighter Server',
        version: '4.0.0',
        mpilalao: mpilalao.size,
        lobbies: lobbies.size,
        lalao: lalaoMavitrika.size
    });
});

app.get('/health', (req, res) => {
    res.json({status: 'ok', fotoana: Date.now()});
});

server.listen(PORT, () => {
    console.log(`Server mandeha amin'ny port ${PORT}`);
    console.log(`Mpilalao: 0`);
});

setInterval(() => {
    console.log(`Stats - Mpilalao: ${mpilalao.size}, Lobbies: ${lobbies.size}, Lalao: ${lalaoMavitrika.size}`);
}, 60000);
