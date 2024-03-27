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
import { CreateTestimonialDto, UpdateTestimonialDto } from './dto';

@Injectable()
export class TestimonialService {
  constructor(private readonly prismaService: PrismaService) { }

  async create(user: User, createTestimonialDto: CreateTestimonialDto) {
    let dataObj = {};

    if (user.role !== 'WEB_MASTER') {
      dataObj = {
        ...createTestimonialDto,
        field: {
          connect: {
            id: user.fieldId,
          },
        },
      };
    } else {
      if (!createTestimonialDto.field) {
        throw new BadRequestException({
          message: TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'),
          data: {},
        });
      }

      dataObj = {
        ...createTestimonialDto,
        field: {
          connect: {
            id: createTestimonialDto.field,
          },
        },
      };
    }

    return await this.prismaService.testimonial.create({
      data: dataObj as any,
    });
  }

  async findAll(@Query() query?: PaginationDto) {
    return await this.prismaService.paginatedQuery('testimonial', query, {
      searchKeys: ['name', 'email', 'text']
    });
  }

  async findOne(id: string) {
    return await this.prismaService.testimonial.findUnique({
      where: { id },
    });
  }

  async update(
    id: string,
    user: User,
    updateTestimonialDto: UpdateTestimonialDto,
  ) {
    try {
      if (user.role !== 'WEB_MASTER') {
        const testimonial = await this.prismaService.testimonial.findFirst({
          where: { id },
        });

        if (!testimonial) {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'),
            data: {},
          });
        } else if (testimonial.fieldId !== user.fieldId) {
          throw new ForbiddenException({
            message: MESSAGE.EXCEPTION.FORBIDDEN,
            data: {},
          });
        }
        delete updateTestimonialDto.field;
      } else {
        if (updateTestimonialDto.field) {
          updateTestimonialDto.field = {
            connect: { id: updateTestimonialDto.field },
          } as any;
        } else {
          delete updateTestimonialDto.field;
        }
      }

      return await this.prismaService.testimonial.update({
        where: { id },
        data: updateTestimonialDto as any,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'),
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
        const testimonial = await this.prismaService.testimonial.findFirst({
          where: { id },
        });

        if (!testimonial) {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'),
            data: {},
          });
        } else if (testimonial.fieldId !== user.fieldId) {
          throw new ForbiddenException({
            message: MESSAGE.EXCEPTION.FORBIDDEN,
            data: {},
          });
        }
      }

      return await this.prismaService.testimonial.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'),
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
        const findManyQuery = this.prismaService.testimonial.findMany({
          where: {
            id: { in: restoreDto.ids }
          },
        });
        const [testimonials] = await this.prismaService.$transaction([findManyQuery]);

        if (!testimonials) {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('testemunhos', 'o'),
            data: {},
          });
        } else if (testimonials.some(testimonial => testimonial.fieldId !== user.fieldId)) {
          throw new ForbiddenException({
            message: MESSAGE.EXCEPTION.FORBIDDEN,
            data: {},
          });
        }
      }

      return await this.prismaService.testimonial.updateMany({
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
            message: TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'),
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
        const findManyQuery = this.prismaService.testimonial.findMany({
          where: {
            id: { in: hardRemoveDto.ids }
          },
        });
        const [testimonials] = await this.prismaService.$transaction([findManyQuery]);

        if (!testimonials) {
          throw new NotFoundException({
            message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('testemunhos', 'o'),
            data: {},
          });
        } else if (testimonials.some(testimonial => testimonial.fieldId !== user.fieldId)) {
          throw new ForbiddenException({
            message: MESSAGE.EXCEPTION.FORBIDDEN,
            data: {},
          });
        }
      }

      const deleteQuery = this.prismaService.testimonial.deleteMany({
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
