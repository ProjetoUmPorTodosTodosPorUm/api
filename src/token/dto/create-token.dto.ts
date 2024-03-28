import { TokenType } from '@prisma/client'
import { IsOptional } from 'class-validator'
import { IsEmail, IsNotEmpty, IsEnum, IsObject, IsInt } from 'src/utils'

export class CreateTokenDto {
	@IsNotEmpty()
	@IsEmail()
	email: string
	@IsNotEmpty()
	@IsEnum(TokenType, Object.values(TokenType))
	tokenType: TokenType
	@IsOptional()
	@IsObject()
	payload?: any
	@IsOptional()
	@IsInt()
	expiration?: number
}
