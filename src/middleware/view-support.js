export function viewBaseMarker(config) {
  const defaultExt = config.defaultViewExt || 'njk';
  const ns4Ext = config.ns4ViewExt || 'ns4';

  return function (req, res, next) {
    const ua = req.headers['user-agent'] || '';
    const isNS4 = ua.includes('Mozilla/4.');
    const isMSIE6 = ua.includes('MSIE 6.');
    const isOperaMini = ua.includes('Opera Mini');

    res.locals.isNS4 = isNS4;
    res.locals.isMSIE6 = isMSIE6;
    res.locals.isOperaMini = isOperaMini;
    res.locals.viewExt = isNS4 ? ns4Ext : defaultExt;

    next();
  };
}

export function pageUrlMarker() {
  return function (req, res, next) {
    res.locals.pageUrl = req.path;

    next();
  };
}
