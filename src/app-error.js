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
