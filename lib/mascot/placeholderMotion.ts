import type { CSSProperties } from "react";
import type { MascotState, MotionControls } from "@/lib/mascot/types";

type MotionDescriptor = {
  wrapperClassName: string;
  style: CSSProperties;
};

const bobKeyframes = `
  @keyframes mascot-bob {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(calc(var(--bob-amplitude) * -1)); }
  }
  @keyframes mascot-wobble {
    0%, 100% { transform: scaleX(1); }
    45% { transform: scaleX(1.02); }
    65% { transform: scaleX(1.005); }
  }
  @keyframes mascot-tilt {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(3deg); }
  }
  @keyframes mascot-send {
    0% { transform: translateY(0px); opacity: 1; }
    32% { transform: translateY(-20px); opacity: 1; }
    100% { transform: translateY(40px); opacity: 0; }
  }
`;

export function getPlaceholderMotionStyles(): string {
  return bobKeyframes;
}

export function getPlaceholderMotion(
  state: MascotState,
  controls: MotionControls,
  reducedMotion: boolean,
): MotionDescriptor {
  const baseStyle = {
    "--bob-amplitude": `${controls.bobAmplitude}px`,
    "--hover-lift": `${controls.hoverLift}px`,
  } as CSSProperties;

  if (reducedMotion) {
    return {
      wrapperClassName: "translate-y-0 scale-100 rotate-0 opacity-100 shadow-none",
      style: baseStyle,
    };
  }

  switch (state) {
    case "idle_1":
      return {
        wrapperClassName: "motion-safe:[animation:mascot-bob_2s_ease-in-out_infinite]",
        style: baseStyle,
      };
    case "idle_2":
      return {
        wrapperClassName: "motion-safe:[animation:mascot-wobble_3s_ease-in-out_infinite]",
        style: baseStyle,
      };
    case "idle_3":
      return {
        wrapperClassName: "origin-bottom motion-safe:[animation:mascot-tilt_2s_ease-in-out_infinite]",
        style: baseStyle,
      };
    case "hover":
      return {
        wrapperClassName:
          "translate-y-[calc(var(--hover-lift)*-1)] scale-[1.05] drop-shadow-[0_16px_26px_rgba(255,110,202,0.28)]",
        style: baseStyle,
      };
    case "send_success":
      return {
        wrapperClassName: "motion-safe:[animation:mascot-send_800ms_cubic-bezier(0,0,0.2,1)_forwards]",
        style: baseStyle,
      };
  }
}
