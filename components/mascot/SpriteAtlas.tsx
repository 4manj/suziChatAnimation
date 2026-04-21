"use client";

import { useEffect, useRef, useState } from "react";
import type { MascotAtlasManifest } from "@/lib/mascot/types";

type Phase = "enter" | "loop" | "exit" | "done";

type SpriteAtlasProps = {
  manifest: MascotAtlasManifest;
  renderSize: number;
  playbackSpeed: number;
  reducedMotion: boolean;
  /**
   * When true, finish the current motion by playing the exit phase once.
   * No-op on atlases without explicit phase ranges.
   */
  exitRequested?: boolean;
  /** Fires once when the exit phase finishes (reaches the last frame of exitRange). */
  onExitComplete?: () => void;
};

export function SpriteAtlas({
  manifest,
  renderSize,
  playbackSpeed,
  reducedMotion,
  exitRequested = false,
  onExitComplete,
}: SpriteAtlasProps) {
  const {
    atlas,
    frames,
    fps,
    cols,
    rows,
    entryFrame,
    enterRange,
    loopRange,
    exitRange,
    enterSpeed = 1,
    exitSpeed = 1,
    loop = true,
  } = manifest;
  const playable = manifest.playbackFrames ?? frames;
  const hasPhases = Boolean(enterRange && loopRange && exitRange);
  const initialFrame = hasPhases ? enterRange![0] : entryFrame;

  const [frameIndex, setFrameIndex] = useState(initialFrame);
  const phaseRef = useRef<Phase>(hasPhases ? "enter" : "loop");
  const dirRef = useRef<1 | -1>(1);
  const rafRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const exitReqRef = useRef(exitRequested);
  const onExitCompleteRef = useRef(onExitComplete);

  useEffect(() => {
    exitReqRef.current = exitRequested;
  }, [exitRequested]);

  useEffect(() => {
    onExitCompleteRef.current = onExitComplete;
  }, [onExitComplete]);

  useEffect(() => {
    setFrameIndex(initialFrame);
    phaseRef.current = hasPhases ? "enter" : "loop";
    dirRef.current = 1;
    lastTimeRef.current = 0;
  }, [atlas, initialFrame, hasPhases]);

  useEffect(() => {
    if (reducedMotion) {
      setFrameIndex(entryFrame);
      return;
    }
    const baseFrameDurationMs = 1000 / (fps * Math.max(0.01, playbackSpeed));
    const phaseDuration = (): number => {
      if (!hasPhases) return baseFrameDurationMs;
      const phase = phaseRef.current;
      if (phase === "enter") return baseFrameDurationMs / Math.max(0.01, enterSpeed);
      if (phase === "exit") return baseFrameDurationMs / Math.max(0.01, exitSpeed);
      return baseFrameDurationMs;
    };

    const advance = (current: number, steps: number): number => {
      let next = current;
      for (let i = 0; i < steps; i++) {
        if (!hasPhases) {
          if (loop) {
            next = (next + 1) % playable;
          } else {
            next = Math.min(next + 1, playable - 1);
          }
          continue;
        }
        const [, ee] = enterRange!;
        const [ls, le] = loopRange!;
        const [xs, xe] = exitRange!;
        const phase = phaseRef.current;

        if (phase === "enter") {
          next = next + 1;
          if (next >= ee) {
            if (exitReqRef.current) {
              phaseRef.current = "exit";
              next = xs;
            } else {
              phaseRef.current = "loop";
              dirRef.current = 1;
              next = ls;
            }
          }
        } else if (phase === "loop") {
          if (exitReqRef.current) {
            phaseRef.current = "exit";
            next = xs;
            continue;
          }
          next = next + dirRef.current;
          if (next >= le - 1) {
            next = le - 1;
            dirRef.current = -1;
          } else if (next <= ls) {
            next = ls;
            dirRef.current = 1;
          }
        } else if (phase === "exit") {
          // Re-hover canceled the exit mid-phase — snap back to loop start.
          // The loop entry pose is adjacent to the exit entry pose, so the
          // jump reads fine even mid-exit. Without this, a re-hover while the
          // atlas is already in "exit" would play through to "done" and
          // freeze there, since the FSM has already cleared hoverExiting.
          if (!exitReqRef.current) {
            phaseRef.current = "loop";
            dirRef.current = 1;
            next = ls;
            continue;
          }
          next = next + 1;
          if (next >= xe - 1) {
            next = xe - 1;
            phaseRef.current = "done";
            onExitCompleteRef.current?.();
            break;
          }
        } else {
          // phase === "done". Normally the FSM transitions away on
          // onExitComplete, remounting this component. If it didn't (e.g.
          // the exit-complete callback fired the same tick as a re-hover
          // that cleared hoverExiting), self-heal back to loop instead of
          // holding the final exit frame indefinitely.
          if (!exitReqRef.current) {
            phaseRef.current = "loop";
            dirRef.current = 1;
            next = ls;
            continue;
          }
          next = xe - 1;
          break;
        }
      }
      return next;
    };

    const tick = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const frameDurationMs = phaseDuration();
      const delta = now - lastTimeRef.current;
      if (delta >= frameDurationMs) {
        const steps = Math.floor(delta / frameDurationMs);
        lastTimeRef.current = now;
        setFrameIndex((prev) => advance(prev, steps));
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = 0;
    };
  }, [
    atlas,
    fps,
    playable,
    entryFrame,
    playbackSpeed,
    reducedMotion,
    hasPhases,
    enterRange,
    loopRange,
    exitRange,
    enterSpeed,
    exitSpeed,
    loop,
  ]);

  const col = frameIndex % cols;
  const row = Math.floor(frameIndex / cols);

  return (
    <div
      aria-hidden="true"
      style={{
        width: renderSize,
        height: renderSize,
        backgroundImage: `url(${atlas})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${cols * renderSize}px ${rows * renderSize}px`,
        backgroundPosition: `-${col * renderSize}px -${row * renderSize}px`,
        imageRendering: "auto",
      }}
    />
  );
}
