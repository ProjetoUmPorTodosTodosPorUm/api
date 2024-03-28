import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'
import { IsEmail, IsNotEmpty, IsObject, IsString } from 'src/utils'
import { CreateMailPayload } from './create-mail-payload.dto'

export class SendCreateEmailDto {
	@ApiProperty({
		format: 'email',
	})
	@IsNotEmpty()
	@IsEmail()
	email: string
	@IsNotEmpty()
	@IsString()
	name: string
	@IsNotEmpty()
	@IsObject()
	@ValidateNested()
	@Type(() => CreateMailPayload)
	payload: CreateMailPayload
}
