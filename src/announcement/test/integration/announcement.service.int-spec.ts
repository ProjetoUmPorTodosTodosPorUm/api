import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'

import { Test } from '@nestjs/testing'
import { Announcement, Field, Role, User } from '@prisma/client'
import { AnnouncementService } from 'src/announcement/announcement.service'
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
import { AnnouncementModule } from 'src/announcement/announcement.module'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseInterceptor } from 'src/response.interceptor'

describe('Announcement Service Integration', () => {
	let prisma: PrismaService
	let announcementService: AnnouncementService

	let field: Field
	let user: User
	let admin: User
	let webMaster: User

	const password = '12345678'
	const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync())

	const title = 'Título'
	const message = 'Mensagem'

	const createAnnouncement = async (title: string, message: string, field: string) =>
		await prisma.announcement.create({
			data: {
				title,
				message,
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
				AnnouncementModule,
			],
			providers: [
				{
					provide: APP_INTERCEPTOR,
					useClass: ResponseInterceptor,
				},
			],
		}).compile()

		prisma = moduleRef.get(PrismaService)
		announcementService = moduleRef.get(AnnouncementService)

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
		it('Should Create an Announcement (as USER)', async () => {
			const announcement = await announcementService.create(user, {
				title,
				message,
			})

			expect(announcement.title).toBe(title)
			expect(announcement.message).toBe(message)
			expect(announcement.fieldId).toBe(user.fieldId)
		})

		it('Should Create an Announcement (as ADMIN)', async () => {
			const announcement = await announcementService.create(admin, {
				title,
				message,
			})

			expect(announcement.title).toBe(title)
			expect(announcement.message).toBe(message)
			expect(announcement.fieldId).toBe(admin.fieldId)
		})

		it('Should Not Create an Event (as WEB MASTER Missing Field)', async () => {
			const announcement = await announcementService.create(webMaster, {
				title,
				message,
			})

			expect(announcement.title).toBe(title)
			expect(announcement.message).toBe(message)
		})

		it('Should Create an Announcement (as WEB MASTER)', async () => {
			const announcement = await announcementService.create(webMaster, {
				title,
				message,
				field: field.id,
			})

			expect(announcement.title).toBe(title)
			expect(announcement.message).toBe(message)
			expect(announcement.fieldId).toBe(field.id)
		})
	})

	describe('findAll()', () => {
		it('Should Return an Empty Array', async () => {
			const response = await announcementService.findAll()

			expect(response.data).toHaveLength(0)
			expect(response.totalCount).toBe(0)
			expect(response.totalPages).toBe(0)
		})

		it(`Should Return an Announcement List With ${ITEMS_PER_PAGE} Items`, async () => {
			const announcementsToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							title: `Título ${i}`,
							message,
							fieldId: field.id,
						} as Announcement),
				)
			await prisma.announcement.createMany({
				data: announcementsToCreate,
			})

			const response = await announcementService.findAll()
			expect(response.data).toHaveLength(ITEMS_PER_PAGE)
			expect(response.totalCount).toBe(ITEMS_PER_PAGE)
			expect(response.totalPages).toBe(1)
		})

		const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE)
		it(`Should Return an Announcement List With ${randomN} Items`, async () => {
			const announcementsToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							title: `Título ${i}`,
							message,
							fieldId: field.id,
						} as Announcement),
				)
			await prisma.announcement.createMany({
				data: announcementsToCreate,
			})

			const response = await announcementService.findAll({
				itemsPerPage: randomN,
			})
			expect(response.data).toHaveLength(randomN)
			expect(response.totalCount).toBe(ITEMS_PER_PAGE)
			expect(response.totalPages).toBe(Math.ceil(response.totalCount / randomN))
		})
	})

	describe('findByRange()', () => {
		it('Should Return Events Based on Range', async () => {
			const announcementsToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							title: `Título ${i}`,
							message,
							fieldId: field.id,
						} as Announcement),
				)
			await prisma.announcement.createMany({
				data: announcementsToCreate,
			})

			const currentDate = new Date()
			const year = currentDate.getFullYear()
			const month = currentDate.getMonth() + 1
			const lastDay = new Date(year, month, 0).getDate()

			const response = await announcementService.findByRange({
				lte: new Date(`${year}-${month}-${lastDay}`),
				gte: new Date(`${year}-${month}-01`),
			})

			expect(response).toHaveLength(ITEMS_PER_PAGE)
			expect(response[0].title).toBeDefined()
			expect(response[0].message).toBeDefined()
		})
	})

	describe('findOne()', () => {
		it("Should Return Null (Doesn't Exists)", async () => {
			const randomId = uuidv4()
			const announcement = await announcementService.findOne(randomId)

			expect(announcement).toBeNull()
		})

		it('Should Return an Announcement', async () => {
			const announcementCreated = await createAnnouncement(title, message, field.id)

			const announcement = await announcementService.findOne(announcementCreated.id)
			expect(announcement.title).toBe(title)
			expect(announcement.message).toBe(message)
		})
	})

	describe('update()', () => {
		it('Should Not Update an Announcement (Not Found as USER)', async () => {
			try {
				const randomId = uuidv4()
				await announcementService.update(randomId, user, { title: 'lol' })
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('anúncio', 'o'))
			}
		})

		it('Should Not Update an Announcement (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await announcementService.update(randomId, admin, { title: 'lol' })
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('anúncio', 'o'))
			}
		})

		it('Should Not Update an Announcement (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await announcementService.update(randomId, webMaster, { title: 'lol' })
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('anúncio', 'o'))
			}
		})

		it('Should Not Update an Announcement (Different Field as USER)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const announcement = await createAnnouncement(title, message, differentField.id)
				const newTitle = 'Novo Título'

				await announcementService.update(announcement.id, user, { title: newTitle })
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Update an Announcement (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const announcement = await createAnnouncement(title, message, differentField.id)
				const newTitle = 'Novo Título'

				await announcementService.update(announcement.id, admin, { title: newTitle })
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Update an Announcement (as USER)', async () => {
			const announcement = await createAnnouncement(title, message, field.id)
			const newTitle = 'Novo Título'

			const announcementUpdated = await announcementService.update(announcement.id, user, {
				title: newTitle,
			})
			expect(announcementUpdated).toBeDefined()
			expect(announcementUpdated.title).toBe(newTitle)
		})

		it('Should Update an Announcement (as ADMIN)', async () => {
			const announcement = await createAnnouncement(title, message, field.id)
			const newTitle = 'Novo Título'

			const announcementUpdated = await announcementService.update(announcement.id, admin, {
				title: newTitle,
			})
			expect(announcementUpdated).toBeDefined()
			expect(announcementUpdated.title).toBe(newTitle)
		})

		it('Should Update an Announcement (as WEB MASTER)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const announcement = await createAnnouncement(title, message, field.id)
			const newTitle = 'Novo Título'

			const announcementUpdated = await announcementService.update(announcement.id, webMaster, {
				title: newTitle,
				field: differentField.id,
			})
			expect(announcementUpdated).toBeDefined()
			expect(announcementUpdated.title).toBe(newTitle)
			expect(announcementUpdated.fieldId).toBe(differentField.id)
		})
	})

	describe('remove()', () => {
		it('Should Not Remove an Announcement (Not Found as USER)', async () => {
			try {
				const randomId = uuidv4()
				await announcementService.remove(randomId, user)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('anúncio', 'o'))
			}
		})

		it('Should Not Remove an Announcement (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await announcementService.remove(randomId, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('anúncio', 'o'))
			}
		})

		it('Should Not Remove an Announcement (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await announcementService.remove(randomId, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('anúncio', 'o'))
			}
		})

		it('Should Not Remove an Announcement (Different Field as USER)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const announcement = await createAnnouncement(title, message, differentField.id)

				await announcementService.remove(announcement.id, user)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Remove an Announcement (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const announcement = await createAnnouncement(title, message, differentField.id)

				await announcementService.remove(announcement.id, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Remove an Announcement (as USER)', async () => {
			const announcement = await createAnnouncement(title, message, field.id)

			await announcementService.remove(announcement.id, user)
			const isAnnouncementDeleted = await prisma.announcement.findFirst({
				where: {
					id: announcement.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isAnnouncementDeleted.deleted).toBeDefined()
		})

		it('Should Remove an Announcement (as ADMIN)', async () => {
			const announcement = await createAnnouncement(title, message, field.id)

			await announcementService.remove(announcement.id, admin)
			const isAnnouncementDeleted = await prisma.announcement.findFirst({
				where: {
					id: announcement.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isAnnouncementDeleted.deleted).toBeDefined()
		})

		it('Should Remove an Announcement (as WEB MASTER)', async () => {
			const announcement = await createAnnouncement(title, message, field.id)

			await announcementService.remove(announcement.id, webMaster)
			const isAnnouncementDeleted = await prisma.announcement.findFirst({
				where: {
					id: announcement.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isAnnouncementDeleted.deleted).toBeDefined()
		})
	})

	describe('restore()', () => {
		it('Should Not Restore an Announcement (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await announcementService.restore({ ids: [randomId] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('anúncio', 'o'))
			}
		})

		it('Should Not Restore an Announcement (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await announcementService.restore({ ids: [randomId] }, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('anúncio', 'o'))
			}
		})

		it('Should Not Restore an Announcement (Different FIeld as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const announcement = await createAnnouncement(title, message, differentField.id)
				await prisma.announcement.delete({ where: { id: announcement.id } })
				await announcementService.restore({ ids: [announcement.id] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Restore an Announcement (as ADMIN)', async () => {
			const announcement = await createAnnouncement(title, message, field.id)
			await prisma.announcement.delete({ where: { id: announcement.id } })

			await announcementService.restore({ ids: [announcement.id] }, admin)
			const isAnnouncementRestored = await prisma.announcement.findFirst({
				where: {
					id: announcement.id,
				},
			})

			expect(isAnnouncementRestored.deleted).toBeNull()
		})

		it('Should Restore an Announcement (as WEB MASTER)', async () => {
			const announcement = await createAnnouncement(title, message, field.id)
			await prisma.announcement.delete({ where: { id: announcement.id } })

			await announcementService.restore({ ids: [announcement.id] }, webMaster)
			const isAnnouncementRestored = await prisma.announcement.findFirst({
				where: {
					id: announcement.id,
				},
			})

			expect(isAnnouncementRestored.deleted).toBeNull()
		})
	})

	describe('hardRemove()', () => {
		it('Should Not Hard Remove an Announcement (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await announcementService.hardRemove({ ids: [randomId] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('anúncio', 'o'))
			}
		})

		it('Should Not Hard Remove an Announcement (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await announcementService.hardRemove({ ids: [randomId] }, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('anúncio', 'o'))
			}
		})

		it('Should Not Hard Remove an Announcement (Different FIeld as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const announcement = await createAnnouncement(title, message, differentField.id)
				await prisma.announcement.delete({ where: { id: announcement.id } })
				await announcementService.hardRemove({ ids: [announcement.id] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should HardRemove an Announcement (as ADMIN)', async () => {
			const announcement = await createAnnouncement(title, message, field.id)
			await prisma.announcement.delete({ where: { id: announcement.id } })

			await announcementService.hardRemove({ ids: [announcement.id] }, admin)
			const isAnnouncementRemoved = await prisma.announcement.findFirst({
				where: {
					id: announcement.id,
					deleted: { not: new Date() },
				},
			})
			expect(isAnnouncementRemoved).toBeNull()
		})

		it('Should HardRemove an Announcement (as WEB MASTER)', async () => {
			const announcement = await createAnnouncement(title, message, field.id)
			await prisma.announcement.delete({ where: { id: announcement.id } })

			await announcementService.hardRemove({ ids: [announcement.id] }, webMaster)
			const isAnnouncementRemoved = await prisma.announcement.findFirst({
				where: {
					id: announcement.id,
					deleted: { not: new Date() },
				},
			})
			expect(isAnnouncementRemoved).toBeNull()
		})
	})
})
