import express from "express";
import cors from "cors";
import winston from "winston";
import { initializeConnections } from "./utils/database";
import fraudDetectionRoutes from "./routes/fraudDetection";
import config from "./config/config";
import {
  securityMiddleware,
  fraudDetectionLimiter,
  sanitizeInput,
} from "./middleware/auth";
import { globalErrorHandler } from "./middleware/validation";

// Initialize Express app
const app = express();

// Create logger with improved configuration
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    ...(config.logging.enableFileLogging
      ? [
          new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: "logs/combined.log",
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
        ]
      : []),
    ...(config.logging.enableConsoleLogging
      ? [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            ),
          }),
        ]
      : []),
  ],
});

// Security middleware
app.use(securityMiddleware);

// CORS configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Input sanitization
app.use(sanitizeInput);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });
  next();
});

// Routes with rate limiting
app.use("/api/fraud-detection", fraudDetectionLimiter, fraudDetectionRoutes);

// Health check endpoint with system info
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    environment: config.nodeEnv,
    uptime: process.uptime(),
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

// Global error handling middleware
app.use(globalErrorHandler);

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT signal received: closing HTTP server");
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    // Initialize database connections
    await initializeConnections();

    // Start the server
    const server = app.listen(config.port, () => {
      logger.info(
        `Server running on port ${config.port} in ${config.nodeEnv} mode`
      );
    });

    // Handle server errors
    server.on("error", (error) => {
      logger.error("Server error:", error);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
