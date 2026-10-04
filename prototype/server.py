"""Prototip sunucusu: eşleşme, oda kodu, kayıt/bot rakip ve tarayıcı arayüzü.

Çalıştırma: python3 server.py   (ek kurulum gerekmez)
"""
import json
import os
import random
import secrets
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from game import Match, Side
from rules import GameData

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
RECORDINGS_FILE = Path(os.environ.get("RECORDINGS_FILE", ROOT / "data" / "recordings.json"))
STATIC_FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
}

HOST = os.environ.get("HOST", "127.0.0.1")  # aynı ağdaki cihazlar için HOST=0.0.0.0
PORT = int(os.environ.get("PORT", 8000))
MATCH_WAIT_MS = int(os.environ.get("MATCH_WAIT_MS", 8000))  # çevrim içi rakip bekleme süresi
DISCONNECT_MS = int(os.environ.get("DISCONNECT_MS", 20000))
MAX_RECORDINGS = 300
MAX_PLAYERS = 2000  # açık internette belleği korumak için eşzamanlı oturum sınırı
MAX_BODY_BYTES = 16 * 1024
REQUEST_TIMEOUT_S = 20
ROOM_ALPHABET = "ABCDEFGHJKLMNPRSTUVYZ23456789"
BOT_NAMES = ["Deniz", "Elif", "Mert", "Zeynep", "Can", "Ayşe", "Emre", "Selin", "Kaan", "Defne",
             "Bora", "İpek", "Tuna", "Nehir", "Ozan", "Ece", "Barış", "Melis", "Kerem", "Duru"]


def now_ms():
    return int(time.monotonic() * 1000)


