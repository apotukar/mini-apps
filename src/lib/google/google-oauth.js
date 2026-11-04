import { randomBytes, createHash } from 'node:crypto';
import { AppError, ValidationError } from '../../errors.js';

const FLOW_TTL = 10 * 60;

export class GoogleOAuth {
  constructor({ clientId, clientSecret, redirectUri, redis, tokenReader }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.redis = redis;
    this.tokenReader = tokenReader;
  }

  stateKey(state) {
    return 'google-oauth:' + createHash('sha256').update(state).digest('hex');
  }

  async begin(userName) {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new AppError('Die Google-Anmeldung ist nicht vollständig konfiguriert.', 503);
    }
    if (
      typeof userName !== 'string' ||
      !userName ||
      /[/\\\0]/.test(userName) ||
      userName === '..'
    ) {
      throw new ValidationError('Ungültiger Benutzer.');
    }
    const redirect = new URL(this.redirectUri);
    if (redirect.protocol !== 'https:' || redirect.search || redirect.hash) {
      throw new AppError(
        'Für Google muss eine feste HTTPS-Callback-Adresse konfiguriert sein.',
        503
      );
    }

    const state = randomBytes(32).toString('hex');
    const verifier = randomBytes(32).toString('base64url');
    await this.redis.set(this.stateKey(state), JSON.stringify({ userName, verifier }), {
      EX: FLOW_TTL
    });

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/tasks.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256'
    }).toString();

    return { state, url: url.href, expiresAt: Date.now() + FLOW_TTL * 1000, userName };
  }

  async cancel(state) {
    if (typeof state === 'string' && /^[a-f0-9]{64}$/.test(state)) {
      await this.redis.del(this.stateKey(state));
    }
  }

  async complete({ state, code, error }) {
    if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state)) {
      throw new ValidationError('Ungültige Google-Anmeldung. Bitte einen neuen QR-Code anfordern.');
    }
    const raw = await this.redis.getDel(this.stateKey(state));
    if (!raw) {
      throw new ValidationError(
        'Diese Google-Anmeldung ist abgelaufen oder wurde bereits verwendet.'
      );
    }
    if (error) {
      throw new ValidationError('Die Google-Anmeldung wurde abgebrochen. Bitte erneut versuchen.');
    }
    if (typeof code !== 'string' || !code) {
      throw new ValidationError('Google hat keinen Anmeldecode übermittelt.');
    }
    const { userName, verifier } = JSON.parse(raw);
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier
      }),
      signal: AbortSignal.timeout(30000)
    });
    const tokens = await response.json();
    if (!response.ok || !tokens.access_token || !tokens.refresh_token) {
      throw new AppError(
        'Google konnte nicht verbunden werden. Bitte die Anmeldung erneut starten.',
        502
      );
    }
    this.tokenReader.saveTokens(userName, {
      user_id: userName,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      created: Date.now()
    });
  }
}
