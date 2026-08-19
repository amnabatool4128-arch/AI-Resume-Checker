import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import User from "../models/User.js";
import { ApiError } from "../utils/apiError.js";
import { verifyToken } from "../utils/jwt.js";

export const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.[env.cookieName];

    if (!token) {
      throw ApiError.unauthorized("Authentication required");
    }

    let payload;

    try {
      payload = verifyToken(token);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw ApiError.unauthorized("Session expired");
      }

      if (error instanceof jwt.JsonWebTokenError) {
        throw ApiError.unauthorized("Invalid authentication token");
      }

      throw error;
    }

    const userId = payload.sub;

    if (!userId) {
      throw ApiError.unauthorized("Invalid authentication token");
    }

    const user = await User.findById(userId);

    if (!user) {
      throw ApiError.unauthorized("User not found");
    }

    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
};
