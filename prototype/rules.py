"""Oyun verisi, soru üretimi, cevap değerlendirme ve puanlama."""
import json
import math
from pathlib import Path

from names import Resolver

DATA_FILE = Path(__file__).resolve().parent / "data" / "countries.json"

# Soru şablonları. "min" dolgu cevapları engelleyen alt sınırdır.
METRICS = {
    "population": {
        "min": 1_000_000,
        "unit": "",
        "text": "Nüfuslarının toplamı {target} olan {n} ülke yaz.",
        "min_text": "Her ülkenin nüfusu en az 1 milyon olmalı.",
    },
    "area": {
        "min": 10_000,
        "unit": " km²",
        "text": "Yüzölçümlerinin toplamı {target} olan {n} ülke yaz.",
        "min_text": "Her ülkenin yüzölçümü en az 10 bin km² olmalı.",
    },
    "gdp": {
        "min": 10_000_000_000,
        "unit": " dolar",
        "text": "Millî gelirlerinin (GSYH) toplamı {target} olan {n} ülke yaz.",
        "min_text": "Her ülkenin millî geliri en az 10 milyar dolar olmalı.",
    },
}
ANSWER_COUNTS = [2, 3, 3, 4, 4, 5, 5]  # çoklu cevaplar öncelikli

SCALES = ((1e12, "trilyon"), (1e9, "milyar"), (1e6, "milyon"), (1e3, "bin"))


def format_number(value, unit="", digits=3):
    """85878556 -> "85,9 milyon" """
    if value is None:
        return "—"
    size = abs(value)
    for limit, word in SCALES:
        if size >= limit:
            scaled = value / limit
            decimals = max(0, digits - 1 - int(math.floor(math.log10(abs(scaled)))))
            text = f"{scaled:.{decimals}f}"
            if "." in text:
                text = text.rstrip("0").rstrip(".")
            return f"{text.replace('.', ',')} {word}{unit}"
    text = f"{value:.1f}".rstrip("0").rstrip(".") if size < 10 else str(round(value))
    return f"{text.replace('.', ',')}{unit}"


def round_significant(value, digits=2):
    if value == 0:
        return 0
    factor = 10 ** (digits - 1 - int(math.floor(math.log10(abs(value)))))
    return round(value * factor) / factor


def score_question(a, b):
    """Soru puanı: yakın olan 1, eşit uzaklık 0,5; geçersiz liste 0, geçerli rakibi 1."""
    if not a["valid"] and not b["valid"]:
        return 0, 0
    if not b["valid"]:
        return 1, 0
    if not a["valid"]:
        return 0, 1
    if a["distance"] < b["distance"]:
        return 1, 0
    if b["distance"] < a["distance"]:
        return 0, 1
    return 0.5, 0.5


class GameData:
    def __init__(self, path=DATA_FILE):
        self.entities = json.loads(Path(path).read_text(encoding="utf-8"))["countries"]
        self.by_id = {e["id"]: e for e in self.entities}
        self.resolver = Resolver(self.entities)

    def eligible(self, metric):
        minimum = METRICS[metric]["min"]
        return [e for e in self.entities if e["values"].get(metric, 0) >= minimum]

    def make_question(self, rng, avoid_metric=None):
        metric = rng.choice([m for m in METRICS if m != avoid_metric])
        n = rng.choice(ANSWER_COUNTS)
        spec = METRICS[metric]
        # Hedef, kurala uyan rastgele bir listenin toplamından türetilir; böylece ulaşılabilir kalır.
        sample = rng.sample(self.eligible(metric), n)
        target = round_significant(sum(e["values"][metric] for e in sample))
        return {
            "metric": metric,
            "n": n,
            "target": target,
            "text": spec["text"].format(target=format_number(target, spec["unit"]), n=n),
            "min_text": spec["min_text"],
        }

    def evaluate(self, question, texts):
        """Bir cevap listesini değerlendirir. Tek bir geçersiz cevap listeyi geçersiz kılar."""
        metric = question["metric"]
        spec = METRICS[metric]
        answers, used = [], set()
        for text in texts:
            found = self.resolver.resolve(text)
            answer = {"text": text.strip(), "status": found["status"], "id": found["id"], "name": None, "value": None,
                      "candidates": [self.by_id[c]["name"] for c in found["candidates"]]}
            if found["status"] == "ok":
                entity = self.by_id[found["id"]]
                answer["name"] = entity["name"]
                answer["value"] = entity["values"].get(metric)
                if entity["id"] in used:
                    answer["status"] = "duplicate"
                elif answer["value"] is None or answer["value"] < spec["min"]:
                    answer["status"] = "below_min"
                used.add(entity["id"])
            answers.append(answer)

        valid = len(answers) == question["n"] and all(a["status"] == "ok" for a in answers)
        total = sum(a["value"] for a in answers) if valid else None
        return {
            "answers": answers,
            "valid": valid,
            "total": total,
            "distance": abs(total - question["target"]) if valid else None,
        }

    def bot_answers(self, question, rng):
        """Bot, rastgele birkaç liste dener ve hedefe en yakın olanı yazar; deneme sayısı becerisidir."""
        pool = self.eligible(question["metric"])
        best = None
        for _ in range(rng.choice([1, 2, 3, 5, 8, 15, 30])):
            pick = rng.sample(pool, question["n"])
            distance = abs(sum(e["values"][question["metric"]] for e in pick) - question["target"])
            if best is None or distance < best[0]:
                best = (distance, pick)
        return [e["name"] for e in best[1]]
