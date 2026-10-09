import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from './projects.service';

type AuthedRequest = { user: { id: string } };

class CreateProjectDto {
  @IsString()
  @MinLength(1, { message: 'Введите название' })
  @MaxLength(40)
  name: string;

  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Некорректный цвет' })
  color: string;
}

const BLOCK_TYPES = ['heading', 'text', 'bullet', 'number', 'todo', 'divider', 'table', 'board', 'page'];

class CreateBlockDto {
  @IsIn(BLOCK_TYPES)
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  parentPageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  targetPageId?: string;
}

class UpdatePageDto {
  @IsString()
  @MaxLength(80)
  title: string;
}

class BlockItemDto {
  @IsString()
  @MaxLength(40)
  id: string;

  @IsString()
  @MaxLength(500)
  text: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;
}

class UpdateBlockDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockItemDto)
  items?: BlockItemDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columns?: string[];

  @IsOptional()
  @IsArray()
  rows?: string[][];
}

class NameDto {
  @IsString()
  @MinLength(1, { message: 'Введите название' })
  @MaxLength(40)
  name: string;
}

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.projectsService.list(req.user.id);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(req.user.id, dto.name, dto.color);
  }

  @Get(':id')
  boards(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.projectsService.boards(req.user.id, id);
  }

  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.projectsService.remove(req.user.id, id);
  }

  @Post(':id/boards')
  createBoard(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: NameDto) {
    return this.projectsService.createBoard(req.user.id, id, dto.name);
  }

  @Post(':id/blocks')
  addBlock(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: CreateBlockDto) {
    return this.projectsService.addBlock(req.user.id, id, dto);
  }

  @Patch(':id/blocks/:blockId')
  updateBlock(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('blockId') blockId: string,
    @Query('parent') parent: string | undefined,
    @Body() dto: UpdateBlockDto,
  ) {
    return this.projectsService.updateBlock(req.user.id, id, blockId, dto, parent);
  }

  @Delete(':id/blocks/:blockId')
  removeBlock(@Req() req: AuthedRequest, @Param('id') id: string, @Param('blockId') blockId: string, @Query('parent') parent?: string) {
    return this.projectsService.removeBlock(req.user.id, id, blockId, parent);
  }

  @Get(':id/pages/:pageId')
  page(@Req() req: AuthedRequest, @Param('id') id: string, @Param('pageId') pageId: string) {
    return this.projectsService.page(req.user.id, id, pageId);
  }

  @Patch(':id/pages/:pageId')
  updatePage(@Req() req: AuthedRequest, @Param('id') id: string, @Param('pageId') pageId: string, @Body() dto: UpdatePageDto) {
    return this.projectsService.updatePage(req.user.id, id, pageId, dto.title);
  }

  @Delete(':id/pages/:pageId')
  removePage(@Req() req: AuthedRequest, @Param('id') id: string, @Param('pageId') pageId: string) {
    return this.projectsService.removePage(req.user.id, id, pageId);
  }
}

@ApiTags('boards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('boards')
export class BoardsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.projectsService.getBoard(req.user.id, id);
  }

  @Post(':id/columns')
  addColumn(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: NameDto) {
    return this.projectsService.addColumn(req.user.id, id, dto.name);
  }

  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.projectsService.removeBoard(req.user.id, id);
  }
}
