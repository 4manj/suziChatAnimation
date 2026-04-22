# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## chatbox_suzi — Mascot Animation System

Side experiment: raster mascot animation system for a chat input UI. Mount on empty-chat welcome state, unmount after first send. Architecture is built to port cleanly into the main Suzi frontend (`suzi-fe`) later as a workspace package.

## Commands

```bash
pnpm dev         # Next dev server (webpack — safe on paths with spaces)
pnpm dev:turbo   # Next dev with Turbopack (panics on paths with spaces, keep for later port)
pnpm build       # Next production build
pnpm start       # Serve the production build
pnpm type-check  # tsc --noEmit; the de-facto "test" in this repo (no unit tests yet)
```

Python asset pipeline (requires `.venv/` — rembg/PIL installed there):

```bash
.venv/bin/python scripts/build-atlas.py seedance/<clip>.mp4 public/mascot/<state> <state> \
    --motion-sec 3.6 --target-fps 12 --frame-size 256 [--no-pingpong]
```

Deploy / hosting:

```bash
vercel --prod --yes   # deploys from this directory; project is already linked (.vercel/)
```

- GitHub: `github.com/4manj/suziChatAnimation` (public)
- Live: `https://chatboxsuzi.vercel.app`
- Project is CLI-linked (no GitHub auto-deploy configured). `.vercel/` is in `.gitignore` — the CLI auto-appends it on first link.

## Project context

- **Working dir:** `/Users/aman/DRIVE D/chatbox_suzi/`
- **Target app to port into later:** `/Users/aman/DRIVE E/suzi_figma_web/suzi-fe/` (Turborepo monorepo, pnpm, Next.js 15.3.8 + React 19 + Tailwind v4 + TS, Zustand). Port target path: `suzi-fe/packages/chat` or a new `packages/mascot`.
- **Local stack (this repo):** Standalone Next.js 15 + React 19 + Tailwind v4 + TypeScript. Same runtime as `@suzi/web` so module drops in with zero refactor.

## Mascot concept

- Chibi deer ("Suzi") in white/red kimono, pink flower on one antler.
- Rendered at **~180px tall**, anchored to the **top-right edge of the chat input**, peeking up over the border.
- **Welcome-state companion only.** Lifecycle: mount on empty chat → unmount after `send_success`. No persistent chat mate. No thinking state. No sleepy/timeout state. No typing state (explicitly dropped — the mascot is cursor-driven only).
- Session-bound — new chat = new mount (ChatGPT-style new-chat semantics). No clear/restore mechanics.

## Finite state machine

### States & priority (high → low, higher preempts lower)

| # | State | Mode | Behavior |
|---|---|---|---|
| 1 | `send_success` | one-shot, **terminal** | ~1.4s @ 1× playback. Character plays a "yay" reaction, arms spread, then crouches down so only her antler tips dip below the chat-box edge; a CSS opacity fade in `Mascot.tsx` dissolves her over the same window. Unmounts at `SEND_SUCCESS_MS / playbackSpeed`. Nothing preempts it — not even reduced motion. |
| 2 | `hover` | 3-phase (enter → loop → exit) | While pointer is over chat input. Plays one-shot enter, then ping-pongs the loop range, then plays one-shot exit on leave. |
| 3 | `idle` | loop, **atomic** | 3 variants. The current variant plays one full atlas cycle before anything else (hover or another idle) can take over. `send_success` is the only preempt. |

### Triggers

`onHover`, `onHoverLeave`, `onSend`, `onHoverExitComplete` (fired by the SpriteAtlas when the hover exit phase finishes).

(No `onKeyPress`, `onTyping*`, `onThinking`, `onIdleTimeout` — all explicitly dropped.)

### Transition map

```
idle ──(current atlas loop finishes)──► hover ──onHoverLeave──► [hover exit phase plays]
 ▲                                        ▲                            │
 │                                        │                            ▼
 │                                        │                    ──► idle_1 (via rotation)
 └───onHoverExitComplete or (!isHovered at loop end)──┘

any state ──onSend──► send_success ──(SEND_SUCCESS_MS)──► unmount
```

### Rules

