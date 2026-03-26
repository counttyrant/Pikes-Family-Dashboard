# Pikes Family Dashboard

A beautiful, touch-friendly family command center for a wall-mounted Surface Book 2. Features Google Calendar sync, weather, photo slideshow, chore charts with rewards, shopping lists, AI assistant, and more.

![Dashboard](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Azure](https://img.shields.io/badge/Azure-Static%20Web%20Apps-blue)

## Features

- **Google Calendar** — synced agenda/week view, color-coded per calendar
- **Weather** — current conditions + 5-day forecast (OpenWeatherMap)
- **Photo Slideshow** — rotating background photos with crossfade
- **Chore Chart** — assign chores, earn stickers/points, leaderboard
- **Rewards System** — configurable rewards redeemable with points
- **Shopping List** — tap to check off items
- **Notes Board** — sticky-note style family messages
- **Countdown** — days until upcoming events
- **AI Assistant** — voice/text chat powered by OpenAI
- **Customizable Layout** — drag-and-drop widget positioning
- **Night Mode** — auto-dims on schedule
- **Screen Saver** — blacks out after inactivity, wakes on touch
- **Full Screen** — one-tap fullscreen mode, PWA installable

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS v4
- Swiper.js (touch navigation)
- Dexie.js (IndexedDB — all data local, zero backend costs)
- react-grid-layout (draggable widgets)
- Azure Static Web Apps (free tier hosting)

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Setup

1. **Weather**: Get a free API key at [openweathermap.org](https://openweathermap.org/api) and enter it in Settings
2. **Google Calendar**: Click "Connect Google Calendar" in Settings (requires a Google Cloud project with Calendar API enabled)
3. **AI Assistant**: Enter your OpenAI API key in Settings
4. **Photos**: Upload family photos in Settings — they rotate as the dashboard background

## Deploy to Azure

1. Create a GitHub repository and push this code
2. In the Azure Portal, create a new **Static Web App** linked to your GitHub repo
3. Set the build preset to **Vite**, app location `/`, output `dist`
4. Add the deployment token as a GitHub secret: `AZURE_STATIC_WEB_APPS_API_TOKEN`
5. Push to `main` — GitHub Actions will auto-deploy

## Surface Book 2 Wall Mount Setup

1. Detach the tablet from the keyboard base
2. 3D-print a wall mount (files on [MakerWorld](https://makerworld.com/en/models/823332))
3. Run the Surface Connect charger behind the wall
4. Open Edge, navigate to the dashboard URL
5. Install as PWA (click the install icon in the address bar)
6. Tap the fullscreen button

### Motion-Activated Screen

See the `WallDisplay/` folder for a Python script that uses the webcam to detect motion and turn the screen on/off automatically.

## Configuration

All settings are in the gear icon (top-right). Data is stored locally in IndexedDB — no accounts, no subscriptions, no cloud dependency.

## License

MIT
