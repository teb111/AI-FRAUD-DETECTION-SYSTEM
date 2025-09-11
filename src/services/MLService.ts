import * as tf from "@tensorflow/tfjs-node";
import { redis } from "../utils/database";
import path from "path";
import fs from "fs";

export class MLService {
  private model: tf.LayersModel | null = null;
  private readonly MODEL_VERSION_KEY = "ml:model:version";
  private readonly MODEL_PATH = path.join(
    __dirname,
    "../../models/fraud-detection-model"
  );
  private readonly FEATURE_NAMES = [
    "amount",
    "hour",
    "dayOfWeek",
    "isNewDevice",
    "deviceUserCount",
    "txCountLast24h",
    "avgAmountLast24h",
    "txCountLast7d",
    "avgAmountLast7d",
    "uniqueDevicesLast24h",
  ];
  private readonly FEATURE_STATS = {
    // Feature normalization statistics
    amount: { mean: 50000, std: 200000 },
    hour: { mean: 12, std: 6.93 },
    dayOfWeek: { mean: 3, std: 2 },
    isNewDevice: { mean: 0.1, std: 0.3 },
    deviceUserCount: { mean: 1.2, std: 0.5 },
    txCountLast24h: { mean: 2.5, std: 3.2 },
    avgAmountLast24h: { mean: 45000, std: 180000 },
    txCountLast7d: { mean: 12, std: 15 },
    avgAmountLast7d: { mean: 48000, std: 190000 },
    uniqueDevicesLast24h: { mean: 1.1, std: 0.4 },
  };

  constructor() {
    // Initialize model asynchronously
    this.initializeModel();
  }

  private async initializeModel() {
    try {
      // Try to load existing model first
      if (await this.loadExistingModel()) {
        console.log("Existing model loaded successfully");
        return;
      }

      // Create a new model if no existing model found
      this.model = this.createModel();

      // Initialize with dummy data to set up the model structure
      const dummy_x = tf.randomNormal([1, this.FEATURE_NAMES.length]);
      const dummy_y = tf.randomUniform([1, 1]);

      // Train on dummy data to initialize weights
      await this.model.fit(dummy_x, dummy_y, {
        epochs: 1,
        verbose: 0,
      });

      dummy_x.dispose();
      dummy_y.dispose();

      // Save the initialized model
      await this.saveModel();

      console.log("Model initialized and saved successfully");
    } catch (error) {
      console.error("Error initializing model:", error);
      this.model = null;
    }
  }

  private async loadExistingModel(): Promise<boolean> {
    try {
      if (fs.existsSync(this.MODEL_PATH)) {
        this.model = await tf.loadLayersModel(
          `file://${this.MODEL_PATH}/model.json`
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error loading existing model:", error);
      return false;
    }
  }

  private async saveModel(): Promise<void> {
    if (!this.model) return;

    try {
      // Ensure directory exists
      if (!fs.existsSync(this.MODEL_PATH)) {
        fs.mkdirSync(this.MODEL_PATH, { recursive: true });
      }

      await this.model.save(`file://${this.MODEL_PATH}`);
      console.log("Model saved successfully");
    } catch (error) {
      console.error("Error saving model:", error);
    }
  }

  private createModel(): tf.LayersModel {
    const model = tf.sequential();

    // Input layer with batch normalization
    model.add(
      tf.layers.dense({
        inputShape: [this.FEATURE_NAMES.length],
        units: 128,
        activation: "relu",
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
      })
    );

    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.dropout({ rate: 0.3 }));

    // Hidden layers
    model.add(
      tf.layers.dense({
        units: 64,
        activation: "relu",
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
      })
    );

    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.dropout({ rate: 0.2 }));

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

    // Compile the model with better optimizer settings
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "binaryCrossentropy",
      metrics: ["accuracy", "precision", "recall"],
    });

    return model;
  }

  private async preprocessFeatures(transaction: any): Promise<tf.Tensor2D> {
    const hour = new Date(transaction.createdAt || Date.now()).getHours();
    const dayOfWeek = new Date(transaction.createdAt || Date.now()).getDay();

    // Get device statistics from Redis
    const deviceKey = `device:${transaction.deviceId}`;
    const userCount = await redis.scard(deviceKey);

    // Get transaction history - last 24h
    const tx24hKey = `tx:${transaction.userId}:24h`;
    const recentTxs24h = await redis.lrange(tx24hKey, 0, -1);
    const txCount24h = recentTxs24h.length;

    // Get transaction history - last 7d
    const tx7dKey = `tx:${transaction.userId}:7d`;
    const recentTxs7d = await redis.lrange(tx7dKey, 0, -1);
    const txCount7d = recentTxs7d.length;

    // Calculate average amounts
    const amounts24h = recentTxs24h.map((tx) => {
      try {
        return JSON.parse(tx).amount;
      } catch {
        return 0;
      }
    });
    const avgAmount24h =
      amounts24h.length > 0
        ? amounts24h.reduce((a, b) => a + b, 0) / amounts24h.length
        : 0;

    const amounts7d = recentTxs7d.map((tx) => {
      try {
        return JSON.parse(tx).amount;
      } catch {
        return 0;
      }
    });
    const avgAmount7d =
      amounts7d.length > 0
        ? amounts7d.reduce((a, b) => a + b, 0) / amounts7d.length
        : 0;

    // Get unique devices in last 24h
    const deviceSetKey = `user_devices:${transaction.userId}:24h`;
    const uniqueDevices24h = await redis.scard(deviceSetKey);

    // Create feature array
    const features = [
      transaction.amount,
      hour,
      dayOfWeek,
      userCount === 0 ? 1 : 0, // isNewDevice
      userCount,
      txCount24h,
      avgAmount24h,
      txCount7d,
      avgAmount7d,
      uniqueDevices24h,
    ];

    // Normalize features using z-score normalization
    const normalizedFeatures = features.map((feature, index) => {
      const featureName = this.FEATURE_NAMES[index];
      const stats =
        this.FEATURE_STATS[featureName as keyof typeof this.FEATURE_STATS];
      if (stats) {
        return (feature - stats.mean) / stats.std;
      }
      return feature / 1000; // Fallback normalization
    });

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
