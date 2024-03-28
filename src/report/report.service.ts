import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Query } from '@nestjs/common'
import { User, Prisma } from '@prisma/client'
import { MESSAGE, TEMPLATE } from 'src/constants'
import { PaginationDto } from 'src/prisma/dto'
import { PrismaService } from 'src/prisma/prisma.service'
import { HardRemoveDto, RestoreDto } from 'src/utils'
import { CreateReportDto, UpdateReportDto } from './dto'

@Injectable()
export class ReportService {
	constructor(private readonly prismaService: PrismaService) {}

	async create(user: User, createReportDto: CreateReportDto) {
		let dataObj = {}

		if (user.role !== 'WEB_MASTER') {
			dataObj = {
				...createReportDto,
				field: {
					connect: {
						id: user.fieldId,
					},
				},
			}
		} else {
			if (!createReportDto.field) {
				throw new BadRequestException({
					message: TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'),
					data: {},
				})
			}

			dataObj = {
				...createReportDto,
				field: {
					connect: {
						id: createReportDto.field,
					},
				},
			}
		}

		return await this.prismaService.report.create({
			data: dataObj as any,
		})
	}

	async findAll(@Query() query?: PaginationDto) {
		return await this.prismaService.paginatedQuery('report', query, {
			searchKeys: ['title', 'text', 'shortDescription'],
		})
	}

	async getReportedYears(field: string) {
		const reports = await this.prismaService.report.findMany({
			where: {
				fieldId: field,
			},
			select: {
				year: true,
			},
			distinct: ['year'],
			orderBy: {
				year: 'asc',
			},
		})
		return reports.reduce((p, c) => [...p, c.year], [])
	}

	async findOne(id: string) {
		return await this.prismaService.report.findUnique({
			where: { id },
		})
	}

	async update(id: string, user: User, updateReportDto: UpdateReportDto) {
		try {
			if (user.role !== 'WEB_MASTER') {
				const report = await this.prismaService.report.findFirst({
					where: { id },
				})

				if (!report) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('relatório', 'o'),
						data: {},
					})
				} else if (report.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
				delete updateReportDto.field
			} else {
				if (updateReportDto.field) {
					updateReportDto.field = {
						connect: { id: updateReportDto.field },
					} as any
				} else {
					delete updateReportDto.field
				}
			}

			return await this.prismaService.report.update({
				where: { id },
				data: updateReportDto as any,
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('relatório', 'o'),
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
				const report = await this.prismaService.report.findFirst({
					where: { id },
				})

				if (!report) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('relatório', 'o'),
						data: {},
					})
				} else if (report.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.report.delete({
				where: { id },
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('relatório', 'o'),
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
				const findManyQuery = this.prismaService.report.findMany({
					where: {
						id: { in: restoreDto.ids },
					},
				})
				const [reports] = await this.prismaService.$transaction([findManyQuery])

				if (!reports) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('relatórios', 'o'),
						data: {},
					})
				} else if (reports.some((report) => report.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.report.updateMany({
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
						message: TEMPLATE.EXCEPTION.NOT_FOUND('relatório', 'o'),
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
				const findManyQuery = this.prismaService.report.findMany({
					where: {
						id: { in: hardRemoveDto.ids },
					},
				})
				const [reports] = await this.prismaService.$transaction([findManyQuery])

				if (!reports) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('relatórios', 'o'),
						data: {},
					})
				} else if (reports.some((report) => report.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			const deleteQuery = this.prismaService.report.deleteMany({
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
