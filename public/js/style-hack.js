(function () {
  var ua = navigator.userAgent || '';

  if (ua.indexOf('SeaMonkey/1.1') !== -1 || ua.indexOf('Firefox/2.0') !== -1) {
    // <html>-Element holen
    var docEl = document.documentElement || document.getElementsByTagName('html')[0];

    if (docEl) {
      // Klasse anhängen, ohne bestehende zu zerstören
      var cls = docEl.className || '';
      if (cls.indexOf('is-old-gecko') === -1) {
        docEl.className = cls ? cls + ' is-old-gecko' : 'is-old-gecko';
      }
    }
  }
})();
