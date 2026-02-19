import mongoose, { Schema, Document } from 'mongoose';

/**
 * Position subdocument interface
 */
export interface IPositionDocument {
  symbol: string;
  quantity: number;
}

/**
 * Portfolio document interface for Mongoose
 */
export interface IPortfolioDocument extends Document {
  userId: string;
  positions: IPositionDocument[];
  updatedAt: Date;
}

/**
 * Position schema (subdocument)
 */
const PositionSchema = new Schema<IPositionDocument>(
  {
    symbol: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer',
      },
    },
  },
  { _id: false } // Positions don't need their own _id
);

/**
 * Portfolio schema
 */
const PortfolioSchema = new Schema<IPortfolioDocument>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    positions: {
      type: [PositionSchema],
      default: [],
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false, // We manage updatedAt manually
  }
);

/**
 * Portfolio model
 */
export const PortfolioModel = mongoose.model<IPortfolioDocument>('Portfolio', PortfolioSchema);
