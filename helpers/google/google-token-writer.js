import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

export class GoogleTokenWriter {
  constructor(config = {}) {
    this.clientId = config.clientId || null;
    this.clientSecret = config.clientSecret || null;
    this.redirectUri = config.redirectUri || null;
    this.tokensPath = path.join(process.cwd(), config.tokensPath || null);

    // TODO: complete checks
    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'Client ID oder Client Secret fehlen! Setze sie entweder im Constructor {clientId, clientSecret} oder speichere sie in der token.json.'
      );
    }

    if (!fs.existsSync(this.tokensPath)) {
      fs.mkdirSync(this.tokensPath, { recursive: true });
      console.log('Token-Verzeichnis erstellt:', this.tok);
    }
  }

  _tokenFileForUser(userId, tokensDir) {
    return path.join(tokensDir, `${userId}.json`);
  }

  buildAuthUrl(userId) {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'https://www.googleapis.com/auth/tasks.readonly');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', userId);
    return url.toString();
  }

  async exchangeCode(code, userId) {
    console.log('Exchange Code für User:', userId);

    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('redirect_uri', this.redirectUri);
    params.append('grant_type', 'authorization_code');

    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    console.log('Google Token Status:', r.status);
    const d = await r.json();
    console.log('Google Antwort:', d);

    if (!d.access_token) {
      throw new Error('no_access_token');
    }

    if (!fs.existsSync(this.tokensPath)) {
      fs.mkdirSync(this.tokensPath, { recursive: true });
    }

    const filePath = this._tokenFileForUser(userId, this.tokensPath);
    console.log('Token wird gespeichert unter:', filePath);

    try {
      fs.writeFileSync(
        filePath,
        JSON.stringify(
          {
            user_id: userId,
            access_token: d.access_token,
            refresh_token: d.refresh_token || null,
            created: Date.now()
          },
          null,
          2
        ),
        'utf8'
      );
      console.log('Token erfolgreich gespeichert');
    } catch (err) {
      console.error('Fehler beim Schreiben:', err);
      throw new Error('token_write_failed');
    }
  }
}
