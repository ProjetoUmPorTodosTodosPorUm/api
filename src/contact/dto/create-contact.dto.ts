import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsString } from 'src/utils'

export class CreateContactDto {
	@IsNotEmpty()
	@IsString()
	name: string
	@ApiProperty({
		format: 'email',
	})
	@IsNotEmpty()
	@IsString()
	@IsEmail()
	email: string
	@IsNotEmpty()
	@IsString()
	message: string
}
