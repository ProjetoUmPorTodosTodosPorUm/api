import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Query } from '@nestjs/common'
import { User, Prisma } from '@prisma/client'
import { MESSAGE, TEMPLATE } from 'src/constants'
import { PaginationDto } from 'src/prisma/dto'
import { PrismaService } from 'src/prisma/prisma.service'
import { FindByRangeDto, HardRemoveDto, RestoreDto } from 'src/utils'
import { CreateAgendaDto, UpdateAgendaDto } from './dto'

@Injectable()
export class AgendaService {
	constructor(private readonly prismaService: PrismaService) {}

	async create(user: User, createAgendaDto: CreateAgendaDto) {
		let dataObj = {}

		if (user.role !== 'WEB_MASTER') {
			dataObj = {
				...createAgendaDto,
				field: {
					connect: {
						id: user.fieldId,
					},
				},
			}
		} else {
			if (!createAgendaDto.field) {
				dataObj = createAgendaDto
			} else {
				dataObj = {
					...createAgendaDto,
					field: {
						connect: {
							id: createAgendaDto.field,
						},
					},
				}
			}
		}

		return await this.prismaService.agenda.create({
			data: dataObj as any,
		})
	}

	async findAll(@Query() query?: PaginationDto) {
		return await this.prismaService.paginatedQuery('agenda', query, {
			searchKeys: ['title', 'message'],
		})
	}

	async findByRange(@Query() query: FindByRangeDto) {
		return await this.prismaService.agenda.findMany({
			where: {
				date: {
					lte: query.lte,
					gte: query.gte,
				},
			},
		})
	}

	async findOne(id: string) {
		return await this.prismaService.agenda.findUnique({
			where: { id },
		})
	}

	async update(id: string, user: User, updateAgendaDto: UpdateAgendaDto) {
		try {
			if (user.role !== 'WEB_MASTER') {
				const event = await this.prismaService.agenda.findFirst({
					where: { id },
				})

				if (!event) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'),
						data: {},
					})
				} else if (event.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
				delete updateAgendaDto.field
			} else {
				if (updateAgendaDto.field) {
					updateAgendaDto.field = {
						connect: { id: updateAgendaDto.field },
					} as any
				} else {
					delete updateAgendaDto.field
				}
			}

			return await this.prismaService.agenda.update({
				where: { id },
				data: updateAgendaDto as any,
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'),
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
				const event = await this.prismaService.agenda.findFirst({
					where: { id },
				})

				if (!event) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'),
						data: {},
					})
				} else if (event.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.agenda.delete({
				where: { id },
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'),
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
				const findManyQuery = this.prismaService.agenda.findMany({
					where: {
						id: { in: restoreDto.ids },
					},
				})
				const [events] = await this.prismaService.$transaction([findManyQuery])

				if (!events) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('eventos', 'o'),
						data: {},
					})
				} else if (events.some((event) => event.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.agenda.updateMany({
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
						message: TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'),
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
				const findManyQuery = this.prismaService.agenda.findMany({
					where: {
						id: { in: hardRemoveDto.ids },
					},
				})
				const [events] = await this.prismaService.$transaction([findManyQuery])

				if (!events) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('eventos', 'o'),
						data: {},
					})
				} else if (events.some((event) => event.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			const deleteQuery = this.prismaService.agenda.deleteMany({
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
