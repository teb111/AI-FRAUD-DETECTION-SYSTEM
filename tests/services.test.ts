// Mock dependencies first
jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn(),
}));
jest.mock("@tensorflow/tfjs-node", () => ({
  tensor2d: jest.fn(() => ({
    dispose: jest.fn(),
  })),
  sequential: jest.fn(() => ({
    add: jest.fn(),
    compile: jest.fn(),
    fit: jest.fn().mockResolvedValue({}),
    predict: jest.fn(() => ({
      data: jest.fn().mockResolvedValue([0.5]),
      dispose: jest.fn(),
    })),
    save: jest.fn().mockResolvedValue({}),
  })),
  layers: {
    dense: jest.fn(),
    batchNormalization: jest.fn(),
    dropout: jest.fn(),
  },
  train: {
    adam: jest.fn(),
  },
  regularizers: {
    l2: jest.fn(),
  },
  loadLayersModel: jest.fn(),
  randomNormal: jest.fn(() => ({
    dispose: jest.fn(),
  })),
  randomUniform: jest.fn(() => ({
    dispose: jest.fn(),
  })),
}));

jest.mock("../src/utils/database", () => ({
  redis: {
    zadd: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    zrangebyscore: jest.fn().mockResolvedValue([]),
    smembers: jest.fn().mockResolvedValue([]),
    sadd: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    scard: jest.fn().mockResolvedValue(0),
    lrange: jest.fn().mockResolvedValue([]),
    incr: jest.fn().mockResolvedValue(1),
  },
}));
jest.mock("../src/models/Transaction");
jest.mock("../src/models/User");

import { FraudDetectionService } from "../src/services/FraudDetectionService";
import { MLService } from "../src/services/MLService";
import { redis } from "../src/utils/database";

describe("FraudDetectionService", () => {
  let fraudService: FraudDetectionService;
  let mockRedis: jest.Mocked<typeof redis>;

  beforeEach(() => {
    fraudService = new FraudDetectionService();
    mockRedis = redis as jest.Mocked<typeof redis>;
    jest.clearAllMocks();
  });

  describe("detectFraud", () => {
    it("should detect high velocity fraud", async () => {
      const transaction = {
        userId: "user123",
        amount: 50000,
        deviceId: "device123",
        location: { latitude: 6.5244, longitude: 3.3792 }, // Lagos
      };

      // Mock high velocity - first call for minute check, second for hour check
      mockRedis.zrangebyscore
        .mockResolvedValueOnce([
          "50000:1",
          "60000:2",
          "70000:3",
          "80000:4",
          "90000:5",
          "100000:6", // 6 transactions in last minute
        ])
        .mockResolvedValueOnce(new Array(25).fill("amount:timestamp")); // 25 transactions in last hour

      // Mock other Redis calls
      mockRedis.smembers.mockResolvedValue(["user123"]);
      mockRedis.get.mockResolvedValue("6.5244:3.3792");

      const result = await fraudService.detectFraud(transaction);

      expect(result.isFreudulent).toBe(true);
      expect(result.riskScore).toBeGreaterThan(0.7);
      expect(result.reasons).toContain(
        "High transaction velocity detected (per minute)"
      );
    });

    it("should detect device sharing fraud", async () => {
      const transaction = {
        userId: "user123",
        amount: 50000,
        deviceId: "device123",
      };

      // Mock device used by multiple users
      mockRedis.zrangebyscore.mockResolvedValue([]); // No velocity issues
      mockRedis.smembers.mockResolvedValue(["user456", "user789"]);

      const result = await fraudService.detectFraud(transaction);

      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.reasons).toContain("Device associated with multiple users");
    });

    it("should detect geographical anomaly", async () => {
      const transaction = {
        userId: "user123",
        amount: 50000,
        deviceId: "device123",
        location: { latitude: 6.5244, longitude: 3.3792 }, // Lagos
      };

      // Mock previous location in Abuja (about 400km away)
      mockRedis.zrangebyscore.mockResolvedValue([]); // No velocity issues
      mockRedis.smembers.mockResolvedValue(["user123"]); // Same user device
      mockRedis.get.mockResolvedValue("9.0765:7.3986");

      const result = await fraudService.detectFraud(transaction);

      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.reasons).toContain("Unusual geographical location");
    });

    it("should pass clean transaction", async () => {
      const transaction = {
        userId: "user123",
        amount: 5000, // Small amount
        deviceId: "device123",
        location: { latitude: 6.5244, longitude: 3.3792 },
      };

      // Mock clean patterns
      mockRedis.zrangebyscore.mockResolvedValue([]); // No velocity issues
      mockRedis.smembers.mockResolvedValue(["user123"]); // Same user device
      mockRedis.get.mockResolvedValue("6.5244:3.3792"); // Same location

      const result = await fraudService.detectFraud(transaction);

      expect(result.isFreudulent).toBe(false);
      expect(result.riskScore).toBeLessThan(0.7);
    });
  });
});

describe("MLService", () => {
  let mlService: MLService;

  beforeEach(() => {
    jest.clearAllMocks();
    mlService = new MLService();
  });

  describe("predictRisk", () => {
    it("should return a valid risk score", async () => {
      const transaction = {
        userId: "user123",
        amount: 100000,
        deviceId: "device123",
        createdAt: new Date(),
      };

      // Mock Redis calls for feature preprocessing
      const mockRedis = redis as jest.Mocked<typeof redis>;
      mockRedis.scard.mockResolvedValue(1);
      mockRedis.lrange.mockResolvedValue(['{"amount": 50000}']);

      const riskScore = await mlService.predictRisk(transaction);

      expect(riskScore).toBeGreaterThanOrEqual(0);
      expect(riskScore).toBeLessThanOrEqual(1);
      expect(typeof riskScore).toBe("number");
      expect(isNaN(riskScore)).toBe(false);
    });

    it("should handle missing createdAt", async () => {
      const transaction = {
        userId: "user123",
        amount: 100000,
        deviceId: "device123",
        // No createdAt
      };

      // Mock Redis calls for feature preprocessing
      const mockRedis = redis as jest.Mocked<typeof redis>;
      mockRedis.scard.mockResolvedValue(1);
      mockRedis.lrange.mockResolvedValue([]);

      const riskScore = await mlService.predictRisk(transaction);

      expect(riskScore).toBeGreaterThanOrEqual(0);
      expect(riskScore).toBeLessThanOrEqual(1);
    });
  });
});