- **Idle atomicity:** once an idle atlas starts playing, it runs to the end of its loop before hover or another idle variant can take over. `useMascotFSM.scheduleEvaluate` schedules a timer at `elapsed → totalDuration` and only re-picks at loop end. `send_success` is the one exception (it bypasses the scheduler via `transitionTo` directly in `onSend`).
- **Hover exit phase:** leaving `hover` does not swap manifests immediately. `hoverExiting` flips true → SpriteAtlas plays `exitRange` once → fires `onHoverExitComplete` → FSM transitions to `idle_1`. `send_success` still preempts mid-exit.
- **Dwell (non-idle only):** every non-idle state must play ≥ `MIN_DWELL_MS` (300 ms) before it can be interrupted. Exception: `send_success` always preempts.
- **Unmount timer scales with playbackSpeed:** `send_success` unmounts at `SEND_SUCCESS_MS / playbackSpeed`. The CSS fade in `Mascot.tsx` uses the same scaled duration so the dev-panel 0.5× / 0.25× slowdowns keep the fade and the unmount aligned.
- **`onSend` is idempotent while terminal:** a second `onSend` during `send_success` is a no-op — it does not reset `stateStartedAt` and does not extend the unmount window.
- **Reduced motion (`prefers-reduced-motion: reduce`):** mascot locks to `idle_1`, no transitions, no rotation, no anchor motion. The reduced-motion snap is gated *after* the `send_success` branch in the main effect so flipping reduced motion on mid-terminal never rips the mascot back to idle before unmount.
- **Pointer events:** mascot layer has `pointer-events: none`. Never steals clicks from the input.

### Idle rotation rules (in `lib/mascot/fsm.ts`)

- `idle_2` and `idle_3` are **always followed by** `idle_1` — no back-to-back non-idle_1.
- `idle_1` can repeat up to `IDLE_1_MAX_CONSECUTIVE = 2` times; after that, the next pick is forced from `{idle_2, idle_3}` (weighted).
- Weights: `{idle_1: 45, idle_2: 15, idle_3: 30}` (idle_2:idle_3 ratio 1:2).
- Each idle state plays for exactly one atlas-loop length (`playbackFrames / fps`) to avoid cutting a round-trip animation mid-motion.

### State-to-variant mapping

- `idle_1` = base neutral pose (Suzi Idle 1), micro-motion only (blink, breathing, tail flick) — the "connector" everywhere.
- `idle_2` = face-touch / shy bashful reaction (rarely used, ~10%).
- `idle_3` = stand-down + snap back (tail flick + glance).
- `hover` = two-hands-to-face delighted surprised reaction with look-left beat in the loop.
- `send_success` = "yay" reaction + arms spread + crouch-duck below the chat-box edge.

## Asset architecture

**Single unified runtime format: sprite atlas (PNG) + JSON manifest.** One playback engine, phased playback supports enter/loop/exit splits on a single atlas.

### Manifest schema

```ts
type MascotAtlasManifest = {
  id: string;
  atlas: string;             // path to sprite sheet PNG
  frames: number;            // total frames in the sheet
  playbackFrames?: number;   // how many frames to play; for ping-pong atlases set to frames-1 to skip the duplicated loop-seam frame
  fps: number;
  frameWidth: number;
  frameHeight: number;
  cols: number;
  rows: number;
  loop: boolean;             // default true; send_success uses false (clamps on last frame)
  entryFrame: number;
  exitFrame: number;
  // Optional 3-phase split. When all three are present, playback runs enter → loop (ping-pong) → exit-on-request.
  enterRange?: [number, number];   // [start, end) half-open
  loopRange?:  [number, number];
  exitRange?:  [number, number];
  enterSpeed?: number;             // frame-rate multiplier on enter phase only (default 1)
  exitSpeed?:  number;             // frame-rate multiplier on exit phase only (default 1)
  anchorPoint: { x: number; y: number };
};
```

Atlases currently shipping and their trims (all 256×256 frames):

