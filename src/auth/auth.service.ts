import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { UserService } from 'src/user/user.service'
import * as bcrypt from 'bcrypt'
import * as argon2 from 'argon2'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { MailService } from 'src/mail/mail.service'
import { TokenService } from 'src/token/token.service'
import { CreateMailPayload, NewAccountDto, NewPasswordDto, SendCreateEmailDto, SendRecoverEmailDto } from 'src/mail/dto'
import { Field, Prisma, User } from '@prisma/client'
import { MESSAGE, TEMPLATE } from 'src/constants'
import { PrismaService } from 'src/prisma/prisma.service'

@Injectable()
export class AuthService {
	constructor(
		private userService: UserService,
		private jwtService: JwtService,
		private configService: ConfigService,
		private mailService: MailService,
		private tokenService: TokenService,
		private prismaService: PrismaService,
	) {}

	async validateUser(email: string, pass: string) {
		const user = await this.userService.findByEmailAuth(email)
		if (user && bcrypt.compareSync(pass, user.hashedPassword)) {
			this.userService.updateLastAccess(user.id)

			// reduces JWT length
			const { restricted, role, fieldId, id } = user
			return {
				id,
				role,
				fieldId,
				restricted,
			}
		}
		return null
	}

	async signin(user: User) {
		const { accessToken, refreshToken } = await this.generateTokens(user)
		await this.updateRefreshTokenHash(user, refreshToken)

		// necessary to pass all values to client
		const userData = await this.prismaService.user.findUnique({
			where: {
				id: user.id,
			},
		})
		delete userData.hashedPassword
		delete userData.hashedRefreshToken

		return {
			accessToken,
			refreshToken,
			user: {
				id: userData.id,
				firstName: userData.firstName,
				lastName: userData.lastName,
				email: userData.email,
				role: userData.role,
				avatar: userData.avatar,
				lastAccess: userData.lastAccess,
				fieldId: userData.fieldId,
			},
		}
	}

	async sendRecoverEmail(sendRecoverEmailDto: SendRecoverEmailDto) {
		return await this.mailService.sendRecoverEmail(sendRecoverEmailDto)
	}

	async sendCreateEmail(sendCreateEmailDto: SendCreateEmailDto, user: User) {
		if (user.role !== 'WEB_MASTER') {
			sendCreateEmailDto.payload.field = user.fieldId
			if (sendCreateEmailDto.payload.role === 'WEB_MASTER') {
				throw new ForbiddenException({
					message: MESSAGE.EXCEPTION.FORBIDDEN,
					data: {},
				})
			}
		} else {
			if (!sendCreateEmailDto.payload.field) {
				throw new NotFoundException({
					message: TEMPLATE.EXCEPTION.NOT_FOUND('campo', 'o'),
					data: {},
				})
			}
		}
		return await this.mailService.sendCreateEmail(sendCreateEmailDto)
	}

	async confirmRecoverEmail(newPassword: NewPasswordDto) {
		const { email, token, password } = newPassword

		// needed to mark token as used
		await this.tokenService.validate(email, token)

		await this.userService.updatePasswordByEmail(email, password)
		return true
	}

	async confirmCreateEmail(newAccountDto: NewAccountDto) {
		const { email, token } = newAccountDto
		const tokenPayload = await this.tokenService.getPayloadFromToken<CreateMailPayload>(email, token)
		let field: Field

		if (tokenPayload.field) {
			field = await this.prismaService.field.findUnique({
				where: {
					id: tokenPayload.field,
				},
			})
		}

		if (!field && tokenPayload.role !== 'WEB_MASTER') {
			throw new NotFoundException({
				message: TEMPLATE.EXCEPTION.NOT_FOUND('campo', 'o'),
				data: {},
			})
		}

		// needed to mark token as used
		await this.tokenService.validate(email, token)

		const { firstName, lastName, password, avatar } = newAccountDto
		await this.userService.create({
			firstName,
			lastName,
			email,
			password,
			avatar,
			role: tokenPayload.role,
			field: field?.id,
		})
		return true
	}

	async tokenValidate(email: string, token: string) {
		const tokenDoc = await this.prismaService.token.findFirst({
			where: {
				email,
				used: false,
			},
			orderBy: {
				createdAt: 'desc',
			},
		})
		if (tokenDoc == null) {
			throw new NotFoundException({
				message: MESSAGE.EXCEPTION.TOKEN.NOT_SET,
				data: {},
			})
		}
		return this.tokenService.isTokenValid(tokenDoc, token)
	}

	async refresh(user: User, refreshToken: string) {
		const userInDB = await this.prismaService.user.findUnique({
			where: { id: user.id },
		})
		if (!userInDB || !userInDB.hashedRefreshToken) {
			throw new ForbiddenException({
				message: MESSAGE.EXCEPTION.FORBIDDEN,
				data: {},
			})
		}

		const isValid = await argon2.verify(userInDB.hashedRefreshToken, refreshToken)
		if (isValid) {
			const tokens = await this.generateTokens(userInDB)
			await this.updateRefreshTokenHash(userInDB, tokens.refreshToken)

			return tokens
		} else {
			throw new ForbiddenException({
				message: MESSAGE.EXCEPTION.FORBIDDEN,
				data: {},
			})
		}
	}

	async updateRefreshTokenHash(user: User, refreshToken: string) {
		const hashedRefreshToken = await argon2.hash(refreshToken)

		await this.prismaService.user.update({
			where: { id: user.id },
			data: { hashedRefreshToken },
		})
	}

	async generateTokens(user: User) {
		const [at, rt] = await Promise.all([
			this.jwtService.signAsync(user, {
				secret: this.configService.get('jwt.accessToken.secret'),
				expiresIn: '15m',
			}),
			this.jwtService.signAsync(user, {
				secret: this.configService.get('jwt.refreshToken.secret'),
				expiresIn: '7d',
			}),
		])

		return {
			accessToken: at,
			refreshToken: rt,
		}
	}

	async logout(user: User) {
		try {
			await this.prismaService.user.update({
				where: { id: user.id },
				data: { hashedRefreshToken: null },
			})
			return true
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2025') {
					throw new NotFoundException({
						message: TEMPLATE.EXCEPTION.NOT_FOUND('usuário', 'o'),
						data: {},
					})
				}
			}
			throw error
		}
	}
}
