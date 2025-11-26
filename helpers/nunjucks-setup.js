import nunjucks from 'nunjucks';

export function setupNunjucks(app) {
  app.set('view engine', 'njk');

  const env = nunjucks.configure('views', {
    autoescape: true,
    express: app
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
