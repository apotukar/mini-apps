import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { CryptoTokenCipher } from '../crypto/crypto-token-cipher.js';

export class GoogleTokenReader {
  constructor(config = {}) {
    this.clientId = config.clientId || null;
    this.clientSecret = config.clientSecret || null;
    this.tokensPath = path.join(process.cwd(), config.tokensPath || 'tokens/google');
    this.autoLoadClientSecrets = config.autoLoadClientSecrets ?? true;

    if (!config.authTokenKey) {
      throw new Error('authTokenKey (32-Byte Buffer) fehlt in der Config');
    }
    this.cryptoTokenCipher = new CryptoTokenCipher(config.authTokenKey);

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
      const tokens = JSON.parse(raw);

      if (tokens.access_token) {
        tokens.access_token = this.cryptoTokenCipher.decrypt(tokens.access_token);
      }

      if (tokens.refresh_token) {
        tokens.refresh_token = this.cryptoTokenCipher.decrypt(tokens.refresh_token);
      }

      return tokens;
    } catch (err) {
      throw new Error(`Fehler beim Lesen der Token-Datei für User "${userId}": ${err.message}`);
    }
  }

  saveTokens(userId, tokens) {
    const file = this.tokenFile(userId);

    const toSave = { ...tokens };

    if (toSave.access_token) {
      toSave.access_token = this.cryptoTokenCipher.encrypt(toSave.access_token);
    }

    if (toSave.refresh_token) {
      toSave.refresh_token = this.cryptoTokenCipher.encrypt(toSave.refresh_token);
    }

    try {
      fs.writeFileSync(file, JSON.stringify(toSave, null, 2), 'utf8');
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
