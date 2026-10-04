// Çalıştırma: npm test
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { CONFIG, Match, Side } = require('../game');
const { editDistance, normalize } = require('../names');
const { GameData, createRng, formatNumber, scoreQuestion } = require('../rules');
const server = require('../server');

const DATA = new GameData();
const POPULATION_2 = { metric: 'population', n: 2, target: 170_000_000, text: 'soru', minText: 'alt sınır' };

const resolve = (text) => DATA.resolver.resolve(text);
const names = (ids) => new Set(ids.map((id) => DATA.byId.get(id).name));
const second = (texts) => {
  const answer = DATA.evaluate(POPULATION_2, texts).answers[1];
  return [answer.id, answer.status];
};

// --- ad eşleştirme

test('normalize', () => {
  assert.equal(normalize(' TÜRKİYE '), 'turkiye');
  assert.equal(normalize('Irak'), 'irak');
  assert.equal(normalize('Güney  Kore!'), 'guneykore');
});

test('edit distance', () => {
  assert.equal(editDistance('almanya', 'almnya', 2), 1);
  assert.equal(editDistance('almanya', 'alamnya', 2), 1); // komşu harfler yer değiştirmiş
  assert.equal(editDistance('almanya', 'japonya', 2), 3); // limit aşıldı
});

test('every country resolves to itself', () => {
  for (const entity of DATA.entities) {
    for (const text of [entity.name, entity.name.toLocaleUpperCase('tr'), entity.en]) {
      const found = resolve(text);
      assert.deepEqual([found.status, found.id], ['ok', entity.id], text);
    }
  }
});

test('spelling mistakes and aliases are corrected', () => {
  const cases = { turkiye: 'TUR', Turkey: 'TUR', almnya: 'DEU', ABD: 'USA', ingiltere: 'GBR', fransaa: 'FRA',
    brezlya: 'BRA', 'Güney Kore': 'KOR', hollanda: 'NLD', rusya: 'RUS' };
  for (const [text, expected] of Object.entries(cases)) {
    const found = resolve(text);
    assert.deepEqual([found.status, found.id], ['ok', expected], text);
  }
});

test('unknown text is not matched', () => {
  // Listede olmayan yerler, benzeyen bir ülkeye düzeltilmemeli.
  for (const text of ['abcxyz', 'qq', 'zzzzzzzz', 'afrika', 'tayvan', 'Kuzey Kıbrıs', 'kosova', 'paris']) {
    assert.equal(resolve(text).status, 'unknown', text);
  }
  assert.equal(resolve('   ').status, 'empty');
});

test('similar names stay apart', () => {
  const pairs = { Nijer: 'NER', Nijerya: 'NGA', İran: 'IRN', Irak: 'IRQ', Avusturya: 'AUT', Avustralya: 'AUS',
    Gine: 'GIN', Sudan: 'SDN', 'Güney Sudan': 'SSD', Dominika: 'DMA' };
  for (const [text, expected] of Object.entries(pairs)) assert.equal(resolve(text).id, expected, text);
});

test('ambiguous text offers candidates', () => {
  const cases = { kore: ['Güney Kore', 'Kuzey Kore'], kongo: ['Kongo Cumhuriyeti', 'Demokratik Kongo Cumhuriyeti'],
    dominik: ['Dominika', 'Dominik Cumhuriyeti'] };
  for (const [text, expected] of Object.entries(cases)) {
    const found = resolve(text);
    assert.ok(['ambiguous', 'unknown'].includes(found.status), text); // kendiliğinden seçilmez
    assert.deepEqual(names(found.candidates), new Set(expected));
  }
});

// --- kurallar

test('question scoring', () => {
  const valid = (distance) => ({ valid: true, distance });
  const invalid = { valid: false, distance: null };
  assert.deepEqual(scoreQuestion(valid(10), valid(20)), [1, 0]);
  assert.deepEqual(scoreQuestion(valid(20), valid(10)), [0, 1]);
  assert.deepEqual(scoreQuestion(valid(10), valid(10)), [0.5, 0.5]);
  assert.deepEqual(scoreQuestion(valid(999), invalid), [1, 0]);
  assert.deepEqual(scoreQuestion(invalid, invalid), [0, 0]);
});

test('distance counts both directions equally', () => {
  const sum = DATA.byId.get('TUR').values.population + DATA.byId.get('DEU').values.population;
  for (const target of [sum + 5, sum - 5]) {
    assert.equal(DATA.evaluate({ ...POPULATION_2, target }, ['Türkiye', 'Almanya']).distance, 5);
  }
});

test('invalid lists', () => {
  assert.equal(DATA.evaluate(POPULATION_2, ['Türkiye', '']).valid, false);
  assert.deepEqual(second(['Türkiye', 'Turkey']), ['TUR', 'duplicate']);
  assert.deepEqual(second(['Türkiye', 'Vatikan']), ['VAT', 'below_min']);
  assert.deepEqual(second(['Türkiye', 'abcxyz']), [null, 'unknown']);
  assert.equal(DATA.evaluate(POPULATION_2, ['Türkiye', 'abcxyz']).total, null);
});

