import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Collaborator, Field, Role, User } from '@prisma/client';
import { CollaboratorService } from 'src/collaborator/collaborator.service';
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
import { CollaboratorModule } from 'src/collaborator/collaborator.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from 'src/response.interceptor';

describe('Collaborator Service Integration', () => {
  let prisma: PrismaService;
  let collaboratorService: CollaboratorService;

  let field: Field;
  let user: User;
  let admin: User;
  let webMaster: User;

  const password = '12345678';
  const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync());

  const title = 'João';
  const description = 'Descrição';

  const createCollaborator = async (
    title: string,
    description: string,
    field: string,
  ) =>
    await prisma.collaborator.create({
      data: {
        title,
        description,
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
        CollaboratorModule,
      ],
      providers: [
        {
          provide: APP_INTERCEPTOR,
          useClass: ResponseInterceptor,
        },
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    collaboratorService = moduleRef.get(CollaboratorService);

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
    it('Should Create a Collaborator (as USER)', async () => {
      const collaborator = await collaboratorService.create(user, {
        title,
        description,
      });

      expect(collaborator.title).toBe(title);
      expect(collaborator.description).toBe(description);
      expect(collaborator.fieldId).toBe(field.id);
    });

    it('Should Create a Collaborator (as ADMIN)', async () => {
      const collaborator = await collaboratorService.create(admin, {
        title,
        description,
      });

      expect(collaborator.title).toBe(title);
      expect(collaborator.description).toBe(description);
      expect(collaborator.fieldId).toBe(field.id);
    });

    it('Should Not Create a Collaborator (as WEB MASTER && Missing Data)', async () => {
      try {
        await collaboratorService.create(webMaster, {
          title,
          description,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.response.message).toBe(
          TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'),
        );
      }
    });

    it('Should Create a Collaborator (as WEB MASTER)', async () => {
      const collaborator = await collaboratorService.create(webMaster, {
        title,
        description,
        field: field.id,
      });

      expect(collaborator.title).toBe(title);
      expect(collaborator.description).toBe(description);
      expect(collaborator.fieldId).toBe(field.id);
    });
  });

  describe('findAll()', () => {
    it('Should Return an Empty Array', async () => {
      const response = await collaboratorService.findAll();

      expect(response.data).toHaveLength(0);
      expect(response.totalCount).toBe(0);
      expect(response.totalPages).toBe(0);
    });

    it(`Should Return a Collaborator List With ${ITEMS_PER_PAGE} Items`, async () => {
      const collaboratorsToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(
          (v, i) =>
          ({
            title: `João ${i}`,
            description,
            fieldId: field.id,
          } as Collaborator),
        );
      await prisma.collaborator.createMany({
        data: collaboratorsToCreate,
      });

      const response = await collaboratorService.findAll();
      expect(response.data).toHaveLength(ITEMS_PER_PAGE);
      expect(response.totalCount).toBe(ITEMS_PER_PAGE);
      expect(response.totalPages).toBe(1);
    });

    const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE);
    it(`Should Return a Collaborator List With ${randomN} Items`, async () => {
      const collaboratorsToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(
          (v, i) =>
          ({
            title: `João ${i}`,
            description,
            fieldId: field.id,
          } as Collaborator),
        );
      await prisma.collaborator.createMany({
        data: collaboratorsToCreate,
      });

      const response = await collaboratorService.findAll({
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
      const collaborator = await collaboratorService.findOne(randomId);

      expect(collaborator).toBeNull();
    });

    it('Should Return a Collaborator', async () => {
      const collaboratorCreated = await createCollaborator(
        title,
        description,
        field.id,
      );

      const collaborator = await collaboratorService.findOne(
        collaboratorCreated.id,
      );
      expect(collaborator).toBeDefined();
    });
  });

  describe('update()', () => {
    it('Should Not Update a Collaborator (Not Found as USER)', async () => {
      try {
        const randomId = uuidv4();
        await collaboratorService.update(randomId, user, { title: 'lol' });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('colaborador', 'o'),
        );
      }
    });

    it('Should Not Update a Collaborator (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await collaboratorService.update(randomId, admin, { title: 'lol' });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('colaborador', 'o'),
        );
      }
    });

    it('Should Not Update a Collaborator (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await collaboratorService.update(randomId, webMaster, { title: 'lol' });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('colaborador', 'o'),
        );
      }
    });

    it('Should Not Update a Collaborator (Different Field as USER)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const collaborator = await createCollaborator(
          title,
          description,
          differentField.id,
        );
        await collaboratorService.update(collaborator.id, user, {
          title: 'lol',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Not Update a Collaborator (Different Field as ADMIN)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const collaborator = await createCollaborator(
          title,
          description,
          differentField.id,
        );
        await collaboratorService.update(collaborator.id, admin, {
          title: 'lol',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Update a Collaborator (as USER)', async () => {
      const collaborator = await createCollaborator(
        title,
        description,
        field.id,
      );
      const newTitle = 'Abreu';

      const collaboratorUpdated = await collaboratorService.update(
        collaborator.id,
        user,
        {
          title: newTitle,
        },
      );
      expect(collaboratorUpdated).toBeDefined();
      expect(collaboratorUpdated.title).toBe(newTitle);
    });

    it('Should Update a Collaborator (as ADMIN)', async () => {
      const collaborator = await createCollaborator(
        title,
        description,
        field.id,
      );
      const newTitle = 'Abreu';

      const collaboratorUpdated = await collaboratorService.update(
        collaborator.id,
        admin,
        {
          title: newTitle,
        },
      );
      expect(collaboratorUpdated).toBeDefined();
      expect(collaboratorUpdated.title).toBe(newTitle);
    });


    it('Should Update a Collaborator (as WEB MASTER)', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const collaborator = await createCollaborator(
        title,
        description,
        field.id,
      );
      const newTitle = 'Abreu';

      const collaboratorUpdated = await collaboratorService.update(
        collaborator.id,
        webMaster,
        {
          title: newTitle,
          field: differentField.id,
        },
      );
      expect(collaboratorUpdated).toBeDefined();
      expect(collaboratorUpdated.title).toBe(newTitle);
      expect(collaboratorUpdated.fieldId).toBe(differentField.id);
    });
  });

  describe('remove()', () => {
    it('Should Not Remove a Collaborator (Not Found as USER)', async () => {
      try {
        const randomId = uuidv4();
        await collaboratorService.remove(randomId, user);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('colaborador', 'o'),
        );
      }
    });

    it('Should Not Remove a Collaborator (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await collaboratorService.remove(randomId, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('colaborador', 'o'),
        );
      }
    });

    it('Should Not Remove a Collaborator (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await collaboratorService.remove(randomId, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('colaborador', 'o'),
        );
      }
    });

    it('Should Not Remove a Collaborator (Different Field as USER)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const collaborator = await createCollaborator(
          title,
          description,
          differentField.id,
        );
        await collaboratorService.remove(collaborator.id, user);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Not Remove a Collaborator (Different Field as ADMIN)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const collaborator = await createCollaborator(
          title,
          description,
          differentField.id,
        );
        await collaboratorService.remove(collaborator.id, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Remove a Collaborator (as USER)', async () => {
      const collaborator = await createCollaborator(
        title,
        description,
        field.id,
      );
      await collaboratorService.remove(collaborator.id, user);

      const isCollaboratorDeleted = await prisma.collaborator.findFirst({
        where: {
          id: collaborator.id,
          deleted: { lte: new Date() },
        },
      });
      expect(isCollaboratorDeleted.deleted).toBeDefined();
    });

    it('Should Remove a Collaborator (as ADMIN)', async () => {
      const collaborator = await createCollaborator(
        title,
        description,
        field.id,
      );
      await collaboratorService.remove(collaborator.id, admin);

      const isCollaboratorDeleted = await prisma.collaborator.findFirst({
        where: {
          id: collaborator.id,
          deleted: { lte: new Date() },
        },
      });
      expect(isCollaboratorDeleted.deleted).toBeDefined();
    });

    it('Should Remove a Collaborator (as WEB MASTER)', async () => {
      const collaborator = await createCollaborator(
        title,
        description,
        field.id,
      );
      await collaboratorService.remove(collaborator.id, webMaster);

      const isCollaboratorDeleted = await prisma.collaborator.findFirst({
        where: {
          id: collaborator.id,
          deleted: { lte: new Date() },
        },
      });
      expect(isCollaboratorDeleted.deleted).toBeDefined();
    });
  });

  describe('restore()', () => {
    it('Should Not Restore a Collaborator (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await collaboratorService.restore({ ids: [randomId] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('colaborador', 'o'),
        );
      }
    });

    it('Should Not Restore a Collaborator (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await collaboratorService.restore({ ids: [randomId] }, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('colaborador', 'o'),
        );
      }
    });

    it('Should Not Restore a Collaborator (Different Field as ADMIN)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const collaborator = await createCollaborator(title, description, differentField.id);
        await prisma.collaborator.delete({ where: { id: collaborator.id } });
        await collaboratorService.restore({ ids: [collaborator.id] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Restore a Collaborator (as ADMIN)', async () => {
      const collaborator = await createCollaborator(
        title,
        description,
        field.id,
      );
      await prisma.collaborator.delete({ where: { id: collaborator.id } });

      await collaboratorService.restore({ ids: [collaborator.id] }, admin);
      const isCollaboratorRestored = await prisma.collaborator.findFirst({
        where: {
          id: collaborator.id,
        },
      });

      expect(isCollaboratorRestored.deleted).toBeNull();
    });

    it('Should Restore a Collaborator (as WEB MASTER)', async () => {
      const collaborator = await createCollaborator(
        title,
        description,
        field.id,
      );
      await prisma.collaborator.delete({ where: { id: collaborator.id } });

      await collaboratorService.restore({ ids: [collaborator.id] }, webMaster);
      const isCollaboratorRestored = await prisma.collaborator.findFirst({
        where: {
          id: collaborator.id,
        },
      });

      expect(isCollaboratorRestored.deleted).toBeNull();
    });
  });

  describe('hardRemove()', () => {
    it('Should Not Hard Remove a Collaborator (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await collaboratorService.hardRemove({ ids: [randomId] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('colaborador', 'o'),
        );
      }
    });

    it('Should Not Hard Remove a Collaborator (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await collaboratorService.hardRemove({ ids: [randomId] }, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('colaborador', 'o'),
        );
      }
    });

    it('Should Not Hard Remove a Collaborator (Different Field as ADMIN)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const collaborator = await createCollaborator(title, description, differentField.id);
        await prisma.collaborator.delete({ where: { id: collaborator.id } });
        await collaboratorService.hardRemove({ ids: [collaborator.id] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should HardRemove a Collaborator (as ADMIN)', async () => {
      const collaborator = await createCollaborator(
        title,
        description,
        field.id,
      );
      await prisma.collaborator.delete({ where: { id: collaborator.id } });

      await collaboratorService.hardRemove({ ids: [collaborator.id] }, admin);
      const isCollaboratorRemoved = await prisma.collaborator.findFirst({
        where: {
          id: collaborator.id,
          deleted: { not: new Date() },
        },
      });
      expect(isCollaboratorRemoved).toBeNull();
    });

    it('Should HardRemove a Collaborator (as WEB MASTER)', async () => {
      const collaborator = await createCollaborator(
        title,
        description,
        field.id,
      );
      await prisma.collaborator.delete({ where: { id: collaborator.id } });

      await collaboratorService.hardRemove({ ids: [collaborator.id] }, webMaster);
      const isCollaboratorRemoved = await prisma.collaborator.findFirst({
        where: {
          id: collaborator.id,
          deleted: { not: new Date() },
        },
      });
      expect(isCollaboratorRemoved).toBeNull();
    });
  });
});
