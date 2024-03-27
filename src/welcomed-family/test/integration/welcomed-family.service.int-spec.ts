import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  WelcomedFamily,
  Field,
  Role,
  User,
} from '@prisma/client';
import { WelcomedFamilyService } from 'src/welcomed-family/welcomed-family.service';
import { ITEMS_PER_PAGE, MESSAGE, TEMPLATE } from 'src/constants';
import { PrismaService } from 'src/prisma/prisma.service';
import { createField, createUser } from 'src/utils/test';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from 'src/config/configuration';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/user/user.module';
import { FieldModule } from 'src/field/field.module';
import { WelcomedFamilyModule } from 'src/welcomed-family/welcomed-family.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from 'src/response.interceptor';

describe('Welcomed Family Service Integration', () => {
  let prisma: PrismaService;
  let welcomedFamilyService: WelcomedFamilyService;

  let field: Field;
  let user: User;
  let admin: User;
  let webMaster: User;

  const password = '12345678';
  const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync());

  const representative = 'Mário';
  const observation = 'Período';

  const createWelcomedFamily = async (
    representative: string,
    observation: string,
    field: string,
  ) =>
    await prisma.welcomedFamily.create({
      data: {
        representative,
        observation,
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
        WelcomedFamilyModule,
      ],
      providers: [
        {
          provide: APP_INTERCEPTOR,
          useClass: ResponseInterceptor,
        },
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    welcomedFamilyService = moduleRef.get(WelcomedFamilyService);

    // enable soft delete
    await prisma.onModuleInit();
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

    admin = await createUser(
      prisma,
      'admin',
      'sigma@email.com',
      hashedPassword,
      Role.ADMIN,
      field.id,
    );

    webMaster = await createUser(
      prisma,
      'webMaster',
      'ultra.sigma@email.com',
      hashedPassword,
      Role.WEB_MASTER,
    );
  });

  describe('create()', () => {
    it('Should Create an Welcomed Family (as USER)', async () => {
      const welcomedFamily = await welcomedFamilyService.create(user, {
        representative,
        observation,
      });

      expect(welcomedFamily.representative).toBe(representative);
      expect(welcomedFamily.observation).toBe(observation);
      expect(welcomedFamily.fieldId).toBe(field.id);
    });

    it('Should Create an Welcomed Family (as ADMIN)', async () => {
      const welcomedFamily = await welcomedFamilyService.create(admin, {
        representative,
        observation,
      });

      expect(welcomedFamily.representative).toBe(representative);
      expect(welcomedFamily.observation).toBe(observation);
      expect(welcomedFamily.fieldId).toBe(field.id);
    });

    it('Should Not Create An Assited Family (as WEB MASTER && Missing Data)', async () => {
      try {
        await welcomedFamilyService.create(webMaster, {
          representative,
          observation,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.response.message).toBe(
          TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'),
        );
      }
    });

    it('Should Create an Welcomed Family (as WEB MASTER)', async () => {
      const welcomedFamily = await welcomedFamilyService.create(webMaster, {
        representative,
        observation,
        field: field.id,
      });

      expect(welcomedFamily.representative).toBe(representative);
      expect(welcomedFamily.observation).toBe(observation);
      expect(welcomedFamily.fieldId).toBe(field.id);
    });
  });

  describe('findAll()', () => {
    it('Should Return an Empty Array', async () => {
      const response = await welcomedFamilyService.findAll();

      expect(response.data).toHaveLength(0);
      expect(response.totalCount).toBe(0);
      expect(response.totalPages).toBe(0);
    });

    it(`Should Return an Welcomed Family List With ${ITEMS_PER_PAGE} Items`, async () => {
      const welcomedFamiliesToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(
          (v, i) =>
          ({
            representative: `João ${i}`,
            observation: 'Período',
            fieldId: field.id,
          } as WelcomedFamily),
        );
      await prisma.welcomedFamily.createMany({
        data: welcomedFamiliesToCreate,
      });

      const response = await welcomedFamilyService.findAll();
      expect(response.data).toHaveLength(ITEMS_PER_PAGE);
      expect(response.totalCount).toBe(ITEMS_PER_PAGE);
      expect(response.totalPages).toBe(1);
    });

    const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE);
    it(`Should Return an Welcomed Family List With ${randomN} Items`, async () => {
      const welcomedFamiliesToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(
          (v, i) =>
          ({
            representative: `João ${i}`,
            observation: 'Período',
            fieldId: field.id,
          } as WelcomedFamily),
        );
      await prisma.welcomedFamily.createMany({
        data: welcomedFamiliesToCreate,
      });

      const response = await welcomedFamilyService.findAll({
        itemsPerPage: randomN,
      });
      expect(response.data).toHaveLength(randomN);
      expect(response.totalCount).toBe(ITEMS_PER_PAGE);
      expect(response.totalPages).toBe(
        Math.ceil(response.totalCount / randomN),
      );
    });
  });

  describe('findOne()', () => {
    it("Should Return Null (Doesn't Exists)", async () => {
      const randomId = uuidv4();
      const welcomedFamily = await welcomedFamilyService.findOne(randomId);

      expect(welcomedFamily).toBeNull();
    });

    it('Should Return an Welcomed Family', async () => {
      const welcomedFamilyCreated = await createWelcomedFamily(
        representative,
        observation,
        field.id,
      );

      const welcomedFamily = await welcomedFamilyService.findOne(
        welcomedFamilyCreated.id,
      );
      expect(welcomedFamily.representative).toBe(representative);
      expect(welcomedFamily.observation).toBe(observation);
      expect(welcomedFamily.fieldId).toBe(field.id);
    });
  });

  describe('update()', () => {
    it('Should Not Update an Welcomed Family (Not Found as USER)', async () => {
      try {
        const randomId = uuidv4();
        await welcomedFamilyService.update(randomId, user, {
          representative: 'lol',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('família acolhida', 'a'),
        );
      }
    });

    it('Should Not Update an Welcomed Family (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await welcomedFamilyService.update(randomId, admin, {
          representative: 'lol',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('família acolhida', 'a'),
        );
      }
    });

    it('Should Not Update an Welcomed Family (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await welcomedFamilyService.update(randomId, webMaster, {
          representative: 'lol',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('família acolhida', 'a'),
        );
      }
    });

    it('Should Not Update an Welcomed Family (Different Field as USER)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const welcomedFamily = await createWelcomedFamily(
          representative,
          observation,
          differentField.id,
        );
        await welcomedFamilyService.update(welcomedFamily.id, user, {
          representative: 'lol',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Not Update an Welcomed Family (Different Field as ADMIN)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const welcomedFamily = await createWelcomedFamily(
          representative,
          observation,
          differentField.id,
        );
        await welcomedFamilyService.update(welcomedFamily.id, admin, {
          representative: 'lol',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Update an Welcomed Family (as USER)', async () => {
      const welcomedFamily = await createWelcomedFamily(
        representative,
        observation,
        field.id,
      );
      const newRepresentative = 'Abreu';

      const welcomedFamilyUpdated = await welcomedFamilyService.update(
        welcomedFamily.id,
        user,
        {
          representative: newRepresentative,
        },
      );
      expect(welcomedFamilyUpdated).toBeDefined();
      expect(welcomedFamilyUpdated.representative).toBe(newRepresentative);
    });

    it('Should Update an Welcomed Family (as ADMIN)', async () => {
      const welcomedFamily = await createWelcomedFamily(
        representative,
        observation,
        field.id,
      );
      const newRepresentative = 'Abreu';

      const welcomedFamilyUpdated = await welcomedFamilyService.update(
        welcomedFamily.id,
        admin,
        {
          representative: newRepresentative,
        },
      );
      expect(welcomedFamilyUpdated).toBeDefined();
      expect(welcomedFamilyUpdated.representative).toBe(newRepresentative);
    });

    it('Should Update an Welcomed Family (as WEB MASTER)', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const welcomedFamily = await createWelcomedFamily(
        representative,
        observation,
        field.id,
      );
      const newRepresentative = 'Abreu';

      const welcomedFamilyUpdated = await welcomedFamilyService.update(
        welcomedFamily.id,
        webMaster,
        {
          representative: newRepresentative,
          field: differentField.id,
        },
      );
      expect(welcomedFamilyUpdated).toBeDefined();
      expect(welcomedFamilyUpdated.representative).toBe(newRepresentative);
      expect(welcomedFamilyUpdated.fieldId).toBe(differentField.id);
    });
  });

  describe('remove()', () => {
    it('Should Not Remove an Welcomed Family (Not Found as USER)', async () => {
      try {
        const randomId = uuidv4();
        await welcomedFamilyService.remove(randomId, user);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('família acolhida', 'a'),
        );
      }
    });

    it('Should Not Remove an Welcomed Family (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await welcomedFamilyService.remove(randomId, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('família acolhida', 'a'),
        );
      }
    });

    it('Should Not Remove an Welcomed Family (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await welcomedFamilyService.remove(randomId, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('família acolhida', 'a'),
        );
      }
    });

    it('Should Not Remove an Welcomed Family (Different Field as USER)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const welcomedFamily = await createWelcomedFamily(
          representative,
          observation,
          differentField.id,
        );

        await welcomedFamilyService.remove(welcomedFamily.id, user);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Not Remove an Welcomed Family (Different Field as admin)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const welcomedFamily = await createWelcomedFamily(
          representative,
          observation,
          differentField.id,
        );

        await welcomedFamilyService.remove(welcomedFamily.id, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Remove an Welcomed Family (as USER)', async () => {
      const welcomedFamily = await createWelcomedFamily(
        representative,
        observation,
        field.id,
      );

      await welcomedFamilyService.remove(welcomedFamily.id, user);
      const isWelcomedFamilyDeleted = await prisma.welcomedFamily.findFirst({
        where: {
          id: welcomedFamily.id,
          deleted: { lte: new Date() },
        },
      });
      expect(isWelcomedFamilyDeleted.deleted).toBeDefined();
    });

    it('Should Remove an Welcomed Family (as ADMIN)', async () => {
      const welcomedFamily = await createWelcomedFamily(
        representative,
        observation,
        field.id,
      );

      await welcomedFamilyService.remove(welcomedFamily.id, admin);
      const isWelcomedFamilyDeleted = await prisma.welcomedFamily.findFirst({
        where: {
          id: welcomedFamily.id,
          deleted: { lte: new Date() },
        },
      });
      expect(isWelcomedFamilyDeleted.deleted).toBeDefined();
    });

    it('Should Remove an Welcomed Family (as WEB MASTER)', async () => {
      const welcomedFamily = await createWelcomedFamily(
        representative,
        observation,
        field.id,
      );

      await welcomedFamilyService.remove(welcomedFamily.id, webMaster);
      const isWelcomedFamilyDeleted = await prisma.welcomedFamily.findFirst({
        where: {
          id: welcomedFamily.id,
          deleted: { lte: new Date() },
        },
      });
      expect(isWelcomedFamilyDeleted.deleted).toBeDefined();
    });
  });

  describe('restore()', () => {
    it('Should Not Restore a Welcomed Family (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await welcomedFamilyService.restore({ ids: [randomId] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('família acolhida', 'a'),
        );
      }
    });

    it('Should Not Restore a Welcomed Family (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await welcomedFamilyService.restore(randomId, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('família acolhida', 'a'),
        );
      }
    });

    it('Should Not Restore a Welcomed Family (Different Field as ADMIN)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const welcomedFamily = await createWelcomedFamily(
          representative,
          observation,
          differentField.id,
        );
        await prisma.welcomedFamily.delete({ where: { id: welcomedFamily.id } });
        await welcomedFamilyService.restore({ ids: [welcomedFamily.id] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Restore an Welcomed Family (as ADMIN)', async () => {
      const welcomedFamily = await createWelcomedFamily(
        representative,
        observation,
        field.id,
      );
      await prisma.welcomedFamily.delete({ where: { id: welcomedFamily.id } });

      await welcomedFamilyService.restore({ ids: [welcomedFamily.id] }, admin);
      const isWelcomedFamilyRestored = await prisma.welcomedFamily.findFirst({
        where: {
          id: welcomedFamily.id,
        },
      });

      expect(isWelcomedFamilyRestored.deleted).toBeNull();
    });

    it('Should Restore an Welcomed Family (as WEB MASTER)', async () => {
      const welcomedFamily = await createWelcomedFamily(
        representative,
        observation,
        field.id,
      );
      await prisma.welcomedFamily.delete({ where: { id: welcomedFamily.id } });

      await welcomedFamilyService.restore({ ids: [welcomedFamily.id] }, webMaster);
      const isWelcomedFamilyRestored = await prisma.welcomedFamily.findFirst({
        where: {
          id: welcomedFamily.id,
        },
      });

      expect(isWelcomedFamilyRestored.deleted).toBeNull();
    });
  });

  describe('hardRemove()', () => {
    it('Should Not Hard Remove a Welcomed Family (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await welcomedFamilyService.hardRemove({ ids: [randomId] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('família acolhida', 'a'),
        );
      }
    });

    it('Should Not Hard Remove a Welcomed Family (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await welcomedFamilyService.hardRemove(randomId, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('família acolhida', 'a'),
        );
      }
    });

    it('Should Not Hard Remove a Welcomed Family (Different Field as ADMIN)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const welcomedFamily = await createWelcomedFamily(
          representative,
          observation,
          differentField.id,
        );
        await prisma.welcomedFamily.delete({ where: { id: welcomedFamily.id } });
        await welcomedFamilyService.hardRemove({ ids: [welcomedFamily.id] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Hard Remove an Welcomed Family (as ADMIN)', async () => {
      const welcomedFamily = await createWelcomedFamily(
        representative,
        observation,
        field.id,
      );
      await prisma.welcomedFamily.delete({ where: { id: welcomedFamily.id } });

      await welcomedFamilyService.hardRemove({ ids: [welcomedFamily.id] }, admin);
      const isWelcomedFamilyRemoved = await prisma.welcomedFamily.findFirst({
        where: {
          id: welcomedFamily.id,
          deleted: { not: new Date() },
        },
      });
      expect(isWelcomedFamilyRemoved).toBeNull();
    });

    it('Should Hard Remove an Welcomed Family (as WEB MASTER)', async () => {
      const welcomedFamily = await createWelcomedFamily(
        representative,
        observation,
        field.id,
      );
      await prisma.welcomedFamily.delete({ where: { id: welcomedFamily.id } });

      await welcomedFamilyService.hardRemove({ ids: [welcomedFamily.id] }, webMaster);
      const isWelcomedFamilyRemoved = await prisma.welcomedFamily.findFirst({
        where: {
          id: welcomedFamily.id,
          deleted: { not: new Date() },
        },
      });
      expect(isWelcomedFamilyRemoved).toBeNull();
    });
  });
});
