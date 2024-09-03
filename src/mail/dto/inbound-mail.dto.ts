import { ValidateIf } from 'class-validator'
import { IsString, IsNotEmpty } from 'src/utils'
import { IsOptional } from 'class-validator'
import { Transform, Type } from 'class-transformer'

// types from:
// https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/setting-up-the-inbound-parse-webhook#default-parameters

class InboundCharsets {
	to: string
	html?: string
	subject: string
	from: string
	text: string
}

class InboundEnvelope {
	to: string[]
	from: string
}

export class InboundMailDto {
	@IsNotEmpty()
	@IsString()
	headers: string
	@IsNotEmpty()
	@IsString()
	dkim: string
	@ValidateIf((o) => !!o.attachments && Number(o.attachments) >= 1)
	@Transform((params) => JSON.parse(params.value))
	'content-ids'?: any
	@IsNotEmpty()
	@IsString()
	to: string
	@IsNotEmpty()
	@IsString()
	text: string
	@IsOptional()
	@IsString()
	html?: string
	@IsNotEmpty()
	@IsString()
	from: string
	@IsNotEmpty()
	@IsString()
	sender_ip: string
	@IsNotEmpty()
	@IsString()
	spam_report: string
	@IsNotEmpty()
	@Transform((params) => JSON.parse(params.value))
	@Type(() => InboundEnvelope)
	envelope: InboundEnvelope
	@IsOptional()
	@IsString()
	attachments?: string
	@IsNotEmpty()
	@IsString()
	subject: string
	@IsNotEmpty()
	@IsString()
	spam_score: string
	@ValidateIf((o) => !!o.attachments && Number(o.attachments) >= 1)
	@Transform((params) => JSON.parse(params.value))
	'attachment-info'?: any
	@IsNotEmpty()
	@Transform((params) => JSON.parse(params.value))
	@Type(() => InboundCharsets)
	charsets: InboundCharsets
	@IsNotEmpty()
	@IsString()
	SPF: string
}
