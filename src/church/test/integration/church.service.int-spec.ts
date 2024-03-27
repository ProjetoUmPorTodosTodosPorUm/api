import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Church, ChurchType, Field, Role, User } from '@prisma/client';
import { ChurchService } from 'src/church/church.service';
import { ITEMS_PER_PAGE, MESSAGE, TEMPLATE } from 'src/constants';
import { PrismaService } from 'src/prisma/prisma.service';
import { createField, createUser } from 'src/utils/test';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

import { ConfigModule } from '@nestjs/config';
import configuration from 'src/config/configuration';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/user/user.module';
import { FieldModule } from 'src/field/field.module';
import { ChurchModule } from 'src/church/church.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from 'src/response.interceptor';

describe('Church Service Integration', () => {
  let prisma: PrismaService;
  let churchService: ChurchService;

  let field: Field;
  let user: User;
  let admin: User;
  let webMaster: User;

  const password = '12345678';
  const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync());

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

    prisma = moduleRef.get(PrismaService);
    churchService = moduleRef.get(ChurchService);

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
    it('Should Create a Church (as USER)', async () => {
      const church = await churchService.create(user, {
        name,
        description,
        type,
      });

      expect(church.name).toBe(name);
      expect(church.description).toBe(description);
      expect(church.type).toBe(type);
      expect(church.fieldId).toBe(user.fieldId);
    });

    it('Should Create a Church (as ADMIN)', async () => {
      const church = await churchService.create(admin, {
        name,
        description,
        type,
      });

      expect(church.name).toBe(name);
      expect(church.description).toBe(description);
      expect(church.type).toBe(type);
      expect(church.fieldId).toBe(admin.fieldId);
    });

    it('Should Not Create a Church (as WEB MASTER && Missing Data)', async () => {
      try {
        await churchService.create(webMaster, {
          name,
          description,
          type,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.response.message).toBe(
          TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'),
        );
      }
    });

    it('Should Create a Church (as WEB MASTER)', async () => {
      const church = await churchService.create(webMaster, {
        name,
        description,
        type,
        field: field.id,
      });

      expect(church.name).toBe(name);
      expect(church.description).toBe(description);
      expect(church.type).toBe(type);
      expect(church.fieldId).toBe(field.id);
    });
  });

  describe('findAll()', () => {
    it('Should Return an Empty Array', async () => {
      const response = await churchService.findAll();

      expect(response.data).toHaveLength(0);
      expect(response.totalCount).toBe(0);
      expect(response.totalPages).toBe(0);
    });

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

      const response = await churchService.findAll();
      expect(response.data).toHaveLength(ITEMS_PER_PAGE);
      expect(response.totalCount).toBe(ITEMS_PER_PAGE);
      expect(response.totalPages).toBe(1);
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

      const response = await churchService.findAll({
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
      const church = await churchService.findOne(randomId);

      expect(church).toBeNull();
    });

    it('Should Return a Church', async () => {
      const churchCreated = await createChurch(
        name,
        description,
        type,
        field.id,
      );

      const church = await churchService.findOne(churchCreated.id);
      expect(church).toBeDefined();
    });
  });

  describe('update()', () => {
    it('Should Not Update a Church (Not Found as USER)', async () => {
      try {
        const randomId = uuidv4();
        await churchService.update(randomId, user, { name: 'lol' });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('igreja', 'a'),
        );
      }
    });

    it('Should Not Update a Church (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await churchService.update(randomId, admin, { name: 'lol' });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('igreja', 'a'),
        );
      }
    });

    it('Should Not Update a Church (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await churchService.update(randomId, webMaster, { name: 'lol' });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('igreja', 'a'),
        );
      }
    });

    it('Should Not Update a Church (Different Field as USER)', async () => {
      try {
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
        await churchService.update(church.id, user, { name: 'lol' });
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Not Update a Church (Different Field as ADMIN)', async () => {
      try {
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
        await churchService.update(church.id, admin, { name: 'lol' });
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Update a Church (as USER)', async () => {
      const church = await createChurch(name, description, type, field.id);
      const newName = 'Abreu';

      const churchUpdated = await churchService.update(church.id, user, {
        name: newName,
      });
      expect(churchUpdated).toBeDefined();
      expect(churchUpdated.name).toBe(newName);
    });

    it('Should Update a Church (as ADMIN)', async () => {
      const church = await createChurch(name, description, type, field.id);
      const newName = 'Abreu';

      const churchUpdated = await churchService.update(church.id, admin, {
        name: newName,
      });
      expect(churchUpdated).toBeDefined();
      expect(churchUpdated.name).toBe(newName);
    });

    it('Should Update a Church (as WEB MASTER)', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const church = await createChurch(name, description, type, field.id);
      const newName = 'Abreu';

      const churchUpdated = await churchService.update(church.id, webMaster, {
        name: newName,
        field: differentField.id,
      });
      expect(churchUpdated).toBeDefined();
      expect(churchUpdated.name).toBe(newName);
      expect(churchUpdated.fieldId).toBe(differentField.id);
    });
  });

  describe('remove()', () => {
    it('Should Not Remove a Church (Not Found as USER)', async () => {
      try {
        const randomId = uuidv4();
        await churchService.remove(randomId, user);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('igreja', 'a'),
        );
      }
    });

    it('Should Not Remove a Church (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await churchService.remove(randomId, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('igreja', 'a'),
        );
      }
    });

    it('Should Not Remove a Church (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await churchService.remove(randomId, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('igreja', 'a'),
        );
      }
    });

    it('Should Not Remove a Church (Different Field as USER)', async () => {
      try {
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
        await churchService.remove(church.id, user);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Not Remove a Church (Different Field as ADMIN)', async () => {
      try {
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
        await churchService.remove(church.id, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Remove a Church (as USER)', async () => {
      const church = await createChurch(name, description, type, field.id);

      await churchService.remove(church.id, user);
      const ischurchDeleted = await prisma.church.findFirst({
        where: {
          id: church.id,
          deleted: { lte: new Date() },
        },
      });
      expect(ischurchDeleted.deleted).toBeDefined();
    });

    it('Should Remove a Church (as ADMIN)', async () => {
      const church = await createChurch(name, description, type, field.id);

      await churchService.remove(church.id, admin);
      const ischurchDeleted = await prisma.church.findFirst({
        where: {
          id: church.id,
          deleted: { lte: new Date() },
        },
      });
      expect(ischurchDeleted.deleted).toBeDefined();
    });

    it('Should Remove a Church (as WEB MASTER)', async () => {
      const church = await createChurch(name, description, type, field.id);

      await churchService.remove(church.id, webMaster);
      const ischurchDeleted = await prisma.church.findFirst({
        where: {
          id: church.id,
          deleted: { lte: new Date() },
        },
      });
      expect(ischurchDeleted.deleted).toBeDefined();
    });
  });

  describe('restore()', () => {
    it('Should Not Restore a Church (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await churchService.restore({ ids: [randomId] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('igreja', 'a'),
        );
      }
    });

    it('Should Not Restore a Church (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await churchService.restore({ ids: [randomId] }, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('igreja', 'a'),
        );
      }
    });

    it('Should Not Restore a Church (Different Field as ADMIN)', async () => {
      try {
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

        await churchService.restore({ ids: [church.id] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Restore a Church (as ADMIN)', async () => {
      const church = await createChurch(name, description, type, field.id);
      await prisma.church.delete({ where: { id: church.id } });

      await churchService.restore({ ids: [church.id] }, admin);
      const ischurchRestored = await prisma.church.findFirst({
        where: {
          id: church.id,
        },
      });

      expect(ischurchRestored.deleted).toBeNull();
    });

    it('Should Restore a Church (as WEB MASTER)', async () => {
      const church = await createChurch(name, description, type, field.id);
      await prisma.church.delete({ where: { id: church.id } });

      await churchService.restore({ ids: [church.id] }, webMaster);
      const ischurchRestored = await prisma.church.findFirst({
        where: {
          id: church.id,
        },
      });

      expect(ischurchRestored.deleted).toBeNull();
    });
  });

  describe('hardRemove()', () => {
    it('Should Not Hard Remove a Church (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await churchService.hardRemove({ ids: [randomId] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('igreja', 'a'),
        );
      }
    });

    it('Should Not Hard Remove a Church (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await churchService.hardRemove({ ids: [randomId] }, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('igreja', 'a'),
        );
      }
    });

    it('Should Not Hard Remove a Church (Different Field as ADMIN)', async () => {
      try {
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

        await churchService.hardRemove({ ids: [church.id] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Hard Remove a Church (as ADMIN)', async () => {
      const church = await createChurch(name, description, type, field.id);
      await prisma.church.delete({ where: { id: church.id } });

      await churchService.hardRemove({ ids: [church.id] }, admin);
      const isChurchRemoved = await prisma.church.findFirst({
        where: {
          id: church.id,
          deleted: { not: new Date() },
        },
      });

      expect(isChurchRemoved).toBeNull();
    });

    it('Should Hard Remove a Church (as WEB MASTER)', async () => {
      const church = await createChurch(name, description, type, field.id);
      await prisma.church.delete({ where: { id: church.id } });

      await churchService.hardRemove({ ids: [church.id] }, webMaster);
      const isChurchRemoved = await prisma.church.findFirst({
        where: {
          id: church.id,
          deleted: { not: new Date() },
        },
      });

      expect(isChurchRemoved).toBeNull();
    });
  });
});
