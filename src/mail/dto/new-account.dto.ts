import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'src/utils';

export class NewAccountDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;
  @IsOptional()
  @IsString()
  lastName?: string;
  @ApiProperty({
    format: 'email'
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;
  @IsNotEmpty()
  @IsString()
  token: string;
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;
  @IsOptional()
  @IsString()
  avatar?: string;
}
