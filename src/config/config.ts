import dotenv from "dotenv";

dotenv.config();

export default {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",

  // MongoDB configuration
  mongoUri:
    process.env.MONGO_URI || "mongodb://localhost:27017/fraud-detection",

  // Redis configuration
  redisHost: process.env.REDIS_HOST || "localhost",
  redisPort: parseInt(process.env.REDIS_PORT || "6379"),

  // Neo4j configuration
  neo4jUri: process.env.NEO4J_URI || "bolt://localhost:7687",
  neo4jUser: process.env.NEO4J_USER || "neo4j",
  neo4jPassword: process.env.NEO4J_PASSWORD,

  // Kafka/RabbitMQ configuration
  messageQueueUrl: process.env.MESSAGE_QUEUE_URL || "amqp://localhost",

  // Elasticsearch configuration
  elasticUrl: process.env.ELASTIC_URL || "http://localhost:9200",

  // JWT configuration
  jwtSecret: process.env.JWT_SECRET || "your-secret-key",

  // System thresholds
  thresholds: {
    maxTransactionAmount: 1000000, // ₦1,000,000
    maxDailyTransactions: 20,
    maxVelocityPerMinute: 5,
    nightTimeStart: 23, // 11 PM
    nightTimeEnd: 5, // 5 AM
  },
};
