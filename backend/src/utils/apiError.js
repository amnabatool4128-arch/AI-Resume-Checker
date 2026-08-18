export class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);

    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Unauthorized", details) {
    return new ApiError(401, message, details);
  }

  static forbidden(message = "Forbidden", details) {
    return new ApiError(403, message, details);
  }

  static notFound(message = "Not found", details) {
    return new ApiError(404, message, details);
  }

  static conflict(message = "Conflict", details) {
    return new ApiError(409, message, details);
  }

  static tooMany(message = "Too many requests", details) {
    return new ApiError(429, message, details);
  }

  static internal(message = "Internal server error", details) {
    return new ApiError(500, message, details);
  }
}
