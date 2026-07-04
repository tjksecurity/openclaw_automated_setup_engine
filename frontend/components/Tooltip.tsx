"use client";

import { useEffect, useId, useRef, useState } from "react";

// Accessible tooltip that:
//  - shows on hover on desktop
//  - shows on tap on touchscreens / mobile (tap outside to dismiss)
//  - is keyboard focusable (tab to the "?" and read via screen reader)
//
// Kept dependency-free — no floating-ui, no portal. Positioned above the
// trigger with a small offset; falls below if the tooltip would clip the top
// of the viewport.

export function Tooltip({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [below, setBelow] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const id = useId();

  // Close on outside click (mobile tap-away).
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!bubbleRef.current || !triggerRef.current) return;
      const t = e.target as Node;
      if (bubbleRef.current.contains(t) || triggerRef.current.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Reposition below if we'd clip the viewport top.
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setBelow(rect.top < 80);
  }, [open]);

  return (
    <span className={`relative inline-flex items-center ${className ?? ""}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label="What is this?"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 text-[10px] leading-none text-zinc-400 hover:text-zinc-100 hover:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      >
        ?
      </button>
      {open && (
        <div
          ref={bubbleRef}
          role="tooltip"
          id={id}
          className={`absolute z-50 left-1/2 -translate-x-1/2 w-64 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs leading-snug text-zinc-200 shadow-xl ${
            below ? "top-6" : "bottom-6"
          }`}
        >
          {text}
        </div>
      )}
    </span>
  );
}
