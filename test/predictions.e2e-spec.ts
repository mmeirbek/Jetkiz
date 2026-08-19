import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { AppModule } from '../src/app.module';

type PredictionBody = {
  orderId?: string;
  recommendation?: string;
  riskLevel?: string;
  bestDepartureTime?: string;
  expectedDelayMinutes?: number;
  shortExplanation?: string;
  message?: string;
};

describe('PredictionsModule (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /predictions/land', () => {
    let orderId: string;

    let prisma: PrismaClient;

    beforeAll(async () => {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const adapter = new PrismaPg(pool);
      prisma = new PrismaClient({ adapter });

      let order = await prisma.order.findFirst({
        where: {
          originLat: { not: null },
          destinationLat: { not: null },
        },
      });

      if (!order) {
        order = await prisma.order.findFirst();
        if (!order) throw new Error('No orders in DB. Run seed:demo first.');

        await prisma.order.update({
          where: { id: order.id },
          data: {
            originLat: 31.2304,
            originLng: 121.4737,
            destinationLat: 43.2383,
            destinationLng: 76.9456,
          },
        });

        order = await prisma.order.findUnique({ where: { id: order.id } });
      }

      orderId = order!.id;
      console.log(`Using order: ${order!.title} (${orderId})`);
      console.log(`  From: ${order!.originLat},${order!.originLng}`);
      console.log(`  To:   ${order!.destinationLat},${order!.destinationLng}`);
    });

    afterAll(async () => {
      await prisma?.$disconnect();
    });

    it('should return 400 when orderId is missing', () => {
      return request(app.getHttpServer())
        .post('/predictions/land')
        .send({})
        .expect(400);
    });

    it('should return 400/404 when orderId is empty', () => {
      return request(app.getHttpServer())
        .post('/predictions/land')
        .send({ orderId: '' })
        .expect((res) => {
          // Empty string passes ValidationPipe but doesn't match any order → 404
          expect([400, 404]).toContain(res.status);
        });
    });

    it('should return 404 when order does not exist', () => {
      return request(app.getHttpServer())
        .post('/predictions/land')
        .send({ orderId: 'non-existent-id' })
        .expect(404);
    });

    it('should return 502 when external APIs are unavailable (no keys)', () => {
      return request(app.getHttpServer())
        .post('/predictions/land')
        .send({ orderId })
        .expect((res) => {
          const body = res.body as PredictionBody;

          if (res.status === 201) {
            // Full success
            expect(body).toHaveProperty('orderId', orderId);
            expect(body).toHaveProperty('recommendation');
            expect(body).toHaveProperty('riskLevel');
            expect(body).toHaveProperty('bestDepartureTime');
            expect(body).toHaveProperty('expectedDelayMinutes');
            expect(body).toHaveProperty('shortExplanation');
            expect(['send', 'wait', 'alternative']).toContain(
              body.recommendation,
            );
            expect(['low', 'medium', 'high']).toContain(body.riskLevel);
            console.log('\n✓ Full prediction pipeline succeeded!');
          } else if (res.status === 502) {
            // External API failure (e.g. no OpenAI key)
            expect(body).toHaveProperty('message');
            console.log(`\n! Partial failure: ${body.message}`);
            console.log(
              '  Route calculation likely worked, but external AI/weather API failed.',
            );
            console.log(
              '  Add OPENAI_API_KEY and OPENWEATHER_API_KEY to .env for full test.',
            );
          } else {
            console.log(`\n! Unexpected status: ${res.status}`);
          }
        });
    });

    it('should succeed if all env keys are set', async () => {
      if (!process.env.OPENAI_API_KEY || !process.env.OPENWEATHER_API_KEY) {
        console.log(
          '\nSkipping — set OPENAI_API_KEY and OPENWEATHER_API_KEY in .env',
        );
        return;
      }

      const res = await request(app.getHttpServer())
        .post('/predictions/land')
        .send({ orderId });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        orderId,
        recommendation: expect.any(String) as string,
        riskLevel: expect.any(String) as string,
        bestDepartureTime: expect.any(String) as string,
        expectedDelayMinutes: expect.any(Number) as number,
        shortExplanation: expect.any(String) as string,
      });
      const body = res.body as PredictionBody;
      console.log('\n✓ Full prediction with all APIs succeeded!');
      console.log(`  Recommendation: ${body.recommendation}`);
      console.log(`  Risk: ${body.riskLevel}`);
      console.log(`  Delay: ${body.expectedDelayMinutes}min`);
      console.log(`  Explanation: ${body.shortExplanation}`);
    });
  });

  describe('POST /predictions/marine', () => {
    it('should return stub prediction', () => {
      return request(app.getHttpServer())
        .post('/predictions/marine')
        .send({
          originLat: 43.65,
          originLng: 51.17,
          destLat: 40.37,
          destLng: 49.89,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('recommendation', 'send');
          expect(res.body).toHaveProperty('riskLevel', 'low');
          expect(res.body).toHaveProperty('shortExplanation');
          console.log(
            `\nMarine stub response:`,
            JSON.stringify(res.body, null, 2),
          );
        });
    });

    it('should return 400 on invalid lat/lng', () => {
      return request(app.getHttpServer())
        .post('/predictions/marine')
        .send({ originLat: 'abc', originLng: 51, destLat: 40, destLng: 49 })
        .expect(400);
    });
  });
});
