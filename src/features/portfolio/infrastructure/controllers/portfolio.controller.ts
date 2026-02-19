import { Request, Response, NextFunction } from 'express';
import { GetPortfolio } from '../../application/use-cases/get-portfolio';
import { ValidationError } from '../../../shared/domain/errors';

/**
 * Portfolio controller
 * Handles HTTP requests for portfolio operations
 */
export class PortfolioController {
  constructor(private readonly getPortfolioUseCase: GetPortfolio) {}

  /**
   * GET /users/:userId/portfolio
   * Returns user's portfolio with positions
   */
  async getPortfolio(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;

      // Validate userId format
      if (!userId || userId.trim() === '' || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
        throw new ValidationError(
          'Invalid userId format. Must be alphanumeric with hyphens or underscores.'
        );
      }

      // Execute use case
      const portfolio = await this.getPortfolioUseCase.execute(userId);

      if (!portfolio) {
        // Return empty portfolio if none exists
        res.status(200).json({
          userId,
          positions: [],
        });
        return;
      }

      // Return portfolio with active positions only
      res.status(200).json(portfolio.toJSON());
    } catch (error) {
      next(error);
    }
  }
}
