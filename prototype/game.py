"""Maç durumu. Süre, puan ve veri değerleri yalnızca burada, sunucu tarafında tutulur."""
import os

from rules import METRICS, format_number, score_question


def _ms(name, default):
    return int(os.environ.get(name, default))


QUESTION_MS = _ms("QUESTION_MS", 120_000)
REVEAL_MS = _ms("REVEAL_MS", 30_000)
COIN_MS = _ms("COIN_MS", 20_000)
COIN_SHOW_MS = _ms("COIN_SHOW_MS", 6_000)
REGULAR_QUESTIONS = 5
MAX_OVERTIME = 10


class Side:
    def __init__(self, name, kind="human", script=None):
        self.name = name
        self.kind = kind  # human | bot | ghost (önceki bir oyuncunun kaydı)
        self.script = script or []  # kayıt: soru başına cevaplar ve süreler
        self.texts = []
        self.locked = False
        self.lock_ms = None
        self.lock_at = None
        self.ready = False
        self.ready_ms = None
        self.ready_after = None
        self.rounds = []  # bu maçın kaydı


class Match:
    def __init__(self, data, rng, sides, now, preset_questions=None, on_finish=None):
        self.data = data
        self.rng = rng
        self.sides = sides
        self.preset = preset_questions or []
        self.on_finish = on_finish
        self.questions = []
        self.number = 0
        self.score = [0, 0]
        self.phase = None
        self.result = None
        self.coin = None
        self.winner = None
        self.reason = None
        self.finished_at = None
        self._start_question(now)

    @property
    def question(self):
        return self.questions[-1]

    # --- oyuncu işlemleri

    def set_answers(self, i, texts):
        side = self.sides[i]
        if self.phase != "question" or side.locked:
            return
        n = self.question["n"]
        side.texts = [str(t)[:60] for t in texts[:n]] + [""] * max(0, n - len(texts))

    def lock(self, i, now):
        side = self.sides[i]
        if self.phase == "question" and not side.locked:
            side.locked = True
            side.lock_ms = now - self.started
            self.tick(now)

    def ready(self, i, now):
        side = self.sides[i]
        if self.phase == "reveal" and not side.ready:
            side.ready = True
            side.ready_ms = now - self.started
            self.tick(now)

    def choose_coin(self, i, choice, now):
        coin = self.coin
        if self.phase != "coin" or coin["choice"] or i != coin["chooser"] or choice not in ("yazi", "tura"):
            return
        coin["choice"] = choice
        coin["result"] = self.rng.choice(["yazi", "tura"])
        coin["winner"] = i if coin["result"] == choice else 1 - i
        coin["until"] = now + COIN_SHOW_MS

    def forfeit(self, i, now):
        if self.phase != "finished":
            self._finish(1 - i, "forfeit", now)

    # --- zamanla ilerleyen adımlar

    def tick(self, now):
        while self._step(now):
            pass

    def _step(self, now):
        if self.phase == "question":
            for side in self.sides:
                if side.kind != "human" and not side.locked and now >= side.lock_at:
                    side.locked = True
                    side.lock_ms = side.lock_at - self.started
            if all(s.locked for s in self.sides) or now >= self.deadline:
                self._reveal(now)
                return True
        elif self.phase == "reveal":
            for side in self.sides:
                if side.kind != "human" and not side.ready and now >= self.started + side.ready_after:
                    side.ready = True
                    side.ready_ms = side.ready_after
            if all(s.ready for s in self.sides) or now >= self.deadline:
                self._advance(now)
                return True
        elif self.phase == "coin":
            coin = self.coin
            if not coin["choice"]:
                chooser = self.sides[coin["chooser"]]
                if now >= self.deadline or (chooser.kind != "human" and now >= coin["auto_at"]):
                    self.choose_coin(coin["chooser"], self.rng.choice(["yazi", "tura"]), now)
                    return True
            elif now >= coin["until"]:
                self._finish(coin["winner"], "coin", now)
                return True
        return False

    def _start_question(self, now):
        index = self.number
        self.number += 1
        if index < len(self.preset):
            question = self.preset[index]
        else:
            last_metric = self.questions[-1]["metric"] if self.questions else None
            question = self.data.make_question(self.rng, avoid_metric=last_metric)
        self.questions.append(question)
        self.phase = "question"
        self.started = now
        self.deadline = now + QUESTION_MS
        for side in self.sides:
            side.texts = [""] * question["n"]
            side.locked = side.ready = False
            side.lock_ms = side.ready_ms = None
            if side.kind != "human":
                self._plan(side, index, question)

    def _plan(self, side, index, question):
        """Kayıt veya bot tarafının cevaplarını ve zamanlamasını belirler."""
        if index < len(side.script):
            # Kilitleme ve geçiş zamanları kayıttaki sürelerden alınır.
            recorded = side.script[index]
            side.texts = (list(recorded["answers"]) + [""] * question["n"])[: question["n"]]
            side.lock_at = self.started + recorded["lock_ms"]
            side.ready_after = recorded["ready_ms"]
        else:
            side.texts = self.data.bot_answers(question, self.rng)
            side.lock_at = self.started + int(QUESTION_MS * self.rng.uniform(0.15, 0.6))
            side.ready_after = int(REVEAL_MS * self.rng.uniform(0.15, 0.6))

    def _reveal(self, now):
        lists = [self.data.evaluate(self.question, side.texts) for side in self.sides]
        points = score_question(lists[0], lists[1])
        for i, side in enumerate(self.sides):
            self.score[i] += points[i]
            # Süre dolduğunda kilitlenmemiş cevaplar olduğu gibi kilitlenir.
            if not side.locked:
                side.locked = True
                side.lock_ms = QUESTION_MS
            side.rounds.append({"answers": list(side.texts), "lock_ms": side.lock_ms, "ready_ms": REVEAL_MS})
        self.result = {"lists": lists, "points": points}
        self.phase = "reveal"
        self.started = now
        self.deadline = now + REVEAL_MS

    def _next_step(self):
        if self.number < REGULAR_QUESTIONS:
            return "question"
        if self.score[0] != self.score[1]:
            return "finish"
        if self.number < REGULAR_QUESTIONS + MAX_OVERTIME:
            return "overtime"
        return "coin"

    def _advance(self, now):
        for side in self.sides:
            if side.ready_ms is not None:
                side.rounds[-1]["ready_ms"] = side.ready_ms
        step = self._next_step()
        if step == "finish":
            self._finish(0 if self.score[0] > self.score[1] else 1, "score", now)
        elif step == "coin":
            # Yazı veya turayı seçme hakkı rastgele bir oyuncuya verilir.
            self.phase = "coin"
            self.deadline = now + COIN_MS
            self.coin = {"chooser": self.rng.randrange(2), "choice": None, "result": None, "winner": None,
                         "auto_at": now + self.rng.randint(2000, 4000), "until": None}
        else:
            self._start_question(now)

    def _finish(self, winner, reason, now):
        self.phase = "finished"
        self.winner = winner
        self.reason = reason
        self.finished_at = now
        if self.on_finish:
            self.on_finish(self)

    # --- oyuncuya gösterilen durum

    def view(self, i, now):
        me, opp = self.sides[i], self.sides[1 - i]
        base = {
            "phase": self.phase,
            "number": self.number,
            "regular": REGULAR_QUESTIONS,
            "maxOvertime": MAX_OVERTIME,
            "overtime": self.number > REGULAR_QUESTIONS,
            "score": {"me": self.score[i], "opp": self.score[1 - i]},
            "meName": me.name,
            "oppName": opp.name,
        }
        if self.phase == "question":
            draft = self.data.evaluate(self.question, me.texts)
            base.update({
                "question": {"text": self.question["text"], "minText": self.question["min_text"], "n": self.question["n"]},
                "remainingMs": max(0, self.deadline - now),
                "totalMs": QUESTION_MS,
                "locked": me.locked,
                "oppLocked": opp.locked,
                "listValid": draft["valid"],
                "slots": [{"text": a["text"], "status": a["status"], "name": a["name"], "candidates": a["candidates"]}
                          for a in draft["answers"]],
            })
        elif self.phase == "reveal":
            unit = METRICS[self.question["metric"]]["unit"]
            base.update({
                "question": {"text": self.question["text"], "minText": self.question["min_text"],
                             "target": format_number(self.question["target"], unit)},
                "remainingMs": max(0, self.deadline - now),
                "totalMs": REVEAL_MS,
                "next": self._next_step(),
                "me": self._side_result(i, unit),
                "opp": self._side_result(1 - i, unit),
            })
        elif self.phase == "coin":
            base.update({"coin": self._coin_view(i), "remainingMs": max(0, self.deadline - now), "totalMs": COIN_MS})
        elif self.phase == "finished":
            base.update({"won": self.winner == i, "reason": self.reason,
                         "coin": self._coin_view(i) if self.coin else None})
        return base

    def _side_result(self, i, unit):
        result = self.result["lists"][i]
        return {
            "valid": result["valid"],
            "total": format_number(result["total"], unit),
            "distance": format_number(result["distance"], unit),
            "points": self.result["points"][i],
            "ready": self.sides[i].ready,
            "answers": [{"text": a["text"], "name": a["name"], "status": a["status"],
                         "value": format_number(a["value"], unit)} for a in result["answers"]],
        }

    def _coin_view(self, i):
        coin = self.coin
        return {"iChoose": coin["chooser"] == i, "choice": coin["choice"], "result": coin["result"],
                "won": None if coin["winner"] is None else coin["winner"] == i}
