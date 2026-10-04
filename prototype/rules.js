// Oyun verisi, soru üretimi, cevap değerlendirme ve puanlama.
const fs = require('fs');
const path = require('path');

const { Resolver } = require('./names');

const DATA_FILE = path.join(__dirname, 'data', 'countries.json');

// Soru şablonları. "min" dolgu cevapları engelleyen alt sınırdır.
const METRICS = {
  population: {
    min: 1_000_000,
    unit: '',
    text: (target, n) => `Nüfuslarının toplamı ${target} olan ${n} ülke yaz.`,
    minText: 'Her ülkenin nüfusu en az 1 milyon olmalı.',
  },
  area: {
    min: 10_000,
    unit: ' km²',
    text: (target, n) => `Yüzölçümlerinin toplamı ${target} olan ${n} ülke yaz.`,
    minText: 'Her ülkenin yüzölçümü en az 10 bin km² olmalı.',
  },
  gdp: {
    min: 10_000_000_000,
    unit: ' dolar',
    text: (target, n) => `Millî gelirlerinin (GSYH) toplamı ${target} olan ${n} ülke yaz.`,
    minText: 'Her ülkenin millî geliri en az 10 milyar dolar olmalı.',
  },
};
const ANSWER_COUNTS = [2, 3, 3, 4, 4, 5, 5]; // çoklu cevaplar öncelikli
const BOT_TRIES = [1, 2, 3, 5, 8, 15, 30];

const SCALES = [[1e12, 'trilyon'], [1e9, 'milyar'], [1e6, 'milyon'], [1e3, 'bin']];

const trimZeros = (text) => (text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text);

// 85878556 -> "85,9 milyon"
function formatNumber(value, unit = '', digits = 3) {
  if (value === null || value === undefined) return '—';
  const size = Math.abs(value);
  for (const [limit, word] of SCALES) {
    if (size >= limit) {
      const scaled = value / limit;
      const decimals = Math.max(0, digits - 1 - Math.floor(Math.log10(Math.abs(scaled))));
      return `${trimZeros(scaled.toFixed(decimals)).replace('.', ',')} ${word}${unit}`;
    }
  }
  const text = size < 10 ? trimZeros(value.toFixed(1)) : String(Math.round(value));
  return `${text.replace('.', ',')}${unit}`;
}

function roundSignificant(value, digits = 2) {
  if (value === 0) return 0;
  const exponent = Math.floor(Math.log10(Math.abs(value))) - (digits - 1);
  const step = 10 ** Math.abs(exponent);
  return exponent >= 0 ? Math.round(value / step) * step : Math.round(value * step) / step;
}

// Soru puanı: yakın olan 1, eşit uzaklık 0,5; geçersiz liste 0, geçerli rakibi 1.
function scoreQuestion(a, b) {
  if (!a.valid && !b.valid) return [0, 0];
  if (!b.valid) return [1, 0];
  if (!a.valid) return [0, 1];
  if (a.distance < b.distance) return [1, 0];
  if (b.distance < a.distance) return [0, 1];
  return [0.5, 0.5];
}

// Rastgelelik kaynağı. Tohum verilirse aynı sırayı üretir (testler için).
function createRng(seed) {
  let state = seed === undefined ? null : seed >>> 0;
  const random = state === null ? Math.random : () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min, max) => min + Math.floor(random() * (max - min + 1));
  return {
    random,
    int,
    uniform: (min, max) => min + random() * (max - min),
    choice: (list) => list[int(0, list.length - 1)],
    sample(list, count) {
      const pool = [...list];
      for (let i = 0; i < count; i++) {
        const j = int(i, pool.length - 1);
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, count);
    },
  };
}

class GameData {
  constructor(file = DATA_FILE) {
    this.entities = JSON.parse(fs.readFileSync(file, 'utf8')).countries;
    this.byId = new Map(this.entities.map((e) => [e.id, e]));
    this.resolver = new Resolver(this.entities);
  }

  eligible(metric) {
    return this.entities.filter((e) => (e.values[metric] || 0) >= METRICS[metric].min);
  }

  makeQuestion(rng, avoidMetric = null) {
    const metric = rng.choice(Object.keys(METRICS).filter((m) => m !== avoidMetric));
    const n = rng.choice(ANSWER_COUNTS);
    const spec = METRICS[metric];
    // Hedef, kurala uyan rastgele bir listenin toplamından türetilir; böylece ulaşılabilir kalır.
    const sample = rng.sample(this.eligible(metric), n);
    const target = roundSignificant(sample.reduce((sum, e) => sum + e.values[metric], 0));
    return { metric, n, target, text: spec.text(formatNumber(target, spec.unit), n), minText: spec.minText };
  }

  // Bir cevap listesini değerlendirir. Tek bir geçersiz cevap listeyi geçersiz kılar.
  evaluate(question, texts) {
    const spec = METRICS[question.metric];
    const used = new Set();
    const answers = texts.map((text) => {
      const found = this.resolver.resolve(text);
      const answer = {
        text: String(text).trim(),
        status: found.status,
        id: found.id,
        name: null,
        value: null,
        candidates: found.candidates.map((id) => this.byId.get(id).name),
      };
      if (found.status === 'ok') {
        const entity = this.byId.get(found.id);
        const value = entity.values[question.metric];
        answer.name = entity.name;
        answer.value = value === undefined ? null : value;
        if (used.has(entity.id)) answer.status = 'duplicate';
        else if (answer.value === null || answer.value < spec.min) answer.status = 'below_min';
        used.add(entity.id);
      }
      return answer;
    });

    const valid = answers.length === question.n && answers.every((a) => a.status === 'ok');
    const total = valid ? answers.reduce((sum, a) => sum + a.value, 0) : null;
    return { answers, valid, total, distance: valid ? Math.abs(total - question.target) : null };
  }

  // Bot, rastgele birkaç liste dener ve hedefe en yakın olanı yazar; deneme sayısı becerisidir.
  botAnswers(question, rng) {
    const pool = this.eligible(question.metric);
    let best = null;
    for (let i = rng.choice(BOT_TRIES); i > 0; i--) {
      const pick = rng.sample(pool, question.n);
      const total = pick.reduce((sum, e) => sum + e.values[question.metric], 0);
      const distance = Math.abs(total - question.target);
      if (!best || distance < best.distance) best = { distance, pick };
    }
    return best.pick.map((e) => e.name);
  }
}

module.exports = { METRICS, GameData, createRng, formatNumber, roundSignificant, scoreQuestion };
