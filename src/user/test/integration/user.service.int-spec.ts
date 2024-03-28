import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Field, Role, User } from '@prisma/client'
import { ITEMS_PER_PAGE, MESSAGE } from 'src/constants'
import { PrismaService } from 'src/prisma/prisma.service'
import { UserService } from 'src/user/user.service'
import { v4 as uuidv4 } from 'uuid'
import * as bcrypt from 'bcrypt'

import { TEMPLATE } from 'src/constants'
import { createField, createUser } from 'src/utils/test'
import { ConfigModule } from '@nestjs/config'
import configuration from 'src/config/configuration'
import { AuthModule } from 'src/auth/auth.module'
import { PrismaModule } from 'src/prisma/prisma.module'
import { UserModule } from 'src/user/user.module'
import { FieldModule } from 'src/field/field.module'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseInterceptor } from 'src/response.interceptor'

describe('User Service Integration', () => {
	let prisma: PrismaService
	let userService: UserService

	let field: Field
	let admin: User
	let webMaster: User

	const firstName = 'Jão'
	const email = 'user@example.com'
	const password = '12345678'
	const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync())

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [
				ConfigModule.forRoot({
					load: [configuration],
					isGlobal: true,
				}),

				// Basic Routes
				AuthModule,
				PrismaModule,
				UserModule,

				// Specific
				FieldModule,
			],
			providers: [
				{
					provide: APP_INTERCEPTOR,
					useClass: ResponseInterceptor,
				},
			],
		}).compile()

		prisma = moduleRef.get(PrismaService)
		userService = moduleRef.get(UserService)

		await prisma.onModuleInit()
	})

	beforeEach(async () => {
		await prisma.cleanDataBase()

		field = await createField(prisma, 'América', 'Brasil', 'Rio de Janeiro', 'AMEBRRJ01', 'Designação')

		admin = await createUser(prisma, 'admin', 'sigma@email.com', hashedPassword, Role.ADMIN, field.id)

		webMaster = await createUser(prisma, 'webMaster', 'ultra.sigma@email.com', hashedPassword, Role.WEB_MASTER)
	})

	describe('create()', () => {
		it('Should Not Create an User (Duplicated)', async () => {
			await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			try {
				await userService.create({
					firstName,
					email,
					password,
					field: field.id,
				})
			} catch (error) {
				expect(error).toBeInstanceOf(ConflictException)
				expect(error.response.message).toBeDefined()
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.CONFLICT('E-mail', 'o'))
			}
		})

		it('Should Create an User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			expect(user.firstName).toBe(firstName)
			expect(user.email).toBe(email)
			expect(user.role).toBe(Role.VOLUNTEER)
			expect(user.avatar).toBeNull()
		})
	})

	describe('findAll()', () => {
		it('Should Return an Empty Array', async () => {
			await prisma.cleanDataBase()

			const response = await userService.findAll()
			expect(response.data).toHaveLength(0)
			expect(response.totalCount).toBe(0)
			expect(response.totalPages).toBe(0)
		})

		it(`Should Return an User List With ${ITEMS_PER_PAGE} Items`, async () => {
			await prisma.cleanDataBase()
			field = await createField(prisma, 'América', 'Brasil', 'Rio de Janeiro', 'AMEBRRJ01', 'Designação')

			const usersToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							firstName: `Jão ${i}`,
							email: `user${i}@example.com`,
							hashedPassword: 'notarealhash',
						} as User),
				)
			await prisma.user.createMany({
				data: usersToCreate,
			})

			const response = await userService.findAll()
			expect(response.data).toHaveLength(ITEMS_PER_PAGE)
			expect(response.data[0].hashedPassword).toBeUndefined()
			expect(response.totalCount).toBe(ITEMS_PER_PAGE)
			expect(response.totalPages).toBe(1)
		})

		const randomNUsers = Math.ceil(Math.random() * ITEMS_PER_PAGE)
		it(`Should Return an User List With ${randomNUsers} Items`, async () => {
			await prisma.cleanDataBase()
			field = await createField(prisma, 'América', 'Brasil', 'Rio de Janeiro', 'AMEBRRJ01', 'Designação')

			const usersToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							firstName: `Jão ${i}`,
							email: `user${i}@example.com`,
							hashedPassword,
						} as User),
				)
			await prisma.user.createMany({
				data: usersToCreate,
			})

			const response = await userService.findAll({
				itemsPerPage: randomNUsers,
			})
			expect(response.data).toHaveLength(randomNUsers)
			expect(response.data[0].hashedPassword).toBeUndefined()
			expect(response.totalCount).toBe(ITEMS_PER_PAGE)
			expect(response.totalPages).toBe(Math.ceil(response.totalCount / randomNUsers))
		})
	})

	describe('findOne()', () => {
		it("Should Return Nothing (User Doesn't Exists)", async () => {
			const randomId = uuidv4()
			const user = await userService.findOne(randomId)

			expect(user).toBeNull()
		})

		it('Should Return an User', async () => {
			const userCreated = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			const user = await userService.findOne(userCreated.id)
			expect(user.firstName).toBe(firstName)
			expect(user.email).toBe(email)
			expect(user.role).toBe(Role.VOLUNTEER)
			expect(user.avatar).toBeNull()
			expect(user.lastAccess).toBeDefined()
		})
	})

	describe('findByEmailAuth()', () => {
		it("Should Return Nothing (User Doesn't Exists)", async () => {
			const user = await userService.findByEmailAuth(email)
			expect(user).toBeNull()
		})

		it('Should Return an User', async () => {
			await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			const user = await userService.findByEmailAuth(email)
			expect(user.email).toBe(email)
			expect(user.role).toBe(Role.VOLUNTEER)
			expect(user.hashedPassword).toBeDefined()
		})
	})

	describe('update()', () => {
		it('Should Not Update an User (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await userService.update(randomId, admin, {
					firstName: 'Primeiro',
					lastName: 'Último',
				})
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'))
			}
		})

		it('Should Not Update an User (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await userService.update(randomId, webMaster, {
					firstName: 'Primeiro',
					lastName: 'Último',
				})
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'))
			}
		})

		it('Should Not Change Role From User (ADMIN -> VOLUNTEER as ADMIN)', async () => {
			const newRole = Role.VOLUNTEER
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.ADMIN, field.id)

			const userUpdated = await userService.update(user.id, admin, { role: newRole })
			expect(userUpdated.role).toBe(Role.ADMIN)
		})

		it('Should Not Change Role From User (VOLUNTEER -> WEB_MASTER as ADMIN)', async () => {
			const newRole = Role.WEB_MASTER
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			const userUpdated = await userService.update(user.id, admin, { role: newRole })
			expect(userUpdated.role).toBe(Role.VOLUNTEER)
		})

		it('Should Update an User (as ADMIN)', async () => {
			const lastName = 'Brilha'
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			const userUpdated = await userService.update(user.id, admin, { lastName })
			expect(userUpdated.firstName).toBe(firstName)
			expect(userUpdated.lastName).toBe(lastName)
			expect(userUpdated.email).toBe(email)
			expect(userUpdated.role).toBe(Role.VOLUNTEER)
			expect(userUpdated.avatar).toBeNull()
			expect(userUpdated.lastAccess).toBeDefined()
		})

		it('Should Update an User (as WEB MASTER)', async () => {
			const lastName = 'Brilha'
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			const userUpdated = await userService.update(user.id, webMaster, { lastName })
			expect(userUpdated.firstName).toBe(firstName)
			expect(userUpdated.lastName).toBe(lastName)
			expect(userUpdated.email).toBe(email)
			expect(userUpdated.role).toBe(Role.VOLUNTEER)
			expect(userUpdated.avatar).toBeNull()
			expect(userUpdated.lastAccess).toBeDefined()
		})
	})

	describe('updateLastAccess()', () => {
		it("Should Not Update 'lastAccess' From User (Not Found)", async () => {
			const randomId = uuidv4()
			try {
				await userService.updateLastAccess(randomId)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'))
			}
		})

		it("Should Update 'lastAccess' from User", async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			const oldLastAccess = user.lastAccess

			await userService.updateLastAccess(user.id)
			const newLastAccess = (
				await prisma.user.findUnique({
					where: { id: user.id },
				})
			).lastAccess

			expect(newLastAccess.getTime()).toBeGreaterThanOrEqual(oldLastAccess.getTime())
		})
	})

	describe('updatePasswordByEmail()', () => {
		it("Should Not Update User's Email (Not Found)", async () => {
			try {
				await userService.updatePasswordByEmail(email, '123')
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
			}
		})

		it("Should Update User's Passsword", async () => {
			const oldHash = 'notarealhash'
			const newPassword = '123'
			await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			await userService.updatePasswordByEmail(email, newPassword)
			const newHash = (await prisma.user.findUnique({ where: { email } })).hashedPassword

			expect(newHash).not.toBe(oldHash)
			expect(bcrypt.compareSync(newPassword, newHash)).toBeTruthy()
		})
	})

	describe('remove()', () => {
		it('Should Not Remove User (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await userService.remove(randomId, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'))
			}
		})

		it('Should Not Remove User (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await userService.remove(randomId, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'))
			}
		})

		it('Should Not Remove User (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, differentField.id)
				await userService.remove(user.id, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Remove User (Another Admin as ADMIN)', async () => {
			try {
				const user = await createUser(prisma, firstName, email, hashedPassword, Role.ADMIN, field.id)
				await userService.remove(user.id, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Remove User (as ADMIN)', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			await userService.remove(user.id, admin)
			const isUserDeleted = await prisma.user.findFirst({
				where: {
					id: user.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isUserDeleted).toBeDefined()
		})

		it('Should Remove User (as WEB MASTER)', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			await userService.remove(user.id, webMaster)
			const isUserDeleted = await prisma.user.findFirst({
				where: {
					id: user.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isUserDeleted).toBeDefined()
		})
	})

	describe('findMe', () => {
		it('Should Return Own User', async () => {
			const email = 'email@example.com'
			const userCreated = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			const user = await userService.findMe(userCreated)
			expect(user).toBeDefined()
			expect(user.email).toBe(email)
		})
	})

	describe('updateMe', () => {
		it('Should Update Own User', async () => {
			const lastName = 'Brilha'
			const password = 'anotherone'

			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			const userUpdated = await userService.updateMe(user, {
				lastName,
				password,
			})
			expect(userUpdated).toBeDefined()
			expect(userUpdated.lastName).toBe(lastName)

			const newHashedPassword = (await prisma.user.findUnique({ where: { email: user.email } })).hashedPassword
			expect(user.hashedPassword).not.toBe(newHashedPassword)
		})
	})

	describe('removeMe()', () => {
		it('Should Remove Own User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			await userService.removeMe(user)

			const isUserRemoved = await prisma.user.findFirst({
				where: {
					email: 'email@example.com',
					deleted: { lt: new Date() },
				},
			})
			expect(isUserRemoved).toBeDefined()
		})
	})

	describe('restore()', () => {
		it('Should Not Restore an User (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await userService.restore({ ids: [randomId] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'))
			}
		})

		it('Should Not Restore an User (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await userService.restore({ ids: [randomId] }, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'))
			}
		})

		it('Should Not Restore an User (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, differentField.id)
				await prisma.user.delete({ where: { id: user.id } })
				await userService.restore({ ids: [user.id] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Restore an User (as ADMIN)', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			await prisma.user.delete({ where: { id: user.id } })

			await userService.restore({ ids: [user.id] }, admin)
			const isUserRestored = await prisma.user.findFirst({
				where: {
					email: user.email,
				},
			})

			expect(isUserRestored.deleted).toBeNull()
		})

		it('Should Restore an User (as WEB MASTER)', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			await prisma.user.delete({ where: { id: user.id } })

			await userService.restore({ ids: [user.id] }, webMaster)
			const isUserRestored = await prisma.user.findFirst({
				where: {
					email: user.email,
				},
			})

			expect(isUserRestored.deleted).toBeNull()
		})
	})

	describe('hardRemove()', () => {
		it('Should Not Hard Remove an User (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await userService.hardRemove({ ids: [randomId] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'))
			}
		})

		it('Should Not Hard Remove an User (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await userService.hardRemove({ ids: [randomId] }, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'))
			}
		})

		it('Should Not Hard Remove an User (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, differentField.id)
				await prisma.user.delete({ where: { id: user.id } })
				await userService.hardRemove({ ids: [user.id] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Hard Remove an User (as ADMIN)', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			await prisma.user.delete({ where: { id: user.id } })

			await userService.hardRemove({ ids: [user.id] }, admin)
			const isUserRemoved = await prisma.user.findFirst({
				where: {
					email: user.email,
					deleted: { not: new Date() },
				},
			})
			expect(isUserRemoved).toBeNull()
		})

		it('Should Hard Remove an User (as WEB MASTER)', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			await prisma.user.delete({ where: { id: user.id } })

			await userService.hardRemove({ ids: [user.id] }, webMaster)
			const isUserRemoved = await prisma.user.findFirst({
				where: {
					email: user.email,
					deleted: { not: new Date() },
				},
			})
			expect(isUserRemoved).toBeNull()
		})
	})

	describe('restrict()', () => {
		it('Should Not Restrict an User (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await userService.restrict({ id: randomId }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'))
			}
		})

		it('Should Not Restrict an User (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await userService.restrict({ id: randomId }, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'))
			}
		})

		it('Should Not Restrict an User (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, differentField.id)
				await userService.restrict({ id: user.id }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Restrict an User (Another ADMIN as ADMIN)', async () => {
			try {
				const user = await createUser(prisma, firstName, email, hashedPassword, Role.ADMIN, field.id)
				await userService.restrict({ id: user.id }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Restrict an User (as ADMIN)', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			await userService.restrict({ id: user.id }, admin)
			const isUserRestricted = await prisma.user.findUnique({
				where: { id: user.id },
			})
			expect(isUserRestricted.restricted).toBeDefined()
		})

		it('Should Restrict an User (as WEB MASTER)', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			await userService.restrict({ id: user.id }, webMaster)
			const isUserRestricted = await prisma.user.findUnique({
				where: { id: user.id },
			})
			expect(isUserRestricted.restricted).toBeDefined()
		})
	})

	describe('unrestrict()', () => {
		it('Should Not Unrestrict an User (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await userService.unrestrict({ id: randomId }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'))
			}
		})

		it('Should Not Unrestrict an User (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await userService.unrestrict({ id: randomId }, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'))
			}
		})

		it('Should Not Unrestrict an User (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, differentField.id)
				await userService.unrestrict({ id: user.id }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Unrestrict an User (Another ADMIN as ADMIN)', async () => {
			try {
				const user = await createUser(prisma, firstName, email, hashedPassword, Role.ADMIN, field.id)
				await userService.unrestrict({ id: user.id }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Unrestrict an User (as ADMIN)', async () => {
			const user = await prisma.user.create({
				data: {
					firstName,
					email,
					hashedPassword,
					role: Role.VOLUNTEER,
					fieldId: field.id,
					restricted: new Date(),
				},
			})

			await userService.unrestrict({ id: user.id }, admin)
			const isUserRestricted = await prisma.user.findUnique({
				where: { id: user.id },
			})
			expect(isUserRestricted.restricted).toBeNull()
		})

		it('Should Restrict an User (as WEB MASTER)', async () => {
			const user = await prisma.user.create({
				data: {
					firstName,
					email,
					hashedPassword,
					role: Role.VOLUNTEER,
					fieldId: field.id,
					restricted: new Date(),
				},
			})

			await userService.unrestrict({ id: user.id }, webMaster)
			const isUserRestricted = await prisma.user.findUnique({
				where: { id: user.id },
			})
			expect(isUserRestricted.restricted).toBeNull()
		})
	})
})
