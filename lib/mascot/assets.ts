import type {
  MascotAssetDescriptor,
  MascotAtlasManifest,
  MascotState,
} from "@/lib/mascot/types";
import idle1Manifest from "@/public/mascot/idle_1/manifest.json";
import idle2Manifest from "@/public/mascot/idle_2/manifest.json";
import idle3Manifest from "@/public/mascot/idle_3/manifest.json";
import hoverManifest from "@/public/mascot/hover/manifest.json";
import sendSuccessManifest from "@/public/mascot/send_success/manifest.json";

export const mascotAssets: Record<MascotState, MascotAssetDescriptor> = {
  idle_1: {
    kind: "atlas",
    manifest: idle1Manifest as MascotAtlasManifest,
    alt: "Suzi mascot idle pose 1",
  },
  idle_2: {
    kind: "atlas",
    manifest: idle2Manifest as MascotAtlasManifest,
    alt: "Suzi mascot idle pose 2",
  },
  idle_3: {
    kind: "atlas",
    manifest: idle3Manifest as MascotAtlasManifest,
    alt: "Suzi mascot idle pose 3",
  },
  hover: {
    kind: "atlas",
    manifest: hoverManifest as MascotAtlasManifest,
    alt: "Suzi mascot hover pose",
  },
  send_success: {
    kind: "atlas",
    manifest: sendSuccessManifest as MascotAtlasManifest,
    alt: "Suzi mascot send success pose",
  },
};
