import { PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsArray, IsString, ArrayNotEmpty } from 'src/utils';
import { CreateReportDto } from './create-report.dto';

export class UpdateReportDto extends PartialType(CreateReportDto) {
    @IsNotEmpty()
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    attachments: string[];
}
