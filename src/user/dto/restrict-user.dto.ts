import { IsNotEmpty, IsUUID } from 'src/utils';
import { ApiProperty } from '@nestjs/swagger';

export class RestrictUserDto {
	@ApiProperty({
		format: 'uuid',
	})
	@IsNotEmpty()
	@IsUUID('4')
	id: string;
}
