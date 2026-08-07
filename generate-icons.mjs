// Run: node generate-icons.mjs
// Generates icon-192.png, icon-512.png, apple-touch-icon.png in public/
import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = size * 0.12; // corner radius

  // Background rounded rect
  ctx.fillStyle = '#1C2B3A';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  const cx = size / 2;
  const cy = size / 2;
  const ballR = size * 0.3;

  // Ball base circle
  ctx.beginPath();
  ctx.arc(cx, cy, ballR, 0, Math.PI * 2);
  ctx.fillStyle = '#F2B705';
  ctx.fill();

  // Ball panel lines
  ctx.strokeStyle = '#1C2B3A';
  ctx.lineWidth = size * 0.03;

  // Vertical center line
  ctx.beginPath();
  ctx.moveTo(cx, cy - ballR);
  ctx.lineTo(cx, cy + ballR);
  ctx.stroke();

  // Horizontal center line
  ctx.beginPath();
  ctx.moveTo(cx - ballR, cy);
  ctx.lineTo(cx + ballR, cy);
  ctx.stroke();

  // Curved left panel line
  ctx.beginPath();
  ctx.arc(cx - ballR * 0.5, cy, ballR * 0.87, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();

  // Curved right panel line
  ctx.beginPath();
  ctx.arc(cx + ballR * 0.5, cy, ballR * 0.87, Math.PI * 0.5, -Math.PI * 0.5);
  ctx.stroke();

  // Clip to ball
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, ballR, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = '#1C2B3A';
  ctx.lineWidth = size * 0.025;
  ctx.stroke();
  ctx.restore();

  return canvas.toBuffer('image/png');
}

mkdirSync(join(__dirname, 'public'), { recursive: true });

writeFileSync(join(__dirname, 'public', 'icon-192.png'), drawIcon(192));
writeFileSync(join(__dirname, 'public', 'icon-512.png'), drawIcon(512));
writeFileSync(join(__dirname, 'public', 'apple-touch-icon.png'), drawIcon(180));

console.log('Icons generated in public/');
