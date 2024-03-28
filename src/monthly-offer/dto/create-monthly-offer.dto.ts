import { ApiProperty } from '@nestjs/swagger'
import { IsOptional } from 'class-validator'
import { IsInt, IsNotEmpty, IsNumber, IsUUID } from 'src/utils'

export class CreateMonthlyOfferDto {
	@IsNotEmpty()
	@IsInt()
	month: number
	@IsNotEmpty()
	@IsInt()
	year: number
	@IsNotEmpty()
	@IsInt()
	foodQnt: number
	@IsNotEmpty()
	@IsNumber()
	monetaryValue: number
	@IsNotEmpty()
	@IsInt()
	othersQnt: number
	@ApiProperty({
		format: 'uuid',
	})
	@IsOptional()
	@IsUUID('4')
	field?: string
}
