#!/usr/bin/env python3
"""Pomodoro timer server. Run with: python3 pomodoro.py"""
import csv
import io
import json
import shutil
import threading
import urllib.request
import webbrowser
from datetime import date
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
LOG_FILE = BASE_DIR / "sessions.json"
BACKUP_DIR = BASE_DIR / "backups"
KEEP_BACKUPS = 14
PORT = 8765


def backup_sessions():
    """Copy sessions.json to backups/ once per day; keep the newest KEEP_BACKUPS."""
    if not LOG_FILE.exists():
        return
    dest = BACKUP_DIR / f"sessions-{date.today().isoformat()}.json"
    if dest.exists():
        return
    BACKUP_DIR.mkdir(exist_ok=True)
    shutil.copy2(LOG_FILE, dest)
    for old in sorted(BACKUP_DIR.glob("sessions-*.json"))[:-KEEP_BACKUPS]:
        old.unlink()


def load_sessions():
    if LOG_FILE.exists():
        try:
            return json.loads(LOG_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []
    return []


def save_sessions(sessions):
    backup_sessions()
    LOG_FILE.write_text(json.dumps(sessions, indent=2), encoding="utf-8")


def sessions_csv():
    fields = ["started_at", "ended_at", "task", "category", "type",
              "planned_min", "actual_min", "completed"]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(fields)
    for s in load_sessions():
        w.writerow([s.get(f, "") for f in fields])
    return buf.getvalue().encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, content_type="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            html = (BASE_DIR / "index.html").read_bytes()
            self._send(200, html, "text/html; charset=utf-8")
        elif self.path == "/api/sessions":
            self._send(200, load_sessions())
        elif self.path == "/api/export.csv":
            data = sessions_csv()
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition",
                             'attachment; filename="pomodoro-sessions.csv"')
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path == "/api/sessions":
            length = int(self.headers.get("Content-Length", 0))
            try:
                entry = json.loads(self.rfile.read(length))
            except json.JSONDecodeError:
                self._send(400, {"error": "invalid json"})
                return
            sessions = load_sessions()
            sessions.append(entry)
            save_sessions(sessions)
            self._send(201, {"ok": True, "count": len(sessions)})
        else:
            self._send(404, {"error": "not found"})

    def do_DELETE(self):
        if self.path == "/api/sessions":
            length = int(self.headers.get("Content-Length", 0))
            try:
                idx = int(json.loads(self.rfile.read(length))["index"])
            except (json.JSONDecodeError, KeyError, ValueError, TypeError):
                self._send(400, {"error": "invalid body"})
                return
            sessions = load_sessions()
            if 0 <= idx < len(sessions):
                sessions.pop(idx)
                save_sessions(sessions)
                self._send(200, {"ok": True, "count": len(sessions)})
            else:
                self._send(400, {"error": "index out of range"})
        else:
            self._send(404, {"error": "not found"})

    def log_message(self, *args):
        pass


def main():
    url = f"http://localhost:{PORT}"
    try:
        server = HTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        try:
            with urllib.request.urlopen(f"{url}/api/sessions", timeout=2):
                pass
            print(f"Already running — opening {url}")
            webbrowser.open(url)
            return
        except Exception:
            print(f"Port {PORT} is in use by another program.")
            input("Press Enter to close...")
            return
    backup_sessions()
    print(f"Pomodoro timer running at {url}  (Ctrl+C to stop)")
    threading.Timer(0.5, webbrowser.open, args=(url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
