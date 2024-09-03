import { Controller, Post, Body, UploadedFiles, UseInterceptors } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { MailService } from './mail.service'
import { Public } from 'src/utils'
import { InboundMailDto } from './dto'
import { AnyFilesInterceptor } from '@nestjs/platform-express'

@ApiTags('Mail')
@Controller('mail')
export class MailController {
	constructor(private readonly mailService: MailService) {}

	@Public()
	@Post()
	@UseInterceptors(AnyFilesInterceptor())
	inbound(@Body() inboundMailDto: InboundMailDto, @UploadedFiles() files: Array<Express.Multer.File>) {
		return this.mailService.inbound(inboundMailDto, files)
	}
}
