import mongoose, { Schema, Document } from "mongoose";

export interface ITransaction extends Document {
  userId: string;
  transactionType: "TRANSFER" | "CARD" | "QR" | "POS";
  amount: number;
  currency: string;
  beneficiaryAccountNumber?: string;
  beneficiaryBankCode?: string;
  merchantId?: string;
  deviceId: string;
  ipAddress: string;
  location: {
    latitude: number;
    longitude: number;
  };
  cardDetails?: {
    last4: string;
    bin: string;
    country: string;
  };
  status: "PENDING" | "APPROVED" | "DENIED" | "FLAGGED";
  riskScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    transactionType: {
      type: String,
      required: true,
      enum: ["TRANSFER", "CARD", "QR", "POS"],
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "NGN" },
    beneficiaryAccountNumber: String,
    beneficiaryBankCode: String,
    merchantId: String,
    deviceId: { type: String, required: true },
    ipAddress: { type: String, required: true },
    location: {
      latitude: Number,
      longitude: Number,
    },
    cardDetails: {
      last4: String,
      bin: String,
      country: String,
    },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "APPROVED", "DENIED", "FLAGGED"],
      default: "PENDING",
    },
    riskScore: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast queries
TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ deviceId: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ createdAt: 1 });

export default mongoose.model<ITransaction>("Transaction", TransactionSchema);
