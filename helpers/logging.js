export function logger() {
  return function (req, res, next) {
    const start = Date.now();
    const ua = req.headers['user-agent'];

    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.url} → ${res.statusCode} (${duration}ms) - UA: ${ua}`
      );
    });

    next();
  };
}
