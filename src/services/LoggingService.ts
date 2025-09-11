import winston from "winston";
import config from "../config/config";
import { elasticClient } from "../utils/database";

export class LoggingService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
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
                filename: "logs/fraud-detection.log",
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
  }

  // Log fraud detection events
  async logFraudDetection(data: {
    transactionId: string;
    userId: string;
    riskScore: number;
    isHighRisk: boolean;
    reasons: string[];
    mlScore?: number;
    ruleBasedScore?: number;
    deviceId: string;
    amount: number;
    timestamp: Date;
  }) {
    const logEntry = {
      type: "FRAUD_DETECTION",
      timestamp: data.timestamp,
      transactionId: data.transactionId,
      userId: data.userId,
      riskScore: data.riskScore,
      isHighRisk: data.isHighRisk,
      reasons: data.reasons,
      mlScore: data.mlScore,
      ruleBasedScore: data.ruleBasedScore,
      deviceId: data.deviceId,
      amount: data.amount,
    };

    this.logger.info("Fraud detection completed", logEntry);

    // Also send to Elasticsearch for analytics
    try {
      await elasticClient.index({
        index: "fraud-detection-logs",
        body: logEntry,
      });
    } catch (error) {
      this.logger.error("Failed to send log to Elasticsearch", { error });
    }
  }

  // Log model training events
  async logModelTraining(data: {
    transactionId: string;
    wasActuallyFraud: boolean;
    modelVersion: number;
    timestamp: Date;
  }) {
    const logEntry = {
      type: "MODEL_TRAINING",
      timestamp: data.timestamp,
      transactionId: data.transactionId,
      wasActuallyFraud: data.wasActuallyFraud,
      modelVersion: data.modelVersion,
    };

    this.logger.info("Model training completed", logEntry);

    try {
      await elasticClient.index({
        index: "model-training-logs",
        body: logEntry,
      });
    } catch (error) {
      this.logger.error("Failed to send training log to Elasticsearch", {
        error,
      });
    }
  }

  // Log suspicious activities
  async logSuspiciousActivity(data: {
    userId: string;
    activityType: string;
    details: Record<string, any>;
    severity: "LOW" | "MEDIUM" | "HIGH";
    timestamp: Date;
  }) {
    const logEntry = {
      type: "SUSPICIOUS_ACTIVITY",
      timestamp: data.timestamp,
      userId: data.userId,
      activityType: data.activityType,
      details: data.details,
      severity: data.severity,
    };

    this.logger.warn("Suspicious activity detected", logEntry);

    try {
      await elasticClient.index({
        index: "suspicious-activity-logs",
        body: logEntry,
      });
    } catch (error) {
      this.logger.error(
        "Failed to send suspicious activity log to Elasticsearch",
        { error }
      );
    }
  }

  // Log system events
  logSystemEvent(
    level: "info" | "warn" | "error",
    message: string,
    meta?: Record<string, any>
  ) {
    this.logger[level](message, {
      type: "SYSTEM_EVENT",
      timestamp: new Date(),
      ...meta,
    });
  }

  // Get logger instance for direct use
  getLogger(): winston.Logger {
    return this.logger;
  }
}

export const loggingService = new LoggingService();
