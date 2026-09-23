# The Grand Museum

A small 3D museum walk-through built with [three.js](https://threejs.org) and [Vite](https://vite.dev).
Walk up to Albert Einstein, Mahatma Gandhi or the gallery guide at the info desk and talk to them
through Sarvam conversational AI.

## Run locally

```bash
npm install
cp .env.example .env   # then fill in your Sarvam credentials
npm run dev
```

Controls: **Arrow keys / WASD** to walk, **Space** to jump, **drag** to look around.

## Project layout

| Path | What it is |
| --- | --- |
| `main.js` | Scene, museum building, characters, movement and Sarvam voice conversations |
| `style.css`, `index.html` | HUD overlay |
| `public/*.glb` | Character and bush models loaded at runtime |
| `einstein-custom.blend` | Blender source for the custom characters |
| `tools/blender-mcp-bridge.js` | MCP bridge for editing models in a running Blender session |

## Deploy

Pushing to `main` builds the site and publishes it to GitHub Pages
(`.github/workflows/deploy.yml`). Enable it once under **Settings → Pages → Source: GitHub Actions**.

Voice conversations need the `VITE_SARVAM_API_KEY`, `VITE_SARVAM_ORG_ID` and `VITE_SARVAM_WORKSPACE_ID`
repository secrets. Vite embeds `VITE_*` variables in the public JavaScript bundle, so anyone
visiting the site can read that key — use a restricted key, or proxy Sarvam through a small backend.
