import { Injectable, NotFoundException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { TokenService } from 'src/token/token.service';
import { SendCreateEmailDto, SendRecoverEmailDto } from './dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { TokenType } from '@prisma/client';
import { MESSAGE, TEMPLATE } from 'src/constants';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(
    private mailerService: MailerService,
    private prismaService: PrismaService,
    private tokenService: TokenService,
    private configService: ConfigService,
  ) { }

  async sendRecoverEmail(sendRecoverEmailDto: SendRecoverEmailDto) {
    const user = await this.prismaService.user.findUnique({
      where: {
        email: sendRecoverEmailDto.email,
      },
    });

    if (user) {
      const token = await this.tokenService.create({
        email: user.email,
        tokenType: TokenType.RECOVER_EMAIL,
      });

      const domain = this.configService.get('domain');
      const cmsDomain = this.configService.get('cmsDomain');
      const email = sendRecoverEmailDto.email;
      const url = TEMPLATE.MAIL.RECOVER_MAIL_URL(cmsDomain, email, token);

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
      });
      return true;
    } else {
      throw new NotFoundException({
        message: TEMPLATE.EXCEPTION.NOT_FOUND('e-mail', 'o'),
        data: {},
      });
    }
  }

  async sendCreateEmail(sendCreateEmailDto: SendCreateEmailDto) {
    const HOUR_IN_MILLI = 24 * 60 * 60 * 1000;
    const token = await this.tokenService.create({
      email: sendCreateEmailDto.email,
      tokenType: TokenType.CREATE_EMAIL,
      payload: sendCreateEmailDto.payload,
      expiration: HOUR_IN_MILLI,
    });

    const domain = this.configService.get('domain');
    const cmsDomain = this.configService.get('cmsDomain');
    const email = sendCreateEmailDto.email;
    const url = TEMPLATE.MAIL.CREATE_MAIL_URL(cmsDomain, email, token);

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
    });
    return true;
  }
}
