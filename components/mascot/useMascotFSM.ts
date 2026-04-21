"use client";

import { useEffect, useMemo, useRef } from "react";
import { create } from "zustand";
import { mascotAssets } from "@/lib/mascot/assets";
import {
  canTransition,
  getNextIdleState,
  getIdleDuration,
  MIN_DWELL_MS,
  pickDesiredState,
  SEND_SUCCESS_MS,
} from "@/lib/mascot/fsm";
import type { MascotFSMApi, MascotState, MotionControls, PlaybackSpeed } from "@/lib/mascot/types";

function hasExitPhase(state: MascotState): boolean {
  const asset = mascotAssets[state];
  return asset.kind === "atlas" && Boolean(asset.manifest.exitRange);
}

type StoreState = {
  currentState: MascotState;
  stateStartedAt: number;
  isMounted: boolean;
  isHovered: boolean;
  reducedMotionPreview: boolean;
  playbackSpeed: PlaybackSpeed;
  controls: MotionControls;
  consecutiveIdle1Count: number;
  hoverExiting: boolean;
  setState: (state: Partial<StoreState>) => void;
};

const defaultControls: MotionControls = {
  bobAmplitude: 4,
  hoverLift: 8,
  crossfadeMs: 120,
};

const useMascotStore = create<StoreState>((set) => ({
  currentState: "idle_1",
  stateStartedAt: Date.now(),
  isMounted: true,
  isHovered: false,
  reducedMotionPreview: false,
  playbackSpeed: 1,
  controls: defaultControls,
  consecutiveIdle1Count: 1,
  hoverExiting: false,
  setState: (state) => set(state),
}));

function transitionTo(state: MascotState) {
  useMascotStore.setState((prev) => ({
    currentState: state,
    stateStartedAt: Date.now(),
    consecutiveIdle1Count:
      state === "idle_1" ? prev.consecutiveIdle1Count + 1 : 0,
    // Any transition clears the pending hover-exit flag — it's only meaningful
    // while current state is still hover and we're waiting for the atlas to
    // finish its exit phase.
    hoverExiting: false,
  }));
}

