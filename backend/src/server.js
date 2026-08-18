import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";

import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import resumeRouter from "./routes/resumes.js";
import dashboardRoutes from "./routes/dashboard.js";
import insightsRoutes from "./routes/insights.js";
import versionsRoutes from "./routes/versions.js";
import historyRoutes from "./routes/history.js";


const app = express();

// Trust reverse proxy
app.set("trust proxy", 1);

// CORS
app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  }),
);

// Request parsers
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Cookies
app.use(cookieParser());

// Request logging in development
if (env.nodeEnv === "development") {
  app.use(morgan("dev"));
}

// Routes
app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/resumes", resumeRouter);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/insights", insightsRoutes);
app.use("/api/versions", versionsRoutes);
app.use("/api/history", historyRoutes);


// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

const start = async () => {
  try {
    // Connect database first
    await connectDB();

    // Start server only after DB connection
    app.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

start();
