import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsUUID } from 'src/utils'

export class GetReportYearsDto {
	@ApiProperty({
		format: 'uuid',
	})
	@IsNotEmpty()
	@IsUUID('4')
	field: string
}
