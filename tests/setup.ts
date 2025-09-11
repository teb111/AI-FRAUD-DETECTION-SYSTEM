// Test setup file
import { jest } from "@jest/globals";

// Mock environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.MONGO_URI = "mongodb://localhost:27017/fraud-detection-test";
process.env.REDIS_HOST = "localhost";
process.env.NEO4J_PASSWORD = "test-password";

// Global test timeout
jest.setTimeout(10000);

// Suppress console.log during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
