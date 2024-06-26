import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Query } from '@nestjs/common'
import { User, Prisma } from '@prisma/client'
import { MESSAGE, TEMPLATE } from 'src/constants'
import { PaginationDto } from 'src/prisma/dto'
import { PrismaService } from 'src/prisma/prisma.service'
import { HardRemoveDto, RestoreDto } from 'src/utils'
import { CreateChurchDto, UpdateChurchDto } from './dto'

@Injectable()
export class ChurchService {
	constructor(private readonly prismaService: PrismaService) {}

	async create(user: User, createChurchDto: CreateChurchDto) {
		let dataObj = {}

		if (user.role !== 'WEB_MASTER') {
			dataObj = {
				...createChurchDto,
				field: {
					connect: {
						id: user.fieldId,
					},
				},
			}
		} else {
			if (!createChurchDto.field) {
				throw new BadRequestException({
					message: TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'),
					data: {},
				})
			}

			dataObj = {
				...createChurchDto,
				field: {
					connect: {
						id: createChurchDto.field,
					},
				},
			}
		}

		return await this.prismaService.church.create({
			data: dataObj as any,
		})
	}

	async findAll(@Query() query?: PaginationDto) {
		return await this.prismaService.paginatedQuery('church', query, {
			searchKeys: ['name', 'description'],
		})
	}

	async findOne(id: string) {
		return await this.prismaService.church.findUnique({
			where: { id },
		})
	}

	async update(id: string, user: User, updateChurchDto: UpdateChurchDto) {
		try {
			if (user.role !== 'WEB_MASTER') {
				const church = await this.prismaService.church.findFirst({
					where: { id },
				})

				if (!church) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('igreja', 'a'),
						data: {},
					})
				} else if (church.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
				delete updateChurchDto.field
			} else {
				if (updateChurchDto.field) {
					updateChurchDto.field = {
						connect: { id: updateChurchDto.field },
					} as any
				} else {
					delete updateChurchDto.field
				}
			}

			return await this.prismaService.church.update({
				where: { id },
				data: updateChurchDto as any,
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('igreja', 'a'),
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
				const church = await this.prismaService.church.findFirst({
					where: { id },
				})

				if (!church) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('igreja', 'a'),
						data: {},
					})
				} else if (church.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.church.delete({
				where: { id },
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('igreja', 'a'),
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
				const findManyQuery = this.prismaService.church.findMany({
					where: {
						id: { in: restoreDto.ids },
					},
				})
				const [churches] = await this.prismaService.$transaction([findManyQuery])

				if (!churches) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('igrejas', 'a'),
						data: {},
					})
				} else if (churches.some((church) => church.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.church.updateMany({
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
						message: TEMPLATE.EXCEPTION.NOT_FOUND('igreja', 'a'),
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
				const findManyQuery = this.prismaService.church.findMany({
					where: {
						id: { in: hardRemoveDto.ids },
					},
				})
				const [churches] = await this.prismaService.$transaction([findManyQuery])

				if (!churches) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('igrejas', 'a'),
						data: {},
					})
				} else if (churches.some((church) => church.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			const deleteQuery = this.prismaService.church.deleteMany({
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
