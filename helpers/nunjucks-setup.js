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

  env.addFilter(
    'formatDateTime',
    function (dateStr, locale = 'de-DE', timeZone = 'Europe/Berlin', options = {}) {
      try {
        const d = new Date(dateStr);

        return d.toLocaleString(locale, {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone,
          ...options
        });
      } catch {
        return dateStr;
      }
    }
  );

  env.addFilter(
    'formatDate',
    function (dateStr, locale = 'de-DE', timeZone = 'Europe/Berlin', options = {}) {
      try {
        const d = new Date(dateStr);

        return d.toLocaleDateString(locale, {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          timeZone,
          ...options
        });
      } catch {
        return dateStr;
      }
    }
  );

  env.addFilter(
    'formatTime',
    function (dateStr, locale = 'de-DE', timeZone = 'Europe/Berlin', options = {}) {
      try {
        const d = new Date(dateStr);

        return d.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          timeZone,
          ...options
        });
      } catch {
        return dateStr;
      }
    }
  );

  env.addFilter('formatDuration', function (minutes) {
    if (!minutes || isNaN(minutes)) return minutes;

    const total = Number(minutes);

    const days = Math.floor(total / 1440); // 1440 = 24 * 60
    const hours = Math.floor((total % 1440) / 60);
    const mins = total % 60;

    let parts = [];

    if (days > 0) {
      // parts.push(days + ' Tag' + (days !== 1 ? 'e' : ''));
      parts.push(days + 'd');
    }
    if (hours > 0) {
      // parts.push(hours + ' Std.');
      parts.push(hours + 'h');
    }
    if (mins > 0) {
      // parts.push(mins + ' Min.');
      parts.push(mins + 'min');
    }

    return parts.join(' ').trim();
  });

  env.addFilter('split', function (str, delimiter) {
    if (typeof str !== 'string') return [];
    return str.split(delimiter).map(s => s.trim());
  });

  return env;
}
