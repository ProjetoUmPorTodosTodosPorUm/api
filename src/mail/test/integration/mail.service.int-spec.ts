import { Test } from '@nestjs/testing'
import { MailService } from 'src/mail/mail.service'
import { PrismaService } from 'src/prisma/prisma.service'
import { ConfigModule } from '@nestjs/config'
import configuration from 'src/config/configuration'
import * as nodemailer from 'nodemailer'
import { NotFoundException } from '@nestjs/common'
import { TEMPLATE } from 'src/constants'
import { Queue } from 'bull'
import { PrismaModule } from 'src/prisma/prisma.module'
import { UserModule } from 'src/user/user.module'
import { MailModule } from 'src/mail/mail.module'
import { TokenModule } from 'src/token/token.module'
import { BullModule, getQueueToken } from '@nestjs/bull'
import { QueueModule } from 'src/queue/queue.module'

jest.setTimeout(30 * 1_000)

describe('Main Service Integration', () => {
	let prisma: PrismaService
	let queue: Queue
	let mailService: MailService

	const email = 'user@example.com'

	beforeAll(async () => {
		const mailAccount = await nodemailer.createTestAccount()
		const moduleRef = await Test.createTestingModule({
			imports: [
				// look at configuration.ts
				ConfigModule.forRoot({
					load: [
						() => ({
							...configuration(),
							mailer: {
								...configuration().mailer,
								transport: {
									host: mailAccount.smtp.host,
									secure: mailAccount.smtp.secure,
									port: mailAccount.smtp.port,
									auth: {
										user: mailAccount.user,
										pass: mailAccount.pass,
									},
								},
							},
						}),
					],
					isGlobal: true,
				}),
				
				// Basic Modules
				PrismaModule,
				UserModule,

				// Specific
				BullModule.forRoot({
					redis: {
						host: 'localhost',
						port: 6379,
					},	
				}),
				QueueModule,
				MailModule,
				TokenModule,

			],
		}).compile()

		prisma = moduleRef.get(PrismaService)
		queue = moduleRef.get(getQueueToken('queue'))
		mailService = moduleRef.get(MailService)
		
	})

	beforeEach(async () => {
		await prisma.cleanDataBase()
		await queue.empty()
	})

	describe('sendRecoverEmail()', () => {
		it('Should Not Send Email (User Not Found)', async () => {
			try {
				await mailService.sendRecoverEmail({ email })
			} catch (error) {
				expect(error).toBeInstanceOf(NotFoundException)
				expect(error.response.message).toBe(TEMPLATE.EXCEPTION.NOT_FOUND('e-mail', 'o'))

				const token = await prisma.token.findFirst({ where: { email } })
				expect(token).toBeNull()
			}
		})

		it('Should Send Email', async () => {
			await prisma.user.create({
				data: {
					firstName: 'João',
					email,
					hashedPassword: 'notrealrash',
				},
			})
			await mailService.sendRecoverEmail({ email })

			const job = (await queue.getJobs(['active', 'completed', 'waiting']))[0]
			expect(job.name).toBe('recover-mail')

			const token = await prisma.token.findFirst({ where: { email } })
			expect(token).toBeDefined()
		})
	})

	describe('sendCreateEmail()', () => {
		it('Should Send Email', async () => {
			await mailService.sendCreateEmail({
				email,
				name: 'teste',
				payload: {
					role: 'VOLUNTEER'
				}
			})

			const job = (await queue.getJobs(['active', 'completed', 'waiting']))[0]
			expect(job.name).toBe('create-mail')

			const token = await prisma.token.findFirst({ where: { email } })
			expect(token).toBeDefined()
		})
	})
})
