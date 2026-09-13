# Pomo Timer

Cross-platform (Mac/Windows) Pomodoro timer with session logging and a dashboard.

## Run

Requires Python 3 (no extra packages).

- **Mac:** double-click `start-mac.command` (or run `python3 pomodoro.py`)
- **Windows:** double-click `start-windows.bat` (or run `python pomodoro.py`)

Your browser opens automatically at http://localhost:8765.

## Features

- Set the task you're focusing on before starting a pomodoro
- Work / short break / long break timers (durations configurable)
- Every session is logged to `sessions.json` in this folder (syncs via Google Drive)
- Dashboard shows today's pomodoros, focus time, per-task totals, and full history
