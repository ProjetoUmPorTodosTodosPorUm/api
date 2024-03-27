import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsNotEmpty, IsOptional } from 'class-validator';
import { IsEnum, IsUUID } from 'src/utils';

export class CreateMailPayload {
	@ApiProperty({
		format: 'uuid'
	})
	@IsOptional()
	@IsUUID('4')
	field?: string;
	@ApiProperty({ enum: Role })
	@IsNotEmpty()
	@IsEnum(Role, Object.values(Role))
	role: Role;
}
