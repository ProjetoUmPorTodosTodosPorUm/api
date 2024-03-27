import { NestExpressApplication } from '@nestjs/platform-express';
import { Church, ChurchType, Field, Role, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { ITEMS_PER_PAGE } from 'src/constants';
import {
  createField,
  createUser,
  getToken,
  setAppConfig,
} from 'src/utils/test';


import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from 'src/config/configuration';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/user/user.module';
import { FieldModule } from 'src/field/field.module';
import { ChurchModule } from 'src/church/church.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from 'src/response.interceptor';

describe('Church Controller E2E', () => {
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
  const baseRoute = '/church';

  const name = 'Igreja';
  const description = 'Descrição';
  const type = ChurchType.PIONEER;

  const createChurch = async (
    name: string,
    description: string,
    type: ChurchType,
    field: string,
  ) =>
    await prisma.church.create({
      data: {
        name,
        description,
        type,
        field: {
          connect: {
            id: field,
          },
        },
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
        ChurchModule,
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
    it('Should Not Create a Church', async () => {
      await request(app.getHttpServer())
        .post(baseRoute)
        .send({
          name,
          description,
          type,
        })
        .expect(401);
    });

    it('Should Not Update a Church', async () => {
      const church = await createChurch(name, description, type, field.id);
      await request(app.getHttpServer())
        .put(`${baseRoute}/${church.id}`)
        .send({ name: 'Igreja 1' })
        .expect(401);
    });

    it('Should Not Remove a Church', async () => {
      const church = await createChurch(name, description, type, field.id);

      await request(app.getHttpServer())
        .delete(`${baseRoute}/${church.id}`)
        .expect(401);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${church.id}`)
        .expect(200);

      expect(res.body.data).toBeTruthy();
    });

    it('Should Not Restore a Church', async () => {
      const church = await createChurch(name, description, type, field.id);
      await prisma.church.delete({ where: { id: church.id } });

      await request(app.getHttpServer())
        .put(`${baseRoute}/restore`)
        .send({ ids: [church.id] })
        .expect(401);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${church.id}`)
        .expect(200);

      expect(res.body.data).toBeNull();
    });

    it('Should Not HardRemove a Church', async () => {
      const church = await createChurch(name, description, type, field.id);
      await prisma.church.delete({ where: { id: church.id } });

      await request(app.getHttpServer())
        .delete(`${baseRoute}/hard-remove`)
        .send({ ids: [church.id] })
        .expect(401);

      // Bypass Soft Delete
      const query = prisma.church.findUnique({
        where: { id: church.id },
      });
      const [churchExists] = await prisma.$transaction([query]);
      expect(churchExists).toBeTruthy();
    });
  });

  describe('Private Routes (as Logged VOLUNTEER)', () => {
    it('Should Create a Church', async () => {
      const res = await request(app.getHttpServer())
        .post(baseRoute)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name,
          description,
          type,
        })
        .expect(201);

      expect(res.body.data.name).toBe(name);
      expect(res.body.data.description).toBe(description);
      expect(res.body.data.type).toBe(type);
    });

    it('Should Not Update a Church (Different Field)', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const church = await createChurch(
        name,
        description,
        type,
        differentField.id,
      );
      const newName = 'Igreja 1';

      await request(app.getHttpServer())
        .put(`${baseRoute}/${church.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: newName })
        .expect(403);
    });

    it('Should Update a Church', async () => {
      const church = await createChurch(name, description, type, field.id);
      const newName = 'Igreja 1';

      const res = await request(app.getHttpServer())
        .put(`${baseRoute}/${church.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: newName })
        .expect(200);

      expect(res.body.data.name).toBe(newName);
    });

    it('Should Not Remove a Church (Different Field)', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const church = await createChurch(
        name,
        description,
        type,
        differentField.id,
      );

      await request(app.getHttpServer())
        .delete(`${baseRoute}/${church.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('Should Remove a Church', async () => {
      const church = await createChurch(name, description, type, field.id);
      await request(app.getHttpServer())
        .delete(`${baseRoute}/${church.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${church.id}`)
        .expect(200);

      expect(res.body.data).toBe(null);
    });

    it('Should Not Restore a Church', async () => {
      const church = await createChurch(name, description, type, field.id);
      await prisma.church.delete({ where: { id: church.id } });

      await request(app.getHttpServer())
        .put(`${baseRoute}/restore`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ids: [church.id] })
        .expect(403);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${church.id}`)
        .expect(200);

      expect(res.body.data).toBeNull();
    });

    it('Should Not HardRemove a Church', async () => {
      const church = await createChurch(name, description, type, field.id);
      await prisma.church.delete({ where: { id: church.id } });

      await request(app.getHttpServer())
        .delete(`${baseRoute}/hard-remove`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ids: [church.id] })
        .expect(403);

      // Bypass Soft Delete
      const query = prisma.church.findUnique({
        where: { id: church.id },
      });
      const [churchExists] = await prisma.$transaction([query]);
      expect(churchExists).toBeTruthy();
    });
  });

  describe('Private Routes (as Logged ADMIN)', () => {
    it('Should Create a Church', async () => {
      const res = await request(app.getHttpServer())
        .post(baseRoute)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name,
          description,
          type,
        })
        .expect(201);

      expect(res.body.data.name).toBe(name);
      expect(res.body.data.description).toBe(description);
      expect(res.body.data.type).toBe(type);
    });

    it('Should Not Update a Church (Different Event)', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const church = await createChurch(name, description, type, differentField.id);
      const newName = 'Igreja 1';

      await request(app.getHttpServer())
        .put(`${baseRoute}/${church.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: newName })
        .expect(403);
    });

    it('Should Update a Church', async () => {
      const church = await createChurch(name, description, type, field.id);
      const newName = 'Igreja 1';

      const res = await request(app.getHttpServer())
        .put(`${baseRoute}/${church.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: newName })
        .expect(200);

      expect(res.body.data.name).toBe(newName);
    });

    it('Should Not Remove a Church (Different Field)', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const church = await createChurch(name, description, type, differentField.id);
      await request(app.getHttpServer())
        .delete(`${baseRoute}/${church.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('Should Remove a Church', async () => {
      const church = await createChurch(name, description, type, field.id);
      await request(app.getHttpServer())
        .delete(`${baseRoute}/${church.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${church.id}`)
        .expect(200);

      expect(res.body.data).toBe(null);
    });

    it('Should Not Restore a Church (Different Field)', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const church = await createChurch(name, description, type, differentField.id);
      await prisma.church.delete({ where: { id: church.id } });

      await request(app.getHttpServer())
        .put(`${baseRoute}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [church.id] })
        .expect(403);
    });

    it('Should Restore a Church', async () => {
      const church = await createChurch(name, description, type, field.id);
      await prisma.church.delete({ where: { id: church.id } });

      await request(app.getHttpServer())
        .put(`${baseRoute}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [church.id] })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${church.id}`)
        .expect(200);

      expect(res.body.data).toBeTruthy();
    });

    it('Should Not HardRemove a Church (Different Field)', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const church = await createChurch(name, description, type, differentField.id);
      await prisma.church.delete({ where: { id: church.id } });

      await request(app.getHttpServer())
        .delete(`${baseRoute}/hard-remove`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [church.id] })
        .expect(403);
    });

    it('Should HardRemove a Church', async () => {
      const church = await createChurch(name, description, type, field.id);
      await prisma.church.delete({ where: { id: church.id } });

      await request(app.getHttpServer())
        .delete(`${baseRoute}/hard-remove`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [church.id] })
        .expect(200);

      // Bypass Soft Delete
      const query = prisma.church.findUnique({
        where: { id: church.id },
      });
      const [churchExists] = await prisma.$transaction([query]);
      expect(churchExists).toBeNull();
    });
  });

  describe('Private Routes (as Logged WEB MASTER)', () => {
    it('Should Not Create a Church (Missing Field)', async () => {
      const res = await request(app.getHttpServer())
        .post(baseRoute)
        .set('Authorization', `Bearer ${webMasterToken}`)
        .send({
          name,
          description,
          type,
        })
        .expect(400);
    });

    it('Should Create a Church', async () => {
      const res = await request(app.getHttpServer())
        .post(baseRoute)
        .set('Authorization', `Bearer ${webMasterToken}`)
        .send({
          name,
          description,
          type,
          field: field.id,
        })
        .expect(201);

      expect(res.body.data.name).toBe(name);
      expect(res.body.data.description).toBe(description);
      expect(res.body.data.type).toBe(type);
    });

    it('Should Update a Church', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const church = await createChurch(name, description, type, field.id);
      const newName = 'Igreja 1';

      const res = await request(app.getHttpServer())
        .put(`${baseRoute}/${church.id}`)
        .set('Authorization', `Bearer ${webMasterToken}`)
        .send({
          name: newName,
          field: differentField.id
        })
        .expect(200);

      expect(res.body.data.name).toBe(newName);
      expect(res.body.data.fieldId).toBe(differentField.id);
    });

    it('Should Remove a Church', async () => {
      const church = await createChurch(name, description, type, field.id);
      await request(app.getHttpServer())
        .delete(`${baseRoute}/${church.id}`)
        .set('Authorization', `Bearer ${webMasterToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${church.id}`)
        .expect(200);

      expect(res.body.data).toBe(null);
    });

    it('Should Restore a Church', async () => {
      const church = await createChurch(name, description, type, field.id);
      await prisma.church.delete({ where: { id: church.id } });

      await request(app.getHttpServer())
        .put(`${baseRoute}/restore`)
        .set('Authorization', `Bearer ${webMasterToken}`)
        .send({ ids: [church.id] })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${church.id}`)
        .expect(200);

      expect(res.body.data).toBeTruthy();
    });

    it('Should HardRemove a Church', async () => {
      const church = await createChurch(name, description, type, field.id);
      await prisma.church.delete({ where: { id: church.id } });

      await request(app.getHttpServer())
        .delete(`${baseRoute}/hard-remove`)
        .set('Authorization', `Bearer ${webMasterToken}`)
        .send({ ids: [church.id] })
        .expect(200);

      // Bypass Soft Delete
      const query = prisma.church.findUnique({
        where: { id: church.id },
      });
      const [churchExists] = await prisma.$transaction([query]);
      expect(churchExists).toBeNull();
    });
  });

  describe('Public Routes (as Non Logged User)', () => {
    it(`Should Return a Church List With ${ITEMS_PER_PAGE} Items`, async () => {
      const churchesToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(
          (v, i) =>
          ({
            name: `João ${i}`,
            description,
            type: ChurchType.EXPANSION,
            fieldId: field.id,
          } as Church),
        );
      await prisma.church.createMany({
        data: churchesToCreate,
      });

      const response = await request(app.getHttpServer())
        .get(baseRoute)
        .expect(200);

      expect(response.body.data).toHaveLength(ITEMS_PER_PAGE);
      expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE));
      expect(response.headers['x-total-pages']).toBe(String(1));
    });

    const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE);
    it(`Should Return a Church List With ${randomN} Items`, async () => {
      const churchesToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(
          (v, i) =>
          ({
            name: `João ${i}`,
            description,
            type: ChurchType.EXPANSION,
            fieldId: field.id,
          } as Church),
        );
      await prisma.church.createMany({
        data: churchesToCreate,
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

    it('Should Return a Church', async () => {
      const church = await createChurch(name, description, type, field.id);

      const res = await request(app.getHttpServer())
        .get(`${baseRoute}/${church.id}`)
        .expect(200);

      expect(res.body.data.name).toBe(name);
      expect(res.body.data.description).toBe(description);
      expect(res.body.data.type).toBe(type);
    });
  });
});
