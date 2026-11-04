import { lookup } from 'node:dns';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import { BlockList, isIP } from 'node:net';
import fetch from 'node-fetch';
import sharp from 'sharp';

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3]
]) {
  blocked.addSubnet(address, prefix, 'ipv4');
}
const globalIpv6 = new BlockList();
globalIpv6.addSubnet('2000::', 3, 'ipv6');
blocked.addSubnet('2001::', 23, 'ipv6');
blocked.addSubnet('2002::', 16, 'ipv6');
blocked.addSubnet('3fff::', 20, 'ipv6');

function isPublicAddress(address) {
  const family = isIP(address);
  return family === 4
    ? !blocked.check(address, 'ipv4')
    : family === 6 && globalIpv6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

// Validate the addresses used by the actual connection, not a separate DNS preflight.
function publicLookup(hostname, options, callback) {
  lookup(hostname, { all: true }, (error, addresses) => {
    if (error) {
      callback(error);
      return;
    }
    if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) {
      callback(new Error('Image host is not public'));
      return;
    }
    if (options.all) {
      callback(null, addresses);
    } else {
      callback(null, addresses[0].address, addresses[0].family);
    }
  });
}

const httpAgent = new HttpAgent({ lookup: publicLookup, maxSockets: 8 });
const httpsAgent = new HttpsAgent({ lookup: publicLookup, maxSockets: 8 });
const maxBytes = 5 * 1024 * 1024;

export async function fetchLegacyImage(input) {
  let url = new URL(input);
  const signal = AbortSignal.timeout(10000);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80')) ||
      (isIP(hostname) && !isPublicAddress(hostname))
    ) {
      throw new Error('Image URL is not allowed');
    }
    const response = await fetch(url, {
      signal,
      redirect: 'manual',
      agent: url.protocol === 'https:' ? httpsAgent : httpAgent,
      headers: {
        Accept: 'image/jpeg, image/gif, image/png, image/webp',
        'Accept-Encoding': 'identity'
      }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      response.body.destroy();
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('Image redirect has no destination');
      }
      url = new URL(location, url);
      continue;
    }
    if (!response.ok || Number(response.headers.get('content-length')) > maxBytes) {
      response.body.destroy();
      throw new Error('Image unavailable or too large');
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maxBytes) {
        response.body.destroy();
        throw new Error('Image too large');
      }
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      const image = sharp(buffer, { limitInputPixels: 16 * 1024 * 1024 });
      const metadata = await image.metadata();
      const animationFlag =
        buffer.toString('ascii', 12, 16) === 'VP8X' && (buffer[20] & 0x02) !== 0;
      if (animationFlag || (metadata.pages || 1) > 1) {
        throw new Error('Animated WebP images are not supported');
      }
      const jpeg = await image
        .resize({ width: 480, withoutEnlargement: true })
        .flatten({ background: '#f7f3e8' })
        .jpeg({ quality: 80, progressive: false })
        .timeout({ seconds: 5 })
        .toBuffer();
      if (jpeg.length > maxBytes) {
        throw new Error('Converted image too large');
      }
      return { buffer: jpeg, contentType: 'image/jpeg' };
    }
    if (buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
      // libvips may expose only the first APNG frame; check the animation chunk explicitly.
      for (let offset = 8; offset + 12 <= buffer.length;) {
        const length = buffer.readUInt32BE(offset);
        const end = offset + length + 12;
        if (end > buffer.length) {
          throw new Error('Invalid PNG chunk');
        }
        if (buffer.toString('ascii', offset + 4, offset + 8) === 'acTL') {
          throw new Error('Animated PNGs are not supported');
        }
        offset = end;
      }
      const gif = await sharp(buffer, { limitInputPixels: 16 * 1024 * 1024 })
        .resize({ width: 480, withoutEnlargement: true })
        .flatten({ background: '#f7f3e8' })
        .gif()
        .timeout({ seconds: 5 })
        .toBuffer();
      if (gif.length > maxBytes) {
        throw new Error('Converted image too large');
      }
      return { buffer: gif, contentType: 'image/gif' };
    }
    const signature = buffer.subarray(0, 6).toString('ascii');
    if (signature === 'GIF87a' || signature === 'GIF89a') {
      const metadata = await sharp(buffer).metadata();
      if ((metadata.pages || 1) > 1) {
        throw new Error('Animated GIFs are not supported');
      }
      return { buffer, contentType: 'image/gif' };
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { buffer, contentType: 'image/jpeg' };
    }
    throw new Error('Only JPEG, GIF, static PNG and static WebP are supported');
  }
  throw new Error('Too many image redirects');
}
