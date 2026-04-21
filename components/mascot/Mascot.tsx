"use client";

import Image from "next/image";
import { mascotAssets } from "@/lib/mascot/assets";
import { SEND_SUCCESS_MS } from "@/lib/mascot/fsm";
import { getPlaybackConfig } from "@/lib/mascot/playback";
import { getPlaceholderMotion, getPlaceholderMotionStyles } from "@/lib/mascot/placeholderMotion";
import { SpriteAtlas } from "@/components/mascot/SpriteAtlas";
import type { MascotState, MotionControls } from "@/lib/mascot/types";

type MascotProps = {
  state: MascotState;
  controls: MotionControls;
  reducedMotion: boolean;
  crossfadeMs: number;
  playbackSpeed: number;
  visible: boolean;
  hoverExiting: boolean;
  onHoverExitComplete: () => void;
};

const RENDER_SIZE = 180;

// Atlas URLs used anywhere in the asset map — preloaded on mount so state swaps
// never fetch mid-transition (which would paint an empty frame while loading).
const atlasUrls = Array.from(
  new Set(
    Object.values(mascotAssets)
      .filter((a): a is Extract<typeof a, { kind: "atlas" }> => a.kind === "atlas")
      .map((a) => a.manifest.atlas),
  ),
);

function AtlasPreloader() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        overflow: "hidden",
        opacity: 0,
        pointerEvents: "none",
      }}
    >
      {atlasUrls.map((url) => (
        <img key={url} src={url} alt="" decoding="async" />
      ))}
    </div>
  );
}

export function Mascot({
  state,
  controls,
  reducedMotion,
  crossfadeMs,
  playbackSpeed,
  visible,
  hoverExiting,
  onHoverExitComplete,
}: MascotProps) {
  if (!visible) {
    return null;
  }

  const asset = mascotAssets[state];
  const playback = getPlaybackConfig({
    state,
    crossfadeMs,
    playbackSpeed,
  });
  const motion = getPlaceholderMotion(state, controls, reducedMotion);

  const isSending = state === "send_success";
  const sendFade = isSending && !reducedMotion;
  // Keep the fade in sync with useMascotFSM's unmount timer, which also
  // divides SEND_SUCCESS_MS by playbackSpeed when the dev panel slows
  // playback down.
  const sendFadeMs = SEND_SUCCESS_MS / Math.max(0.01, playbackSpeed);

  return (
    <>
      <style>{getPlaceholderMotionStyles()}</style>
      <style>{`
        @keyframes suzi-send-fade {
          0%, 50% { opacity: 1; }
          100%   { opacity: 0; }
        }
      `}</style>
      <AtlasPreloader />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-4 -top-[115px] z-10 h-[180px] w-[180px] select-none sm:right-8"
        style={{
          // First 50% of the send_success clip: opacity 1 (crouch reads
          // clearly). Second 50%: fade to 0 so she dissolves as she dips
          // below the chat-box edge.
          opacity: sendFade ? undefined : isSending ? 0 : 1,
          animation: sendFade
            ? `suzi-send-fade ${sendFadeMs}ms linear forwards`
            : undefined,
        }}
      >
        {asset.kind === "atlas" ? (
          <SpriteAtlas
            key={asset.manifest.id}
            manifest={asset.manifest}
            renderSize={RENDER_SIZE}
            playbackSpeed={playbackSpeed}
            reducedMotion={reducedMotion}
            exitRequested={state === "hover" && hoverExiting}
            onExitComplete={onHoverExitComplete}
          />
        ) : (
          <div
            className={`relative h-full w-full origin-bottom transition-[transform,opacity,filter] ease-out ${motion.wrapperClassName}`}
            style={{
              ...motion.style,
              transitionDuration: reducedMotion ? "0ms" : `${playback.crossfadeMs}ms`,
              animationDuration:
                reducedMotion || playback.state === "send_success"
                  ? undefined
                  : `${Math.max(250, 1000 / playback.playbackSpeed)}ms`,
            }}
          >
            <Image
              src={asset.src}
              alt={asset.alt}
              width={180}
              height={180}
              priority
              className="h-full w-full object-contain"
            />
          </div>
        )}
      </div>
    </>
  );
}
