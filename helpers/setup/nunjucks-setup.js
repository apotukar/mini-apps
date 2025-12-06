import nunjucks from 'nunjucks';

export function setupNunjucks(app, params) {
  const config = params.config || {};

  app.set('view engine', config.defaultViewExt || 'html');

  const env = nunjucks.configure(['views/default', 'views/ns4'], {
    autoescape: true,
    express: app,
    watch: config.modeEnv === 'DEV',
    noCache: config.modeEnv === 'DEV'
  });

  app.engine(config.ns4ViewExt || 'htm', env.render.bind(env));

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
    if (minutes === null || isNaN(minutes)) {
      return minutes;
    }

    const total = Number(minutes); // kann positiv oder negativ sein
    const sign = total < 0 ? '-' : '';
    const abs = Math.abs(total);

    const days = Math.floor(abs / 1440); // 1440 = 24 * 60
    const hours = Math.floor((abs % 1440) / 60);
    const mins = abs % 60;

    let parts = [];

    if (days > 0) {
      parts.push(days + 'd');
    }
    if (hours > 0) {
      parts.push(hours + 'h');
    }

    parts.push(mins + 'min');

    return sign + parts.join(' ').trim();
  });

  env.addFilter('split', function (str, delimiter) {
    if (typeof str !== 'string') {
      return [];
    }
    return str.split(delimiter).map(s => s.trim());
  });

  env.addFilter('toEntities', function (str = '') {
    return String(str).replace(/[\u00A0-\u9999<>&]/g, c => {
      return '&#' + c.charCodeAt(0) + ';';
    });
  });

  return env;
}
