import { Test } from '@nestjs/testing';
import { LogService } from 'src/log/log.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { Role } from '@prisma/client';
import { ITEMS_PER_PAGE } from 'src/constants';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from 'src/config/configuration';
import { PrismaModule } from 'src/prisma/prisma.module';
import { LogModule } from 'src/log/log.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from 'src/response.interceptor';

describe('Log Service Integration', () => {
  let prisma: PrismaService;
  let logService: LogService;
  let configService: ConfigService;

  const IP = '127.0.0.1';
  const BASIC_METHODS = ['POST', 'PUT', 'DELETE'];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
          isGlobal: true,
        }),

        // Basic Routes
        PrismaModule,

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

    prisma = moduleRef.get(PrismaService);
    logService = moduleRef.get(LogService);
    configService = moduleRef.get(ConfigService);

    // enable soft delete
    await prisma.onModuleInit();
  });

  beforeEach(async () => {
    await prisma.cleanDataBase();
  });

  describe('create()', () => {
    it('Should Create a Log Entry Without User', async () => {
      const method = 'POST';
      const statusCode = '201';
      const url = '/auth/login';

      await logService.create({
        ip: IP,
        method,
        statusCode,
        url,
      });

      const log = await prisma.log.findFirst({ where: { ip: IP } });
      expect(log).toBeDefined();
      expect(log.ip).toBe(IP);
      expect(log.method).toBe(method);
      expect(statusCode).toBe(statusCode);
      expect(log.url).toBe(url);
    });

    it('Should Create a Log Entry Without User (Not Found)', async () => {
      const url = '/user';
      const method = 'POST';
      const statusCode = '201';
      const body = {
        email: 'user@example.com',
        password: '12345678',
      };

      await logService.create({
        ip: IP,
        method,
        statusCode,
        url,
        body,
        user: {
          id: uuidv4(),
        } as any,
      });

      const log = await prisma.log.findFirst({ where: { ip: IP } });
      expect(log).toBeDefined();
      expect(log.ip).toBe(IP);
      expect(log.method).toBe(method);
      expect(statusCode).toBe(statusCode);
      expect(log.url).toBe(url);
      expect(log.body).toStrictEqual(body);
      expect(log.userId).toBeNull();
    });

    it('Should Create a Log Entry With User', async () => {
      const url = '/user';
      const method = 'POST';
      const statusCode = '201';
      const body = {
        email: 'user@example.com',
        password: '12345678',
      };

      const user = await prisma.user.create({
        data: {
          firstName: 'João',
          email: 'admin@example.com',
          hashedPassword: 'notarealhash',
          role: Role.ADMIN,
        },
      });

      await logService.create({
        ip: IP,
        method,
        statusCode,
        url,
        body,
        user,
      });

      const log = await prisma.log.findFirst({
        where: { ip: IP },
        include: { user: true },
      });
      expect(log).toBeDefined();
      expect(log.ip).toBe(IP);
      expect(log.method).toBe(method);
      expect(statusCode).toBe(statusCode);
      expect(log.url).toBe(url);
      expect(log.body).toStrictEqual(body);
      expect(log.user).toBeDefined();
      expect(log.user.id).toBe(user.id);
    });
  });

  describe('findAll()', () => {
    const method = 'POST';
    const statusCode = '201';
    const url = '/user';
    const body = {
      email: 'user@example.com',
      password: '12345678',
    };

    it('Should Return An Empty Array', async () => {
      const response = await logService.findAll();
      expect(response.data).toHaveLength(0);
      expect(response.totalCount).toBe(0);
      expect(response.totalPages).toBe(0);
    });

    it(`Should Return a Log List With ${ITEMS_PER_PAGE} Items`, async () => {
      const logsToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(() => ({
          ip: IP,
          method,
          statusCode,
          url,
          body,
        }));
      await prisma.log.createMany({
        data: logsToCreate,
      });

      const response = await logService.findAll();
      expect(response.data).toHaveLength(ITEMS_PER_PAGE);
      expect(response.totalCount).toBe(ITEMS_PER_PAGE);
      expect(response.totalPages).toBe(1);
    });

    const randomNLogs = Math.ceil(Math.random() * ITEMS_PER_PAGE);
    it(`Should Return a Log List With ${randomNLogs} Items`, async () => {
      const logsToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(() => ({
          ip: IP,
          method,
          statusCode,
          url,
          body,
        }));
      await prisma.log.createMany({
        data: logsToCreate,
      });

      const response = await logService.findAll({
        itemsPerPage: randomNLogs,
      });
      expect(response.data).toHaveLength(randomNLogs);
      expect(response.totalCount).toBe(ITEMS_PER_PAGE);
      expect(response.totalPages).toBe(
        Math.ceil(response.totalCount / randomNLogs),
      );
    });
  });

  describe('findOne()', () => {
    it("Should Return Nothing (Log Doesn't Exists)", async () => {
      const randomId = uuidv4();
      const log = await logService.findOne(randomId);

      expect(log).toBeNull();
    });

    it('Should Return a Log', async () => {
      const method =
        BASIC_METHODS[Math.floor(Math.random() * BASIC_METHODS.length)];
      const statusCode = '201';
      const url = '/auth/login';
      const body = {
        email: 'user@example.com',
        password: '12345678',
      };
      const logCreated = await prisma.log.create({
        data: {
          ip: IP,
          method,
          statusCode,
          url,
          body,
        },
      });

      const log = await logService.findOne(logCreated.id);
      expect(log).toBeDefined();
      expect(log.ip).toBe(IP);
      expect(log.method).toBe(method);
      expect(log.statusCode).toBe(statusCode);
      expect(log.url).toBe(url);
      expect(log.body).toStrictEqual(body);
    });
  });

  describe('removeOld()', () => {
    const method = 'POST';
    const statusCode = '201';
    const url = '/user';
    const body = {
      email: 'user@example.com',
      password: '12345678',
    };

    it('Should Not Remove any Log', async () => {
      const logsToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(() => ({
          ip: IP,
          method,
          statusCode,
          url,
          body,
        }));
      await prisma.log.createMany({
        data: logsToCreate,
      });

      await logService.removeOld();

      const response = await logService.findAll();
      expect(response.data).toHaveLength(ITEMS_PER_PAGE);
      expect(response.totalCount).toBe(ITEMS_PER_PAGE);
      expect(response.totalPages).toBe(Math.ceil(response.totalCount / ITEMS_PER_PAGE));
    });

    it('Should Remove All Logs', async () => {
      const dateLimit = new Date();
      dateLimit.setMonth(dateLimit.getMonth() - configService.get<number>('log.clearBeyondMonths'));
      const logsToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(() => ({
          ip: IP,
          method,
          statusCode,
          url,
          body,
          createdAt: dateLimit
        }));
      await prisma.log.createMany({
        data: logsToCreate,
      });

      await logService.removeOld();

      const response = await logService.findAll();
      expect(response.data).toHaveLength(0);
      expect(response.totalCount).toBe(0);
      expect(response.totalPages).toBe(Math.ceil(response.totalCount / ITEMS_PER_PAGE));
    });
  });
});
