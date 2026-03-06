'use client';

import { useEffect, useRef } from 'react';

const CHARS = '01';
const FONT_SIZE = 14;
const FADE_ALPHA = 0.04;
const DROP_SPEED_MIN = 0.3;
const DROP_SPEED_MAX = 1.2;

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let columns: number;
    let drops: number[];
    let speeds: number[];

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      columns = Math.floor(canvas!.width / FONT_SIZE);
      drops = Array.from({ length: columns }, () => Math.random() * -100);
      speeds = Array.from({ length: columns }, () =>
        DROP_SPEED_MIN + Math.random() * (DROP_SPEED_MAX - DROP_SPEED_MIN)
      );
    }

    resize();
    window.addEventListener('resize', resize);

    function draw() {
      ctx!.fillStyle = `rgba(0, 0, 0, ${FADE_ALPHA})`;
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);

      for (let i = 0; i < columns; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        const x = i * FONT_SIZE;
        const y = drops[i] * FONT_SIZE;

        // Brighter head character
        const brightness = Math.random() * 0.3 + 0.7;
        ctx!.fillStyle = `rgba(0, 255, 0, ${brightness * 0.35})`;
        ctx!.font = `${FONT_SIZE}px monospace`;
        ctx!.fillText(char, x, y);

        // Dimmer trail character one step behind
        if (drops[i] > 1) {
          const trailChar = CHARS[Math.floor(Math.random() * CHARS.length)];
          ctx!.fillStyle = `rgba(0, 255, 0, 0.12)`;
          ctx!.fillText(trailChar, x, (drops[i] - 1) * FONT_SIZE);
        }

        drops[i] += speeds[i];

        // Reset when off screen, with random delay
        if (drops[i] * FONT_SIZE > canvas!.height && Math.random() > 0.975) {
          drops[i] = Math.random() * -20;
          speeds[i] = DROP_SPEED_MIN + Math.random() * (DROP_SPEED_MAX - DROP_SPEED_MIN);
        }
      }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.6 }}
    />
  );
}
