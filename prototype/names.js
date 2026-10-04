// Yazılan metni veri setindeki bir kayda bağlar: normalleştirme, alternatif adlar ve yazım düzeltme.

// Kaynaktan gelen kısa alternatif adlar (ISO kodları vb.) yanlış eşleşmeye yol açtığı için
// yalnızca bu kısa adlar kabul edilir.
const SHORT_ALIASES = new Set(['abd', 'bae', 'uk', 'usa']);
const MIN_ALIAS_LEN = 4;
const MIN_FUZZY_LEN = 4;
const MAX_CANDIDATES = 5;

// Büyük/küçük harf, Türkçe karakter, aksan, boşluk ve noktalama farklarını yok sayar.
function normalize(text) {
  return String(text)
    .replace(/İ/g, 'i')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');
}

// Harf değişimi, ekleme, silme ve komşu harf yer değiştirmesi sayısı; limit aşılırsa limit + 1.
function editDistance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, prev2[j - 2] + 1);
      }
      cur.push(best);
    }
    if (Math.min(...cur) > limit) return limit + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

function allowedDistance(length) {
  // Kısa adlarda iki harflik fark başka bir ülkeye götürür (afrika -> amerika, tayvan -> tayland).
  if (length <= 6) return 1;
  if (length <= 11) return 2;
  return 3;
}

class Resolver {
  constructor(entities) {
    this.names = new Map(entities.map((e) => [e.id, e.name]));
    this.primary = new Map(); // normalleştirilmiş asıl ad -> kayıtlar
    this.aliases = new Map(); // normalleştirilmiş alternatif ad -> kayıtlar
    const add = (table, key, id) => {
      if (!table.has(key)) table.set(key, new Set());
      table.get(key).add(id);
    };
    for (const e of entities) {
      for (const name of [e.name, e.en]) {
        if (name) add(this.primary, normalize(name), e.id);
      }
    }
    for (const e of entities) {
      for (const alias of e.aliases || []) {
        const key = normalize(alias);
        if (key.length >= MIN_ALIAS_LEN || SHORT_ALIASES.has(key)) add(this.aliases, key, e.id);
      }
    }
    this.keys = [...this.primary, ...this.aliases];
    this.cache = new Map();
  }

  // Dönüş: { status: "empty" | "ok" | "ambiguous" | "unknown", id, candidates }
  resolve(text) {
    const key = normalize(text);
    if (!this.cache.has(key)) {
      if (this.cache.size > 5000) this.cache.clear();
      this.cache.set(key, this._resolve(key));
    }
    return this.cache.get(key);
  }

  _resolve(key) {
    if (!key) return { status: 'empty', id: null, candidates: [] };
    const primary = this.primary.get(key) || new Set();
    if (primary.size === 1) return this._ok(primary);
    const exact = new Set([...primary, ...(this.aliases.get(key) || [])]);
    if (exact.size) return this._uniqueOrAmbiguous(key, exact);

    if (key.length >= MIN_FUZZY_LEN) {
      const limit = allowedDistance(key.length);
      const best = new Map();
      for (const [other, ids] of this.keys) {
        // İlk harf tutmalı: yazım hataları nadiren ilk harftedir ve bu, kuzey/güney gibi
        // farklı kayıtların birbirine düzeltilmesini önler.
        if (other.length < MIN_FUZZY_LEN || other[0] !== key[0]) continue;
        const dist = editDistance(key, other, limit);
        if (dist <= limit) {
          for (const id of ids) best.set(id, Math.min(dist, best.has(id) ? best.get(id) : dist));
        }
      }
      if (best.size) {
        const closest = Math.min(...best.values());
        const winners = [...best].filter(([, dist]) => dist === closest).map(([id]) => id);
        return this._uniqueOrAmbiguous(key, winners);
      }
    }
    return { status: 'unknown', id: null, candidates: this._suggest(key) };
  }

  // Asıl ad dışındaki eşleşmeler, metin başka bir kaydın adının da başıysa belirsiz sayılır
  // (kongo, kore, dominik gibi); böylece oyuncunun kastetmediği kayıt sessizce seçilmez.
  _uniqueOrAmbiguous(key, found) {
    const ids = new Set(found);
    for (const [other, otherIds] of this.keys) {
      if (other.startsWith(key)) otherIds.forEach((id) => ids.add(id));
    }
    return ids.size === 1 ? this._ok(ids) : this._ambiguous(ids);
  }

  _ok(ids) {
    return { status: 'ok', id: [...ids][0], candidates: [] };
  }

  _ambiguous(ids) {
    return { status: 'ambiguous', id: null, candidates: this._byName(ids).slice(0, MAX_CANDIDATES) };
  }

  _byName(ids) {
    return [...ids].sort((a, b) => this.names.get(a).localeCompare(this.names.get(b), 'tr'));
  }

  // Tanınmayan metin için aday listesi: önce adın başında, sonra içinde geçenler.
  _suggest(key) {
    if (key.length < 2) return [];
    const starts = new Set();
    const contains = new Set();
    for (const [other, ids] of this.keys) {
      if (other.startsWith(key)) ids.forEach((id) => starts.add(id));
      else if (key.length >= 3 && other.includes(key)) ids.forEach((id) => contains.add(id));
    }
    const ordered = [...this._byName(starts), ...this._byName(contains)];
    return [...new Set(ordered)].slice(0, MAX_CANDIDATES);
  }
}

module.exports = { Resolver, normalize, editDistance };
