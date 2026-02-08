import mongoose, { Schema, Document } from 'mongoose';

/**
 * Transaction document interface for Mongoose
 */
export interface TransactionDocument extends Document {
  userId: string;
  symbol: string;
  quantity: number;
  price: number;
  outcome: 'success' | 'failure';
  reason?: string;
  createdAt: Date;
}

/**
 * Transaction schema
 */
const transactionSchema = new Schema<TransactionDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0.01,
    },
    outcome: {
      type: String,
      required: true,
      enum: ['success', 'failure'],
      index: true,
    },
    reason: {
      type: String,
      required: false,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // We manage createdAt manually
    collection: 'transactions',
  }
);

// Compound index for efficient queries by date and outcome
transactionSchema.index({ createdAt: 1, outcome: 1 });

// Compound index for user-specific queries
transactionSchema.index({ userId: 1, createdAt: -1 });

/**
 * Transaction model
 */
export const TransactionModel = mongoose.model<TransactionDocument>(
  'Transaction',
  transactionSchema
);
