import { ForbiddenException, Injectable, NotFoundException, Query } from '@nestjs/common'
import { CreateContactDto } from './dto'
import { PrismaService } from 'src/prisma/prisma.service'
import { PaginationDto } from 'src/prisma/dto'
import { Prisma, User } from '@prisma/client'
import { MESSAGE, TEMPLATE } from 'src/constants'
import { HardRemoveDto, RestoreDto } from 'src/utils'

@Injectable()
export class ContactService {
	constructor(private readonly prismaService: PrismaService) {}

	async create(createContactDto: CreateContactDto) {
		return await this.prismaService.contact.create({
			data: createContactDto,
		})
	}

	async findAll(@Query() query?: PaginationDto) {
		return await this.prismaService.paginatedQuery('contact', query, {
			searchKeys: ['name', 'email', 'message'],
		})
	}

	async findOne(id: string) {
		return await this.prismaService.contact.findUnique({
			where: { id },
		})
	}

	async remove(id: string, user: User) {
		try {
			if (user.role !== 'WEB_MASTER') {
				throw new ForbiddenException({
					message: MESSAGE.EXCEPTION.FORBIDDEN,
					data: {},
				})
			}

			return await this.prismaService.contact.delete({
				where: { id },
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('contato', 'o'),
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
				throw new ForbiddenException({
					message: MESSAGE.EXCEPTION.FORBIDDEN,
					data: {},
				})
			}

			return await this.prismaService.contact.updateMany({
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
						message: TEMPLATE.EXCEPTION.NOT_FOUND('contato', 'o'),
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
				throw new ForbiddenException({
					message: MESSAGE.EXCEPTION.FORBIDDEN,
					data: {},
				})
			}

			const deleteQuery = this.prismaService.contact.deleteMany({
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
