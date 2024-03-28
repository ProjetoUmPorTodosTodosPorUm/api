import { Field, Role, User } from '@prisma/client'
import { PrismaService } from 'src/prisma/prisma.service'
import * as bcrypt from 'bcrypt'
import { Test } from '@nestjs/testing'
import * as request from 'supertest'
import { ITEMS_PER_PAGE } from 'src/constants'
import { createField, createUser, getToken, setAppConfig } from 'src/utils/test'
import { NestExpressApplication } from '@nestjs/platform-express'
import { ConfigModule } from '@nestjs/config'
import configuration from 'src/config/configuration'
import { AuthModule } from 'src/auth/auth.module'
import { PrismaModule } from 'src/prisma/prisma.module'
import { UserModule } from 'src/user/user.module'
import { FieldModule } from 'src/field/field.module'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseInterceptor } from 'src/response.interceptor'

jest.setTimeout(30 * 1_000)

describe('User Controller E2E', () => {
	let app: NestExpressApplication
	let prisma: PrismaService

	let field: Field
	let user: User
	let userToken: string
	let admin: User
	let adminToken: string
	let webMaster: User
	let webMasterToken: string

	const password = '12345678'
	const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync())
	const baseRoute = '/user'

	const firstName = 'João'
	const email = 'joao@email.com'

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

		app = moduleRef.createNestApplication()
		setAppConfig(app)
		await app.init()
		prisma = moduleRef.get(PrismaService)
	})

	afterAll(async () => {
		await app.close()
	})

	beforeEach(async () => {
		await prisma.cleanDataBase()

		field = await createField(prisma, 'América', 'Brasil', 'Rio de Janeiro', 'AMEBRRJ01', 'Designação')

		user = await createUser(prisma, 'João', 'user@example.com', hashedPassword, Role.VOLUNTEER, field.id)
		userToken = await getToken(app, user.email, password)

		admin = await createUser(prisma, 'Sigma', 'admin@example.com', hashedPassword, Role.ADMIN, field.id)
		adminToken = await getToken(app, admin.email, password)

		webMaster = await createUser(prisma, 'WebMaster', 'ultra.sigma@email.com', hashedPassword, Role.WEB_MASTER)
		webMasterToken = await getToken(app, webMaster.email, password)
	})

	describe('Private Routes (as Non Logged User)', () => {
		it('Should Not Return an User List', async () => {
			await request(app.getHttpServer()).get(baseRoute).expect(401)
		})

		it('Should Not Return an User', async () => {
			await request(app.getHttpServer()).get(`${baseRoute}/${user.id}`).expect(401)
		})

		it('Should Not Update User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			await request(app.getHttpServer()).put(`${baseRoute}/${user.id}`).send({ firstName: 'João' }).expect(401)
		})

		it('Should Not Remove User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			await request(app.getHttpServer()).delete(`${baseRoute}/${user.id}`).expect(401)
		})

		it('Should Not Return Own User', async () => {
			await request(app.getHttpServer()).get(`${baseRoute}/me`).expect(401)
		})

		it('Should Not Update Own User', async () => {
			const newName = 'João'
			const newPassword = 'anotherone'

			await request(app.getHttpServer())
				.put(`${baseRoute}/me`)
				.send({
					firstName: newName,
					password: newPassword,
				})
				.expect(401)
		})

		it('Should Not Remove Own User', async () => {
			await request(app.getHttpServer()).delete(`${baseRoute}/me`).expect(401)
		})

		it('Should Not Restore User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			await prisma.user.delete({ where: { email: user.email } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.send({ ids: [user.id] })
				.expect(401)
		})

		it('Should Not Hard Remove User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			await prisma.user.delete({ where: { email: user.email } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.send({ ids: [user.id] })
				.expect(401)
		})

		it('Should Not Restrict a User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			await request(app.getHttpServer()).put(`${baseRoute}/restrict`).send({ id: user.id }).expect(401)
		})

		it('Should Not Unrestrict a User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			await request(app.getHttpServer()).put(`${baseRoute}/unrestrict`).send({ id: user.id }).expect(401)
		})
	})

	describe('Private Routes (as Logged VOLUNTEER)', () => {
		it('Should Not Return an User List', async () => {
			await request(app.getHttpServer()).get(baseRoute).set('Authorization', `bearer ${userToken}`).expect(403)
		})

		it('Should Not Return an User', async () => {
			await request(app.getHttpServer())
				.get(`${baseRoute}/${user.id}`)
				.set('Authorization', `bearer ${userToken}`)
				.expect(403)
		})

		it('Should Not Update User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			await request(app.getHttpServer())
				.put(`${baseRoute}/${user.id}`)
				.set('Authorization', `bearer ${userToken}`)
				.send({ firstName: 'João' })
				.expect(403)
		})

		it('Should Not Remove User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/${user.id}`)
				.set('Authorization', `bearer ${userToken}`)
				.expect(403)
		})

		it('Should Return Own User', async () => {
			const response = await request(app.getHttpServer())
				.get(`${baseRoute}/me`)
				.set('Authorization', `bearer ${userToken}`)
				.expect(200)

			expect(response.body.data.email).toBe(user.email)
			expect(response.body.data.hashedPassword).toBeUndefined()
			expect(response.body.data.hashedRefreshToken).toBeUndefined()
			expect(response.body.data.deleted).toBeUndefined()
		})

		it('Should Update Own User', async () => {
			const newName = 'João'
			const newPassword = 'anotherone'

			const response = await request(app.getHttpServer())
				.put(`${baseRoute}/me`)
				.set('Authorization', `bearer ${userToken}`)
				.send({
					firstName: newName,
					password: newPassword,
				})
				.expect(200)

			expect(response.body.data.firstName).toBe(newName)
			expect(response.body.data.hashedPassword).toBeUndefined()
			expect(response.body.data.hashedRefreshToken).toBeUndefined()
			expect(response.body.data.deleted).toBeUndefined()

			const newHashedPassword = (await prisma.user.findUnique({ where: { email: user.email } })).hashedPassword
			expect(user.hashedPassword).not.toBe(newHashedPassword)
		})

		it('Should Remove Own User', async () => {
			const response = await request(app.getHttpServer())
				.delete(`${baseRoute}/me`)
				.set('Authorization', `bearer ${userToken}`)
				.expect(200)
			expect(response.body.data.hashedPassword).toBeUndefined()
			expect(response.body.data.hashedRefreshToken).toBeUndefined()
			expect(response.body.data.deleted).toBeUndefined()

			const isUserDeleted = await prisma.user.findFirst({
				where: {
					email: user.email,
					deleted: { lte: new Date() },
				},
			})
			expect(isUserDeleted).toBeDefined()
		})

		it('Should Not Restore User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			await prisma.user.delete({ where: { email: user.email } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `bearer ${userToken}`)
				.send({ ids: [user.id] })
				.expect(403)
		})

		it('Should Not Hard Remove User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			await prisma.user.delete({ where: { email: user.email } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `bearer ${userToken}`)
				.send({ ids: [user.id] })
				.expect(403)
		})

		it('Should Not Restrict a User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			await request(app.getHttpServer())
				.put(`${baseRoute}/restrict`)
				.set('Authorization', `bearer ${userToken}`)
				.send({ id: user.id })
				.expect(403)
		})

		it('Should Not Unrestrict a User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			await request(app.getHttpServer())
				.put(`${baseRoute}/unrestrict`)
				.set('Authorization', `bearer ${userToken}`)
				.send({ id: user.id })
				.expect(403)
		})
	})

	describe('Private Routes (as ADMIN)', () => {
		it(`Should Return an User List With ${ITEMS_PER_PAGE} Items`, async () => {
			await prisma.cleanDataBase()
			field = await createField(prisma, 'América', 'Brasil', 'Rio de Janeiro', 'AMEBRRJ01', 'Designação')

			const usersToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							firstName: `João ${i}`,
							email: `user${i}@example.com`,
							hashedPassword,
							fieldId: field.id,
						} as User),
				)
			await prisma.user.createMany({
				data: usersToCreate,
			})

			const response = await request(app.getHttpServer())
				.get(baseRoute)
				.set('Authorization', `bearer ${adminToken}`)
				.expect(200)

			expect(response.body.data).toHaveLength(ITEMS_PER_PAGE)
			expect(response.body.data[0].hashedPassword).toBeUndefined()
			expect(response.body.data[0].hashedRefreshToken).toBeUndefined()
			expect(response.body.data[0].deleted).toBeNull()
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(String(1))
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
							firstName: `João ${i}`,
							email: `user${i}@example.com`,
							hashedPassword,
							fieldId: field.id,
						} as User),
				)
			await prisma.user.createMany({
				data: usersToCreate,
			})

			const response = await request(app.getHttpServer())
				.get(baseRoute)
				.set('Authorization', `bearer ${adminToken}`)
				.query({ itemsPerPage: randomNUsers })
				.expect(200)

			expect(response.body.data).toHaveLength(randomNUsers)
			expect(response.body.data[0].hashedPassword).toBeUndefined()
			expect(response.body.data[0].hashedRefreshToken).toBeUndefined()
			expect(response.body.data[0].deleted).toBeNull()
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(
				String(Math.ceil(+response.headers['x-total-count'] / randomNUsers)),
			)
		})

		it('Should Return an User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			const response = await request(app.getHttpServer())
				.get(`${baseRoute}/${user.id}`)
				.set('Authorization', `bearer ${adminToken}`)
				.expect(200)

			expect(response.body.data).toBeDefined()
			expect(response.body.data.hashedPassword).toBeUndefined()
			expect(response.body.data.hashedRefreshToken).toBeUndefined()
			expect(response.body.data.deleted).toBeUndefined()
		})

		it('Should Not Update an User (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const newFirstName = 'Jack'
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, differentField.id)

			await request(app.getHttpServer())
				.put(`${baseRoute}/${user.id}`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ firstName: newFirstName })
				.expect(403)
		})

		it('Should Not Change Role From User (ADMIN -> VOLUNTEER)', async () => {
			const newRole = Role.VOLUNTEER
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.ADMIN, field.id)

			const res = await request(app.getHttpServer())
				.put(`${baseRoute}/${user.id}`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ role: newRole })
				.expect(200)

			expect(res.body.data.role).toBe(Role.ADMIN)
		})

		it('Should Not Change Role From User (VOLUNTEER -> WEB_MASTER)', async () => {
			const newRole = Role.WEB_MASTER
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			const res = await request(app.getHttpServer())
				.put(`${baseRoute}/${user.id}`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ role: newRole })
				.expect(200)

			expect(res.body.data.role).toBe(Role.VOLUNTEER)
		})

		it('Should Update an User', async () => {
			const newFirstName = 'Jack'
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			const response = await request(app.getHttpServer())
				.put(`${baseRoute}/${user.id}`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ firstName: newFirstName })
				.expect(200)

			expect(response.body.data.firstName).toBe(newFirstName)
			expect(response.body.data.hashedPassword).toBeUndefined()
			expect(response.body.data.hashedRefreshToken).toBeUndefined()
			expect(response.body.data.deleted).toBeUndefined()
		})

		it('Should Not Remove an User (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, differentField.id)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${user.id}`)
				.set('Authorization', `bearer ${adminToken}`)
				.expect(403)
		})

		it('Should Not Remove an User (Another Admin Same Field)', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.ADMIN, field.id)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${user.id}`)
				.set('Authorization', `bearer ${adminToken}`)
				.expect(403)
		})

		it('Should Remove an User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			const response = await request(app.getHttpServer())
				.delete(`${baseRoute}/${user.id}`)
				.set('Authorization', `bearer ${adminToken}`)
				.expect(200)

			expect(response.body.data.hashedPassword).toBeUndefined()
			expect(response.body.data.hashedRefreshToken).toBeUndefined()
			expect(response.body.data.deleted).toBeUndefined()

			const isUserDeleted = await prisma.user.findFirst({
				where: {
					email: user.email,
					deleted: { lte: new Date() },
				},
			})
			expect(isUserDeleted).toBeDefined()
		})

		it('Should Return Own User', async () => {
			const response = await request(app.getHttpServer())
				.get(`${baseRoute}/me`)
				.set('Authorization', `bearer ${adminToken}`)
				.expect(200)

			expect(response.body.data).toBeDefined()
			expect(response.body.data.hashedPassword).toBeUndefined()
			expect(response.body.data.hashedRefreshToken).toBeUndefined()
			expect(response.body.data.deleted).toBeUndefined()
		})

		it('Should Update Own User', async () => {
			const newFirstName = 'Brabo'
			const response = await request(app.getHttpServer())
				.put(`${baseRoute}/me`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ firstName: newFirstName })
				.expect(200)

			expect(response.body.data.firstName).toBe(newFirstName)
			expect(response.body.data.hashedPassword).toBeUndefined()
			expect(response.body.data.hashedRefreshToken).toBeUndefined()
			expect(response.body.data.deleted).toBeUndefined()
		})

		it('Should Remove Own User', async () => {
			const response = await request(app.getHttpServer())
				.delete(`${baseRoute}/me`)
				.set('Authorization', `bearer ${adminToken}`)
				.expect(200)

			expect(response.body.data.hashedPassword).toBeUndefined()
			expect(response.body.data.hashedRefreshToken).toBeUndefined()
			expect(response.body.data.deleted).toBeUndefined()

			const isUserDeleted = await prisma.user.findFirst({
				where: {
					email: admin.email,
					deleted: { lte: new Date() },
				},
			})
			expect(isUserDeleted).toBeDefined()
		})

		it('Should Not Restore User (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, differentField.id)
			await prisma.user.delete({ where: { id: user.id } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ ids: [user.id] })
				.expect(403)
		})

		it('Should Restore User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			await prisma.user.delete({ where: { id: user.id } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ ids: [user.id] })
				.expect(200)

			const isUserRestored = await prisma.user.findFirst({
				where: {
					email: user.email,
					deleted: null,
				},
			})
			expect(isUserRestored.deleted).toBeNull()
		})

		it('Should Not Hard Remove User (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, differentField.id)
			await prisma.user.delete({ where: { id: user.id } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ ids: [user.id] })
				.expect(403)
		})

		it('Should Hard Remove User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			await prisma.user.delete({ where: { id: user.id } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ ids: [user.id] })
				.expect(200)

			const isUserRemoved = await prisma.user.findFirst({
				where: {
					email: user.email,
					deleted: { not: new Date() },
				},
			})
			expect(isUserRemoved).toBeNull()
		})

		it('Should Not Restrict a User (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, differentField.id)

			await request(app.getHttpServer())
				.put(`${baseRoute}/restrict`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ id: user.id })
				.expect(403)
		})

		it('Should Not Restrict a User (Another ADMIN)', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.ADMIN, field.id)

			await request(app.getHttpServer())
				.put(`${baseRoute}/restrict`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ id: user.id })
				.expect(403)
		})

		it('Should Restrict a User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			await request(app.getHttpServer())
				.put(`${baseRoute}/restrict`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ id: user.id })
				.expect(200)

			const isUserRestricted = await prisma.user.findUnique({
				where: { id: user.id },
			})
			expect(isUserRestricted.restricted).toBeDefined()
		})

		it('Should Not Unrestrict a User (different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, differentField.id)

			await request(app.getHttpServer())
				.put(`${baseRoute}/unrestrict`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ id: user.id })
				.expect(403)
		})

		it('Should Not Unrestrict a User (Another ADMIN)', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.ADMIN, field.id)

			await request(app.getHttpServer())
				.put(`${baseRoute}/unrestrict`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ id: user.id })
				.expect(403)
		})

		it('Should Unrestrict a User', async () => {
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

			await request(app.getHttpServer())
				.put(`${baseRoute}/unrestrict`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ id: user.id })
				.expect(200)

			const isUserUnrestricted = await prisma.user.findUnique({
				where: { id: user.id },
			})
			expect(isUserUnrestricted.restricted).toBeNull()
		})
	})

	describe('Private Routes (as WEB MASTER)', () => {
		it(`Should Return an User List With ${ITEMS_PER_PAGE} Items`, async () => {
			await prisma.cleanDataBase()
			field = await createField(prisma, 'América', 'Brasil', 'Rio de Janeiro', 'AMEBRRJ01', 'Designação')

			const usersToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							firstName: `João ${i}`,
							email: `user${i}@example.com`,
							hashedPassword,
							fieldId: field.id,
						} as User),
				)
			await prisma.user.createMany({
				data: usersToCreate,
			})

			const response = await request(app.getHttpServer())
				.get(baseRoute)
				.set('Authorization', `bearer ${webMasterToken}`)
				.expect(200)

			expect(response.body.data).toHaveLength(ITEMS_PER_PAGE)
			expect(response.body.data[0].hashedPassword).toBeUndefined()
			expect(response.body.data[0].hashedRefreshToken).toBeUndefined()
			expect(response.body.data[0].deleted).toBeNull()
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(String(1))
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
							firstName: `João ${i}`,
							email: `user${i}@example.com`,
							hashedPassword,
							fieldId: field.id,
						} as User),
				)
			await prisma.user.createMany({
				data: usersToCreate,
			})

			const response = await request(app.getHttpServer())
				.get(baseRoute)
				.set('Authorization', `bearer ${webMasterToken}`)
				.query({ itemsPerPage: randomNUsers })
				.expect(200)

			expect(response.body.data).toHaveLength(randomNUsers)
			expect(response.body.data[0].hashedPassword).toBeUndefined()
			expect(response.body.data[0].hashedRefreshToken).toBeUndefined()
			expect(response.body.data[0].deleted).toBeNull()
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(
				String(Math.ceil(+response.headers['x-total-count'] / randomNUsers)),
			)
		})

		it('Should Return an User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			const response = await request(app.getHttpServer())
				.get(`${baseRoute}/${user.id}`)
				.set('Authorization', `bearer ${webMasterToken}`)
				.expect(200)

			expect(response.body.data).toBeDefined()
			expect(response.body.data.hashedPassword).toBeUndefined()
			expect(response.body.data.hashedRefreshToken).toBeUndefined()
			expect(response.body.data.deleted).toBeUndefined()
		})

		it('Should Update an User', async () => {
			const newFirstName = 'Jack'
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			const response = await request(app.getHttpServer())
				.put(`${baseRoute}/${user.id}`)
				.set('Authorization', `bearer ${webMasterToken}`)
				.send({ firstName: newFirstName })
				.expect(200)

			expect(response.body.data.firstName).toBe(newFirstName)
			expect(response.body.data.hashedPassword).toBeUndefined()
			expect(response.body.data.hashedRefreshToken).toBeUndefined()
			expect(response.body.data.deleted).toBeUndefined()
		})

		it('Should Remove an User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			const response = await request(app.getHttpServer())
				.delete(`${baseRoute}/${user.id}`)
				.set('Authorization', `bearer ${webMasterToken}`)
				.expect(200)

			expect(response.body.data.hashedPassword).toBeUndefined()
			expect(response.body.data.hashedRefreshToken).toBeUndefined()
			expect(response.body.data.deleted).toBeUndefined()

			const isUserDeleted = await prisma.user.findFirst({
				where: {
					email: user.email,
					deleted: { lte: new Date() },
				},
			})
			expect(isUserDeleted).toBeDefined()
		})

		it('Should Return Own User', async () => {
			const response = await request(app.getHttpServer())
				.get(`${baseRoute}/me`)
				.set('Authorization', `bearer ${webMasterToken}`)
				.expect(200)

			expect(response.body.data).toBeDefined()
			expect(response.body.data.hashedPassword).toBeUndefined()
			expect(response.body.data.hashedRefreshToken).toBeUndefined()
			expect(response.body.data.deleted).toBeUndefined()
		})

		it('Should Update Own User', async () => {
			const newFirstName = 'Brabo'
			const response = await request(app.getHttpServer())
				.put(`${baseRoute}/me`)
				.set('Authorization', `bearer ${webMasterToken}`)
				.send({ firstName: newFirstName })
				.expect(200)

			expect(response.body.data.firstName).toBe(newFirstName)
			expect(response.body.data.hashedPassword).toBeUndefined()
			expect(response.body.data.hashedRefreshToken).toBeUndefined()
			expect(response.body.data.deleted).toBeUndefined()
		})

		it('Should Remove Own User', async () => {
			const response = await request(app.getHttpServer())
				.delete(`${baseRoute}/me`)
				.set('Authorization', `bearer ${webMasterToken}`)
				.expect(200)

			expect(response.body.data.hashedPassword).toBeUndefined()
			expect(response.body.data.hashedRefreshToken).toBeUndefined()
			expect(response.body.data.deleted).toBeUndefined()

			const isUserDeleted = await prisma.user.findFirst({
				where: {
					email: admin.email,
					deleted: { lte: new Date() },
				},
			})
			expect(isUserDeleted).toBeDefined()
		})

		it('Should Restore User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			await prisma.user.delete({ where: { id: user.id } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `bearer ${webMasterToken}`)
				.send({ ids: [user.id] })
				.expect(200)

			const isUserRestored = await prisma.user.findFirst({
				where: {
					email: user.email,
					deleted: null,
				},
			})
			expect(isUserRestored.deleted).toBeNull()
		})

		it('Should Hard Remove User', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)
			await prisma.user.delete({ where: { id: user.id } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `bearer ${webMasterToken}`)
				.send({ ids: [user.id] })
				.expect(200)

			const isUserRemoved = await prisma.user.findFirst({
				where: {
					email: user.email,
					deleted: { not: new Date() },
				},
			})
			expect(isUserRemoved).toBeNull()
		})

		it('Should Restrict a User (Different Field)', async () => {
			const user = await createUser(prisma, firstName, email, hashedPassword, Role.VOLUNTEER, field.id)

			await request(app.getHttpServer())
				.put(`${baseRoute}/restrict`)
				.set('Authorization', `bearer ${webMasterToken}`)
				.send({ id: user.id })
				.expect(200)

			const isUserRestricted = await prisma.user.findUnique({
				where: { id: user.id },
			})
			expect(isUserRestricted.restricted).toBeDefined()
		})

		it('Should Unrestrict a User', async () => {
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

			await request(app.getHttpServer())
				.put(`${baseRoute}/unrestrict`)
				.set('Authorization', `bearer ${webMasterToken}`)
				.send({ id: user.id })
				.expect(200)

			const isUserUnrestricted = await prisma.user.findUnique({
				where: { id: user.id },
			})
			expect(isUserUnrestricted.restricted).toBeNull()
		})
	})
})
