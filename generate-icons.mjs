// node generate-icons.mjs
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function makeIcon(ballImg, size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Plain white background — iOS/Android applies its own corner mask
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  // ── Find ball bounds in source image ──
  // The image is square with a white background and the ball centered.
  // We detect the ball by finding the first/last non-white row/column.
  const probe = createCanvas(ballImg.width, ballImg.height);
  const pctx = probe.getContext('2d');
  pctx.drawImage(ballImg, 0, 0);
  const imgData = pctx.getImageData(0, 0, ballImg.width, ballImg.height);
  const data = imgData.data;

  const W = ballImg.width, H = ballImg.height;

  // Sample background color from the 4 corners (average)
  const corners = [[0,0],[W-1,0],[0,H-1],[W-1,H-1]];
  let cR = 0, cG = 0, cB = 0;
  corners.forEach(([x, y]) => {
    const i = (y * W + x) * 4;
    cR += data[i]; cG += data[i+1]; cB += data[i+2];
  });
  cR /= 4; cG /= 4; cB /= 4;

  let minX = W, maxX = 0, minY = H, maxY = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
      // Color distance from background
      const dist = Math.sqrt((r-cR)**2 + (g-cG)**2 + (b-cB)**2);
      if (a > 30 && dist > 28) {
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
