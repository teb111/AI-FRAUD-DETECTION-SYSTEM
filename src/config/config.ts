import dotenv from "dotenv";

dotenv.config();

// Validate required environment variables (only in production)
const requiredEnvVars = [
  "JWT_SECRET",
  "MONGO_URI",
  "REDIS_HOST",
  "NEO4J_PASSWORD",
];

if (process.env.NODE_ENV === "production") {
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
}

export default {
  // Server configuration
  port: parseInt(process.env.PORT || "3000"),
  nodeEnv: process.env.NODE_ENV || "development",

  // MongoDB configuration
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/fraud-detection-test",

  // Redis configuration
  redisHost: process.env.REDIS_HOST || "localhost",
  redisPort: parseInt(process.env.REDIS_PORT || "6379"),
  redisPassword: process.env.REDIS_PASSWORD,

  // Neo4j configuration
  neo4jUri: process.env.NEO4J_URI || "bolt://localhost:7687",
  neo4jUser: process.env.NEO4J_USER || "neo4j",
  neo4jPassword: process.env.NEO4J_PASSWORD || "test-password",

  // Kafka/RabbitMQ configuration
  messageQueueUrl: process.env.MESSAGE_QUEUE_URL || "amqp://localhost",

  // Elasticsearch configuration
  elasticUrl: process.env.ELASTIC_URL || "http://localhost:9200",

  // JWT configuration
  jwtSecret: process.env.JWT_SECRET || "test-secret-key",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",

  // System thresholds - configurable via environment
  thresholds: {
    maxTransactionAmount: parseInt(
      process.env.MAX_TRANSACTION_AMOUNT || "1000000"
    ), // ₦1,000,000
    maxDailyTransactions: parseInt(process.env.MAX_DAILY_TRANSACTIONS || "20"),
    maxVelocityPerMinute: parseInt(process.env.MAX_VELOCITY_PER_MINUTE || "5"),
    nightTimeStart: parseInt(process.env.NIGHT_TIME_START || "23"), // 11 PM
    nightTimeEnd: parseInt(process.env.NIGHT_TIME_END || "5"), // 5 AM
    fraudThreshold: parseFloat(process.env.FRAUD_THRESHOLD || "0.7"),
    riskThreshold: parseFloat(process.env.RISK_THRESHOLD || "0.5"),
  },

  // Rate limiting
  rateLimiting: {
    fraudDetection: {
      windowMs: parseInt(process.env.FRAUD_DETECTION_RATE_WINDOW || "60000"), // 1 minute
      max: parseInt(process.env.FRAUD_DETECTION_RATE_MAX || "100"),
    },
    modelTraining: {
      windowMs: parseInt(process.env.MODEL_TRAINING_RATE_WINDOW || "900000"), // 15 minutes
      max: parseInt(process.env.MODEL_TRAINING_RATE_MAX || "10"),
    },
  },

  // Feature flags
  features: {
    enableMLModel: process.env.ENABLE_ML_MODEL !== "false",
    enableGeolocation: process.env.ENABLE_GEOLOCATION !== "false",
    enableDeviceTracking: process.env.ENABLE_DEVICE_TRACKING !== "false",
    enableRealTimeNotifications:
      process.env.ENABLE_REAL_TIME_NOTIFICATIONS !== "false",
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || "info",
    enableFileLogging: process.env.ENABLE_FILE_LOGGING !== "false",
    enableConsoleLogging: process.env.ENABLE_CONSOLE_LOGGING !== "false",
  },
};
