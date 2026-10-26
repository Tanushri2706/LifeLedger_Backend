export class AppError extends Error {
  public readonly statusCode: number;
  public readonly error: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    error: Record<string, unknown> = {}
  ) {
    super(message);
    this.statusCode = statusCode;
    this.error = error;
    this.name = 'AppError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
