import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  bvn: string;
  deviceIds: string[];
  status: "ACTIVE" | "SUSPENDED" | "BLOCKED";
  riskProfile: {
    score: number;
    lastUpdated: Date;
    factors: string[];
  };
  kycLevel: 1 | 2 | 3;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true, unique: true },
    bvn: { type: String, required: true, unique: true },
    deviceIds: [{ type: String }],
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "BLOCKED"],
      default: "ACTIVE",
    },
    riskProfile: {
      score: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: Date.now },
      factors: [{ type: String }],
    },
    kycLevel: {
      type: Number,
      enum: [1, 2, 3],
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ phoneNumber: 1 }, { unique: true });
UserSchema.index({ bvn: 1 }, { unique: true });
UserSchema.index({ "riskProfile.score": 1 });

export default mongoose.model<IUser>("User", UserSchema);
