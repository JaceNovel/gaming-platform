"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface FlightConfig {
  id: number;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
}

const ANIMATION_DURATION = 900;

const getVisibleCartRect = () => {
  if (typeof document === "undefined") return null;
  const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]"));
  for (const element of candidates) {
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      continue;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    return rect;
  }
  return null;
};

export function useCartFlight() {
  const [flights, setFlights] = useState<FlightConfig[]>([]);
  const counterRef = useRef(0);
  const timeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const triggerFlight = useCallback((originElement?: HTMLElement | null) => {
    if (typeof document === "undefined") return;
    const targetRect = getVisibleCartRect();
    if (!targetRect) return;
    const originRect = originElement?.getBoundingClientRect() ?? targetRect;
    const startX = originRect.left + originRect.width / 2;
    const startY = originRect.top + originRect.height / 2;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;
    const id = counterRef.current++;
    setFlights((prev) => [...prev, { id, startX, startY, deltaX: endX - startX, deltaY: endY - startY }]);
    timeoutsRef.current[id] = setTimeout(() => {
      setFlights((prev) => prev.filter((flight) => flight.id !== id));
      delete timeoutsRef.current[id];
    }, ANIMATION_DURATION);
  }, []);

  useEffect(() => {
    return () => {
      Object.values(timeoutsRef.current).forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, []);

  const overlay = useMemo(
    () => (
      <div className="pointer-events-none fixed inset-0 z-[95]">
        {flights.map((flight) => (
          <span
            key={flight.id}
            className="cart-flight-dot"
            style={{
              left: `${flight.startX}px`,
              top: `${flight.startY}px`,
              ["--cart-flight-dx" as "--cart-flight-dx"]: `${flight.deltaX}px`,
              ["--cart-flight-dy" as "--cart-flight-dy"]: `${flight.deltaY}px`,
            }}
          />
        ))}
      </div>
    ),
    [flights],
  );

  return { triggerFlight, overlay };
}
