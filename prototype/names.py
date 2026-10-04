"""Yazılan metni veri setindeki bir kayda bağlar: normalleştirme, alternatif adlar ve yazım düzeltme."""
import unicodedata

# Kaynaktan gelen kısa alternatif adlar (ISO kodları vb.) yanlış eşleşmeye yol açtığı için
# yalnızca bu kısa adlar kabul edilir.
SHORT_ALIASES = {"abd", "bae", "uk", "usa"}
MIN_ALIAS_LEN = 4
MIN_FUZZY_LEN = 4
MAX_CANDIDATES = 5


def normalize(text):
    """Büyük/küçük harf, Türkçe karakter, aksan, boşluk ve noktalama farklarını yok sayar."""
    text = text.replace("İ", "i").lower().replace("ı", "i")
    text = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in text if ch.isascii() and ch.isalnum())


def edit_distance(a, b, limit):
    """Harf değişimi, ekleme, silme ve komşu harf yer değiştirmesi sayısı; limit aşılırsa limit + 1."""
    if abs(len(a) - len(b)) > limit:
        return limit + 1
    prev2, prev = None, list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cost = 0 if ca == cb else 1
            best = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
            if prev2 is not None and i > 1 and j > 1 and ca == b[j - 2] and a[i - 2] == cb:
                best = min(best, prev2[j - 2] + 1)
            cur.append(best)
        if min(cur) > limit:
            return limit + 1
        prev2, prev = prev, cur
    return prev[-1]


def allowed_distance(length):
    # Kısa adlarda iki harflik fark başka bir ülkeye götürür (afrika -> amerika, tayvan -> tayland).
    if length <= 6:
        return 1
    if length <= 11:
        return 2
    return 3


class Resolver:
    def __init__(self, entities):
        self.names = {e["id"]: e["name"] for e in entities}
        self.primary = {}  # normalleştirilmiş asıl ad -> kayıtlar
        self.aliases = {}  # normalleştirilmiş alternatif ad -> kayıtlar
        for e in entities:
            for name in (e["name"], e.get("en", "")):
                if name:
                    self.primary.setdefault(normalize(name), set()).add(e["id"])
        for e in entities:
            for alias in e.get("aliases", []):
                key = normalize(alias)
                if len(key) >= MIN_ALIAS_LEN or key in SHORT_ALIASES:
                    self.aliases.setdefault(key, set()).add(e["id"])
        self.keys = [(key, ids) for table in (self.primary, self.aliases) for key, ids in table.items()]
        self.cache = {}

    def resolve(self, text):
        """Dönüş: {"status": "empty" | "ok" | "ambiguous" | "unknown", "id", "candidates"}"""
        key = normalize(text)
        if key not in self.cache:
            if len(self.cache) > 5000:
                self.cache.clear()
            self.cache[key] = self._resolve(key)
        return self.cache[key]

    def _resolve(self, key):
        if not key:
            return {"status": "empty", "id": None, "candidates": []}
        if len(self.primary.get(key, ())) == 1:
            return self._ok(self.primary[key])
        exact = self.primary.get(key, set()) | self.aliases.get(key, set())
        if exact:
            return self._unique_or_ambiguous(key, exact)

        if len(key) >= MIN_FUZZY_LEN:
            limit = allowed_distance(len(key))
            best = {}
            for other, ids in self.keys:
                # İlk harf tutmalı: yazım hataları nadiren ilk harftedir ve bu, kuzey/güney gibi
                # farklı kayıtların birbirine düzeltilmesini önler.
                if len(other) < MIN_FUZZY_LEN or other[0] != key[0]:
                    continue
                dist = edit_distance(key, other, limit)
                if dist <= limit:
                    for entity_id in ids:
                        best[entity_id] = min(dist, best.get(entity_id, dist))
            if best:
                closest = min(best.values())
                winners = {entity_id for entity_id, dist in best.items() if dist == closest}
                return self._unique_or_ambiguous(key, winners)

        return {"status": "unknown", "id": None, "candidates": self._suggest(key)}

    def _unique_or_ambiguous(self, key, ids):
        """Asıl ad dışındaki eşleşmeler, metin başka bir kaydın adının da başıysa belirsiz sayılır
        (kongo, kore, dominik gibi); böylece oyuncunun kastetmediği kayıt sessizce seçilmez."""
        ids = set(ids)
        for other, other_ids in self.keys:
            if other.startswith(key):
                ids |= other_ids
        return self._ok(ids) if len(ids) == 1 else self._ambiguous(ids)

    def _ok(self, ids):
        return {"status": "ok", "id": next(iter(ids)), "candidates": []}

    def _ambiguous(self, ids):
        return {"status": "ambiguous", "id": None, "candidates": sorted(ids, key=self.names.get)[:MAX_CANDIDATES]}

    def _suggest(self, key):
        """Tanınmayan metin için aday listesi: önce adın başında, sonra içinde geçenler."""
        if len(key) < 2:
            return []
        starts, contains = [], []
        for other, ids in self.keys:
            if other.startswith(key):
                starts.extend(ids)
            elif len(key) >= 3 and key in other:
                contains.extend(ids)
        seen = []
        for entity_id in sorted(starts, key=self.names.get) + sorted(contains, key=self.names.get):
            if entity_id not in seen:
                seen.append(entity_id)
        return seen[:MAX_CANDIDATES]
