import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetPortfolio } from '../../../src/application/use-cases/get-portfolio';
import { PortfolioRepositoryPort } from '../../../src/ports/repositories/portfolio-repository.port';
import { Portfolio, Position } from '../../../src/domain/entities/portfolio';

describe('GetPortfolio Use Case', () => {
  let getPortfolio: GetPortfolio;
  let mockPortfolioRepository: PortfolioRepositoryPort;

  beforeEach(() => {
    mockPortfolioRepository = {
      getByUserId: vi.fn(),
      upsertPosition: vi.fn()
    };
    getPortfolio = new GetPortfolio(mockPortfolioRepository);
  });

  it('should return portfolio when user has positions', async () => {
    const positions = [
      new Position('AAPL', 10),
      new Position('GOOGL', 5)
    ];
    const mockPortfolio = new Portfolio('user-123', positions);
    vi.mocked(mockPortfolioRepository.getByUserId).mockResolvedValue(mockPortfolio);

    const result = await getPortfolio.execute('user-123');

    expect(result).toBe(mockPortfolio);
    expect(result?.userId).toBe('user-123');
    expect(result?.positions).toHaveLength(2);
    expect(mockPortfolioRepository.getByUserId).toHaveBeenCalledWith('user-123');
  });

  it('should return empty portfolio when user has no positions', async () => {
    const emptyPortfolio = new Portfolio('user-123', []);
    vi.mocked(mockPortfolioRepository.getByUserId).mockResolvedValue(emptyPortfolio);

    const result = await getPortfolio.execute('user-123');

    expect(result?.userId).toBe('user-123');
    expect(result?.positions).toEqual([]);
    expect(mockPortfolioRepository.getByUserId).toHaveBeenCalledWith('user-123');
  });

  it('should throw validation error when userId is empty', async () => {
    await expect(getPortfolio.execute('')).rejects.toThrow('UserId is required');
  });

  it('should throw validation error when userId is whitespace', async () => {
    await expect(getPortfolio.execute('   ')).rejects.toThrow('UserId is required');
  });

  it('should propagate repository errors', async () => {
    vi.mocked(mockPortfolioRepository.getByUserId).mockRejectedValue(new Error('Database connection failed'));

    await expect(getPortfolio.execute('user-123')).rejects.toThrow('Database connection failed');
  });

  it('should return null when portfolio not found', async () => {
    vi.mocked(mockPortfolioRepository.getByUserId).mockResolvedValue(null);

    const result = await getPortfolio.execute('user-999');

    expect(result).toBeNull();
    expect(mockPortfolioRepository.getByUserId).toHaveBeenCalledWith('user-999');
  });
});
