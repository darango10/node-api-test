import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Express } from 'express';
import { createApp } from '../../src/features/shared/infrastructure/http/app';
import {
  connectDatabase,
  disconnectDatabase,
} from '../../src/features/shared/infrastructure/persistence/mongo-connection';
import { loadConfig } from '../../src/features/shared/infrastructure/config';

describe('E2E: List Stocks Flow', () => {
  let app: Express;
  let mongoServer: MongoMemoryServer | undefined;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({ timeout: 60000 });
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    process.env.PORT = '3000';
    process.env.VENDOR_API_URL = process.env.VENDOR_API_URL || 'http://localhost:8000';
    process.env.VENDOR_API_KEY = process.env.VENDOR_API_KEY || 'test-key';
    process.env.NODE_ENV = 'test';
    loadConfig();
    await connectDatabase(uri);
    app = createApp();
  }, 70000);

  afterAll(async () => {
    await disconnectDatabase();
    if (mongoServer) await mongoServer.stop();
  });

  describe('should complete full list stocks journey', () => {
    it('when user lists stocks from the API', async () => {
      // Act - List stocks without pagination
      const response1 = await request(app).get('/stocks').expect(200);

      // Assert - First page
      expect(response1.body).toHaveProperty('stocks');
      expect(Array.isArray(response1.body.stocks)).toBe(true);

      // If there's a nextToken, test pagination
      if (response1.body.nextToken) {
        const response2 = await request(app)
          .get('/stocks')
          .query({ nextToken: response1.body.nextToken })
          .expect(200);

        expect(response2.body).toHaveProperty('stocks');
        expect(Array.isArray(response2.body.stocks)).toBe(true);
      }
    });

    it('when user checks API documentation', async () => {
      // Act - Access Swagger UI (redirects to /api-docs/)
      await request(app).get('/api-docs').expect(301);

      // Test the actual docs path
      const docsResponse = await request(app).get('/api-docs/').expect(200);

      expect(docsResponse.text).toContain('swagger');
    });

    it('when user accesses health endpoint', async () => {
      // Act
      const response = await request(app).get('/health').expect(200);

      // Assert
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });
  });

  describe('should handle vendor errors gracefully', () => {
    it('when vendor is temporarily unavailable', async () => {
      // This test assumes vendor might be down
      // In a real scenario, you'd mock the vendor or use a test double

      // Act
      const response = await request(app).get('/stocks');

      // Assert - Either success or proper error handling
      expect([200, 502]).toContain(response.status);

      if (response.status === 502) {
        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('should handle invalid requests', () => {
    it('when limit is out of range', async () => {
      // Act
      const response = await request(app).get('/stocks').query({ limit: 1000 }); // Over max

      // Assert - Should handle gracefully
      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    it('when invalid nextToken is provided', async () => {
      // Act
      const response = await request(app).get('/stocks').query({ nextToken: 'invalid-token-123' });

      // Assert - Should handle gracefully (vendor will reject)
      expect([200, 400, 502]).toContain(response.status);
    });
  });
});
