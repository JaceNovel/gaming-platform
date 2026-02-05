import React from "react";

export default function AnimatedHomeBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-40">
      {/* Base animated nebula / gradient */}
      <div className="bb-home-bg-aurora absolute inset-0" aria-hidden="true" />

      {/* Stars: disabled on mobile for performance */}
      <div className="bb-home-bg-stars absolute inset-0 hidden sm:block" aria-hidden="true" />
      <div className="bb-home-bg-stars2 absolute inset-0 hidden sm:block" aria-hidden="true" />

      {/* Subtle grid shimmer (very light) */}
      <div className="bb-home-bg-grid absolute inset-0 opacity-0 sm:opacity-100" aria-hidden="true" />

      {/* Dark overlay for contrast */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/80"
        aria-hidden="true"
      />
    </div>
  );
}
