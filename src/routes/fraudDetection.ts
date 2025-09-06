import express from "express";
import { FraudDetectionService } from "../services/FraudDetectionService";
import { MLService } from "../services/MLService";
import Transaction from "../models/Transaction";
import { redis } from "../utils/database";

const router = express.Router();
const fraudService = new FraudDetectionService();
const mlService = new MLService();

// Middleware to validate transaction request
const validateTransaction = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const { userId, amount, transactionType, deviceId, location } = req.body;

  if (!userId || !amount || !transactionType || !deviceId) {
    return res.status(400).json({
      error: "Missing required fields",
    });
  }

  if (location && (!location.latitude || !location.longitude)) {
    return res.status(400).json({
      error: "Invalid location format",
    });
  }

  next();
};

// Endpoint to check transaction risk
router.post(
  "/check",
  validateTransaction,
  async (req: express.Request, res: express.Response) => {
    try {
      const transaction = req.body;

      // Get rule-based fraud detection result
      const ruleBasedResult = await fraudService.detectFraud(transaction);

      // Get ML-based risk score
      const mlRiskScore = await mlService.predictRisk(transaction);

      // Combine scores (you can adjust the weights)
      const finalRiskScore =
        ruleBasedResult.riskScore * 0.6 + mlRiskScore * 0.4;

      // Store transaction with risk assessment
      const newTransaction = new Transaction({
        ...transaction,
        ipAddress: req.ip || req.connection.remoteAddress || "unknown",
        riskScore: finalRiskScore,
        status: finalRiskScore >= 0.7 ? "FLAGGED" : "PENDING",
      });
      await newTransaction.save();

      // Cache the result for quick lookups
      await redis.setex(
        `tx:${newTransaction._id}`,
        3600, // 1 hour expiry
        JSON.stringify({
          riskScore: finalRiskScore,
          reasons: ruleBasedResult.reasons,
        })
      );

      return res.json({
        transactionId: newTransaction._id,
        riskScore: finalRiskScore,
        isHighRisk: finalRiskScore >= 0.7,
        reasons: ruleBasedResult.reasons,
        recommendedAction: finalRiskScore >= 0.7 ? "DENY" : "ALLOW",
      });
    } catch (error) {
      console.error("Error in transaction check:", error);
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

// Endpoint to report fraud for model training
router.post(
  "/report-fraud",
  async (req: express.Request, res: express.Response) => {
    try {
      const { transactionId, wasActuallyFraud } = req.body;

      if (!transactionId || typeof wasActuallyFraud !== "boolean") {
        return res.status(400).json({
          error: "Missing required fields",
        });
      }

      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        return res.status(404).json({
          error: "Transaction not found",
        });
      }

      // Update transaction status
      transaction.status = wasActuallyFraud ? "DENIED" : "APPROVED";
      await transaction.save();

      // Update ML model
      await mlService.updateModelWithTransaction(transaction, wasActuallyFraud);

      return res.json({
        message: "Fraud report processed successfully",
      });
    } catch (error) {
      console.error("Error in fraud reporting:", error);
      return res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

// Endpoint to get transaction statistics
router.get("/stats", async (req: express.Request, res: express.Response) => {
  try {
    const stats = await Transaction.aggregate([
      {
        $facet: {
          last24Hours: [
            {
              $match: {
                createdAt: {
                  $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
              },
            },
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
                totalAmount: { $sum: "$amount" },
              },
            },
          ],
          riskDistribution: [
            {
              $group: {
                _id: {
                  $switch: {
                    branches: [
                      { case: { $lt: ["$riskScore", 0.3] }, then: "LOW" },
                      { case: { $lt: ["$riskScore", 0.7] }, then: "MEDIUM" },
                    ],
                    default: "HIGH",
                  },
                },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    return res.json(stats[0]);
  } catch (error) {
    console.error("Error getting statistics:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;
