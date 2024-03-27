import { BadRequestException, Injectable, NotFoundException, Query, Logger } from '@nestjs/common';
import { CreateTokenDto } from './dto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Token, TokenType } from '@prisma/client';
import { PaginationDto } from 'src/prisma/dto';
import { MESSAGE } from 'src/constants';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class TokenService {
  private expiresIn = this.configService.get<number>('token.expiresIn');
  private lenght = this.configService.get<number>('token.length');
  private possibleChars = this.configService.get('token.possibleChars');

  constructor(
    private configService: ConfigService,
    private prismaService: PrismaService,
  ) { }

  private readonly logger = new Logger(TokenService.name);

  async create(createTokenDto: CreateTokenDto) {
    const tokenString = this.generateToken();
    await this.prismaService.token.create({
      data: {
        ...createTokenDto,
        token: bcrypt.hashSync(tokenString, bcrypt.genSaltSync()),
        expiration: createTokenDto.expiration ?? this.expiresIn
      },
    });
    return tokenString;
  }

  async validate(email: string, token: string) {
    const tokenDoc = await this.prismaService.token.findFirst({
      where: {
        email,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    if (tokenDoc == null) {
      throw new NotFoundException({
        message: MESSAGE.EXCEPTION.TOKEN.NOT_SET,
        data: {},
      });
    }

    const isTokenValid = this.isTokenValid(tokenDoc, token);
    if (isTokenValid) {
      await this.prismaService.token.update({
        where: {
          id: tokenDoc.id,
        },
        data: {
          used: true,
        },
      });
    }
    return isTokenValid;
  }

  async getPayloadFromToken<T>(email: string, token: string, tokenType?: TokenType): Promise<T> {
    const findByTokenType = tokenType ? { tokenType } : null;

    const tokenDoc = await this.prismaService.token.findFirst({
      where: {
        email,
        ...findByTokenType
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    if (tokenDoc == null) {
      throw new NotFoundException({
        message: MESSAGE.EXCEPTION.TOKEN.NOT_SET,
        data: {},
      });
    }

    this.isTokenValid(tokenDoc, token, true);
    return tokenDoc.payload as T;
  }

  async findAll(@Query() query?: PaginationDto) {
    return await this.prismaService.paginatedQuery('token', query, {
      searchKeys: ['email']
    });
  }

  async findOne(id: string) {
    return await this.prismaService.token.findUnique({
      where: { id },
    });
  }

  private generateToken() {
    let token = '';
    for (let i = 0; i < this.lenght; i++) {
      const randomIndex = Math.round(
        Math.random() * (this.possibleChars.length - 1),
      );
      token += this.possibleChars[randomIndex];
    }
    return token;
  }

  isTokenValid(TokenDoc: Token, tokenString: string, verifyPayload = false) {
    const removeHyphens = (token: string) => token.split('-').join('');
    let message: string;

    if (TokenDoc.used == true) {
      message = MESSAGE.EXCEPTION.TOKEN.USED;
    } else if (TokenDoc.createdAt <= new Date(Date.now() - TokenDoc.expiration)) {
      message = MESSAGE.EXCEPTION.TOKEN.EXPIRED;
    } else if (!bcrypt.compareSync(removeHyphens(tokenString), TokenDoc.token)) {
      message = MESSAGE.EXCEPTION.TOKEN.DONT_MATCH;
    } else if (verifyPayload && !TokenDoc.payload) {
      message = MESSAGE.EXCEPTION.TOKEN.PAYLOAD_NOT_SET;
    } else {
      return true;
    }

    throw new BadRequestException({
      message,
      data: {},
    });
  }

  @Cron('0 23 * * *')
  async removeOld() {
    this.logger.log('Removing old tokens...')

    const dateLimit = new Date();
    dateLimit.setMonth(dateLimit.getMonth() - this.configService.get<number>('token.clearBeyondMonths'));

    const deleteQuery = this.prismaService.token.deleteMany({
      where: {
        createdAt: {
          lte: dateLimit
        }
      }
    });
    const [result] = await this.prismaService.$transaction([deleteQuery]);
    return result;
  }
}
