export function globalErrorHandler() {
  return function (err, req, res, _) {
    const status = err.status || 500;
    const href = err.href || req.originalUrl || '/';
    const msg = err.isKnown ? err.message : 'Ein unbekannter Fehler ist aufgetreten.';

    console.error('global error handler:', err);

    return res.status(status).render('common/error.njk', {
      message: msg,
      href
    });
  };
}