| State | Frames | Grid | fps | Duration | Phased |
|---|---|---|---|---|---|
| `idle_1` | 33 (play 33) | 6×6 | 12 | 2.75s | no |
| `idle_2` | 42 (play 41) | 7×6 | 12 | 3.42s | no |
| `idle_3` | 39 (play 38) | 7×6 | 12 | 3.17s | no |
| `hover`  | 46 (play 45) | 7×7 | 12 | enter 0.83s + loop ping-pong + exit 0.83s | yes; `enterSpeed=exitSpeed=1.5` |
| `send_success` | 31 (play 31) | 7×5 | 24 | 1.29s, `loop: false` | no |

### Transition model

- **Ping-pong endpoints:** most loop atlases are built forward + reversed, so frame 0 and the last frame are byte-identical. `playbackFrames = frames - 1` skips the duplicated seam so the loop doesn't hold that pose for two frame-durations.
- **Manifest-id remount:** `Mascot.tsx` keys `SpriteAtlas` on `asset.manifest.id`. State changes that swap manifests force a remount → the new atlas starts at its `entryFrame` (or `enterRange[0]` for phased).
- **Atlas preloader:** `Mascot.tsx` renders hidden `<img>` tags for every atlas URL on mount so state swaps never trigger a mid-transition fetch.
- **Phased playback:** `SpriteAtlas` tracks an internal `phase: "enter" | "loop" | "exit" | "done"` via ref. `phaseDuration()` is recomputed per rAF tick so enter/exit-speed kicks in at the boundary.
- **Send-success fade:** terminal state wraps the atlas in a CSS `@keyframes suzi-send-fade` (opacity 1 → 0 over the second half of the clip) declared in `Mascot.tsx`. Duration = `SEND_SUCCESS_MS / playbackSpeed` so the fade and the unmount timer land together.
- CSS transforms are used **only** for anchor motion (idle bob, hover lift) in the placeholder path. Real atlases rely entirely on pre-rendered frames for body motion; transforms never touch expressions or gestures.

## Canonical reference (base canvas)

Source: **`suzi idle 1.png`** at repo root (1439×1434 RGBA, gray bg). The build pipeline strips the bg via rembg u2net and normalizes to 1440×1440 before downscaling to the atlas frame size.

Every generated frame — every state, every variant — must conform to this pose at frame 0 (and at ping-pong endpoints for loopable atlases). Non-negotiable. The `suzi hover frame12.png` at repo root is a second canonical — frame 12 of the hover atlas upscaled to match the reference size, used as the seed image for the `send_success` clip.

## Asset pipeline

Script: **`scripts/build-atlas.py`** (Python; requires `.venv` with `rembg`, `pillow`, and system `ffmpeg`).

```
[Seedance 2.0 on Higgsfield]
   │  image-to-video, seed = character reference PNG on chroma-green #00FF5E
   │  (chain-seeded: each idle seeded from the previous's last frame)
   ▼
[MP4 clip, ~2–4s, 24fps, chroma-green bg]
   │  ffmpeg extracts at target_fps (default 12)
   ▼
[PNG sequence, 12fps, source resolution]
   │  rembg u2net strips green per frame (cleaner fur edges than ffmpeg chromakey)
   ▼
[PNG sequence, transparent bg]
   │  trim to motion window (--motion-sec)
   │  ping-pong (drop f0, then sub + reversed(sub[:-1])) — skipped with --no-pingpong
   │  resize to --frame-size (default 256) via LANCZOS
   ▼
[atlas.png + manifest.json]  →  public/mascot/<state>/
```

Key defaults:

- **Target fps:** 12 (output atlas; source may be 24)
- **Frame size:** 256×256
- **Ping-pong mode:** drop the real f0 (identical to seed); use `[f1..fN, fN-1..f1]` so first and last frames are both `f1` → byte-identical closure. `playbackFrames = n - 1`.
- **Non-ping-pong mode (`--no-pingpong`):** used for terminal clips like `send_success`. Last frame is not pinned; character can legitimately be empty/transparent there.

### Color matching

Seedance renders per-clip lighting can drift slightly between takes. To align a new atlas's color palette to an existing one (e.g., `send_success` → match `hover`):

1. Compute per-channel mean + std of all pixels with alpha > 128.
2. For each RGB channel, apply `new = (old - src_mean) * clamp(tgt_std/src_std, 0.9, 1.1) + tgt_mean` to pixels in the character mask.
3. Clip to `[0, 255]`, keep alpha untouched.

