(function () {
  if (document.layers) {
    return;
  }

  var ua = navigator.userAgent || '';
  var legacyClass = '';

  if (ua.indexOf('SeaMonkey/1.1') !== -1 || ua.indexOf('Firefox/2.0') !== -1) {
    legacyClass = 'is-old-gecko';
  } else if (/Opera[\/ ]/.test(ua) && /Version\/10\./.test(ua)) {
    legacyClass = 'is-old-opera';
  }

  if (legacyClass) {
    var docEl = document.documentElement || document.getElementsByTagName('html')[0];

    if (docEl) {
      var cls = docEl.className || '';
      if ((' ' + cls + ' ').indexOf(' ' + legacyClass + ' ') === -1) {
        docEl.className = cls ? cls + ' ' + legacyClass : legacyClass;
      }
    }
  }
})();
