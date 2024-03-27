import { ApiProperty } from '@nestjs/swagger';
import { ChurchType } from '@prisma/client';
import { IsOptional } from 'class-validator';
import { IsEnum, IsNotEmpty, IsString, IsUUID, IsArray } from 'src/utils';

export class CreateChurchDto {
  @IsNotEmpty()
  @IsString()
  name: string;
  @IsNotEmpty()
  @IsString()
  description: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
  @IsNotEmpty()
  @IsEnum(ChurchType, Object.values(ChurchType))
  type: ChurchType;
  @ApiProperty({
    format: 'uuid'
  })
  @IsOptional()
  @IsUUID('4')
  field?: string;
}
