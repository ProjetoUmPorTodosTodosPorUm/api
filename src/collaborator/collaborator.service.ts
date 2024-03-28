import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Query } from '@nestjs/common'
import { User, Prisma } from '@prisma/client'
import { MESSAGE, TEMPLATE } from 'src/constants'
import { PaginationDto } from 'src/prisma/dto'
import { PrismaService } from 'src/prisma/prisma.service'
import { HardRemoveDto, RestoreDto } from 'src/utils'
import { CreateCollaboratorDto, UpdateCollaboratorDto } from './dto'

@Injectable()
export class CollaboratorService {
	constructor(private readonly prismaService: PrismaService) {}

	async create(user: User, createCollaboratorDto: CreateCollaboratorDto) {
		let dataObj = {}

		if (user.role !== 'WEB_MASTER') {
			dataObj = {
				...createCollaboratorDto,
				field: {
					connect: {
						id: user.fieldId,
					},
				},
			}
		} else {
			if (!createCollaboratorDto.field) {
				throw new BadRequestException({
					message: TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'),
					data: {},
				})
			}

			dataObj = {
				...createCollaboratorDto,
				field: {
					connect: {
						id: createCollaboratorDto.field,
					},
				},
			}
		}

		return await this.prismaService.collaborator.create({
			data: dataObj as any,
		})
	}

	async findAll(@Query() query?: PaginationDto) {
		return await this.prismaService.paginatedQuery('collaborator', query, {
			searchKeys: ['title', 'description'],
		})
	}

	async findOne(id: string) {
		return await this.prismaService.collaborator.findUnique({
			where: { id },
		})
	}

	async update(id: string, user: User, updateCollaboratorDto: UpdateCollaboratorDto) {
		try {
			if (user.role !== 'WEB_MASTER') {
				const collaborator = await this.prismaService.collaborator.findFirst({
					where: { id },
				})

				if (!collaborator) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('colaborador', 'o'),
						data: {},
					})
				} else if (collaborator.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
				delete updateCollaboratorDto.field
			} else {
				if (updateCollaboratorDto.field) {
					updateCollaboratorDto.field = {
						connect: { id: updateCollaboratorDto.field },
					} as any
				} else {
					delete updateCollaboratorDto.field
				}
			}

			return await this.prismaService.collaborator.update({
				where: { id },
				data: updateCollaboratorDto as any,
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('colaborador', 'o'),
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
				const collaborator = await this.prismaService.collaborator.findFirst({
					where: { id },
				})

				if (!collaborator) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('colaborador', 'o'),
						data: {},
					})
				} else if (collaborator.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.collaborator.delete({
				where: { id },
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('colaborador', 'o'),
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
				const findManyQuery = this.prismaService.collaborator.findMany({
					where: {
						id: { in: restoreDto.ids },
					},
				})
				const [collaborators] = await this.prismaService.$transaction([findManyQuery])

				if (!collaborators) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('colaboradores', 'o'),
						data: {},
					})
				} else if (collaborators.some((collaborator) => collaborator.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.collaborator.updateMany({
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
						message: TEMPLATE.EXCEPTION.NOT_FOUND('colaborador', 'o'),
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
				const findManyQuery = this.prismaService.collaborator.findMany({
					where: {
						id: { in: hardRemoveDto.ids },
					},
				})
				const [collaborators] = await this.prismaService.$transaction([findManyQuery])

				if (!collaborators) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('colaboradores', 'o'),
						data: {},
					})
				} else if (collaborators.some((collaborator) => collaborator.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			const deleteQuery = this.prismaService.collaborator.deleteMany({
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
