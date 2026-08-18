import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Protect expensive Gemini/AI requests
export const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  keyGenerator: (req) => {
    // Use authenticated user ID when available
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }

    // Otherwise fall back to IP
    return ipKeyGenerator(req.ip);
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: "Too many analysis requests. Please try again later.",
    },
  },
});

// Protect login/register from credential stuffing
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: "Too many authentication attempts. Please try again later.",
    },
  },
});
