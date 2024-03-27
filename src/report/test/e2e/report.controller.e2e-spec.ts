import { NestExpressApplication } from '@nestjs/platform-express';
import { Field, Report, ReportType, Role, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import {
  createField,
  createUser,
  getToken,
  setAppConfig,
} from 'src/utils/test';

import { ITEMS_PER_PAGE } from 'src/constants';
import { ConfigModule } from '@nestjs/config';
import configuration from 'src/config/configuration';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/user/user.module';
import { FieldModule } from 'src/field/field.module';
import { ReportModule } from 'src/report/report.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from 'src/response.interceptor';

describe('Report Controller E2E', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  let field: Field;
  let user: User;
  let userToken: string;
  let admin: User;
  let adminToken: string;
  let webMaster: User;
  let webMasterToken: string;

  const password = '12345678';
  const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync());
  const baseRoute = '/report';

  const title = 'Título';
  const shortDescription = 'Descrição';
  const month = 1;
  const year = 2010;
  const type = ReportType.ORDINARY;

  const createReport = async (
    title: string,
    shortDescription: string,
    month: number,
    year: number,
    field: string,
    type: ReportType = ReportType.ORDINARY,
  ) =>
    await prisma.report.create({
      data: {
        title,
        shortDescription,
        month,
        year,
        field: {
          connect: {
            id: field,
          },
        },
        type
      },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
          isGlobal: true,
        }),

        // Basic Routes
        AuthModule,
        PrismaModule,
        UserModule,

        // Specific
        FieldModule,
        ReportModule,
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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.cleanDataBase();

    field = await createField(
      prisma,
      'América',
      'Brasil',
      'Rio de Janeiro',
      'AMEBRRJ01',
      'Designação',
    );

    user = await createUser(
      prisma,
      'João',
      'volunteer@email.com',
      hashedPassword,
      Role.VOLUNTEER,
      field.id,
    );
    userToken = await getToken(app, user.email, password);

    admin = await createUser(
      prisma,
      'Admin',
      'sigma@email.com',
      hashedPassword,
      Role.ADMIN,
      field.id,
    );
    adminToken = await getToken(app, admin.email, password);

    webMaster = await createUser(
      prisma,
      'WebMaster',
      'ultra.sigma@email.com',
      hashedPassword,
      Role.WEB_MASTER,
    );
    webMasterToken = await getToken(app, webMaster.email, password);
  });

  describe('Private Routes (as Non Logged User)', () => {
    it('Should Not Create a Report', async () => {
      await request(app.getHttpServer())
        .post(baseRoute)
        .send({
          title,
          shortDescription,
          month,
          year,
          field: field.id,
        })
        .expect(401);
    });

    it('Should Not Update a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await request(app.getHttpServer())
        .put(`${baseRoute}/${report.id}`)
        .send({ title: 'Novo Título' })
        .expect(401);
    });

    it('Should Not Remove a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await request(app.getHttpServer())
        .delete(`${baseRoute}/${report.id}`)
        .expect(401);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${report.id}`)
        .expect(200);

      expect(res.body.data).toBeTruthy();
    });

    it('Should Not Restore a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await prisma.report.delete({ where: { id: report.id } });

      await request(app.getHttpServer())
        .put(`${baseRoute}/restore`)
        .send({ ids: [report.id] })
        .expect(401);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${report.id}`)
        .expect(200);

      expect(res.body.data).toBeNull();
    });

    it('Should Not HardRemove a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await prisma.report.delete({ where: { id: report.id } });

      await request(app.getHttpServer())
        .delete(`${baseRoute}/hard-remove`)
        .send({ ids: [report.id] })
        .expect(401);

      // Bypass Soft Delete
      const query = prisma.report.findUnique({
        where: { id: report.id },
      });
      const [reportExists] = await prisma.$transaction([query]);
      expect(reportExists).toBeTruthy();
    });
  });

  describe('Private Routes (as Logged VOLUNTEER)', () => {
    it('Should Create a Report', async () => {
      const res = await request(app.getHttpServer())
        .post(baseRoute)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title,
          shortDescription,
          month,
          year,
          field: field.id,
          type,
          attachments: ['file.pdf']
        })
        .expect(201);

      expect(res.body.data.title).toBe(title);
      expect(res.body.data.shortDescription).toBe(shortDescription);
      expect(res.body.data.month).toBe(month);
      expect(res.body.data.year).toBe(year);
    });

    it('Should Not Update a Report (Different Field)', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        differentField.id,
      );
      const text = 'Abreu';

      await request(app.getHttpServer())
        .put(`${baseRoute}/${report.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ text })
        .expect(403);
    });

    it('Should Update a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      const text = 'Abreu';

      const res = await request(app.getHttpServer())
        .put(`${baseRoute}/${report.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ text })
        .expect(200);

      expect(res.body.data.text).toBe(text);
    });

    it('Should Not Remove a Report (Different Field)', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        differentField.id,
      );
      await request(app.getHttpServer())
        .delete(`${baseRoute}/${report.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('Should Remove a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await request(app.getHttpServer())
        .delete(`${baseRoute}/${report.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${report.id}`)
        .expect(200);

      expect(res.body.data).toBe(null);
    });

    it('Should Not Restore a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await prisma.report.delete({ where: { id: report.id } });

      await request(app.getHttpServer())
        .put(`${baseRoute}/restore`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ids: [report.id] })
        .expect(403);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${report.id}`)
        .expect(200);

      expect(res.body.data).toBeNull();
    });

    it('Should Not HardRemove a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await prisma.report.delete({ where: { id: report.id } });

      await request(app.getHttpServer())
        .delete(`${baseRoute}/hard-remove`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ids: [report.id] })
        .expect(403);

      // Bypass Soft Delete
      const query = prisma.report.findUnique({
        where: { id: report.id },
      });
      const [reportExists] = await prisma.$transaction([query]);
      expect(reportExists).toBeTruthy();
    });
  });

  describe('Private Routes (as Logged ADMIN)', () => {
    it('Should Create a Report', async () => {
      const res = await request(app.getHttpServer())
        .post(baseRoute)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title,
          shortDescription,
          month,
          year,
          field: field.id,
          type,
          attachments: ['file.pdf']
        })
        .expect(201);

      expect(res.body.data.title).toBe(title);
      expect(res.body.data.shortDescription).toBe(shortDescription);
      expect(res.body.data.month).toBe(month);
      expect(res.body.data.year).toBe(year);
    });

    it('Should Not Update a Report (Different Field)', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        differentField.id,
      );
      const text = 'Abreu';

      await request(app.getHttpServer())
        .put(`${baseRoute}/${report.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text })
        .expect(403);
    });

    it('Should Update a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      const text = 'Abreu';

      const res = await request(app.getHttpServer())
        .put(`${baseRoute}/${report.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text })
        .expect(200);

      expect(res.body.data.text).toBe(text);
    });

    it('Should Not Remove a Report (Different Field)', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        differentField.id,
      );
      await request(app.getHttpServer())
        .delete(`${baseRoute}/${report.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('Should Remove a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await request(app.getHttpServer())
        .delete(`${baseRoute}/${report.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${report.id}`)
        .expect(200);

      expect(res.body.data).toBe(null);
    });

    it('Should Not Restore a Report (Different Field)', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        differentField.id,
      );
      await prisma.report.delete({ where: { id: report.id } });

      await request(app.getHttpServer())
        .put(`${baseRoute}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [report.id] })
        .expect(403);
    });

    it('Should Restore a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await prisma.report.delete({ where: { id: report.id } });

      await request(app.getHttpServer())
        .put(`${baseRoute}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [report.id] })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${report.id}`)
        .expect(200);

      expect(res.body.data).toBeTruthy();
    });

    it('Should Hard Remove a Report (Different Field)', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        differentField.id,
      );
      await prisma.report.delete({ where: { id: report.id } });

      await request(app.getHttpServer())
        .delete(`${baseRoute}/hard-remove`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [report.id] })
        .expect(403);
    });

    it('Should Hard Remove a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await prisma.report.delete({ where: { id: report.id } });

      await request(app.getHttpServer())
        .delete(`${baseRoute}/hard-remove`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [report.id] })
        .expect(200);

      // Bypass Soft Delete
      const query = prisma.report.findUnique({
        where: { id: report.id },
      });
      const [reportExists] = await prisma.$transaction([query]);
      expect(reportExists).toBeNull();
    });
  });

  describe('Private Routes (as Logged WEB MASTER)', () => {
    it('Should Not Create a Report (Missing Field)', async () => {
      const res = await request(app.getHttpServer())
        .post(baseRoute)
        .set('Authorization', `Bearer ${webMasterToken}`)
        .send({
          title,
          shortDescription,
          month,
          year,
        })
        .expect(400);
    });

    it('Should Create a Report', async () => {
      const res = await request(app.getHttpServer())
        .post(baseRoute)
        .set('Authorization', `Bearer ${webMasterToken}`)
        .send({
          title,
          shortDescription,
          month,
          year,
          field: field.id,
          type,
          attachments: ['file.pdf']
        })
        .expect(201);

      expect(res.body.data.title).toBe(title);
      expect(res.body.data.shortDescription).toBe(shortDescription);
      expect(res.body.data.month).toBe(month);
      expect(res.body.data.year).toBe(year);
    });

    it('Should Update a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      const text = 'Abreu';

      const res = await request(app.getHttpServer())
        .put(`${baseRoute}/${report.id}`)
        .set('Authorization', `Bearer ${webMasterToken}`)
        .send({ text })
        .expect(200);

      expect(res.body.data.text).toBe(text);
    });

    it('Should Remove a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await request(app.getHttpServer())
        .delete(`${baseRoute}/${report.id}`)
        .set('Authorization', `Bearer ${webMasterToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${report.id}`)
        .expect(200);

      expect(res.body.data).toBe(null);
    });

    it('Should Restore a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await prisma.report.delete({ where: { id: report.id } });

      await request(app.getHttpServer())
        .put(`${baseRoute}/restore`)
        .set('Authorization', `Bearer ${webMasterToken}`)
        .send({ ids: [report.id] })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${report.id}`)
        .expect(200);

      expect(res.body.data).toBeTruthy();
    });

    it('Should Hard Remove a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await prisma.report.delete({ where: { id: report.id } });

      await request(app.getHttpServer())
        .delete(`${baseRoute}/hard-remove`)
        .set('Authorization', `Bearer ${webMasterToken}`)
        .send({ ids: [report.id] })
        .expect(200);

      // Bypass Soft Delete
      const query = prisma.report.findUnique({
        where: { id: report.id },
      });
      const [reportExists] = await prisma.$transaction([query]);
      expect(reportExists).toBeNull();
    });
  });

  describe('Public Routes (as Non Logged User)', () => {
    it(`Should Return a Report List With ${ITEMS_PER_PAGE} Items`, async () => {
      const reportsToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(
          (v, i) =>
          ({
            title: `Título ${i}`,
            shortDescription,
            month,
            year,
            fieldId: field.id,
            type,
          } as Report),
        );
      await prisma.report.createMany({
        data: reportsToCreate,
      });

      const response = await request(app.getHttpServer())
        .get(baseRoute)
        .expect(200);

      expect(response.body.data).toHaveLength(ITEMS_PER_PAGE);
      expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE));
      expect(response.headers['x-total-pages']).toBe(String(1));
    });

    const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE);
    it(`Should Return a Report List With ${randomN} Items`, async () => {
      const reportsToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(
          (v, i) =>
          ({
            title: `Título ${i}`,
            shortDescription,
            month,
            year,
            fieldId: field.id,
            type,
          } as Report),
        );
      await prisma.report.createMany({
        data: reportsToCreate,
      });

      const response = await request(app.getHttpServer())
        .get(baseRoute)
        .query({ itemsPerPage: randomN })
        .expect(200);

      expect(response.body.data).toHaveLength(randomN);
      expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE));
      expect(response.headers['x-total-pages']).toBe(
        String(Math.ceil(+response.headers['x-total-count'] / randomN)),
      );
    });

    it('Should Return a Report', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${report.id}`)
        .expect(200);

      expect(res.body.data.title).toBe(title);
      expect(res.body.data.shortDescription).toBe(shortDescription);
      expect(res.body.data.month).toBe(month);
      expect(res.body.data.year).toBe(year);
    });

    it('Should Return Reported Years', async () => {
      const years = [2010, 2022, 2023];
      const reportsToCreate = Array(years.length)
        .fill(0)
        .map(
          (v, i) =>
          ({
            title: `Título ${i}`,
            shortDescription,
            month,
            year: years[i],
            fieldId: field.id,
            type,
          } as Report),
        );
      await prisma.report.createMany({
        data: reportsToCreate,
      });

      const response = await request(app.getHttpServer())
        .get(`${baseRoute}/years`)
        .query({ field: field.id })
        .expect(200);

      expect(response.body.data).toStrictEqual(years);
    });
  });
});
