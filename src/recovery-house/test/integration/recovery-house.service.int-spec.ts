import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { RecoveryHouse, Field, Role, User } from '@prisma/client'
import { RecoveryHouseService } from 'src/recovery-house/recovery-house.service'
import { ITEMS_PER_PAGE, MESSAGE, TEMPLATE } from 'src/constants'
import { PrismaService } from 'src/prisma/prisma.service'
import { createField, createUser } from 'src/utils/test'
import { v4 as uuidv4 } from 'uuid'
import * as bcrypt from 'bcrypt'

import { ConfigModule } from '@nestjs/config'
import configuration from 'src/config/configuration'
import { AuthModule } from 'src/auth/auth.module'
import { PrismaModule } from 'src/prisma/prisma.module'
import { UserModule } from 'src/user/user.module'
import { FieldModule } from 'src/field/field.module'
import { RecoveryHouseModule } from 'src/recovery-house/recovery-house.module'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseInterceptor } from 'src/response.interceptor'

describe('Recovery House Service Integration', () => {
	let prisma: PrismaService
	let recoveryHouseService: RecoveryHouseService

	let field: Field
	let user: User
	let admin: User
	let webMaster: User

	const password = '12345678'
	const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync())

	const title = 'João'
	const description = 'Descrição'

	const createRecoveryHouse = async (title: string, description: string, field: string) =>
		await prisma.recoveryHouse.create({
			data: {
				title,
				description,
				field: {
					connect: {
						id: field,
					},
				},
			},
		})

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
				RecoveryHouseModule,
			],
			providers: [
				{
					provide: APP_INTERCEPTOR,
					useClass: ResponseInterceptor,
				},
			],
		}).compile()

		prisma = moduleRef.get(PrismaService)
		recoveryHouseService = moduleRef.get(RecoveryHouseService)

		// enable soft delete
		await prisma.onModuleInit()
	})

	beforeEach(async () => {
		await prisma.cleanDataBase()

		field = await createField(prisma, 'América', 'Brasil', 'Rio de Janeiro', 'AMEBRRJ01', 'Designação')

		user = await createUser(prisma, 'João', 'volunteer@email.com', hashedPassword, Role.VOLUNTEER, field.id)

		admin = await createUser(prisma, 'admin', 'sigma@email.com', hashedPassword, Role.ADMIN, field.id)

		webMaster = await createUser(prisma, 'webMaster', 'ultra.sigma@email.com', hashedPassword, Role.WEB_MASTER)
	})

	describe('create()', () => {
		it('Should Create a Recovery House (as USER)', async () => {
			const recoveryHouse = await recoveryHouseService.create(user, {
				title,
				description,
			})

			expect(recoveryHouse.title).toBe(title)
			expect(recoveryHouse.description).toBe(description)
			expect(recoveryHouse.fieldId).toBe(field.id)
		})

		it('Should Create a Recovery House (as ADMIN)', async () => {
			const recoveryHouse = await recoveryHouseService.create(admin, {
				title,
				description,
			})

			expect(recoveryHouse.title).toBe(title)
			expect(recoveryHouse.description).toBe(description)
			expect(recoveryHouse.fieldId).toBe(field.id)
		})

		it('Should Not Create a Recovery House (as WEB MASTER && Missing Data)', async () => {
			try {
				await recoveryHouseService.create(webMaster, {
					title,
					description,
				})
			} catch (error) {
				expect(error).toBeInstanceOf(BadRequestException)
				expect(error.response.message).toBe(TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'))
			}
		})

		it('Should Create a Recovery House (as WEB MASTER)', async () => {
			const recoveryHouse = await recoveryHouseService.create(webMaster, {
				title,
				description,
				field: field.id,
			})

			expect(recoveryHouse.title).toBe(title)
			expect(recoveryHouse.description).toBe(description)
			expect(recoveryHouse.fieldId).toBe(field.id)
		})
	})

	describe('findAll()', () => {
		it('Should Return an Empty Array', async () => {
			const response = await recoveryHouseService.findAll()

			expect(response.data).toHaveLength(0)
			expect(response.totalCount).toBe(0)
			expect(response.totalPages).toBe(0)
		})

		it(`Should Return a Recovery House List With ${ITEMS_PER_PAGE} Items`, async () => {
			const recoveryHousesToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							title: `João ${i}`,
							description,
							fieldId: field.id,
						} as RecoveryHouse),
				)
			await prisma.recoveryHouse.createMany({
				data: recoveryHousesToCreate,
			})

			const response = await recoveryHouseService.findAll()
			expect(response.data).toHaveLength(ITEMS_PER_PAGE)
			expect(response.totalCount).toBe(ITEMS_PER_PAGE)
			expect(response.totalPages).toBe(1)
		})

		const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE)
		it(`Should Return a Recovery House List With ${randomN} Items`, async () => {
			const recoveryHousesToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							title: `João ${i}`,
							description,
							fieldId: field.id,
						} as RecoveryHouse),
				)
			await prisma.recoveryHouse.createMany({
				data: recoveryHousesToCreate,
			})

			const response = await recoveryHouseService.findAll({
				itemsPerPage: randomN,
			})
			expect(response.data).toHaveLength(randomN)
			expect(response.totalCount).toBe(ITEMS_PER_PAGE)
			expect(response.totalPages).toBe(Math.ceil(response.totalCount / randomN))
		})
	})

	describe('findOne()', () => {
		it("Should Return Null (Doesn't Exists)", async () => {
			const randomId = uuidv4()
			const recoveryHouse = await recoveryHouseService.findOne(randomId)

			expect(recoveryHouse).toBeNull()
		})

		it('Should Return a Recovery House', async () => {
			const recoveryHouseCreated = await createRecoveryHouse(title, description, field.id)

			const recoveryHouse = await recoveryHouseService.findOne(recoveryHouseCreated.id)
			expect(recoveryHouse).toBeDefined()
		})
	})

	describe('update()', () => {
		it('Should Not Update a Recovery House (Not Found as USER)', async () => {
			try {
				const randomId = uuidv4()
				await recoveryHouseService.update(randomId, user, { title: 'lol' })
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('casa de recuperação', 'a'))
			}
		})

		it('Should Not Update a Recovery House (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await recoveryHouseService.update(randomId, admin, { title: 'lol' })
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('casa de recuperação', 'a'))
			}
		})

		it('Should Not Update a Recovery House (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await recoveryHouseService.update(randomId, webMaster, { title: 'lol' })
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('casa de recuperação', 'a'))
			}
		})

		it('Should Not Update a Recovery House (Different Field as USER)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const recoveryHouse = await createRecoveryHouse(title, description, differentField.id)
				await recoveryHouseService.update(recoveryHouse.id, user, {
					title: 'lol',
				})
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Update a Recovery House (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const recoveryHouse = await createRecoveryHouse(title, description, differentField.id)
				await recoveryHouseService.update(recoveryHouse.id, admin, {
					title: 'lol',
				})
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Update a Recovery House (as USER)', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			const newTitle = 'Abreu'

			const recoveryHouseUpdated = await recoveryHouseService.update(recoveryHouse.id, user, {
				title: newTitle,
			})
			expect(recoveryHouseUpdated).toBeDefined()
			expect(recoveryHouseUpdated.title).toBe(newTitle)
		})

		it('Should Update a Recovery House (as ADMIN)', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			const newTitle = 'Abreu'

			const recoveryHouseUpdated = await recoveryHouseService.update(recoveryHouse.id, admin, {
				title: newTitle,
			})
			expect(recoveryHouseUpdated).toBeDefined()
			expect(recoveryHouseUpdated.title).toBe(newTitle)
		})

		it('Should Update a Recovery House (as WEB MASTER)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			const newTitle = 'Abreu'

			const recoveryHouseUpdated = await recoveryHouseService.update(recoveryHouse.id, webMaster, {
				title: newTitle,
				field: differentField.id,
			})
			expect(recoveryHouseUpdated).toBeDefined()
			expect(recoveryHouseUpdated.title).toBe(newTitle)
			expect(recoveryHouseUpdated.fieldId).toBe(differentField.id)
		})
	})

	describe('remove()', () => {
		it('Should Not Remove a Recovery House (Not Found as USER)', async () => {
			try {
				const randomId = uuidv4()
				await recoveryHouseService.remove(randomId, user)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('casa de recuperação', 'a'))
			}
		})

		it('Should Not Remove a Recovery House (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await recoveryHouseService.remove(randomId, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('casa de recuperação', 'a'))
			}
		})

		it('Should Not Remove a Recovery House (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await recoveryHouseService.remove(randomId, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('casa de recuperação', 'a'))
			}
		})

		it('Should Not Remove a Recovery House (Different Field as USER)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const recoveryHouse = await createRecoveryHouse(title, description, differentField.id)
				await recoveryHouseService.remove(recoveryHouse.id, user)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Remove a Recovery House (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const recoveryHouse = await createRecoveryHouse(title, description, differentField.id)
				await recoveryHouseService.remove(recoveryHouse.id, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Remove a Recovery House (as USER)', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await recoveryHouseService.remove(recoveryHouse.id, user)

			const isRecoveryHouseDeleted = await prisma.recoveryHouse.findFirst({
				where: {
					id: recoveryHouse.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isRecoveryHouseDeleted.deleted).toBeDefined()
		})

		it('Should Remove a Recovery House (as ADMIN)', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await recoveryHouseService.remove(recoveryHouse.id, admin)

			const isRecoveryHouseDeleted = await prisma.recoveryHouse.findFirst({
				where: {
					id: recoveryHouse.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isRecoveryHouseDeleted.deleted).toBeDefined()
		})

		it('Should Remove a Recovery House (as WEB MASTER)', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await recoveryHouseService.remove(recoveryHouse.id, webMaster)

			const isRecoveryHouseDeleted = await prisma.recoveryHouse.findFirst({
				where: {
					id: recoveryHouse.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isRecoveryHouseDeleted.deleted).toBeDefined()
		})
	})

	describe('restore()', () => {
		it('Should Not Restore a Recovery House (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await recoveryHouseService.restore({ ids: [randomId] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('casa de recuperação', 'a'))
			}
		})

		it('Should Not Restore a Recovery House (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await recoveryHouseService.restore({ ids: [randomId] }, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('casa de recuperação', 'a'))
			}
		})

		it('Should Not Restore a Recovery House (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const recoveryHouse = await createRecoveryHouse(title, description, differentField.id)
				await prisma.recoveryHouse.delete({ where: { id: recoveryHouse.id } })
				await recoveryHouseService.restore({ ids: [recoveryHouse.id] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Restore a Recovery House (as ADMIN)', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await prisma.recoveryHouse.delete({ where: { id: recoveryHouse.id } })

			await recoveryHouseService.restore({ ids: [recoveryHouse.id] }, admin)
			const isRecoveryHouseRestored = await prisma.recoveryHouse.findFirst({
				where: {
					id: recoveryHouse.id,
				},
			})

			expect(isRecoveryHouseRestored.deleted).toBeNull()
		})

		it('Should Restore a Recovery House (as WEB MASTER)', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await prisma.recoveryHouse.delete({ where: { id: recoveryHouse.id } })

			await recoveryHouseService.restore({ ids: [recoveryHouse.id] }, webMaster)
			const isRecoveryHouseRestored = await prisma.recoveryHouse.findFirst({
				where: {
					id: recoveryHouse.id,
				},
			})

			expect(isRecoveryHouseRestored.deleted).toBeNull()
		})
	})

	describe('hardRemove()', () => {
		it('Should Not Hard Remove a Recovery House (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await recoveryHouseService.hardRemove({ ids: [randomId] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('casa de recuperação', 'a'))
			}
		})

		it('Should Not Hard Remove a Recovery House (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await recoveryHouseService.hardRemove({ ids: [randomId] }, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('casa de recuperação', 'a'))
			}
		})

		it('Should Not Hard Remove a Recovery House (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const recoveryHouse = await createRecoveryHouse(title, description, differentField.id)
				await prisma.recoveryHouse.delete({ where: { id: recoveryHouse.id } })
				await recoveryHouseService.hardRemove({ ids: [recoveryHouse.id] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should HardRemove a Recovery House (as ADMIN)', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await prisma.recoveryHouse.delete({ where: { id: recoveryHouse.id } })

			await recoveryHouseService.hardRemove({ ids: [recoveryHouse.id] }, admin)
			const isRecoveryHouseRemoved = await prisma.recoveryHouse.findFirst({
				where: {
					id: recoveryHouse.id,
					deleted: { not: new Date() },
				},
			})
			expect(isRecoveryHouseRemoved).toBeNull()
		})

		it('Should HardRemove a Recovery House (as WEB MASTER)', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await prisma.recoveryHouse.delete({ where: { id: recoveryHouse.id } })

			await recoveryHouseService.hardRemove({ ids: [recoveryHouse.id] }, webMaster)
			const isRecoveryHouseRemoved = await prisma.recoveryHouse.findFirst({
				where: {
					id: recoveryHouse.id,
					deleted: { not: new Date() },
				},
			})
			expect(isRecoveryHouseRemoved).toBeNull()
		})
	})
})
