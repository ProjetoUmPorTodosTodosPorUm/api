import { Injectable, NotFoundException } from '@nestjs/common'
import { SendCreateEmailDto, SendRecoverEmailDto } from './dto'
import { PrismaService } from 'src/prisma/prisma.service'
import { TEMPLATE } from 'src/constants'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'

@Injectable()
export class MailService {
	constructor(
		private prismaService: PrismaService,
		@InjectQueue('queue') private readonly queue: Queue
	) { }

	async sendRecoverEmail(sendRecoverEmailDto: SendRecoverEmailDto) {
		const user = await this.prismaService.user.findUnique({
			where: {
				email: sendRecoverEmailDto.email,
			},
		})

		if (user) {
			await this.queue.add('recover-mail', user, { attempts: 3, removeOnComplete: 10 });
			return true
		} else {
			throw new NotFoundException({
				message: TEMPLATE.EXCEPTION.NOT_FOUND('e-mail', 'o'),
				data: {},
			})
		}
	}

	async sendCreateEmail(sendCreateEmailDto: SendCreateEmailDto) {
		await this.queue.add('create-mail', sendCreateEmailDto, { attempts: 3, removeOnComplete: 10 });
		return true
	}
}
