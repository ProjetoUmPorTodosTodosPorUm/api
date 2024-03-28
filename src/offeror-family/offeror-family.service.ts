import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Query } from '@nestjs/common'
import { User, Prisma } from '@prisma/client'
import { MESSAGE, TEMPLATE } from 'src/constants'
import { PaginationDto } from 'src/prisma/dto'
import { PrismaService } from 'src/prisma/prisma.service'
import { HardRemoveDto, RestoreDto } from 'src/utils'
import { CreateOfferorFamilyDto, UpdateOfferorFamilyDto } from './dto'

@Injectable()
export class OfferorFamilyService {
	constructor(private readonly prismaService: PrismaService) {}

	async create(user: User, createOfferorFamilyDto: CreateOfferorFamilyDto) {
		let dataObj = {}

		if (user.role !== 'WEB_MASTER') {
			dataObj = {
				...createOfferorFamilyDto,
				field: {
					connect: {
						id: user.fieldId,
					},
				},
			}
		} else {
			if (!createOfferorFamilyDto.field) {
				throw new BadRequestException({
					message: TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'),
					data: {},
				})
			}

			dataObj = {
				...createOfferorFamilyDto,
				field: {
					connect: {
						id: createOfferorFamilyDto.field,
					},
				},
			}
		}

		return await this.prismaService.offerorFamily.create({
			data: dataObj as any,
		})
	}

	async findAll(@Query() query?: PaginationDto) {
		return await this.prismaService.paginatedQuery('offerorFamily', query, {
			searchKeys: ['representative', 'commitment', 'churchDenomination'],
		})
	}

	async findOne(id: string) {
		return await this.prismaService.offerorFamily.findUnique({
			where: { id },
		})
	}

	async update(id: string, user: User, updateOfferorFamilyDto: UpdateOfferorFamilyDto) {
		try {
			if (user.role !== 'WEB_MASTER') {
				const offerorFamily = await this.prismaService.offerorFamily.findFirst({
					where: { id },
				})

				if (!offerorFamily) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('família ofertante', 'a'),
						data: {},
					})
				} else if (offerorFamily.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
				delete updateOfferorFamilyDto.field
			} else {
				if (updateOfferorFamilyDto.field) {
					updateOfferorFamilyDto.field = {
						connect: { id: updateOfferorFamilyDto.field },
					} as any
				} else {
					delete updateOfferorFamilyDto.field
				}
			}

			return await this.prismaService.offerorFamily.update({
				where: { id },
				data: updateOfferorFamilyDto as any,
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('família ofertante', 'a'),
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
				const offerorFamily = await this.prismaService.offerorFamily.findFirst({
					where: { id },
				})

				if (!offerorFamily) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('família ofertante', 'a'),
						data: {},
					})
				} else if (offerorFamily.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.offerorFamily.delete({
				where: { id },
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('família ofertante', 'a'),
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
				const findManyQuery = this.prismaService.offerorFamily.findMany({
					where: {
						id: { in: restoreDto.ids },
					},
				})
				const [offerorFamilies] = await this.prismaService.$transaction([findManyQuery])

				if (!offerorFamilies) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('Família ofertante', 'a'),
						data: {},
					})
				} else if (offerorFamilies.some((offerorFamiliy) => offerorFamiliy.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.offerorFamily.updateMany({
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
						message: TEMPLATE.EXCEPTION.NOT_FOUND('família ofertante', 'a'),
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
				const findManyQuery = this.prismaService.offerorFamily.findMany({
					where: {
						id: { in: hardRemoveDto.ids },
					},
				})
				const [offerorFamilies] = await this.prismaService.$transaction([findManyQuery])

				if (!offerorFamilies) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('Família ofertante', 'a'),
						data: {},
					})
				} else if (offerorFamilies.some((offerorFamiliy) => offerorFamiliy.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			const deleteQuery = this.prismaService.offerorFamily.deleteMany({
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
