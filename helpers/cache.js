import fs from 'fs/promises';
import path from 'path';

export class SimpleFileCache {
  constructor(options = {}) {
    const { cacheDir = path.join(process.cwd(), '.cache/default'), ttl = 1000 * 60 * 60 } = options;

    this.cacheDir = cacheDir;
    this.ttl = ttl;
  }

  async ensureDir() {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  async read(key) {
    const file = path.join(this.cacheDir, `${key}.json`);

    try {
      const raw = await fs.readFile(file, 'utf8');
      const data = JSON.parse(raw);

      if (!data || typeof data.timestamp !== 'number' || !('payload' in data)) {
        return null;
      }

      if (this.ttl === Infinity) {
        return data.payload;
      }

      if (Date.now() - data.timestamp < this.ttl) {
        return data.payload;
      }

      return null;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Failed to read cache', file, err);
      }
      return null;
    }
  }

  async write(key, payload) {
    await this.ensureDir();

    const file = path.join(this.cacheDir, `${key}.json`);
    const data = {
      timestamp: Date.now(),
      key,
      payload
    };

    try {
      await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to write cache', file, err);
    }
  }
}
