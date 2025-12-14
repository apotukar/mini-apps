import { createClient } from 'webdav';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import mime from 'mime-types';

export class JoplinService {
  constructor(renderMarkdown, config = {}) {
    if (!renderMarkdown) {
      throw new Error('JoplinService: "renderMarkdown" is required');
    }

    const { webdavUrl, secret, preferredNotebooks = [], cacheDir } = config;

    if (!webdavUrl) {
      throw new Error('JoplinService: "webdavUrl" is required');
    }

    if (!secret?.username || !secret?.password) {
      throw new Error('JoplinService: "secret.username" and "secret.password" are required');
    }

    if (!cacheDir) {
      throw new Error('JoplinService: "cacheDir" is required');
    }

    this.renderMarkdown = renderMarkdown;
    this.preferredNotebooks = preferredNotebooks;
    this.cacheDir = path.join(process.cwd(), cacheDir);

    const baseUrl = webdavUrl.replace(/\/+$/, '');
    const agent = new https.Agent({ keepAlive: false, rejectUnauthorized: false });

    this.client = createClient(baseUrl, {
      username: secret.username,
      password: secret.password,
      httpsAgent: agent,
      headers: { Depth: '1' }
    });
  }

  async listNotes() {
    const files = await this.#listAllFiles();
    const notes = [];
    const notebooks = await this.#loadNotebookMap();
    const notebookPaths = this.#buildNotebookPathMap(notebooks);

    for (const f of files) {
      try {
        const { raw, meta } = await this.#getFileWithMeta(f);
        if (meta.type_ === '1' || meta.type_ === 1) {
          const parentId = meta.parent_id;
          const title = raw.split('\n')[0] || '(ohne Titel)';
          const idx = raw.lastIndexOf('\n\n');
          const bodyMarkdown = idx !== -1 ? raw.slice(0, idx).trim() : raw.trim();
          const notebook = notebooks.get(parentId);
          const notebookTitle = notebook ? notebook.title : '(Unbekanntes Notizbuch)';
          const notebookPath = notebookPaths.get(parentId) || notebookTitle;

          const isPreferred =
            !!notebookPath &&
            this.preferredNotebooks.some(x => x.toLowerCase() === notebookPath.toLowerCase());

          notes.push({
            id: f.basename,
            title,
            body: this.renderMarkdown(bodyMarkdown),
            updated: this.#parseUpdated(meta.updated_time),
            notebookId: parentId,
            notebookTitle,
            notebookPath,
            preferred: isPreferred
          });
        }
      } catch (error) {
        console.error('Failed to process note:', error);
      }
    }

    notes.sort((a, b) => {
      const pathA = (a.notebookPath || '').toLowerCase();
      const pathB = (b.notebookPath || '').toLowerCase();

      const prioA = this.preferredNotebooks.findIndex(x => x.toLowerCase() === pathA);
      const prioB = this.preferredNotebooks.findIndex(x => x.toLowerCase() === pathB);

      const aPref = prioA !== -1;
      const bPref = prioB !== -1;

      if (aPref && !bPref) {
        return -1;
      }
      if (!aPref && bPref) {
        return 1;
      }
      if (aPref && bPref && prioA !== prioB) {
        return prioA - prioB;
      }

      if (pathA < pathB) {
        return -1;
      }
      if (pathA > pathB) {
        return 1;
      }

      const titleA = (a.title || '').toLowerCase();
      const titleB = (b.title || '').toLowerCase();
      if (titleA < titleB) {
        return -1;
      }
      if (titleA > titleB) {
        return 1;
      }

      return 0;
    });

    return notes;
  }

  async getNoteById(id) {
    const filename = '/' + id;
    const files = await this.#listAllFiles();
    const entry = files.find(f => f.filename === filename);
    if (!entry) {
      throw new Error('Notiz nicht gefunden');
    }

    const { raw, meta } = await this.#getFileWithMeta(entry);
    const title = raw.split('\n')[0] || '(ohne Titel)';
    const idx = raw.lastIndexOf('\n\n');
    const bodyMarkdown = idx !== -1 ? raw.slice(0, idx).trim() : raw.trim();
    const bodyHtml = this.renderMarkdown(bodyMarkdown);

    const notebooks = await this.#loadNotebookMap();
    const notebookPaths = this.#buildNotebookPathMap(notebooks);
    const notebook = notebooks.get(meta.parent_id);
    const notebookTitle = notebook ? notebook.title : null;
    const notebookPath = notebookPaths.get(meta.parent_id) || notebookTitle;

    const isPreferred =
      !!notebookPath &&
      this.preferredNotebooks.some(x => x.toLowerCase() === notebookPath.toLowerCase());

    return {
      title,
      bodyMarkdown,
      bodyHtml,
      updated: this.#parseUpdated(meta.updated_time),
      notebookId: meta.parent_id,
      notebookTitle,
      notebookPath,
      preferred: isPreferred
    };
  }

