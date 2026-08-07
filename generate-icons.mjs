// node generate-icons.mjs
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function makeIcon(ballImg, size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const bgR = size * 0.22; // iOS-style corner radius

  // ── Rounded square background (navy) ──
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
  ctx.fillStyle = '#1C2B3A';
  ctx.fill();

  // ── Find ball bounds in source image ──
  // The image is square with a white background and the ball centered.
  // We detect the ball by finding the first/last non-white row/column.
  const probe = createCanvas(ballImg.width, ballImg.height);
  const pctx = probe.getContext('2d');
  pctx.drawImage(ballImg, 0, 0);
  const data = pctx.getImageData(0, 0, ballImg.width, ballImg.height).data;

  const W = ballImg.width, H = ballImg.height;
  let minX = W, maxX = 0, minY = H, maxY = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
      // Non-white, non-transparent pixel = ball
      if (a > 30 && !(r > 240 && g > 240 && b > 240)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Add small padding around detected ball
  const pad = Math.round((maxX - minX) * 0.02);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(W - 1, maxX + pad);
  maxY = Math.min(H - 1, maxY + pad);

  // Make crop square (centered on ball)
  const bw = maxX - minX;
  const bh = maxY - minY;
  const side = Math.max(bw, bh);
  const cropX = Math.max(0, Math.round(minX + bw/2 - side/2));
  const cropY = Math.max(0, Math.round(minY + bh/2 - side/2));
  const cropS = Math.min(side, W - cropX, H - cropY);

  // ── Draw ball scaled to fit inside icon with padding ──
  const iconPad = size * 0.06;  // 6% padding around ball
  const ballSize = size - iconPad * 2;

  ctx.drawImage(
    ballImg,
    cropX, cropY, cropS, cropS,      // source: cropped square
    iconPad, iconPad, ballSize, ballSize  // dest: padded inside icon
  );

  return canvas.toBuffer('image/png');
}

const ballImg = await loadImage(join(__dirname, 'ball.png'));
mkdirSync(join(__dirname, 'public'), { recursive: true });

writeFileSync(join(__dirname, 'public', 'icon-192.png'),          makeIcon(ballImg, 192));
writeFileSync(join(__dirname, 'public', 'icon-512.png'),          makeIcon(ballImg, 512));
writeFileSync(join(__dirname, 'public', 'apple-touch-icon.png'),  makeIcon(ballImg, 180));

console.log('Icons generated from ball.png');
