import { Portfolio, Position } from '../../domain/entities/portfolio';
import { PortfolioRepositoryPort } from '../../ports/repositories/portfolio-repository.port';
import { ValidationError } from '../../domain/errors';
import { PortfolioModel } from './models/portfolio.model';

/**
 * MongoDB implementation of PortfolioRepository using Mongoose
 */
export class PortfolioRepositoryImpl implements PortfolioRepositoryPort {
  /**
   * Get portfolio by userId
   */
  async getByUserId(userId: string): Promise<Portfolio | null> {
    const doc = await PortfolioModel.findOne({ userId }).lean();
    
    if (!doc) {
      return null;
    }

    const positions = doc.positions.map(p => new Position(p.symbol, p.quantity));
    return new Portfolio(doc.userId, positions, doc.updatedAt);
  }

  /**
   * Upsert a position in a user's portfolio
   * Uses atomic operations to handle concurrent updates safely
   */
  async upsertPosition(
    userId: string,
    symbol: string,
    quantityDelta: number
  ): Promise<void> {
    // Validate inputs
    if (!userId || userId.trim() === '') {
      throw new ValidationError('UserId cannot be empty');
    }

    if (!symbol || symbol.trim() === '') {
      throw new ValidationError('Symbol cannot be empty');
    }

    if (quantityDelta <= 0) {
      throw new ValidationError('Quantity delta must be positive');
    }

    if (!Number.isInteger(quantityDelta)) {
      throw new ValidationError('Quantity delta must be an integer');
    }

    // Use a retry loop to handle race conditions
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // First, try to increment if position exists
        const incrementResult = await PortfolioModel.updateOne(
          { userId, 'positions.symbol': symbol },
          {
            $inc: { 'positions.$.quantity': quantityDelta },
            $set: { updatedAt: new Date() }
          }
        );

        // If update matched a document, we're done
        if (incrementResult.matchedCount > 0) {
          return;
        }

        // Otherwise, try to add the position to an existing portfolio
        const addPositionResult = await PortfolioModel.updateOne(
          { userId, 'positions.symbol': { $ne: symbol } },
          {
            $push: { positions: { symbol, quantity: quantityDelta } },
            $set: { updatedAt: new Date() }
          }
        );

        // If update matched a document, we're done
        if (addPositionResult.matchedCount > 0) {
          return;
        }

        // If no portfolio exists, try to create one
        try {
          await PortfolioModel.create({
            userId,
            positions: [{ symbol, quantity: quantityDelta }],
            updatedAt: new Date()
          });
          return;
        } catch (error) {
          // If we get a duplicate key error, it means another concurrent request created the portfolio
          // Retry the operation to increment the newly created portfolio
          const mongoError = error as { code?: number };
          if (mongoError.code === 11000 && attempt < maxRetries - 1) {
            continue;
          }
          throw error;
        }
      } catch (error) {
        // Re-throw if not a duplicate key error or if we've exhausted retries
        const mongoError = error as { code?: number };
        if (mongoError.code !== 11000 || attempt >= maxRetries - 1) {
          throw error;
        }
      }
    }
  }
}
