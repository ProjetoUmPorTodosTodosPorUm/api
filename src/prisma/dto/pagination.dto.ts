import { IsOptional, ValidateIf } from 'class-validator';
import { IsString, IsEnum, IsBoolean, IsInt, IsArray } from 'src/utils/decorator';
import { Prisma } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { transformNumbers } from 'src/utils';

export class PaginationDto {
  @IsOptional()
  @IsInt()
  itemsPerPage?: number;
  @IsOptional()
  @IsInt()
  page?: number;
  @IsOptional()
  @IsBoolean()
  @Transform((params) => params.obj.deleted === 'true')
  deleted?: boolean;
  @IsOptional()
  @IsString()
  orderKey?: string;
  @IsOptional()
  @IsEnum(Prisma.SortOrder, Object.keys(Prisma.SortOrder))
  orderValue?: Prisma.SortOrder;
  @IsOptional()
  @IsString()
  search?: string;
  @ValidateIf(o => !!o.searchSpecificValue)
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  @Transform(params => params.value.split(','))
  searchSpecificField?: string[];
  @ValidateIf(o => !!o.searchSpecificField)
  @IsArray()
  @Type(() => String)
  @Transform(transformNumbers)
  searchSpecificValue?: any[];
}
