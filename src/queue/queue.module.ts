import { BullModule } from '@nestjs/bull'
import { Global, Module } from '@nestjs/common'
import { QueueProcessor } from './queue.processor'
import { MailerModule } from '@nestjs-modules/mailer'
import { TokenModule } from 'src/token/token.module'
import { ConfigService } from '@nestjs/config'
import { QueueController } from './queue.controller'
import { QueueService } from './queue.service'
import { ContactModule } from 'src/contact/contact.module'
import { FileModule } from 'src/file/file.module'

@Module({
	imports: [
		BullModule.registerQueue({
			name: 'queue',
		}),
		MailerModule.forRootAsync({
			useFactory: (configService: ConfigService) => configService.get('mailer'),
			inject: [ConfigService],
		}),
		TokenModule,
		ContactModule,
		FileModule,
	],
	providers: [QueueProcessor, QueueService],
	controllers: [QueueController],
})
export class QueueModule {}
