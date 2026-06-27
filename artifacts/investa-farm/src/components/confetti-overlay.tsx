/**
 * Lightweight canvas confetti burst — no dependencies.
 * Call showConfetti() anywhere after a major success.
 */

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; color: string; rotation: number; rotationSpeed: number;
  opacity: number; shape: "rect" | "circle" | "star";
}

const COLORS = [
  "#16a34a", "#22c55e", "#4ade80",
  "#f59e0b", "#fbbf24", "#fde68a",
  "#ffffff", "#d1fae5", "#a7f3d0",
  "#34d399", "#059669", "#f97316",
];

function createParticle(canvasW: number, canvasH: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 4 + Math.random() * 8;
  return {
    x: canvasW / 2 + (Math.random() - 0.5) * canvasW * 0.3,
    y: canvasH * 0.35 + Math.random() * canvasH * 0.1,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 6,
    size: 4 + Math.random() * 8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.2,
    opacity: 1,
    shape: (["rect", "circle", "star"] as const)[Math.floor(Math.random() * 3)],
  };
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const angle2 = angle + (2 * Math.PI) / 10;
    if (i === 0) ctx.moveTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
    else ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
    ctx.lineTo(x + (r / 2) * Math.cos(angle2), y + (r / 2) * Math.sin(angle2));
  }
  ctx.closePath();
}

export function showConfetti(durationMs = 3500) {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = `
    position:fixed; top:0; left:0; width:100%; height:100%;
    pointer-events:none; z-index:99999;
  `;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d")!;
  const particles: Particle[] = Array.from({ length: 90 }, () =>
    createParticle(canvas.width, canvas.height)
  );

  let frame: number;
  const gravity = 0.25;
  const startTime = Date.now();

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const elapsed = Date.now() - startTime;
    const progress = elapsed / durationMs;

    for (const p of particles) {
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.vx *= 0.99;
      p.opacity = Math.max(0, 1 - progress * 1.2);

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.shape === "circle") {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        drawStar(ctx, 0, 0, p.size / 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (elapsed < durationMs) {
      frame = requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  }

  frame = requestAnimationFrame(tick);

  setTimeout(() => {
    cancelAnimationFrame(frame);
    canvas.remove();
  }, durationMs + 200);
}
