import { describe, it, expect } from 'vitest';
import { createContainer } from '../../../src/infrastructure/config/container';

describe('createContainer', () => {
  it('should return a container object', () => {
    const container = createContainer();
    expect(container).toBeDefined();
    expect(typeof container).toBe('object');
  });
});
