import { ConflictException, ForbiddenException, Injectable, NotFoundException, Query } from '@nestjs/common'
import { Role, User, Prisma } from '@prisma/client'
import { PrismaService } from 'src/prisma/prisma.service'
import { CreateUserDto, MeUpdateUserDto, RestrictUserDto, UnrestrictUserDto, UpdateUserDto } from './dto'
import * as bcrypt from 'bcrypt'
import { PaginationDto } from 'src/prisma/dto'
import { PrismaUtils } from 'src/utils'
import { MESSAGE, TEMPLATE } from 'src/constants'
import { RestoreDto, HardRemoveDto } from 'src/utils/dto'

@Injectable()
export class UserService {
	constructor(private prismaService: PrismaService) {}

	async create(createUserDto: CreateUserDto) {
		let dataObj = {
			firstName: createUserDto.firstName,
			lastName: createUserDto.lastName,
			email: createUserDto.email,
			role: createUserDto.role ? createUserDto.role : Role.VOLUNTEER,
			hashedPassword: bcrypt.hashSync(createUserDto.password, bcrypt.genSaltSync()),
		} as any

		if (!createUserDto.role || createUserDto.role !== 'WEB_MASTER') {
			dataObj = {
				...dataObj,
				field: {
					connect: {
						id: createUserDto.field,
					},
				},
			}
		}

		try {
			const newUser = await this.prismaService.user.create({
				data: dataObj,
			})

			return PrismaUtils.exclude(newUser, 'hashedPassword', 'hashedRefreshToken', 'deleted')
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2002') {
					throw new ConflictException({
						message: TEMPLATE.EXCEPTION.CONFLICT('E-mail', 'o'),
						data: {},
					})
				}
			}
			throw error
		}
	}

	async findAll(@Query() query?: PaginationDto) {
		return await this.prismaService.paginatedQuery('user', query, {
			excludeKeys: ['hashedPassword', 'hashedRefreshToken'],
			searchKeys: ['firstName', 'lastName', 'email'],
		})
	}

	async findOne(id: string) {
		const user = await this.prismaService.user.findUnique({
			where: { id },
		})
		return PrismaUtils.exclude(user, 'hashedPassword', 'hashedRefreshToken', 'deleted')
	}

	async findByEmailAuth(email: string): Promise<User | null> {
		return await this.prismaService.user.findUnique({
			where: {
				email,
			},
		})
	}

	async update(id: string, user: User, updateUserDto: UpdateUserDto) {
		try {
			if (user.role !== 'WEB_MASTER') {
				const userExists = await this.prismaService.user.findFirst({
					where: { id },
				})

				if (!userExists) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'),
						data: {},
					})
				} else if (userExists.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				} else if (updateUserDto.role) {
					if (updateUserDto.role === 'WEB_MASTER' || userExists.role === 'ADMIN') {
						delete updateUserDto.role
					}
				}
				delete updateUserDto.field
			} else {
				if (updateUserDto.field) {
					updateUserDto.field = {
						connect: { id: updateUserDto.field },
					} as any
				} else {
					delete updateUserDto.field
				}
			}

			const userUpdated = await this.prismaService.user.update({
				where: { id },
				data: updateUserDto as any,
			})
			return PrismaUtils.exclude(userUpdated, 'hashedPassword', 'hashedRefreshToken', 'deleted')
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'),
						data: {},
					})
				}
			}
			throw error
		}
	}

	async updateLastAccess(id: string): Promise<void> {
		try {
			await this.prismaService.user.update({
				where: {
					id,
				},
				data: {
					lastAccess: new Date(),
				},
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'),
						data: {},
					})
				}
			}
			throw error
		}
	}

	async updatePasswordByEmail(email: string, password: string): Promise<void> {
		try {
			await this.prismaService.user.update({
				where: { email },
				data: {
					hashedPassword: bcrypt.hashSync(password, bcrypt.genSaltSync()),
				},
			})
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'),
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
				const userExists = await this.prismaService.user.findFirst({
					where: { id },
				})

				if (!userExists) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'),
						data: {},
					})
				} else if (userExists.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				} else if (userExists.role === 'ADMIN') {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			const userRemoved = await this.prismaService.user.delete({
				where: { id },
			})
			return PrismaUtils.exclude(userRemoved, 'hashedPassword', 'hashedRefreshToken', 'deleted')
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'),
						data: {},
					})
				}
			}
			throw error
		}
	}

	async findMe(user: User) {
		const userMe = await this.prismaService.user.findUnique({
			where: { id: user.id },
		})
		return PrismaUtils.exclude(userMe, 'hashedPassword', 'hashedRefreshToken', 'deleted')
	}

	async updateMe(user: User, updateUserDto: MeUpdateUserDto) {
		if (updateUserDto.password) {
			const hashedPassword = bcrypt.hashSync(updateUserDto.password, bcrypt.genSaltSync())
			delete updateUserDto.password
			;(updateUserDto as any).hashedPassword = hashedPassword
		}

		try {
			const userMe = await this.prismaService.user.update({
				where: { id: user.id },
				data: updateUserDto,
			})
			return PrismaUtils.exclude(userMe, 'hashedPassword', 'hashedRefreshToken', 'deleted')
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'),
						data: {},
					})
				}
			}
			throw error
		}
	}

	async removeMe(user: User) {
		try {
			const userMe = await this.prismaService.user.delete({
				where: { id: user.id },
			})
			return PrismaUtils.exclude(userMe, 'hashedPassword', 'hashedRefreshToken', 'deleted')
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'),
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
				const findManyQuery = this.prismaService.user.findMany({
					where: {
						id: { in: restoreDto.ids },
					},
				})
				const [users] = await this.prismaService.$transaction([findManyQuery])

				if (!users) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('usuários', 'o'),
						data: {},
					})
				} else if (users.some((currUser) => currUser.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			return await this.prismaService.user.updateMany({
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
						message: TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'),
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
				const findManyQuery = this.prismaService.user.findMany({
					where: {
						id: { in: hardRemoveDto.ids },
					},
				})
				const [users] = await this.prismaService.$transaction([findManyQuery])

				if (!users) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND_PLR('usuários', 'o'),
						data: {},
					})
				} else if (users.some((currUser) => currUser.fieldId !== user.fieldId)) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			const deleteQuery = this.prismaService.user.deleteMany({
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

	async restrict(restrictUserDto: RestrictUserDto, user: User) {
		try {
			if (user.role !== 'WEB_MASTER') {
				const userDoc = await this.prismaService.user.findUnique({
					where: {
						id: restrictUserDto.id,
					},
				})

				if (!userDoc) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'),
						data: {},
					})
				} else if (userDoc.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				} else if (userDoc.role === 'ADMIN') {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			await this.prismaService.user.update({
				where: { id: restrictUserDto.id },
				data: {
					restricted: new Date(),
				},
			})
			return true
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'),
						data: {},
					})
				}
			}
			throw error
		}
	}

	async unrestrict(unrestrictUserDto: UnrestrictUserDto, user: User) {
		try {
			if (user.role !== 'WEB_MASTER') {
				const userDoc = await this.prismaService.user.findUnique({
					where: {
						id: unrestrictUserDto.id,
					},
				})

				if (!userDoc) {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'),
						data: {},
					})
				} else if (userDoc.fieldId !== user.fieldId) {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				} else if (userDoc.role === 'ADMIN') {
					throw new ForbiddenException({
						message: MESSAGE.EXCEPTION.FORBIDDEN,
						data: {},
					})
				}
			}

			await this.prismaService.user.update({
				where: { id: unrestrictUserDto.id },
				data: {
					restricted: null,
				},
			})
			return true
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'),
						data: {},
					})
				}
			}
			throw error
		}
	}
}
