import { Injectable, NestMiddleware, Logger } from '@nestjs/common'
import { User } from '@prisma/client'
import { NextFunction, Request, Response } from 'express'
import * as qs from 'qs'

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
	private readonly logger = new Logger(LoggerMiddleware.name)

	use(req: Request, res: Response, next: NextFunction) {
		const { ip, method, originalUrl: url, body, query } = req

		res.on('finish', () => {
			const { file, files } = req
			const fileUploaded = file ? [file.filename] : []
			const filesUploaded = files ? (files as Express.Multer.File[]).map((file) => file.filename) : []

			const user = (req.user as User) || undefined
			const statusCode = res.statusCode

			if (method !== 'GET') {
				this.logger.log({
					ip,
					method,
					url,
					body: this.cleanBody(body),
					query: qs.stringify(query),
					statusCode: statusCode.toString(),
					user,
					files: filesUploaded.length > 0 ? filesUploaded : fileUploaded,
				})
			}
		})

		next()
	}

	cleanBody(body: any) {
		// remove sensitivity data
		const keys = ['password', 'accessToken', 'refreshToken']
		for (const key of keys) {
			if (body[key]) {
				body[key] = '***redacted***'
			}
		}
		return body
	}
}
