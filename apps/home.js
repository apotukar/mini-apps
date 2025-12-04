export function registerHomeRoutes(app, params) {
  const config = params.config || {};
  const { bookmarks } = config;

  app.get('/', (_, res) => {
    const viewExt = res.locals.viewExt || '';
    res.render(`home/index.${viewExt}`, {
      bookmarks: bookmarks,
      isSecureContext: res.locals.isHttps,
      content: HOME_TEXTS_DE
    });
  });
}

const HOME_TEXTS_DE = {
  title: 'Mini-Apps',
  pageTitle: 'Mini-Apps',
  departures: {
    title: 'Abfahrten',
    desc: 'Nächste Abfahrten an einer Station.'
  },
  journey: {
    title: 'Bahn-Verbindungen',
    desc: 'Fahrten suchen, extrem leicht.'
  },
  weather: {
    title: 'Wetter',
    desc: 'Aktuelles Wetter und Vorhersage.'
  },
  pois: {
    title: 'POIs',
    desc: 'Apotheken, Tankstellen & mehr ohne GPS.'
  },
  track: {
    title: 'Sendungsverfolgung',
    desc: 'Aktuell unterstützt: DHL.'
  },
  tasks: {
    title: 'Aufgaben',
    desc: 'Alle Google-Tasks-Listen (Leseansicht).'
  },
  joplin: {
    title: 'Joplin',
    desc: 'Alle Notizen (Leseansicht).'
  },
  news: {
    title: 'News',
    desc: 'Aktuelle Nachrichten.'
  },
  bookmarks: {
    title: 'Bookmarks'
  },
  browser: {
    title: 'WWW',
    desc: 'Ein Webbrowser für vereinfachtes HTML (Work in Progress).'
  }
};
