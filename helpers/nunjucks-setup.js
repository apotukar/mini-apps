import nunjucks from 'nunjucks';

export function setupNunjucks(app, params) {
  const config = params.config || {};

  app.set('view engine', 'njk');

  const env = nunjucks.configure('views', {
    autoescape: true,
    express: app,
    watch: config.modeEnv === 'DEV',
    noCache: config.modeEnv === 'DEV'
  });

  env.addFilter('formatDate', function (dateStr, locale = 'de-DE', options = {}) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(locale, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        ...options
      });
    } catch {
      return dateStr;
    }
  });

  env.addFilter('split', function (str, delimiter) {
    if (typeof str !== 'string') return [];
    return str.split(delimiter).map(s => s.trim());
  });

  return env;
}
