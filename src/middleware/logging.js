export function logger() {
  return function (req, res, next) {
    const start = Date.now();
    const ua = req.headers['user-agent'];

    res.on('finish', () => {
      const duration = Date.now() - start;
      const parts = req.path.split('/').filter(Boolean);
      const segment = parts[0] || '';
      const caller = getCallerInfo(); //  <<<<< HIER

      console.log(
        `[${humanTimestamp({ format: 'de' })}] ${req.method} ${req.originalUrl}` +
          ` → ${res.statusCode} (${duration}ms)` +
          ` - SEG: ${segment} - UA: ${ua} - CALLER: ${caller}`
      );
    });

    next();
  };
}

function getCallerInfo() {
  const err = new Error();
  const stack = err.stack.split('\n');
  const callerLine = stack[2] || '';
  const match = callerLine.match(/\((.*):(\d+):(\d+)\)/);
  if (!match) {
    return '';
  }

  const [, file, line] = match;
  return `${file}:${line}`;
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
