import { NestExpressApplication } from '@nestjs/platform-express'
import { Field, MonthlyOffer, Role, User } from '@prisma/client'
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
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseInterceptor } from 'src/response.interceptor'
import { MonthlyOfferModule } from 'src/monthly-offer/monthly-offer.module'

describe('Monthly  Offer Controller E2E', () => {
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
	const baseRoute = '/monthly-offer'

	const month = 1
	const year = 2022
	const foodQnt = 1
	const monetaryValue = 1.5
	const othersQnt = 1

	const createMonthlyOffer = async (
		month: number,
		year: number,
		foodQnt: number,
		monetaryValue: number,
		othersQnt: number,
		field: string,
	) =>
		await prisma.monthlyOffer.create({
			data: {
				month,
				year,
				foodQnt,
				monetaryValue,
				othersQnt,
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
				MonthlyOfferModule,
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
		it('Should Not Create a Monthly  Offer', async () => {
			await request(app.getHttpServer())
				.post(baseRoute)
				.send({
					month,
					year,
					foodQnt,
					monetaryValue,
					othersQnt,
					field: field.id,
				})
				.expect(401)
		})

		it('Should Not Update a Monthly  Offer', async () => {
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)
			await request(app.getHttpServer())
				.put(`${baseRoute}/${monthlyOffer.id}`)
				.send({ foodQnt: 'Alimento 2' })
				.expect(401)
		})

		it('Should Not Remove a Monthly  Offer', async () => {
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)

			await request(app.getHttpServer()).delete(`${baseRoute}/${monthlyOffer.id}`).expect(401)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${monthlyOffer.id}`).expect(200)

			expect(res.body.data).toBeTruthy()
		})

		it('Should Not Restore a Monthly  Offer', async () => {
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)
			await prisma.monthlyOffer.delete({
				where: { id: monthlyOffer.id },
			})

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.send({ ids: [monthlyOffer.id] })
				.expect(401)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${monthlyOffer.id}`).expect(200)

			expect(res.body.data).toBeNull()
		})

		it('Should Not HardRemove a Monthly  Offer', async () => {
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)
			await prisma.monthlyOffer.delete({
				where: { id: monthlyOffer.id },
			})

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.send({ ids: [monthlyOffer.id] })
				.expect(401)

			// Bypass Soft Delete
			const query = prisma.monthlyOffer.findUnique({
				where: { id: monthlyOffer.id },
			})
			const [monthlyOfferExists] = await prisma.$transaction([query])
			expect(monthlyOfferExists).toBeTruthy()
		})
	})

	describe('Private Routes (as Logged VOLUNTEER)', () => {
		it('Should Create a Monthly Offer', async () => {
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `Bearer ${userToken}`)
				.send({
					month,
					year,
					foodQnt,
					monetaryValue,
					othersQnt,
				})
				.expect(201)

			expect(res.body.data.month).toBe(month)
			expect(res.body.data.year).toBe(year)
			expect(res.body.data.foodQnt).toBe(foodQnt)
			expect(res.body.data.monetaryValue).toBe(monetaryValue)
			expect(res.body.data.othersQnt).toBe(othersQnt)
		})

		it('Should Not Update a Monthly  Offer (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, differentField.id)
			const newFoodQnt = 5

			await request(app.getHttpServer())
				.put(`${baseRoute}/${monthlyOffer.id}`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ foodQnt: newFoodQnt })
				.expect(403)
		})

		it('Should Update a Monthly  Offer', async () => {
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)
			const newFoodQnt = 5

			const res = await request(app.getHttpServer())
				.put(`${baseRoute}/${monthlyOffer.id}`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ foodQnt: newFoodQnt })
				.expect(200)

			expect(res.body.data.foodQnt).toBe(newFoodQnt)
		})

		it('Should Not Remove a Monthly Offer (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, differentField.id)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${monthlyOffer.id}`)
				.set('Authorization', `Bearer ${userToken}`)
				.expect(403)
		})

		it('Should Remove a Monthly Offer', async () => {
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${monthlyOffer.id}`)
				.set('Authorization', `Bearer ${userToken}`)
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${monthlyOffer.id}`).expect(200)

			expect(res.body.data).toBe(null)
		})

		it('Should Not Restore a Monthly Offer', async () => {
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)
			await prisma.monthlyOffer.delete({
				where: { id: monthlyOffer.id },
			})

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ ids: [monthlyOffer.id] })
				.expect(403)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${monthlyOffer.id}`).expect(200)

			expect(res.body.data).toBeNull()
		})

		it('Should Not HardRemove a Monthly Offer', async () => {
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)
			await prisma.monthlyOffer.delete({
				where: { id: monthlyOffer.id },
			})

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ ids: [monthlyOffer.id] })
				.expect(403)

			// Bypass Soft Delete
			const query = prisma.monthlyOffer.findUnique({
				where: { id: monthlyOffer.id },
			})
			const [monthlyOfferExists] = await prisma.$transaction([query])
			expect(monthlyOfferExists).toBeTruthy()
		})
	})

	describe('Private Routes (as Logged ADMIN)', () => {
		it('Should Create a Monthly Offer', async () => {
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					month,
					year,
					foodQnt,
					monetaryValue,
					othersQnt,
				})
				.expect(201)

			expect(res.body.data.month).toBe(month)
			expect(res.body.data.year).toBe(year)
			expect(res.body.data.foodQnt).toBe(foodQnt)
			expect(res.body.data.monetaryValue).toBe(monetaryValue)
			expect(res.body.data.othersQnt).toBe(othersQnt)
		})

		it('Should Not Update a Monthly Offer (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, differentField.id)
			const newFoodQnt = 5

			await request(app.getHttpServer())
				.put(`${baseRoute}/${monthlyOffer.id}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ foodQnt: newFoodQnt })
				.expect(403)
		})

		it('Should Update a Monthly Offer', async () => {
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)
			const newFoodQnt = 5

			const res = await request(app.getHttpServer())
				.put(`${baseRoute}/${monthlyOffer.id}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ foodQnt: newFoodQnt })
				.expect(200)

			expect(res.body.data.foodQnt).toBe(newFoodQnt)
		})

		it('Should Not Remove a Monthly Offer (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, differentField.id)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${monthlyOffer.id}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(403)
		})

		it('Should Remove a Monthly Offer', async () => {
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${monthlyOffer.id}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${monthlyOffer.id}`).expect(200)

			expect(res.body.data).toBe(null)
		})

		it('Should Not Restore a Monthly Offer (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, differentField.id)
			await prisma.monthlyOffer.delete({
				where: { id: monthlyOffer.id },
			})

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ ids: [monthlyOffer.id] })
				.expect(403)
		})

		it('Should Restore a Monthly Offer', async () => {
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)
			await prisma.monthlyOffer.delete({
				where: { id: monthlyOffer.id },
			})

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ ids: [monthlyOffer.id] })
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${monthlyOffer.id}`).expect(200)

			expect(res.body.data).toBeTruthy()
		})

		it('Should Not HardRemove a Monthly Offer (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, differentField.id)
			await prisma.monthlyOffer.delete({
				where: { id: monthlyOffer.id },
			})

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ ids: [monthlyOffer.id] })
				.expect(403)
		})

		it('Should HardRemove a Monthly Offer', async () => {
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)
			await prisma.monthlyOffer.delete({
				where: { id: monthlyOffer.id },
			})

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ ids: [monthlyOffer.id] })
				.expect(200)

			// Bypass Soft Delete
			const query = prisma.monthlyOffer.findUnique({
				where: { id: monthlyOffer.id },
			})
			const [monthlyOfferExists] = await prisma.$transaction([query])
			expect(monthlyOfferExists).toBeNull()
		})
	})

	describe('Private Routes (as Logged WEB MASTER)', () => {
		it('Should Not Create a Monthly Offer (Missing Field)', async () => {
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({
					month,
					year,
					foodQnt,
					monetaryValue,
					othersQnt,
				})
				.expect(400)
		})

		it('Should Create a Monthly Offer', async () => {
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({
					month,
					year,
					foodQnt,
					monetaryValue,
					othersQnt,
					field: field.id,
				})
				.expect(201)

			expect(res.body.data.month).toBe(month)
			expect(res.body.data.year).toBe(year)
			expect(res.body.data.foodQnt).toBe(foodQnt)
			expect(res.body.data.monetaryValue).toBe(monetaryValue)
			expect(res.body.data.othersQnt).toBe(othersQnt)
		})

		it('Should Update a Monthly Offer', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)
			const newFoodQnt = 5

			const res = await request(app.getHttpServer())
				.put(`${baseRoute}/${monthlyOffer.id}`)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({
					foodQnt: newFoodQnt,
					field: differentField.id,
				})
				.expect(200)

			expect(res.body.data.foodQnt).toBe(newFoodQnt)
			expect(res.body.data.fieldId).toBe(differentField.id)
		})

		it('Should Remove a Monthly Offer', async () => {
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${monthlyOffer.id}`)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${monthlyOffer.id}`).expect(200)

			expect(res.body.data).toBe(null)
		})

		it('Should Restore a Monthly Offer', async () => {
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)
			await prisma.monthlyOffer.delete({
				where: { id: monthlyOffer.id },
			})

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({ ids: [monthlyOffer.id] })
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${monthlyOffer.id}`).expect(200)

			expect(res.body.data).toBeTruthy()
		})

		it('Should HardRemove a Monthly Offer', async () => {
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)
			await prisma.monthlyOffer.delete({
				where: { id: monthlyOffer.id },
			})

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({ ids: [monthlyOffer.id] })
				.expect(200)

			// Bypass Soft Delete
			const query = prisma.monthlyOffer.findUnique({
				where: { id: monthlyOffer.id },
			})
			const [monthlyOfferExists] = await prisma.$transaction([query])
			expect(monthlyOfferExists).toBeNull()
		})
	})

	describe('Public Routes (as Non Logged User)', () => {
		it(`Should Return a Monthly Offer List With ${ITEMS_PER_PAGE} Items`, async () => {
			const monthlyOffersToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							month,
							year,
							foodQnt,
							monetaryValue,
							othersQnt,
							fieldId: field.id,
						} as MonthlyOffer),
				)
			await prisma.monthlyOffer.createMany({
				data: monthlyOffersToCreate,
			})

			const response = await request(app.getHttpServer()).get(baseRoute).expect(200)

			expect(response.body.data).toHaveLength(ITEMS_PER_PAGE)
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(String(1))
		})

		const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE)
		it(`Should Return a Monthly Offer List With ${randomN} Items`, async () => {
			const monthlyOffersToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							month,
							year,
							foodQnt,
							monetaryValue,
							othersQnt,
							fieldId: field.id,
						} as MonthlyOffer),
				)
			await prisma.monthlyOffer.createMany({
				data: monthlyOffersToCreate,
			})

			const response = await request(app.getHttpServer()).get(baseRoute).query({ itemsPerPage: randomN }).expect(200)

			expect(response.body.data).toHaveLength(randomN)
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(String(Math.ceil(+response.headers['x-total-count'] / randomN)))
		})

		it('Should Return a Monthly Offer', async () => {
			const monthlyOffer = await createMonthlyOffer(month, year, foodQnt, monetaryValue, othersQnt, field.id)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${monthlyOffer.id}`).expect(200)

			expect(res.body.data.month).toBe(month)
			expect(res.body.data.year).toBe(year)
			expect(res.body.data.foodQnt).toBe(foodQnt)
			expect(res.body.data.monetaryValue).toBe(monetaryValue)
			expect(res.body.data.othersQnt).toBe(othersQnt)
		})

		it('Should Return Collected Period', async () => {
			const totalMonths = 12
			const monthlyOffersToCreate = Array(totalMonths)
				.fill(0)
				.map(
					(v, i) =>
						({
							month: i + 1,
							year,
							foodQnt,
							monetaryValue,
							othersQnt,
							fieldId: field.id,
						} as MonthlyOffer),
				)
			await prisma.monthlyOffer.createMany({
				data: monthlyOffersToCreate,
			})

			const response = await request(app.getHttpServer())
				.get(`${baseRoute}/period`)
				.query({
					field: field.id,
				})
				.expect(200)

			expect(response.body.data).toHaveProperty(String(year))
			expect(response.body.data[String(year)]).toHaveLength(totalMonths)
		})
	})
})
