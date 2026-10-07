import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskDatesQuery, TasksByDateQuery, TasksRangeQuery } from './dto/tasks-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

type AuthedRequest = { user: { id: string } };

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query() query: TasksByDateQuery) {
    return this.tasksService.list(req.user.id, query.date);
  }

  @Get('dates')
  dates(@Req() req: AuthedRequest, @Query() query: TaskDatesQuery) {
    return this.tasksService.dates(req.user.id, query.from, query.to);
  }

  @Get('range')
  range(@Req() req: AuthedRequest, @Query() query: TasksRangeQuery) {
    return this.tasksService.range(req.user.id, query.from, query.to);
  }

  @Get('favorites')
  favorites(@Req() req: AuthedRequest) {
    return this.tasksService.favorites(req.user.id);
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.tasksService.get(req.user.id, id);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(req.user.id, dto);
  }

  @Patch(':id')
  update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.tasksService.remove(req.user.id, id);
  }
}
