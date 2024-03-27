import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray } from 'src/utils';

export class FileBulkRemoveDto {
  @ApiProperty({
    format: 'uuid',
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  files: string[];
}
