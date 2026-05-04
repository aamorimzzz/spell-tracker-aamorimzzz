# Spell Tracker by aamorimzzz

A lightweight, manual summoner spell tracker overlay for League of Legends, built as an Overwolf native app.

> **Status**: Under review by Overwolf and Riot Games for public release.

---

## Overview

Spell Tracker is a minimalist overlay that helps players track enemy summoner spell cooldowns (Flash, Ignite, Heal, Teleport, etc.) during a League of Legends match. The user manually clicks a spell when they observe an enemy using it — the app then runs a countdown based on the known cooldown of that spell.

**This is a manual tracker.** It does not detect enemy spell usage automatically and does not provide any information not already visible to the player on screen.

## Features

- **Auto-detection of match start** via the official Live Client Data API
- **Automatic roster identification**: 5 enemy champions and their summoner spells loaded automatically when a match begins
- **Language-independent**: works regardless of the user's LoL client language (English, Portuguese, Spanish, etc.) by reading internal spell IDs (`rawDisplayName`) instead of translated display names
- **Real champion and spell icons** loaded from Riot's Data Dragon CDN
- **Translucent, draggable, resizable overlay** — stays on top of the game without taking focus
- **Persistent UI preferences** (window position, size, modifier toggles)
- **Hotkey support** for show/hide and reset
- **Lucidity Boots adjustment** (-10% cooldown) toggle

## Compliance

This app:

- ❌ Does **NOT** use the Riot Web API
- ✅ Uses **only** the Live Client Data API (`https://127.0.0.1:2999/liveclientdata/`), which is officially exposed by the local game client and contains only information already visible to the player
- ❌ Does **NOT** modify game behavior, send keyboard/mouse inputs, read game memory, or hook into the game process
- ❌ Does **NOT** detect enemy spell usage automatically (manual click required)
- ❌ Does **NOT** track or store any user data beyond local UI preferences (window position and size)
- ❌ Does **NOT** include advertisements, telemetry, or analytics in the initial version
- ✅ Follows [Riot Games' Third Party Policies](https://www.riotgames.com/en/legal) and Overwolf compliance guidelines
- ✅ Requires LoL to be in **Borderless Window** mode (overlays cannot work in exclusive fullscreen — Windows-level limitation)

## Tech stack

- **Overwolf Native** (CEF + JavaScript/HTML/CSS, no Electron)
- Pure vanilla JavaScript (no frameworks, no build step)
- Data Dragon CDN for champion and spell icons (cached by browser)

## Project structure

```
spell-tracker-aamorimzzz/
├── manifest.json              # Overwolf app manifest
├── icons/                     # App icons (mouse over, mouse normal, desktop)
├── js/
│   ├── background.html        # Background page host
│   ├── background.js          # Lifecycle controller, hotkey handlers
│   ├── spell-data.js          # Cooldown table + language-independent parsing
│   └── live-client-api.js     # Polling of the local Riot Live Client API
├── windows/
│   ├── ingame/                # In-game overlay window (HTML/CSS/JS)
│   └── desktop/               # Desktop info window (shown when LoL is closed)
├── LICENSE
└── README.md
```

## Development

### Prerequisites

- [Overwolf Client](https://www.overwolf.com) installed
- [Overwolf Developer account](https://dev.overwolf.com) (whitelisted)

### Loading in dev mode

1. Clone this repository
2. Open Overwolf → Settings → About → enable **Developer Options**
3. Open `overwolf://packages` in the Overwolf browser
4. Click **Load unpacked extension** and point to this project's root folder
5. Activate the app

For each code change, click the reload button in the dev panel. No rebuild needed.

### Debugging

- **Overlay window DevTools**: right-click the overlay → Developer Tools (Chromium DevTools)
- **Background script console**: in the dev panel → Background page → Inspect
- **Logs directory**: `%LOCALAPPDATA%\Overwolf\Log\Apps\<app-id>\`

## Hotkeys (defaults)

| Hotkey | Action |
|--------|--------|
| `Shift + Tab` | Show / hide overlay |
| `Shift + R` | Reset all timers |

Reconfigurable in **Overwolf → Settings → Hotkeys**.

## Roadmap

- [ ] Automatic detection of Lucidity Boots from enemy item inventory
- [ ] Visual indicator for enemies running the Inspiration rune tree (potential Cosmic Insight)
- [ ] Adaptive cooldown learning (detects -18s Cosmic Insight from observed timing)
- [ ] Per-slot configurable hotkeys for keyboard-only marking
- [ ] Audio notification 5 seconds before a spell comes back up
- [ ] Optional click-through mode

## Disclaimer

This project is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing League of Legends. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc. League of Legends © Riot Games, Inc.

## License

MIT — see [LICENSE](LICENSE).

## Author

**aamorimzzz** — [GitHub](https://github.com/aamorimzzz)
