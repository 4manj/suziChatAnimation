import { mascotAssets } from "@/lib/mascot/assets";
import type { MascotState } from "@/lib/mascot/types";

export const MIN_DWELL_MS = 300;
// One full send_success atlas playback (31 frames @ 24fps ≈ 1.29s), rounded up
// slightly so the last frame (antler tips dipping below the chat-box edge) is
// shown before the mascot unmounts.
export const SEND_SUCCESS_MS = 1400;
// Fallback window for idle_1 when its asset is not an atlas (placeholder phase).
export const IDLE_MIN_MS = 8000;
export const IDLE_MAX_MS = 12000;

// Idle rotation rules:
//   - idle_2 and idle_3 are always followed by idle_1. After 1–5 idle_1 instances,
//     the next non-idle_1 can be either idle_2 or idle_3 (weighted). Same variant
//     is allowed after the idle_1 buffer (idle_2 → idle_1 → idle_2 is fine).
//   - idle_1 can repeat up to IDLE_1_MAX_CONSECUTIVE times; after that a switch
//     to idle_2 or idle_3 is forced.
//   - Each state plays for exactly one atlas-loop length to avoid cutting any
//     round-trip animation mid-motion.
export const IDLE_1_MAX_CONSECUTIVE = 2;

const idleWeights: Record<"idle_1" | "idle_2" | "idle_3", number> = {
  idle_1: 45,
  idle_2: 15,
  idle_3: 30,
};

type Candidate = {
  state: MascotState;
  priority: number;
};

type Context = {
  isHovered: boolean;
  reducedMotion: boolean;
};

const priorities: Record<MascotState, number> = {
  idle_1: 0,
  idle_2: 0,
  idle_3: 0,
  hover: 1,
  send_success: 2,
};

function weightedPick(weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return entries[0][0];
}

export function getNextIdleState(
  currentState: MascotState,
  consecutiveIdle1Count: number,
): MascotState {
  // Rule 1: idle_2 and idle_3 are always followed by idle_1.
  if (currentState === "idle_2" || currentState === "idle_3") {
    return "idle_1";
  }

  // Rule 2: idle_1 can repeat up to IDLE_1_MAX_CONSECUTIVE; after that, force switch
  // to idle_2 or idle_3 via weights (either is allowed, same as before is OK since
  // there's always at least one idle_1 between non-idle_1 picks).
  if (currentState === "idle_1" && consecutiveIdle1Count >= IDLE_1_MAX_CONSECUTIVE) {
    return weightedPick({
      idle_2: idleWeights.idle_2,
      idle_3: idleWeights.idle_3,
    }) as MascotState;
  }

  // Normal idle_1 case: weighted pick across all three. Repeat of idle_1 is allowed.
  return weightedPick({
    idle_1: idleWeights.idle_1,
    idle_2: idleWeights.idle_2,
    idle_3: idleWeights.idle_3,
  }) as MascotState;
}

export function getStatePriority(state: MascotState): number {
  return priorities[state];
}

export function pickDesiredState(currentState: MascotState, _now: number, context: Context): Candidate {
  if (context.reducedMotion) {
    return { state: "idle_1", priority: priorities.idle_1 };
  }

  // hover > idle. Hover leave → idle (via hover exit phase in the scheduler).
  if (context.isHovered) {
    return { state: "hover", priority: priorities.hover };
  }

  if (currentState.startsWith("idle")) {
    return { state: currentState, priority: priorities[currentState] };
  }

  return { state: "idle_1", priority: priorities.idle_1 };
}

export function canTransition(from: MascotState, to: MascotState, elapsedMs: number): boolean {
  // send_success is terminal — nothing preempts it once entered, and it
  // preempts everything else.
  if (from === "send_success") {
    return false;
  }

  if (to === "send_success") {
    return true;
  }

  if (from === to) {
    return false;
  }

  if (elapsedMs < MIN_DWELL_MS) {
    return false;
  }

  // Priority is already enforced by pickDesiredState — it only returns a
  // lower-priority state when no higher-priority condition is active. Gating
  // here would trap the mascot in hover forever once entered.
  return true;
}

// Duration for a single "instance" of an idle state. Always equals one full
// atlas loop (frames / fps) if the state uses an atlas — prevents cutting any
// round-trip animation mid-motion. Falls back to the 8–12 s window for
// placeholder assets.
export function getIdleDuration(state: MascotState, speedMultiplier: number): number {
  const asset = mascotAssets[state];
  if (asset.kind === "atlas") {
    const { fps } = asset.manifest;
    const playable = asset.manifest.playbackFrames ?? asset.manifest.frames;
    return (playable * 1000) / fps / Math.max(0.01, speedMultiplier);
  }
  const base = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
  return Math.max(1000, base / Math.max(0.01, speedMultiplier));
}
