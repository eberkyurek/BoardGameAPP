"""Çalıştırma: python3 -m unittest discover -s tests"""
import json
import random
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import game  # noqa: E402
from game import Match, Side  # noqa: E402
from names import edit_distance, normalize  # noqa: E402
from rules import GameData, format_number, score_question  # noqa: E402
from server import Lobby  # noqa: E402

DATA = GameData()
POPULATION_2 = {"metric": "population", "n": 2, "target": 170_000_000, "text": "soru", "min_text": "alt sınır"}


def ids(texts, question=POPULATION_2):
    return [(a["id"], a["status"]) for a in DATA.evaluate(question, texts)["answers"]]


class NameTests(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(normalize(" TÜRKİYE "), "turkiye")
        self.assertEqual(normalize("Irak"), "irak")
        self.assertEqual(normalize("Güney  Kore!"), "guneykore")

    def test_edit_distance(self):
        self.assertEqual(edit_distance("almanya", "almnya", 2), 1)
        self.assertEqual(edit_distance("almanya", "alamnya", 2), 1)  # komşu harfler yer değiştirmiş
        self.assertEqual(edit_distance("almanya", "japonya", 2), 3)  # limit aşıldı

    def test_every_country_resolves_to_itself(self):
        for entity in DATA.entities:
            for text in (entity["name"], entity["name"].upper(), entity["en"]):
                found = DATA.resolver.resolve(text)
                self.assertEqual((found["status"], found["id"]), ("ok", entity["id"]), text)

    def test_spelling_and_aliases(self):
        cases = {"turkiye": "TUR", "Turkey": "TUR", "almnya": "DEU", "ABD": "USA", "ingiltere": "GBR",
                 "fransaa": "FRA", "brezlya": "BRA", "Güney Kore": "KOR", "hollanda": "NLD", "rusya": "RUS"}
        for text, expected in cases.items():
            found = DATA.resolver.resolve(text)
            self.assertEqual((found["status"], found["id"]), ("ok", expected), text)

    def test_unknown_text_is_not_matched(self):
        # Listede olmayan yerler, benzeyen bir ülkeye düzeltilmemeli.
        for text in ("abcxyz", "qq", "zzzzzzzz", "afrika", "tayvan", "Kuzey Kıbrıs", "kosova", "paris"):
            self.assertEqual(DATA.resolver.resolve(text)["status"], "unknown", text)
        self.assertEqual(DATA.resolver.resolve("   ")["status"], "empty")

    def test_similar_names_stay_apart(self):
        pairs = {"Nijer": "NER", "Nijerya": "NGA", "İran": "IRN", "Irak": "IRQ", "Avusturya": "AUT",
                 "Avustralya": "AUS", "Gine": "GIN", "Sudan": "SDN", "Güney Sudan": "SSD", "Dominika": "DMA"}
        for text, expected in pairs.items():
            self.assertEqual(DATA.resolver.resolve(text)["id"], expected, text)

    def test_ambiguous_text_offers_candidates(self):
        cases = {"kore": {"Güney Kore", "Kuzey Kore"}, "kongo": {"Kongo Cumhuriyeti", "Demokratik Kongo Cumhuriyeti"},
                 "dominik": {"Dominika", "Dominik Cumhuriyeti"}}
        for text, expected in cases.items():
            found = DATA.resolver.resolve(text)
            self.assertIn(found["status"], ("ambiguous", "unknown"), text)  # kendiliğinden seçilmez
            self.assertEqual({DATA.by_id[c]["name"] for c in found["candidates"]}, expected)


class RuleTests(unittest.TestCase):
    def test_score_question(self):
        valid = lambda d: {"valid": True, "distance": d}
        invalid = {"valid": False, "distance": None}
        self.assertEqual(score_question(valid(10), valid(20)), (1, 0))
        self.assertEqual(score_question(valid(20), valid(10)), (0, 1))
        self.assertEqual(score_question(valid(10), valid(10)), (0.5, 0.5))
        self.assertEqual(score_question(valid(999), invalid), (1, 0))
        self.assertEqual(score_question(invalid, invalid), (0, 0))

    def test_distance_counts_both_directions(self):
        target = DATA.by_id["TUR"]["values"]["population"] + DATA.by_id["DEU"]["values"]["population"]
        question = dict(POPULATION_2, target=target + 5)
        self.assertEqual(DATA.evaluate(question, ["Türkiye", "Almanya"])["distance"], 5)
        question = dict(POPULATION_2, target=target - 5)
        self.assertEqual(DATA.evaluate(question, ["Türkiye", "Almanya"])["distance"], 5)

    def test_invalid_lists(self):
        self.assertFalse(DATA.evaluate(POPULATION_2, ["Türkiye", ""])["valid"])
        self.assertEqual(ids(["Türkiye", "Turkey"])[1], ("TUR", "duplicate"))
        self.assertEqual(ids(["Türkiye", "Vatikan"])[1], ("VAT", "below_min"))
        self.assertEqual(ids(["Türkiye", "abcxyz"])[1], (None, "unknown"))
        self.assertIsNone(DATA.evaluate(POPULATION_2, ["Türkiye", "abcxyz"])["total"])

    def test_generated_questions_are_reachable(self):
        rng = random.Random(7)
        for _ in range(200):
            question = DATA.make_question(rng)
            self.assertGreaterEqual(len(DATA.eligible(question["metric"])), 100)
            answers = DATA.bot_answers(question, rng)
            self.assertTrue(DATA.evaluate(question, answers)["valid"], (question, answers))

    def test_format_number(self):
        self.assertEqual(format_number(85_878_556), "85,9 milyon")
        self.assertEqual(format_number(400_000_000), "400 milyon")
        self.assertEqual(format_number(1_200_000_000), "1,2 milyar")
        self.assertEqual(format_number(785_350, " km²"), "785 bin km²")
        self.assertEqual(format_number(882), "882")


def new_match(sides=None, preset=None, seed=1):
    finished = []
    sides = sides or [Side("A"), Side("B")]
    match = Match(DATA, random.Random(seed), sides, 0, preset or [POPULATION_2] * 20, on_finish=finished.append)
    return match, finished


class MatchTests(unittest.TestCase):
    def play(self, match, now, texts_a, texts_b):
        """Bir soruyu iki tarafın kilitlemesiyle bitirir ve sonraki adıma geçer."""
        match.set_answers(0, texts_a)
        match.set_answers(1, texts_b)
        match.lock(0, now + 1000)
        match.lock(1, now + 2000)
        self.assertEqual(match.phase, "reveal")
        match.ready(0, now + 3000)
        match.ready(1, now + 4000)
        return now + 4000

    def test_both_locked_reveals_without_waiting(self):
        match, _ = new_match()
        match.set_answers(0, ["Türkiye", "Almanya"])
        match.lock(0, 5000)
        self.assertEqual(match.phase, "question")
        self.assertNotIn("Türkiye", json.dumps(match.view(1, 5000), ensure_ascii=False))  # rakip cevabı göremez
        match.set_answers(0, ["Fransa", "İtalya"])  # kilitlendikten sonra değiştirilemez
        match.set_answers(1, ["Japonya", "Mısır"])
        match.lock(1, 9000)
        self.assertEqual(match.phase, "reveal")
        view = match.view(0, 9000)
        self.assertEqual([a["name"] for a in view["me"]["answers"]], ["Türkiye", "Almanya"])
        self.assertEqual(view["me"]["points"] + view["opp"]["points"], 1)

    def test_timeout_locks_current_answers(self):
        match, _ = new_match()
        match.set_answers(0, ["Türkiye", "Almanya"])
        match.tick(game.QUESTION_MS - 1)
        self.assertEqual(match.phase, "question")
        match.tick(game.QUESTION_MS)
        self.assertEqual(match.phase, "reveal")
        self.assertEqual(match.score, [1, 0])  # geçerli listeye karşı boş liste
        match.tick(game.QUESTION_MS + game.REVEAL_MS)
        self.assertEqual((match.phase, match.number), ("question", 2))

    def test_match_ends_after_five_questions(self):
        match, finished = new_match()
        now = 0
        for _ in range(5):
            self.assertEqual(match.phase, "question")
            now = self.play(match, now, ["Türkiye", "Almanya"], ["Türkiye", "abcxyz"])
        self.assertEqual((match.phase, match.reason, match.winner, match.score), ("finished", "score", 0, [5, 0]))
        self.assertEqual(len(finished), 1)
        self.assertTrue(match.view(0, now)["won"])
        self.assertFalse(match.view(1, now)["won"])

    def test_tie_goes_to_overtime_until_broken(self):
        match, _ = new_match()
        now = 0
        for _ in range(7):
            now = self.play(match, now, ["Türkiye", "Almanya"], ["Almanya", "Türkiye"])
        self.assertEqual((match.phase, match.number, match.score), ("question", 8, [3.5, 3.5]))
        self.assertTrue(match.view(0, now)["overtime"])
        now = self.play(match, now, ["Türkiye", "Almanya"], ["", ""])
        self.assertEqual((match.phase, match.winner), ("finished", 0))

    def test_coin_toss_after_ten_overtime_questions(self):
        match, _ = new_match()
        now = 0
        for _ in range(game.REGULAR_QUESTIONS + game.MAX_OVERTIME):
            self.assertEqual(match.phase, "question")
            now = self.play(match, now, ["", ""], ["", ""])
        self.assertEqual(match.phase, "coin")
        chooser = match.coin["chooser"]
        match.choose_coin(1 - chooser, "yazi", now)  # seçme hakkı olmayan oyuncu seçemez
        self.assertIsNone(match.coin["choice"])
        match.choose_coin(chooser, "yazi", now)
        expected = chooser if match.coin["result"] == "yazi" else 1 - chooser
        match.tick(now + game.COIN_SHOW_MS)
        self.assertEqual((match.phase, match.reason, match.winner), ("finished", "coin", expected))

    def test_recorded_rival_uses_recorded_times(self):
        script = [{"answers": ["Japonya", "Mısır"], "lock_ms": 30_000, "ready_ms": 4_000}]
        match, _ = new_match([Side("A"), Side("Kayıt", "ghost", script)])
        match.set_answers(0, ["Türkiye", "Almanya"])
        match.lock(0, 10_000)
        match.tick(29_999)
        self.assertEqual(match.phase, "question")
        match.tick(30_000)
        self.assertEqual(match.phase, "reveal")
        self.assertEqual([a["name"] for a in match.view(0, 30_000)["opp"]["answers"]], ["Japonya", "Mısır"])
        match.ready(0, 31_000)
        match.tick(33_999)
        self.assertEqual(match.phase, "reveal")
        match.tick(34_000)
        self.assertEqual((match.phase, match.number), ("question", 2))


class LobbyTests(unittest.TestCase):
    def setUp(self):
        self.file = Path(tempfile.mkdtemp()) / "recordings.json"
        self.lobby = Lobby(DATA, random.Random(3), self.file)

    def test_quick_match_pairs_online_players(self):
        a, _ = self.lobby.join("A", "quick", None, 0)
        self.assertEqual(self.lobby.state(a, 0)["phase"], "waiting")
        b, _ = self.lobby.join("B", "quick", None, 100)
        self.assertEqual(self.lobby.state(a, 100)["oppName"], "B")
        self.assertEqual(self.lobby.state(b, 100)["oppName"], "A")

    def test_room_code(self):
        host, _ = self.lobby.join("A", "create", None, 0)
        code = self.lobby.state(host, 0)["code"]
        self.assertEqual(self.lobby.join("B", "join", "YOK1", 0)[1], "Bu kodla açık bir oda bulunamadı.")
        guest, _ = self.lobby.join("B", "join", code.lower(), 0)
        self.assertEqual(self.lobby.state(guest, 0)["phase"], "question")
        self.assertEqual(self.lobby.state(host, 0)["oppName"], "B")

    def test_no_online_rival_falls_back_to_bot_then_recording(self):
        import server
        a, _ = self.lobby.join("A", "quick", None, 0)
        self.lobby.tick(server.MATCH_WAIT_MS)
        match = self.lobby.players[a]["match"]
        self.assertEqual(match.sides[1].kind, "bot")
        now = server.MATCH_WAIT_MS
        while match.phase != "finished":
            now += 1000
            state = self.lobby.state(a, now)
            if state["phase"] == "question" and not state["locked"]:
                texts = ["Türkiye", "Almanya", "Fransa", "Japonya", "Brezilya"][: state["question"]["n"]]
                self.lobby.action(a, {"type": "lock", "texts": texts}, now)
            self.lobby.tick(now)
        self.assertEqual(len(json.loads(self.file.read_text(encoding="utf-8"))), 1)

        b, _ = self.lobby.join("B", "quick", None, now)
        self.lobby.tick(now + server.MATCH_WAIT_MS)
        rival = self.lobby.players[b]["match"].sides[1]
        self.assertEqual((rival.kind, rival.name), ("ghost", "A"))
        self.assertEqual(self.lobby.players[b]["match"].questions[0], match.questions[0])

    def test_idle_player_is_not_recorded(self):
        import server
        a, _ = self.lobby.join("A", "quick", None, 0)
        now = server.MATCH_WAIT_MS
        self.lobby.tick(now)
        while self.lobby.players[a]["match"].phase != "finished":
            now += 1000
            self.lobby.state(a, now)  # bağlı kalır ama hiç cevap yazmaz
            self.lobby.tick(now)
        self.assertEqual(self.lobby.recordings, [])

    def test_session_limit(self):
        import server
        original, server.MAX_PLAYERS = server.MAX_PLAYERS, 2
        try:
            self.lobby.join("A", "create", None, 0)
            self.lobby.join("B", "create", None, 0)
            token, error = self.lobby.join("C", "create", None, 0)
            self.assertIsNone(token)
            self.assertIn("dolu", error)
        finally:
            server.MAX_PLAYERS = original

    def test_leaving_forfeits(self):
        a, _ = self.lobby.join("A", "quick", None, 0)
        b, _ = self.lobby.join("B", "quick", None, 0)
        self.lobby.action(a, {"type": "leave"}, 1000)
        state = self.lobby.state(b, 1000)
        self.assertEqual((state["phase"], state["reason"], state["won"]), ("finished", "forfeit", True))


if __name__ == "__main__":
    unittest.main()