class Lobby:
    def __init__(self, data, rng=None, recordings_file=RECORDINGS_FILE):
        self.data = data
        self.rng = rng or random.Random()
        self.lock = threading.RLock()
        self.players = {}  # token -> oyuncu
        self.rooms = {}  # oda kodu -> kurucunun tokeni
        self.quick = None  # hızlı maç bekleyen oyuncunun tokeni
        self.recordings_file = recordings_file
        self.recordings = self._load_recordings()

    # --- kayıtlar

    def _load_recordings(self):
        try:
            return json.loads(Path(self.recordings_file).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return []

    def _save_match(self, match):
        """Biten maçtaki gerçek oyuncuların cevap ve sürelerini, ileride rakip olarak kullanmak için saklar."""
        if match.reason == "forfeit":
            return
        for side in match.sides:
            # Hiç cevap yazmamış bir oyuncunun kaydı rakip olarak kullanılmaz.
            played = any(text.strip() for r in side.rounds for text in r["answers"])
            if side.kind == "human" and played:
                self.recordings.append({"name": side.name, "questions": match.questions, "rounds": side.rounds})
        self.recordings = self.recordings[-MAX_RECORDINGS:]
        try:
            Path(self.recordings_file).write_text(json.dumps(self.recordings, ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass

    # --- eşleşme

    def join(self, name, mode, code, now):
        if len(self.players) >= MAX_PLAYERS:
            return None, "Sunucu şu an dolu. Biraz sonra tekrar dene."
        name = " ".join(str(name or "").split())[:16] or f"Misafir-{self.rng.randint(1000, 9999)}"
        token = secrets.token_urlsafe(12)
        player = {"name": name, "mode": mode, "match": None, "side": None, "code": None, "since": now, "seen": now}
        if mode == "join":
            code = str(code or "").strip().upper()
            host = self.rooms.pop(code, None)
            if host not in self.players:
                return None, "Bu kodla açık bir oda bulunamadı."
            self.players[token] = player
            self._start(host, token, now)
        elif mode == "create":
            player["code"] = "".join(self.rng.choice(ROOM_ALPHABET) for _ in range(4))
            self.rooms[player["code"]] = token
            self.players[token] = player
        else:
            self.players[token] = player
            if self.quick in self.players:
                other, self.quick = self.quick, None
                self._start(other, token, now)
            else:
                self.quick = token
        return token, None

    def _start(self, token_a, token_b, now):
        a, b = self.players[token_a], self.players[token_b]
        match = Match(self.data, self.rng, [Side(a["name"]), Side(b["name"])], now, on_finish=self._save_match)
        for side, player in enumerate((a, b)):
            player.update(match=match, side=side, code=None)

    def _start_offline(self, token, now):
        """Çevrim içi rakip yoksa: varsa önceki bir oyuncunun kaydı, yoksa bot."""
        player = self.players[token]
        choices = [r for r in self.recordings if r["name"] != player["name"]]
        if choices:
            rec = self.rng.choice(choices)
            rival, questions = Side(rec["name"], "ghost", rec["rounds"]), rec["questions"]
        else:
            rival, questions = Side(self.rng.choice([n for n in BOT_NAMES if n != player["name"]]), "bot"), None
        match = Match(self.data, self.rng, [Side(player["name"]), rival], now, questions, on_finish=self._save_match)
        player.update(match=match, side=0)

    def leave(self, token, now):
        player = self.players.pop(token, None)
        if not player:
            return
        if self.quick == token:
            self.quick = None
        if player["code"]:
            self.rooms.pop(player["code"], None)
        if player["match"]:
            player["match"].forfeit(player["side"], now)

    def tick(self, now):
        if self.quick in self.players and now - self.players[self.quick]["since"] >= MATCH_WAIT_MS:
            token, self.quick = self.quick, None
            self._start_offline(token, now)
        for token, player in list(self.players.items()):
            if now - player["seen"] > DISCONNECT_MS:
                self.leave(token, now)
            elif player["match"]:
                player["match"].tick(now)

    # --- istekler

    def state(self, token, now):
        player = self.players.get(token)
        if not player:
            return None
        player["seen"] = now
        if not player["match"]:
            return {"phase": "waiting", "mode": player["mode"], "code": player["code"], "meName": player["name"]}
        player["match"].tick(now)
        return player["match"].view(player["side"], now)

    def action(self, token, body, now):
        player = self.players.get(token)
        if not player:
            return None
        kind, match, side = body.get("type"), player["match"], player["side"]
        if kind == "leave":
            self.leave(token, now)
            return {"phase": "left"}
        if match:
            match.tick(now)
            if kind in ("answers", "lock") and isinstance(body.get("texts"), list):
                match.set_answers(side, body["texts"])
            if kind == "lock":
                match.lock(side, now)
            elif kind == "ready":
                match.ready(side, now)
            elif kind == "coin":
                match.choose_coin(side, body.get("choice"), now)
        return self.state(token, now)


class Handler(BaseHTTPRequestHandler):
    lobby = None
    timeout = REQUEST_TIMEOUT_S  # yarım kalan bağlantılar iş parçacığını süresiz tutmasın

    def log_message(self, *args):
        pass

    def _send(self, status, body, content_type="application/json; charset=utf-8"):
        payload = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/state":
            token = parse_qs(url.query).get("token", [""])[0]
            with self.lobby.lock:
                state = self.lobby.state(token, now_ms())
            return self._send(200, state) if state else self._send(404, {"error": "Oturum bulunamadı."})
        if url.path in STATIC_FILES:
            name, content_type = STATIC_FILES[url.path]
            return self._send(200, (STATIC / name).read_bytes(), content_type)
        self._send(404, {"error": "Bulunamadı."})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if not 0 <= length <= MAX_BODY_BYTES:
                return self._send(413, {"error": "İstek çok büyük."})
            body = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(body, dict):
                raise ValueError
        except ValueError:
            return self._send(400, {"error": "Geçersiz istek."})
        path = urlparse(self.path).path
        with self.lobby.lock:
            if path == "/api/join":
                mode = body.get("mode") if body.get("mode") in ("quick", "create", "join") else "quick"
                token, error = self.lobby.join(body.get("name"), mode, body.get("code"), now_ms())
                return self._send(400, {"error": error}) if error else self._send(200, {"token": token})
            if path == "/api/action":
                state = self.lobby.action(str(body.get("token", "")), body, now_ms())
                return self._send(200, state) if state else self._send(404, {"error": "Oturum bulunamadı."})
        self._send(404, {"error": "Bulunamadı."})


def ticker(lobby):
    """Kimse istek göndermese de süreleri ve kayıt/bot rakipleri ilerletir."""
    while True:
        time.sleep(0.2)
        with lobby.lock:
            lobby.tick(now_ms())


def lan_address():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("10.255.255.255", 1))
            return probe.getsockname()[0]
    except OSError:
        return None


def main():
    Handler.lobby = Lobby(GameData())
    threading.Thread(target=ticker, args=(Handler.lobby,), daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Tahmin oyunu prototipi çalışıyor: http://localhost:{PORT}")
    if HOST == "0.0.0.0" and lan_address():
        print(f"Aynı ağdaki diğer cihazlar için:   http://{lan_address()}:{PORT}")
    print("Durdurmak için Ctrl+C")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
