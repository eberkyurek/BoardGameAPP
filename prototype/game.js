// Maç durumu. Süre, puan ve veri değerleri yalnızca burada, sunucu tarafında tutulur.
const { METRICS, formatNumber, scoreQuestion } = require('./rules');

const ms = (name, fallback) => Number(process.env[name] || fallback);

const CONFIG = {
  QUESTION_MS: ms('QUESTION_MS', 120_000),
  REVEAL_MS: ms('REVEAL_MS', 30_000),
  COIN_MS: ms('COIN_MS', 20_000),
  COIN_SHOW_MS: ms('COIN_SHOW_MS', 6_000),
  REGULAR_QUESTIONS: 5,
  MAX_OVERTIME: 10,
};
const COIN_SIDES = ['yazi', 'tura'];

class Side {
  // kind: human | bot | ghost (önceki bir oyuncunun kaydı)
  constructor(name, kind = 'human', script = []) {
    this.name = name;
    this.kind = kind;
    this.script = script; // kayıt: soru başına cevaplar ve süreler
    this.texts = [];
    this.locked = false;
    this.lockMs = null;
    this.lockAt = null;
    this.ready = false;
    this.readyMs = null;
    this.readyAfter = null;
    this.rounds = []; // bu maçın kaydı
  }
}

class Match {
  constructor(data, rng, sides, now, presetQuestions = [], onFinish = null) {
    this.data = data;
    this.rng = rng;
    this.sides = sides;
    this.preset = presetQuestions || [];
    this.onFinish = onFinish;
    this.questions = [];
    this.number = 0;
    this.score = [0, 0];
    this.phase = null;
    this.result = null;
    this.coin = null;
    this.winner = null;
    this.reason = null;
    this.finishedAt = null;
    this._startQuestion(now);
  }

  get question() {
    return this.questions[this.questions.length - 1];
  }

  // --- oyuncu işlemleri

  setAnswers(i, texts) {
    const side = this.sides[i];
    if (this.phase !== 'question' || side.locked) return;
    const n = this.question.n;
    side.texts = Array.from({ length: n }, (_, k) => String(texts[k] === undefined || texts[k] === null ? '' : texts[k]).slice(0, 60));
  }

  lock(i, now) {
    const side = this.sides[i];
    if (this.phase === 'question' && !side.locked) {
      side.locked = true;
      side.lockMs = now - this.started;
      this.tick(now);
    }
  }

  ready(i, now) {
    const side = this.sides[i];
    if (this.phase === 'reveal' && !side.ready) {
      side.ready = true;
      side.readyMs = now - this.started;
      this.tick(now);
    }
  }

  chooseCoin(i, choice, now) {
    const coin = this.coin;
    if (this.phase !== 'coin' || coin.choice || i !== coin.chooser || !COIN_SIDES.includes(choice)) return;
    coin.choice = choice;
    coin.result = this.rng.choice(COIN_SIDES);
    coin.winner = coin.result === choice ? i : 1 - i;
    coin.until = now + CONFIG.COIN_SHOW_MS;
  }

  forfeit(i, now) {
    if (this.phase !== 'finished') this._finish(1 - i, 'forfeit', now);
  }

  // --- zamanla ilerleyen adımlar

  tick(now) {
    while (this._step(now));
  }

  _step(now) {
    if (this.phase === 'question') {
      for (const side of this.sides) {
        if (side.kind !== 'human' && !side.locked && now >= side.lockAt) {
          side.locked = true;
          side.lockMs = side.lockAt - this.started;
        }
      }
      if (this.sides.every((s) => s.locked) || now >= this.deadline) {
        this._reveal(now);
        return true;
      }
    } else if (this.phase === 'reveal') {
      for (const side of this.sides) {
        if (side.kind !== 'human' && !side.ready && now >= this.started + side.readyAfter) {
          side.ready = true;
          side.readyMs = side.readyAfter;
        }
      }
      if (this.sides.every((s) => s.ready) || now >= this.deadline) {
        this._advance(now);
        return true;
      }
    } else if (this.phase === 'coin') {
      const coin = this.coin;
      if (!coin.choice) {
        const chooser = this.sides[coin.chooser];
        if (now >= this.deadline || (chooser.kind !== 'human' && now >= coin.autoAt)) {
          this.chooseCoin(coin.chooser, this.rng.choice(COIN_SIDES), now);
          return true;
        }
      } else if (now >= coin.until) {
        this._finish(coin.winner, 'coin', now);
        return true;
      }
    }
    return false;
  }

  _startQuestion(now) {
    const index = this.number;
    this.number += 1;
    const lastMetric = this.questions.length ? this.question.metric : null;
    const question = index < this.preset.length ? this.preset[index] : this.data.makeQuestion(this.rng, lastMetric);
    this.questions.push(question);
    this.phase = 'question';
    this.started = now;
    this.deadline = now + CONFIG.QUESTION_MS;
    for (const side of this.sides) {
      side.texts = Array(question.n).fill('');
      side.locked = false;
      side.ready = false;
      side.lockMs = null;
      side.readyMs = null;
      if (side.kind !== 'human') this._plan(side, index, question);
    }
  }

