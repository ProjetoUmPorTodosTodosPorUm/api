import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Field, Role, User, Volunteer } from '@prisma/client';
import { ITEMS_PER_PAGE, MESSAGE, TEMPLATE } from 'src/constants';
import { PrismaService } from 'src/prisma/prisma.service';
import { createField, createUser } from 'src/utils/test';
import { VolunteerService } from 'src/volunteer/volunteer.service';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

import { ConfigModule } from '@nestjs/config';
import configuration from 'src/config/configuration';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/user/user.module';
import { FieldModule } from 'src/field/field.module';
import { VolunteerModule } from 'src/volunteer/volunteer.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from 'src/response.interceptor';

describe('Volunteer Service Integration', () => {
  let prisma: PrismaService;
  let volunteerService: VolunteerService;

  let field: Field;
  let user: User;
  let admin: User;
  let webMaster: User;

  const password = '12345678';
  const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync());

  const firstName = 'João';
  const joinedDate = new Date('2022-01-01');

  const createVolunteer = async (
    firstName: string,
    joinedDate: Date,
    field: string,
  ) =>
    await prisma.volunteer.create({
      data: {
        firstName,
        joinedDate,
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
        VolunteerModule,
      ],
      providers: [
        {
          provide: APP_INTERCEPTOR,
          useClass: ResponseInterceptor,
        },
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    volunteerService = moduleRef.get(VolunteerService);

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
    it('Should Create a Volunteer (as USER)', async () => {
      const volunteer = await volunteerService.create(user, {
        firstName,
        joinedDate,
      });

      expect(volunteer.firstName).toBe(firstName);
      expect(volunteer.joinedDate).toStrictEqual(joinedDate);
      expect(volunteer.fieldId).toBe(user.fieldId);
    });

    it('Should Create a Volunteer (as ADMIN)', async () => {
      const volunteer = await volunteerService.create(admin, {
        firstName,
        joinedDate,
      });

      expect(volunteer.firstName).toBe(firstName);
      expect(volunteer.joinedDate).toStrictEqual(joinedDate);
      expect(volunteer.fieldId).toBe(admin.fieldId);
    });

    it('Should Not Create a Volunteer (as WEB MASTER && Missing Data)', async () => {
      try {
        await volunteerService.create(admin, {
          firstName,
          joinedDate,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.response.message).toBe(
          TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'),
        );
      }
    });

    it('Should Create a Volunteer (as WEB MASTER)', async () => {
      const volunteer = await volunteerService.create(webMaster, {
        firstName,
        joinedDate,
        field: field.id,
      });
      expect(volunteer.firstName).toBe(firstName);
      expect(volunteer.joinedDate).toStrictEqual(joinedDate);
      expect(volunteer.fieldId).toBe(field.id);
    });
  });

  describe('findAll()', () => {
    it('Should Return an Empty Array', async () => {
      const response = await volunteerService.findAll();

      expect(response.data).toHaveLength(0);
      expect(response.totalCount).toBe(0);
      expect(response.totalPages).toBe(0);
    });

    it(`Should Return a Volunteer List With ${ITEMS_PER_PAGE} Items`, async () => {
      const volunteersToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(
          (v, i) =>
          ({
            firstName: `João ${i}`,
            joinedDate: new Date('2022-01-03'),
            fieldId: field.id,
          } as Volunteer),
        );
      await prisma.volunteer.createMany({
        data: volunteersToCreate,
      });

      const response = await volunteerService.findAll();
      expect(response.data).toHaveLength(ITEMS_PER_PAGE);
      expect(response.totalCount).toBe(ITEMS_PER_PAGE);
      expect(response.totalPages).toBe(1);
    });

    const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE);
    it(`Should Return a Volunteer List With ${randomN} Items`, async () => {
      const volunteersToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(
          (v, i) =>
          ({
            firstName: `João ${i}`,
            joinedDate: new Date('2022-01-03'),
            fieldId: field.id,
          } as Volunteer),
        );
      await prisma.volunteer.createMany({
        data: volunteersToCreate,
      });

      const response = await volunteerService.findAll({
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
      const volunteer = await volunteerService.findOne(randomId);

      expect(volunteer).toBeNull();
    });

    it('Should Return a Volunteer', async () => {
      const volunteerCreated = await createVolunteer(
        firstName,
        joinedDate,
        field.id,
      );

      const volunteer = await volunteerService.findOne(volunteerCreated.id);
      expect(volunteer.firstName).toBe(firstName);
      expect(volunteer.joinedDate).toStrictEqual(joinedDate);
      expect(volunteer.fieldId).toBe(field.id);
    });
  });

  describe('update()', () => {
    it('Should Not Update Volunteer (Not Found as USER)', async () => {
      try {
        const randomId = uuidv4();
        await volunteerService.update(randomId, user, { lastName: 'lol' });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('voluntário', 'o'),
        );
      }
    });

    it('Should Not Update Volunteer (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await volunteerService.update(randomId, admin, { lastName: 'lol' });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('voluntário', 'o'),
        );
      }
    });

    it('Should Not Update Volunteer (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await volunteerService.update(randomId, webMaster, { lastName: 'lol' });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('voluntário', 'o'),
        );
      }
    });

    it('Should Not Update Volunteer (Different Field as USER)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const volunteer = await createVolunteer(
          firstName,
          joinedDate,
          differentField.id,
        );
        const newFirstName = 'Phelp';

        await volunteerService.update(volunteer.id, user, {
          firstName: newFirstName,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Not Update Volunteer (Different Field as ADMIN)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const volunteer = await createVolunteer(
          firstName,
          joinedDate,
          differentField.id,
        );
        const newFirstName = 'Phelp';

        await volunteerService.update(volunteer.id, admin, {
          firstName: newFirstName,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Update Volunteer (as USER)', async () => {
      const newFirstName = 'Phelp';
      const volunteer = await createVolunteer(firstName, joinedDate, field.id);

      const volunteerUpdated = await volunteerService.update(
        volunteer.id,
        user,
        {
          firstName: newFirstName,
        },
      );
      expect(volunteerUpdated).toBeDefined();
      expect(volunteerUpdated.firstName).toBe(newFirstName);
    });

    it('Should Update Volunteer (as ADMIN)', async () => {
      const newFirstName = 'Phelp';
      const volunteer = await createVolunteer(firstName, joinedDate, field.id);

      const volunteerUpdated = await volunteerService.update(
        volunteer.id,
        admin,
        {
          firstName: newFirstName,
        },
      );
      expect(volunteerUpdated).toBeDefined();
      expect(volunteerUpdated.firstName).toBe(newFirstName);
    });

    it('Should Update Volunteer (as WEB MASTER)', async () => {
      const newFirstName = 'Phelp';
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const volunteer = await createVolunteer(firstName, joinedDate, field.id);

      const volunteerUpdated = await volunteerService.update(
        volunteer.id,
        webMaster,
        {
          firstName: newFirstName,
          field: differentField.id,
        },
      );
      expect(volunteerUpdated).toBeDefined();
      expect(volunteerUpdated.firstName).toBe(newFirstName);
      expect(volunteerUpdated.fieldId).toBe(differentField.id);
    });
  });

  describe('remove()', () => {
    it('Should Not Remove Volunteer (Not Found as USER)', async () => {
      try {
        const randomId = uuidv4();
        await volunteerService.remove(randomId, user);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('voluntário', 'o'),
        );
      }
    });

    it('Should Not Remove Volunteer (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await volunteerService.remove(randomId, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('voluntário', 'o'),
        );
      }
    });

    it('Should Not Remove Volunteer (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await volunteerService.remove(randomId, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('voluntário', 'o'),
        );
      }
    });

    it('Should Not Remove Volunteer (Different Field as USER)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const volunteer = await createVolunteer(
          firstName,
          joinedDate,
          differentField.id,
        );
        await volunteerService.remove(volunteer.id, user);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Not Remove Volunteer (Different Field as ADMIN)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const volunteer = await createVolunteer(
          firstName,
          joinedDate,
          differentField.id,
        );
        await volunteerService.remove(volunteer.id, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Remove Volunteer (as User)', async () => {
      const volunteer = await createVolunteer(firstName, joinedDate, field.id);

      await volunteerService.remove(volunteer.id, user);
      const isVolunteerDeleted = await prisma.volunteer.findFirst({
        where: {
          id: volunteer.id,
          deleted: { lte: new Date() },
        },
      });
      expect(isVolunteerDeleted.deleted).toBeDefined();
    });

    it('Should Remove Volunteer (as ADMIN)', async () => {
      const volunteer = await createVolunteer(firstName, joinedDate, field.id);

      await volunteerService.remove(volunteer.id, admin);
      const isVolunteerDeleted = await prisma.volunteer.findFirst({
        where: {
          id: volunteer.id,
          deleted: { lte: new Date() },
        },
      });
      expect(isVolunteerDeleted.deleted).toBeDefined();
    });

    it('Should Remove Volunteer (as WEB MASTER)', async () => {
      const volunteer = await createVolunteer(firstName, joinedDate, field.id);

      await volunteerService.remove(volunteer.id, webMaster);
      const isVolunteerDeleted = await prisma.volunteer.findFirst({
        where: {
          id: volunteer.id,
          deleted: { lte: new Date() },
        },
      });
      expect(isVolunteerDeleted.deleted).toBeDefined();
    });
  });

  describe('restore()', () => {
    it('Should Not Restore a Volunteer (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await volunteerService.restore({ ids: [randomId] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'),
        );
      }
    });

    it('Should Not Restore a Volunteer (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await volunteerService.restore(randomId, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'),
        );
      }
    });

    it('Should Not Restore a Volunteer (Different Field as ADMIN)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const volunteer = await createVolunteer(firstName, joinedDate, differentField.id);
        await prisma.volunteer.delete({ where: { id: volunteer.id } });
        await volunteerService.restore({ ids: [volunteer.id] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Restore Volunteer (as ADMIN)', async () => {
      const volunteer = await createVolunteer(firstName, joinedDate, field.id);
      await prisma.volunteer.delete({ where: { id: volunteer.id } });

      await volunteerService.restore({ ids: [volunteer.id] }, admin);
      const isVolunteerRestored = await prisma.volunteer.findFirst({
        where: {
          id: volunteer.id,
        },
      });

      expect(isVolunteerRestored.deleted).toBeNull();
    });

    it('Should Restore Volunteer (as WEB MASTER)', async () => {
      const volunteer = await createVolunteer(firstName, joinedDate, field.id);
      await prisma.volunteer.delete({ where: { id: volunteer.id } });

      await volunteerService.restore({ ids: [volunteer.id] }, webMaster);
      const isVolunteerRestored = await prisma.volunteer.findFirst({
        where: {
          id: volunteer.id,
        },
      });

      expect(isVolunteerRestored.deleted).toBeNull();
    });
  });

  describe('hardRemove()', () => {
    it('Should Not Hard Remove a Volunteer (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await volunteerService.hardRemove({ ids: [randomId] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'),
        );
      }
    });

    it('Should Not Hard Remove a Volunteer (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await volunteerService.hardRemove(randomId, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'),
        );
      }
    });

    it('Should Not Hard Remove a Volunteer (Different Field as ADMIN)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const volunteer = await createVolunteer(firstName, joinedDate, differentField.id);
        await prisma.volunteer.delete({ where: { id: volunteer.id } });
        await volunteerService.hardRemove({ ids: [volunteer.id] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Hard Remove a Volunteer (as ADMIN)', async () => {
      const volunteer = await createVolunteer(firstName, joinedDate, field.id);
      await prisma.volunteer.delete({ where: { id: volunteer.id } });

      await volunteerService.hardRemove({ ids: [volunteer.id] }, admin);
      const isVolunteerRemoved = await prisma.volunteer.findFirst({
        where: {
          id: volunteer.id,
          deleted: { not: new Date() },
        },
      });
      expect(isVolunteerRemoved).toBeNull();
    });

    it('Should Hard Remove a Volunteer (as WEB MASTER)', async () => {
      const volunteer = await createVolunteer(firstName, joinedDate, field.id);
      await prisma.volunteer.delete({ where: { id: volunteer.id } });

      await volunteerService.hardRemove({ ids: [volunteer.id] }, webMaster);
      const isVolunteerRemoved = await prisma.volunteer.findFirst({
        where: {
          id: volunteer.id,
          deleted: { not: new Date() },
        },
      });
      expect(isVolunteerRemoved).toBeNull();
    });
  });
});
