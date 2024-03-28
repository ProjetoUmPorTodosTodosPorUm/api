import { Injectable, Query, Logger } from '@nestjs/common'
import { PaginationDto } from 'src/prisma/dto'
import { CreateLogDto } from './dto'
import { PrismaService } from 'src/prisma/prisma.service'
import { ConfigService } from '@nestjs/config'
import { Cron } from '@nestjs/schedule'
import { Prisma } from '@prisma/client'

@Injectable()
export class LogService {
	constructor(private prismaService: PrismaService, private configService: ConfigService) {}

	private readonly logger = new Logger(LogService.name)

	async create(payload: CreateLogDto) {
		const { user, ...payloadData } = payload
		const userObj = !user ? undefined : { connect: { id: user.id } }
		try {
			await this.prismaService.log.create({
				data: {
					...payloadData,
					user: userObj,
				},
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				// User Not Found, Log Without User
				if (error.code === 'P2025') {
					await this.prismaService.log.create({
						data: payloadData,
					})
				}
			}
		}
	}

	async findAll(@Query() query?: PaginationDto) {
		return await this.prismaService.paginatedQuery('log', query, {
			include: {
				user: {
					select: {
						firstName: true,
						email: true,
						role: true,
					},
				},
			},
			searchKeys: ['ip', 'method', 'url', 'query', 'statusCode'],
		})
	}

	async findOne(id: string) {
		return await this.prismaService.log.findUnique({
			where: { id },
			include: {
				user: {
					select: {
						firstName: true,
						email: true,
						role: true,
					},
				},
			},
		})
	}

	@Cron('0 23 * * *')
	async removeOld() {
		this.logger.log('Removing old logs...')

		const dateLimit = new Date()
		dateLimit.setMonth(dateLimit.getMonth() - this.configService.get<number>('log.clearBeyondMonths'))

		const deleteQuery = this.prismaService.log.deleteMany({
			where: {
				createdAt: {
					lte: dateLimit,
				},
			},
		})
		const [result] = await this.prismaService.$transaction([deleteQuery])
		return result
	}
}
