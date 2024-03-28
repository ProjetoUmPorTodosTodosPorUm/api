import { NestExpressApplication } from '@nestjs/platform-express'
import { RecoveryHouse, Field, Role, User } from '@prisma/client'
import { PrismaService } from 'src/prisma/prisma.service'
import * as bcrypt from 'bcrypt'
import * as request from 'supertest'
import { Test } from '@nestjs/testing'
import { createField, createUser, getToken, setAppConfig } from 'src/utils/test'
import { ITEMS_PER_PAGE } from 'src/constants'

import { ConfigModule } from '@nestjs/config'
import configuration from 'src/config/configuration'
import { AuthModule } from 'src/auth/auth.module'
import { PrismaModule } from 'src/prisma/prisma.module'
import { UserModule } from 'src/user/user.module'
import { FieldModule } from 'src/field/field.module'
import { RecoveryHouseModule } from 'src/recovery-house/recovery-house.module'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseInterceptor } from 'src/response.interceptor'

describe('Recovery House Controller E2E', () => {
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
	const baseRoute = '/recovery-house'

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

		user = await createUser(prisma, 'João', 'volunteer@email.com', hashedPassword, Role.VOLUNTEER, field.id)
		userToken = await getToken(app, user.email, password)

		admin = await createUser(prisma, 'Admin', 'sigma@email.com', hashedPassword, Role.ADMIN, field.id)
		adminToken = await getToken(app, admin.email, password)

		webMaster = await createUser(prisma, 'WebMaster', 'ultra.sigma@email.com', hashedPassword, Role.WEB_MASTER)
		webMasterToken = await getToken(app, webMaster.email, password)
	})

	describe('Private Routes (as Non Logged User)', () => {
		it('Should Not Create a Recovery House', async () => {
			await request(app.getHttpServer())
				.post(baseRoute)
				.send({
					title,
					description,
					field: field.id,
				})
				.expect(401)
		})

		it('Should Not Update a Recovery House', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await request(app.getHttpServer()).put(`${baseRoute}/${recoveryHouse.id}`).send({ title: 'Mario' }).expect(401)
		})

		it('Should Not Remove a Recovery House', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)

			await request(app.getHttpServer()).delete(`${baseRoute}/${recoveryHouse.id}`).expect(401)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${recoveryHouse.id}`).expect(200)

			expect(res.body.data).toBeTruthy()
		})

		it('Should Not Restore a Recovery House', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await prisma.recoveryHouse.delete({ where: { id: recoveryHouse.id } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.send({ ids: [recoveryHouse.id] })
				.expect(401)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${recoveryHouse.id}`).expect(200)

			expect(res.body.data).toBeNull()
		})

		it('Should Not HardRemove a Recovery House', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await prisma.recoveryHouse.delete({ where: { id: recoveryHouse.id } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.send({ ids: [recoveryHouse.id] })
				.expect(401)

			// Bypass Soft Delete
			const query = prisma.recoveryHouse.findUnique({
				where: { id: recoveryHouse.id },
			})
			const [recoveryHouseExists] = await prisma.$transaction([query])
			expect(recoveryHouseExists).toBeTruthy()
		})
	})

	describe('Private Routes (as Logged VOLUNTEER)', () => {
		it('Should Create a Recovery House', async () => {
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `Bearer ${userToken}`)
				.send({
					title,
					description,
				})
				.expect(201)

			expect(res.body.data.title).toBe(title)
			expect(res.body.data.description).toBe(description)
		})

		it('Should Not Update a Recovery House (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const recoveryHouse = await createRecoveryHouse(title, description, differentField.id)
			const newTitle = 'Mario'

			await request(app.getHttpServer())
				.put(`${baseRoute}/${recoveryHouse.id}`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ title: newTitle })
				.expect(403)
		})

		it('Should Update a Recovery House', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			const newTitle = 'Mario'

			const res = await request(app.getHttpServer())
				.put(`${baseRoute}/${recoveryHouse.id}`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ title: newTitle })
				.expect(200)

			expect(res.body.data.title).toBe(newTitle)
		})

		it('Should Not Remove a Recovery House (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const recoveryHouse = await createRecoveryHouse(title, description, differentField.id)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/${recoveryHouse.id}`)
				.set('Authorization', `Bearer ${userToken}`)
				.expect(403)
		})

		it('Should Remove a Recovery House', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${recoveryHouse.id}`)
				.set('Authorization', `Bearer ${userToken}`)
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${recoveryHouse.id}`).expect(200)

			expect(res.body.data).toBe(null)
		})

		it('Should Not Restore a Recovery House', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await prisma.recoveryHouse.delete({ where: { id: recoveryHouse.id } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ ids: [recoveryHouse.id] })
				.expect(403)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${recoveryHouse.id}`).expect(200)

			expect(res.body.data).toBeNull()
		})

		it('Should Not HardRemove a Recovery House', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await prisma.recoveryHouse.delete({ where: { id: recoveryHouse.id } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ ids: [recoveryHouse.id] })
				.expect(403)

			// Bypass Soft Delete
			const query = prisma.recoveryHouse.findUnique({
				where: { id: recoveryHouse.id },
			})
			const [recoveryHouseExists] = await prisma.$transaction([query])
			expect(recoveryHouseExists).toBeTruthy()
		})
	})

	describe('Private Routes (as Logged ADMIN)', () => {
		it('Should Create a Recovery House', async () => {
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					title,
					description,
				})
				.expect(201)

			expect(res.body.data.title).toBe(title)
			expect(res.body.data.description).toBe(description)
		})

		it('Should Not Update a Recovery House (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const recoveryHouse = await createRecoveryHouse(title, description, differentField.id)
			const newTitle = 'Mario'

			await request(app.getHttpServer())
				.put(`${baseRoute}/${recoveryHouse.id}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ title: newTitle })
				.expect(403)
		})

		it('Should Update a Recovery House', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			const newTitle = 'Mario'

			const res = await request(app.getHttpServer())
				.put(`${baseRoute}/${recoveryHouse.id}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ title: newTitle })
				.expect(200)

			expect(res.body.data.title).toBe(newTitle)
		})

		it('Should Not Remove a Recovery House (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const recoveryHouse = await createRecoveryHouse(title, description, differentField.id)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${recoveryHouse.id}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(403)
		})

		it('Should Remove a Recovery House', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${recoveryHouse.id}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${recoveryHouse.id}`).expect(200)

			expect(res.body.data).toBe(null)
		})

		it('Should Not Restore a Recovery House (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const recoveryHouse = await createRecoveryHouse(title, description, differentField.id)
			await prisma.recoveryHouse.delete({ where: { id: recoveryHouse.id } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ ids: [recoveryHouse.id] })
				.expect(403)
		})

		it('Should Restore a Recovery House', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await prisma.recoveryHouse.delete({ where: { id: recoveryHouse.id } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ ids: [recoveryHouse.id] })
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${recoveryHouse.id}`).expect(200)

			expect(res.body.data).toBeTruthy()
		})

		it('Should Not HardRemove a Recovery House (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const recoveryHouse = await createRecoveryHouse(title, description, differentField.id)
			await prisma.recoveryHouse.delete({ where: { id: recoveryHouse.id } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ ids: [recoveryHouse.id] })
				.expect(403)
		})

		it('Should HardRemove a Recovery House', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await prisma.recoveryHouse.delete({ where: { id: recoveryHouse.id } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ ids: [recoveryHouse.id] })
				.expect(200)

			// Bypass Soft Delete
			const query = prisma.recoveryHouse.findUnique({
				where: { id: recoveryHouse.id },
			})
			const [recoveryHouseExists] = await prisma.$transaction([query])
			expect(recoveryHouseExists).toBeNull()
		})
	})

	describe('Private Routes (as Logged WEB MASTER)', () => {
		it('Should Not Create a Recovery House (Missing Field)', async () => {
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({
					title,
					description,
				})
				.expect(400)
		})

		it('Should Create a Recovery House', async () => {
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({
					title,
					description,
					field: field.id,
				})
				.expect(201)

			expect(res.body.data.title).toBe(title)
			expect(res.body.data.description).toBe(description)
		})

		it('Should Update a Recovery House', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			const newTitle = 'Mario'

			const res = await request(app.getHttpServer())
				.put(`${baseRoute}/${recoveryHouse.id}`)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({
					title: newTitle,
					field: differentField.id,
				})
				.expect(200)

			expect(res.body.data.title).toBe(newTitle)
			expect(res.body.data.fieldId).toBe(differentField.id)
		})

		it('Should Remove a Recovery House', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${recoveryHouse.id}`)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${recoveryHouse.id}`).expect(200)

			expect(res.body.data).toBe(null)
		})

		it('Should Restore a Recovery House', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await prisma.recoveryHouse.delete({ where: { id: recoveryHouse.id } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({ ids: [recoveryHouse.id] })
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${recoveryHouse.id}`).expect(200)

			expect(res.body.data).toBeTruthy()
		})

		it('Should HardRemove a Recovery House', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)
			await prisma.recoveryHouse.delete({ where: { id: recoveryHouse.id } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({ ids: [recoveryHouse.id] })
				.expect(200)

			// Bypass Soft Delete
			const query = prisma.recoveryHouse.findUnique({
				where: { id: recoveryHouse.id },
			})
			const [recoveryHouseExists] = await prisma.$transaction([query])
			expect(recoveryHouseExists).toBeNull()
		})
	})

	describe('Public Routes (as Non Logged User)', () => {
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

			const response = await request(app.getHttpServer()).get(baseRoute).expect(200)

			expect(response.body.data).toHaveLength(ITEMS_PER_PAGE)
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(String(1))
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

			const response = await request(app.getHttpServer()).get(baseRoute).query({ itemsPerPage: randomN }).expect(200)

			expect(response.body.data).toHaveLength(randomN)
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(String(Math.ceil(+response.headers['x-total-count'] / randomN)))
		})

		it('Should Return a Recovery House', async () => {
			const recoveryHouse = await createRecoveryHouse(title, description, field.id)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${recoveryHouse.id}`).expect(200)

			expect(res.body.data.title).toBe(title)
			expect(res.body.data.description).toBe(description)
		})
	})
})
