# Fraud Detection Rules Documentation

## Overview

The system implements multiple rule-based checks alongside ML predictions to detect fraudulent transactions in real-time. These rules are specifically designed for the Nigerian context.

## Rule Categories

### 1. Velocity Rules

Detects rapid succession of transactions that might indicate automated fraud attempts.

```typescript
private async checkVelocity(userId: string, amount: number) {
    const key = `velocity:${userId}`;
    const now = Date.now();
    const minuteAgo = now - 60000;

    // Get recent transactions
    const recentTxns = await redis.zrangebyscore(key, minuteAgo, now);

    if (recentTxns.length > config.thresholds.maxVelocityPerMinute) {
        return {
            score: 0.8,
            reason: 'High transaction velocity detected'
        };
    }
}
```

**Thresholds:**

- Max transactions per minute: 5
- Score impact: 0.8 (high)
- Use case: Detects automated fraud attempts

### 2. Device Risk Rules

Identifies suspicious device usage patterns that might indicate account takeover or mule accounts.

```typescript
private async checkDeviceRisk(userId: string, deviceId: string) {
    const key = `device:${deviceId}`;
    const userIds = await redis.smembers(key);

    if (userIds.length > 0 && !userIds.includes(userId)) {
        return {
            score: 0.7,
            reason: 'Device associated with multiple users'
        };
    }
}
```

**Risk Factors:**

- Multiple users per device
- New device for existing user
- Score impact: 0.7 (high)
- Use case: Detects account sharing and mule accounts

### 3. Geographical Risk Rules

Detects suspicious location patterns that might indicate account compromise.

```typescript
private async checkGeoRisk(userId: string, latitude: number, longitude: number) {
    const key = `geo:${userId}`;
    const lastLocation = await redis.get(key);

    if (lastLocation) {
        const [lastLat, lastLon] = lastLocation.split(':').map(Number);
        const distance = this.calculateDistance(
            latitude, longitude, lastLat, lastLon
        );

        if (distance > 100) { // If distance > 100km
            return {
                score: 0.6,
                reason: 'Unusual geographical location'
            };
        }
    }
}
```

**Checks:**

- Distance between transactions
- Threshold: 100km
- Score impact: 0.6 (medium)
- Use case: Detects account takeover and card cloning

### 4. Amount Threshold Rules

Identifies unusually large transactions that might indicate fraud.

```typescript
if (transaction.amount > config.thresholds.maxTransactionAmount) {
  totalScore += 0.5;
  reasons.push("Transaction amount exceeds threshold");
}
```

**Thresholds:**

- Maximum amount: ₦1,000,000
- Score impact: 0.5 (medium)
- Use case: Detects unauthorized large transfers

### 5. Time-Based Rules

Identifies suspicious transaction timing.

```typescript
const hour = new Date().getHours();
if (
  hour >= config.thresholds.nightTimeStart ||
  hour <= config.thresholds.nightTimeEnd
) {
  totalScore += 0.3;
  reasons.push("Night time transaction");
}
```

**Parameters:**

- Night time: 11 PM - 5 AM
- Score impact: 0.3 (low)
- Use case: Detects unusual timing

## Risk Score Calculation

### Score Aggregation

```typescript
let totalScore = 0;

// Add rule scores
if (velocityCheck.score > 0) totalScore += velocityCheck.score;
if (deviceCheck.score > 0) totalScore += deviceCheck.score;
if (geoCheck.score > 0) totalScore += geoCheck.score;
if (amountCheck) totalScore += 0.5;
if (timeCheck) totalScore += 0.3;

// Normalize score
const normalizedScore = Math.min(totalScore, 1);
```

### Decision Thresholds

- Score < 0.3: Low risk
- Score 0.3 - 0.7: Medium risk
- Score > 0.7: High risk (transaction flagged)

## Rule Customization

### Configuration

Rules can be customized in `config.ts`:

```typescript
thresholds: {
    maxTransactionAmount: 1000000, // ₦1,000,000
    maxDailyTransactions: 20,
    maxVelocityPerMinute: 5,
    nightTimeStart: 23,
    nightTimeEnd: 5
}
```

### Adding New Rules

To add a new rule:

1. Create a check method in `FraudDetectionService`
2. Add relevant thresholds to config
3. Integrate into `detectFraud` method
4. Update score calculation

## Compliance Integration

### CBN Regulations

- Rules align with CBN AML/CFT guidelines
- Transaction monitoring requirements
- Suspicious activity reporting

### NDPA 2023 Compliance

- Data minimization in rules
- Privacy-preserving checks
- Audit trail maintenance