  // Kayıt veya bot tarafının cevaplarını ve zamanlamasını belirler.
  _plan(side, index, question) {
    if (index < side.script.length) {
      // Kilitleme ve geçiş zamanları kayıttaki sürelerden alınır.
      const recorded = side.script[index];
      side.texts = Array.from({ length: question.n }, (_, k) => recorded.answers[k] || '');
      side.lockAt = this.started + recorded.lockMs;
      side.readyAfter = recorded.readyMs;
    } else {
      side.texts = this.data.botAnswers(question, this.rng);
      side.lockAt = this.started + Math.floor(CONFIG.QUESTION_MS * this.rng.uniform(0.15, 0.6));
      side.readyAfter = Math.floor(CONFIG.REVEAL_MS * this.rng.uniform(0.15, 0.6));
    }
  }

  _reveal(now) {
    const lists = this.sides.map((side) => this.data.evaluate(this.question, side.texts));
    const points = scoreQuestion(lists[0], lists[1]);
    this.sides.forEach((side, i) => {
      this.score[i] += points[i];
      // Süre dolduğunda kilitlenmemiş cevaplar olduğu gibi kilitlenir.
      if (!side.locked) {
        side.locked = true;
        side.lockMs = CONFIG.QUESTION_MS;
      }
      side.rounds.push({ answers: [...side.texts], lockMs: side.lockMs, readyMs: CONFIG.REVEAL_MS });
    });
    this.result = { lists, points };
    this.phase = 'reveal';
    this.started = now;
    this.deadline = now + CONFIG.REVEAL_MS;
  }

  _nextStep() {
    if (this.number < CONFIG.REGULAR_QUESTIONS) return 'question';
    if (this.score[0] !== this.score[1]) return 'finish';
    if (this.number < CONFIG.REGULAR_QUESTIONS + CONFIG.MAX_OVERTIME) return 'overtime';
    return 'coin';
  }

  _advance(now) {
    for (const side of this.sides) {
      if (side.readyMs !== null) side.rounds[side.rounds.length - 1].readyMs = side.readyMs;
    }
    const step = this._nextStep();
    if (step === 'finish') {
      this._finish(this.score[0] > this.score[1] ? 0 : 1, 'score', now);
    } else if (step === 'coin') {
      // Yazı veya turayı seçme hakkı rastgele bir oyuncuya verilir.
      this.phase = 'coin';
      this.deadline = now + CONFIG.COIN_MS;
      this.coin = { chooser: this.rng.int(0, 1), choice: null, result: null, winner: null,
        autoAt: now + this.rng.int(2000, 4000), until: null };
    } else {
      this._startQuestion(now);
    }
  }

  _finish(winner, reason, now) {
    this.phase = 'finished';
    this.winner = winner;
    this.reason = reason;
    this.finishedAt = now;
    if (this.onFinish) this.onFinish(this);
  }

  // --- oyuncuya gösterilen durum

  view(i, now) {
    const me = this.sides[i];
    const opp = this.sides[1 - i];
    const base = {
      phase: this.phase,
      number: this.number,
      regular: CONFIG.REGULAR_QUESTIONS,
      maxOvertime: CONFIG.MAX_OVERTIME,
      overtime: this.number > CONFIG.REGULAR_QUESTIONS,
      score: { me: this.score[i], opp: this.score[1 - i] },
      meName: me.name,
      oppName: opp.name,
    };
    const question = this.question;
    if (this.phase === 'question') {
      const draft = this.data.evaluate(question, me.texts);
      Object.assign(base, {
        question: { text: question.text, minText: question.minText, n: question.n },
        remainingMs: Math.max(0, this.deadline - now),
        totalMs: CONFIG.QUESTION_MS,
        locked: me.locked,
        oppLocked: opp.locked,
        listValid: draft.valid,
        slots: draft.answers.map((a) => ({ text: a.text, status: a.status, name: a.name, candidates: a.candidates })),
      });
    } else if (this.phase === 'reveal') {
      const unit = METRICS[question.metric].unit;
      Object.assign(base, {
        question: { text: question.text, minText: question.minText, target: formatNumber(question.target, unit) },
        remainingMs: Math.max(0, this.deadline - now),
        totalMs: CONFIG.REVEAL_MS,
        next: this._nextStep(),
        me: this._sideResult(i, unit),
        opp: this._sideResult(1 - i, unit),
      });
    } else if (this.phase === 'coin') {
      Object.assign(base, { coin: this._coinView(i), remainingMs: Math.max(0, this.deadline - now), totalMs: CONFIG.COIN_MS });
    } else if (this.phase === 'finished') {
      Object.assign(base, { won: this.winner === i, reason: this.reason, coin: this.coin ? this._coinView(i) : null });
    }
    return base;
  }

  _sideResult(i, unit) {
    const result = this.result.lists[i];
    return {
      valid: result.valid,
      total: formatNumber(result.total, unit),
      distance: formatNumber(result.distance, unit),
      points: this.result.points[i],
      ready: this.sides[i].ready,
      answers: result.answers.map((a) => ({ text: a.text, name: a.name, status: a.status, value: formatNumber(a.value, unit) })),
    };
  }

  _coinView(i) {
    const coin = this.coin;
    return { iChoose: coin.chooser === i, choice: coin.choice, result: coin.result,
      won: coin.winner === null ? null : coin.winner === i };
  }
}

module.exports = { CONFIG, Match, Side };
