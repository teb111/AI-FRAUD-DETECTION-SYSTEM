import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import config from "../config/config";
import { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

// JWT Authentication middleware
export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, config.jwtSecret, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// Rate limiting for fraud detection endpoints
export const fraudDetectionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many fraud detection requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for model training endpoints
export const modelTrainingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: "Too many model training requests, please try again later",
  },
});

// Security headers
export const securityMiddleware = helmet({
  crossOriginEmbedderPolicy: false,
});

// Input sanitization
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Remove any potential XSS attempts
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === "string") {
      return obj.replace(
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        ""
      );
    }
    if (typeof obj === "object" && obj !== null) {
      for (const key in obj) {
        obj[key] = sanitizeObject(obj[key]);
      }
    }
    return obj;
  };

  req.body = sanitizeObject(req.body);
  next();
};
