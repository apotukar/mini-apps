export function botBlocker(options = {}) {
  const blockedAgents = (options.userAgents || ['GPTBot', 'MJ12bot']).map(a => a.toLowerCase());
  const threshold = options.threshold ?? 3;
  const deny = res => {
    return res.status(403).send('Bots not allowed');
  };

  return function (req, res, next) {
    const ua = (req.headers['user-agent'] || '').toLowerCase();

    if (!ua) {
      return deny(res);
    }

    if (blockedAgents.some(agent => ua.includes(agent))) {
      return deny(res);
    }

    if (/(bot|crawler|spider|scraper)/i.test(ua)) {
      return deny(res);
    }

    if (isLikelyBot(req, threshold)) {
      return deny(res);
    }

    next();
  };
}

function isLikelyBot(req, threshold = 3) {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const accept = req.headers.accept || '';
  const al = req.headers['accept-language'];
  const ae = req.headers['accept-encoding'];
  const secFetchSite = req.headers['sec-fetch-site'];
  const secFetchMode = req.headers['sec-fetch-mode'];

  if (!ua) {
    return true;
  }

  let score = 0;

  if (!al) {
    score++;
  }

  if (!ae) {
    score++;
  }

  if (!accept.includes('text/html') && !accept.includes('*/*')) {
    score++;
  }

  if (!secFetchSite && !secFetchMode) {
    score++;
  }

  if (/(headless|phantom|curl|wget|python|scrapy|axios)/.test(ua)) {
    score += 2;
  }

  if (ua.includes('mozilla') && !al) {
    score++;
  }

  return score >= threshold;
}
