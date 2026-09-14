#!/usr/bin/env python3
"""Desktop launcher: serves the built app from dist/ at http://localhost:8765 and opens it.

Build first:  npm install && npm run build
Session data lives in Supabase, so this is just a static file server.
"""
import threading
import urllib.request
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DIST = BASE_DIR / "dist"
PORT = 8765


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


def main():
    url = f"http://localhost:{PORT}"
    if not (DIST / "index.html").exists():
        print("No build found in dist/. Run:  npm install && npm run build")
        input("Press Enter to close...")
        return
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), partial(Handler, directory=str(DIST)))
    except OSError:
        try:
            with urllib.request.urlopen(url, timeout=2):
                pass
            print(f"Already running — opening {url}")
            webbrowser.open(url)
        except Exception:
            print(f"Port {PORT} is in use by another program.")
            input("Press Enter to close...")
        return
    print(f"Pomodoro timer running at {url}  (Ctrl+C to stop)")
    threading.Timer(0.5, webbrowser.open, args=(url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
