import { ForbiddenException, Injectable, NotFoundException, Query } from '@nestjs/common'
import { FILES_PATH, MESSAGE, TEMPLATE } from 'src/constants'
import { PrismaService } from 'src/prisma/prisma.service'
import { FileResponse } from 'src/utils'
import { PaginationDto } from 'src/prisma/dto'
import * as fs from 'fs'
import * as child_process from 'node:child_process'
import { File, User, Prisma } from '@prisma/client'
import { RestoreDto, HardRemoveDto, FileBulkRemoveDto } from 'src/utils/dto'
import { CreateFileDto } from './dto'

@Injectable()
export class FileService {
	constructor(private prismaService: PrismaService) {}

	async create(user: User, file: Express.Multer.File, createFileDto: CreateFileDto) {
		let dataObj = {
			name: file.filename,
			mimeType: file.mimetype,
			size: file.size,
		} as any

		if (user.role !== 'WEB_MASTER') {
			dataObj = {
				...dataObj,
				field: {
					connect: {
						id: user.fieldId,
					},
				},
			}
		} else {
			if (createFileDto.field) {
				dataObj = {
					...dataObj,
					field: {
						connect: {
							id: createFileDto.field,
						},
					},
				}
			}
		}

		const fileCreated = await this.prismaService.file.create({
			data: dataObj,
		})

		// Development
		// Copy file to docker volume
		if (process.env.NODE_ENV === 'development') {
			// check docker-compose.yml file
			const filesVolumeName = 'files'
			child_process.execSync(
				`cd files && docker run --rm -v $PWD:/source -v ${filesVolumeName}:/dest -w /source alpine cp "${file.filename}" /dest`,
			)
		}

		return {
			...fileCreated,
			path: file.path,
		}
	}

	async bulkCreate(user: User, files: Express.Multer.File[], createFilesDto: CreateFileDto) {
		const filesObj = []
		const returnObj: FileResponse[] = []

		files.forEach(async (file, index) => {
			filesObj.push({
				name: file.filename,
				mimeType: file.mimetype,
				size: file.size,
			} as File)
			returnObj.push({
				...filesObj[index],
				path: file.path,
			})

			if (user.role !== 'WEB_MASTER') {
				filesObj[index].fieldId = user.fieldId
			} else {
				if (createFilesDto.field) {
					filesObj[index].fieldId = createFilesDto.field
				}
			}
		})

		await this.prismaService.file.createMany({
			data: filesObj,
		})

		// Development
		// Copy file to docker volume
		if (process.env.NODE_ENV === 'development') {
			// check docker-compose.yml file
			const filesVolumeName = 'files'
			child_process.execSync(
				`cd files && docker run --rm -v $PWD:/source -v ${filesVolumeName}:/dest -w /source alpine cp ${filesObj
					.map((file) => `"${file.name}"`)
					.join(' ')} /dest`,
			)
		}

		return returnObj
	}

	async findAll(@Query() query?: PaginationDto) {
		return await this.prismaService.paginatedQuery('file', query, {
			searchKeys: ['name', 'mimeType'],
		})
	}

	async findOne(id: string) {
		const file = await this.prismaService.file.findUnique({
			where: { id },
		})

		if (file) {
			return {
				name: file.name,
				mimeType: file.mimeType,
				size: file.size,
				path: `${FILES_PATH}${file.name}`,
			}
		} else {
			return null
		}
	}

	async remove(id: string, user: User) {
		try {
			if (user.role !== 'WEB_MASTER') {
				const file = await this.prismaService.file.findFirst({
					where: { id },
				})

				if (!file) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('arquivo', 'o'),
						data: {},
					})
				} else if (file.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			const file = await this.prismaService.file.delete({
				where: { id },
			})
			return {
				id,
				name: file.name,
				mimeType: file.mimeType,
				size: file.size,
				path: `${FILES_PATH}${file.name}`,
			}
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('arquivo', 'o'),
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
				const findManyQuery = this.prismaService.file.findMany({
					where: {
						id: { in: restoreDto.ids },
					},
				})
				const [files] = await this.prismaService.$transaction([findManyQuery])

				if (!files) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('arquivos', 'o'),
						data: {},
					})
				} else if (files.some((file) => file.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.file.updateMany({
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
						message: TEMPLATE.EXCEPTION.NOT_FOUND('arquivo', 'o'),
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
				const findManyQuery = this.prismaService.file.findMany({
					where: {
						id: { in: hardRemoveDto.ids },
					},
				})
				const [files] = await this.prismaService.$transaction([findManyQuery])

				if (!files) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('arquivos', 'o'),
						data: {},
					})
				} else if (files.some((file) => file.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			const filesQuery = this.prismaService.file.findMany({
				where: {
					id: { in: hardRemoveDto.ids },
				},
			})
			const deleteQuery = this.prismaService.file.deleteMany({
				where: {
					id: { in: hardRemoveDto.ids },
				},
			})
			const [files, result] = await this.prismaService.$transaction([filesQuery, deleteQuery])

			for (const file of files) {
				fs.unlinkSync(`${FILES_PATH}${file.name}`)
			}
			return result
		} catch (error) {
			throw error
		}
	}

	async bulkRemove(fileBulkRemoveDto: FileBulkRemoveDto, user: User) {
		let whereObj = {
			name: { in: fileBulkRemoveDto.files },
		} as any

		if (user.role !== 'WEB_MASTER') {
			whereObj.fieldId = user.fieldId
		}

		return await this.prismaService.file.deleteMany({
			where: whereObj,
		})
	}
}
