// node generate-icons.mjs
import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const cx = size / 2;
  const cy = size / 2;
  const R   = size * 0.355;
  const bgR = size * 0.22;

  // ── Background ──
  roundRect(ctx, 0, 0, size, size, bgR);
  ctx.fillStyle = '#1C2B3A';
  ctx.fill();

  // ── Clip to ball ──
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  // White band: straddles the equator
  // Top = 20% above center, Bottom = 20% below center (matches photo ~40% of diameter)
  const bT  = cy - R * 0.20;
  const bB  = cy + R * 0.20;
  const dT  = R * 0.07;   // top-edge droop at sides
  const dB  = R * 0.05;   // bottom-edge droop

  // ── LAYER 1: Yellow top (fills everything above white band) ──
  const yGrad = ctx.createRadialGradient(
    cx - R * 0.28, cy - R * 0.32, 0,
    cx,            cy,            R
  );
  yGrad.addColorStop(0,   '#FFE966');
  yGrad.addColorStop(0.4, '#F5C200');
  yGrad.addColorStop(1,   '#9A7200');
  ctx.fillStyle = yGrad;
  ctx.fillRect(cx - R - 1, cy - R - 1, (R + 1) * 2, (R + 1) * 2);

  // ── LAYER 2: Blue bottom (fills everything below white band) ──
  const blueGrad = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
  blueGrad.addColorStop(0,   '#1432A0');
  blueGrad.addColorStop(0.5, '#2550CC');
  blueGrad.addColorStop(1,   '#1432A0');

  ctx.fillStyle = blueGrad;
  ctx.beginPath();
  // Bottom edge of white band (= top of blue section)
  ctx.moveTo(cx - R, bB + dB);
  ctx.bezierCurveTo(cx - R*0.4, bB - dB*0.3, cx + R*0.4, bB - dB*0.3, cx + R, bB + dB);
  ctx.lineTo(cx + R, cy + R + 2);
  ctx.lineTo(cx - R, cy + R + 2);
  ctx.closePath();
  ctx.fill();

  // ── LAYER 3: Two yellow teardrop strips in the blue section ──
  // Each strip: pointed at top (where it meets white band), wider at ball bottom.
  // Placed symmetrically at ±0.33R from centre.
  const stripCentres = [cx - R * 0.33, cx + R * 0.33];
  const tipY  = bB + dB * 0.1;  // top of strip (just below white band)
  const botY  = cy + R + 2;
  const botHW = R * 0.195;       // half-width at ball bottom

  const topHW = R * 0.195;  // half-width at white band (wide end)
  const btHW  = R * 0.055;  // half-width at ball bottom (narrow end)

  stripCentres.forEach(scx => {
    const sGrad = ctx.createLinearGradient(scx - topHW, 0, scx + topHW, 0);
    sGrad.addColorStop(0,    '#9A7200');
    sGrad.addColorStop(0.25, '#F5C200');
    sGrad.addColorStop(0.5,  '#FFE454');
    sGrad.addColorStop(0.75, '#F5C200');
    sGrad.addColorStop(1,    '#9A7200');
    ctx.fillStyle = sGrad;

    // Wide at top (white band), narrows to a point at bottom
    ctx.beginPath();
    ctx.moveTo(scx - topHW, tipY);
    ctx.bezierCurveTo(scx - topHW, tipY + R*0.40,
                      scx - btHW,  botY - R*0.15, scx, botY);
    ctx.bezierCurveTo(scx + btHW,  botY - R*0.15,
                      scx + topHW, tipY + R*0.40, scx + topHW, tipY);
    ctx.closePath();
    ctx.fill();
  });

  // ── LAYER 4: White band (drawn on top to cover any overrun) ──
  ctx.fillStyle = '#F6F6F6';
  ctx.beginPath();
  ctx.moveTo(cx - R, bT + dT);
  ctx.bezierCurveTo(cx - R*0.4, bT - dT*0.1, cx + R*0.4, bT - dT*0.1, cx + R, bT + dT);
  ctx.lineTo(cx + R, bB + dB);
  ctx.bezierCurveTo(cx + R*0.4, bB - dB*0.3, cx - R*0.4, bB - dB*0.3, cx - R, bB + dB);
  ctx.closePath();
  ctx.fill();

  // ── LAYER 5: Seam lines ──
  ctx.strokeStyle = '#111111';
  ctx.lineCap = 'round';
  const sw = Math.max(1.5, size * 0.018);
  ctx.lineWidth = sw;

  // Top seam (yellow → white)
  ctx.beginPath();
  ctx.moveTo(cx - R, bT + dT);
  ctx.bezierCurveTo(cx - R*0.4, bT - dT*0.1, cx + R*0.4, bT - dT*0.1, cx + R, bT + dT);
  ctx.stroke();

  // Bottom seam (white → blue)
  ctx.beginPath();
  ctx.moveTo(cx - R, bB + dB);
  ctx.bezierCurveTo(cx + R*0.4, bB - dB*0.3, cx - R*0.4, bB - dB*0.3, cx - R, bB + dB);
  ctx.moveTo(cx - R, bB + dB);
  ctx.bezierCurveTo(cx - R*0.4, bB - dB*0.3, cx + R*0.4, bB - dB*0.3, cx + R, bB + dB);
  ctx.stroke();

  // Strip seams (left and right edge of each yellow strip)
  stripCentres.forEach(scx => {
    [-1, 1].forEach(sign => {
      const hw = sign * topHW;
      ctx.beginPath();
      ctx.moveTo(scx + hw, tipY);
      ctx.bezierCurveTo(scx + hw,        tipY + R*0.40,
                        scx + sign*btHW, botY - R*0.15, scx, botY);
      ctx.stroke();
    });
  });

  // ── LAYER 6: Specular gloss ──
  const gloss = ctx.createRadialGradient(
    cx - R*0.34, cy - R*0.40, 0,
    cx - R*0.34, cy - R*0.40, R * 0.50
  );
  gloss.addColorStop(0,    'rgba(255,255,255,0.48)');
  gloss.addColorStop(0.55, 'rgba(255,255,255,0.08)');
  gloss.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(cx - R - 1, cy - R - 1, (R + 1) * 2, (R + 1) * 2);

  ctx.restore();
  return canvas.toBuffer('image/png');
}

mkdirSync(join(__dirname, 'public'), { recursive: true });
writeFileSync(join(__dirname, 'public', 'icon-192.png'),         drawIcon(192));
writeFileSync(join(__dirname, 'public', 'icon-512.png'),         drawIcon(512));
writeFileSync(join(__dirname, 'public', 'apple-touch-icon.png'), drawIcon(180));
console.log('Icons generated.');
