import fetch from 'node-fetch';
import { Jimp } from 'jimp';

function latLonToTile(lat, lon, zoom) {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

async function loadTile(z, x, y) {
  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  return Jimp.read(buf);
}

export async function generateStaticMap(lat, lon, zoom = 15, tiles = 3) {
  const t = latLonToTile(lat, lon, zoom);
  const half = Math.floor(tiles / 2);
  const tileSize = 256;
  const size = tileSize * tiles;

  const canvas = await new Jimp({ width: size, height: size, color: 0xffffffff });

  for (let dx = -half; dx <= half; dx++) {
    for (let dy = -half; dy <= half; dy++) {
      const tx = t.x + dx;
      const ty = t.y + dy;
      const tileImg = await loadTile(zoom, tx, ty);
      const left = (dx + half) * tileSize;
      const top = (dy + half) * tileSize;
      canvas.composite(tileImg, left, top);
    }
  }

  const xtile = ((lon + 180) / 360) * Math.pow(2, zoom);
  const ytile =
    ((1 -
      Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) /
        Math.PI) /
      2) *
    Math.pow(2, zoom);

  const px = Math.floor((xtile - t.x + half) * tileSize);
  const py = Math.floor((ytile - t.y + half) * tileSize);

  const markerSize = 12;
  const r = Math.floor(markerSize / 2);
  const marker = await new Jimp({
    width: markerSize,
    height: markerSize,
    color: 0x00000000
  });

  marker.scan(0, 0, markerSize, markerSize, function (x, y, idx) {
    const isBorder =
      x === 0 || y === 0 || x === markerSize - 1 || y === markerSize - 1;
    const isInner =
      x > 1 && y > 1 && x < markerSize - 2 && y < markerSize - 2;

    if (isBorder) {
      this.bitmap.data[idx + 0] = 0;
      this.bitmap.data[idx + 1] = 0;
      this.bitmap.data[idx + 2] = 0;
      this.bitmap.data[idx + 3] = 255;
    } else if (isInner) {
      this.bitmap.data[idx + 0] = 255;
      this.bitmap.data[idx + 1] = 0;
      this.bitmap.data[idx + 2] = 0;
      this.bitmap.data[idx + 3] = 255;
    }
  });

  canvas.composite(marker, px - r, py - r);

  if (typeof canvas.getBufferAsync === 'function') {
    return await canvas.getBufferAsync('image/png');
  }

  return await new Promise((resolve, reject) => {
    canvas.getBuffer('image/png', (err, buf) => {
      if (err) reject(err);
      else resolve(buf);
    });
  });
}
