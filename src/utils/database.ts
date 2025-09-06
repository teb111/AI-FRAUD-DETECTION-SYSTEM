import mongoose from "mongoose";
import Redis from "ioredis";
import neo4j from "neo4j-driver";
import { Client } from "@elastic/elasticsearch";
import config from "../config/config";
import winston from "winston";

// Create logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// MongoDB Connection
export const connectMongo = async () => {
  try {
    logger.info("Connecting to MongoDB at:", config.mongoUri);
    await mongoose.connect(config.mongoUri);
    logger.info("MongoDB connected successfully");
  } catch (error) {
    logger.error("MongoDB connection error:", error);
    console.error("MongoDB connection error details:", error);
    process.exit(1);
  }
};

// Redis Connection
export const redis = new Redis({
  host: config.redisHost,
  port: config.redisPort,
});

redis.on("error", (error) => {
  logger.error("Redis connection error:", error);
});

redis.on("connect", () => {
  logger.info("Redis connected successfully");
});

// Neo4j Connection
export const neo4jDriver = neo4j.driver(
  config.neo4jUri,
  neo4j.auth.basic(config.neo4jUser, config.neo4jPassword || "")
);

// Verify Neo4j connection
export const verifyNeo4jConnection = async () => {
  try {
    const session = neo4jDriver.session();
    await session.run("RETURN 1");
    session.close();
    logger.info("Neo4j connected successfully");
  } catch (error) {
    logger.error("Neo4j connection error:", error);
    process.exit(1);
  }
};

// Elasticsearch Connection
export const elasticClient = new Client({
  node: config.elasticUrl,
});

// Verify Elasticsearch connection
export const verifyElasticConnection = async () => {
  try {
    await elasticClient.ping();
    logger.info("Elasticsearch connected successfully");
  } catch (error) {
    logger.error("Elasticsearch connection error:", error);
    process.exit(1);
  }
};

// Initialize all connections
export const initializeConnections = async () => {
  await connectMongo();
  await verifyNeo4jConnection();
  await verifyElasticConnection();
};
