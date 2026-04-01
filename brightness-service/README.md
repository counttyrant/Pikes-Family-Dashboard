# Pikes Brightness Service

A tiny local Node.js server that lets the Pikes Family Dashboard web app control
the Surface tablet's screen brightness via Windows WMI.

## Requirements

- Windows 10/11 (Surface or any device with a WMI-controllable display)
- [Node.js](https://nodejs.org) installed

## One-Time Install (on the Surface)

1. Copy this entire `brightness-service` folder to the Surface (USB, OneDrive, etc.)
2. Right-click `install.bat` → **Run as administrator**
3. The service starts immediately and will auto-start on every login

## Enable in the Dashboard

1. Open Settings → **Presence & Wake**
2. Enable **Presence detection**
3. Scroll to **Real brightness control** → toggle on
4. Click **Test** — you should see a green checkmark
5. Set your preferred brightness levels for active/idle

## Uninstall

Run `uninstall.bat` as administrator to remove the startup task.

## Manual Start / Stop

```bat
node server.js
```

The server listens on `http://127.0.0.1:3737` by default.
To use a different port: `set PORT=4000 && node server.js`
then update the port in dashboard Settings → Presence & Wake.

## API

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | /status | — | `{ ok: true, level: <0-100> }` |
| GET | /brightness | — | `{ level: <0-100> }` |
| POST | /brightness | `{ "level": 50 }` | `{ ok: true, level: 50 }` |
