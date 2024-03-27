import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { FILES_PATH } from 'src/constants';
import { JwtModuleOptions } from '@nestjs/jwt';
import * as multer from 'multer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';

export default () => ({
  domain: process.env.NODE_ENV === 'development' ? 'http://localhost' : 'https://www.projetoumportodostodosporum.org',
  cmsDomain: process.env.NODE_ENV === 'development' ? 'http://cms.localhost' : 'https://www.cms.projetoumportodostodosporum.org',

  jwt: {
    accessToken: {
      secret: process.env.ACCESS_TOKEN_JWT_SECRET,
      signOptions: {
        expiresIn: '15m',
      },
    } as JwtModuleOptions,
    refreshToken: {
      secret: process.env.REFRESH_TOKEN_JWT_SECRET,
      signOptions: {
        expiresIn: '7d',
      },
    } as JwtModuleOptions,
  },

  multer: {
    storage: multer.diskStorage({
      destination: function (req, file, cb) {
        if (!existsSync(FILES_PATH)) {
          mkdirSync(FILES_PATH);
        }
        cb(null, FILES_PATH);
      },
      filename: function (req, file, cb) {
        const newFilename = `${Date.now()}-${file.originalname}`;
        cb(null, `${newFilename}`);
      },
    }),
  },

  mailer: {
    //pool: true,
    transport: {
      host: process.env.MAIL_HOST,
      secure: Number(process.env.MAIL_PORT) === 465 ? true : false,
      port: Number(process.env.MAIL_PORT) || 465,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
    },
    defaults: {
      from: process.env.MAIL_FROM,
    },
    template: {
      dir: join(__dirname, '../mail/templates'),
      adapter: new HandlebarsAdapter(),
      options: {
        strict: true,
      },
    },
  },

  token: {
    possibleChars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    expiresIn: 15 * 60 * 1000, // minutes in milliseconds
    length: 6,
    clearBeyondMonths: 1
  },

  throttle: {
    ttl: 60,
    limit: 60,
  },

  log: {
    clearBeyondMonths: 3
  }
});
