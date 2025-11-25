import fetch from 'node-fetch'
import sharp from 'sharp'

function latLonToTile(lat, lon, zoom) {
  const latRad = (lat * Math.PI) / 180
  const n = Math.pow(2, zoom)
  const x = Math.floor(((lon + 180) / 360) * n)
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  return { x, y }
}

async function loadTile(z, x, y) {
  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
  const res = await fetch(url)
  return Buffer.from(await res.arrayBuffer())
}

export async function generateStaticMap(lat, lon, zoom = 15, tiles = 3) {
  const t = latLonToTile(lat, lon, zoom)
  const half = Math.floor(tiles / 2)
  const tileSize = 256
  const size = tileSize * tiles

  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })

  const layers = []

  for (let dx = -half; dx <= half; dx++) {
    for (let dy = -half; dy <= half; dy++) {
      const tx = t.x + dx
      const ty = t.y + dy
      const img = await loadTile(zoom, tx, ty)
      layers.push({
        input: img,
        left: (dx + half) * tileSize,
        top: (dy + half) * tileSize
      })
    }
  }

  const xtile = ((lon + 180) / 360) * Math.pow(2, zoom)
  const ytile =
    ((1 -
      Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
      2) *
    Math.pow(2, zoom)

  const px = Math.floor((xtile - t.x + half) * tileSize)
  const py = Math.floor((ytile - t.y + half) * tileSize)

  const marker = Buffer.from(`
    <svg width="${size}" height="${size}">
      <circle cx="${px}" cy="${py}" r="8" fill="red" stroke="black" stroke-width="2"/>
    </svg>
  `)

  layers.push({ input: marker })

  return canvas.composite(layers).png().toBuffer()
}
