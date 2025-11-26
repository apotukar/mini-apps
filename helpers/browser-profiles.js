export function getBrowserProfiles() {
  return [
    {
      name: 'firefox-mac',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:145.0) Gecko/20100101 Firefox/145.0',
      acceptLanguage: 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    {
      name: 'chrome-mac',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      acceptLanguage: 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    {
      name: 'firefox-windows',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
      acceptLanguage: 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    {
      name: 'chrome-windows',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      acceptLanguage: 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    {
      name: 'android-chrome',
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
      acceptLanguage: 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    {
      name: 'ios-safari',
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      acceptLanguage: 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  ];
}

export function getRandomBrowserProfile() {
  const profiles = getBrowserProfiles();
  const i = Math.floor(Math.random() * profiles.length);
  return profiles[i];
}
