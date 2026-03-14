# Tar Blazer v2 — CloudPhone Widget

Three.js 3D cube racer for CloudPhone feature phones. Real perspective camera, shadow-mapped lighting, neon road, and a fully detailed car — all running in 240×320px.

---

## What's new in v2

- **Real Three.js 3D** — proper perspective camera, no pseudo-3D tricks
- **Detailed car** — extruded body profile, spoiler, side windows, rear window, SpotLight headlights, red tail lights, spinning tyres with chrome rims, exhaust pipes
- **Shadow mapping** — PCF soft shadows across the road
- **Neon road** — pink edge lines, yellow lane markers, red/white kerbs, cyan barrier glow strips
- **ACES filmic tone mapping** — arcade-bright saturated colours
- **Hit flash** — red screen flash on collision
- **Flexible controls** — Arrow keys, WASD, Space/Shift for turbo all work simultaneously
- **High score** persisted to `localStorage`

---

## Controls

| Input                   | Action        |
|-------------------------|---------------|
| Arrow Up / W            | Accelerate    |
| Arrow Down / S          | Brake         |
| Arrow Left / A          | Steer left    |
| Arrow Right / D         | Steer right   |
| Space / Shift           | Turbo boost   |
| Enter / Escape          | Start / retry |
| On-screen D-pad buttons | Same as above |

---

## Project structure

```
tar-blazer/
├── src/
│   ├── App.tsx                  ← view router (menu / race / records)
│   ├── engine/
│   │   ├── scene.ts             ← Three.js scene (car, road, lighting, obstacles)
│   │   └── game.ts              ← pure game logic (physics, collision, scoring)
│   └── views/
│       ├── RaceScreen.tsx       ← canvas + HUD + input + overlays
│       └── MenuScreen.tsx       ← menu + records screens
├── public/
│   ├── icon.png                 ← 512×512 RGB PNG
│   └── manifest.json
└── .github/workflows/
    └── deploy.yml               ← auto-deploy to GitHub Pages on push
```

---

## Deploy to GitHub Pages

```bash
# 1. Create a public GitHub repo named 'tar-blazer'
git init && git add . && git commit -m "Tar Blazer v2"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/tar-blazer.git
git push -u origin main

# 2. Settings → Pages → Source → GitHub Actions
# Live at: https://YOUR_USERNAME.github.io/tar-blazer/
```

---

## Local dev

```bash
bun install
bun dev
# → http://localhost:5173/tar-blazer/
```

---

## Integrating with cloudphone-ui monorepo

Drop this folder into `cloudphone-ui/apps/tar-blazer/` and add it to the root `package.json` workspaces:

```json
"workspaces": ["apps/rps-duel", "apps/loadshed-za", "apps/tar-blazer"]
```

---

## Register on CloudPhone

1. **https://cloudphone.tech/my** → Add Widget
2. Name: `Tar Blazer`
3. URL: `https://YOUR_USERNAME.github.io/tar-blazer/`
4. Icon: `public/icon.png`
5. Test at **https://cloudphone.tech/my/simulator**

---

## Bundle size note

Three.js adds ~580KB to the bundle (minified). This is split into its own chunk via Vite's `manualChunks` so it loads in parallel with the React chunk. On CloudPhone's 4G connection this loads in ~2–3 seconds. If size is a concern, replace `three` with `three/src/...` tree-shaken imports.

---

## Customising

**Car colour** — edit `scene.ts`, line with `0xcc0044` (body) and `0xff2d78` (emissive)

**Road colours** — edit `_makeRoadTile()` in `scene.ts`

**Obstacle speed / spawn rate** — edit `spawnRate` formula in `game.ts`:
```ts
const spawnRate = Math.max(0.55, 2.2 - s.score / 1200)
```

**Max speed** — edit `topSpd` in `game.ts`:
```ts
const topSpd = s.turboActive ? 20 : 11
```
