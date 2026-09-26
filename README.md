# The Grand Museum — Echoes of History

A 3D story game built with [three.js](https://threejs.org) and [Vite](https://vite.dev).
The museum's Timeline of History has shattered. Meet Mahatma Gandhi and Albert Einstein,
recover six lost memories from real moments in history, and put time back in order.

## How to play

Walk up to a character and just talk — they start the conversation by voice as soon as you are
close, and the call ends when you walk away. Allow microphone access when the browser asks.

| Key | Action |
| --- | --- |
| **Arrow keys** | Walk |
| **Drag** | Look around |
| **E** | Read a plaque, use the Timeline Wall |
| **J** | Museum Journal |
| **P** | Souvenir photo (downloads a framed picture) |
| **M** | Sound on/off |

### Missions
1. **A Warm Welcome** — say hello to the Gallery Guide at the info desk.
2. **Meet the Minds** — talk with Mahatma Gandhi and Albert Einstein.
3. **Fragments of Time** — find six glowing memory fragments (1893, 1902, 1905, 1921, 1930, 1942).
4. **Restore the Timeline** — put the fragments in order on the Timeline Wall.

Stars raise your rank from *Visitor* to *Curator of Time*.

### Where progress is saved
Progress (name, missions, fragments, characters met, stars) is stored in the player's browser
with `localStorage` under the key `grand-museum-save-v2` — see `src/missions.js`. It stays on that
device and browser only; clearing site data or choosing **New visit** starts over.

## Run locally

```bash
npm install
cp .env.example .env   # optional: add Sarvam credentials for voice chat
npm run dev
```

Without Sarvam credentials the missions still work, but characters cannot talk.

## Project layout

| Path | What it is |
| --- | --- |
| `main.js` | Scene, museum, characters and their animation, player movement, game wiring |
| `src/content.js` | Missions, fragments and plaques — all in-game text |
| `src/missions.js` | Mission progress, stars, ranks and save data |
| `src/ui.js` | Title screen, HUD, voice indicator, journal, timeline puzzle, certificate |
| `src/world-extras.js` | Fragments, Timeline Wall (with its spotlight and beam), dust, plaques, confetti |
| `src/world-decor.js` | Street traffic, lamps, trees, skyline, fountain, and the hall's carpet, ceiling, chandeliers, busts, paintings, ropes, benches and palms |
| `src/audio.js` | Web Audio sound effects |
| `public/*.glb` | Character and bush models (source: `einstein-custom.blend`) |
| `tools/blender-mcp-bridge.js` | MCP bridge for editing the models in a running Blender session |

## Deploy

Any static host works (`npm run build` produces `dist/`). On Vercel, import the repo — Vite is
detected automatically. A GitHub Pages workflow is also included in `.github/workflows/deploy.yml`.

Voice chat needs `VITE_SARVAM_API_KEY`, `VITE_SARVAM_ORG_ID` and `VITE_SARVAM_WORKSPACE_ID`.
Vite embeds `VITE_*` variables in the public JavaScript bundle, so anyone visiting the site can
read that key — use a restricted key.
