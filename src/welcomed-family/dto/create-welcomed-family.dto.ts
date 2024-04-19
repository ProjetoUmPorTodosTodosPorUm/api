import { ApiProperty } from '@nestjs/swagger'
import { IsOptional } from 'class-validator'
import { IsNotEmpty, IsString, IsUUID } from 'src/utils'

export class CreateWelcomedFamilyDto {
	@IsNotEmpty()
	@IsString()
	representative: string
	@IsNotEmpty()
	@IsString()
	familyName: string
	@IsOptional()
	@IsNotEmpty()
	@IsString()
	observation?: string
	@ApiProperty({
		format: 'uuid',
	})
	@IsOptional()
	@IsUUID('4')
	field?: string
}
