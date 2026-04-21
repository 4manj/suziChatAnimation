import type { MascotState } from "@/lib/mascot/types";

export type SpritePlaybackConfig = {
  state: MascotState;
  crossfadeMs: number;
  playbackSpeed: number;
};

export function getPlaybackConfig(config: SpritePlaybackConfig): SpritePlaybackConfig {
  return config;
}
