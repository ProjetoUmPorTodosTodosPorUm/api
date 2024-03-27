import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { IsUUID } from "src/utils";

export class CreateFileDto {
    @IsOptional()
    @IsUUID('4')
    @ApiProperty({
        type: 'string',
        format: 'uuid',
    })
    field?: string;
}