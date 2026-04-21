"use client";

import { useEffect, useState } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { Mascot } from "@/components/mascot/Mascot";
import { useMascotFSM } from "@/components/mascot/useMascotFSM";

export default function Page() {
  const [message, setMessage] = useState("");
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const fsm = useMascotFSM({
    systemReducedMotion,
    onSendComplete: () => setMessage(""),
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const send = () => {
    if (!message.trim()) {
      return;
    }
    fsm.onSend();
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-20 sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,102,184,0.18),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(155,109,255,0.16),transparent_24%)]" />
      <section className="relative z-10 flex w-full max-w-6xl flex-col items-center gap-8">
        <div className="flex w-full justify-center">
          <div className="relative w-full max-w-[1000px]">
            <Mascot
              state={fsm.currentState}
              controls={fsm.controls}
              reducedMotion={fsm.isReducedMotion}
              crossfadeMs={fsm.controls.crossfadeMs}
              playbackSpeed={fsm.playbackSpeed}
              visible={fsm.isMounted}
              hoverExiting={fsm.hoverExiting}
              onHoverExitComplete={fsm.onHoverExitComplete}
            />

            <ChatInput
              value={message}
              onChange={setMessage}
              onHover={fsm.onHover}
              onHoverLeave={fsm.onHoverLeave}
              onSend={send}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
