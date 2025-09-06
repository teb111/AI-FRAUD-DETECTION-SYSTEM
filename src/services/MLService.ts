import * as tf from "@tensorflow/tfjs-node";
import { redis } from "../utils/database";

export class MLService {
  private model: tf.LayersModel | null = null;
  private readonly MODEL_VERSION_KEY = "ml:model:version";
  private readonly FEATURE_NAMES = [
    "amount",
    "hour",
    "dayOfWeek",
    "isNewDevice",
    "deviceUserCount",
    "txCountLast24h",
    "avgAmountLast24h",
  ];

  constructor() {
    // Initialize model asynchronously
    this.initializeModel();
  }

  private async initializeModel() {
    try {
      // Create a new model
      this.model = this.createModel();

      // Initialize with random weights
      const dummy_x = tf.randomNormal([1, this.FEATURE_NAMES.length]);
      const dummy_y = tf.randomUniform([1, 1]);

      // Train on dummy data to initialize weights
      await this.model.fit(dummy_x, dummy_y, {
        epochs: 1,
        verbose: 0,
      });

      dummy_x.dispose();
      dummy_y.dispose();

      console.log("Model initialized successfully");
    } catch (error) {
      console.error("Error initializing model:", error);
      this.model = null;
    }
  }

  private createModel(): tf.LayersModel {
    const model = tf.sequential();

    // Input layer
    model.add(
      tf.layers.dense({
        inputShape: [this.FEATURE_NAMES.length],
        units: 64,
        activation: "relu",
      })
    );

    // Hidden layer
    model.add(
      tf.layers.dense({
        units: 32,
        activation: "relu",
      })
    );

    // Output layer
    model.add(
      tf.layers.dense({
        units: 1,
        activation: "sigmoid",
      })
    );

    // Compile the model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "binaryCrossentropy",
      metrics: ["accuracy"],
    });

    return model;
  }

  private async preprocessFeatures(transaction: any): Promise<tf.Tensor2D> {
    const hour = new Date(transaction.createdAt).getHours();
    const dayOfWeek = new Date(transaction.createdAt).getDay();

    // Get device statistics from Redis
    const deviceKey = `device:${transaction.deviceId}`;
    const userCount = await redis.scard(deviceKey);

    // Get transaction history
    const txKey = `tx:${transaction.userId}:24h`;
    const recentTxs = await redis.lrange(txKey, 0, -1);
    const txCount = recentTxs.length;

    // Calculate average amount
    const amounts = recentTxs.map((tx) => JSON.parse(tx).amount);
    const avgAmount =
      amounts.length > 0
        ? amounts.reduce((a, b) => a + b, 0) / amounts.length
        : 0;

    // Create feature array
    const features = [
      transaction.amount,
      hour,
      dayOfWeek,
      userCount === 0 ? 1 : 0, // isNewDevice
      userCount,
      txCount,
      avgAmount,
    ];

    // Normalize features (you should use proper scaling based on your data)
    const normalizedFeatures = features.map((f) => f / 1000);

    return tf.tensor2d([normalizedFeatures], [1, this.FEATURE_NAMES.length]);
  }

  public async predictRisk(transaction: any): Promise<number> {
    if (!this.model) {
      // Fallback to basic risk scoring when model isn't ready
      return this.fallbackRiskScore(transaction);
    }

    try {
      const features = await this.preprocessFeatures(transaction);
      const prediction = this.model.predict(features) as tf.Tensor;
      const score = (await prediction.data())[0];

      features.dispose();
      prediction.dispose();

      // Ensure we don't return NaN
      if (isNaN(score)) {
        console.warn("ML model returned NaN score, using fallback");
        return this.fallbackRiskScore(transaction);
      }

      return score;
    } catch (error) {
      console.error("Error predicting risk:", error);
      return this.fallbackRiskScore(transaction);
    }
  }

  private fallbackRiskScore(transaction: any): number {
    // Basic risk scoring based on amount thresholds
    const amount = transaction.amount;
    if (amount > 1000000) return 0.9; // High risk for amounts over 1M
    if (amount > 500000) return 0.7; // Medium-high risk for amounts over 500K
    if (amount > 100000) return 0.5; // Medium risk for amounts over 100K
    return 0.2; // Low risk for smaller amounts
  }

  public async updateModelWithTransaction(
    transaction: any,
    wasActuallyFraud: boolean
  ) {
    if (!this.model) {
      throw new Error("Model not loaded");
    }

    const features = await this.preprocessFeatures(transaction);
    const label = tf.tensor2d([[wasActuallyFraud ? 1 : 0]], [1, 1]);

    // Update the model with new data
    await this.model.fit(features, label, {
      epochs: 1,
      verbose: 0,
    });

    features.dispose();
    label.dispose();

    // Increment model version
    await redis.incr(this.MODEL_VERSION_KEY);
  }
}