test('generated questions are reachable', () => {
  const rng = createRng(7);
  for (let i = 0; i < 200; i++) {
    const question = DATA.makeQuestion(rng);
    assert.ok(DATA.eligible(question.metric).length >= 100);
    assert.ok(Number.isInteger(question.target), `${question.target}`);
    assert.ok(DATA.evaluate(question, DATA.botAnswers(question, rng)).valid, question.text);
  }
});

test('number formatting', () => {
  assert.equal(formatNumber(85_878_556), '85,9 milyon');
  assert.equal(formatNumber(400_000_000), '400 milyon');
  assert.equal(formatNumber(1_200_000_000), '1,2 milyar');
  assert.equal(formatNumber(785_350, ' km²'), '785 bin km²');
  assert.equal(formatNumber(882), '882');
});

// --- maç akışı

function newMatch(sides = [new Side('A'), new Side('B')]) {
  const finished = [];
  const match = new Match(DATA, createRng(1), sides, 0, Array(20).fill(POPULATION_2), (m) => finished.push(m));
  return { match, finished };
}

// Bir soruyu iki tarafın kilitlemesiyle bitirir ve sonraki adıma geçer.
function play(match, now, textsA, textsB) {
  match.setAnswers(0, textsA);
  match.setAnswers(1, textsB);
  match.lock(0, now + 1000);
  match.lock(1, now + 2000);
  assert.equal(match.phase, 'reveal');
  match.ready(0, now + 3000);
  match.ready(1, now + 4000);
  return now + 4000;
}

test('both locked reveals without waiting', () => {
  const { match } = newMatch();
  match.setAnswers(0, ['Türkiye', 'Almanya']);
  match.lock(0, 5000);
  assert.equal(match.phase, 'question');
  assert.ok(!JSON.stringify(match.view(1, 5000)).includes('Türkiye')); // rakip cevabı göremez
  match.setAnswers(0, ['Fransa', 'İtalya']); // kilitlendikten sonra değiştirilemez
  match.setAnswers(1, ['Japonya', 'Mısır']);
  match.lock(1, 9000);
  assert.equal(match.phase, 'reveal');
  const view = match.view(0, 9000);
  assert.deepEqual(view.me.answers.map((a) => a.name), ['Türkiye', 'Almanya']);
  assert.equal(view.me.points + view.opp.points, 1);
});

test('timeout locks the current answers', () => {
  const { match } = newMatch();
  match.setAnswers(0, ['Türkiye', 'Almanya']);
  match.tick(CONFIG.QUESTION_MS - 1);
  assert.equal(match.phase, 'question');
  match.tick(CONFIG.QUESTION_MS);
  assert.equal(match.phase, 'reveal');
  assert.deepEqual(match.score, [1, 0]); // geçerli listeye karşı boş liste
  match.tick(CONFIG.QUESTION_MS + CONFIG.REVEAL_MS);
  assert.deepEqual([match.phase, match.number], ['question', 2]);
});

test('match ends after five questions', () => {
  const { match, finished } = newMatch();
  let now = 0;
  for (let i = 0; i < 5; i++) {
    assert.equal(match.phase, 'question');
    now = play(match, now, ['Türkiye', 'Almanya'], ['Türkiye', 'abcxyz']);
  }
  assert.deepEqual([match.phase, match.reason, match.winner, match.score], ['finished', 'score', 0, [5, 0]]);
  assert.equal(finished.length, 1);
  assert.equal(match.view(0, now).won, true);
  assert.equal(match.view(1, now).won, false);
});

test('tie goes to overtime until broken', () => {
  const { match } = newMatch();
  let now = 0;
  for (let i = 0; i < 7; i++) now = play(match, now, ['Türkiye', 'Almanya'], ['Almanya', 'Türkiye']);
  assert.deepEqual([match.phase, match.number, match.score], ['question', 8, [3.5, 3.5]]);
  assert.equal(match.view(0, now).overtime, true);
  play(match, now, ['Türkiye', 'Almanya'], ['', '']);
  assert.deepEqual([match.phase, match.winner], ['finished', 0]);
});

test('coin toss after ten overtime questions', () => {
  const { match } = newMatch();
  let now = 0;
  for (let i = 0; i < CONFIG.REGULAR_QUESTIONS + CONFIG.MAX_OVERTIME; i++) {
    assert.equal(match.phase, 'question');
    now = play(match, now, ['', ''], ['', '']);
  }
  assert.equal(match.phase, 'coin');
  const chooser = match.coin.chooser;
  match.chooseCoin(1 - chooser, 'yazi', now); // seçme hakkı olmayan oyuncu seçemez
  assert.equal(match.coin.choice, null);
  match.chooseCoin(chooser, 'yazi', now);
  const expected = match.coin.result === 'yazi' ? chooser : 1 - chooser;
  match.tick(now + CONFIG.COIN_SHOW_MS);
  assert.deepEqual([match.phase, match.reason, match.winner], ['finished', 'coin', expected]);
});