  async getResourceById(id) {
    const dirs = ['/resources', '/.resource', 'resources', '.resource', '/'];
    let entry = null;
    for (const dir of dirs) {
      try {
        const files = await this.client.getDirectoryContents(dir);
        entry = files.find(f => f.basename.startsWith(id));
        if (entry) {
          break;
        }
      } catch (error) {
        console.error('Failed to load resource:', error);
      }
    }
    if (!entry) {
      return null;
    }
    const data = await this.client.getFileContents(entry.filename);
    const contentType = mime.lookup(entry.basename) || 'application/octet-stream';
    return { data, contentType, filename: entry.basename };
  }

  async #ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  #cacheFilePathFor(entry) {
    const safe = entry.filename.replace(/[/\\:]/g, '_');
    return path.join(this.cacheDir, safe + '.json');
  }

  async #cleanupCache(currentEntries) {
    try {
      await this.#ensureCacheDir();
      const files = await fs.readdir(this.cacheDir);
      const validNames = new Set(
        currentEntries.map(e => {
          const safe = e.filename.replace(/[/\\:]/g, '_');
          return safe + '.json';
        })
      );
      for (const name of files) {
        if (!validNames.has(name)) {
          try {
            await fs.unlink(path.join(this.cacheDir, name));
          } catch (error) {
            console.error('Failed to delete cache file:', error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to clean up cache:', error);
    }
  }

  async #readFromCache(entry) {
    const f = this.#cacheFilePathFor(entry);
    try {
      const str = await fs.readFile(f, 'utf8');
      const cached = JSON.parse(str);
      const sameEtag = cached.etag && entry.etag && cached.etag === entry.etag;
      const sameLastmod =
        cached.lastmod && entry.lastmod && String(cached.lastmod) === String(entry.lastmod);
      if (sameEtag || sameLastmod) {
        return cached;
      }
    } catch (error) {
      console.error('Failed to read cache file:', error);
    }
    return null;
  }

  async #writeToCache(entry, raw, meta) {
    const f = this.#cacheFilePathFor(entry);
    try {
      await this.#ensureCacheDir();
      await fs.writeFile(
        f,
        JSON.stringify({
          raw,
          meta,
          etag: entry.etag || null,
          lastmod: entry.lastmod || null
        }),
        'utf8'
      );
    } catch (error) {
      console.error('Failed to write cache file:', error);
    }
  }

  async #getFileWithMeta(entry) {
    const cached = await this.#readFromCache(entry);
    if (cached) {
      return cached;
    }
    const raw = await this.client.getFileContents(entry.filename, { format: 'text' });
    const meta = entry.basename.endsWith('.json')
      ? await this.#readJsonMeta(raw)
      : await this.#readMeta(raw);
    await this.#writeToCache(entry, raw, meta);
    return { raw, meta };
  }

  async #readMeta(raw) {
    const lines = raw.split('\n');
    const meta = {};
    let i = lines.length - 1;
    while (i >= 0) {
      const l = lines[i].trim();
      if (l === '') {
        break;
      }
      const p = l.indexOf(':');
      if (p !== -1) {
        meta[l.slice(0, p)] = l.slice(p + 1).trim();
      }
      i--;
    }
    return meta;
  }

  async #readJsonMeta(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  async #listAllFiles() {
    const entries = await this.client.getDirectoryContents('');
    await this.#cleanupCache(entries);
    return entries.filter(
      e => e.type === 'file' && (e.basename.endsWith('.md') || e.basename.endsWith('.json'))
    );
  }

  #parseUpdated(time) {
    if (!time) {
      return null;
    }
    if (String(time).match(/^\d+$/)) {
      return new Date(Number(time));
    }
    return new Date(time);
  }

  async #loadNotebookMap() {
    const files = await this.#listAllFiles();
    const notebooks = new Map();
    for (const f of files) {
      try {
        const { raw, meta } = await this.#getFileWithMeta(f);
        if (meta.type_ === '2' || meta.type_ === 2) {
          const id = meta.id || path.basename(f.basename, path.extname(f.basename));
          const title = meta.title || raw.split('\n')[0] || '(ohne Titel)';
          notebooks.set(id, { id, title, parent_id: meta.parent_id || null });
        }
      } catch (error) {
        console.error('Failed to load notebook map:', error);
      }
    }
    return notebooks;
  }

  #buildNotebookPathMap(notebooks) {
    const cache = new Map();
    function resolve(id) {
      if (!id) {
        return '';
      }
      if (cache.has(id)) {
        return cache.get(id);
      }
      const nb = notebooks.get(id);
      if (!nb) {
        cache.set(id, '');
        return '';
      }
      const parentPath = resolve(nb.parent_id);
      const full = parentPath ? parentPath + ' / ' + nb.title : nb.title;
      cache.set(id, full);
      return full;
    }
    for (const id of notebooks.keys()) {
      resolve(id);
    }
    return cache;
  }
}
