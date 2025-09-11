import request from "supertest";
import express from "express";
import fraudDetectionRoutes from "../src/routes/fraudDetection";

// Mock all dependencies before importing anything else
jest.mock("../src/services/FraudDetectionService", () => ({
  FraudDetectionService: jest.fn().mockImplementation(() => ({
    detectFraud: jest.fn().mockResolvedValue({
      isFreudulent: false,
      riskScore: 0.3,
      reasons: [],
    }),
  })),
}));

jest.mock("../src/services/MLService", () => ({
  MLService: jest.fn().mockImplementation(() => ({
    predictRisk: jest.fn().mockResolvedValue(0.4),
    updateModelWithTransaction: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("../src/models/Transaction", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      userId: "user123",
      amount: 50000,
      riskScore: 0.35,
      status: "PENDING",
    }),
  })),
  aggregate: jest.fn().mockResolvedValue([
    {
      last24Hours: [
        { _id: "PENDING", count: 10, totalAmount: 500000 },
        { _id: "APPROVED", count: 5, totalAmount: 250000 },
      ],
      riskDistribution: [
        { _id: "LOW", count: 8 },
        { _id: "MEDIUM", count: 5 },
        { _id: "HIGH", count: 2 },
      ],
    },
  ]),
  findById: jest.fn().mockResolvedValue({
    _id: "507f1f77bcf86cd799439011",
    userId: "user123",
    amount: 50000,
    status: "PENDING",
    save: jest.fn().mockResolvedValue(true),
  }),
}));

jest.mock("../src/utils/database", () => ({
  redis: {
    setex: jest.fn().mockResolvedValue("OK"),
    get: jest.fn(),
    zadd: jest.fn(),
    zrangebyscore: jest.fn(),
    smembers: jest.fn(),
    sadd: jest.fn(),
    expire: jest.fn(),
    scard: jest.fn(),
    lrange: jest.fn(),
    incr: jest.fn(),
  },
}));

const app = express();
app.use(express.json());
app.use("/api/fraud-detection", fraudDetectionRoutes);

describe("Fraud Detection API", () => {
  describe("POST /api/fraud-detection/check", () => {
    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/api/fraud-detection/check")
        .send({
          // Missing required fields
          amount: 50000,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Missing required fields");
    });

    it("should validate transaction amount", async () => {
      const response = await request(app)
        .post("/api/fraud-detection/check")
        .send({
          userId: "user123",
          amount: -1000, // Invalid negative amount
          transactionType: "TRANSFER",
          deviceId: "device123",
        });

      expect(response.status).toBe(400);
    });

    it("should validate location format", async () => {
      const response = await request(app)
        .post("/api/fraud-detection/check")
        .send({
          userId: "user123",
          amount: 50000,
          transactionType: "TRANSFER",
          deviceId: "device123",
          location: {
            latitude: "invalid", // Should be number
            longitude: 3.3792,
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid location format");
    });

    it("should accept valid transaction", async () => {
      const validTransaction = {
        userId: "user123",
        amount: 50000,
        transactionType: "TRANSFER",
        deviceId: "device123",
        location: {
          latitude: 6.5244,
          longitude: 3.3792,
        },
        beneficiaryAccountNumber: "1234567890",
        beneficiaryBankCode: "044",
      };

      const response = await request(app)
        .post("/api/fraud-detection/check")
        .send(validTransaction);

      // Should not return validation error
      expect(response.status).not.toBe(400);
    });
  });

  describe("POST /api/fraud-detection/report-fraud", () => {
    it("should validate fraud report fields", async () => {
      const response = await request(app)
        .post("/api/fraud-detection/report-fraud")
        .send({
          transactionId: "invalid-id", // Should be 24 character ObjectId
          wasActuallyFraud: "yes", // Should be boolean
        });

      expect(response.status).toBe(400);
    });

    it("should accept valid fraud report", async () => {
      const validReport = {
        transactionId: "507f1f77bcf86cd799439011", // Valid ObjectId
        wasActuallyFraud: true,
        feedback: "Customer confirmed this was fraud",
      };

      const response = await request(app)
        .post("/api/fraud-detection/report-fraud")
        .send(validReport);

      // Should not return validation error
      expect(response.status).not.toBe(400);
    });
  });

  describe("GET /api/fraud-detection/stats", () => {
    it("should return statistics", async () => {
      const response = await request(app).get("/api/fraud-detection/stats");

      expect(response.status).toBe(200);
      // Should return some statistics structure
    });
  });
});
