# Machine Learning Model Documentation

## Overview

The fraud detection system uses a neural network model implemented with TensorFlow.js. The model combines traditional rule-based checks with machine learning to provide real-time fraud detection.

## Model Architecture

### Input Features (7 features):

1. `amount` - Transaction amount
2. `hour` - Hour of the day (0-23)
3. `dayOfWeek` - Day of the week (0-6)
4. `isNewDevice` - Whether this is a new device (0 or 1)
5. `deviceUserCount` - Number of users associated with the device
6. `txCountLast24h` - Number of transactions in last 24 hours
7. `avgAmountLast24h` - Average transaction amount in last 24 hours

### Neural Network Structure:

```
Input Layer (7 neurons)
    ↓
Dense Layer (64 neurons, ReLU activation)
    ↓
Dense Layer (32 neurons, ReLU activation)
    ↓
Output Layer (1 neuron, Sigmoid activation)
```

### Model Parameters:

- Optimizer: Adam (learning rate: 0.001)
- Loss Function: Binary Cross-entropy
- Metrics: Accuracy

## Feature Engineering

### 1. Transaction Amount

- Raw amount is normalized by dividing by 1000
- Helps detect unusual transaction amounts

### 2. Temporal Features

- Hour of day helps detect unusual timing
- Day of week helps establish normal patterns
- Both are cyclical features

### 3. Device Features

- isNewDevice flag for first-time devices
- deviceUserCount helps detect device sharing
- Stored in Redis for fast access

### 4. Historical Features

- Transaction count and average amount
- Uses 24-hour sliding window
- Stored in Redis for real-time access

## Model Training

### Online Learning:

The model updates continuously through:

1. Initial prediction on new transactions
2. Feedback loop when fraud is reported
3. Incremental model updates

### Training Process:

```typescript
public async updateModelWithTransaction(
    transaction: any,
    wasActuallyFraud: boolean
) {
    if (!this.model) {
        throw new Error('Model not loaded');
    }

    const features = await this.preprocessFeatures(transaction);
    const label = tf.tensor2d([[wasActuallyFraud ? 1 : 0]], [1, 1]);

    // Single epoch update
    await this.model.fit(features, label, {
        epochs: 1,
        verbose: 0
    });
}
```

## Risk Score Calculation

### 1. Feature Preprocessing:

```typescript
private async preprocessFeatures(transaction: any): Promise<tf.Tensor2D> {
    const hour = new Date(transaction.createdAt).getHours();
    const dayOfWeek = new Date(transaction.createdAt).getDay();

    // Get device statistics
    const deviceKey = `device:${transaction.deviceId}`;
    const userCount = await redis.scard(deviceKey);

    // Get transaction history
    const txKey = `tx:${transaction.userId}:24h`;
    const recentTxs = await redis.lrange(txKey, 0, -1);

    // Calculate features
    const features = [
        transaction.amount,
        hour,
        dayOfWeek,
        userCount === 0 ? 1 : 0,
        userCount,
        recentTxs.length,
        calculateAvgAmount(recentTxs)
    ];

    return tf.tensor2d([features], [1, this.FEATURE_NAMES.length]);
}
```

### 2. Risk Prediction:

```typescript
public async predictRisk(transaction: any): Promise<number> {
    const features = await this.preprocessFeatures(transaction);
    const prediction = this.model.predict(features) as tf.Tensor;
    const score = (await prediction.data())[0];
    return score; // Returns value between 0 and 1
}
```

## Performance Monitoring

### Metrics Tracked:

1. Model accuracy
2. False positive rate
3. False negative rate
4. Prediction latency

### Version Control:

- Model versions tracked in Redis
- Each update increments version number
- Allows for model rollback if needed

## Integration with Rule-Based System

The ML score is combined with rule-based scores:

```typescript
const finalRiskScore = ruleBasedResult.riskScore * 0.6 + mlRiskScore * 0.4;
```

This hybrid approach provides:

- Explainable decisions (rules)
- Pattern detection (ML)
- Real-time adaptation
- Regulatory compliance
