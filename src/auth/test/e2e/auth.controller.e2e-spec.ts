import { Field, Role, TokenType, User } from '@prisma/client'
import { PrismaService } from 'src/prisma/prisma.service'
import * as bcrypt from 'bcrypt'
import * as request from 'supertest'
import * as nodemailer from 'nodemailer'
import { Test } from '@nestjs/testing'
import { MESSAGE, TEMPLATE } from 'src/constants'
import { TokenService } from 'src/token/token.service'
import { ConfigModule, ConfigService } from '@nestjs/config'
import configuration from 'src/config/configuration'
import { createField, createUser, getToken, setAppConfig } from 'src/utils/test'
import { NestExpressApplication } from '@nestjs/platform-express'
import { AuthModule } from 'src/auth/auth.module'
import { PrismaModule } from 'src/prisma/prisma.module'
import { UserModule } from 'src/user/user.module'
import { FieldModule } from 'src/field/field.module'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ResponseInterceptor } from 'src/response.interceptor'
import { MailModule } from 'src/mail/mail.module'
import { TokenModule } from 'src/token/token.module'
import { CreateMailPayload } from 'src/mail/dto'

jest.setTimeout(30 * 1_000)

describe('Auth Controller E2E', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	let tokenService: TokenService

	const tokenConfig = configuration().token

	let field: Field
	let admin: User
	let adminToken: string
	let webMaster: User
	let webMasterToken: string

	const firstName = 'João'
	const email = 'joão@email.com'
	const password = '12345678'
	const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync())
	const baseRoute = '/auth'

	beforeAll(async () => {
		const mailAccount = await nodemailer.createTestAccount()
		const moduleRef = await Test.createTestingModule({
			imports: [
				ConfigModule.forRoot({
					load: [
						() => ({
							...configuration(),
							mailer: {
								...configuration().mailer,
								transport: {
									host: mailAccount.smtp.host,
									secure: mailAccount.smtp.secure,
									port: mailAccount.smtp.port,
									auth: {
										user: mailAccount.user,
										pass: mailAccount.pass,
									},
								},
							},
						}),
					],
					isGlobal: true,
				}),

				// Basic Routes
				AuthModule,
				PrismaModule,
				UserModule,

				// Specific
				FieldModule,
				MailModule,
				TokenModule,
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
		tokenService = moduleRef.get(TokenService)
	})

	afterAll(async () => {
		await app.close()
	})

	beforeEach(async () => {
		await prisma.cleanDataBase()

		field = await createField(prisma, 'América', 'Brasil', 'Rio de Janeiro', 'AMEBRRJ01', 'Designação')

		admin = await createUser(prisma, 'Admin', 'sigma@email.com', hashedPassword, Role.ADMIN, field.id)
		adminToken = await getToken(app, admin.email, password)

		webMaster = await createUser(prisma, 'WebMaster', 'ultra.sigma@email.com', hashedPassword, Role.WEB_MASTER)
		webMasterToken = await getToken(app, webMaster.email, password)
	})

	describe('Private Routes', () => {
		it('Should Not Send Create Email (Role WEB MASTER as ADMIN)', async () => {
			const email = 'fulano@email.com'
			const name = 'Fulano'
			const payload = {
				role: Role.WEB_MASTER,
			} as CreateMailPayload

			const res = await request(app.getHttpServer())
				.post(`${baseRoute}/create-email`)
				.send({ email, name, payload })
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(403)
		})

		it('Should Send Create Email (as ADMIN)', async () => {
			const email = 'fulano@email.com'
			const name = 'Fulano'
			const payload = {
				role: Role.ADMIN,
			} as CreateMailPayload

			const res = await request(app.getHttpServer())
				.post(`${baseRoute}/create-email`)
				.send({ email, name, payload })
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(201)

			expect(res.body.data).toBe(true)
		})

		it('Should Send Create Email (as WEB MASTER)', async () => {
			const email = 'fulano@email.com'
			const name = 'Fulano'
			const payload = {
				role: Role.ADMIN,
				field: field.id,
			} as CreateMailPayload

			const res = await request(app.getHttpServer())
				.post(`${baseRoute}/create-email`)
				.send({ email, name, payload })
				.set('Authorization', `Bearer ${webMasterToken}`)
				.expect(201)

			expect(res.body.data).toBe(true)
		})

		it('Should Not Return New Tokens (Invalid Refresh Token)', async () => {
			await request(app.getHttpServer())
				.post(`${baseRoute}/refresh`)
				.set('Authorization', `Bearer invalidToken`)
				.expect(401)
		})

		it('Should Not Return New Tokens (No HashedRefreshToken in DB)', async () => {
			const email = 'joao@example.com'
			const user = await createUser(prisma, firstName, email, hashedPassword)
			const userToken = await getToken(app, email, password, true)

			await prisma.user.update({
				where: { id: user.id },
				data: { hashedRefreshToken: null },
			})

			await request(app.getHttpServer())
				.post(`${baseRoute}/refresh`)
				.set('Authorization', `Bearer ${userToken}`)
				.expect(403)
		})

		it('Should Not Return New Tokens (HashedRefreshToken Already Used)', async () => {
			const email = 'joao@example.com'
			await createUser(prisma, firstName, email, hashedPassword)
			const userToken = await getToken(app, email, password, true)

			await request(app.getHttpServer())
				.post(`${baseRoute}/refresh`)
				.set('Authorization', `Bearer ${userToken}`)
				.expect(201)

			await request(app.getHttpServer())
				.post(`${baseRoute}/refresh`)
				.set('Authorization', `Bearer ${userToken}`)
				.expect(403)
		})

		it('Should Not Return New Tokens (After Logout)', async () => {
			const email = 'joao@example.com'
			await createUser(prisma, firstName, email, hashedPassword)
			const accessToken = await getToken(app, email, password)
			const refreshToken = await getToken(app, email, password, true)

			await request(app.getHttpServer())
				.post(`${baseRoute}/logout`)
				.set('Authorization', `Bearer ${accessToken}`)
				.expect(201)

			await request(app.getHttpServer())
				.post(`${baseRoute}/refresh`)
				.set('Authorization', `Bearer ${refreshToken}`)
				.expect(403)
		})

		it('Should Return New Tokens', async () => {
			const email = 'joao@example.com'
			await createUser(prisma, firstName, email, hashedPassword)
			const userToken = await getToken(app, email, password, true)
			const beforeRefresh = await prisma.user.findUnique({
				where: { email },
			})

			const response = await request(app.getHttpServer())
				.post(`${baseRoute}/refresh`)
				.set('Authorization', `Bearer ${userToken}`)
				.expect(201)

			expect(response.body.data.accessToken).toBeDefined()
			expect(response.body.data.refreshToken).toBeDefined()

			const afterRefresh = await prisma.user.findUnique({
				where: { email },
			})
			expect(afterRefresh.hashedRefreshToken).toBeDefined()
			expect(afterRefresh.hashedRefreshToken).not.toBe(beforeRefresh.hashedRefreshToken)
		})

		it('Should Not Logout (Invalid Token)', async () => {
			await request(app.getHttpServer())
				.post(`${baseRoute}/logout`)
				.set('Authorization', `Bearer invalidToken`)
				.expect(401)
		})

		it('Should Logout', async () => {
			const email = 'joao@example.com'
			const user = await createUser(prisma, firstName, email, hashedPassword)
			const userToken = await getToken(app, email, password)

			await request(app.getHttpServer())
				.post(`${baseRoute}/logout`)
				.set('Authorization', `Bearer ${userToken}`)
				.expect(201)

			const isLoggedOut = await prisma.user.findUnique({
				where: { id: user.id },
			})
			expect(isLoggedOut.hashedRefreshToken).toBeNull()
		})
	})

	describe('Public Routes', () => {
		it('Should Not Sign-in (Wrong Credentials)', async () => {
			const email = 'joao@example.com'
			await createUser(prisma, firstName, email, hashedPassword)
			await request(app.getHttpServer()).post(`${baseRoute}/signin`).send({ email, password: 'wrongpass' }).expect(401)
		})

		it('Should Sign-in', async () => {
			const email = 'joao@example.com'
			await createUser(prisma, firstName, email, hashedPassword)
			const response = await request(app.getHttpServer())
				.post(`${baseRoute}/signin`)
				.send({ email, password })
				.expect(201)

			expect(response.body.data.accessToken).toBeDefined()
			expect(response.body.data.refreshToken).toBeDefined()
			expect(response.body.data.user).toBeDefined()

			const user = await prisma.user.findUnique({
				where: { email },
			})
			expect(user.hashedRefreshToken).toBeDefined()
		})

		it('Should Not Send Recover Email (Wrong Email)', async () => {
			const email = 'joao@example.com'
			const response = await request(app.getHttpServer()).post(`${baseRoute}/recover-email`).send({ email }).expect(404)

			expect(response.body.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('e-mail', 'o'))
		})

		it('Should Send Recover Email', async () => {
			const email = 'joao@example.com'
			await createUser(prisma, firstName, email, hashedPassword)
			await request(app.getHttpServer()).post(`${baseRoute}/recover-email`).send({ email }).expect(201)
		})

		it('Should Not Set New Password (Not Solicited Token)', async () => {
			const email = 'joao@example.com'
			await createUser(prisma, firstName, email, hashedPassword)
			const response = await request(app.getHttpServer())
				.post(`${baseRoute}/recover-email/confirm`)
				.send({ email, token: 'WRONG1', password: 'newpassword' })
				.expect(404)

			expect(response.body.message).toBe(MESSAGE.EXCEPTION.TOKEN.NOT_SET)
		})

		it('Should Not Set New Password (Used Token)', async () => {
			await prisma.token.create({
				data: {
					email,
					token: 'notrealhash',
					tokenType: TokenType.RECOVER_EMAIL,
					used: true,
					expiration: tokenConfig.expiresIn,
				},
			})

			const response = await request(app.getHttpServer())
				.post(`${baseRoute}/recover-email/confirm`)
				.send({ email, token: 'WRONG1', password: 'newpassword' })
				.expect(400)

			expect(response.body.message).toBe(MESSAGE.EXCEPTION.TOKEN.USED)
		})

		it('Should Not Set New Password (Wrong Token)', async () => {
			const email = 'joao@example.com'
			const user = await createUser(prisma, firstName, email, hashedPassword)
			await tokenService.create({
				email: user.email,
				tokenType: TokenType.RECOVER_EMAIL,
			})

			const response = await request(app.getHttpServer())
				.post(`${baseRoute}/recover-email/confirm`)
				.send({ email, token: 'WRONG1', password: 'newpassword' })
				.expect(400)

			expect(response.body.message).toBe(MESSAGE.EXCEPTION.TOKEN.DONT_MATCH)
		})

		it('Should Set New Password', async () => {
			const email = 'joao@example.com'
			const user = await createUser(prisma, firstName, email, hashedPassword)
			const token = await tokenService.create({
				email: user.email,
				tokenType: TokenType.RECOVER_EMAIL,
			})

			await request(app.getHttpServer())
				.post(`${baseRoute}/recover-email/confirm`)
				.send({ email, token, password: 'newpassword' })
				.expect(201)
		})

		it('Should Not Validate Token (Token Not Set)', async () => {
			const email = 'joao@example.com'
			await createUser(prisma, firstName, email, hashedPassword)
			const tokenString = 'AAAAAA'

			const response = await request(app.getHttpServer())
				.post(`${baseRoute}/token-validate`)
				.send({ email, token: tokenString })
				.expect(404)

			expect(response.body.message).toBe(MESSAGE.EXCEPTION.TOKEN.NOT_SET)
		})

		it('Should Not Validate Token (Wrong Token)', async () => {
			const email = 'joao@example.com'
			await createUser(prisma, firstName, email, hashedPassword)
			const tokenString = 'AAAAAA'
			await prisma.token.create({
				data: {
					email,
					tokenType: TokenType.RECOVER_EMAIL,
					token: bcrypt.hashSync(tokenString, bcrypt.genSaltSync()),
					expiration: tokenConfig.expiresIn,
				},
			})

			await request(app.getHttpServer())
				.post(`${baseRoute}/token-validate`)
				.send({ email, token: 'WRONG1' })
				.expect(400)
		})

		it('Should Validate Token', async () => {
			const email = 'joao@example.com'
			const tokenString = 'AAAAAA'
			await prisma.token.create({
				data: {
					email,
					tokenType: TokenType.RECOVER_EMAIL,
					token: bcrypt.hashSync(tokenString, bcrypt.genSaltSync()),
					expiration: tokenConfig.expiresIn,
				},
			})

			const response = await request(app.getHttpServer())
				.post(`${baseRoute}/token-validate`)
				.send({ email, token: tokenString })
				.expect(201)

			expect(response.body.data).toBe(true)
		})

		it('Should Not Confirm a New Account (Wrong Email)', async () => {
			const firstName = 'Fulano'
			const email = 'fulano@email.com'
			const payload = {
				role: Role.WEB_MASTER,
			} as CreateMailPayload
			const token = await tokenService.create({
				email: email,
				tokenType: TokenType.CREATE_EMAIL,
				payload: payload,
			})

			await request(app.getHttpServer())
				.post(`${baseRoute}/create-email/confirm`)
				.send({ firstName, email: 'wrong.email@email.com', token, password })
				.expect(404)
		})

		it('Should Not Confirm a New Account (Wrong Token)', async () => {
			const firstName = 'Fulano'
			const email = 'fulano@email.com'
			const payload = {
				role: Role.WEB_MASTER,
			} as CreateMailPayload
			const token = await tokenService.create({
				email: email,
				tokenType: TokenType.CREATE_EMAIL,
				payload: payload,
			})
			const tokenString = 'AAAAAA'

			await request(app.getHttpServer())
				.post(`${baseRoute}/create-email/confirm`)
				.send({ firstName, email, token: tokenString, password })
				.expect(400)
		})

		it('Should Confirm a New Account', async () => {
			const firstName = 'Fulano'
			const email = 'fulano@email.com'
			const payload = {
				role: Role.ADMIN,
				field: field.id,
			} as CreateMailPayload
			const token = await tokenService.create({
				email: email,
				tokenType: TokenType.CREATE_EMAIL,
				payload: payload,
			})

			await request(app.getHttpServer())
				.post(`${baseRoute}/create-email/confirm`)
				.send({ firstName, email, token, password })
				.expect(201)

			const newAccount = await prisma.user.findFirst({
				where: {
					email,
					firstName,
				},
			})

			expect(newAccount.role).toBe(payload.role)
			expect(newAccount.fieldId).toBe(payload.field)
		})
	})
})
