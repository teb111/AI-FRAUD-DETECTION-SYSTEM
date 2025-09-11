import Joi from "joi";
import { Request, Response, NextFunction } from "express";

// Transaction validation schema
export const transactionSchema = Joi.object({
  userId: Joi.string().required().min(1),
  amount: Joi.number().positive().max(10000000).required(), // Max 10M NGN
  transactionType: Joi.string()
    .valid("TRANSFER", "CARD", "QR", "POS")
    .required(),
  deviceId: Joi.string().required().min(1),
  beneficiaryAccountNumber: Joi.string()
    .pattern(/^\d{10}$/)
    .optional(),
  beneficiaryBankCode: Joi.string().length(3).optional(),
  merchantId: Joi.string().optional(),
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  }).optional(),
  cardDetails: Joi.object({
    last4: Joi.string()
      .length(4)
      .pattern(/^\d{4}$/)
      .required(),
    bin: Joi.string()
      .length(6)
      .pattern(/^\d{6}$/)
      .required(),
    country: Joi.string().length(2).uppercase().required(),
  }).optional(),
});

// Fraud report validation schema
export const fraudReportSchema = Joi.object({
  transactionId: Joi.string().required().length(24), // MongoDB ObjectId length
  wasActuallyFraud: Joi.boolean().required(),
  feedback: Joi.string().max(500).optional(),
});

// Validation middleware factory
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorDetails = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return res.status(400).json({
        error: "Validation failed",
        details: errorDetails,
      });
    }

    req.body = value; // Use sanitized value
    next();
  };
};

// Global error handler
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const globalErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }

  // Log unexpected errors
  console.error("Unexpected error:", err);

  return res.status(500).json({
    error: "Internal server error",
    timestamp: new Date().toISOString(),
    path: req.path,
  });
};
