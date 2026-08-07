// node generate-icons.mjs
import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const cx = size / 2;
  const cy = size / 2;
  const ballR = size * 0.34;
  const bgR = size * 0.22; // corner radius for rounded square

  // ── Rounded square background ──
  ctx.fillStyle = '#1C2B3A';
  ctx.beginPath();
  ctx.moveTo(bgR, 0);
  ctx.lineTo(size - bgR, 0);
  ctx.quadraticCurveTo(size, 0, size, bgR);
  ctx.lineTo(size, size - bgR);
  ctx.quadraticCurveTo(size, size, size - bgR, size);
  ctx.lineTo(bgR, size);
  ctx.quadraticCurveTo(0, size, 0, size - bgR);
  ctx.lineTo(0, bgR);
  ctx.quadraticCurveTo(0, 0, bgR, 0);
  ctx.closePath();
  ctx.fill();

  // ── Ball shadow ──
  const shadowGrad = ctx.createRadialGradient(cx + ballR * 0.1, cy + ballR * 0.15, ballR * 0.1, cx, cy, ballR * 1.1);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.beginPath();
  ctx.arc(cx, cy, ballR * 1.05, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fill();

  // ── Ball base with radial gradient (3D sheen) ──
  const ballGrad = ctx.createRadialGradient(cx - ballR * 0.3, cy - ballR * 0.3, ballR * 0.05, cx, cy, ballR);
  ballGrad.addColorStop(0, '#FFE066');   // bright highlight
  ballGrad.addColorStop(0.45, '#F2B705'); // main yellow
  ballGrad.addColorStop(1, '#C88C00');   // dark edge

  ctx.beginPath();
  ctx.arc(cx, cy, ballR, 0, Math.PI * 2);
  ctx.fillStyle = ballGrad;
  ctx.fill();

  // ── Panel lines (classic volleyball: 3 curved bands) ──
  // Clip all lines to the ball circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, ballR - 1, 0, Math.PI * 2);
  ctx.clip();

  ctx.strokeStyle = '#1C2B3A';
  ctx.lineWidth = size * 0.028;
  ctx.lineCap = 'round';

  // Line 1: vertical S-curve through center
  ctx.beginPath();
  ctx.moveTo(cx, cy - ballR);
  ctx.bezierCurveTo(
    cx + ballR * 0.55, cy - ballR * 0.45,
    cx - ballR * 0.55, cy + ballR * 0.45,
    cx, cy + ballR
  );
  ctx.stroke();

  // Line 2: curves from top-left to right (rotated ~120°)
  ctx.beginPath();
  ctx.moveTo(cx - ballR * 0.87, cy - ballR * 0.5);
  ctx.bezierCurveTo(
    cx - ballR * 0.1,  cy - ballR * 0.85,
    cx + ballR * 0.55, cy + ballR * 0.1,
    cx + ballR * 0.87, cy + ballR * 0.5
  );
  ctx.stroke();

  // Line 3: curves from top-right to left (rotated ~240°)
  ctx.beginPath();
  ctx.moveTo(cx + ballR * 0.87, cy - ballR * 0.5);
  ctx.bezierCurveTo(
    cx + ballR * 0.1,  cy - ballR * 0.85,
    cx - ballR * 0.55, cy + ballR * 0.1,
    cx - ballR * 0.87, cy + ballR * 0.5
  );
  ctx.stroke();

  ctx.restore();

  // ── Specular highlight (top-left gloss) ──
  const gloss = ctx.createRadialGradient(
    cx - ballR * 0.38, cy - ballR * 0.38, 0,
    cx - ballR * 0.38, cy - ballR * 0.38, ballR * 0.42
  );
  gloss.addColorStop(0, 'rgba(255,255,255,0.38)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, ballR, 0, Math.PI * 2);
  ctx.fillStyle = gloss;
  ctx.fill();

  return canvas.toBuffer('image/png');
}

mkdirSync(join(__dirname, 'public'), { recursive: true });
writeFileSync(join(__dirname, 'public', 'icon-192.png'), drawIcon(192));
writeFileSync(join(__dirname, 'public', 'icon-512.png'), drawIcon(512));
writeFileSync(join(__dirname, 'public', 'apple-touch-icon.png'), drawIcon(180));
console.log('Icons generated.');
