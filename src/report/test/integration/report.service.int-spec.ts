import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Field, Report, ReportType, Role, User } from '@prisma/client';
import { ITEMS_PER_PAGE, MESSAGE, TEMPLATE } from 'src/constants';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReportService } from 'src/report/report.service';
import { createField, createUser } from 'src/utils/test';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

import { ConfigModule } from '@nestjs/config';
import configuration from 'src/config/configuration';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/user/user.module';
import { FieldModule } from 'src/field/field.module';
import { ReportModule } from 'src/report/report.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from 'src/response.interceptor';

describe('Report Service Integration', () => {
  let prisma: PrismaService;
  let reportService: ReportService;

  let field: Field;
  let user: User;
  let admin: User;
  let webMaster: User;

  const password = '12345678';
  const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync());

  const title = 'Título';
  const shortDescription = 'Descrição';
  const month = 1;
  const year = 2010;
  const type = ReportType.ORDINARY;
  const attachments = ['file.pdf'];

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
        type,
        attachments
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

    prisma = moduleRef.get(PrismaService);
    reportService = moduleRef.get(ReportService);

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
    it('Should Create a Report (as USER)', async () => {
      const report = await reportService.create(user, {
        title,
        shortDescription,
        month,
        year,
        type,
        attachments
      });

      expect(report.title).toBe(title);
      expect(report.shortDescription).toBe(shortDescription);
      expect(report.month).toBe(month);
      expect(report.year).toBe(year);
      expect(report.fieldId).toBe(field.id);
    });

    it('Should Create a Report (as ADMIN)', async () => {
      const report = await reportService.create(admin, {
        title,
        shortDescription,
        month,
        year,
        type,
        attachments
      });

      expect(report.title).toBe(title);
      expect(report.shortDescription).toBe(shortDescription);
      expect(report.month).toBe(month);
      expect(report.year).toBe(year);
      expect(report.fieldId).toBe(field.id);
    });

    it('Should NOT Create a Report (as WEB MASTER && Missing Data)', async () => {
      try {
        await reportService.create(webMaster, {
          title,
          shortDescription,
          month,
          year,
          type,
          attachments
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.response.message).toBe(
          TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'),
        );
      }
    });

    it('Should Create a Report (as WEB MASTER)', async () => {
      const report = await reportService.create(webMaster, {
        title,
        shortDescription,
        month,
        year,
        field: field.id,
        type,
        attachments
      });

      expect(report.title).toBe(title);
      expect(report.shortDescription).toBe(shortDescription);
      expect(report.month).toBe(month);
      expect(report.year).toBe(year);
      expect(report.fieldId).toBe(field.id);
    });
  });

  describe('findAll()', () => {
    it('Should Return an Empty Array', async () => {
      const response = await reportService.findAll();

      expect(response.data).toHaveLength(0);
      expect(response.totalCount).toBe(0);
      expect(response.totalPages).toBe(0);
    });

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
            attachments: [`file-${i}.pdf`]
          } as Report),
        );
      await prisma.report.createMany({
        data: reportsToCreate,
      });

      const response = await reportService.findAll();
      expect(response.data).toHaveLength(ITEMS_PER_PAGE);
      expect(response.totalCount).toBe(ITEMS_PER_PAGE);
      expect(response.totalPages).toBe(1);
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
            attachments: [`file-${i}.pdf`]
          } as Report),
        );
      await prisma.report.createMany({
        data: reportsToCreate,
      });

      const response = await reportService.findAll({
        itemsPerPage: randomN,
      });
      expect(response.data).toHaveLength(randomN);
      expect(response.totalCount).toBe(ITEMS_PER_PAGE);
      expect(response.totalPages).toBe(
        Math.ceil(response.totalCount / randomN),
      );
    });
  });

  describe('getReportedYears()', () => {
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
            attachments: [`file-${i}.pdf`]
          } as Report),
        );
      await prisma.report.createMany({
        data: reportsToCreate,
      });

      const response = await reportService.getReportedYears(field.id);
      expect(response).toStrictEqual(years);
    })
  });

  describe('findOne()', () => {
    it("Should Return Null (Doesn't Exists)", async () => {
      const randomId = uuidv4();
      const report = await reportService.findOne(randomId);

      expect(report).toBeNull();
    });

    it('Should Return a Report', async () => {
      const reportCreated = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );

      const report = await reportService.findOne(reportCreated.id);
      expect(report).toBeDefined();
    });
  });

  describe('update()', () => {
    it('Should Not Update a Report (Not Found as USER)', async () => {
      try {
        const randomId = uuidv4();
        await reportService.update(randomId, user, { title: 'lol', attachments });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('relatório', 'o'),
        );
      }
    });

    it('Should Not Update a Report (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await reportService.update(randomId, admin, { title: 'lol', attachments });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('relatório', 'o'),
        );
      }
    });

    it('Should Not Update a Report (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await reportService.update(randomId, webMaster, { title: 'lol', attachments });
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('relatório', 'o'),
        );
      }
    });

    it('Should Not Update a Report (Different Field as USER)', async () => {
      try {
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
        await reportService.update(report.id, user, { title: 'lol', attachments });
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Not Update a Report (Different Field as ADMIN)', async () => {
      try {
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
        await reportService.update(report.id, admin, { title: 'lol', attachments });
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Update a Report (as USER)', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      const newTitle = 'Abreu';

      const reportUpdated = await reportService.update(report.id, user, {
        title: newTitle,
        attachments
      });
      expect(reportUpdated).toBeDefined();
      expect(reportUpdated.title).toBe(newTitle);
    });

    it('Should Update a Report (as ADMIN)', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      const newTitle = 'Abreu';

      const reportUpdated = await reportService.update(report.id, admin, {
        title: newTitle,
        attachments
      });
      expect(reportUpdated).toBeDefined();
      expect(reportUpdated.title).toBe(newTitle);
    });

    it('Should Update a Report (as WEB MASTER)', async () => {
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
        field.id,
      );
      const newTitle = 'Abreu';

      const reportUpdated = await reportService.update(report.id, webMaster, {
        title: newTitle,
        field: differentField.id,
        attachments
      });
      expect(reportUpdated).toBeDefined();
      expect(reportUpdated.title).toBe(newTitle);
      expect(reportUpdated.fieldId).toBe(differentField.id);
    });
  });

  describe('remove()', () => {
    it('Should Not Remove a Report (Not Found as USER)', async () => {
      try {
        const randomId = uuidv4();
        await reportService.remove(randomId, user);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('relatório', 'o'),
        );
      }
    });

    it('Should Not Remove a Report (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await reportService.remove(randomId, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('relatório', 'o'),
        );
      }
    });

    it('Should Not Remove a Report (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await reportService.remove(randomId, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('relatório', 'o'),
        );
      }
    });

    it('Should Not Remove a Report (Different Field as USER)', async () => {
      try {
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
        await reportService.remove(report.id, user);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Not Remove a Report (Different Field as ADMIN)', async () => {
      try {
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
        await reportService.remove(report.id, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Remove a Report (as USER)', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await reportService.remove(report.id, user);

      const isReportDeleted = await prisma.report.findFirst({
        where: {
          id: report.id,
          deleted: { lte: new Date() },
        },
      });
      expect(isReportDeleted.deleted).toBeDefined();
    });

    it('Should Remove a Report (as ADMIN)', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await reportService.remove(report.id, admin);

      const isReportDeleted = await prisma.report.findFirst({
        where: {
          id: report.id,
          deleted: { lte: new Date() },
        },
      });
      expect(isReportDeleted.deleted).toBeDefined();
    });

    it('Should Remove a Report (as WEB MASTER)', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await reportService.remove(report.id, webMaster);

      const isReportDeleted = await prisma.report.findFirst({
        where: {
          id: report.id,
          deleted: { lte: new Date() },
        },
      });
      expect(isReportDeleted.deleted).toBeDefined();
    });
  });

  describe('restore()', () => {
    it('Should Not Restore a Report (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await reportService.restore({ ids: [randomId] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('relatório', 'o'),
        );
      }
    });

    it('Should Not Restore a Report (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await reportService.restore(randomId, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('relatório', 'o'),
        );
      }
    });

    it('Should Not Restore a Report (Different Field as ADMIN)', async () => {
      try {
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
        await reportService.restore({ ids: [report.id] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Restore a Report (as ADMIN)', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await prisma.report.delete({ where: { id: report.id } });

      await reportService.restore({ ids: [report.id] }, admin);
      const isReportRestored = await prisma.report.findFirst({
        where: {
          id: report.id,
        },
      });

      expect(isReportRestored.deleted).toBeNull();
    });

    it('Should Restore a Report (as WEB MASTER)', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await prisma.report.delete({ where: { id: report.id } });

      await reportService.restore({ ids: [report.id] }, webMaster);
      const isReportRestored = await prisma.report.findFirst({
        where: {
          id: report.id,
        },
      });

      expect(isReportRestored.deleted).toBeNull();
    });
  });

  describe('hardRemove()', () => {
    it('Should Not Hard Remove a Report (Not Found as ADMIN)', async () => {
      try {
        const randomId = uuidv4();
        await reportService.hardRemove({ ids: [randomId] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('relatório', 'o'),
        );
      }
    });

    it('Should Not Hard Remove a Report (Not Found as WEB MASTER)', async () => {
      try {
        const randomId = uuidv4();
        await reportService.hardRemove(randomId, webMaster);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.response.message).toBe(
          TEMPLATE.EXCEPTION.NOT_FOUND('relatório', 'o'),
        );
      }
    });

    it('Should Not Hard Remove a Report (Different Field as ADMIN)', async () => {
      try {
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
        await reportService.hardRemove({ ids: [report.id] }, admin);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN);
      }
    });

    it('Should Hard Remove a Report (as ADMIN)', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await prisma.report.delete({ where: { id: report.id } });

      await reportService.hardRemove({ ids: [report.id] }, admin);
      const isReportRemoved = await prisma.report.findFirst({
        where: {
          id: report.id,
          deleted: { not: new Date() },
        },
      });
      expect(isReportRemoved).toBeNull();
    });

    it('Should Hard Remove a Report (as WEB MASTER)', async () => {
      const report = await createReport(
        title,
        shortDescription,
        month,
        year,
        field.id,
      );
      await prisma.report.delete({ where: { id: report.id } });

      await reportService.hardRemove({ ids: [report.id] }, webMaster);
      const isReportRemoved = await prisma.report.findFirst({
        where: {
          id: report.id,
          deleted: { not: new Date() },
        },
      });
      expect(isReportRemoved).toBeNull();
    });
  });
});
