import { ApiError } from "../utils/apiError.js";

export const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      throw ApiError.badRequest("Validation failed", result.error.issues);
    }

    req[source] = result.data;
    next();
  };
};
