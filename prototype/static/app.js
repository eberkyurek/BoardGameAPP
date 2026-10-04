// Tarayıcı arayüzü. Oyunun durumu sunucudadır; burası yalnızca gösterir ve oyuncunun işlemlerini iletir.
const app = document.getElementById('app');
const POLL_MS = 700;
const SEND_DELAY_MS = 300;

let token = new URLSearchParams(location.hash.slice(1)).get('token') || localStorage.getItem('tahmin_token');
let state = null;
let viewKey = null;
let deadline = 0;
let sendTimer = null;
let polling = false;

const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const points = (value) => String(value).replace('.', ',');
const $ = (selector) => app.querySelector(selector);

async function request(path, body) {
  const res = await fetch(path, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : undefined);
  return { ok: res.ok, status: res.status, data: await res.json() };
}

async function act(type, extra = {}) {
  const res = await request('/api/action', { token, type, ...extra });
  if (res.ok) apply(res.data);
  return res;
}

function setToken(value) {
  token = value;
  if (value) localStorage.setItem('tahmin_token', value);
  else localStorage.removeItem('tahmin_token');
}

async function poll() {
  if (!token || polling) return;
  polling = true;
  try {
    const res = await request(`/api/state?token=${encodeURIComponent(token)}`);
    if (res.ok) apply(res.data);
    else if (res.status === 404) { setToken(null); showHome(); }
  } catch (err) {
    // Bağlantı kesildiyse bir sonraki denemede yeniden sorulur.
  } finally {
    polling = false;
  }
}

function keyOf(s) {
  if (s.phase === 'question' || s.phase === 'reveal') return `${s.phase}:${s.number}`;
  if (s.phase === 'coin') return `coin:${s.coin.choice ? 'result' : 'choose'}`;
  return s.phase;
}

function apply(next) {
  if (next.phase === 'left') { setToken(null); showHome(); return; }
  state = next;
  if (next.remainingMs != null) deadline = performance.now() + next.remainingMs;
  const key = keyOf(next);
  if (key !== viewKey) {
    viewKey = key;
    BUILD[next.phase](next);
  }
  if (UPDATE[next.phase]) UPDATE[next.phase](next);
  tickClock();
}

// --- ortak parçalar

function scorebar(s) {
  return `<div class="scorebar">
    <div class="player"><span class="name">${esc(s.meName)}</span><span class="pts" id="score-me"></span></div>
    <div class="player opp"><span class="name">${esc(s.oppName)}</span><span class="pts" id="score-opp"></span></div>
  </div>`;
}

function roundLabel(s) {
  return s.overtime
    ? `<span class="badge pink">Uzatma ${s.number - s.regular} / ${s.maxOvertime}</span>`
    : `<span class="badge">Soru ${s.number} / ${s.regular}</span>`;
}

function updateScore(s) {
  $('#score-me').textContent = points(s.score.me);
  $('#score-opp').textContent = points(s.score.opp);
}

function tickClock() {
  if (!state || state.remainingMs == null) return;
  const left = Math.max(0, deadline - performance.now());
  const seconds = Math.ceil(left / 1000);
  const timer = $('.timer');
  if (timer) {
    timer.querySelector('.clock').textContent = seconds;
    timer.querySelector('.fill').style.width = `${(left / state.totalMs) * 100}%`;
    timer.classList.toggle('low', seconds <= 15);
  }
  const countdown = $('#countdown');
  if (countdown) countdown.textContent = seconds;
}

// --- ana sayfa ve bekleme

function showHome(error = '') {
  state = null;
  viewKey = 'home';
  app.innerHTML = `
    <h1>Tahmin Oyunu</h1>
    <p>Hedefe en yakın toplamı kim yazacak?</p>
    <div class="card stack">
      <div>
        <label for="name">Takma adın</label>
        <input id="name" maxlength="16" autocomplete="off" placeholder="Misafir">
      </div>
      <button id="quick">Hızlı maç</button>
      <div class="divider">ya da arkadaşınla oyna</div>
      <button id="create" class="alt">Oda kur</button>
      <div class="row">
        <input id="code" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="Oda kodu" aria-label="Oda kodu">
        <button id="join" class="plain">Katıl</button>
      </div>
      <div class="error" id="error" role="alert">${esc(error)}</div>
    </div>
    <p class="muted center">5 soru · soru başına 120 saniye · hesap gerekmez</p>`;
  $('#name').value = localStorage.getItem('tahmin_name') || '';
  const join = async (mode) => {
    const name = $('#name').value.trim();
    localStorage.setItem('tahmin_name', name);
    try {
      const res = await request('/api/join', { name, mode, code: $('#code').value });
      if (!res.ok) { $('#error').textContent = res.data.error; return; }
      setToken(res.data.token);
      poll();
    } catch (err) {
      $('#error').textContent = 'Sunucuya ulaşılamadı.';
    }
  };
  $('#quick').onclick = () => join('quick');
  $('#create').onclick = () => join('create');
  $('#join').onclick = () => join('join');
  $('#code').onkeydown = (event) => { if (event.key === 'Enter') join('join'); };
}

