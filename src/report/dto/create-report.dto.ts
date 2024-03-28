import { ApiProperty } from '@nestjs/swagger'
import { ReportType } from '@prisma/client'
import { IsOptional, ValidateIf } from 'class-validator'
import { ArrayNotEmpty, IsArray, IsEnum, IsInt, IsNotEmpty, IsString, IsUUID } from 'src/utils'

export class CreateReportDto {
	@IsNotEmpty()
	@IsString()
	title: string
	@IsOptional()
	@IsString()
	text?: string
	@IsNotEmpty()
	@IsString()
	shortDescription: string
	@IsNotEmpty()
	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	attachments: string[]
	@ApiProperty({
		format: 'uuid',
	})
	@ValidateIf((o: CreateReportDto) => o.type !== 'ANNUAL')
	@IsNotEmpty()
	@IsInt()
	month: number
	@IsNotEmpty()
	@IsInt()
	year: number
	@IsNotEmpty()
	@IsEnum(ReportType, Object.values(ReportType))
	type: ReportType
	@IsOptional()
	@IsUUID('4')
	field?: string
}
