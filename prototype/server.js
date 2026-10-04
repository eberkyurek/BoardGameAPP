// Prototip sunucusu: eşleşme, oda kodu, kayıt/bot rakip ve tarayıcı arayüzü.
// Çalıştırma: node server.js   (ek paket gerekmez)
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const { Match, Side } = require('./game');
const { GameData, createRng } = require('./rules');

const STATIC = path.join(__dirname, 'static');
const STATIC_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
};

const CONFIG = {
  RECORDINGS_FILE: process.env.RECORDINGS_FILE || path.join(__dirname, 'data', 'recordings.json'),
  MATCH_WAIT_MS: Number(process.env.MATCH_WAIT_MS || 8000), // çevrim içi rakip bekleme süresi
  DISCONNECT_MS: Number(process.env.DISCONNECT_MS || 20000),
  MAX_RECORDINGS: 300,
  MAX_PLAYERS: 2000, // açık internette belleği korumak için eşzamanlı oturum sınırı
  MAX_BODY_BYTES: 16 * 1024,
  REQUEST_TIMEOUT_MS: 20000,
};
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
const BOT_NAMES = ['Deniz', 'Elif', 'Mert', 'Zeynep', 'Can', 'Ayşe', 'Emre', 'Selin', 'Kaan', 'Defne',
  'Bora', 'İpek', 'Tuna', 'Nehir', 'Ozan', 'Ece', 'Barış', 'Melis', 'Kerem', 'Duru'];

const nowMs = () => Math.floor(performance.now());

class Lobby {
  constructor(data, rng = createRng(), recordingsFile = CONFIG.RECORDINGS_FILE) {
    this.data = data;
    this.rng = rng;
    this.players = new Map(); // token -> oyuncu
    this.rooms = new Map(); // oda kodu -> kurucunun tokeni
    this.quick = null; // hızlı maç bekleyen oyuncunun tokeni
    this.recordingsFile = recordingsFile;
    this.recordings = this._loadRecordings();
    this._saveMatch = this._saveMatch.bind(this);
  }

  // --- kayıtlar

  _loadRecordings() {
    try {
      const list = JSON.parse(fs.readFileSync(this.recordingsFile, 'utf8'));
      // Eski biçimdeki kayıtlar atlanır.
      return list.filter((r) => r.rounds.every((round) => 'lockMs' in round) && r.questions.every((q) => q.minText));
    } catch (err) {
      return [];
    }
  }

  // Biten maçtaki gerçek oyuncuların cevap ve sürelerini, ileride rakip olarak kullanmak için saklar.
  _saveMatch(match) {
    if (match.reason === 'forfeit') return;
    for (const side of match.sides) {
      // Hiç cevap yazmamış bir oyuncunun kaydı rakip olarak kullanılmaz.
      const played = side.rounds.some((round) => round.answers.some((text) => text.trim()));
      if (side.kind === 'human' && played) {
        this.recordings.push({ name: side.name, questions: match.questions, rounds: side.rounds });
      }
    }
    this.recordings = this.recordings.slice(-CONFIG.MAX_RECORDINGS);
    try {
      fs.writeFileSync(this.recordingsFile, JSON.stringify(this.recordings), 'utf8');
    } catch (err) {
      // Disk yazılamıyorsa kayıtlar yalnızca bellekte kalır.
    }
  }

  // --- eşleşme

  // Dönüş: { token } veya { error }
  join(name, mode, code, now) {
    if (this.players.size >= CONFIG.MAX_PLAYERS) return { error: 'Sunucu şu an dolu. Biraz sonra tekrar dene.' };
    const cleanName = String(name || '').split(/\s+/).filter(Boolean).join(' ').slice(0, 16)
      || `Misafir-${this.rng.int(1000, 9999)}`;
    const token = crypto.randomBytes(12).toString('base64url');
    const player = { name: cleanName, mode, match: null, side: null, code: null, since: now, seen: now };
    if (mode === 'join') {
      const roomCode = String(code || '').trim().toUpperCase();
      const host = this.rooms.get(roomCode);
      this.rooms.delete(roomCode);
      if (!this.players.has(host)) return { error: 'Bu kodla açık bir oda bulunamadı.' };
      this.players.set(token, player);
      this._start(host, token, now);
    } else if (mode === 'create') {
      player.code = Array.from({ length: 4 }, () => this.rng.choice([...ROOM_ALPHABET])).join('');
      this.rooms.set(player.code, token);
      this.players.set(token, player);
    } else {
      this.players.set(token, player);
      if (this.players.has(this.quick)) {
        const other = this.quick;
        this.quick = null;
        this._start(other, token, now);
      } else {
        this.quick = token;
      }
    }
    return { token };
  }

  _start(tokenA, tokenB, now) {
    const pair = [this.players.get(tokenA), this.players.get(tokenB)];
    const match = new Match(this.data, this.rng, pair.map((p) => new Side(p.name)), now, [], this._saveMatch);
    pair.forEach((player, side) => Object.assign(player, { match, side, code: null }));
  }

  // Çevrim içi rakip yoksa: varsa önceki bir oyuncunun kaydı, yoksa bot.
  _startOffline(token, now) {
    const player = this.players.get(token);
    const choices = this.recordings.filter((r) => r.name !== player.name);
    let rival;
    let questions = [];
    if (choices.length) {
      const rec = this.rng.choice(choices);
      rival = new Side(rec.name, 'ghost', rec.rounds);
      questions = rec.questions;
    } else {
      rival = new Side(this.rng.choice(BOT_NAMES.filter((n) => n !== player.name)), 'bot');
    }
    player.match = new Match(this.data, this.rng, [new Side(player.name), rival], now, questions, this._saveMatch);
    player.side = 0;
  }

