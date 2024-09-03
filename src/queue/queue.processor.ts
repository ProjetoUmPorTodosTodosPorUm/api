import { Process, Processor } from '@nestjs/bull'
import { Job } from 'bull'
import { MailerService } from '@nestjs-modules/mailer'
import { TokenService } from 'src/token/token.service'
import { ConfigService } from '@nestjs/config'
import { User } from '@prisma/client'
import { TokenType } from '@prisma/client'
import { MESSAGE, TEMPLATE } from 'src/constants'
import { SendCreateEmailDto, InboundMailDto } from 'src/mail/dto'
import { ContactService } from 'src/contact/contact.service'
import { FileService } from 'src/file/file.service'
import { FileResponse } from 'src/utils'

@Processor('queue')
export class QueueProcessor {
	constructor(
		private mailerService: MailerService,
		private tokenService: TokenService,
		private configService: ConfigService,
		private contactService: ContactService,
		private fileService: FileService,
	) {}

	@Process('create-mail')
	async handleCreateEmail(job: Job<SendCreateEmailDto>) {
		const sendCreateEmailDto = job.data
		const HOUR_IN_MILLI = 24 * 60 * 60 * 1000

		const token = await this.tokenService.create({
			email: sendCreateEmailDto.email,
			tokenType: TokenType.CREATE_EMAIL,
			payload: sendCreateEmailDto.payload,
			expiration: HOUR_IN_MILLI,
		})

		const domain = this.configService.get('domain')
		const cmsDomain = this.configService.get('cmsDomain')
		const email = sendCreateEmailDto.email
		const url = TEMPLATE.MAIL.CREATE_MAIL_URL(cmsDomain, email, token)

		await this.mailerService.sendMail({
			to: email,
			subject: MESSAGE.MAIL.CREATE_MAIL_SUBJECT,
			template: 'create-mail',
			context: {
				domain,
				cmsDomain,
				name: sendCreateEmailDto.name,
				url,
				token,
			},
		})
		job.progress(100)
	}

	@Process('recover-mail')
	async handleRecoverEmail(job: Job<User>) {
		const user = job.data
		const token = await this.tokenService.create({
			email: user.email,
			tokenType: TokenType.RECOVER_EMAIL,
		})

		const domain = this.configService.get('domain')
		const cmsDomain = this.configService.get('cmsDomain')
		const url = TEMPLATE.MAIL.RECOVER_MAIL_URL(cmsDomain, user.email, token)

		await this.mailerService.sendMail({
			to: user.email,
			subject: MESSAGE.MAIL.RECOVER_MAIL_SUBJECT,
			template: 'recover-mail',
			context: {
				domain,
				name: user.firstName,
				url,
				token,
			},
		})
		job.progress(100)
	}

	@Process('inbound-mail')
	async handleInboundEmail(job: Job<{ inboundMailDto: InboundMailDto; files: Array<Express.Multer.File> }>) {
		const inboundMail = job.data.inboundMailDto
		const files = job.data.files

		const name =
			inboundMail.from.indexOf('<') > 0
				? inboundMail.from.substring(0, inboundMail.from.indexOf('<')).trim()
				: inboundMail.from

		let res: FileResponse[]
		if (files.length > 0) {
			// saving attachments
			res = await this.fileService.bulkCreate({ role: 'WEB_MASTER' } as User, files, {})
		}

		await this.contactService.create({
			email: inboundMail.envelope.from,
			name,
			message: inboundMail.html ?? inboundMail.text,
			attachments: files.length > 0 ? res.reduce((p, c) => [...p, c.name], []) : [],
		})

		job.progress(100)
	}
}
