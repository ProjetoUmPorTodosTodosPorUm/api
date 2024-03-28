import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Query } from '@nestjs/common'
import { User, Prisma } from '@prisma/client'
import { MESSAGE, TEMPLATE } from 'src/constants'
import { PaginationDto } from 'src/prisma/dto'
import { PrismaService } from 'src/prisma/prisma.service'
import { HardRemoveDto, RestoreDto } from 'src/utils'
import { CreateVolunteerDto, UpdateVolunteerDto } from './dto'

@Injectable()
export class VolunteerService {
	constructor(private readonly prismaService: PrismaService) {}

	async create(user: User, createVolunteerDto: CreateVolunteerDto) {
		let dataObj = {}

		if (user.role !== 'WEB_MASTER') {
			dataObj = {
				...createVolunteerDto,
				field: {
					connect: {
						id: user.fieldId,
					},
				},
			}
		} else {
			if (!createVolunteerDto.field) {
				throw new BadRequestException({
					message: TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'),
					data: {},
				})
			}

			dataObj = {
				...createVolunteerDto,
				field: {
					connect: {
						id: createVolunteerDto.field,
					},
				},
			}
		}

		return await this.prismaService.volunteer.create({
			data: dataObj as any,
			include: { field: true },
		})
	}

	async findAll(@Query() query?: PaginationDto) {
		return await this.prismaService.paginatedQuery('volunteer', query, {
			searchKeys: ['firstName', 'lastName', 'email', 'church', 'priest'],
		})
	}

	async findOne(id: string) {
		return await this.prismaService.volunteer.findUnique({
			where: { id },
		})
	}

	async update(id: string, user: User, updateVolunteerDto: UpdateVolunteerDto) {
		try {
			if (user.role !== 'WEB_MASTER') {
				const volunteer = await this.prismaService.volunteer.findFirst({
					where: { id },
				})

				if (!volunteer) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('voluntário', 'o'),
						data: {},
					})
				} else if (volunteer.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
				delete updateVolunteerDto.field
			} else {
				if (updateVolunteerDto.field) {
					updateVolunteerDto.field = {
						connect: { id: updateVolunteerDto.field },
					} as any
				} else {
					delete updateVolunteerDto.field
				}
			}

			return await this.prismaService.volunteer.update({
				where: { id },
				data: updateVolunteerDto as any,
				include: {
					field: true,
				},
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('voluntário', 'o'),
						data: {},
					})
				}
			}
			throw error
		}
	}

	async remove(id: string, user: User) {
		try {
			if (user.role !== 'WEB_MASTER') {
				const volunteer = await this.prismaService.volunteer.findFirst({
					where: { id },
				})

				if (!volunteer) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('voluntário', 'o'),
						data: {},
					})
				} else if (volunteer.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.volunteer.delete({
				where: { id },
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('voluntário', 'o'),
						data: {},
					})
				}
			}
			throw error
		}
	}

	async restore(restoreDto: RestoreDto, user: User) {
		try {
			if (user.role !== 'WEB_MASTER') {
				const findManyQuery = this.prismaService.volunteer.findMany({
					where: {
						id: { in: restoreDto.ids },
					},
				})
				const [volunteers] = await this.prismaService.$transaction([findManyQuery])

				if (!volunteers) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('voluntários', 'o'),
						data: {},
					})
				} else if (volunteers.some((volunteer) => volunteer.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.volunteer.updateMany({
				data: {
					deleted: null,
				},
				where: {
					id: { in: restoreDto.ids },
				},
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('voluntário', 'o'),
						data: {},
					})
				}
			}
			throw error
		}
	}

	async hardRemove(hardRemoveDto: HardRemoveDto, user: User) {
		try {
			if (user.role !== 'WEB_MASTER') {
				const findManyQuery = this.prismaService.volunteer.findMany({
					where: {
						id: { in: hardRemoveDto.ids },
					},
				})
				const [volunteers] = await this.prismaService.$transaction([findManyQuery])

				if (!volunteers) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('voluntários', 'o'),
						data: {},
					})
				} else if (volunteers.some((volunteer) => volunteer.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			const deleteQuery = this.prismaService.volunteer.deleteMany({
				where: {
					id: { in: hardRemoveDto.ids },
				},
			})
			const [result] = await this.prismaService.$transaction([deleteQuery])
			return result
		} catch (error) {
			throw error
		}
	}
}
