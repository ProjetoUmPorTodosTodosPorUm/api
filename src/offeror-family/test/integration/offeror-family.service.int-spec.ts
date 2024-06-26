import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Field, OfferorFamily, OfferorFamilyGroup, Role, User } from '@prisma/client'
import { ITEMS_PER_PAGE, MESSAGE, TEMPLATE } from 'src/constants'
import { OfferorFamilyService } from 'src/offeror-family/offeror-family.service'
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
import { OfferorFamilyModule } from 'src/offeror-family/offeror-family.module'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseInterceptor } from 'src/response.interceptor'

describe('Offeror Family Service Integration', () => {
	let prisma: PrismaService
	let offerorFamilyService: OfferorFamilyService

	let field: Field
	let user: User
	let admin: User
	let webMaster: User

	const password = '12345678'
	const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync())

	const familyName = 'Sousa'
	const representative = 'Sigma'
	const commitment = 'all'
	const group = OfferorFamilyGroup.CHURCH

	const createOfferorFamily = async (
		familyName: string,
		representative: string,
		commitment: string,
		group: OfferorFamilyGroup,
		field: string,
	) =>
		await prisma.offerorFamily.create({
			data: {
				familyName,
				representative,
				commitment,
				group,
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
				OfferorFamilyModule,
			],
			providers: [
				{
					provide: APP_INTERCEPTOR,
					useClass: ResponseInterceptor,
				},
			],
		}).compile()

		prisma = moduleRef.get(PrismaService)
		offerorFamilyService = moduleRef.get(OfferorFamilyService)

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
		it('Should Create an Offeror Family (as USER)', async () => {
			const offerorFamily = await offerorFamilyService.create(user, {
				familyName,
				representative,
				commitment,
				group,
			})

			expect(offerorFamily.representative).toBe(representative)
			expect(offerorFamily.commitment).toBe(commitment)
			expect(offerorFamily.group).toBe(group)
			expect(offerorFamily.fieldId).toBe(field.id)
		})

		it('Should Create an Offeror Family (as ADMIN)', async () => {
			const offerorFamily = await offerorFamilyService.create(admin, {
				familyName,
				representative,
				commitment,
				group,
			})

			expect(offerorFamily.representative).toBe(representative)
			expect(offerorFamily.commitment).toBe(commitment)
			expect(offerorFamily.group).toBe(group)
			expect(offerorFamily.fieldId).toBe(field.id)
		})

		it('Should Not Create an Offeror Family (as WEB MASTER && Missing Data)', async () => {
			try {
				await offerorFamilyService.create(webMaster, {
					familyName,
					representative,
					commitment,
					group,
				})
			} catch (error) {
				expect(error).toBeInstanceOf(BadRequestException)
				expect(error.response.message).toBe(TEMPLATE.VALIDATION.IS_NOT_EMPTY('field'))
			}
		})

		it('Should Create an Offeror Family (as WEB MASTER)', async () => {
			const offerorFamily = await offerorFamilyService.create(webMaster, {
				familyName,
				representative,
				commitment,
				group,
				field: field.id,
			})

			expect(offerorFamily.representative).toBe(representative)
			expect(offerorFamily.commitment).toBe(commitment)
			expect(offerorFamily.group).toBe(group)
			expect(offerorFamily.fieldId).toBe(field.id)
		})
	})

	describe('findAll()', () => {
		it('Should Return an Empty Array', async () => {
			const response = await offerorFamilyService.findAll()

			expect(response.data).toHaveLength(0)
			expect(response.totalCount).toBe(0)
			expect(response.totalPages).toBe(0)
		})

		it(`Should Return an Offeror Family List With ${ITEMS_PER_PAGE} Items`, async () => {
			const offerorFamiliesToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							familyName,
							representative: `João ${i}`,
							commitment,
							group,
							fieldId: field.id,
						} as OfferorFamily),
				)
			await prisma.offerorFamily.createMany({
				data: offerorFamiliesToCreate,
			})

			const response = await offerorFamilyService.findAll()
			expect(response.data).toHaveLength(ITEMS_PER_PAGE)
			expect(response.totalCount).toBe(ITEMS_PER_PAGE)
			expect(response.totalPages).toBe(1)
		})

		const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE)
		it(`Should Return an Offeror Family List With ${randomN} Items`, async () => {
			const offerorFamiliesToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							familyName,
							representative: `João ${i}`,
							commitment,
							group,
							fieldId: field.id,
						} as OfferorFamily),
				)
			await prisma.offerorFamily.createMany({
				data: offerorFamiliesToCreate,
			})

			const response = await offerorFamilyService.findAll({
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
			const offerorFamily = await offerorFamilyService.findOne(randomId)

			expect(offerorFamily).toBeNull()
		})

		it('Should Return an Offeror Family', async () => {
			const offerorFamilyCreated = await createOfferorFamily(familyName, representative, commitment, group, field.id)

			const offerorFamily = await offerorFamilyService.findOne(offerorFamilyCreated.id)
			expect(offerorFamily).toBeDefined()
		})
	})

	describe('update()', () => {
		it('Should Not Update an Offeror Family (Not Found as USER)', async () => {
			try {
				const randomId = uuidv4()
				await offerorFamilyService.update(randomId, user, {
					representative: 'lol',
				})
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('família ofertante', 'a'))
			}
		})

		it('Should Not Update an Offeror Family (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await offerorFamilyService.update(randomId, admin, {
					representative: 'lol',
				})
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('família ofertante', 'a'))
			}
		})

		it('Should Not Update an Offeror Family (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await offerorFamilyService.update(randomId, webMaster, {
					representative: 'lol',
				})
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('família ofertante', 'a'))
			}
		})

		it('Should Not Update an Offeror Family (Different Field as USER)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const offerorFamily = await createOfferorFamily(familyName, representative, commitment, group, differentField.id)
				const newRepresentative = 'Abreu'
				await offerorFamilyService.update(offerorFamily.id, user, {
					representative: newRepresentative,
				})
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Update an Offeror Family (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const offerorFamily = await createOfferorFamily(familyName, representative, commitment, group, differentField.id)
				const newRepresentative = 'Abreu'
				await offerorFamilyService.update(offerorFamily.id, admin, {
					representative: newRepresentative,
				})
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Update an Offeror Family (as USER)', async () => {
			const offerorFamily = await createOfferorFamily(familyName, representative, commitment, group, field.id)
			const newRepresentative = 'Abreu'

			const offerorFamilyUpdated = await offerorFamilyService.update(offerorFamily.id, user, {
				representative: newRepresentative,
			})
			expect(offerorFamilyUpdated).toBeDefined()
			expect(offerorFamilyUpdated.representative).toBe(newRepresentative)
		})

		it('Should Update an Offeror Family (as ADMIN)', async () => {
			const offerorFamily = await createOfferorFamily(familyName,representative, commitment, group, field.id)
			const newRepresentative = 'Abreu'

			const offerorFamilyUpdated = await offerorFamilyService.update(offerorFamily.id, admin, {
				representative: newRepresentative,
			})
			expect(offerorFamilyUpdated).toBeDefined()
			expect(offerorFamilyUpdated.representative).toBe(newRepresentative)
		})

		it('Should Update an Offeror Family (as WEB MASTER)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const offerorFamily = await createOfferorFamily(familyName,representative, commitment, group, field.id)
			const newRepresentative = 'Abreu'

			const offerorFamilyUpdated = await offerorFamilyService.update(offerorFamily.id, webMaster, {
				representative: newRepresentative,
				field: differentField.id,
			})
			expect(offerorFamilyUpdated).toBeDefined()
			expect(offerorFamilyUpdated.representative).toBe(newRepresentative)
			expect(offerorFamilyUpdated.fieldId).toBe(differentField.id)
		})
	})

	describe('remove()', () => {
		it('Should Not Remove an Offeror Family (Not Found as USER)', async () => {
			try {
				const randomId = uuidv4()
				await offerorFamilyService.remove(randomId, user)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('família ofertante', 'a'))
			}
		})

		it('Should Not Remove an Offeror Family (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await offerorFamilyService.remove(randomId, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('família ofertante', 'a'))
			}
		})

		it('Should Not Remove an Offeror Family (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await offerorFamilyService.remove(randomId, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('família ofertante', 'a'))
			}
		})

		it('Should Not Remove an Offeror Family (Different Field as USER)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const offerorFamily = await createOfferorFamily(familyName,representative, commitment, group, differentField.id)
				await offerorFamilyService.remove(offerorFamily.id, user)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Remove an Offeror Family (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const offerorFamily = await createOfferorFamily(familyName,representative, commitment, group, differentField.id)
				await offerorFamilyService.remove(offerorFamily.id, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Remove an Offeror family (as USER)', async () => {
			const offerorFamily = await createOfferorFamily(familyName, representative, commitment, group, field.id)

			await offerorFamilyService.remove(offerorFamily.id, user)
			const isOfferorFamilyDeleted = await prisma.offerorFamily.findFirst({
				where: {
					id: offerorFamily.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isOfferorFamilyDeleted.deleted).toBeDefined()
		})

		it('Should Remove an Offeror family (as ADMIN)', async () => {
			const offerorFamily = await createOfferorFamily(familyName, representative, commitment, group, field.id)

			await offerorFamilyService.remove(offerorFamily.id, admin)
			const isOfferorFamilyDeleted = await prisma.offerorFamily.findFirst({
				where: {
					id: offerorFamily.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isOfferorFamilyDeleted.deleted).toBeDefined()
		})

		it('Should Remove an Offeror family (as WEB MASTER)', async () => {
			const offerorFamily = await createOfferorFamily(familyName, representative, commitment, group, field.id)

			await offerorFamilyService.remove(offerorFamily.id, webMaster)
			const isOfferorFamilyDeleted = await prisma.offerorFamily.findFirst({
				where: {
					id: offerorFamily.id,
					deleted: { lte: new Date() },
				},
			})
			expect(isOfferorFamilyDeleted.deleted).toBeDefined()
		})
	})

	describe('restore()', () => {
		it('Should Not Restore an Offeror Family (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await offerorFamilyService.restore({ ids: [randomId] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('Família ofertante', 'a'))
			}
		})

		it('Should Not Restore an Offeror Family (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await offerorFamilyService.restore({ ids: [randomId] }, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('Família ofertante', 'a'))
			}
		})

		it('Should Not Restore an Offeror Family (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const offerorFamily = await createOfferorFamily(familyName, representative, commitment, group, differentField.id)
				await prisma.offerorFamily.delete({ where: { id: offerorFamily.id } })
				await offerorFamilyService.restore({ ids: [offerorFamily.id] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Restore an Offeror Family (as ADMIN)', async () => {
			const offerorFamily = await createOfferorFamily(familyName, representative, commitment, group, field.id)
			await prisma.offerorFamily.delete({ where: { id: offerorFamily.id } })

			await offerorFamilyService.restore({ ids: [offerorFamily.id] }, admin)
			const isOfferorFamilyRestored = await prisma.offerorFamily.findFirst({
				where: {
					id: offerorFamily.id,
				},
			})

			expect(isOfferorFamilyRestored.deleted).toBeNull()
		})

		it('Should Restore an Offeror Family (as WEB MASTER)', async () => {
			const offerorFamily = await createOfferorFamily(familyName, representative, commitment, group, field.id)
			await prisma.offerorFamily.delete({ where: { id: offerorFamily.id } })

			await offerorFamilyService.restore({ ids: [offerorFamily.id] }, webMaster)
			const isOfferorFamilyRestored = await prisma.offerorFamily.findFirst({
				where: {
					id: offerorFamily.id,
				},
			})

			expect(isOfferorFamilyRestored.deleted).toBeNull()
		})
	})

	describe('hardRemove()', () => {
		it('Should Not Hard Remove an Offeror Family (Not Found as ADMIN)', async () => {
			try {
				const randomId = uuidv4()
				await offerorFamilyService.hardRemove({ ids: [randomId] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('Família ofertante', 'a'))
			}
		})

		it('Should Not Hard Remove an Offeror Family (Not Found as WEB MASTER)', async () => {
			try {
				const randomId = uuidv4()
				await offerorFamilyService.hardRemove({ ids: [randomId] }, webMaster)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('Família ofertante', 'a'))
			}
		})

		it('Should Not Hard Remove an Offeror Family (Different Field as ADMIN)', async () => {
			try {
				const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
				const offerorFamily = await createOfferorFamily(familyName, representative, commitment, group, differentField.id)
				await prisma.offerorFamily.delete({ where: { id: offerorFamily.id } })
				await offerorFamilyService.hardRemove({ ids: [offerorFamily.id] }, admin)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Hard Remove an Offeror Family (as ADMIN)', async () => {
			const offerorFamily = await createOfferorFamily(familyName, representative, commitment, group, field.id)
			await prisma.offerorFamily.delete({ where: { id: offerorFamily.id } })

			await offerorFamilyService.hardRemove({ ids: [offerorFamily.id] }, admin)
			const isOfferorFamilyRemoved = await prisma.offerorFamily.findFirst({
				where: {
					id: offerorFamily.id,
					deleted: { not: new Date() },
				},
			})
			expect(isOfferorFamilyRemoved).toBeNull()
		})

		it('Should Hard Remove an Offeror Family (as WEB MASTER)', async () => {
			const offerorFamily = await createOfferorFamily(familyName, representative, commitment, group, field.id)
			await prisma.offerorFamily.delete({ where: { id: offerorFamily.id } })

			await offerorFamilyService.hardRemove({ ids: [offerorFamily.id] }, webMaster)
			const isOfferorFamilyRemoved = await prisma.offerorFamily.findFirst({
				where: {
					id: offerorFamily.id,
					deleted: { not: new Date() },
				},
			})
			expect(isOfferorFamilyRemoved).toBeNull()
		})
	})
})
