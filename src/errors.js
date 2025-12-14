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
