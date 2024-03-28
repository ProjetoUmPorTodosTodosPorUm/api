import { ConfigModule, ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { AppModule } from 'src/app.module'
import { AuthService } from 'src/auth/auth.service'
import configuration from 'src/config/configuration'
import { MailService } from 'src/mail/mail.service'
import { PrismaService } from 'src/prisma/prisma.service'
import { TokenService } from 'src/token/token.service'
import * as nodemailer from 'nodemailer'
import * as bcrypt from 'bcrypt'
import { Field, Role, TokenType, User } from '@prisma/client'
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { MESSAGE, TEMPLATE } from 'src/constants'
import { JwtService } from '@nestjs/jwt'
import { CreateMailPayload, SendCreateEmailDto } from 'src/mail/dto'
import { createField } from 'src/utils/test'

jest.mock('src/mail/mail.service', () => {
	const originalAuth = jest.requireActual<MailService>('src/mail/mail.service')
	return {
		__esModule: true,
		...originalAuth,
		sendCreateEmail: (sendCreateEmailDto: SendCreateEmailDto) => true,
	}
})

describe('Auth Service Integration', () => {
	let prisma: PrismaService
	let authService: AuthService
	let tokenService: TokenService
	let jwtService: JwtService
	let configService: ConfigService

	const tokenConfig = configuration().token

	let field: Field
	let admin: User
	let adminToken: string
	let webMaster: User
	let webMasterToken: string

	const firstName = 'João'
	const email = 'joao@example.com'
	const password = '12345678'
	const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync())
	const createUser = async (
		firstName: string,
		email: string,
		hashedPassword: string,
		role: Role = Role.VOLUNTEER,
		field: string = null,
	) => {
		if (!field) {
			return await prisma.user.create({
				data: { firstName, email, hashedPassword, role },
			})
		} else {
			return await prisma.user.create({
				data: {
					firstName,
					email,
					hashedPassword,
					role,
					field: { connect: { id: field } },
				},
			})
		}
	}

	beforeAll(async () => {
		const mailAccount = await nodemailer.createTestAccount()
		const moduleRef = await Test.createTestingModule({
			imports: [
				// look at configuration.ts
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
				AppModule,
			],
		}).compile()

		prisma = moduleRef.get(PrismaService)
		authService = moduleRef.get(AuthService)
		tokenService = moduleRef.get(TokenService)
		jwtService = moduleRef.get(JwtService)
		configService = moduleRef.get(ConfigService)
	})

	beforeEach(async () => {
		await prisma.cleanDataBase()

		field = await createField(prisma, 'América', 'Brasil', 'Rio de Janeiro', 'AMEBRRJ01', 'Designação')

		admin = await createUser('Admin', 'sigma@email.com', hashedPassword, Role.ADMIN, field.id)

		webMaster = await createUser('WebMaster', 'ultra.sigma@email.com', hashedPassword, Role.WEB_MASTER)
	})

	describe('validateUser()', () => {
		it("Should Not Validate (User Doesn't Exists)", async () => {
			const isValid = await authService.validateUser('null@example.com', 'shinepass')
			expect(isValid).toBeNull()
		})

		it('Should Not Validate (Wrong Password)', async () => {
			await createUser(firstName, email, hashedPassword)

			const isValid = await authService.validateUser(email, 'wrongpass')
			expect(isValid).toBeNull()
		})

		it('Should Validate', async () => {
			await createUser(firstName, email, hashedPassword)

			const isValid = await authService.validateUser(email, password)
			expect(isValid).toBeDefined()
		})
	})

	describe('signin()', () => {
		it('Should Return Tokens and User Data', async () => {
			const user = await createUser(firstName, email, hashedPassword)
			const data = await authService.signin(user)

			expect(data.accessToken).toBeDefined()
			expect(data.refreshToken).toBeDefined()
			expect(data.user).toBeDefined()
		})
	})

	describe('sendCreateEmail()', () => {
		it('Should Not Send Create Email (Role WEB MASTER as ADMIN)', async () => {
			const email = 'fulano@email.com'
			const name = 'Fulano'
			const payload = {
				role: Role.WEB_MASTER,
			} as CreateMailPayload

			try {
				await authService.sendCreateEmail(
					{
						email,
						name,
						payload,
					},
					admin,
				)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Send Create Email (as ADMIN)', async () => {
			const email = 'fulano@email.com'
			const name = 'Fulano'
			const payload = {
				role: Role.ADMIN,
			} as CreateMailPayload

			const res = await authService.sendCreateEmail(
				{
					email,
					name,
					payload,
				},
				admin,
			)

			expect(res).toBe(true)
		})

		it('Should Send Create Email (as WEB MASTER)', async () => {
			const email = 'fulano@email.com'
			const name = 'Fulano'
			const payload = {
				role: Role.ADMIN,
				field: field.id,
			} as CreateMailPayload

			const res = await authService.sendCreateEmail(
				{
					email,
					name,
					payload,
				},
				webMaster,
			)

			expect(res).toBe(true)
		})
	})

	describe('confirmCreateEmail()', () => {
		it('Should Not Confirm A New Account (Wrong email)', async () => {
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

			try {
				await authService.confirmCreateEmail({
					firstName,
					email: 'wrong.email@email.com',
					token,
					password,
				})
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.TOKEN.NOT_SET)
			}
		})

		it('Should Not Confirm A New Account (Wrong token)', async () => {
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

			try {
				await authService.confirmCreateEmail({
					firstName,
					email,
					token: tokenString,
					password,
				})
			} catch (error) {
				expect(error).toBeInstanceOf(BadRequestException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.TOKEN.DONT_MATCH)
			}
		})

		it('Should Confirm A New Account', async () => {
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

			const res = await authService.confirmCreateEmail({
				firstName,
				email,
				token,
				password,
			})

			expect(res).toBe(true)
		})
	})

	describe('confirmRecoverEmail()', () => {
		it("Should Not Validate (Token Doesn't Exists)", async () => {
			try {
				await authService.confirmRecoverEmail({
					email,
					password,
					token: 'ZDDZ42',
				})
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.TOKEN.NOT_SET)
			}
		})

		it('Should Not Validate (Used Token)', async () => {
			try {
				await prisma.token.create({
					data: {
						email,
						token: 'notrealhash',
						tokenType: TokenType.RECOVER_EMAIL,
						used: true,
						expiration: tokenConfig.expiresIn,
					},
				})
				await authService.confirmRecoverEmail({
					email,
					password,
					token: 'ZDDZ42',
				})
			} catch (error) {
				expect(error).toBeInstanceOf(BadRequestException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.TOKEN.USED)
			}
		})

		it('Should Not Validate (Invalid Token)', async () => {
			try {
				await tokenService.create({
					email,
					tokenType: TokenType.RECOVER_EMAIL,
				})
				await authService.confirmRecoverEmail({
					email,
					password,
					token: 'NOTVALID',
				})
			} catch (error) {
				expect(error).toBeInstanceOf(BadRequestException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.TOKEN.DONT_MATCH)
			}
		})

		it('Should Validate', async () => {
			await createUser(firstName, email, hashedPassword)
			const tokenString = 'PNTKTR'
			await prisma.token.create({
				data: {
					email,
					token: bcrypt.hashSync(tokenString, bcrypt.genSaltSync()),
					tokenType: TokenType.RECOVER_EMAIL,
					expiration: tokenConfig.expiresIn,
				},
			})
			const isValid = await authService.confirmRecoverEmail({
				email,
				password,
				token: tokenString,
			})

			expect(isValid).toBe(true)
		})
	})

	describe('tokenValidate()', () => {
		it('Should Not Validate Token (Not Set)', async () => {
			try {
				await authService.tokenValidate('email@example', 'AAAAAA')
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.TOKEN.NOT_SET)
			}
		})

		it('Should Not Validate Token (Wrong Token)', async () => {
			const email = 'email@example.com'
			const tokenString = 'AAAAAA'
			await prisma.token.create({
				data: {
					email,
					tokenType: TokenType.RECOVER_EMAIL,
					token: bcrypt.hashSync(tokenString, bcrypt.genSaltSync()),
					expiration: tokenConfig.expiresIn,
				},
			})

			try {
				await authService.tokenValidate(email, 'WRONG1')
			} catch (error) {
				expect(error).toBeInstanceOf(BadRequestException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.TOKEN.DONT_MATCH)
			}
		})

		it('Should Validate Token', async () => {
			const email = 'email@example.com'
			const tokenString = 'AAAAAA'
			await prisma.token.create({
				data: {
					email,
					tokenType: TokenType.RECOVER_EMAIL,
					token: bcrypt.hashSync(tokenString, bcrypt.genSaltSync()),
					expiration: tokenConfig.expiresIn,
				},
			})

			const isValid = await authService.tokenValidate(email, tokenString)
			expect(isValid).toBe(true)
		})
	})

	describe('refresh()', () => {
		it("Should Not Return Refresh Tokens (User Doesn't Exists)", async () => {
			try {
				const user = await createUser(firstName, email, hashedPassword)
				await prisma.user.delete({ where: { id: user.id } })

				await authService.refresh(user, 'refreshtoken')
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Return Refresh Tokens (Invalid Refresh Token)', async () => {
			try {
				const user = await createUser(firstName, email, hashedPassword)
				const { refreshToken } = await authService.generateTokens(user)
				await authService.updateRefreshTokenHash(user, refreshToken)

				await authService.refresh(user, 'invalidrefreshtoken')
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Return Refresh Tokens (No hashedRefreshToken in DB)', async () => {
			try {
				const user = await createUser(firstName, email, hashedPassword)
				const { refreshToken } = await authService.generateTokens(user)
				await prisma.user.update({
					where: { id: user.id },
					data: { hashedRefreshToken: null },
				})

				await authService.refresh(user, refreshToken)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Return Refresh Tokens (Already Used)', async () => {
			try {
				const user = await createUser(firstName, email, hashedPassword)
				const { refreshToken } = await authService.generateTokens(user)
				await authService.updateRefreshTokenHash(user, refreshToken)
				await authService.refresh(user, refreshToken)

				await authService.refresh(user, refreshToken)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Not Return Refresh Tokens (After Logout)', async () => {
			try {
				const user = await createUser(firstName, email, hashedPassword)
				const { refreshToken } = await authService.generateTokens(user)
				await authService.updateRefreshTokenHash(user, refreshToken)
				await authService.logout(user)

				await authService.refresh(user, refreshToken)
			} catch (error) {
				expect(error).toBeInstanceOf(ForbiddenException)
				expect(error.response.message).toBe(MESSAGE.EXCEPTION.FORBIDDEN)
			}
		})

		it('Should Return Refresh Tokens', async () => {
			const user = await createUser(firstName, email, hashedPassword)
			const { refreshToken } = await authService.generateTokens(user)
			await authService.updateRefreshTokenHash(user, refreshToken)

			const tokens = await authService.refresh(user, refreshToken)
			expect(tokens.accessToken).toBeDefined()
			expect(tokens.refreshToken).toBeDefined()
		})
	})

	describe('logout()', () => {
		it("Should Not Logout (User Doesn't Exists)", async () => {
			const user = await createUser(firstName, email, hashedPassword)
			await prisma.user.delete({ where: { id: user.id } })
			try {
				await authService.logout(user)
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'))
			}
		})

		it('Should Logout', async () => {
			const user = await createUser(firstName, email, hashedPassword)
			await authService.logout(user)

			const isUserRemoved = await prisma.user.findUnique({
				where: { id: user.id },
			})
			expect(isUserRemoved.hashedRefreshToken).toBeNull()
		})
	})
})