The std clamp prevents contrast blowouts on channels with very different variance.

### Character consistency workflow

- `prompts/character-spec.md` is the locked character description — paste it into every Seedance run.
- `prompts/seedance-prompts.md` has per-state motion briefs and paste-ready prompts.
- Chain-seed idle clips (idle_2 seeded from idle_1's last frame, idle_3 from idle_2) so rendering style doesn't drift.
- Over-generate and reject aggressively. Cheaper to regenerate than fix in post. `prompts/qa-criteria.md` has the accept/reject checklist.

## Atlas trimming workflow

Trimming frames out of an existing atlas (without rerunning the full pipeline) is a common operation — it's how we collapse repeating middle sections and shorten exits. The pattern:

1. Back the original atlas + manifest up to `public/mascot/<state>_<Nframes>f_backup/`.
2. Keep frame indices as a concatenation: `list(range(0, a)) + list(range(b, n))`.
3. Re-pack the kept frames into a fresh grid with `cols = ceil(sqrt(n))`, `rows = ceil(n / cols)`.
4. If `frames[0]` and `frames[-1]` are still byte-identical, `playbackFrames = n - 1`; else `playbackFrames = n`.
5. Rewrite `manifest.json` with the new `frames`, `playbackFrames`, `cols`, `rows`.

This is the workflow we've used to drop idle repeats and hover's middle-hold section. `public/mascot/*_backup/` directories are the rollback path.

## Chat box replica

Mirrors the target UI exactly:

- Dark background (~#0a0a0f)
- Pink/magenta gradient border (subtle glow)
- Placeholder text: `"Trade anything! or / for skills and @ for actions"`
- Left: `+` button (add attachment)
- Left of center: `X-High` model pill with chip icon
- Right: send arrow button (↑)

Mascot sits at **top-right of chat box, overhanging upward** (controlled via Tailwind classes in `components/mascot/Mascot.tsx`).

## Dev harness

`components/mascot/DevPanel.tsx` exists but is **not currently mounted** in `app/page.tsx`. The component is kept around because it reads from `MascotFSMApi` only — harmless to leave, easy to re-mount when iterating. Re-add `<DevPanel fsm={fsm} />` next to `<Mascot>` in `page.tsx` to use it.

When mounted it offers (hidden in prod via `process.env.NODE_ENV !== 'production'`):

- Force-state buttons: `idle_1 / idle_2 / idle_3 / hover / send_success`.
- Event simulator: `onHover`, `onHoverLeave`, `onSend`.
- Live FSM readout: current state, time in current state, dwell lock remaining.
- Sliders: idle bob amplitude, hover lift offset, crossfade duration.
- Toggle: reduced-motion preview.
- Toggle: 0.25× / 0.5× / 1× playback speed.

## Portability contract (toward `suzi-fe`)

Everything under `lib/mascot/` and `components/mascot/` is the portable core. Move that tree into `suzi-fe/packages/mascot` as-is, add a `package.json` with the workspace name, and consume from `@suzi/web` or `@suzi/chat`. No code inside `lib/mascot/` or `components/mascot/` references this standalone app directly.

One caveat for embedding: **`useMascotStore` in `useMascotFSM.ts` is a module-level singleton**. After `send_success` unmounts (`isMounted:false`), the store persists that dead terminal state across React parent remounts. The hook has a one-shot `useEffect(..., [])` that detects `!isMounted && currentState === "send_success"` on mount and resets the animation-relevant fields (preserving dev-panel knobs: `playbackSpeed`, `reducedMotionPreview`, `controls`). If `suzi-fe` ends up with multiple Mascot mount points sharing the same module, consider making the store factory-per-instance instead.

## File layout

```
chatbox_suzi/
├── CLAUDE.md                              ← this file
├── suzi idle 1.png                        ← canonical seed (repo root)
├── suzi hover frame12.png                 ← secondary canonical (seed for send_success)
├── exit2.png                              ← raw send_success seed (chroma-green bg)
├── prompts/                               ← locked character spec + seedance briefs
│   ├── character-spec.md
│   ├── seedance-prompts.md
│   └── qa-criteria.md
├── app/                                   ← Next.js app router (testbed)
├── components/
│   ├── chat/ChatInput.tsx                 ← UI replica
│   └── mascot/
│       ├── Mascot.tsx                     ← mount layer, atlas preloader, key-on-manifest-id
│       ├── SpriteAtlas.tsx                ← rAF playback, phased enter/loop/exit
│       ├── useMascotFSM.ts                ← zustand store + scheduler
│       ├── DevPanel.tsx
│       └── useMascotFSM helpers
├── lib/mascot/
│   ├── assets.ts                          ← MascotState → descriptor map (single swap point)
│   ├── fsm.ts                             ← priorities, dwell, idle rotation, pickDesiredState, canTransition, getIdleDuration
│   ├── types.ts                           ← MascotState, MascotAtlasManifest, FrameRange, MascotFSMApi
│   ├── playback.ts                        ← playback config (crossfade, speed) for placeholder path
│   └── placeholderMotion.ts               ← CSS transforms used when an atlas is absent
├── public/mascot/
│   ├── idle_1/  idle_2/  idle_3/  hover/  send_success/
│   ├── *_backup/                          ← rollback copies from trimming
│   └── placeholder/suzi-idle-1.png        ← static fallback
├── scripts/build-atlas.py                 ← Seedance → atlas pipeline
├── seedance/                              ← raw MP4 clips (keep; do not delete)
└── .venv/                                 ← Python env for the pipeline
```

## Anti-thrash safeguards

- **Idle atomicity** (above) replaces the old priority-based preemption for idle; no state flip mid-cycle.
- **Phased hover exit** keeps the manifest stable while `hoverExiting` is true; the atlas finishes its exit frames before manifest swap happens.
- **Re-hover self-heal during exit:** if the user re-hovers after `onHoverLeave` but before the exit frames finish, the FSM clears `hoverExiting`. `SpriteAtlas` watches `exitReqRef` inside the rAF tick and, if the flag drops to false while `phase === "exit"` (or while in the follow-on `done` phase), snaps `phase` back to `loop` at `loopRange[0]`. Without this the atlas would freeze on the final exit frame while the FSM still thought it was in hover.
- **`send_success` terminal:** `canTransition` returns false for any `from === "send_success"`; `pickDesiredState` never returns away from it; `onSend` is a no-op when already terminal.
- **Reduced-motion cannot preempt terminal:** the main effect schedules the `send_success` unmount timer *before* the reduced-motion snap branch, so toggling reduced motion mid-terminal doesn't interrupt the goodbye.
- **Narrow zustand selectors** in `useMascotFSM` — each field subscribes independently so unrelated store updates don't re-render the hook.
- **Single active state at any time.** No state stack, no queued transitions.

## Decisions log

| Decision | Rationale |
|---|---|
| Standalone Next.js (not monorepo) | Lean testbed, ports into `suzi-fe` later |
| Next.js 15 + React 19 + Tailwind v4 | Match `@suzi/web` runtime exactly |
| Single atlas + manifest (phased playback) | One playback engine supports dumb loops and enter/loop/exit clips |
| Typing state removed | Input keystrokes are noise; cursor-driven hover covers the engagement signal |
| Idle atomicity (no mid-cycle cuts) | AI-generated idle motions have a beat structure; cutting mid-motion reads broken |
| Hover split into enter/loop/exit on one atlas | Avoids having 3 separate hover clips while still giving a clean greeting + graceful farewell |
| `send_success` `loop: false` (clamp last frame) | Clip is terminal; antler-tips-below-edge last frame should hold until FSM unmounts |
| `SEND_SUCCESS_MS = 1400` | Matches full 1.29s atlas playback (31 frames @ 24fps) before unmount |
| rembg u2net over ffmpeg chromakey | Cleaner fur edges; chromakey left visible fringe |
| Ping-pong with dropped f0 | Seedance's literal f0 duplicates the seed pose; keeping it holds the duplicate for 2 frame-durations at the loop seam and reads jerky |
| `suzi idle 1.png` as canonical seed | Pose equality anchors the character across all clips |
| Chroma-green `#00FF5E` bg for AI renders | Reliable rembg target; preserves fur alpha better than real-world BG |
| Color moment-matching between atlases | Aligns lighting/grade drift between Seedance takes |
