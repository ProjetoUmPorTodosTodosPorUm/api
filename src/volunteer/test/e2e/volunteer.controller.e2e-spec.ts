import { Field, Role, User, Volunteer } from '@prisma/client'
import { PrismaService } from 'src/prisma/prisma.service'
import { Test } from '@nestjs/testing'
import { createUser, createField, getToken, setAppConfig } from 'src/utils/test'
import * as bcrypt from 'bcrypt'
import * as request from 'supertest'
import { ITEMS_PER_PAGE } from 'src/constants'
import { NestExpressApplication } from '@nestjs/platform-express'

import { ConfigModule } from '@nestjs/config'
import configuration from 'src/config/configuration'
import { AuthModule } from 'src/auth/auth.module'
import { UserModule } from 'src/user/user.module'
import { PrismaModule } from 'src/prisma/prisma.module'
import { VolunteerModule } from 'src/volunteer/volunteer.module'
import { FieldModule } from 'src/field/field.module'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseInterceptor } from 'src/response.interceptor'

describe('Volunteer Controller E2E', () => {
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
	const baseRoute = '/volunteer'

	const firstName = 'Mario'
	const joinedDate = new Date('2022-01-01')

	const createVolunteer = async (firstName: string, joinedDate: Date, field: string) =>
		await prisma.volunteer.create({
			data: {
				firstName,
				joinedDate,
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
				VolunteerModule,
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

		user = await createUser(prisma, 'João', 'volunteer@email.com', hashedPassword, Role.VOLUNTEER, field.id)
		userToken = await getToken(app, user.email, password)

		admin = await createUser(prisma, 'Admin', 'sigma@email.com', hashedPassword, Role.ADMIN, field.id)
		adminToken = await getToken(app, admin.email, password)

		webMaster = await createUser(prisma, 'WebMaster', 'ultra.sigma@email.com', hashedPassword, Role.WEB_MASTER)
		webMasterToken = await getToken(app, webMaster.email, password)
	})

	describe('Private Routes (as Non Logged User)', () => {
		it('Should Not Create a Volunteer', async () => {
			await request(app.getHttpServer())
				.post(baseRoute)
				.send({
					firstName,
					joinedDate,
				})
				.expect(401)
		})

		it('Should Not Update a Volunteer', async () => {
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)
			await request(app.getHttpServer()).put(`${baseRoute}/${volunteer.id}`).send({ lastName: 'Abreu' }).expect(401)
		})

		it('Should Not Remove a Volunteer', async () => {
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)
			await request(app.getHttpServer()).delete(`${baseRoute}/${volunteer.id}`).expect(401)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${volunteer.id}`).expect(200)

			expect(res.body.data).toBeTruthy()
		})

		it('Should Not Restore a Volunteer', async () => {
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)
			await prisma.volunteer.delete({ where: { id: volunteer.id } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.send({ ids: [volunteer.id] })
				.expect(401)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${volunteer.id}`).expect(200)

			expect(res.body.data).toBeNull()
		})

		it('Should Not HardRemove a Volunteer', async () => {
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)
			await prisma.volunteer.delete({ where: { id: volunteer.id } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.send({ ids: [volunteer.id] })
				.expect(401)

			// Bypass Soft Delete
			const query = prisma.volunteer.findUnique({
				where: { id: volunteer.id },
			})
			const [volunteerExists] = await prisma.$transaction([query])
			expect(volunteerExists).toBeTruthy()
		})
	})

	describe('Private Routes (as Logged VOLUNTEER)', () => {
		it('Should Create a Volunteer', async () => {
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `Bearer ${userToken}`)
				.send({
					firstName,
					joinedDate,
				})
				.expect(201)

			expect(res.body.data.firstName).toBe(firstName)
			expect(res.body.data.joinedDate).toBe(joinedDate.toISOString())
		})

		it('Should Not Update a Volunteer (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const volunteer = await createVolunteer(firstName, joinedDate, differentField.id)
			const lastName = 'Abreu'

			await request(app.getHttpServer())
				.put(`${baseRoute}/${volunteer.id}`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ lastName })
				.expect(403)
		})

		it('Should Update a Volunteer', async () => {
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)
			const lastName = 'Abreu'

			const res = await request(app.getHttpServer())
				.put(`${baseRoute}/${volunteer.id}`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ lastName })
				.expect(200)

			expect(res.body.data.lastName).toBe(lastName)
		})

		it('Should Not Remove a Volunteer (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const volunteer = await createVolunteer(firstName, joinedDate, differentField.id)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/${volunteer.id}`)
				.set('Authorization', `Bearer ${userToken}`)
				.expect(403)
		})

		it('Should Remove a Volunteer', async () => {
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${volunteer.id}`)
				.set('Authorization', `Bearer ${userToken}`)
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${volunteer.id}`).expect(200)

			expect(res.body.data).toBe(null)
		})

		it('Should Not Restore a Volunteer', async () => {
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)
			await prisma.volunteer.delete({ where: { id: volunteer.id } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ ids: [volunteer.id] })
				.expect(403)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${volunteer.id}`).expect(200)

			expect(res.body.data).toBeNull()
		})

		it('Should Not HardRemove a Volunteer', async () => {
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)
			await prisma.volunteer.delete({ where: { id: volunteer.id } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ ids: [volunteer.id] })
				.expect(403)

			// Bypass Soft Delete
			const query = prisma.volunteer.findUnique({
				where: { id: volunteer.id },
			})
			const [volunteerExists] = await prisma.$transaction([query])
			expect(volunteerExists).toBeTruthy()
		})
	})

	describe('Private Routes (as Logged ADMIN)', () => {
		it('Should Create a Volunteer', async () => {
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					firstName,
					joinedDate,
				})
				.expect(201)

			expect(res.body.data.firstName).toBe(firstName)
			expect(res.body.data.joinedDate).toBe(joinedDate.toISOString())
		})

		it('Should Not Update a Volunteer (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const volunteer = await createVolunteer(firstName, joinedDate, differentField.id)
			const lastName = 'Abreu'

			await request(app.getHttpServer())
				.put(`${baseRoute}/${volunteer.id}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ lastName })
				.expect(403)
		})

		it('Should Update a Volunteer', async () => {
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)
			const lastName = 'Abreu'

			const res = await request(app.getHttpServer())
				.put(`${baseRoute}/${volunteer.id}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ lastName })
				.expect(200)

			expect(res.body.data.lastName).toBe(lastName)
		})

		it('Should Not Remove a Volunteer (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const volunteer = await createVolunteer(firstName, joinedDate, differentField.id)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/${volunteer.id}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(403)
		})

		it('Should Remove a Volunteer', async () => {
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${volunteer.id}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${volunteer.id}`).expect(200)

			expect(res.body.data).toBe(null)
		})

		it('Should Restore a Volunteer', async () => {
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)
			await prisma.volunteer.delete({ where: { id: volunteer.id } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ ids: [volunteer.id] })
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${volunteer.id}`).expect(200)

			expect(res.body.data).toBeTruthy()
		})

		it('Should HardRemove a Volunteer', async () => {
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)
			await prisma.volunteer.delete({ where: { id: volunteer.id } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ ids: [volunteer.id] })
				.expect(200)

			// Bypass Soft Delete
			const query = prisma.volunteer.findUnique({
				where: { id: volunteer.id },
			})
			const [volunteerExists] = await prisma.$transaction([query])
			expect(volunteerExists).toBeNull()
		})
	})

	describe('Private Routes (as Logged WEB MASTER)', () => {
		it('Should Not Create a Volunteer (Missing Field)', async () => {
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({
					firstName,
					joinedDate,
				})
				.expect(400)
		})

		it('Should Create a Volunteer', async () => {
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({
					firstName,
					joinedDate,
					field: field.id,
				})
				.expect(201)

			expect(res.body.data.firstName).toBe(firstName)
			expect(res.body.data.joinedDate).toBe(joinedDate.toISOString())
		})

		it('Should Update a Volunteer', async () => {
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)
			const lastName = 'Abreu'

			const res = await request(app.getHttpServer())
				.put(`${baseRoute}/${volunteer.id}`)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({ lastName })
				.expect(200)

			expect(res.body.data.lastName).toBe(lastName)
		})

		it('Should Remove a Volunteer', async () => {
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${volunteer.id}`)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${volunteer.id}`).expect(200)

			expect(res.body.data).toBeNull()
		})

		it('Should Restore a Volunteer', async () => {
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)
			await prisma.volunteer.delete({ where: { id: volunteer.id } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({ ids: [volunteer.id] })
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${volunteer.id}`).expect(200)

			expect(res.body.data).toBeTruthy()
		})

		it('Should HardRemove a Volunteer', async () => {
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)
			await prisma.volunteer.delete({ where: { id: volunteer.id } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({ ids: [volunteer.id] })
				.expect(200)

			// Bypass Soft Delete
			const query = prisma.volunteer.findUnique({
				where: { id: volunteer.id },
			})
			const [volunteerExists] = await prisma.$transaction([query])
			expect(volunteerExists).toBeNull()
		})
	})

	describe('Public Routes (as Non Logged User)', () => {
		it(`Should Return a Volunteer List With ${ITEMS_PER_PAGE} Items`, async () => {
			const volunteersToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							firstName: `João ${i}`,
							joinedDate: new Date('2022-01-03'),
							fieldId: field.id,
						} as Volunteer),
				)
			await prisma.volunteer.createMany({
				data: volunteersToCreate,
			})

			const response = await request(app.getHttpServer()).get(baseRoute).expect(200)

			expect(response.body.data).toHaveLength(ITEMS_PER_PAGE)
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(String(1))
		})

		const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE)
		it(`Should Return a Volunteer List With ${randomN} Items`, async () => {
			const volunteersToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							firstName: `João ${i}`,
							joinedDate: new Date('2022-01-03'),
							fieldId: field.id,
						} as Volunteer),
				)
			await prisma.volunteer.createMany({
				data: volunteersToCreate,
			})

			const response = await request(app.getHttpServer()).get(baseRoute).query({ itemsPerPage: randomN }).expect(200)

			expect(response.body.data).toHaveLength(randomN)
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(String(Math.ceil(+response.headers['x-total-count'] / randomN)))
		})

		it('Should Return a Volunteer', async () => {
			const firstName = 'Mario'
			const joinedDate = new Date('2022-01-01')
			const volunteer = await createVolunteer(firstName, joinedDate, field.id)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${volunteer.id}`).expect(200)

			expect(res.body.data.firstName).toBe(firstName)
			expect(res.body.data.joinedDate).toBe(joinedDate.toISOString())
		})
	})
})
