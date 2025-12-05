export function viewBaseMarker(config) {
  const defaultExt = config.defaultViewExt || 'njk';
  const ns4Ext = config.ns4ViewExt || 'ns4';

  return function (req, res, next) {
    const ua = req.headers['user-agent'] || '';
    const isNs4 = ua.includes('Mozilla/4.');

    res.locals.viewExt = isNs4 ? ns4Ext : defaultExt;

    next();
  };
}

export function pageUrlMarker() {
  return function (req, res, next) {
    res.locals.pageUrl = req.path;

    next();
  };
}