const BUILD = {};
const UPDATE = {};

BUILD.waiting = (s) => {
  app.innerHTML = s.mode === 'create'
    ? `<h1>Oda hazır</h1>
       <div class="card sand center">
         <p>Oda kodun</p>
         <div class="big">${esc(s.code)}</div>
         <p>Arkadaşın ana sayfada bu kodu yazıp <b>Katıl</b>'a bassın. Katıldığında maç başlar.</p>
       </div>
       <button id="cancel" class="plain">Vazgeç</button>`
    : `<h1>Rakip aranıyor…</h1>
       <div class="card sand center"><div class="coin spin">?</div><p>Birazdan başlıyoruz.</p></div>
       <button id="cancel" class="plain">Vazgeç</button>`;
  $('#cancel').onclick = () => act('leave');
};

// --- soru

const NOTES = {
  empty: () => '',
  ok: (slot) => `✓ ${esc(slot.name)}`,
  unknown: (slot) => (slot.candidates.length ? 'Tanınmadı. Bunu mu demek istedin?' : 'Tanınmadı; bu hâliyle geçersiz sayılır.'),
  ambiguous: () => 'Birden fazla eşleşme var, birini seç:',
  below_min: (slot) => `${esc(slot.name)} alt sınırın altında.`,
  duplicate: (slot) => `${esc(slot.name)} zaten listende.`,
};

function currentTexts() {
  return [...app.querySelectorAll('.slot input')].map((input) => input.value);
}

function sendAnswers() {
  clearTimeout(sendTimer);
  sendTimer = setTimeout(() => act('answers', { texts: currentTexts() }), SEND_DELAY_MS);
}

BUILD.question = (s) => {
  const slots = s.slots.map((slot, i) => `
    <div class="slot" data-i="${i}">
      <input value="${esc(slot.text)}" autocomplete="off" autocapitalize="words" spellcheck="false"
             placeholder="${i + 1}. ülke" aria-label="${i + 1}. cevap">
      <div class="note" aria-live="polite"></div>
      <div class="chips"></div>
    </div>`).join('');
  app.innerHTML = `
    ${scorebar(s)}
    ${roundLabel(s)}
    <div class="timer"><div class="track"><div class="fill"></div></div><span class="clock"></span></div>
    <div class="card">
      <h2>${esc(s.question.text)}</h2>
      <p class="muted">${esc(s.question.minText)}</p>
      ${slots}
    </div>
    <button id="lock">Cevabı kilitle</button>
    <p class="muted center" id="status" style="margin-top:14px"></p>`;
  app.querySelectorAll('.slot input').forEach((input) => {
    input.oninput = sendAnswers;
  });
  app.querySelectorAll('.chips').forEach((chips) => {
    chips.onclick = (event) => {
      if (event.target.tagName !== 'BUTTON') return;
      chips.parentElement.querySelector('input').value = event.target.textContent;
      clearTimeout(sendTimer);
      act('answers', { texts: currentTexts() });
    };
  });
  $('#lock').onclick = () => {
    clearTimeout(sendTimer);
    act('lock', { texts: currentTexts() });
  };
  if (!s.locked) app.querySelector('.slot input').focus();
};

UPDATE.question = (s) => {
  updateScore(s);
  const texts = currentTexts();
  s.slots.forEach((slot, i) => {
    const el = app.querySelector(`.slot[data-i="${i}"]`);
    el.querySelector('input').disabled = s.locked;
    // Sunucudan gelen değerlendirme eski bir metne aitse gösterme; yenisi yolda.
    if (!s.locked && slot.text !== texts[i].trim()) return;
    const signature = JSON.stringify([slot.status, slot.name, slot.candidates]);
    if (el.dataset.signature === signature) return;
    el.dataset.signature = signature;
    el.classList.toggle('ok', slot.status === 'ok');
    el.classList.toggle('bad', !['ok', 'empty'].includes(slot.status));
    el.querySelector('.note').innerHTML = NOTES[slot.status](slot);
    el.querySelector('.chips').innerHTML = s.locked ? '' : slot.candidates.map((name) => `<button type="button">${esc(name)}</button>`).join('');
  });
  const lock = $('#lock');
  lock.disabled = s.locked;
  lock.textContent = s.locked ? 'Kilitlendi' : 'Cevabı kilitle';
  let status = '';
  if (s.locked) status = 'Rakibinin cevabı bekleniyor…';
  else if (s.oppLocked) status = 'Rakibin cevaplarını kilitledi.';
  else if (!s.listValid) status = 'Bütün kutular geçerli olmalı; yoksa bu sorudan puan alamazsın.';
  $('#status').textContent = status;
};

