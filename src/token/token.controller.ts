import { Controller, Get, Param, Query } from '@nestjs/common';
import { TokenService } from './token.service';
import { ApiBearerAuth, ApiExtraModels, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/auth/roles';
import { CreateTokenDto } from './dto';
import { PaginationDto } from 'src/prisma/dto';
import { ApiResponse } from 'src/utils';


@ApiTags('Token')
@ApiExtraModels(CreateTokenDto)
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('token')
export class TokenController {
    constructor(private readonly tokenService: TokenService) { }

    @ApiResponse(CreateTokenDto, { paginated: true })
    @Get()
    findAll(@Query() query: PaginationDto) {
        return this.tokenService.findAll(query);
    }

    @ApiResponse(CreateTokenDto)
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.tokenService.findOne(id);
    }
}
