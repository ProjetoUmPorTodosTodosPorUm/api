import { IsInt, IsNotEmpty, IsObject, IsString } from "src/utils"

export class QueueResponseDto {
    @IsString()
    id: string
    @IsString()
    name: string
    @IsNotEmpty()
    data: any
    @IsObject()
    opts: any
    @IsInt()
    progress: number
    @IsInt()
    delay: number
    @IsInt()
    timestamp: number
    @IsInt()
    attemptsMade: number
    @IsNotEmpty()
    stackTrace: any
    @IsNotEmpty()
    returnValue: any
    @IsInt()
    fineshedOn: number
    @IsInt()
    processedOn: number
}