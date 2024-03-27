import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { User, Prisma } from '@prisma/client';
import { MESSAGE, TEMPLATE } from 'src/constants';
import { PaginationDto } from 'src/prisma/dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { HardRemoveDto, RestoreDto } from 'src/utils';
import { CreateMonthlyOfferDto, UpdateMonthlyOfferDto } from './dto';

@Injectable()
export class MonthlyOfferService {
  constructor(private readonly prismaService: PrismaService) { }

  async create(
    user: User,
    createMonthlyOfferDto: CreateMonthlyOfferDto,
  ) {
    let dataObj = {};

    if (user.role !== 'WEB_MASTER') {
      dataObj = {
        ...createMonthlyOfferDto,
        field: {
          connect: {
            id: user.fieldId,
          },
        },
      };
    } else {
      if (!createMonthlyOfferDto.field) {
        throw new BadRequestException({
          message: TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'),
          data: {},
        });
      }

      dataObj = {
        ...createMonthlyOfferDto,
        field: {
          connect: {
            id: createMonthlyOfferDto.field,
          },
        },
      };
    }

    return await this.prismaService.monthlyOffer.create({
      data: dataObj as any,
    });
  }

  async findAll(@Query() query?: PaginationDto) {
    return await this.prismaService.paginatedQuery('MonthlyOffer', query, {
      searchKeys: ['fieldId', 'year', 'month']
    });
  }

  async getCollectedPeriod(field: string) {
    const collectedPeriod = await this.prismaService.monthlyOffer.findMany({
      where: {
        fieldId: field,
      },
      select: {
        year: true,
        month: true,
      },
      distinct: ['year', 'month'],
      orderBy: [
        { year: 'asc' },
        { month: 'asc' }
      ]
    });
    return collectedPeriod.reduce((p, c) => {
      let tmp = {};
      if (p[c.year]) {
        tmp[c.year] = [...p[c.year], c.month];
      } else {
        tmp[c.year] = [c.month];
      }

      return {
        ...p,
        ...tmp
      };
    }, {})
  }

  async findOne(id: string) {
    return await this.prismaService.monthlyOffer.findUnique({
      where: { id },
    });
  }

  async update(
    id: string,
    user: User,
    updateMonthlyOfferDto: UpdateMonthlyOfferDto,
  ) {
    try {
      if (user.role !== 'WEB_MASTER') {
        const monthlyOffer = await this.prismaService.monthlyOffer.findFirst({
          where: { id },
        });

        if (!monthlyOffer) {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND('oferta mensal', 'a'),
            data: {},
          });
        } else if (monthlyOffer.fieldId !== user.fieldId) {
          throw new ForbiddenException({
            message: MESSAGE.EXCEPTION.FORBIDDEN,
            data: {},
          });
        }
        delete updateMonthlyOfferDto.field;
      } else {
        if (updateMonthlyOfferDto.field) {
          updateMonthlyOfferDto.field = {
            connect: { id: updateMonthlyOfferDto.field },
          } as any;
        } else {
          delete updateMonthlyOfferDto.field;
        }
      }

      return await this.prismaService.monthlyOffer.update({
        where: { id },
        data: updateMonthlyOfferDto as any,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND('oferta mensal', 'a'),
            data: {},
          });
        }
      }
      throw error;
    }
  }

  async remove(id: string, user: User) {
    try {
      if (user.role !== 'WEB_MASTER') {
        const monthlyOffer = await this.prismaService.monthlyOffer.findFirst({
          where: { id },
        });

        if (!monthlyOffer) {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND('oferta mensal', 'a'),
            data: {},
          });
        } else if (monthlyOffer.fieldId !== user.fieldId) {
          throw new ForbiddenException({
            message: MESSAGE.EXCEPTION.FORBIDDEN,
            data: {},
          });
        }
      }

      return await this.prismaService.monthlyOffer.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND('oferta mensal', 'a'),
            data: {},
          });
        }
      }
      throw error;
    }
  }

  async restore(restoreDto: RestoreDto, user: User) {
    try {
      if (user.role !== 'WEB_MASTER') {
        const findManyQuery = this.prismaService.monthlyOffer.findMany({
          where: {
            id: { in: restoreDto.ids }
          },
        });
        const [monthlyOffers] = await this.prismaService.$transaction([findManyQuery]);

        if (!monthlyOffers) {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('ofertas mensais', 'a'),
            data: {},
          });
        } else if (monthlyOffers.some(monthlyOffer => monthlyOffer.fieldId !== user.fieldId)) {
          throw new ForbiddenException({
            message: MESSAGE.EXCEPTION.FORBIDDEN,
            data: {},
          });
        }
      }

      return await this.prismaService.monthlyOffer.updateMany({
        data: {
          deleted: null,
        },
        where: {
          id: { in: restoreDto.ids },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND('oferta mensal', 'a'),
            data: {},
          });
        }
      }
      throw error;
    }
  }

  async hardRemove(hardRemoveDto: HardRemoveDto, user: User) {
    try {
      if (user.role !== 'WEB_MASTER') {
        const findManyQuery = this.prismaService.monthlyOffer.findMany({
          where: {
            id: { in: hardRemoveDto.ids }
          },
        });
        const [monthlyOffers] = await this.prismaService.$transaction([findManyQuery]);

        if (!monthlyOffers) {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('ofertas mensais', 'a'),
            data: {},
          });
        } else if (monthlyOffers.some(monthlyOffer => monthlyOffer.fieldId !== user.fieldId)) {
          throw new ForbiddenException({
            message: MESSAGE.EXCEPTION.FORBIDDEN,
            data: {},
          });
        }
      }

      const deleteQuery = this.prismaService.monthlyOffer.deleteMany({
        where: {
          id: { in: hardRemoveDto.ids },
        },
      });
      const [result] = await this.prismaService.$transaction([deleteQuery]);
      return result;
    } catch (error) {
      throw error;
    }
  }
}
