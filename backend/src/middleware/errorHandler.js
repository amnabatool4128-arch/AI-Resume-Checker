import mongoose from "mongoose";
import { ZodError } from "zod";
import { ApiError } from "../utils/apiError.js";

export const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.originalUrl}`));
};

export const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let details = err.details;

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = "Validation failed";

    details = Object.fromEntries(
      Object.entries(err.errors).map(([field, error]) => [
        field,
        error.message,
      ]),
    );
  }

  // Mongoose invalid ObjectId
  else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = "Invalid ID";
  }

  // MongoDB duplicate key error
  else if (err?.code === 11000) {
    status = 409;
    message = "Duplicate value";

    details = err.keyValue;
  }

  // Zod validation error
  else if (err instanceof ZodError) {
    status = 400;
    message = "Validation failed";

    details = err.flatten();
  }

  // Log unexpected server errors
  if (status >= 500) {
    console.error(err);
  }

  const response = {
    error: {
      message,
    },
  };

  if (details !== undefined) {
    response.error.details = details;
  }

  if (process.env.NODE_ENV === "development") {
    response.error.stack = err.stack;
  }

  res.status(status).json(response);
};
