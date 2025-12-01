import { createClient } from 'webdav';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import mime from 'mime-types';
import { renderMarkdown } from '../helpers/markdown-joplin.js';

export function registerJoplinRoutes(app, params) {
  const { webdavUrl, secret, preferredNotebooks } = params.config;
  const baseUrl = webdavUrl.replace(/\/+$/, '');
  const { username, password } = secret;
  const preferred = preferredNotebooks || [];

  const agent = new https.Agent({ keepAlive: false, rejectUnauthorized: false });
  const client = createClient(baseUrl, {
    username,
    password,
    httpsAgent: agent,
    headers: { Depth: '1' }
  });

  const CACHE_DIR = path.join(process.cwd(), '.cache', 'joplin');

  app.get('/joplin', async (req, res) => {
    try {
      const notes = await loadNotes();
      res.render('joplin/index.njk', { notes });
    } catch (err) {
      res.render('joplin/error.njk', { message: err.message });
    }
  });

  app.get('/joplin/note/:id', async (req, res) => {
    try {
      const filename = '/' + req.params.id;
      const files = await listAllFiles();
      const entry = files.find(f => f.filename === filename);
      if (!entry) {
        throw new Error('Notiz nicht gefunden');
      }

      const { raw, meta } = await getFileWithMeta(entry);
      const title = raw.split('\n')[0] || '(ohne Titel)';
      const idx = raw.lastIndexOf('\n\n');
      const bodyMarkdown = idx !== -1 ? raw.slice(0, idx).trim() : raw.trim();
      const bodyHtml = renderMarkdown(bodyMarkdown);

      const notebooks = await loadNotebookMap();
      const notebookPaths = buildNotebookPathMap(notebooks);
      const notebook = notebooks.get(meta.parent_id);
      const notebookTitle = notebook ? notebook.title : null;
      const notebookPath = notebookPaths.get(meta.parent_id) || notebookTitle;

      const isPreferred =
        !!notebookPath && preferred.some(x => x.toLowerCase() === notebookPath.toLowerCase());

      res.render('joplin/note.njk', {
        note: {
          title,
          bodyMarkdown,
          bodyHtml,
          updated: parseUpdated(meta.updated_time),
          notebookId: meta.parent_id,
          notebookTitle,
          notebookPath,
          preferred: isPreferred
        }
      });
    } catch (err) {
      res.render('joplin/error.njk', { message: err.message });
    }
  });

  app.get('/joplin/resource/:id', async (req, res) => {
    const id = req.params.id;
    const downloadName = req.query.name || null;
    try {
      const dirs = ['/resources', '/.resource', 'resources', '.resource', '/'];
      let entry = null;
      for (const dir of dirs) {
        try {
          const files = await client.getDirectoryContents(dir);
          entry = files.find(f => f.basename.startsWith(id));
          if (entry) {
            break;
          }
        } catch (err) {
          void err;
        }
      }
      if (!entry) {
        return res.status(404).send('Not found');
      }
      const data = await client.getFileContents(entry.filename);
      const contentType = mime.lookup(entry.basename) || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      if (downloadName) {
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      }
      res.send(data);
    } catch {
      res.status(500).send('Error loading resource');
    }
  });

  async function ensureCacheDir() {
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (err) {
      void err;
    }
  }

  function cacheFilePathFor(entry) {
    const safe = entry.filename.replace(/[/\\:]/g, '_');
    return path.join(CACHE_DIR, safe + '.json');
  }

  async function cleanupCache(currentEntries) {
    try {
      await ensureCacheDir();
      const files = await fs.readdir(CACHE_DIR);
      const validNames = new Set(
        currentEntries.map(e => {
          const safe = e.filename.replace(/[/\\:]/g, '_');
          return safe + '.json';
        })
      );
      for (const name of files) {
        if (!validNames.has(name)) {
          try {
            await fs.unlink(path.join(CACHE_DIR, name));
          } catch (err) {
            void err;
          }
        }
      }
    } catch (err) {
      void err;
    }
  }

  async function readFromCache(entry) {
    const f = cacheFilePathFor(entry);
    try {
      const str = await fs.readFile(f, 'utf8');
      const cached = JSON.parse(str);
      const sameEtag = cached.etag && entry.etag && cached.etag === entry.etag;
      const sameLastmod =
        cached.lastmod && entry.lastmod && String(cached.lastmod) === String(entry.lastmod);
      if (sameEtag || sameLastmod) {
        return cached;
      }
    } catch (err) {
      void err;
    }
    return null;
  }

  async function writeToCache(entry, raw, meta) {
    const f = cacheFilePathFor(entry);
    try {
      await ensureCacheDir();
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
    } catch (err) {
      void err;
    }
  }

  async function getFileWithMeta(entry) {
    const cached = await readFromCache(entry);
    if (cached) {
      return cached;
    }
    const raw = await client.getFileContents(entry.filename, { format: 'text' });
    const meta = entry.basename.endsWith('.json') ? await readJsonMeta(raw) : await readMeta(raw);
    await writeToCache(entry, raw, meta);
    return { raw, meta };
  }

  async function readMeta(raw) {
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

  async function readJsonMeta(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  async function listAllFiles() {
    const entries = await client.getDirectoryContents('');
    await cleanupCache(entries);
    return entries.filter(
      e => e.type === 'file' && (e.basename.endsWith('.md') || e.basename.endsWith('.json'))
    );
  }

  function parseUpdated(time) {
    if (!time) {
      return null;
    }
    if (String(time).match(/^\d+$/)) {
      return new Date(Number(time));
    }
    return new Date(time);
  }

  async function loadNotebookMap() {
    const files = await listAllFiles();
    const notebooks = new Map();
    for (const f of files) {
      try {
        const { raw, meta } = await getFileWithMeta(f);
        if (meta.type_ === '2' || meta.type_ === 2) {
          const id = meta.id || path.basename(f.basename, path.extname(f.basename));
          const title = meta.title || raw.split('\n')[0] || '(ohne Titel)';
          notebooks.set(id, { id, title, parent_id: meta.parent_id || null });
        }
      } catch (err) {
        void err;
      }
    }
    return notebooks;
  }

  function buildNotebookPathMap(notebooks) {
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

  async function loadNotes() {
    const files = await listAllFiles();
    const notes = [];
    const notebooks = await loadNotebookMap();
    const notebookPaths = buildNotebookPathMap(notebooks);

    for (const f of files) {
      try {
        const { raw, meta } = await getFileWithMeta(f);
        if (meta.type_ === '1' || meta.type_ === 1) {
          const parentId = meta.parent_id;
          const title = raw.split('\n')[0] || '(ohne Titel)';
          const idx = raw.lastIndexOf('\n\n');
          const bodyMarkdown = idx !== -1 ? raw.slice(0, idx).trim() : raw.trim();
          const notebook = notebooks.get(parentId);
          const notebookTitle = notebook ? notebook.title : '(Unbekanntes Notizbuch)';
          const notebookPath = notebookPaths.get(parentId) || notebookTitle;

          const isPreferred =
            !!notebookPath && preferred.some(x => x.toLowerCase() === notebookPath.toLowerCase());

          notes.push({
            id: f.basename,
            title,
            body: renderMarkdown(bodyMarkdown),
            updated: parseUpdated(meta.updated_time),
            notebookId: parentId,
            notebookTitle,
            notebookPath,
            preferred: isPreferred
          });
        }
      } catch (err) {
        void err;
      }
    }

    notes.sort((a, b) => {
      const pathA = (a.notebookPath || '').toLowerCase();
      const pathB = (b.notebookPath || '').toLowerCase();

      const prioA = preferred.findIndex(x => x.toLowerCase() === pathA);
      const prioB = preferred.findIndex(x => x.toLowerCase() === pathB);

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
}