export function useMascotFSM(options?: { onSendComplete?: () => void; systemReducedMotion?: boolean }): MascotFSMApi {
  const currentState = useMascotStore((state) => state.currentState);
  const stateStartedAt = useMascotStore((state) => state.stateStartedAt);
  const isMounted = useMascotStore((state) => state.isMounted);
  const isHovered = useMascotStore((state) => state.isHovered);
  const reducedMotionPreview = useMascotStore((state) => state.reducedMotionPreview);
  const playbackSpeed = useMascotStore((state) => state.playbackSpeed);
  const controls = useMascotStore((state) => state.controls);
  const hoverExiting = useMascotStore((state) => state.hoverExiting);
  const idleTimer = useRef<number | null>(null);
  const sendTimer = useRef<number | null>(null);
  const onSendCompleteRef = useRef(options?.onSendComplete);

  const effectiveReducedMotion = (options?.systemReducedMotion ?? false) || reducedMotionPreview;

  useEffect(() => {
    onSendCompleteRef.current = options?.onSendComplete;
  }, [options?.onSendComplete]);

  const clearTimer = (ref: { current: number | null }) => {
    if (ref.current !== null) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const scheduleEvaluate = () => {
    const store = useMascotStore.getState();

    // send_success is terminal — no further re-evaluation until unmount.
    if (!store.isMounted || store.currentState === "send_success") {
      clearTimer(idleTimer);
      return;
    }

    const now = Date.now();
    const desired = pickDesiredState(store.currentState, now, {
      isHovered: store.isHovered,
      reducedMotion: effectiveReducedMotion,
    });
    const elapsed = now - store.stateStartedAt;

    // hover → idle is gated by the hover atlas's exit phase. Instead of
    // swapping manifests immediately, signal the SpriteAtlas to play its
    // exitRange and wait for onHoverExitComplete to fire. send_success
    // still preempts without waiting.
    if (
      store.currentState === "hover" &&
      desired.state.startsWith("idle") &&
      hasExitPhase("hover")
    ) {
      if (!store.hoverExiting) {
        useMascotStore.setState({ hoverExiting: true });
      }
      return;
    }

    // Mid-exit preemption: send_success takes over immediately; clear the
    // exit flag so SpriteAtlas stops trying to finish the phase.
    if (store.hoverExiting && !desired.state.startsWith("idle")) {
      useMascotStore.setState({ hoverExiting: false });
    }

    // Idle states are atomic — once an idle atlas starts playing, it runs to
    // the end of its loop before hover or another idle variant can take over.
    // send_success is the one exception: onSend() calls transitionTo directly
    // and skips this scheduler.
    if (store.currentState.startsWith("idle")) {
      if (effectiveReducedMotion) {
        clearTimer(idleTimer);
        return;
      }
      const totalDuration = getIdleDuration(store.currentState, store.playbackSpeed);
      const remaining = Math.max(50, totalDuration - elapsed);
      clearTimer(idleTimer);
      idleTimer.current = window.setTimeout(() => {
        const latest = useMascotStore.getState();
        if (!latest.currentState.startsWith("idle")) return;
        const nextDesired = pickDesiredState(latest.currentState, Date.now(), {
          isHovered: latest.isHovered,
          reducedMotion: effectiveReducedMotion,
        });
        if (!nextDesired.state.startsWith("idle")) {
          transitionTo(nextDesired.state);
          return;
        }
        const next = getNextIdleState(
          latest.currentState,
          latest.consecutiveIdle1Count,
        );
        transitionTo(next);
      }, remaining);
      return;
    }

    if (canTransition(store.currentState, desired.state, elapsed)) {
      transitionTo(desired.state);
      return;
    }

    // If a transition was rejected solely because dwell hasn't passed,
    // reschedule an evaluation right after dwell expires so we don't get
    // trapped in a state on a sub-300ms event sequence.
    if (desired.state !== store.currentState && elapsed < MIN_DWELL_MS) {
      clearTimer(idleTimer);
      idleTimer.current = window.setTimeout(() => {
        scheduleEvaluate();
      }, MIN_DWELL_MS - elapsed + 10);
      return;
    }
  };

  useEffect(() => {
    const store = useMascotStore.getState();
    if (!store.isMounted) {
      return;
    }

    // send_success is terminal. Schedule its unmount timer FIRST (before any
    // reduced-motion snap) so reduced motion can never preempt the terminal
    // state and rip the mascot back to idle mid-goodbye. The fixed duration
    // also scales with playbackSpeed so dev-panel slowdowns still let the
    // full clip finish before unmount.
    if (store.currentState === "send_success") {
      clearTimer(sendTimer);
      const unmountMs = SEND_SUCCESS_MS / Math.max(0.01, playbackSpeed);
      sendTimer.current = window.setTimeout(() => {
        useMascotStore.setState({ isMounted: false });
        onSendCompleteRef.current?.();
      }, unmountMs);
      return () => clearTimer(sendTimer);
    }

    // Reduced motion snaps to idle_1 and short-circuits. Falling through
    // to scheduleEvaluate would run with a stale pre-transition store
    // snapshot (currentState === "hover") and flip hoverExiting=true on an
    // idle_1 store — the audit's "stuck hoverExiting" bug.
    if (effectiveReducedMotion && store.currentState !== "idle_1") {
      transitionTo("idle_1");
      return;
    }

    scheduleEvaluate();

    return () => {
      clearTimer(idleTimer);
    };
  }, [
    effectiveReducedMotion,
    currentState,
    stateStartedAt,
    isHovered,
    isMounted,
    playbackSpeed,
  ]);

  useEffect(() => {
    // The zustand store is module-level. If a previous page session left it
    // in the dead terminal state (isMounted=false, currentState=send_success),
    // a later remount would short-circuit on !isMounted and never play again.
    // Reset the animation-relevant fields here while preserving dev-panel
    // knobs (playbackSpeed, reducedMotionPreview, controls).
    const store = useMascotStore.getState();
    if (!store.isMounted && store.currentState === "send_success") {
      useMascotStore.setState({
        currentState: "idle_1",
        stateStartedAt: Date.now(),
        isMounted: true,
        isHovered: false,
        hoverExiting: false,
        consecutiveIdle1Count: 1,
      });
    }
    return () => {
      clearTimer(idleTimer);
      clearTimer(sendTimer);
    };
  }, []);

  const api = useMemo<MascotFSMApi>(() => {
    const elapsedMs = Date.now() - stateStartedAt;
    const dwellRemainingMs =
      currentState === "send_success" ? 0 : Math.max(0, MIN_DWELL_MS - elapsedMs);

    return {
      currentState,
      elapsedMs,
      dwellRemainingMs,
      isReducedMotion: effectiveReducedMotion,
      isMounted,
      playbackSpeed,
      controls,
      hoverExiting,
      onHoverExitComplete: () => {
        const store = useMascotStore.getState();
        // If the hover exit finished but the user re-hovered in the meantime,
        // the flag is already false — nothing to do; the next evaluate cycle
        // will have re-entered hover normally. Otherwise, clear the flag and
        // drop to idle_1; the idle-rotation timer takes it from there.
        if (!store.hoverExiting) return;
        transitionTo("idle_1");
      },
      onHover: () => {
        useMascotStore.setState({ isHovered: true });
        scheduleEvaluate();
      },
      onHoverLeave: () => {
        useMascotStore.setState({ isHovered: false });
        scheduleEvaluate();
      },
      onSend: () => {
        // Already terminal — a second onSend must not reset stateStartedAt
        // and push the unmount window further out.
        if (useMascotStore.getState().currentState === "send_success") return;
        useMascotStore.setState({ isHovered: false });
        transitionTo("send_success");
      },
      forceState: (state) => {
        useMascotStore.setState({ isMounted: true });
        transitionTo(state);
      },
      setPlaybackSpeed: (speed) => {
        useMascotStore.setState({ playbackSpeed: speed });
      },
      setReducedMotionPreview: (value) => {
        useMascotStore.setState({ reducedMotionPreview: value });
      },
      setControl: (key, value) => {
        useMascotStore.setState({
          controls: {
            ...useMascotStore.getState().controls,
            [key]: value,
          },
        });
      },
    };
  }, [
    controls,
    currentState,
    effectiveReducedMotion,
    hoverExiting,
    isMounted,
    playbackSpeed,
    stateStartedAt,
  ]);

  return api;
}