// --- sonuç

const REASONS = { empty: 'boş bırakıldı', unknown: 'tanınmadı', ambiguous: 'belirsiz', below_min: 'alt sınırın altında', duplicate: 'tekrar' };
const NEXT_LABELS = { question: 'Sıradaki soru', overtime: 'Uzatma sorusuna geç', coin: 'Yazı turaya geç', finish: 'Sonucu gör' };

function resultColumn(side, name, cls) {
  const items = side.answers.map((a) => (a.status === 'ok'
    ? `<li>${esc(a.name)}<span class="v">${esc(a.value)}</span></li>`
    : `<li class="bad">${esc(a.name || a.text || '—')}<span class="v">${REASONS[a.status]}</span></li>`)).join('');
  const sum = side.valid
    ? `<div class="sum">Toplam<b>${esc(side.total)}</b></div><div class="sum">Hedeften uzaklık<b>${esc(side.distance)}</b></div>`
    : '<div class="sum"><b>Geçersiz liste</b></div>';
  return `<div class="result ${cls}"><h3>${esc(name)}</h3><ul>${items}</ul>${sum}
    <div class="points">${side.points ? '+' : ''}${points(side.points)} puan</div></div>`;
}

BUILD.reveal = (s) => {
  app.innerHTML = `
    ${scorebar(s)}
    ${roundLabel(s)}
    <div class="card sand center" style="margin-top:12px">
      <p class="muted">${esc(s.question.text)}</p>
      <div>Hedef</div>
      <div class="target">${esc(s.question.target)}</div>
    </div>
    <div class="columns">
      ${resultColumn(s.me, s.meName, '')}
      ${resultColumn(s.opp, s.oppName, 'opp')}
    </div>
    <button id="ready" style="margin-top:20px"></button>
    <p class="muted center" id="status" style="margin-top:14px"></p>`;
  $('#ready').onclick = () => act('ready');
};

UPDATE.reveal = (s) => {
  updateScore(s);
  const ready = $('#ready');
  ready.disabled = s.me.ready;
  ready.textContent = s.me.ready ? 'Rakip bekleniyor…' : NEXT_LABELS[s.next];
  $('#status').innerHTML = `${s.opp.ready && !s.me.ready ? 'Rakibin hazır. ' : ''}<span id="countdown"></span> saniye sonra otomatik geçilecek.`;
};

// --- yazı tura ve maç sonu

const COIN_NAMES = { yazi: 'Yazı', tura: 'Tura' };

BUILD.coin = (s) => {
  const coin = s.coin;
  let body;
  if (coin.choice) {
    body = `<div class="coin">${COIN_NAMES[coin.result].toUpperCase()}</div>
      <p>${coin.iChoose ? 'Seçimin' : 'Rakibinin seçimi'}: <b>${COIN_NAMES[coin.choice]}</b></p>
      <h2>${coin.won ? 'Yazı turayı kazandın!' : 'Yazı turayı rakibin kazandı.'}</h2>`;
  } else if (coin.iChoose) {
    body = `<div class="coin">?</div>
      <p>Seçme hakkı sana çıktı. <span id="countdown"></span> saniyen var.</p>
      <div class="row"><button data-choice="yazi">Yazı</button><button data-choice="tura" class="alt">Tura</button></div>`;
  } else {
    body = '<div class="coin spin">?</div><p>Seçme hakkı rakibine çıktı. Seçmesi bekleniyor…</p>';
  }
  app.innerHTML = `
    ${scorebar(s)}
    <h1>Yazı tura</h1>
    <p>${s.maxOvertime} uzatma sorusu da beraberliği bozamadı.</p>
    <div class="card sand center">${body}</div>`;
  app.querySelectorAll('[data-choice]').forEach((button) => {
    button.onclick = () => act('coin', { choice: button.dataset.choice });
  });
};
UPDATE.coin = updateScore;

BUILD.finished = (s) => {
  const reasons = {
    score: s.won ? 'Hedeflere daha yakındın.' : 'Rakibin hedeflere daha yakındı.',
    coin: `Beraberliği yazı tura bozdu: ${s.coin ? COIN_NAMES[s.coin.result] : ''} geldi.`,
    forfeit: s.won ? 'Rakibin oyundan ayrıldı.' : 'Oyundan ayrıldın.',
  };
  app.innerHTML = `
    <h1>${s.won ? 'Kazandın! 🎉' : 'Kaybettin'}</h1>
    <p>${reasons[s.reason]}</p>
    ${scorebar(s)}
    <div class="card ${s.won ? 'sand' : 'blush'} center">
      <p>Maç ${s.number} soru sürdü.</p>
      <button id="home">Ana sayfa</button>
    </div>`;
  $('#home').onclick = () => act('leave');
};
UPDATE.finished = updateScore;

setInterval(poll, POLL_MS);
setInterval(tickClock, 200);
if (token) poll(); else showHome();
