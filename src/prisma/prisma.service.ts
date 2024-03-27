import { BadRequestException, INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ITEMS_PER_PAGE, MESSAGE } from 'src/constants';
import { PaginationDto } from './dto';
import { paginatedQueryOptions, PrismaUtils } from 'src/utils';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private _ITEMS_PER_PAGE = ITEMS_PER_PAGE;
  private _FIRST_PAGE = 1;
  private _MIN_SEARCH_LENGHT = 3;

  private _defPagOpts: PaginationDto = {
    itemsPerPage: this._ITEMS_PER_PAGE,
    page: this._FIRST_PAGE,
    deleted: false,
    orderKey: 'createdAt',
    orderValue: 'desc',
    search: '',
    searchSpecificField: [],
    searchSpecificValue: []
  };

  async onModuleInit() {
    await this.$connect();

    /***********************************/
    /* SOFT DELETE MIDDLEWARE */
    /***********************************/
    this.$use(async (params, next) => {
      // Use transactions to skip this middleware
      if (params.runInTransaction) {
        return next(params);
      }

      if (params.action === 'findUnique' || params.action === 'findFirst') {
        // Change to findFirst - you cannot filter
        // by anything except ID / unique with findUnique
        params.action = 'findFirst';
        if (params.args.where.deleted == undefined) {
          // Exclude deleted records if they have not been explicitly requested
          params.args.where['deleted'] = null;
        }
      }
      if (params.action === 'findMany') {
        // Find many queries
        if (params.args.where) {
          if (params.args.where.deleted == undefined) {
            // Exclude deleted records if they have not been explicitly requested
            params.args.where['deleted'] = null;
          }
        } else {
          params.args['where'] = { deleted: null };
        }
      }

      if (params.action == 'delete') {
        // Delete queries
        // Change action to an update
        params.action = 'update';
        params.args['data'] = { deleted: new Date() };
      }
      if (params.action == 'deleteMany') {
        // Delete many queries
        params.action = 'updateMany';
        if (params.args.data != undefined) {
          params.args.data['deleted'] = new Date();
        } else {
          params.args['data'] = { deleted: new Date() };
        }
      }

      if (params.action == 'count') {
        if (params.args?.where) {
          if (params.args.where.deleted == undefined) {
            // Exclude deleted records if they have not been explicitly requested
            params.args.where['deleted'] = null;
          }
        } else {
          params.args = { where: { deleted: null } };
        }
      }

      return next(params);
    });
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }

  async cleanDataBase() {
    if (process.env.NODE_ENV === 'production') return;
    //console.log(Reflect.ownKeys(this))
    const models = [
      'user',
      'log',
      'token',
      'file',
      'field',
      'volunteer',
      'agenda',
      'welcomedFamily',
      'church',
      'collaborator',
      'announcement',
      'offerorFamily',
      'report',
      'testimonial',
      'monthlyOffer'
    ];
    await this.$transaction(models.map(model => this[model].deleteMany()));
  }

  private cleanSearch(search: string) {
    // Remove Multiple occurences
    let charsToRemove = [' ', '!', '&', '\\|', '<\->'];
    let tmpStr = search.trim();

    for (let i = 0; i < charsToRemove.length; i++) {
      let char = charsToRemove[i];
      tmpStr = tmpStr.replace(new RegExp(`${char}+(?=${char})`, 'g'), '');
    }

    // remove special chars
    charsToRemove.splice(0, 1);
    for (let i = 0; i < charsToRemove.length; i++) {
      let char = charsToRemove[i];
      tmpStr = tmpStr.replace(new RegExp(`${char}`, 'g'), '');
    }

    // replace whitespaces for &s
    return tmpStr.replace(/\s/g, '&');
  }

  private getPaginationFromQuery(options: PaginationDto = this._defPagOpts, searchKeys: string[] = []) {
    options = {
      ...this._defPagOpts,
      ...options,
    };

    const itemsPerPage = options.itemsPerPage;
    const page = +options.page;
    const take = +itemsPerPage;
    let skip = 0;

    if (page !== this._FIRST_PAGE) {
      skip = (page - 1) * itemsPerPage;
    }

    const orderKey = options.orderKey;
    const orderValue = options.orderValue;

    // Full-text search and partial
    const hasSearch = searchKeys.length > 0 && options.search.length >= this._MIN_SEARCH_LENGHT;
    const searchObj = hasSearch ?
      searchKeys.reduce((p, c) => ([
        ...p,
        { [c]: { search: this.cleanSearch(options.search) } },
        { [c]: { startsWith: options.search, mode: 'insensitive' } },
        { [c]: { endsWith: options.search, mode: 'insensitive' } }
      ]), []) :
      [];

    // Specific value filter
    const hasSearchSpecific = options.searchSpecificField.length > 0 && options.searchSpecificValue.length > 0;
    if (options.searchSpecificField.length !== options.searchSpecificValue.length) {
      throw new BadRequestException({
        message: MESSAGE.EXCEPTION.SEARCH_QUERY_PARITY,
        data: {}
      });
    }

    let searchSpecificObj = {};
    if (hasSearchSpecific) {
      for (let i = 0; i < options.searchSpecificField.length; i++) {
        searchSpecificObj[options.searchSpecificField[i]] = options.searchSpecificValue[i];
      }
    }

    // Doesn't return docs flagged as deleted
    if (!options.deleted) {
      const baseObj = {
        skip,
        take,
        where: { deleted: null },
        orderBy: { [orderKey]: orderValue },
      };

      if (hasSearch) {
        baseObj.where['OR'] = searchObj;
      }

      if (hasSearchSpecific) {
        baseObj.where = {
          ...baseObj.where,
          ...searchSpecificObj
        }
      }

      return baseObj;
    } else {
      const baseObj = {
        skip,
        take,
        orderBy: { [orderKey]: orderValue },
      } as any;

      if (hasSearch) {
        baseObj['where'] = { OR: searchObj };
      }

      if (hasSearchSpecific) {
        if (baseObj.where) {
          baseObj.where = {
            ...baseObj.where,
            ...searchSpecificObj
          }
        } else {
          baseObj['where'] = searchSpecificObj;
        }

      }

      return baseObj;
    }
  }

  async paginatedQuery(
    modelKey: string,
    query?: PaginationDto,
    options: paginatedQueryOptions = {},
  ) {
    const pagination = this.getPaginationFromQuery(query, options.searchKeys);
    let findAllQuery: any;

    if (options.include) {
      findAllQuery = this[modelKey].findMany({
        ...pagination,
        include: options.include,
      });
    } else {
      findAllQuery = this[modelKey].findMany({ ...pagination });
    }

    const totalItemsWhere = pagination.where ? { where: pagination.where } : {};
    const totalItemsQuery = this[modelKey].count(totalItemsWhere);
    let totalCount = 0;
    let data = null;

    if (options.excludeKeys) {
      let tmp = null;
      [tmp, totalCount] = await this.$transaction([
        findAllQuery,
        totalItemsQuery,
      ]);
      // @ts-ignore
      data = PrismaUtils.excludeMany(tmp, ...options.excludeKeys);
    } else {
      [data, totalCount] = await this.$transaction([
        findAllQuery,
        totalItemsQuery,
      ]);
    }
    const totalPages = Math.ceil(totalCount / pagination.take);
    return { data, totalCount, totalPages };
  }
}
