import { Portfolio } from '../../domain/entities/portfolio';
import { ValidationError } from '../../../shared/domain/errors';
import { PortfolioRepositoryPort } from '../../ports/repositories/portfolio-repository.port';

/**
 * GetPortfolio use case
 * Retrieves a user's portfolio by their userId
 */
export class GetPortfolio {
  constructor(private readonly portfolioRepository: PortfolioRepositoryPort) {}

  async execute(userId: string): Promise<Portfolio | null> {
    // Validate input
    if (!userId || userId.trim() === '') {
      throw new ValidationError('UserId is required');
    }

    // Retrieve portfolio from repository
    const portfolio = await this.portfolioRepository.getByUserId(userId);

    return portfolio;
  }
}
