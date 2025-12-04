import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

export class GoogleTokenReader {
  constructor(config = {}) {
    this.clientId = config.clientId || null;
    this.clientSecret = config.clientSecret || null;
    this.tokensPath = path.join(process.cwd(), config.tokensPath || null);
    this.autoLoadClientSecrets = config.autoLoadClientSecrets ?? true;

    // TODO: complete checks
    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'Client ID oder Client Secret fehlen! Setze sie entweder im Constructor {clientId, clientSecret} oder speichere sie in der token.json.'
      );
    }
  }

  tokenFile(userId) {
    return path.join(this.tokensPath, `${userId}.json`);
  }

  loadTokens(userId) {
    const file = this.tokenFile(userId);

    try {
      if (!fs.existsSync(file)) {
        throw new Error(`Token-Datei nicht gefunden unter: ${file}`);
      }

      const raw = fs.readFileSync(file, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(`Fehler beim Lesen der Token-Datei für User "${userId}": ${err.message}`);
    }
  }

  saveTokens(userId, tokens) {
    const file = this.tokenFile(userId);

    try {
      fs.writeFileSync(file, JSON.stringify(tokens, null, 2), 'utf8');
      return file;
    } catch (err) {
      throw new Error(`Fehler beim Schreiben der Token-Datei für User "${userId}": ${err.message}`);
    }
  }

  async refreshAccessToken(userId) {
    const tokens = this.loadTokens(userId);

    if (!tokens.refresh_token) {
      throw new Error('Kein Refresh Token vorhanden! OAuth erneut ausführen.');
    }

    const params = new URLSearchParams();
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('refresh_token', tokens.refresh_token);
    params.append('grant_type', 'refresh_token');

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const data = await res.json();

    if (!data.access_token) {
      console.error('Google returned:', data);

      if (data.error === 'invalid_grant') {
        throw new Error(
          'Refresh Token ist abgelaufen oder wurde widerrufen. Bitte OAuth erneut durchlaufen.'
        );
      }
      throw new Error('Konnte kein Access Token erhalten.');
    }

    tokens.access_token = data.access_token;

    if (data.refresh_token) {
      tokens.refresh_token = data.refresh_token;
    }

    this.saveTokens(userId, tokens);

    return data.access_token;
  }
}