test('recorded rival uses the recorded times', () => {
  const script = [{ answers: ['Japonya', 'Mısır'], lockMs: 30_000, readyMs: 4_000 }];
  const { match } = newMatch([new Side('A'), new Side('Kayıt', 'ghost', script)]);
  match.setAnswers(0, ['Türkiye', 'Almanya']);
  match.lock(0, 10_000);
  match.tick(29_999);
  assert.equal(match.phase, 'question');
  match.tick(30_000);
  assert.equal(match.phase, 'reveal');
  assert.deepEqual(match.view(0, 30_000).opp.answers.map((a) => a.name), ['Japonya', 'Mısır']);
  match.ready(0, 31_000);
  match.tick(33_999);
  assert.equal(match.phase, 'reveal');
  match.tick(34_000);
  assert.deepEqual([match.phase, match.number], ['question', 2]);
});

// --- eşleşme

function newLobby() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tahmin-')), 'recordings.json');
  return { lobby: new server.Lobby(DATA, createRng(3), file), file };
}

const ANSWERS = ['Türkiye', 'Almanya', 'Fransa', 'Japonya', 'Brezilya'];

// Oyuncu bağlı kalır; answer verilirse her soruda geçerli bir liste kilitler.
function playOffline(lobby, token, start, answer) {
  let now = start;
  const match = lobby.players.get(token).match;
  while (match.phase !== 'finished') {
    now += 1000;
    const state = lobby.state(token, now);
    if (answer && state.phase === 'question' && !state.locked) {
      lobby.action(token, { type: 'lock', texts: ANSWERS.slice(0, state.question.n) }, now);
    }
    lobby.tick(now);
  }
  return now;
}

test('quick match pairs online players', () => {
  const { lobby } = newLobby();
  const a = lobby.join('A', 'quick', null, 0).token;
  assert.equal(lobby.state(a, 0).phase, 'waiting');
  const b = lobby.join('B', 'quick', null, 100).token;
  assert.equal(lobby.state(a, 100).oppName, 'B');
  assert.equal(lobby.state(b, 100).oppName, 'A');
});

test('room code', () => {
  const { lobby } = newLobby();
  const host = lobby.join('A', 'create', null, 0).token;
  const code = lobby.state(host, 0).code;
  assert.equal(lobby.join('B', 'join', 'YOK1', 0).error, 'Bu kodla açık bir oda bulunamadı.');
  const guest = lobby.join('B', 'join', code.toLowerCase(), 0).token;
  assert.equal(lobby.state(guest, 0).phase, 'question');
  assert.equal(lobby.state(host, 0).oppName, 'B');
});

test('no online rival falls back to a bot, then to a recording', () => {
  const { lobby, file } = newLobby();
  const a = lobby.join('A', 'quick', null, 0).token;
  lobby.tick(server.CONFIG.MATCH_WAIT_MS);
  const match = lobby.players.get(a).match;
  assert.equal(match.sides[1].kind, 'bot');
  const now = playOffline(lobby, a, server.CONFIG.MATCH_WAIT_MS, true);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).length, 1);

  const b = lobby.join('B', 'quick', null, now).token;
  lobby.tick(now + server.CONFIG.MATCH_WAIT_MS);
  const next = lobby.players.get(b).match;
  assert.deepEqual([next.sides[1].kind, next.sides[1].name], ['ghost', 'A']);
  assert.deepEqual(next.questions[0], match.questions[0]);
});

test('idle player is not recorded', () => {
  const { lobby } = newLobby();
  const a = lobby.join('A', 'quick', null, 0).token;
  lobby.tick(server.CONFIG.MATCH_WAIT_MS);
  playOffline(lobby, a, server.CONFIG.MATCH_WAIT_MS, false);
  assert.deepEqual(lobby.recordings, []);
});

test('session limit', () => {
  const { lobby } = newLobby();
  const original = server.CONFIG.MAX_PLAYERS;
  server.CONFIG.MAX_PLAYERS = 2;
  try {
    lobby.join('A', 'create', null, 0);
    lobby.join('B', 'create', null, 0);
    assert.match(lobby.join('C', 'create', null, 0).error, /dolu/);
  } finally {
    server.CONFIG.MAX_PLAYERS = original;
  }
});

test('leaving forfeits the match', () => {
  const { lobby } = newLobby();
  const a = lobby.join('A', 'quick', null, 0).token;
  const b = lobby.join('B', 'quick', null, 0).token;
  lobby.action(a, { type: 'leave' }, 1000);
  const state = lobby.state(b, 1000);
  assert.deepEqual([state.phase, state.reason, state.won], ['finished', 'forfeit', true]);
});
