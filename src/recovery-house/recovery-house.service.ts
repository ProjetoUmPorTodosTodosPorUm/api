import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Query } from '@nestjs/common'
import { CreateRecoveryHouseDto, UpdateRecoveryHouseDto } from './dto'
import { PrismaService } from 'src/prisma/prisma.service'
import { Prisma, User } from '@prisma/client'
import { MESSAGE, TEMPLATE } from 'src/constants'
import { PaginationDto } from 'src/prisma/dto'
import { HardRemoveDto, RestoreDto } from 'src/utils'

@Injectable()
export class RecoveryHouseService {
	constructor(private readonly prismaService: PrismaService) {}

	async create(user: User, createRecoveryHouseDto: CreateRecoveryHouseDto) {
		let dataObj = {}

		if (user.role !== 'WEB_MASTER') {
			dataObj = {
				...createRecoveryHouseDto,
				field: {
					connect: {
						id: user.fieldId,
					},
				},
			}
		} else {
			if (!createRecoveryHouseDto.field) {
				throw new BadRequestException({
					message: TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'),
					data: {},
				})
			}

			dataObj = {
				...createRecoveryHouseDto,
				field: {
					connect: {
						id: createRecoveryHouseDto.field,
					},
				},
			}
		}

		return await this.prismaService.recoveryHouse.create({
			data: dataObj as any,
		})
	}

	async findAll(@Query() query?: PaginationDto) {
		return await this.prismaService.paginatedQuery('recoveryHouse', query, {
			searchKeys: ['title', 'description'],
		})
	}

	async findOne(id: string) {
		return await this.prismaService.recoveryHouse.findUnique({
			where: { id },
		})
	}

	async update(id: string, user: User, updateRecoveryHouseDto: UpdateRecoveryHouseDto) {
		try {
			if (user.role !== 'WEB_MASTER') {
				const recoveryHouse = await this.prismaService.recoveryHouse.findFirst({
					where: { id },
				})

				if (!recoveryHouse) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('casa de recuperação', 'a'),
						data: {},
					})
				} else if (recoveryHouse.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
				delete updateRecoveryHouseDto.field
			} else {
				if (updateRecoveryHouseDto.field) {
					updateRecoveryHouseDto.field = {
						connect: { id: updateRecoveryHouseDto.field },
					} as any
				} else {
					delete updateRecoveryHouseDto.field
				}
			}

			return await this.prismaService.recoveryHouse.update({
				where: { id },
				data: updateRecoveryHouseDto as any,
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('casa de recuperação', 'a'),
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
				const recoveryHouse = await this.prismaService.recoveryHouse.findFirst({
					where: { id },
				})

				if (!recoveryHouse) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('casa de recuperação', 'a'),
						data: {},
					})
				} else if (recoveryHouse.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.recoveryHouse.delete({
				where: { id },
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('casa de recuperação', 'a'),
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
				const findManyQuery = this.prismaService.recoveryHouse.findMany({
					where: {
						id: { in: restoreDto.ids },
					},
				})
				const [recoveryHouses] = await this.prismaService.$transaction([findManyQuery])

				if (!recoveryHouses) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('casas de recuperação', 'a'),
						data: {},
					})
				} else if (recoveryHouses.some((recoveryHouse) => recoveryHouse.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.recoveryHouse.updateMany({
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
						message: TEMPLATE.EXCEPTION.NOT_FOUND('casa de recuperação', 'a'),
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
				const findManyQuery = this.prismaService.recoveryHouse.findMany({
					where: {
						id: { in: hardRemoveDto.ids },
					},
				})
				const [collaborators] = await this.prismaService.$transaction([findManyQuery])

				if (!collaborators) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('casas de recuperação', 'a'),
						data: {},
					})
				} else if (collaborators.some((recoveryHouse) => recoveryHouse.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			const deleteQuery = this.prismaService.recoveryHouse.deleteMany({
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
