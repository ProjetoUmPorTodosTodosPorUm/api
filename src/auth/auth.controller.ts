import { Controller, Post, UseGuards, Body } from '@nestjs/common'
import { LocalAuthGuard } from './local'
import { AuthService } from 'src/auth/auth.service'
import { ApiBooleanResponse, Public, User as Jwt } from 'src/utils'
import { SendRecoverEmailDto, NewPasswordDto, SendCreateEmailDto, NewAccountDto } from 'src/mail/dto'
import { Role, User } from '@prisma/client'
import { RefreshJwtAuthGuard } from './refresh-jwt'
import { Throttle } from '@nestjs/throttler'
import { HOUR_IN_SECS } from 'src/constants'
import { TokenValidateDto } from './dto'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiLoginResponse } from 'src/utils/decorator/api-login-response'
import { ApiRefreshResponse } from 'src/utils/decorator/api-refresh-response'
import { Roles } from './roles'

@ApiTags('Auth')
@Throttle({ default: { limit: 3, ttl: HOUR_IN_SECS } })
@Controller('auth')
export class AuthController {
	constructor(private authService: AuthService) { }

	@ApiLoginResponse()
	@Public()
	@Throttle({ default: { limit: 10, ttl: HOUR_IN_SECS } })
	@UseGuards(LocalAuthGuard)
	@Post('signin')
	signin(@Jwt() user: User) {
		return this.authService.signin(user)
	}

	@ApiBooleanResponse()
	@Public()
	@Post('recover-email/confirm')
	confirmRecoverEmail(@Body() newPasswordDto: NewPasswordDto) {
		return this.authService.confirmRecoverEmail(newPasswordDto)
	}

	@ApiBooleanResponse()
	@Public()
	@Post('create-email/confirm')
	confirmCreateEmail(@Body() newAccountDto: NewAccountDto) {
		return this.authService.confirmCreateEmail(newAccountDto)
	}

	@ApiBooleanResponse()
	@Public()
	@Post('token-validate')
	tokenValidate(@Body() tokenValidateDto: TokenValidateDto) {
		const { email, token } = tokenValidateDto
		return this.authService.tokenValidate(email, token)
	}

	@ApiBooleanResponse()
	@Public()
	@Post('recover-email')
	sendRecoverEmail(@Body() sendRecoverEmailDto: SendRecoverEmailDto) {
		return this.authService.sendRecoverEmail(sendRecoverEmailDto)
	}

	@ApiBooleanResponse()
	@Roles(Role.ADMIN)
	@Post('create-email')
	sendCreateEmail(@Body() sendCreateEmailDto: SendCreateEmailDto, @Jwt() user: User) {
		return this.authService.sendCreateEmail(sendCreateEmailDto, user)
	}

	@ApiBearerAuth()
	@ApiRefreshResponse()
	@Throttle({ default: { limit: 10, ttl: HOUR_IN_SECS } })
	@Public()
	@UseGuards(RefreshJwtAuthGuard)
	@Post('refresh')
	refresh(@Jwt() user: User, @Jwt('refreshToken') refreshToken: string) {
		return this.authService.refresh(user, refreshToken)
	}

	@ApiBearerAuth()
	@ApiBooleanResponse()
	@Throttle({ default: { limit: 10, ttl: HOUR_IN_SECS } })
	@Post('logout')
	logout(@Jwt() user: User) {
		return this.authService.logout(user)
	}
}
