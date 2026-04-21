"use client";

import type { MascotFSMApi, MascotState, PlaybackSpeed } from "@/lib/mascot/types";

const forceStates: MascotState[] = ["idle_1", "idle_2", "idle_3", "hover", "send_success"];
const speeds: PlaybackSpeed[] = [0.25, 0.5, 1];

type DevPanelProps = {
  fsm: MascotFSMApi;
};

export function DevPanel({ fsm }: DevPanelProps) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <aside className="fixed right-4 top-4 z-30 w-[320px] rounded-3xl border border-white/10 bg-black/70 p-4 text-white shadow-2xl backdrop-blur-xl">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[#ff9fda]">Mascot Dev Panel</p>
        <p className="mt-1 text-sm text-white/70">Drive the FSM manually and preview motion parameters.</p>
      </div>

      <div className="space-y-4 text-sm">
        <section>
          <p className="mb-2 text-white/65">Force state</p>
          <div className="grid grid-cols-2 gap-2">
            {forceStates.map((state) => (
              <button
                key={state}
                type="button"
                onClick={() => fsm.forceState(state)}
                className="focus-ring min-h-10 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left text-white/86 transition-colors duration-150 ease-out hover:bg-white/10"
              >
                {state}
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 text-white/65">Events</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={fsm.onHover} className="focus-ring min-h-10 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10">onHover</button>
            <button type="button" onClick={fsm.onHoverLeave} className="focus-ring min-h-10 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10">onHoverLeave</button>
            <button type="button" onClick={fsm.onSend} className="focus-ring col-span-2 min-h-10 rounded-2xl border border-white/10 bg-[#ff6cbf]/20 px-3 py-2 hover:bg-[#ff6cbf]/28">onSend</button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-white/60">state</span>
            <span>{fsm.currentState}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-white/60">elapsed</span>
            <span>{fsm.elapsedMs}ms</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-white/60">dwell lock</span>
            <span>{fsm.dwellRemainingMs}ms</span>
          </div>
        </section>

        <section>
          <p className="mb-2 text-white/65">Playback speed</p>
          <div className="grid grid-cols-3 gap-2">
            {speeds.map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => fsm.setPlaybackSpeed(speed)}
                className={`focus-ring min-h-10 rounded-2xl border px-3 py-2 ${
                  fsm.playbackSpeed === speed ? "border-[#ff84cb] bg-[#ff84cb]/18" : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <span>Reduced motion preview</span>
            <input
              type="checkbox"
              checked={fsm.isReducedMotion}
              onChange={(event) => fsm.setReducedMotionPreview(event.target.checked)}
              className="h-4 w-4 accent-[#ff78c8]"
            />
          </label>

          <div>
            <label className="mb-1 block text-white/65" htmlFor="bobAmplitude">Idle bob amplitude</label>
            <input id="bobAmplitude" type="range" min="0" max="12" value={fsm.controls.bobAmplitude} onChange={(event) => fsm.setControl("bobAmplitude", Number(event.target.value))} className="w-full accent-[#ff78c8]" />
          </div>
          <div>
            <label className="mb-1 block text-white/65" htmlFor="hoverLift">Hover lift offset</label>
            <input id="hoverLift" type="range" min="0" max="20" value={fsm.controls.hoverLift} onChange={(event) => fsm.setControl("hoverLift", Number(event.target.value))} className="w-full accent-[#ff78c8]" />
          </div>
          <div>
            <label className="mb-1 block text-white/65" htmlFor="crossfadeMs">Crossfade duration</label>
            <input id="crossfadeMs" type="range" min="0" max="300" value={fsm.controls.crossfadeMs} onChange={(event) => fsm.setControl("crossfadeMs", Number(event.target.value))} className="w-full accent-[#ff78c8]" />
          </div>
        </section>
      </div>
    </aside>
  );
}