  leave(token, now) {
    const player = this.players.get(token);
    if (!player) return;
    this.players.delete(token);
    if (this.quick === token) this.quick = null;
    if (player.code) this.rooms.delete(player.code);
    if (player.match) player.match.forfeit(player.side, now);
  }

  tick(now) {
    const waiting = this.players.get(this.quick);
    if (waiting && now - waiting.since >= CONFIG.MATCH_WAIT_MS) {
      const token = this.quick;
      this.quick = null;
      this._startOffline(token, now);
    }
    for (const [token, player] of [...this.players]) {
      if (now - player.seen > CONFIG.DISCONNECT_MS) this.leave(token, now);
      else if (player.match) player.match.tick(now);
    }
  }

  // --- istekler

  state(token, now) {
    const player = this.players.get(token);
    if (!player) return null;
    player.seen = now;
    if (!player.match) return { phase: 'waiting', mode: player.mode, code: player.code, meName: player.name };
    player.match.tick(now);
    return player.match.view(player.side, now);
  }

  action(token, body, now) {
    const player = this.players.get(token);
    if (!player) return null;
    const { match, side } = player;
    if (body.type === 'leave') {
      this.leave(token, now);
      return { phase: 'left' };
    }
    if (match) {
      match.tick(now);
      if ((body.type === 'answers' || body.type === 'lock') && Array.isArray(body.texts)) match.setAnswers(side, body.texts);
      if (body.type === 'lock') match.lock(side, now);
      else if (body.type === 'ready') match.ready(side, now);
      else if (body.type === 'coin') match.chooseCoin(side, body.choice, now);
    }
    return this.state(token, now);
  }
}

function send(res, status, body, contentType = 'application/json; charset=utf-8') {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body), 'utf8');
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': payload.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > CONFIG.MAX_BODY_BYTES) {
        reject(Object.assign(new Error('too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
        resolve(body);
      } catch (err) {
        reject(Object.assign(err, { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function createHandler(lobby) {
  return async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/api/state') {
        const state = lobby.state(url.searchParams.get('token') || '', nowMs());
        return state ? send(res, 200, state) : send(res, 404, { error: 'Oturum bulunamadı.' });
      }
      if (req.method === 'GET' && STATIC_FILES[url.pathname]) {
        const [name, contentType] = STATIC_FILES[url.pathname];
        return send(res, 200, fs.readFileSync(path.join(STATIC, name)), contentType);
      }
      if (req.method === 'POST' && Number(req.headers['content-length'] || 0) > CONFIG.MAX_BODY_BYTES) {
        return send(res, 413, { error: 'İstek çok büyük.' });
      }
      if (req.method === 'POST' && url.pathname === '/api/join') {
        const body = await readJson(req);
        const mode = ['quick', 'create', 'join'].includes(body.mode) ? body.mode : 'quick';
        const result = lobby.join(body.name, mode, body.code, nowMs());
        return result.error ? send(res, 400, { error: result.error }) : send(res, 200, { token: result.token });
      }
      if (req.method === 'POST' && url.pathname === '/api/action') {
        const body = await readJson(req);
        const state = lobby.action(String(body.token || ''), body, nowMs());
        return state ? send(res, 200, state) : send(res, 404, { error: 'Oturum bulunamadı.' });
      }
      return send(res, 404, { error: 'Bulunamadı.' });
    } catch (err) {
      if (res.headersSent) return res.end();
      return err.status === 413
        ? send(res, 413, { error: 'İstek çok büyük.' })
        : send(res, 400, { error: 'Geçersiz istek.' });
    }
  };
}

function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list || []) {
      if (item.family === 'IPv4' && !item.internal) return item.address;
    }
  }
  return null;
}

function start() {
  const lobby = new Lobby(new GameData());
  // Kimse istek göndermese de süreleri ve kayıt/bot rakipleri ilerletir.
  setInterval(() => lobby.tick(nowMs()), 200);

  const server = http.createServer(createHandler(lobby));
  server.requestTimeout = CONFIG.REQUEST_TIMEOUT_MS; // yarım kalan istekler bağlantıyı süresiz tutmasın

  // Barındırma hizmetleri kapıyı PORT ile verir; bazıları sayı yerine soket yolu gönderir.
  const hosted = process.env.PORT;
  if (hosted && !/^\d+$/.test(hosted)) {
    server.listen(hosted, () => console.log(`Tahmin oyunu çalışıyor: ${hosted}`));
    return server;
  }
  const port = Number(hosted || 8000);
  // Yerelde yalnızca bu bilgisayardan erişilir; aynı ağdaki cihazlar için HOST=0.0.0.0.
  const host = process.env.HOST || (hosted ? '0.0.0.0' : '127.0.0.1');
  server.listen(port, host, () => {
    console.log(`Tahmin oyunu prototipi çalışıyor: http://localhost:${port}`);
    if (host === '0.0.0.0' && lanAddress()) console.log(`Aynı ağdaki diğer cihazlar için:   http://${lanAddress()}:${port}`);
  });
  return server;
}

if (require.main === module) start();

module.exports = { CONFIG, Lobby, createHandler, start };
