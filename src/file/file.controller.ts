import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  ParseFilePipeBuilder,
  HttpStatus,
  UnprocessableEntityException,
  UploadedFile,
  ParseFilePipe,
  Query,
  Put,
  Body,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileService } from './file.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { TEMPLATE, MAX_FILE_SIZE } from 'src/constants';
import {
  ApiBatchResponse,
  ApiCreatedResponse,
  ApiFile,
  ApiFiles,
  ApiResponse,
  RestoreDto,
  HardRemoveDto,
  User as Jwt,
  FileBulkRemoveDto
} from 'src/utils';
import { PaginationDto } from 'src/prisma/dto';
import { ApiBearerAuth, ApiExtraModels, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/auth/roles';
import { Role, User } from '@prisma/client';
import { CreateFileDto, FileResponseDto } from './dto';

@ApiTags('File')
@ApiExtraModels(FileResponseDto)
@ApiBearerAuth()
@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) { }

  @ApiFile()
  @ApiCreatedResponse(FileResponseDto, { omitNestedField: true })
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  create(
    @Jwt() user: User,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({
          maxSize: MAX_FILE_SIZE,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          exceptionFactory: () => {
            return new UnprocessableEntityException({
              message: TEMPLATE.EXCEPTION.FILE_SIZE_EXCEEDS(MAX_FILE_SIZE),
              data: {},
            });
          },
        }),
    )
    file: Express.Multer.File,
    @Body() createFileDto: CreateFileDto
  ) {
    return this.fileService.create(user, file, createFileDto);
  }

  @ApiFiles()
  @ApiCreatedResponse(FileResponseDto, {
    omitNestedField: true,
    paginated: true,
  })
  @Post('bulk')
  @UseInterceptors(FilesInterceptor('files'))
  bulkCreate(
    @Jwt() user: User,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: MAX_FILE_SIZE,
          }),
        ],
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        exceptionFactory: () => {
          return new UnprocessableEntityException({
            message: TEMPLATE.EXCEPTION.FILES_SIZE_EXCEEDS(MAX_FILE_SIZE),
            data: {},
          });
        },
      }),
    )
    files: Express.Multer.File[],
    @Body() createFilesDto: CreateFileDto
  ) {
    return this.fileService.bulkCreate(user, files, createFilesDto);
  }

  @ApiResponse(FileResponseDto, { omitNestedField: true, paginated: true })
  @Get()
  findAll(@Query() query?: PaginationDto) {
    return this.fileService.findAll(query);
  }

  @ApiResponse(FileResponseDto, { omitNestedField: true })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fileService.findOne(id);
  }

  @ApiBatchResponse()
  @Roles(Role.ADMIN)
  @Put('restore')
  restore(@Body() restoreDto: RestoreDto, @Jwt() user: User) {
    return this.fileService.restore(restoreDto, user);
  }

  @ApiBatchResponse()
  @Roles(Role.ADMIN)
  @Delete('hard-remove')
  hardRemove(@Body() hardRemoveDto: HardRemoveDto, @Jwt() user: User) {
    return this.fileService.hardRemove(hardRemoveDto, user);
  }

  @ApiFiles()
  @ApiCreatedResponse(FileResponseDto, {
    omitNestedField: true,
    paginated: true,
  })
  @Delete('bulk')
  bulkRemove(@Body() fileBulkRemoveDto: FileBulkRemoveDto, @Jwt() user: User) {
    return this.fileService.bulkRemove(fileBulkRemoveDto, user);
  }

  @ApiResponse(FileResponseDto, { omitNestedField: true })
  @Delete(':id')
  remove(@Param('id') id: string, @Jwt() user: User) {
    return this.fileService.remove(id, user);
  }
}
