import { Test } from '@nestjs/testing'
import { FileService } from 'src/file/file.service'
import { PrismaService } from 'src/prisma/prisma.service'
import { FILES_PATH, MAX_FILE_SIZE, TEST_FILES_PATH } from 'src/constants'
import { JestUtils } from 'src/utils'
import * as request from 'supertest'
import * as fs from 'fs'
import * as bcrypt from 'bcrypt'

import { v4 as uuidv4 } from 'uuid'
import { Field, File, Role, User } from '@prisma/client'
import { ConfigModule } from '@nestjs/config'
import configuration from 'src/config/configuration'
import { ITEMS_PER_PAGE } from 'src/constants'
import { NestExpressApplication } from '@nestjs/platform-express'
import { createField, createUser, getToken, setAppConfig } from 'src/utils/test'
import { AuthModule } from 'src/auth/auth.module'
import { PrismaModule } from 'src/prisma/prisma.module'
import { UserModule } from 'src/user/user.module'
import { FieldModule } from 'src/field/field.module'
import { FileModule } from 'src/file/file.module'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseInterceptor } from 'src/response.interceptor'

jest.setTimeout(30 * 1_000)

describe('File Service Integration', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	let fileService: FileService

	let field: Field
	let user: User
	let userToken: string
	let admin: User
	let adminToken: string
	let webMaster: User
	let webMasterToken: string

	const password = '12345678'
	const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync())
	const baseRoute = '/file'

	let filePathMaxSize: string
	let filesPathMaxSize: (n: number) => Promise<string>[]
	let filePathExceededSize: string
	let filesPathExceededSize: (n: number) => Promise<string>[]
	const fileNameMaxSize = 'maxSize.txt'
	const filesNameMaxSize = (n: number) => `maxSize-${n}.txt`
	const fileNameExceededSize = 'exceededSize.txt'
	// const filesNameExceededSize = (n: number) => `maxSize-${n}.txt`;

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
				FileModule,
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
		fileService = moduleRef.get(FileService)

		filePathMaxSize = await JestUtils.createFile(fileNameMaxSize, MAX_FILE_SIZE - 1)
		filePathExceededSize = await JestUtils.createFile(fileNameExceededSize, MAX_FILE_SIZE * 1.2)
		filesPathMaxSize = (n: number) =>
			Array(n)
				.fill(0)
				.map((k, i) => JestUtils.createFile(filesNameMaxSize(i), MAX_FILE_SIZE - 1))
		filesPathExceededSize = (n: number) =>
			Array(n)
				.fill(0)
				.map((k, i) => JestUtils.createFile(filesNameMaxSize(i), MAX_FILE_SIZE * 1.2))
	})

	afterAll(async () => {
		await app.close()
	})

	beforeEach(async () => {
		await prisma.cleanDataBase()
		fs.rmSync(FILES_PATH, { recursive: true, force: true })

		field = await createField(prisma, 'América', 'Brasil', 'Rio de Janeiro', 'AMEBRRJ01', 'Designação')

		user = await createUser(prisma, 'João', 'volunteer@email.com', hashedPassword, Role.VOLUNTEER, field.id)
		userToken = await getToken(app, user.email, password)

		admin = await createUser(prisma, 'Admin', 'sigma@email.com', hashedPassword, Role.ADMIN, field.id)
		adminToken = await getToken(app, admin.email, password)

		webMaster = await createUser(prisma, 'WebMaster', 'ultra.sigma@email.com', hashedPassword, Role.WEB_MASTER)
		webMasterToken = await getToken(app, webMaster.email, password)
	})

	afterAll(() => {
		//fs.unlinkSync(filePathMaxSize);
		//fs.unlinkSync(filePathExceededSize);
		fs.rmSync(FILES_PATH, { recursive: true, force: true })
		fs.rmSync(TEST_FILES_PATH, { recursive: true, force: true })
	})

	describe('Private Routes (as Non Logged User)', () => {
		it('Should Not Create a File', async () => {
			await request(app.getHttpServer()).post(baseRoute).attach('file', filePathMaxSize).expect(401)
		})

		it('Should Not Bulk Create Files', async () => {
			const maxFiles = 10
			const filesCount = Math.ceil(Math.random() * maxFiles)
			const files = await Promise.all(filesPathMaxSize(filesCount))

			const requestInstance = request(app.getHttpServer()).post(`${baseRoute}/bulk`)

			for (const file of files) {
				requestInstance.attach('files', file)
			}
			await requestInstance.expect(401)
		})

		it('Should Not Return List of Files', async () => {
			await request(app.getHttpServer()).get(baseRoute).expect(401)
		})

		it('Should Not Return a File', async () => {
			const randomId = uuidv4()
			await request(app.getHttpServer()).get(`${baseRoute}/${randomId}`).expect(401)
		})

		it('Should Not Bulk Remove Files', async () => {
			await request(app.getHttpServer())
				.delete(`${baseRoute}/bulk`)
				.send({ files: ['notafile.jpg'] })
				.expect(401)
		})

		it('Should Not Remove File', async () => {
			const randomId = uuidv4()
			await request(app.getHttpServer()).delete(`${baseRoute}/${randomId}`).expect(401)
		})

		it('Should Not Restore File', async () => {
			const randomId = uuidv4()
			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.send({ ids: [randomId] })
				.expect(401)
		})

		it('Should Not Hard Remove File', async () => {
			const randomId = uuidv4()
			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.send({ ids: [randomId] })
				.expect(401)
		})
	})

	describe('Private Routes (as Logged VOLUNTEER)', () => {
		it('Should Not Save File Nor Create an Entry (Exceeded Size)', async () => {
			await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${userToken}`)
				.attach('file', filePathExceededSize)
				.expect(422)

			const fileDoc = await prisma.file.findFirst({
				where: {
					name: { contains: fileNameExceededSize },
				},
			})
			expect(fileDoc).toBeNull()

			const filesInFolder = fs.readdirSync(FILES_PATH)
			expect(filesInFolder).toHaveLength(0)
		})

		it('Should Create a File', async () => {
			await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${userToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			const fileDoc = await prisma.file.findFirst({
				where: {
					name: { contains: fileNameMaxSize },
				},
			})
			expect(fileDoc).toBeDefined()

			const fileExists = fs.existsSync(`${FILES_PATH}${fileDoc.name}`)
			expect(fileExists).toBeTruthy()
		})

		it('Should Not Save Files Nor Create an Entries (Exceeded Size)', async () => {
			const maxFiles = 10
			const filesCount = Math.ceil(Math.random() * maxFiles)
			const files = await Promise.all(filesPathExceededSize(filesCount))

			const requestInstance = request(app.getHttpServer())
				.post(`${baseRoute}/bulk`)
				.set('Authorization', `bearer ${userToken}`)

			for (const file of files) {
				requestInstance.attach('files', file)
			}
			await requestInstance.expect(422)

			const fileDoc = await prisma.file.count()
			expect(fileDoc).toBe(0)

			const filesInFolder = fs.readdirSync(FILES_PATH)
			expect(filesInFolder).toHaveLength(0)
		})

		it('Should Bulk Create Files', async () => {
			const maxFiles = 10
			const filesCount = Math.ceil(Math.random() * maxFiles)
			const files = await Promise.all(filesPathMaxSize(filesCount))

			const requestInstance = request(app.getHttpServer())
				.post(`${baseRoute}/bulk`)
				.set('Authorization', `bearer ${userToken}`)

			for (const file of files) {
				requestInstance.attach('files', file)
			}
			await requestInstance.expect(201)

			const fileDoc = await prisma.file.count()
			expect(fileDoc).toBe(filesCount)

			const filesInFolder = fs.readdirSync(FILES_PATH)
			expect(filesInFolder).toHaveLength(filesCount)
		})

		it(`Should Return a File List With ${ITEMS_PER_PAGE} Items`, async () => {
			const filesToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							name: filesNameMaxSize(i),
							mimeType: 'text/plain',
							size: MAX_FILE_SIZE,
						} as File),
				)
			await prisma.file.createMany({
				data: filesToCreate,
			})

			const response = await request(app.getHttpServer())
				.get(baseRoute)
				.set('Authorization', `bearer ${userToken}`)
				.expect(200)

			expect(response.body.data).toHaveLength(ITEMS_PER_PAGE)
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(String(1))
		})

		const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE)
		it(`Should Return a File List With ${randomN} Items`, async () => {
			const filesToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							name: filesNameMaxSize(i),
							mimeType: 'text/plain',
							size: MAX_FILE_SIZE,
						} as File),
				)
			await prisma.file.createMany({
				data: filesToCreate,
			})

			const response = await request(app.getHttpServer())
				.get(baseRoute)
				.set('Authorization', `bearer ${userToken}`)
				.query({ itemsPerPage: randomN })
				.expect(200)

			expect(response.body.data).toHaveLength(randomN)
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(String(Math.ceil(+response.headers['x-total-count'] / randomN)))
		})

		it('Should Return a File', async () => {
			const file = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${userToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			const res = await request(app.getHttpServer())
				.get(`${baseRoute}/${file.body.data.id}`)
				.set('Authorization', `bearer ${userToken}`)
				.expect(200)

			expect(res.body.data.name).toBeDefined()
			expect(res.body.data.mimeType).toBeDefined()
			expect(res.body.data.size).toBeDefined()
			expect(res.body.data.path).toBeDefined()
		})

		it('Should Not Remove File (Not Found)', async () => {
			const randomId = uuidv4()
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${randomId}`)
				.set('Authorization', `bearer ${userToken}`)
				.expect(404)
		})

		it('Should Not Bulk Remove File (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${webMasterToken}`)
				.attach('file', filePathMaxSize)
				.field('field', differentField.id)
				.expect(201)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/bulk`)
				.set('Authorization', `bearer ${userToken}`)
				.send({ files: [res.body.data.name] })
				.expect(200)

			const fileIsntDeleted = (
				await request(app.getHttpServer())
					.get(`${baseRoute}/${res.body.data.id}`)
					.set('Authorization', `bearer ${userToken}`)
					.expect(200)
			).body.data.deleted

			expect(fileIsntDeleted).toBeFalsy()
		})

		it('Should Bulk Remove File (Doc, Not File)', async () => {
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${userToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/bulk`)
				.set('Authorization', `bearer ${userToken}`)
				.send({ files: [res.body.data.name] })
				.expect(200)

			const fileIsDeleted = (
				await request(app.getHttpServer())
					.get(`${baseRoute}/${res.body.data.id}`)
					.set('Authorization', `bearer ${userToken}`)
					.expect(200)
			).body.data
			expect(fileIsDeleted).toBeNull()

			const fileExists = fs.existsSync(`${FILES_PATH}${res.body.data.name}`)
			expect(fileExists).toBeTruthy()
		})

		it('Should Not Remove File (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const file = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${webMasterToken}`)
				.attach('file', filePathMaxSize)
				.field('field', differentField.id)
				.expect(201)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/${file.body.data.id}`)
				.set('Authorization', `bearer ${userToken}`)
				.expect(403)
		})

		it('Should Remove File (Doc, Not File)', async () => {
			const file = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${userToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/${file.body.data.id}`)
				.set('Authorization', `bearer ${userToken}`)
				.expect(200)

			const fileExists = fs.existsSync(`${FILES_PATH}${file.body.data.name}`)
			expect(fileExists).toBeTruthy()
		})

		it('Should Not Restore File', async () => {
			await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${userToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			const file = await prisma.file.findFirst({
				where: {
					name: { contains: fileNameMaxSize },
				},
			})
			await fileService.remove(file.id, user)

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.send({ ids: [file.id] })
				.set('Authorization', `bearer ${userToken}`)
				.expect(403)
		})

		it('Should Not Hard Remove File', async () => {
			await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${userToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			const file = await prisma.file.findFirst({
				where: {
					name: { contains: fileNameMaxSize },
				},
			})
			await fileService.remove(file.id, user)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.send({ ids: [file.id] })
				.set('Authorization', `bearer ${userToken}`)
				.expect(403)
		})
	})

	describe('Private Routes (as Logged ADMIN)', () => {
		it('Should Not Save File Nor Create an Entry (Exceeded Size)', async () => {
			await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${adminToken}`)
				.attach('file', filePathExceededSize)
				.expect(422)

			const fileDoc = await prisma.file.findFirst({
				where: {
					name: { contains: fileNameExceededSize },
				},
			})
			expect(fileDoc).toBeNull()

			const filesInFolder = fs.readdirSync(FILES_PATH)
			expect(filesInFolder).toHaveLength(0)
		})

		it('Should Create a File', async () => {
			await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${adminToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			const fileDoc = await prisma.file.findFirst({
				where: {
					name: { contains: fileNameMaxSize },
				},
			})
			expect(fileDoc).toBeDefined()

			const fileExists = fs.existsSync(`${FILES_PATH}${fileDoc.name}`)
			expect(fileExists).toBeTruthy()
		})

		it('Should Not Save Files Nor Create Entries (Exceeded Size)', async () => {
			const maxFiles = 10
			const filesCount = Math.ceil(Math.random() * maxFiles)
			const files = await Promise.all(filesPathExceededSize(filesCount))

			const requestInstance = request(app.getHttpServer())
				.post(`${baseRoute}/bulk`)
				.set('Authorization', `bearer ${adminToken}`)

			for (const file of files) {
				requestInstance.attach('files', file)
			}
			await requestInstance.expect(422)

			const fileDoc = await prisma.file.count()
			expect(fileDoc).toBe(0)

			const filesInFolder = fs.readdirSync(FILES_PATH)
			expect(filesInFolder).toHaveLength(0)
		})

		it('Should Bulk Create Files', async () => {
			const maxFiles = 10
			const filesCount = Math.ceil(Math.random() * maxFiles)
			const files = await Promise.all(filesPathMaxSize(filesCount))

			const requestInstance = request(app.getHttpServer())
				.post(`${baseRoute}/bulk`)
				.set('Authorization', `bearer ${adminToken}`)

			for (const file of files) {
				requestInstance.attach('files', file)
			}
			await requestInstance.expect(201)

			const fileDoc = await prisma.file.count()
			expect(fileDoc).toBe(filesCount)

			const filesInFolder = fs.readdirSync(FILES_PATH)
			expect(filesInFolder).toHaveLength(filesCount)
		})

		it(`Should Return a File List With ${ITEMS_PER_PAGE} Items`, async () => {
			const filesToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							name: filesNameMaxSize(i),
							mimeType: 'text/plain',
							size: MAX_FILE_SIZE,
						} as File),
				)
			await prisma.file.createMany({
				data: filesToCreate,
			})

			const response = await request(app.getHttpServer())
				.get(baseRoute)
				.set('Authorization', `bearer ${adminToken}`)
				.expect(200)

			expect(response.body.data).toHaveLength(ITEMS_PER_PAGE)
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(String(1))
		})

		const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE)
		it(`Should Return a File List With ${randomN} Items`, async () => {
			const filesToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							name: filesNameMaxSize(i),
							mimeType: 'text/plain',
							size: MAX_FILE_SIZE,
						} as File),
				)
			await prisma.file.createMany({
				data: filesToCreate,
			})

			const response = await request(app.getHttpServer())
				.get(baseRoute)
				.set('Authorization', `bearer ${adminToken}`)
				.query({ itemsPerPage: randomN })
				.expect(200)

			expect(response.body.data).toHaveLength(randomN)
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(String(Math.ceil(+response.headers['x-total-count'] / randomN)))
		})

		it('Should Return a File', async () => {
			const file = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${adminToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			const res = await request(app.getHttpServer())
				.get(`${baseRoute}/${file.body.data.id}`)
				.set('Authorization', `bearer ${adminToken}`)
				.expect(200)

			expect(res.body.data.name).toBeDefined()
			expect(res.body.data.mimeType).toBeDefined()
			expect(res.body.data.size).toBeDefined()
			expect(res.body.data.path).toBeDefined()
		})

		it('Should Not Bulk Remove File (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${webMasterToken}`)
				.attach('file', filePathMaxSize)
				.field('field', differentField.id)
				.expect(201)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/bulk`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ files: [res.body.data.name] })
				.expect(200)

			const fileIsntDeleted = (
				await request(app.getHttpServer())
					.get(`${baseRoute}/${res.body.data.id}`)
					.set('Authorization', `bearer ${adminToken}`)
					.expect(200)
			).body.data.deleted

			expect(fileIsntDeleted).toBeFalsy()
		})

		it('Should Bulk Remove File (Doc, Not File)', async () => {
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${adminToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/bulk`)
				.set('Authorization', `bearer ${adminToken}`)
				.send({ files: [res.body.data.name] })
				.expect(200)

			const fileIsDeleted = (
				await request(app.getHttpServer())
					.get(`${baseRoute}/${res.body.data.id}`)
					.set('Authorization', `bearer ${adminToken}`)
					.expect(200)
			).body.data
			expect(fileIsDeleted).toBeNull()

			const fileExists = fs.existsSync(`${FILES_PATH}${res.body.data.name}`)
			expect(fileExists).toBeTruthy()
		})

		it('Should Not Remove File (Not Found)', async () => {
			const randomId = uuidv4()
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${randomId}`)
				.set('Authorization', `bearer ${adminToken}`)
				.expect(404)
		})

		it('Should Not Remove File (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			const file = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${webMasterToken}`)
				.attach('file', filePathMaxSize)
				.field('field', differentField.id)
				.expect(201)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/${file.body.data.id}`)
				.set('Authorization', `bearer ${adminToken}`)
				.expect(403)
		})

		it('Should Remove File (Doc, Not File)', async () => {
			const file = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${adminToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/${file.body.data.id}`)
				.set('Authorization', `bearer ${adminToken}`)
				.expect(200)

			const fileExists = fs.existsSync(`${FILES_PATH}${file.body.data.name}`)
			expect(fileExists).toBeTruthy()
		})

		it('Should Not Restore File (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${webMasterToken}`)
				.attach('file', filePathMaxSize)
				.field('field', differentField.id)
				.expect(201)

			const file = await prisma.file.findFirst({
				where: {
					name: { contains: fileNameMaxSize },
				},
			})
			await fileService.remove(file.id, webMaster)

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.send({ ids: [file.id] })
				.set('Authorization', `bearer ${adminToken}`)
				.expect(403)
		})

		it('Should Restore File', async () => {
			await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${adminToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			const file = await prisma.file.findFirst({
				where: {
					name: { contains: fileNameMaxSize },
				},
			})
			await fileService.remove(file.id, admin)

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.send({ ids: [file.id] })
				.set('Authorization', `bearer ${adminToken}`)
				.expect(200)

			const isFileRestored = await prisma.file.findFirst({
				where: {
					name: file.name,
					deleted: null,
				},
			})
			expect(isFileRestored.deleted).toBeNull()
		})

		it('Should Not Hard Remove File (Different Field)', async () => {
			const differentField = await createField(prisma, 'América', 'Brasil', 'São Paulo', 'AMEBRSP01', 'Designação')
			await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${webMasterToken}`)
				.attach('file', filePathMaxSize)
				.field('field', differentField.id)
				.expect(201)

			const file = await prisma.file.findFirst({
				where: {
					name: { contains: fileNameMaxSize },
				},
			})
			await fileService.remove(file.id, webMaster)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.send({ ids: [file.id] })
				.set('Authorization', `bearer ${userToken}`)
				.expect(403)
		})

		it('Should Hard Remove File', async () => {
			await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${adminToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			const file = await prisma.file.findFirst({
				where: {
					name: { contains: fileNameMaxSize },
				},
			})
			await fileService.remove(file.id, admin)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.send({ ids: [file.id] })
				.set('Authorization', `bearer ${adminToken}`)
				.expect(200)

			const isFileRemoved = await prisma.file.findFirst({
				where: {
					name: file.name,
					deleted: { not: new Date() },
				},
			})
			expect(isFileRemoved).toBeNull()

			const fileExists = fs.existsSync(`${FILES_PATH}${file.name}`)
			expect(fileExists).toBeFalsy()
		})
	})

	describe('Private Routes (as Logged WEB MASTER)', () => {
		it('Should Not Save File Nor Create an Entry (Exceeded Size)', async () => {
			await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${webMasterToken}`)
				.attach('file', filePathExceededSize)
				.expect(422)

			const fileDoc = await prisma.file.findFirst({
				where: {
					name: { contains: fileNameExceededSize },
				},
			})
			expect(fileDoc).toBeNull()

			const filesInFolder = fs.readdirSync(FILES_PATH)
			expect(filesInFolder).toHaveLength(0)
		})

		it('Should Create a File', async () => {
			await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${webMasterToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			const fileDoc = await prisma.file.findFirst({
				where: {
					name: { contains: fileNameMaxSize },
				},
			})
			expect(fileDoc).toBeDefined()

			const fileExists = fs.existsSync(`${FILES_PATH}${fileDoc.name}`)
			expect(fileExists).toBeTruthy()
		})

		it('Should Not Save Files Nor Create Entries (Exceeded Size)', async () => {
			const maxFiles = 10
			const filesCount = Math.ceil(Math.random() * maxFiles)
			const files = await Promise.all(filesPathExceededSize(filesCount))

			const requestInstance = request(app.getHttpServer())
				.post(`${baseRoute}/bulk`)
				.set('Authorization', `bearer ${webMasterToken}`)

			for (const file of files) {
				requestInstance.attach('files', file)
			}
			await requestInstance.expect(422)

			const fileDoc = await prisma.file.count()
			expect(fileDoc).toBe(0)

			const filesInFolder = fs.readdirSync(FILES_PATH)
			expect(filesInFolder).toHaveLength(0)
		})

		it('Should Bulk Create Files', async () => {
			const maxFiles = 10
			const filesCount = Math.ceil(Math.random() * maxFiles)
			const files = await Promise.all(filesPathMaxSize(filesCount))

			const requestInstance = request(app.getHttpServer())
				.post(`${baseRoute}/bulk`)
				.set('Authorization', `bearer ${webMasterToken}`)

			for (const file of files) {
				requestInstance.attach('files', file)
			}
			await requestInstance.expect(201)

			const fileDoc = await prisma.file.count()
			expect(fileDoc).toBe(filesCount)

			const filesInFolder = fs.readdirSync(FILES_PATH)
			expect(filesInFolder).toHaveLength(filesCount)
		})

		it(`Should Return a File List With ${ITEMS_PER_PAGE} Items`, async () => {
			const filesToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							name: filesNameMaxSize(i),
							mimeType: 'text/plain',
							size: MAX_FILE_SIZE,
						} as File),
				)
			await prisma.file.createMany({
				data: filesToCreate,
			})

			const response = await request(app.getHttpServer())
				.get(baseRoute)
				.set('Authorization', `bearer ${webMasterToken}`)
				.expect(200)

			expect(response.body.data).toHaveLength(ITEMS_PER_PAGE)
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(String(1))
		})

		const randomN = Math.ceil(Math.random() * ITEMS_PER_PAGE)
		it(`Should Return a File List With ${randomN} Items`, async () => {
			const filesToCreate = Array(ITEMS_PER_PAGE)
				.fill(0)
				.map(
					(v, i) =>
						({
							name: filesNameMaxSize(i),
							mimeType: 'text/plain',
							size: MAX_FILE_SIZE,
						} as File),
				)
			await prisma.file.createMany({
				data: filesToCreate,
			})

			const response = await request(app.getHttpServer())
				.get(baseRoute)
				.set('Authorization', `bearer ${webMasterToken}`)
				.query({ itemsPerPage: randomN })
				.expect(200)

			expect(response.body.data).toHaveLength(randomN)
			expect(response.headers['x-total-count']).toBe(String(ITEMS_PER_PAGE))
			expect(response.headers['x-total-pages']).toBe(String(Math.ceil(+response.headers['x-total-count'] / randomN)))
		})

		it('Should Return a File', async () => {
			const file = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${adminToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			const res = await request(app.getHttpServer())
				.get(`${baseRoute}/${file.body.data.id}`)
				.set('Authorization', `bearer ${webMasterToken}`)
				.expect(200)

			expect(res.body.data.name).toBeDefined()
			expect(res.body.data.mimeType).toBeDefined()
			expect(res.body.data.size).toBeDefined()
			expect(res.body.data.path).toBeDefined()
		})

		it('Should Bulk Remove File (Doc, Not File)', async () => {
			const res = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${webMasterToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/bulk`)
				.set('Authorization', `bearer ${webMasterToken}`)
				.send({ files: [res.body.data.name] })
				.expect(200)

			const fileIsDeleted = (
				await request(app.getHttpServer())
					.get(`${baseRoute}/${res.body.data.id}`)
					.set('Authorization', `bearer ${webMasterToken}`)
					.expect(200)
			).body.data
			expect(fileIsDeleted).toBeNull()

			const fileExists = fs.existsSync(`${FILES_PATH}${res.body.data.name}`)
			expect(fileExists).toBeTruthy()
		})

		it('Should Not Remove File (Not Found)', async () => {
			const randomId = uuidv4()
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${randomId}`)
				.set('Authorization', `bearer ${adminToken}`)
				.expect(404)
		})

		it('Should Not Remove File (Not Found)', async () => {
			const randomId = uuidv4()
			await request(app.getHttpServer())
				.delete(`${baseRoute}/${randomId}`)
				.set('Authorization', `bearer ${webMasterToken}`)
				.expect(404)
		})

		it('Should Remove File (Doc, Not File)', async () => {
			const file = await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${adminToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/${file.body.data.id}`)
				.set('Authorization', `bearer ${webMasterToken}`)
				.expect(200)

			const fileExists = fs.existsSync(`${FILES_PATH}${file.body.data.name}`)
			expect(fileExists).toBeTruthy()
		})

		it('Should Restore File', async () => {
			await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${adminToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			const file = await prisma.file.findFirst({
				where: {
					name: { contains: fileNameMaxSize },
				},
			})
			await fileService.remove(file.id, admin)

			await request(app.getHttpServer())
				.put(`${baseRoute}/restore`)
				.send({ ids: [file.id] })
				.set('Authorization', `bearer ${webMasterToken}`)
				.expect(200)

			const isFileRestored = await prisma.file.findFirst({
				where: {
					name: file.name,
					deleted: null,
				},
			})
			expect(isFileRestored.deleted).toBeNull()
		})

		it('Should Hard Remove File', async () => {
			await request(app.getHttpServer())
				.post(baseRoute)
				.set('Authorization', `bearer ${adminToken}`)
				.attach('file', filePathMaxSize)
				.expect(201)

			const file = await prisma.file.findFirst({
				where: {
					name: { contains: fileNameMaxSize },
				},
			})
			await fileService.remove(file.id, admin)

			await request(app.getHttpServer())
				.delete(`${baseRoute}/hard-remove`)
				.send({ ids: [file.id] })
				.set('Authorization', `bearer ${webMasterToken}`)
				.expect(200)

			const isFileRemoved = await prisma.file.findFirst({
				where: {
					name: file.name,
					deleted: { not: new Date() },
				},
			})
			expect(isFileRemoved).toBeNull()

			const fileExists = fs.existsSync(`${FILES_PATH}${file.name}`)
			expect(fileExists).toBeFalsy()
		})
	})
})
