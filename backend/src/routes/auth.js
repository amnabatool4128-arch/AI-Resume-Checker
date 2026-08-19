import express from "express";
import { z } from "zod";

import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { signToken, cookieOptions } from "../utils/jwt.js";

import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";

import User from "../models/User.js";

const router = express.Router();

// =========================
// Validation Schemas
// =========================

const registerSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
});

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

// =========================
// Session Helper
// =========================

const issueSession = (res, user) => {
  const token = signToken({
    sub: user._id.toString(),
  });

  res.cookie(env.cookieName, token, cookieOptions);
};

// =========================
// Register
// =========================

router.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      throw ApiError.conflict("Email already registered");
    }

    const hashedPassword = await User.hashPassword(password);

    const user = await User.create({
      email,
      passwordHash: hashedPassword,
      name,
    });

    issueSession(res, user);

    res.status(201).json({
      user,
    });
  }),
);

// =========================
// Login
// =========================

router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+passwordHash");

    if (!user) {
      throw ApiError.unauthorized("Invalid credentials");
    }

    const passwordMatches = await user.comparePassword(password);

    if (!passwordMatches) {
      throw ApiError.unauthorized("Invalid credentials");
    }

    issueSession(res, user);

    res.json({
      user,
    });
  }),
);

// =========================
// Logout
// =========================

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    res.clearCookie(env.cookieName, cookieOptions);

    res.json({
      message: "Logged out successfully",
    });
  }),
);

// =========================
// Get Current User
// =========================

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      user: req.user,
    });
  }),
);

// =========================
// Update Profile
// =========================

router.patch(
  "/profile",
  requireAuth,
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    const { name } = req.body;

    req.user.name = name;

    await req.user.save();

    res.json({
      user: req.user,
    });
  }),
);

// =========================
// Change Password
// =========================

router.patch(
  "/password",
  requireAuth,
  validate(passwordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+passwordHash");

    const passwordMatches = await user.comparePassword(currentPassword);

    if (!passwordMatches) {
      throw ApiError.unauthorized("Current password is incorrect");
    }

    user.passwordHash = await User.hashPassword(newPassword);

    await user.save();

    res.json({
      message: "Password updated successfully",
    });
  }),
);

export default router;
