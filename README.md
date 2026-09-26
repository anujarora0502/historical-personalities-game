# The Grand Museum — Echoes of History

A 3D story game built with [three.js](https://threejs.org) and [Vite](https://vite.dev).
The museum's Timeline of History has shattered. Meet Mahatma Gandhi and Albert Einstein,
recover six lost memories from real moments in history, and put time back in order.

## How to play

| Key | Action |
| --- | --- |
| **W A S D** / arrows | Walk |
| **Drag** | Look around |
| **E** | Talk, read, pick up, examine |
| **1–6** | Choose a dialogue option or quiz answer |
| **J** / Tab | Museum Journal |
| **P** | Souvenir photo (downloads a framed picture) |
| **M** | Sound on/off |
| **Space** | Jump |

### Missions
1. **A Warm Welcome** — check in with the Gallery Guide at the info desk.
2. **Meet the Minds** — talk with Mahatma Gandhi and Albert Einstein.
3. **Fragments of Time** — find six glowing memory fragments (1893, 1902, 1905, 1921, 1930, 1942).
4. **Test of Knowledge** — pass each character's three-question quiz.
5. **Restore the Timeline** — arrange the fragments in order on the Timeline Wall.

Stars earned along the way raise your rank from *Visitor* to *Curator of Time*; finishing the
story awards a certificate. Progress is saved in the browser automatically.

### Features
- Cinematic title flyover and a personalised visitor pass (characters use your name).
- Text conversations with every character, plus optional real-time **voice** chat through Sarvam.
- Golden guidance beam and compass pointing to the next objective.
- "Memory flash" history cards, readable exhibit plaques and a Museum Journal with stamps.
- Procedural character animation: walking, breathing, blinking, head tracking, gestures and
  lip movement driven by the voice audio.
- Synthesised sound effects (no audio files), drifting dust, confetti and a restorable wall.

## Run locally

```bash
npm install
cp .env.example .env   # optional: add Sarvam credentials for voice chat
npm run dev
```

The game is fully playable without Sarvam credentials — characters then talk by text only.

## Project layout

| Path | What it is |
| --- | --- |
| `main.js` | Scene, museum, characters and their animation, player movement, game wiring |
| `src/content.js` | Missions, fragments, dialogue, quizzes, plaques — all narrative text |
| `src/missions.js` | Mission progress, stars, ranks and save data |
| `src/ui.js` | Title screen, HUD, dialogue, quizzes, journal, timeline puzzle, certificate |
| `src/world-extras.js` | Fragments, guidance beam, dust, Timeline Wall, plaques, confetti |
| `src/audio.js` | Web Audio sound effects |
| `public/*.glb` | Character and bush models (source: `einstein-custom.blend`) |
| `tools/blender-mcp-bridge.js` | MCP bridge for editing the models in a running Blender session |

## Deploy

Any static host works (`npm run build` produces `dist/`). On Vercel, import the repo — Vite is
detected automatically. A GitHub Pages workflow is also included in `.github/workflows/deploy.yml`.

Voice chat needs `VITE_SARVAM_API_KEY`, `VITE_SARVAM_ORG_ID` and `VITE_SARVAM_WORKSPACE_ID`.
Vite embeds `VITE_*` variables in the public JavaScript bundle, so anyone visiting the site can
read that key — use a restricted key, or leave it out and the game runs in text mode.
