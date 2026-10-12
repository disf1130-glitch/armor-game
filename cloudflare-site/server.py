#!/usr/bin/env python3
"""Armor Game site server: статика + общий таймер + честный онлайн.
Запуск: python server.py  (слушает 127.0.0.1:8000)
API:
  GET  /api/release       -> {"deadline": ms}  (один для всех, хранится в release.json)
  POST /api/online {id}   -> {"online": N}     (heartbeat, TTL 40 сек)
  GET  /api/online        -> {"online": N}
"""
import json
import os
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
RELEASE_FILE = os.path.join(ROOT, "release.json")
RELEASE_MINUTES = 30
ONLINE_TTL = 40

MIME = {".html": "text/html; charset=utf-8", ".png": "image/png",
        ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
        ".ico": "image/x-icon"}

lock = threading.Lock()
deadline = 0
tokens = {}  # cookie-токен браузера -> last activity (1 браузер = 1 онлайн)


def load_deadline():
    global deadline
    try:
        with open(RELEASE_FILE, "r", encoding="utf-8") as f:
            deadline = int(json.load(f).get("deadline", 0))
    except (OSError, ValueError, KeyError):
        deadline = 0
    now = int(time.time() * 1000)
    if not deadline or deadline < now:
        deadline = now + RELEASE_MINUTES * 60 * 1000
        save_deadline()


def save_deadline():
    try:
        with open(RELEASE_FILE, "w", encoding="utf-8") as f:
            json.dump({"deadline": deadline}, f)
    except OSError:
        pass


def online_count(prune=True):
    now = time.time()
    if prune:
        for k in [k for k, t in tokens.items() if now - t > ONLINE_TTL]:
            del tokens[k]
    return len(tokens) or 1


def get_cookie(headers, name):
    for part in (headers.get("Cookie", "") or "").split(";"):
        if "=" in part:
            k, v = part.strip().split("=", 1)
            if k == name:
                return v
    return ""


class Handler(BaseHTTPRequestHandler):
    server_version = "AG/1.0"

    def log_message(self, *a):
        pass

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _static(self, path):
        if path in ("/", ""):
            path = "/index.html"
        full = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
        if not full.startswith(ROOT) or not os.path.isfile(full):
            self.send_error(404)
            return
        ext = os.path.splitext(full)[1].lower()
        try:
            with open(full, "rb") as f:
                body = f.read()
        except OSError:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        new_cookie = ""
        if path == "/index.html":
            # выдаём браузеру токен: только его heartbeat'ы считаем в онлайн
            with lock:
                tok = get_cookie(self.headers, "ag_t")
                if tok not in tokens:
                    tok = secrets.token_hex(16)
                    new_cookie = tok
                tokens[tok] = time.time()
        if new_cookie:
            self.send_header("Set-Cookie", "ag_t=" + new_cookie + "; Path=/; Max-Age=86400")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/release":
            with lock:
                now = int(time.time() * 1000)
                global deadline
                if not deadline or deadline < now:
                    deadline = now + RELEASE_MINUTES * 60 * 1000
                    save_deadline()
                self._json({"deadline": deadline})
        elif path == "/api/online":
            with lock:
                self._json({"online": online_count()})
        else:
            self._static(path)

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/online":
            try:
                n = int(self.headers.get("Content-Length", 0))
                data = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
                cid = str(data.get("id", ""))[:32]
            except (ValueError, OSError):
                cid = ""
            if not cid:
                self._json({"error": "no id"}, 400)
                return
            # ботов и сканеры в онлайн не считаем
            ua = (self.headers.get("User-Agent", "") or "").lower()
            if any(s in ua for s in ("bot", "crawl", "spider", "scan", "curl", "wget",
                                     "python", "headless", "phantom", "monitor", "uptime")):
                with lock:
                    self._json({"online": online_count()})
                return
            # засчитываем только heartbeat с валидным токеном (выдан при GET /)
            # флуд случайными id без куки накрутить счётчик не может
            with lock:
                tok = get_cookie(self.headers, "ag_t")
                if tok in tokens:
                    tokens[tok] = time.time()
                self._json({"online": online_count()})
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


if __name__ == "__main__":
    load_deadline()
    srv = ThreadingHTTPServer(("127.0.0.1", 8000), Handler)
    print("AG site: http://localhost:8000  (Ctrl+C чтобы остановить)")
    srv.serve_forever()
