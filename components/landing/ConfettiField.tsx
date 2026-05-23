"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

const BASE_CONFETTI = [
  { x: 6, delay: -1.2, duration: 8.4, color: "#F5C451", w: 7, h: 18 },
  { x: 11, delay: -4.1, duration: 9.1, color: "#4DD8FF", w: 5, h: 14 },
  { x: 17, delay: -7.4, duration: 10.2, color: "#FF4D3D", w: 8, h: 17 },
  { x: 23, delay: -2.8, duration: 7.6, color: "#F8F5EC", w: 5, h: 16 },
  { x: 29, delay: -5.3, duration: 9.8, color: "#35D06E", w: 8, h: 15 },
  { x: 34, delay: -0.7, duration: 8.9, color: "#F5C451", w: 6, h: 19 },
  { x: 39, delay: -6.2, duration: 11.3, color: "#4DD8FF", w: 6, h: 16 },
  { x: 44, delay: -3.6, duration: 8.1, color: "#FF4D3D", w: 9, h: 14 },
  { x: 49, delay: -8.8, duration: 10.9, color: "#F5C451", w: 5, h: 18 },
  { x: 54, delay: -1.9, duration: 9.3, color: "#F8F5EC", w: 7, h: 15 },
  { x: 59, delay: -5.9, duration: 8.5, color: "#35D06E", w: 6, h: 17 },
  { x: 63, delay: -4.5, duration: 10.6, color: "#F5C451", w: 8, h: 18 },
  { x: 68, delay: -7.1, duration: 9.6, color: "#4DD8FF", w: 5, h: 15 },
  { x: 73, delay: -2.2, duration: 8.8, color: "#FF4D3D", w: 8, h: 16 },
  { x: 78, delay: -6.7, duration: 11.2, color: "#F8F5EC", w: 6, h: 18 },
  { x: 83, delay: -3.1, duration: 9.9, color: "#35D06E", w: 7, h: 14 },
  { x: 88, delay: -8.2, duration: 10.4, color: "#F5C451", w: 8, h: 17 },
  { x: 94, delay: -4.8, duration: 8.6, color: "#4DD8FF", w: 5, h: 16 },
  { x: 14, delay: -9.4, duration: 12.2, color: "#F5C451", w: 4, h: 12 },
  { x: 32, delay: -10.7, duration: 13.1, color: "#FF4D3D", w: 5, h: 13 },
  { x: 52, delay: -11.5, duration: 12.8, color: "#F8F5EC", w: 4, h: 14 },
  { x: 71, delay: -9.9, duration: 13.6, color: "#35D06E", w: 5, h: 12 },
  { x: 91, delay: -12.4, duration: 12.5, color: "#F5C451", w: 4, h: 13 },
];

const BURST_COLORS = ["#F5C451", "#4DD8FF", "#FF4D3D", "#F8F5EC", "#35D06E"];

type BurstPiece = {
  id: number;
  x: number;
  delay: number;
  duration: number;
  color: string;
  w: number;
  h: number;
  drift: number;
  spin: number;
};

function createBurstPieces(count: number, startId: number): BurstPiece[] {
  return Array.from({ length: count }, (_, index) => ({
    id: startId + index,
    x: Math.random() * 100,
    delay: Math.random() * 0.2,
    duration: 2.8 + Math.random() * 1.6,
    color: BURST_COLORS[index % BURST_COLORS.length],
    w: 4 + Math.random() * 7,
    h: 10 + Math.random() * 14,
    drift: (Math.random() - 0.5) * 140,
    spin: (Math.random() - 0.5) * 900,
  }));
}

export function ConfettiField() {
  const [burstPieces, setBurstPieces] = useState<BurstPiece[]>([]);
  const nextId = useRef(0);
  const cleanupTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const triggerBurst = useCallback(() => {
    const burstId = nextId.current;
    nextId.current += 120;

    const pieces = createBurstPieces(120, burstId);
    setBurstPieces((current) => [...current, ...pieces]);

    const timer = setTimeout(() => {
      setBurstPieces((current) =>
        current.filter((piece) => piece.id < burstId || piece.id >= burstId + 120),
      );
      cleanupTimers.current.delete(burstId);
    }, 4800);

    cleanupTimers.current.set(burstId, timer);
  }, []);

  useEffect(() => {
    const handleClick = () => {
      triggerBurst();
    };

    window.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("click", handleClick);
      cleanupTimers.current.forEach((timer) => clearTimeout(timer));
      cleanupTimers.current.clear();
    };
  }, [triggerBurst]);

  return (
    <div className="confetti-field" aria-hidden="true">
      {BASE_CONFETTI.map((piece, index) => (
        <span
          key={`base-${piece.x}-${index}`}
          className="confetti-piece"
          style={
            {
              "--x": `${piece.x}%`,
              "--delay": `${piece.delay}s`,
              "--duration": `${piece.duration}s`,
              "--color": piece.color,
              "--w": `${piece.w}px`,
              "--h": `${piece.h}px`,
              "--drift": `${index % 2 === 0 ? 42 : -38}px`,
              "--spin": `${index % 3 === 0 ? 420 : -360}deg`,
            } as CSSProperties
          }
        />
      ))}

      {burstPieces.map((piece) => (
        <span
          key={piece.id}
          className="confetti-piece confetti-piece--burst"
          style={
            {
              "--x": `${piece.x}%`,
              "--delay": `${piece.delay}s`,
              "--duration": `${piece.duration}s`,
              "--color": piece.color,
              "--w": `${piece.w}px`,
              "--h": `${piece.h}px`,
              "--drift": `${piece.drift}px`,
              "--spin": `${piece.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
