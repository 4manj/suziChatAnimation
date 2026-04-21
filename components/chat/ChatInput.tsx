"use client";

import { useId } from "react";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onHover: () => void;
  onHoverLeave: () => void;
  onSend: () => void;
};

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5">
      <path d="M10 4.25v11.5M4.25 10h11.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" />
    </svg>
  );
}

function ChipIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4.5 w-4.5">
      <rect x="5.25" y="5.25" width="9.5" height="9.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 1.75v2.5M10 15.75v2.5M1.75 10h2.5M15.75 10h2.5M4.1 4.1l1.25 1.25M14.65 14.65l1.25 1.25M15.9 4.1l-1.25 1.25M5.35 14.65 4.1 15.9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5">
      <path d="M10 15.75V4.25M5.25 9l4.75-4.75L14.75 9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
    </svg>
  );
}

export function ChatInput({ value, onChange, onHover, onHoverLeave, onSend }: ChatInputProps) {
  const inputId = useId();

  return (
    <div
      className="chat-shell relative z-30 w-full max-w-[1000px]"
      onMouseEnter={onHover}
      onMouseLeave={onHoverLeave}
    >
      <div className="chat-surface flex flex-col gap-4 px-5 pt-5 pb-3 sm:px-6 sm:pt-6">
        <label htmlFor={inputId} className="sr-only">
          Trade input
        </label>
        <input
          id={inputId}
          type="text"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onHover}
          onBlur={onHoverLeave}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="Trade anything! or / for skills and @ for actions"
          className="h-8 w-full min-w-0 bg-transparent px-1 text-[15px] text-white placeholder:text-[#b6b1c6] outline-none sm:text-base"
        />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Add attachment"
              className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/4 text-white/82 transition-colors duration-150 ease-out hover:bg-white/8"
            >
              <PlusIcon />
            </button>

            <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-white/88">
              <ChipIcon />
              <span>X-High</span>
            </div>
          </div>

          <button
            type="button"
            aria-label="Send message"
            onClick={onSend}
            className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-colors duration-150 ease-out hover:bg-white/10 hover:text-white"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
