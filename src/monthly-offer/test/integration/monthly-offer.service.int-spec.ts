import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Field, MonthlyOffer, Role, User } from '@prisma/client';
import { ITEMS_PER_PAGE, MESSAGE, TEMPLATE } from 'src/constants';
import { MonthlyOfferService } from 'src/monthly-offer/monthly-offer.service';
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
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from 'src/response.interceptor';
import { MonthlyOfferModule } from 'src/monthly-offer/monthly-offer.module';

describe('Monthly Offer Service Integration', () => {
  let prisma: PrismaService;
  let monthlyOfferService: MonthlyOfferService;

  let field: Field;
  let user: User;
  let admin: User;
  let webMaster: User;

  const password = '12345678';
  const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync());

  const month = 1;
  const year = 2022;
  const foodQnt = 1;
  const monetaryValue = 1.5;
  const othersQnt = 1;

  const createMonthlyOffer = async (
    month: number,
    year: number,
    foodQnt: number,
    monetaryValue: number,
    othersQnt: number,
    field: string,
  ) =>
    await prisma.monthlyOffer.create({
      data: {
        month,
        year,
        foodQnt,
        monetaryValue,
        othersQnt,
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
        MonthlyOfferModule,
      ],
      providers: [
        {
          provide: APP_INTERCEPTOR,
          useClass: ResponseInterceptor,
        },
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    monthlyOfferService = moduleRef.get(MonthlyOfferService);

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
    it('Should Create a Monthly Offer (as USER)', async () => {
      const MonthlyOffer = await monthlyOfferService.create(user, {
        month,
        year,
        foodQnt,
        monetaryValue,
        othersQnt,
      });

      expect(MonthlyOffer.month).toBe(month);
      expect(MonthlyOffer.year).toBe(year);
      expect(MonthlyOffer.foodQnt).toBe(foodQnt);
      expect(MonthlyOffer.monetaryValue).toBe(monetaryValue);
      expect(MonthlyOffer.othersQnt).toBe(othersQnt);
    });

    it('Should Create a Monthly Offer (as ADMIN)', async () => {
      const MonthlyOffer = await monthlyOfferService.create(admin, {
        month,
        year,
        foodQnt,
        monetaryValue,
        othersQnt,
      });

      expect(MonthlyOffer.month).toBe(month);
      expect(MonthlyOffer.year).toBe(year);
      expect(MonthlyOffer.foodQnt).toBe(foodQnt);
      expect(MonthlyOffer.monetaryValue).toBe(monetaryValue);
      expect(MonthlyOffer.othersQnt).toBe(othersQnt);
    });

    it('Should Not Create aa Monthly Offer (as WEB MASTER && Missing Data)', async () => {
      try {
        await monthlyOfferService.create(webMaster, {
          month,
          year,
          foodQnt,
          monetaryValue,
          othersQnt,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.response.message).toBe(
          TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'),
        );
      }
    });

    it('Should Create a Monthly Offer (as WEB MASTER)', async () => {
      const MonthlyOffer = await monthlyOfferService.create(webMaster, {
        month,
        year,
        foodQnt,
        monetaryValue,
        othersQnt,
        field: field.id,
      });

      expect(MonthlyOffer.month).toBe(month);
      expect(MonthlyOffer.year).toBe(year);
      expect(MonthlyOffer.foodQnt).toBe(foodQnt);
      expect(MonthlyOffer.monetaryValue).toBe(monetaryValue);
      expect(MonthlyOffer.othersQnt).toBe(othersQnt);
    });
  });

  describe('findAll()', () => {
    it('Should Return an Empty Array', async () => {
      const response = await monthlyOfferService.findAll();

      expect(response.data).toHaveLength(0);
      expect(response.totalCount).toBe(0);
      expect(response.totalPages).toBe(0);
    });

    it(`Should Return a Monthly Offer List With ${ITEMS_PER_PAGE} Items`, async () => {
      const MonthlyOffersToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(
          (v, i) =>
          ({
            month,
            year,
            foodQnt,
            monetaryValue,
            othersQnt,
            fieldId: field.id,
          } as MonthlyOffer),
        );
      await prisma.monthlyOffer.createMany({
        data: MonthlyOffersToCreate,
      });

      const response = await monthlyOfferService.findAll();
      expect(response.data).toHaveLength(ITEMS_PER_PAGE);
      expect(response.totalCount).toBe(ITEMS_PER_PAGE);
      expect(response.totalPages).toBe(1);
    });

    const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE);
    it(`Should Return a Monthly Offer List With ${randomN} Items`, async () => {
      const MonthlyOffersToCreate = Array(ITEMS_PER_PAGE)
        .fill(0)
        .map(
          (v, i) =>
          ({
            month,
            year,
            foodQnt,
            monetaryValue,
            othersQnt,
            fieldId: field.id,
          } as MonthlyOffer),
        );
      await prisma.monthlyOffer.createMany({
        data: MonthlyOffersToCreate,
      });

      const response = await monthlyOfferService.findAll({
        itemsPerPage: randomN,
      });
      expect(response.data).toHaveLength(randomN);
      expect(response.totalCount).toBe(ITEMS_PER_PAGE);
      expect(response.totalPages).toBe(
        Math.ceil(response.totalCount / randomN),
      );
    });
  });

  describe('getCollectedPeriod()', () => {
    it('Should Return Collected Period', async () => {
      const totalMonths = 12;
      const monthlyOffersToCreate = Array(totalMonths)
        .fill(0)
        .map(
          (v, i) =>
          ({
            month: i + 1,
            year,
            foodQnt,
            monetaryValue,
            othersQnt,
            fieldId: field.id,
          } as MonthlyOffer),
        );
      await prisma.monthlyOffer.createMany({
        data: monthlyOffersToCreate,
      });

      const collectedPeriod = await monthlyOfferService.getCollectedPeriod(field.id);
      expect(collectedPeriod).toHaveProperty(String(year));
      expect(collectedPeriod[String(year)]).toHaveLength(totalMonths);
    });
  });

  describe('findOne()', () => {
    it("Should Return Null (Doesn't Exists)", async () => {
      const randomId = uuidv4();
      const MonthlyOffer = await monthlyOfferService.findOne(randomId);

      expect(MonthlyOffer).toBeNull();
    });

    it('Should Return a Monthly Offer', async () => {
      const MonthlyOfferCreated = await createMonthlyOffer(
        month,
        year,
        foodQnt,
        monetaryValue,
        othersQnt,
        field.id,
      );

      const MonthlyOffer = await monthlyOfferService.findOne(
        MonthlyOfferCreated.id,
      );
      expect(MonthlyOffer.month).toBe(month);
      expect(MonthlyOffer.year).toBe(year);
      expect(MonthlyOffer.foodQnt).toBe(foodQnt);
      expect(MonthlyOffer.monetaryValue).toBe(monetaryValue);
      expect(MonthlyOffer.othersQnt).toBe(othersQnt);
    });
  });

  describe('update()', () => {
    it('Should Not Update a Monthly Offer (Not Found as USER)', async () => {
      try {
        const randomId = uuidv4();
        await monthlyOfferService.update(randomId, user, { foodQnt: 2 });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('oferta mensal', 'a'),
        );
      }
    });

    it('Should Not Update a Monthly Offer (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await monthlyOfferService.update(randomId, admin, { foodQnt: 2 });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('oferta mensal', 'a'),
        );
      }
    });

    it('Should Not Update a Monthly Offer (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await monthlyOfferService.update(randomId, webMaster, { foodQnt: 2 });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('oferta mensal', 'a'),
        );
      }
    });

    it('Should Not Update a Monthly Offer (Differente Field as USER)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const MonthlyOffer = await createMonthlyOffer(
          month,
          year,
          foodQnt,
          monetaryValue,
          othersQnt,
          differentField.id,
        );
        await monthlyOfferService.update(MonthlyOffer.id, user, {
          foodQnt: 2,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Not Update a Monthly Offer (Differente Field as ADMIN)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const MonthlyOffer = await createMonthlyOffer(
          month,
          year,
          foodQnt,
          monetaryValue,
          othersQnt,
          differentField.id,
        );
        await monthlyOfferService.update(MonthlyOffer.id, admin, {
          foodQnt: 2,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Update a Monthly Offer (as USER)', async () => {
      const MonthlyOffer = await createMonthlyOffer(
        month,
        year,
        foodQnt,
        monetaryValue,
        othersQnt,
        field.id,
      );
      const newFoodQnt = 3;

      const MonthlyOfferUpdated = await monthlyOfferService.update(
        MonthlyOffer.id,
        user,
        {
          foodQnt: newFoodQnt,
        },
      );
      expect(MonthlyOfferUpdated).toBeDefined();
      expect(MonthlyOfferUpdated.foodQnt).toBe(newFoodQnt);
    });

    it('Should Update a Monthly Offer (as ADMIN)', async () => {
      const MonthlyOffer = await createMonthlyOffer(
        month,
        year,
        foodQnt,
        monetaryValue,
        othersQnt,
        field.id,
      );
      const newFoodQnt = 3;

      const MonthlyOfferUpdated = await monthlyOfferService.update(
        MonthlyOffer.id,
        admin,
        {
          foodQnt: newFoodQnt,
        },
      );
      expect(MonthlyOfferUpdated).toBeDefined();
      expect(MonthlyOfferUpdated.foodQnt).toBe(newFoodQnt);
    });

    it('Should Update a Monthly Offer (as WEB MASTER)', async () => {
      const differentField = await createField(
        prisma,
        'América',
        'Brasil',
        'São Paulo',
        'AMEBRSP01',
        'Designação',
      );
      const MonthlyOffer = await createMonthlyOffer(
        month,
        year,
        foodQnt,
        monetaryValue,
        othersQnt,
        field.id,
      );
      const newFoodQnt = 5;

      const MonthlyOfferUpdated = await monthlyOfferService.update(
        MonthlyOffer.id,
        webMaster,
        {
          foodQnt: newFoodQnt,
          field: differentField.id,
        },
      );
      expect(MonthlyOfferUpdated).toBeDefined();
      expect(MonthlyOfferUpdated.foodQnt).toBe(newFoodQnt);
      expect(MonthlyOfferUpdated.fieldId).toBe(differentField.id);
    });
  });

  describe('remove()', () => {
    it('Should Not Remove a Monthly Offer (Not Found as USER)', async () => {
      try {
        const randomId = uuidv4();
        await monthlyOfferService.remove(randomId, user);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('oferta mensal', 'a'),
        );
      }
    });

    it('Should Not Remove a Monthly Offer (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await monthlyOfferService.remove(randomId, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('oferta mensal', 'a'),
        );
      }
    });

    it('Should Not Remove a Monthly Offer (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await monthlyOfferService.remove(randomId, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('oferta mensal', 'a'),
        );
      }
    });

    it('Should Not Remove a Monthly Offer (Different Field as USER)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const MonthlyOffer = await createMonthlyOffer(
          month,
          year,
          foodQnt,
          monetaryValue,
          othersQnt,
          differentField.id,
        );
        await monthlyOfferService.remove(MonthlyOffer.id, user);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Not Remove a Monthly Offer (Different Field as ADMIN)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const MonthlyOffer = await createMonthlyOffer(
          month,
          year,
          foodQnt,
          monetaryValue,
          othersQnt,
          differentField.id,
        );
        await monthlyOfferService.remove(MonthlyOffer.id, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Remove a Monthly Offer (as USER)', async () => {
      const MonthlyOffer = await createMonthlyOffer(
        month,
        year,
        foodQnt,
        monetaryValue,
        othersQnt,
        field.id,
      );

      await monthlyOfferService.remove(MonthlyOffer.id, user);
      const isMonthlyOfferDeleted = await prisma.monthlyOffer.findFirst(
        {
          where: {
            id: MonthlyOffer.id,
            deleted: { lte: new Date() },
          },
        },
      );
      expect(isMonthlyOfferDeleted.deleted).toBeDefined();
    });

    it('Should Remove a Monthly Offer (as ADMIN)', async () => {
      const MonthlyOffer = await createMonthlyOffer(
        month,
        year,
        foodQnt,
        monetaryValue,
        othersQnt,
        field.id,
      );

      await monthlyOfferService.remove(MonthlyOffer.id, admin);
      const isMonthlyOfferDeleted = await prisma.monthlyOffer.findFirst(
        {
          where: {
            id: MonthlyOffer.id,
            deleted: { lte: new Date() },
          },
        },
      );
      expect(isMonthlyOfferDeleted.deleted).toBeDefined();
    });

    it('Should Remove a Monthly Offer (as WEB MASTER)', async () => {
      const MonthlyOffer = await createMonthlyOffer(
        month,
        year,
        foodQnt,
        monetaryValue,
        othersQnt,
        field.id,
      );

      await monthlyOfferService.remove(MonthlyOffer.id, webMaster);
      const isMonthlyOfferDeleted = await prisma.monthlyOffer.findFirst(
        {
          where: {
            id: MonthlyOffer.id,
            deleted: { lte: new Date() },
          },
        },
      );
      expect(isMonthlyOfferDeleted.deleted).toBeDefined();
    });
  });

  describe('restore()', () => {
    it('Should Not Restore a Monthly Offer (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await monthlyOfferService.restore({ ids: [randomId] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('oferta mensal', 'a'),
        );
      }
    });

    it('Should Not Restore a Monthly Offer (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await monthlyOfferService.restore({ ids: [randomId] }, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('oferta mensal', 'a'),
        );
      }
    });

    it('Should Not Restore a Monthly Offer (Different Field as ADMIN)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const MonthlyOffer = await createMonthlyOffer(
          month,
          year,
          foodQnt,
          monetaryValue,
          othersQnt,
          differentField.id,
        );
        await prisma.monthlyOffer.delete({ where: { id: MonthlyOffer.id } });
        await monthlyOfferService.restore({ ids: [MonthlyOffer.id] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Restore a Monthly Offer (as ADMIN)', async () => {
      const MonthlyOffer = await createMonthlyOffer(
        month,
        year,
        foodQnt,
        monetaryValue,
        othersQnt,
        field.id,
      );
      await prisma.monthlyOffer.delete({
        where: { id: MonthlyOffer.id },
      });

      await monthlyOfferService.restore({ ids: [MonthlyOffer.id] }, admin);
      const isMonthlyOfferRestored =
        await prisma.monthlyOffer.findFirst({
          where: {
            id: MonthlyOffer.id,
          },
        });

      expect(isMonthlyOfferRestored.deleted).toBeNull();
    });

    it('Should Restore a Monthly Offer (as WEB MASTER)', async () => {
      const MonthlyOffer = await createMonthlyOffer(
        month,
        year,
        foodQnt,
        monetaryValue,
        othersQnt,
        field.id,
      );
      await prisma.monthlyOffer.delete({
        where: { id: MonthlyOffer.id },
      });

      await monthlyOfferService.restore({ ids: [MonthlyOffer.id] }, webMaster);
      const isMonthlyOfferRestored =
        await prisma.monthlyOffer.findFirst({
          where: {
            id: MonthlyOffer.id,
          },
        });

      expect(isMonthlyOfferRestored.deleted).toBeNull();
    });
  });

  describe('hardRemove()', () => {
    it('Should Not Hard Remove a Monthly Offer (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await monthlyOfferService.hardRemove({ ids: [randomId] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('oferta mensal', 'a'),
        );
      }
    });

    it('Should Not Hard Remove a Monthly Offer (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await monthlyOfferService.hardRemove({ ids: [randomId] }, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('oferta mensal', 'a'),
        );
      }
    });

    it('Should Not Hard Remove a Monthly Offer (Different Field as ADMIN)', async () => {
      try {
        const differentField = await createField(
          prisma,
          'América',
          'Brasil',
          'São Paulo',
          'AMEBRSP01',
          'Designação',
        );
        const MonthlyOffer = await createMonthlyOffer(
          month,
          year,
          foodQnt,
          monetaryValue,
          othersQnt,
          differentField.id,
        );
        await prisma.monthlyOffer.delete({ where: { id: MonthlyOffer.id } });
        await monthlyOfferService.hardRemove({ ids: [MonthlyOffer.id] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Hard Remove a Monthly Offer (as ADMIN)', async () => {
      const MonthlyOffer = await createMonthlyOffer(
        month,
        year,
        foodQnt,
        monetaryValue,
        othersQnt,
        field.id,
      );
      await prisma.monthlyOffer.delete({
        where: { id: MonthlyOffer.id },
      });

      await monthlyOfferService.hardRemove({ ids: [MonthlyOffer.id] }, admin);
      const isMonthlyOfferRemoved = await prisma.monthlyOffer.findFirst(
        {
          where: {
            id: MonthlyOffer.id,
            deleted: { not: new Date() },
          },
        },
      );
      expect(isMonthlyOfferRemoved).toBeNull();
    });

    it('Should Hard Remove a Monthly Offer (as WEB MASTER)', async () => {
      const MonthlyOffer = await createMonthlyOffer(
        month,
        year,
        foodQnt,
        monetaryValue,
        othersQnt,
        field.id,
      );
      await prisma.monthlyOffer.delete({
        where: { id: MonthlyOffer.id },
      });

      await monthlyOfferService.hardRemove({ ids: [MonthlyOffer.id] }, webMaster);
      const isMonthlyOfferRemoved = await prisma.monthlyOffer.findFirst(
        {
          where: {
            id: MonthlyOffer.id,
            deleted: { not: new Date() },
          },
        },
      );
      expect(isMonthlyOfferRemoved).toBeNull();
    });
  });
});
