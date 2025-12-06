export function logger() {
  return function (req, res, next) {
    const start = Date.now();
    const ua = req.headers['user-agent'];

    res.on('finish', () => {
      const duration = Date.now() - start;
      const parts = req.path.split('/').filter(Boolean);
      const segment = parts[0] || ''; // oder beliebiger Index
      console.log(
        `[${humanTimestamp({ format: 'de' })}] ${req.method} ${req.url} → ${res.statusCode} (${duration}ms) - SEG: ${segment} - UA: ${ua}`
      );
    });

    next();
  };
}

function humanTimestamp(config = {}) {
  const d = new Date();
  const pad = n => n.toString().padStart(2, '0');

  switch (config.format) {
    case 'de': {
      const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
      const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      return `${date} ${time}`;
    }

    case 'us': {
      let hours = d.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;

      const date = `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
      const time = `${pad(hours)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
      return `${date} ${time}`;
    }

    default:
      return d.toISOString();
  }
}
