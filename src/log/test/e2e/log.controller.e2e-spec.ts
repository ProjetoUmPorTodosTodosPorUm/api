import { Log, Role, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { ITEMS_PER_PAGE } from 'src/constants';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createUser, getToken, setAppConfig } from 'src/utils/test';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from 'src/auth/auth.module';
import configuration from 'src/config/configuration';
import { LogModule } from 'src/log/log.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ResponseInterceptor } from 'src/response.interceptor';
import { UserModule } from 'src/user/user.module';

describe('Log Controller E2E', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  let user: User;
  let admin: User;
  let userToken: string;
  let adminToken: string;
  const password = '12345678';
  const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync());

  const createLog = async (
    ip: string,
    method: string,
    url: string,
    statusCode: string,
    user: User = null,
  ) => {
    const userObj = !user ? undefined : { connect: { id: user.id } };
    return await prisma.log.create({
      data: { ip, method, url, statusCode, user: userObj },
    });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
          isGlobal: true,
        }),

        // Basic Modules
        AuthModule,
        PrismaModule,
        UserModule,

        // Specific
        LogModule,
      ],
      providers: [
        {
          provide: APP_INTERCEPTOR,
          useClass: ResponseInterceptor,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    setAppConfig(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);

    user = await createUser(prisma, 'joão', 'user@example.com', hashedPassword);
    admin = await createUser(
      prisma,
      'Sigma',
      'admin@example.com',
      hashedPassword,
      Role.ADMIN,
    );

    userToken = await getToken(app, user.email, password);
    adminToken = await getToken(app, admin.email, password);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.cleanDataBase();
  });

  describe('Private Routes (as User)', () => {
    it('Should Not Return a Log List', async () => {
      await request(app.getHttpServer())
        .get('/log')
        .set('Content-Type', 'application/json')
        .set('Authorization', `bearer ${userToken}`)
        .expect(403);
    });

    it('Should Not Return a Log', async () => {
      const log = await createLog('127.0.0.1', 'POST', '/user', '401');
      await request(app.getHttpServer())
        .get(`/log/${log.id}`)
        .set('Content-Type', 'application/json')
        .set('Authorization', `bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('Private Routes (as Admin)', () => {
    it(`Should Return a Log List With ${ITEMS_PER_PAGE} Items`, async () => {
      const logsToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(
          () =>
          ({
            ip: '127.0.0.1',
            method: 'POST',
            url: '/work',
            statusCode: '201',
          } as Log),
        );
      await prisma.log.createMany({
        data: logsToCreate,
      });

      const response = await request(app.getHttpServer())
        .get('/log')
        .set('Content-type', 'application/json')
        .set('Authorization', `bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(ITEMS_PER_PAGE);
      expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE));
      expect(response.headers['x-total-pages']).toBe(String(1));
    });

    let randomNLogs = Math.ceil(Math.random() * ITEMS_PER_PAGE);
    it(`Should Return a Log List With ${randomNLogs} Items`, async () => {
      const logsToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(
          () =>
          ({
            ip: '127.0.0.1',
            method: 'POST',
            url: '/work',
            statusCode: '201',
          } as Log),
        );
      await prisma.log.createMany({
        data: logsToCreate,
      });

      const response = await request(app.getHttpServer())
        .get('/log')
        .query({ itemsPerPage: randomNLogs })
        .set('Content-type', 'application/json')
        .set('Authorization', `bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(randomNLogs);
      expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE));
      expect(response.headers['x-total-pages']).toBe(
        String(Math.ceil(+response.headers['x-total-count'] / randomNLogs)),
      );
    });

    it('Should Return a Log', async () => {
      const log = await createLog('127.0.0.1', 'POST', '/work', '201');
      const response = await request(app.getHttpServer())
        .get(`/log/${log.id}`)
        .set('Content-Type', 'application/json')
        .set('Authorization', `bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
    });
  });
});
