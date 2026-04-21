export const mascotStates = [
  "idle_1",
  "idle_2",
  "idle_3",
  "hover",
  "send_success",
] as const;

export type MascotState = (typeof mascotStates)[number];

export type MascotEvent = "onHover" | "onHoverLeave" | "onSend";

export type PlaybackSpeed = 0.25 | 0.5 | 1;

export type MotionControls = {
  bobAmplitude: number;
  hoverLift: number;
  crossfadeMs: number;
};

/**
 * Half-open frame range [start, end). `start` inclusive, `end` exclusive.
 * Used to split a single atlas into enter / loop / exit phases.
 */
export type FrameRange = [number, number];

export type MascotAtlasManifest = {
  id: string;
  atlas: string;
  frames: number;
  /**
   * Number of frames to actually play at runtime. For ping-pong atlases where
   * the first and last frames are byte-identical duplicates, set this to
   * `frames - 1` so the loop seam doesn't hold the duplicated frame for
   * 2 frame-durations (which reads as a jerky pause).
   */
  playbackFrames?: number;
  fps: number;
  frameWidth: number;
  frameHeight: number;
  cols: number;
  rows: number;
  loop: boolean;
  entryFrame: number;
  exitFrame: number;
  /**
   * Optional phase split. When all three ranges are present, playback runs:
   *   enter (one-shot) → loop (ping-pong) → exit (one-shot on request)
   * When absent, playback falls back to a flat loop over playbackFrames.
   */
  enterRange?: FrameRange;
  loopRange?: FrameRange;
  exitRange?: FrameRange;
  /**
   * Per-phase frame-rate multipliers. Only apply to enter and exit phases
   * (the loop always plays at the manifest's base fps × playbackSpeed so the
   * sustained animation reads consistently). Defaults to 1.
   */
  enterSpeed?: number;
  exitSpeed?: number;
  anchorPoint: { x: number; y: number };
};

export type MascotAssetDescriptor =
  | { kind: "placeholder"; src: string; alt: string }
  | { kind: "atlas"; manifest: MascotAtlasManifest; alt: string };

export type MascotDebugSnapshot = {
  currentState: MascotState;
  elapsedMs: number;
  dwellRemainingMs: number;
  isReducedMotion: boolean;
  isMounted: boolean;
  playbackSpeed: PlaybackSpeed;
  controls: MotionControls;
  /**
   * True when the FSM wants to leave `hover` for an idle state but is waiting
   * for the hover atlas's exit phase to finish playing. The SpriteAtlas reads
   * this and starts its exit range; on completion it fires the exit callback,
   * which flips this back to false and transitions to idle.
   */
  hoverExiting: boolean;
};

export type MascotFSMApi = MascotDebugSnapshot & {
  onHover: () => void;
  onHoverLeave: () => void;
  onSend: () => void;
  /**
   * Called by the SpriteAtlas when the hover exit phase finishes playing.
   * The FSM then transitions from hover → idle_1.
   */
  onHoverExitComplete: () => void;
  forceState: (state: MascotState) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setReducedMotionPreview: (value: boolean) => void;
  setControl: <K extends keyof MotionControls>(key: K, value: MotionControls[K]) => void;
};
