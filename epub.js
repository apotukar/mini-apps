import express from 'express';
import path from 'path';
import fs from 'fs';
import EPub from 'epub';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3333;
const EPUB_PATH = path.join(__dirname, '.books/book-complex.epub');

const BASE_CSS = `
body{font-family:serif;line-height:1.5;max-width:900px;margin:1em auto;padding:0 1em}
h1{margin-bottom:1em;font-size:1.4em}
img{max-width:100%;height:auto;margin:1em 0;display:block}
a{text-decoration:none}
hr{margin:2em 0;border:none;border-top:1px solid #ccc}
`;

function wrapHtml(title, bodyHtml) {
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8" /><title>' +
    escapeHtml(title || 'EPUB') +
    '</title><style>' +
    BASE_CSS +
    '</style></head><body>' +
    bodyHtml +
    '</body></html>'
  );
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function basename(p) {
  if (!p) {
    return '';
  }
  const i = p.lastIndexOf('/');
  if (i === -1) {
    return p;
  }
  return p.slice(i + 1);
}

function rewriteImageLinks(html) {
  const s = String(html || '');
  return s.replace(/src=["']([^"']+)["']/gi, (match, src) => {
    const clean = src.split('?')[0].split('#')[0];
    const file = basename(clean);
    if (!file) {
      return match;
    }
    return `src="/img/${file}"`;
  });
}

let chapterFileToAnchorId = {};
function rewriteHrefLinks(html) {
  const s = String(html || '');
  return s.replace(/href=["']([^"']+)["']/gi, (match, href) => {
    const h = href.trim();
    if (h === '') {
      return match;
    }
    if (h.startsWith('#')) {
      return match;
    }
    if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(h)) {
      return match;
    }
    const parts = h.split('#');
    const pathPart = parts[0];
    const hash = parts[1];
    const file = basename(pathPart);
    if (!file) {
      return match;
    }
    const anchorId = chapterFileToAnchorId[file];
    if (!anchorId) {
      return match;
    }
    if (hash && hash.length > 0) {
      return `href="#${hash}"`;
    }
    return `href="#${anchorId}"`;
  });
}

let epub = null;
let bookTitle = 'EPUB';
let fullHtml = '';
let ready = false;
let manifestByFile = {};

function loadBook(callback) {
  if (!fs.existsSync(EPUB_PATH)) {
    return callback(new Error('EPUB file not found'));
  }

  epub = new EPub(EPUB_PATH);

  epub.on('error', err => {
    callback(err);
  });

  epub.on('end', () => {
    if (epub.metadata && epub.metadata.title) {
      bookTitle = epub.metadata.title;
    } else {
      bookTitle = 'EPUB';
    }

    manifestByFile = {};
    const manifest = epub.manifest || {};
    for (const id in manifest) {
      const item = manifest[id];
      const file = basename(item.href);
      if (file) {
        manifestByFile[file] = id;
      }
    }

    const flow =
      epub.flow && epub.flow.length
        ? epub.flow
        : epub.spine && epub.spine.contents
          ? epub.spine.contents
          : [];

    if (!flow.length) {
      return callback(new Error('No chapters in EPUB'));
    }

    chapterFileToAnchorId = {};
    flow.forEach((entry, index) => {
      let href = entry.href || '';
      if (!href && entry.idref && epub.manifest && epub.manifest[entry.idref]) {
        href = epub.manifest[entry.idref].href || '';
      }
      if (!href && entry.id && epub.manifest && epub.manifest[entry.id]) {
        href = epub.manifest[entry.id].href || '';
      }
      const file = basename(href);
      if (file) {
        chapterFileToAnchorId[file] = 'chap-' + index;
      }
    });

    const parts = new Array(flow.length);
    let remaining = flow.length;

    flow.forEach((entry, index) => {
      const id = entry.id || entry.idref;
      if (!id) {
        parts[index] = '';
        remaining -= 1;
        if (remaining === 0) {
          fullHtml = parts.join('<hr/>');
          ready = true;
          callback(null);
        }
        return;
      }

      epub.getChapter(id, (err, html) => {
        if (err) {
          parts[index] = '';
        } else {
          let h = String(html || '');
          h = rewriteImageLinks(h);
          h = rewriteHrefLinks(h);
          parts[index] = `<a id="chap-${index}"></a>` + h;
        }
        remaining -= 1;
        if (remaining === 0) {
          fullHtml = parts.join('<hr/>');
          ready = true;
          callback(null);
        }
      });
    });
  });

  epub.parse();
}

const app = express();

app.get('/', (req, res) => {
  if (!ready) {
    return res.status(503).send('Buch wird geladen...');
  }
  const body =
    '<a id="top"></a>' +
    '<h1>' +
    escapeHtml(bookTitle) +
    '</h1>' +
    '<div>' +
    fullHtml +
    '</div>' +
    '<p><a href="#top">Nach oben</a></p>';
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(wrapHtml(bookTitle, body));
});

app.get('/img/:file', async (req, res) => {
  if (!ready || !epub) {
    return res.status(503).send('Buch wird geladen...');
  }

  const file = req.params.file;
  const id = manifestByFile[file];

  if (!id) {
    return res.status(404).send('Bild nicht gefunden');
  }

  epub.getImage(id, async (err, data, mime) => {
    if (err || !data) {
      return res.status(404).send('Bildfehler');
    }

    try {
      const resized = await sharp(data)
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 30 })
        .toBuffer();

      res.set('Content-Type', mime || 'image/jpeg');
      res.send(resized);
    } catch (_) {
      void _;
      res.set('Content-Type', mime || 'application/octet-stream');
      res.send(data);
    }
  });
});

loadBook(err => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log('http://localhost:' + PORT);
  });
});
