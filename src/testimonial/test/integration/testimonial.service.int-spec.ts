import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Field, Role, Testimonial, User } from '@prisma/client'
import { ITEMS_PER_PAGE, MESSAGE, TEMPLATE } from 'src/constants'
import { PrismaService } from 'src/prisma/prisma.service'
import { TestimonialService } from 'src/testimonial/testimonial.service'
import { createField, createUser } from 'src/utils/test'
import { v4 as uuidv4 } from 'uuid'
import * as bcrypt from 'bcrypt'

import { ConfigModule } from '@nestjs/config'
import configuration from 'src/config/configuration'
import { AuthModule } from 'src/auth/auth.module'
import { PrismaModule } from 'src/prisma/prisma.module'
import { UserModule } from 'src/user/user.module'
import { FieldModule } from 'src/field/field.module'
import { TestimonialModule } from 'src/testimonial/testimonial.module'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseInterceptor } from 'src/response.interceptor'

describe('Testimonial Service Integration', () => {
	let prisma: PrismaService
	let testimonialService: TestimonialService

	let field: Field
	let user: User
	let admin: User
	let webMaster: User

	const password = '12345678'
	const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync())

	const name = 'Nome'
	const email = 'joao@email.com'
	const text = 'Texto'

	const createTestimonial = async (name: string, email: string, text: string, field: string) =>
		await prisma.testimonial.create({
			data: {
				name,
				email,
				text,
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
				TestimonialModule,
			],
			providers: [
				{
					provide: APP_INTERCEPTOR,
					useClass: ResponseInterceptor,
				},
			],
		}).compile()

		prisma = moduleRef.get(PrismaService)
		testimonialService = moduleRef.get(TestimonialService)

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
		it('Should Create a Testimonial (as USER)', async () => {
			const testimonial = await testimonialService.create(user, {
				name,
				email,
				text,
			})

			expect(testimonial.name).toBe(name)
			expect(testimonial.email).toBe(email)
			expect(testimonial.text).toStrictEqual(text)
			expect(testimonial.fieldId).toBe(field.id)
		})

		it('Should Create a Testimonial (as ADMIN)', async () => {
			const testimonial = await testimonialService.create(admin, {
				name,
				email,
				text,
			})

			expect(testimonial.name).toBe(name)
			expect(testimonial.email).toBe(email)
			expect(testimonial.text).toStrictEqual(text)
			expect(testimonial.fieldId).toBe(field.id)
		})

		it('Should Create an Event (as WEB MASTER Missing Field)', async () => {
			const testimonial = await testimonialService.create(webMaster, {
				name,
				email,
				text,
			})

			expect(testimonial.name).toBe(name)
			expect(testimonial.email).toBe(email)
			expect(testimonial.text).toStrictEqual(text)
		})

		it('Should Create a Testimonial (as WEB MASTER)', async () => {
			const testimonial = await testimonialService.create(webMaster, {
				name,
				email,
				text,
				field: field.id,
			})

			expect(testimonial.name).toBe(name)
			expect(testimonial.email).toBe(email)
			expect(testimonial.text).toStrictEqual(text)
			expect(testimonial.fieldId).toBe(field.id)
		})
	})

	describe('findAll()', () => {
		it('Should Return an Empty Array', async () => {
			const response = await testimonialService.findAll()

			expect(response.data).toHaveLength(0)
			expect(response.totalCount).toBe(0)
			expect(response.totalPages).toBe(0)
		})

		it(`Should Return a Testimonial List With ${ITEMS_PER_PAGE} Items`, async () => {
			const testimonialsToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							name: `Título ${i}`,
							email,
							text,
							fieldId: field.id,
						} as Testimonial),
				)
			await prisma.testimonial.createMany({
				data: testimonialsToCreate,
			})

			const response = await testimonialService.findAll()
			expect(response.data).toHaveLength(ITEMS_PER_PAGE)
			expect(response.totalCount).toBe(ITEMS_PER_PAGE)
			expect(response.totalPages).toBe(1)
		})

		const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE)
		it(`Should Return a Testimonial List With ${randomN} Items`, async () => {
			const testimonialsToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							name: `Título ${i}`,
							email,
							text,
							fieldId: field.id,
						} as Testimonial),
				)
			await prisma.testimonial.createMany({
				data: testimonialsToCreate,
			})

			const response = await testimonialService.findAll({
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
			const testimonial = await testimonialService.findOne(randomId)

			expect(testimonial).toBeNull()
		})

		it('Should Return a Testimonial', async () => {
			const testimonialCreated = await createTestimonial(name, email, text, field.id)

			const testimonial = await testimonialService.findOne(testimonialCreated.id)
			expect(testimonial.name).toBe(name)
			expect(testimonial.email).toBe(email)
			expect(testimonial.text).toStrictEqual(text)
		})
	})

	describe('update()', () => {
		it('Should Not Update a Testimonial (Not Found as USER)', async () => {
			try {
				const randomId = uuidv4()
				await testimonialService.update(randomId, user, { name: 'lol' })
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'))
			}
		})

		it('Should Not Update a Testimonial (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await testimonialService.update(randomId, admin, { name: 'lol' })
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'))
			}
		})

		it('Should Not Update a Testimonial (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await testimonialService.update(randomId, webMaster, { name: 'lol' })
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'))
			}
		})

		it('Should Not Update a Testimonial (Different Field as USER)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const testimonial = await createTestimonial(name, email, text, differentField.id)
				await testimonialService.update(testimonial.id, user, { name: 'lol' })
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Update a Testimonial (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const testimonial = await createTestimonial(name, email, text, differentField.id)
				await testimonialService.update(testimonial.id, admin, { name: 'lol' })
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Update a Testimonial (as USER)', async () => {
			const testimonial = await createTestimonial(name, email, text, field.id)
			const newName = 'Novo Título'

			const testimonialUpdated = await testimonialService.update(testimonial.id, user, {
				name: newName,
			})
			expect(testimonialUpdated).toBeDefined()
			expect(testimonialUpdated.name).toBe(newName)
		})

		it('Should Update a Testimonial (as ADMIN)', async () => {
			const testimonial = await createTestimonial(name, email, text, field.id)
			const newName = 'Novo Título'

			const testimonialUpdated = await testimonialService.update(testimonial.id, admin, {
				name: newName,
			})
			expect(testimonialUpdated).toBeDefined()
			expect(testimonialUpdated.name).toBe(newName)
		})

		it('Should Update a Testimonial (as WEB MASTER)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const testimonial = await createTestimonial(name, email, text, field.id)
			const newName = 'Novo Título'

			const testimonialUpdated = await testimonialService.update(testimonial.id, webMaster, {
				name: newName,
				field: differentField.id,
			})
			expect(testimonialUpdated).toBeDefined()
			expect(testimonialUpdated.name).toBe(newName)
			expect(testimonialUpdated.fieldId).toBe(differentField.id)
		})
	})

	describe('remove()', () => {
		it('Should Not Remove a Testimonial (Not Found as USER)', async () => {
			try {
				const randomId = uuidv4()
				await testimonialService.remove(randomId, user)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'))
			}
		})

		it('Should Not Remove a Testimonial (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await testimonialService.remove(randomId, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'))
			}
		})

		it('Should Not Remove a Testimonial (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await testimonialService.remove(randomId, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'))
			}
		})

		it('Should Not Remove a Testimonial (Different Field as USER)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const testimonial = await createTestimonial(name, email, text, differentField.id)
				await testimonialService.remove(testimonial.id, user)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Remove a Testimonial (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const testimonial = await createTestimonial(name, email, text, differentField.id)
				await testimonialService.remove(testimonial.id, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Remove a Testimonial (as USER)', async () => {
			const testimonial = await createTestimonial(name, email, text, field.id)

			await testimonialService.remove(testimonial.id, user)
			const isTestimonialDeleted = await prisma.testimonial.findFirst({
				where: {
					id: testimonial.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isTestimonialDeleted.deleted).toBeDefined()
		})

		it('Should Remove a Testimonial (as ADMIN)', async () => {
			const testimonial = await createTestimonial(name, email, text, field.id)

			await testimonialService.remove(testimonial.id, admin)
			const isTestimonialDeleted = await prisma.testimonial.findFirst({
				where: {
					id: testimonial.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isTestimonialDeleted.deleted).toBeDefined()
		})

		it('Should Remove a Testimonial (as WEB MASTER)', async () => {
			const testimonial = await createTestimonial(name, email, text, field.id)

			await testimonialService.remove(testimonial.id, webMaster)
			const isTestimonialDeleted = await prisma.testimonial.findFirst({
				where: {
					id: testimonial.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isTestimonialDeleted.deleted).toBeDefined()
		})
	})

	describe('restore()', () => {
		it('Should Not Restore a Testimonial (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await testimonialService.restore({ ids: [randomId] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'))
			}
		})

		it('Should Not Restore a Testimonial (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await testimonialService.restore({ ids: [randomId] }, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'))
			}
		})

		it('Should Not Restore a Testimonial (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const testimonial = await createTestimonial(name, email, text, differentField.id)
				await prisma.testimonial.delete({ where: { id: testimonial.id } })
				await testimonialService.restore({ ids: [testimonial.id] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Restore a Testimonial (as ADMIN)', async () => {
			const testimonial = await createTestimonial(name, email, text, field.id)
			await prisma.testimonial.delete({ where: { id: testimonial.id } })

			await testimonialService.restore({ ids: [testimonial.id] }, admin)
			const isTestimonialRestored = await prisma.testimonial.findFirst({
				where: {
					id: testimonial.id,
				},
			})

			expect(isTestimonialRestored.deleted).toBeNull()
		})

		it('Should Restore a Testimonial (as WEB MASTER)', async () => {
			const testimonial = await createTestimonial(name, email, text, field.id)
			await prisma.testimonial.delete({ where: { id: testimonial.id } })

			await testimonialService.restore({ ids: [testimonial.id] }, webMaster)
			const isTestimonialRestored = await prisma.testimonial.findFirst({
				where: {
					id: testimonial.id,
				},
			})

			expect(isTestimonialRestored.deleted).toBeNull()
		})
	})

	describe('hardRemove()', () => {
		it('Should Not Hard Remove a Testimonial (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await testimonialService.hardRemove({ ids: [randomId] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'))
			}
		})

		it('Should Not Hard Remove a Testimonial (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await testimonialService.hardRemove({ ids: [randomId] }, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('testemunho', 'o'))
			}
		})

		it('Should Not Hard Remove a Testimonial (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const testimonial = await createTestimonial(name, email, text, differentField.id)
				await prisma.testimonial.delete({ where: { id: testimonial.id } })
				await testimonialService.hardRemove({ ids: [testimonial.id] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should HardRemove a Testimonial (as ADMIN)', async () => {
			const testimonial = await createTestimonial(name, email, text, field.id)
			await prisma.testimonial.delete({ where: { id: testimonial.id } })

			await testimonialService.hardRemove({ ids: [testimonial.id] }, admin)
			const isTestimonialRemoved = await prisma.testimonial.findFirst({
				where: {
					id: testimonial.id,
					deleted: { not: new Date() },
				},
			})
			expect(isTestimonialRemoved).toBeNull()
		})

		it('Should HardRemove a Testimonial (as WEB MASTER)', async () => {
			const testimonial = await createTestimonial(name, email, text, field.id)
			await prisma.testimonial.delete({ where: { id: testimonial.id } })

			await testimonialService.hardRemove({ ids: [testimonial.id] }, webMaster)
			const isTestimonialRemoved = await prisma.testimonial.findFirst({
				where: {
					id: testimonial.id,
					deleted: { not: new Date() },
				},
			})
			expect(isTestimonialRemoved).toBeNull()
		})
	})
})
