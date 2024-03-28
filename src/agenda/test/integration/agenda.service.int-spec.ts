import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Agenda, Field, Role, User } from '@prisma/client'
import { AgendaService } from 'src/agenda/agenda.service'
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
import { AgendaModule } from 'src/agenda/agenda.module'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseInterceptor } from 'src/response.interceptor'

describe('Agenda Service Integration', () => {
	let prisma: PrismaService
	let agendaService: AgendaService

	let field: Field
	let user: User
	let admin: User
	let webMaster: User

	const password = '12345678'
	const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync())

	const title = 'Título'
	const message = 'Mensagem'
	const date = new Date('2022-02-02')

	const createAgenda = async (title: string, message: string, date: Date, field: string) =>
		await prisma.agenda.create({
			data: {
				title,
				message,
				date,
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
				AgendaModule,
			],
			providers: [
				{
					provide: APP_INTERCEPTOR,
					useClass: ResponseInterceptor,
				},
			],
		}).compile()

		prisma = moduleRef.get(PrismaService)
		agendaService = moduleRef.get(AgendaService)

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
		it('Should Create an Event (as USER)', async () => {
			const event = await agendaService.create(user, {
				title,
				message,
				date,
			})

			expect(event.title).toBe(title)
			expect(event.message).toBe(message)
			expect(event.date).toStrictEqual(date)
			expect(event.fieldId).toBe(user.fieldId)
		})

		it('Should Create an Event (as ADMIN)', async () => {
			const event = await agendaService.create(admin, {
				title,
				message,
				date,
			})

			expect(event.title).toBe(title)
			expect(event.message).toBe(message)
			expect(event.date).toStrictEqual(date)
			expect(event.fieldId).toBe(admin.fieldId)
		})

		it('Should Create an Event (as WEB MASTER Missing Data)', async () => {
			const event = await agendaService.create(webMaster, {
				title,
				message,
				date,
			})

			expect(event.title).toBe(title)
			expect(event.message).toBe(message)
			expect(event.date).toStrictEqual(date)
		})

		it('Should Create an Event (as WEB MASTER)', async () => {
			const event = await agendaService.create(webMaster, {
				title,
				message,
				date,
				field: field.id,
			})

			expect(event.title).toBe(title)
			expect(event.message).toBe(message)
			expect(event.date).toStrictEqual(date)
			expect(event.fieldId).toBe(field.id)
		})
	})

	describe('findAll()', () => {
		it('Should Return an Empty Array', async () => {
			const response = await agendaService.findAll()

			expect(response.data).toHaveLength(0)
			expect(response.totalCount).toBe(0)
			expect(response.totalPages).toBe(0)
		})

		it(`Should Return an Event List With ${ITEMS_PER_PAGE} Items`, async () => {
			const eventsToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							title: `Título ${i}`,
							message: 'Mensagem',
							date: new Date('2022-01-03'),
							fieldId: field.id,
						} as Agenda),
				)
			await prisma.agenda.createMany({
				data: eventsToCreate,
			})

			const response = await agendaService.findAll()
			expect(response.data).toHaveLength(ITEMS_PER_PAGE)
			expect(response.totalCount).toBe(ITEMS_PER_PAGE)
			expect(response.totalPages).toBe(1)
		})

		const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE)
		it(`Should Return an Event List With ${randomN} Items`, async () => {
			const eventsToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							title: `Título ${i}`,
							message: 'Mensagem',
							date: new Date('2022-01-03'),
							fieldId: field.id,
						} as Agenda),
				)
			await prisma.agenda.createMany({
				data: eventsToCreate,
			})

			const response = await agendaService.findAll({
				itemsPerPage: randomN,
			})
			expect(response.data).toHaveLength(randomN)
			expect(response.totalCount).toBe(ITEMS_PER_PAGE)
			expect(response.totalPages).toBe(Math.ceil(response.totalCount / randomN))
		})
	})

	describe('findByRange()', () => {
		it('Should Return Events Based on Range', async () => {
			const eventsToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							title: `Título ${i}`,
							message: 'Mensagem',
							date: new Date('2022-01-03'),
							fieldId: field.id,
						} as Agenda),
				)
			await prisma.agenda.createMany({
				data: eventsToCreate,
			})

			const response = await agendaService.findByRange({
				lte: new Date('2022-01-31'),
				gte: new Date('2022-01-01'),
			})

			expect(response).toHaveLength(ITEMS_PER_PAGE)
			expect(response[0].title).toBeDefined()
			expect(response[0].message).toBeDefined()
			expect(response[0].date).toBeDefined()
		})
	})

	describe('findOne()', () => {
		it("Should Return Null (Doesn't Exists)", async () => {
			const randomId = uuidv4()
			const event = await agendaService.findOne(randomId)

			expect(event).toBeNull()
		})

		it('Should Return an Event', async () => {
			const eventCreated = await createAgenda(title, message, date, field.id)

			const event = await agendaService.findOne(eventCreated.id)
			expect(event.title).toBe(title)
			expect(event.message).toBe(message)
			expect(event.date).toStrictEqual(date)
			expect(event.fieldId).toBe(field.id)
		})
	})

	describe('update()', () => {
		it('Should Not Update an Event (Not Found as USER)', async () => {
			try {
				const randomId = uuidv4()
				await agendaService.update(randomId, user, { title: 'lol' })
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'))
			}
		})

		it('Should Not Update an Event (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await agendaService.update(randomId, admin, { title: 'lol' })
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'))
			}
		})

		it('Should Not Update an Event (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await agendaService.update(randomId, webMaster, { title: 'lol' })
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'))
			}
		})

		it('Should Not Update an Event (Different Field as USER)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const event = await createAgenda(title, message, date, differentField.id)
				const newTitle = 'Novo Título'

				await agendaService.update(event.id, user, {
					title: newTitle,
				})
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Update an Event (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const event = await createAgenda(title, message, date, differentField.id)
				const newTitle = 'Novo Título'

				await agendaService.update(event.id, admin, {
					title: newTitle,
				})
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Update an Event (as USER)', async () => {
			const event = await createAgenda(title, message, date, field.id)
			const newTitle = 'Novo Título'

			const eventUpdated = await agendaService.update(event.id, user, {
				title: newTitle,
			})
			expect(eventUpdated).toBeDefined()
			expect(eventUpdated.title).toBe(newTitle)
		})

		it('Should Update an Event (as ADMIN)', async () => {
			const event = await createAgenda(title, message, date, field.id)
			const newTitle = 'Novo Título'

			const eventUpdated = await agendaService.update(event.id, admin, {
				title: newTitle,
			})
			expect(eventUpdated).toBeDefined()
			expect(eventUpdated.title).toBe(newTitle)
		})

		it('Should Update an Event (as WEB MASTER)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const event = await createAgenda(title, message, date, field.id)
			const newTitle = 'Novo Título'

			const eventUpdated = await agendaService.update(event.id, webMaster, {
				title: newTitle,
				field: differentField.id,
			})
			expect(eventUpdated).toBeDefined()
			expect(eventUpdated.title).toBe(newTitle)
			expect(eventUpdated.fieldId).toBe(differentField.id)
		})
	})

	describe('remove()', () => {
		it('Should Not Remove an Event (Not Found as USER)', async () => {
			try {
				const randomId = uuidv4()
				await agendaService.remove(randomId, user)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'))
			}
		})

		it('Should Not Remove an Event (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await agendaService.remove(randomId, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'))
			}
		})

		it('Should Not Remove an Event (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await agendaService.remove(randomId, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'))
			}
		})

		it('Should Not Remove an Event (Different Field as USER)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const event = await createAgenda(title, message, date, differentField.id)

				await agendaService.remove(event.id, user)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Remove an Event (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const event = await createAgenda(title, message, date, differentField.id)

				await agendaService.remove(event.id, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Remove an Event (as USER)', async () => {
			const event = await createAgenda(title, message, date, field.id)

			await agendaService.remove(event.id, user)
			const isEventDeleted = await prisma.agenda.findFirst({
				where: {
					id: event.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isEventDeleted.deleted).toBeDefined()
		})

		it('Should Remove an Event (as ADMIN)', async () => {
			const event = await createAgenda(title, message, date, field.id)

			await agendaService.remove(event.id, admin)
			const isEventDeleted = await prisma.agenda.findFirst({
				where: {
					id: event.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isEventDeleted.deleted).toBeDefined()
		})

		it('Should Remove an Event (as WEB MASTER)', async () => {
			const event = await createAgenda(title, message, date, field.id)

			await agendaService.remove(event.id, webMaster)
			const isEventDeleted = await prisma.agenda.findFirst({
				where: {
					id: event.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isEventDeleted.deleted).toBeDefined()
		})
	})

	describe('restore()', () => {
		it('Should Not Restore an Event (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await agendaService.restore({ ids: [randomId] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'))
			}
		})

		it('Should Not Restore an Event (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await agendaService.restore(randomId, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'))
			}
		})

		it('Should Not Restore an Event (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const event = await createAgenda(title, message, date, differentField.id)
				await prisma.agenda.delete({ where: { id: event.id } })
				await agendaService.restore({ ids: [event.id] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Restore an Event (as ADMIN)', async () => {
			const event = await createAgenda(title, message, date, field.id)
			await prisma.agenda.delete({ where: { id: event.id } })

			await agendaService.restore({ ids: [event.id] }, admin)
			const isEventRestored = await prisma.agenda.findFirst({
				where: {
					id: event.id,
				},
			})

			expect(isEventRestored.deleted).toBeNull()
		})

		it('Should Restore an Event (as WEB MASTER)', async () => {
			const event = await createAgenda(title, message, date, field.id)
			await prisma.agenda.delete({ where: { id: event.id } })

			await agendaService.restore({ ids: [event.id] }, webMaster)
			const isEventRestored = await prisma.agenda.findFirst({
				where: {
					id: event.id,
				},
			})

			expect(isEventRestored.deleted).toBeNull()
		})
	})

	describe('hardRemove()', () => {
		it('Should Not Hard Remove an Event (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await agendaService.hardRemove({ ids: [randomId] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'))
			}
		})

		it('Should Not Hard Remove an Event (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await agendaService.hardRemove({ ids: [randomId] }, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('evento', 'o'))
			}
		})

		it('Should Not Hard Remove an Event (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const event = await createAgenda(title, message, date, differentField.id)
				await prisma.agenda.delete({ where: { id: event.id } })
				await agendaService.hardRemove({ ids: [event.id] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Hard Remove an Event (as ADMIN)', async () => {
			const event = await createAgenda(title, message, date, field.id)
			await prisma.agenda.delete({ where: { id: event.id } })

			await agendaService.hardRemove({ ids: [event.id] }, admin)
			const isEventRemoved = await prisma.agenda.findFirst({
				where: {
					id: event.id,
					deleted: { not: new Date() },
				},
			})
			expect(isEventRemoved).toBeNull()
		})

		it('Should Hard Remove an Event (as WEB MASTER)', async () => {
			const event = await createAgenda(title, message, date, field.id)
			await prisma.agenda.delete({ where: { id: event.id } })

			await agendaService.hardRemove({ ids: [event.id] }, webMaster)
			const isEventRemoved = await prisma.agenda.findFirst({
				where: {
					id: event.id,
					deleted: { not: new Date() },
				},
			})
			expect(isEventRemoved).toBeNull()
		})
	})
})
