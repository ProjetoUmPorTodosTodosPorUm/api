import { NestExpressApplication } from '@nestjs/platform-express'
import { Contact, Field, Role, User } from '@prisma/client'
import { PrismaService } from 'src/prisma/prisma.service'
import * as bcrypt from 'bcrypt'
import * as request from 'supertest'
import { Test } from '@nestjs/testing'
import { ConfigModule } from '@nestjs/config'
import configuration from 'src/config/configuration'
import { AuthModule } from 'src/auth/auth.module'
import { PrismaModule } from 'src/prisma/prisma.module'
import { UserModule } from 'src/user/user.module'
import { ContactModule } from 'src/contact/contact.module'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseInterceptor } from 'src/response.interceptor'
import { createField, createUser, getToken, setAppConfig } from 'src/utils/test'
import { FieldModule } from 'src/field/field.module'
import { ITEMS_PER_PAGE } from 'src/constants'

describe('Contact Controller E2E', () => {
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
	const baseRoute = '/contact'

	const name = 'João'
	const email = 'joao@email.com'
	const message = 'Texto'

	const createContact = async (name: string, email: string, message: string) =>
		await prisma.contact.create({
			data: {
				name,
				email,
				message,
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
				ContactModule,
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
		it('Should Not Remove a Contact', async () => {
			const contact = await createContact(name, email, message)

			await request(app.getHttpServer()).delete(`${baseRoute}/${contact.id}`).expect(401)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${contact.id}`).expect(200)

			expect(res.body.data).toBeTruthy()
		})

		it('Should Not Restore a Contact', async () => {
			const contact = await createContact(name, email, message)
			await prisma.contact.delete({ where: { id: contact.id } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.send({ ids: [contact.id] })
				.expect(401)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${contact.id}`).expect(200)

			expect(res.body.data).toBeNull()
		})

		it('Should Not HardRemove a Contact', async () => {
			const contact = await createContact(name, email, message)
			await prisma.contact.delete({ where: { id: contact.id } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.send({ ids: [contact.id] })
				.expect(401)

			// Bypass Soft Delete
			const query = prisma.contact.findUnique({
				where: { id: contact.id },
			})
			const [contactExists] = await prisma.$transaction([query])
			expect(contactExists).toBeTruthy()
		})
	})

	describe('Private Routes (as Logged VOLUNTEER)', () => {
		it('Should Not Remove a Contact', async () => {
			const contact = await createContact(name, email, message)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${contact.id}`)
				.set('Authorization', `Bearer ${userToken}`)
				.expect(403)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${contact.id}`).expect(200)

			expect(res.body.data).toBeTruthy()
		})

		it('Should Not Restore a Contact', async () => {
			const contact = await createContact(name, email, message)
			await prisma.contact.delete({ where: { id: contact.id } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ ids: [contact.id] })
				.expect(403)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${contact.id}`).expect(200)

			expect(res.body.data).toBeNull()
		})

		it('Should Not HardRemove a Contact', async () => {
			const contact = await createContact(name, email, message)
			await prisma.contact.delete({ where: { id: contact.id } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ ids: [contact.id] })
				.expect(403)

			// Bypass Soft Delete
			const query = prisma.contact.findUnique({
				where: { id: contact.id },
			})
			const [contactExists] = await prisma.$transaction([query])
			expect(contactExists).toBeTruthy()
		})
	})

	describe('Private Routes (as Logged ADMIN)', () => {
		it('Should Not Remove a Contact', async () => {
			const contact = await createContact(name, email, message)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${contact.id}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(403)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${contact.id}`).expect(200)

			expect(res.body.data).toBeTruthy()
		})

		it('Should Not Restore a Contact', async () => {
			const contact = await createContact(name, email, message)
			await prisma.contact.delete({ where: { id: contact.id } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ ids: [contact.id] })
				.expect(403)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${contact.id}`).expect(200)

			expect(res.body.data).toBeNull()
		})

		it('Should Not HardRemove a Contact', async () => {
			const contact = await createContact(name, email, message)
			await prisma.contact.delete({ where: { id: contact.id } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ ids: [contact.id] })
				.expect(403)

			// Bypass Soft Delete
			const query = prisma.contact.findUnique({
				where: { id: contact.id },
			})
			const [contactExists] = await prisma.$transaction([query])
			expect(contactExists).toBeTruthy()
		})
	})

	describe('Private Routes (as Logged WEB MASTER)', () => {
		it('Should Remove a Contact', async () => {
			const contact = await createContact(name, email, message)
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${contact.id}`)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${contact.id}`).expect(200)

			expect(res.body.data).toBe(null)
		})

		it('Should Restore a Contact', async () => {
			const contact = await createContact(name, email, message)
			await prisma.contact.delete({ where: { id: contact.id } })

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({ ids: [contact.id] })
				.expect(200)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${contact.id}`).expect(200)

			expect(res.body.data).toBeTruthy()
		})

		it('Should HardRemove a Contact', async () => {
			const contact = await createContact(name, email, message)
			await prisma.contact.delete({ where: { id: contact.id } })

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.set('Authorization', `Bearer ${webMasterToken}`)
				.send({ ids: [contact.id] })
				.expect(200)

			// Bypass Soft Delete
			const query = prisma.contact.findUnique({
				where: { id: contact.id },
			})
			const [contactExists] = await prisma.$transaction([query])
			expect(contactExists).toBeNull()
		})
	})

	describe('Public Routes (as Non Logged User)', () => {
		it(`Should Return a Contact List With ${ITEMS_PER_PAGE} Items`, async () => {
			const contactsToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							name: `Título ${i}`,
							email,
							message,
						} as Contact),
				)
			await prisma.contact.createMany({
				data: contactsToCreate,
			})

			const response = await request(app.getHttpServer()).get(baseRoute).expect(200)

			expect(response.body.data).toHaveLength(ITEMS_PER_PAGE)
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(String(1))
		})

		const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE)
		it(`Should Return a Contact List With ${randomN} Items`, async () => {
			const contactsToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							name: `Título ${i}`,
							email,
							message,
						} as Contact),
				)
			await prisma.contact.createMany({
				data: contactsToCreate,
			})

			const response = await request(app.getHttpServer()).get(baseRoute).query({ itemsPerPage: randomN }).expect(200)

			expect(response.body.data).toHaveLength(randomN)
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(String(Math.ceil(+response.headers['x-total-count'] / randomN)))
		})

		it('Should Return a Contact', async () => {
			const contact = await createContact(name, email, message)

			const res = await request(app.getHttpServer()).get(`${baseRoute}/${contact.id}`).expect(200)

			expect(res.body.data.name).toBe(name)
			expect(res.body.data.email).toBe(email)
			expect(res.body.data.message).toBe(message)
		})
	})
})
