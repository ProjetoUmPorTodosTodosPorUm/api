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
import { FindByRangeDto, HardRemoveDto, RestoreDto } from 'src/utils';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto';

@Injectable()
export class AnnouncementService {
  constructor(private readonly prismaService: PrismaService) { }

  async create(user: User, createAnnouncementDto: CreateAnnouncementDto) {
    let dataObj = {};

    if (user.role !== 'WEB_MASTER') {
      dataObj = {
        ...createAnnouncementDto,
        field: {
          connect: {
            id: user.fieldId,
          },
        },
      };
    } else {
      if (!createAnnouncementDto.field) {
        throw new BadRequestException({
          message: TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'),
          data: {},
        });
      }

      dataObj = {
        ...createAnnouncementDto,
        field: {
          connect: {
            id: createAnnouncementDto.field,
          },
        },
      };
    }

    return await this.prismaService.announcement.create({
      data: dataObj as any,
    });
  }

  async findAll(@Query() query?: PaginationDto) {
    return await this.prismaService.paginatedQuery('announcement', query, {
      searchKeys: ['title', 'message']
    });
  }

  async findByRange(@Query() query: FindByRangeDto) {
    return await this.prismaService.announcement.findMany({
      where: {
        OR: [
          {
            createdAt: {
              lte: query.lte,
              gte: query.gte,
            }
          },
          {
            fixed: true,
          }
        ]
      },
      orderBy: [
        { fixed: 'desc' },
        { createdAt: 'desc' }
      ]
    })
  }

  async findOne(id: string) {
    return await this.prismaService.announcement.findUnique({
      where: { id },
    });
  }

  async update(
    id: string,
    user: User,
    updateAnnouncementDto: UpdateAnnouncementDto,
  ) {
    try {
      if (user.role !== 'WEB_MASTER') {
        const announcement = await this.prismaService.announcement.findFirst({
          where: { id },
        });

        if (!announcement) {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND('anúncio', 'o'),
            data: {},
          });
        } else if (announcement.fieldId !== user.fieldId) {
          throw new ForbiddenException({
            message: MESSAGE.EXCEPTION.FORBIDDEN,
            data: {},
          });
        }
        delete updateAnnouncementDto.field;
      } else {
        if (updateAnnouncementDto.field) {
          updateAnnouncementDto.field = {
            connect: { id: updateAnnouncementDto.field },
          } as any;
        } else {
          delete updateAnnouncementDto.field;
        }
      }

      return await this.prismaService.announcement.update({
        where: { id },
        data: updateAnnouncementDto as any,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND('anúncio', 'o'),
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
        const announcement = await this.prismaService.announcement.findFirst({
          where: { id },
        });

        if (!announcement) {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND('anúncio', 'o'),
            data: {},
          });
        } else if (announcement.fieldId !== user.fieldId) {
          throw new ForbiddenException({
            message: MESSAGE.EXCEPTION.FORBIDDEN,
            data: {},
          });
        }
      }

      return await this.prismaService.announcement.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND('anúncio', 'o'),
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
        const findManyQuery = this.prismaService.announcement.findMany({
          where: {
            id: { in: restoreDto.ids }
          },
        });
        const [announcements] = await this.prismaService.$transaction([findManyQuery]);

        if (!announcements) {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('anúncios', 'o'),
            data: {},
          });
        } else if (announcements.some(announcement => announcement.fieldId !== user.fieldId)) {
          throw new ForbiddenException({
            message: MESSAGE.EXCEPTION.FORBIDDEN,
            data: {},
          });
        }
      }

      return await this.prismaService.announcement.updateMany({
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
            message: TEMPLATE.EXCEPTION.NOT_FOUND('anúncio', 'o'),
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
        const findManyQuery = this.prismaService.announcement.findMany({
          where: {
            id: { in: hardRemoveDto.ids }
          },
        });
        const [announcements] = await this.prismaService.$transaction([findManyQuery]);

        if (!announcements) {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('anúncios', 'o'),
            data: {},
          });
        } else if (announcements.some(announcement => announcement.fieldId !== user.fieldId)) {
          throw new ForbiddenException({
            message: MESSAGE.EXCEPTION.FORBIDDEN,
            data: {},
          });
        }
      }

      const deleteQuery = this.prismaService.announcement.deleteMany({
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
