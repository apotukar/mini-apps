export class AppError extends Error {
  constructor(message, status = 500, isKnown = true, href = null) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.isKnown = isKnown;
    this.href = href;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', href = null) {
    super(message, 404, true, href);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', href = null) {
    super(message, 400, true, href);
  }
}

export class PermissionError extends AppError {
  constructor(message = 'Not allowed', href = null) {
    super(message, 403, true, href);
  }
}

export class OAuthReauthRequiredError extends AppError {
  constructor({ provider = 'google', reason = 'expired_or_revoked', providerLabel = null } = {}) {
    const label = providerLabel ?? provider.charAt(0).toUpperCase() + provider.slice(1);

    const messages = {
      expired_or_revoked: `Your ${label} authorization has expired or was revoked. Please reconnect your account.`,
      missing_refresh_token: `Your ${label} authorization is incomplete. Please reconnect your account.`,
      unknown: `Your ${label} authorization is no longer valid. Please reconnect your account.`
    };

    super(messages[reason] ?? messages.unknown, 401, true, `/auth/${provider}?reauth=1`);

    this.provider = provider;
    this.reason = reason;
  }
}
