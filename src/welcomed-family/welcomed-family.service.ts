import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Query } from '@nestjs/common'
import { User, Prisma } from '@prisma/client'
import { MESSAGE, TEMPLATE } from 'src/constants'
import { PaginationDto } from 'src/prisma/dto'
import { PrismaService } from 'src/prisma/prisma.service'
import { HardRemoveDto, RestoreDto } from 'src/utils'
import { CreateWelcomedFamilyDto, UpdateWelcomedFamilyDto } from './dto'

@Injectable()
export class WelcomedFamilyService {
	constructor(private readonly prismaService: PrismaService) {}

	async create(user: User, createWelcomedFamilyDto: CreateWelcomedFamilyDto) {
		let dataObj = {}

		if (user.role !== 'WEB_MASTER') {
			dataObj = {
				...createWelcomedFamilyDto,
				field: {
					connect: {
						id: user.fieldId,
					},
				},
			}
		} else {
			if (!createWelcomedFamilyDto.field) {
				throw new BadRequestException({
					message: TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'),
					data: {},
				})
			}

			dataObj = {
				...createWelcomedFamilyDto,
				field: {
					connect: {
						id: createWelcomedFamilyDto.field,
					},
				},
			}
		}

		return await this.prismaService.welcomedFamily.create({
			data: dataObj as any,
		})
	}

	async findAll(@Query() query?: PaginationDto) {
		return await this.prismaService.paginatedQuery('welcomedFamily', query, {
			searchKeys: ['representative'],
		})
	}

	async findOne(id: string) {
		return await this.prismaService.welcomedFamily.findUnique({
			where: { id },
		})
	}

	async update(id: string, user: User, updateWelcomedFamilyDto: UpdateWelcomedFamilyDto) {
		try {
			if (user.role !== 'WEB_MASTER') {
				const event = await this.prismaService.welcomedFamily.findFirst({
					where: { id },
				})

				if (!event) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('família acolhida', 'a'),
						data: {},
					})
				} else if (event.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
				delete updateWelcomedFamilyDto.field
			} else {
				if (updateWelcomedFamilyDto.field) {
					updateWelcomedFamilyDto.field = {
						connect: { id: updateWelcomedFamilyDto.field },
					} as any
				} else {
					delete updateWelcomedFamilyDto.field
				}
			}

			return await this.prismaService.welcomedFamily.update({
				where: { id },
				data: updateWelcomedFamilyDto as any,
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('família acolhida', 'a'),
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
				const event = await this.prismaService.welcomedFamily.findFirst({
					where: { id },
				})

				if (!event) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('família acolhida', 'a'),
						data: {},
					})
				} else if (event.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.welcomedFamily.delete({
				where: { id },
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('família acolhida', 'a'),
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
				const findManyQuery = this.prismaService.welcomedFamily.findMany({
					where: {
						id: { in: restoreDto.ids },
					},
				})
				const [welcomedFamilies] = await this.prismaService.$transaction([findManyQuery])

				if (!welcomedFamilies) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('famílias acolhidas', 'a'),
						data: {},
					})
				} else if (welcomedFamilies.some((welcomedFamiliy) => welcomedFamiliy.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.welcomedFamily.updateMany({
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
						message: TEMPLATE.EXCEPTION.NOT_FOUND('família acolhida', 'a'),
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
				const findManyQuery = this.prismaService.welcomedFamily.findMany({
					where: {
						id: { in: hardRemoveDto.ids },
					},
				})
				const [welcomedFamilies] = await this.prismaService.$transaction([findManyQuery])

				if (!welcomedFamilies) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('famílias acolhidas', 'a'),
						data: {},
					})
				} else if (welcomedFamilies.some((welcomedFamiliy) => welcomedFamiliy.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			const deleteQuery = this.prismaService.welcomedFamily.deleteMany({
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
