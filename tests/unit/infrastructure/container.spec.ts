import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createContainer } from '../../../src/features/shared/infrastructure/config/container';
import { loadConfig } from '../../../src/features/shared/infrastructure/config';

describe('createContainer', () => {
  beforeAll(() => {
    // Mock environment variables for test
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/test');
    vi.stubEnv('VENDOR_API_URL', 'http://test-vendor');
    vi.stubEnv('PORT', '3000');

    // Load config before creating container
    loadConfig();
  });

  it('should return a container with required dependencies', () => {
    const container = createContainer();

    expect(container).toBeDefined();
    expect(typeof container).toBe('object');
    expect(container).toHaveProperty('stockVendorPort');
    expect(container).toHaveProperty('listStocksUseCase');
  });
});
