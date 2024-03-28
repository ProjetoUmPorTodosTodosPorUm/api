import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Field, Role, Contact, User } from '@prisma/client'
import { ITEMS_PER_PAGE, MESSAGE, TEMPLATE } from 'src/constants'
import { PrismaService } from 'src/prisma/prisma.service'
import { ContactModule } from 'src/contact/contact.module'
import { ContactService } from 'src/contact/contact.service'
import { createField, createUser } from 'src/utils/test'
import { v4 as uuidv4 } from 'uuid'
import * as bcrypt from 'bcrypt'

import { ConfigModule } from '@nestjs/config'
import configuration from 'src/config/configuration'
import { AuthModule } from 'src/auth/auth.module'
import { PrismaModule } from 'src/prisma/prisma.module'
import { UserModule } from 'src/user/user.module'
import { FieldModule } from 'src/field/field.module'

import { APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseInterceptor } from 'src/response.interceptor'

describe('Contact Service Integration', () => {
	let prisma: PrismaService
	let contactService: ContactService

	let field: Field
	let user: User
	let admin: User
	let webMaster: User

	const password = '12345678'
	const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync())

	const name = 'Nome'
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

		prisma = moduleRef.get(PrismaService)
		contactService = moduleRef.get(ContactService)

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
		it('Should Create a Contact (as Non Logged User)', async () => {
			const contact = await contactService.create({
				name,
				email,
				message,
			})

			expect(contact.name).toBe(name)
			expect(contact.email).toBe(email)
			expect(contact.message).toStrictEqual(message)
		})
	})

	describe('findAll()', () => {
		it('Should Return an Empty Array', async () => {
			const response = await contactService.findAll()

			expect(response.data).toHaveLength(0)
			expect(response.totalCount).toBe(0)
			expect(response.totalPages).toBe(0)
		})

		it(`Should Return a Contact List With ${ITEMS_PER_PAGE} Items`, async () => {
			const testimonialsToCreate = Array(ITEMS_PER_PAGE)
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
				data: testimonialsToCreate,
			})

			const response = await contactService.findAll()
			expect(response.data).toHaveLength(ITEMS_PER_PAGE)
			expect(response.totalCount).toBe(ITEMS_PER_PAGE)
			expect(response.totalPages).toBe(1)
		})

		const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE)
		it(`Should Return a Contact List With ${randomN} Items`, async () => {
			const testimonialsToCreate = Array(ITEMS_PER_PAGE)
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
				data: testimonialsToCreate,
			})

			const response = await contactService.findAll({
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
			const contact = await contactService.findOne(randomId)

			expect(contact).toBeNull()
		})

		it('Should Return a Contact', async () => {
			const testimonialCreated = await createContact(name, email, message)

			const contact = await contactService.findOne(testimonialCreated.id)
			expect(contact.name).toBe(name)
			expect(contact.email).toBe(email)
			expect(contact.message).toStrictEqual(message)
		})
	})

	describe('remove()', () => {
		it('Should Not Remove a Contact (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await contactService.remove(randomId, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('contato', 'o'))
			}
		})

		it('Should Not Remove a Contact (as USER)', async () => {
			const contact = await createContact(name, email, message)

			try {
				await contactService.remove(contact.id, user)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Remove a Contact (as ADMIN)', async () => {
			const contact = await createContact(name, email, message)

			try {
				await contactService.remove(contact.id, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Remove a Contact (as WEB MASTER)', async () => {
			const contact = await createContact(name, email, message)

			await contactService.remove(contact.id, webMaster)
			const isTestimonialDeleted = await prisma.contact.findFirst({
				where: {
					id: contact.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isTestimonialDeleted.deleted).toBeDefined()
		})
	})

	describe('restore()', () => {
		it('Should Not Restore a Contact (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await contactService.restore({ ids: [randomId] }, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'))
			}
		})

		it('Should Not Restore a Contact (as USER)', async () => {
			const contact = await createContact(name, email, message)
			await prisma.contact.delete({ where: { id: contact.id } })

			try {
				await contactService.restore({ ids: [contact.id] }, user)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Restore a Contact (as ADMIN)', async () => {
			const contact = await createContact(name, email, message)
			await prisma.contact.delete({ where: { id: contact.id } })

			try {
				await contactService.restore({ ids: [contact.id] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Restore a Contact (as WEB MASTER)', async () => {
			const contact = await createContact(name, email, message)
			await prisma.contact.delete({ where: { id: contact.id } })

			await contactService.restore({ ids: [contact.id] }, webMaster)
			const isTestimonialRestored = await prisma.contact.findFirst({
				where: {
					id: contact.id,
				},
			})

			expect(isTestimonialRestored.deleted).toBeNull()
		})
	})

	describe('hardRemove()', () => {
		it('Should Not Hard Remove a Contact (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await contactService.hardRemove({ ids: [randomId] }, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'))
			}
		})

		it('Should Not HardRemove a Contact (as USER)', async () => {
			const contact = await createContact(name, email, message)
			await prisma.contact.delete({ where: { id: contact.id } })

			try {
				await contactService.hardRemove({ ids: [contact.id] }, user)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not HardRemove a Contact (as ADMIN)', async () => {
			const contact = await createContact(name, email, message)
			await prisma.contact.delete({ where: { id: contact.id } })

			try {
				await contactService.hardRemove({ ids: [contact.id] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should HardRemove a Contact (as WEB MASTER)', async () => {
			const contact = await createContact(name, email, message)
			await prisma.contact.delete({ where: { id: contact.id } })

			await contactService.hardRemove({ ids: [contact.id] }, webMaster)
			const isContactRemoved = await prisma.contact.findFirst({
				where: {
					id: contact.id,
					deleted: { not: new Date() },
				},
			})
			expect(isContactRemoved).toBeNull()
		})
	})
})
