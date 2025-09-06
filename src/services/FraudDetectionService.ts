import { redis } from "../utils/database";
import config from "../config/config";

export class FraudDetectionService {
  private readonly VELOCITY_KEY_PREFIX = "velocity:";
  private readonly DEVICE_KEY_PREFIX = "device:";
  private readonly GEO_KEY_PREFIX = "geo:";

  // Check transaction velocity
  private async checkVelocity(
    userId: string,
    amount: number
  ): Promise<{ score: number; reason?: string }> {
    const key = `${this.VELOCITY_KEY_PREFIX}${userId}`;
    const now = Date.now();
    const minuteAgo = now - 60000; // 1 minute ago

    // Add transaction to sorted set with timestamp
    await redis.zadd(key, now, `${amount}:${now}`);

    // Get transactions in last minute
    const recentTxns = await redis.zrangebyscore(key, minuteAgo, now);

    if (recentTxns.length > config.thresholds.maxVelocityPerMinute) {
      return {
        score: 0.8,
        reason: "High transaction velocity detected",
      };
    }

    return { score: 0 };
  }

  // Check for device risk
  private async checkDeviceRisk(
    userId: string,
    deviceId: string
  ): Promise<{ score: number; reason?: string }> {
    const key = `${this.DEVICE_KEY_PREFIX}${deviceId}`;
    const userIds = await redis.smembers(key);

    // Add current userId to device set
    await redis.sadd(key, userId);

    if (userIds.length > 0 && !userIds.includes(userId)) {
      return {
        score: 0.7,
        reason: "Device associated with multiple users",
      };
    }

    return { score: 0 };
  }

  // Check for geographical risk
  private async checkGeoRisk(
    userId: string,
    latitude: number,
    longitude: number
  ): Promise<{ score: number; reason?: string }> {
    const key = `${this.GEO_KEY_PREFIX}${userId}`;
    const lastLocation = await redis.get(key);

    if (lastLocation) {
      const [lastLat, lastLon] = lastLocation.split(":").map(Number);
      const distance = this.calculateDistance(
        latitude,
        longitude,
        lastLat,
        lastLon
      );

      if (distance > 100) {
        // If distance > 100km
        return {
          score: 0.6,
          reason: "Unusual geographical location",
        };
      }
    }

    // Update last known location
    await redis.set(key, `${latitude}:${longitude}`);
    return { score: 0 };
  }

  // Calculate distance between two points using Haversine formula
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Main fraud detection method
  public async detectFraud(transaction: any): Promise<{
    isFreudulent: boolean;
    riskScore: number;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    let totalScore = 0;

    // 1. Check velocity
    const velocityCheck = await this.checkVelocity(
      transaction.userId,
      transaction.amount
    );
    if (velocityCheck.score > 0) {
      totalScore += velocityCheck.score;
      if (velocityCheck.reason) reasons.push(velocityCheck.reason);
    }

    // 2. Check device risk
    const deviceCheck = await this.checkDeviceRisk(
      transaction.userId,
      transaction.deviceId
    );
    if (deviceCheck.score > 0) {
      totalScore += deviceCheck.score;
      if (deviceCheck.reason) reasons.push(deviceCheck.reason);
    }

    // 3. Check geographical risk
    if (transaction.location) {
      const geoCheck = await this.checkGeoRisk(
        transaction.userId,
        transaction.location.latitude,
        transaction.location.longitude
      );
      if (geoCheck.score > 0) {
        totalScore += geoCheck.score;
        if (geoCheck.reason) reasons.push(geoCheck.reason);
      }
    }

    // 4. Check amount threshold
    if (transaction.amount > config.thresholds.maxTransactionAmount) {
      totalScore += 0.5;
      reasons.push("Transaction amount exceeds threshold");
    }

    // 5. Check night time activity
    const hour = new Date().getHours();
    if (
      hour >= config.thresholds.nightTimeStart ||
      hour <= config.thresholds.nightTimeEnd
    ) {
      totalScore += 0.3;
      reasons.push("Night time transaction");
    }

    // Normalize total score to be between 0 and 1
    const normalizedScore = Math.min(totalScore, 1);

    return {
      isFreudulent: normalizedScore >= 0.7, // Threshold for fraudulent activity
      riskScore: normalizedScore,
      reasons,
    };
  }
}
