import { ApiProperty } from '@nestjs/swagger'
import { IsOptional } from 'class-validator'
import { IsNotEmpty, IsString, IsUUID } from 'src/utils'

export class CreateRecoveryHouseDto {
	@IsNotEmpty()
	@IsString()
	title: string
	@IsNotEmpty()
	@IsString()
	description: string
	@IsOptional()
	@IsString()
	image?: string
	@ApiProperty({
		format: 'uuid',
	})
	@IsOptional()
	@IsUUID('4')
	field?: string
}
