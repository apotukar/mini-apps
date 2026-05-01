import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { CryptoTokenCipher } from '../crypto/crypto-token-cipher.js';
import { AppError, OAuthReauthRequiredError } from '../../errors.js';

export class GoogleTokenReader {
  constructor(config = {}) {
    this.clientId = config.clientId || null;
    this.clientSecret = config.clientSecret || null;
    this.tokensPath = path.join(process.cwd(), config.tokensPath || 'tokens/google');

    if (!config.authTokenKey) {
      throw new Error('authTokenKey (32-Byte Buffer) fehlt in der Config');
    }

    this.cryptoTokenCipher = new CryptoTokenCipher(config.authTokenKey);

    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'Client ID or Client Secret is missing. Please provide them either via the constructor { clientId, clientSecret } or store them in token.json.'
      );
    }
  }

  tokenFile(userId) {
    return path.join(this.tokensPath, `${userId}.json`);
  }

  deleteTokens(userId) {
    const file = this.tokenFile(userId);
    try {
      fs.unlinkSync(file);
    } catch {
      // ignore
    }
  }

  loadTokens(userId) {
    const file = this.tokenFile(userId);

    try {
      if (!fs.existsSync(file)) {
        throw new Error(`Token file not found at: ${file}`);
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
    } catch {
      throw new AppError('Failed to read OAuth tokens.', 500, false);
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
    } catch {
      throw new AppError('Failed to write OAuth tokens.', 500, false);
    }
  }

  async refreshAccessToken(userId) {
    const tokens = this.loadTokens(userId);

    if (!tokens.refresh_token) {
      throw new OAuthReauthRequiredError({
        provider: 'google',
        reason: 'missing_refresh_token'
      });
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token'
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const data = await res.json();

    if (!res.ok || !data.access_token) {
      console.warn('OAuth token refresh failed:', data);

      if (data.error === 'invalid_grant') {
        this.deleteTokens(userId);
        throw new OAuthReauthRequiredError({
          provider: 'google',
          reason: 'expired_or_revoked'
        });
      }

      throw new AppError('Failed to refresh access token.', 502, false);
    }

    tokens.access_token = data.access_token;
    if (data.refresh_token) {
      tokens.refresh_token = data.refresh_token;
    }

    this.saveTokens(userId, tokens);
    return tokens.access_token;
  }
}
