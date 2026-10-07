import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaskList, TaskListSchema } from './list.schema';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { Task, TaskSchema } from './task.schema';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: TaskList.name, schema: TaskListSchema },
    ]),
  ],
  controllers: [TasksController, ListsController],
  providers: [TasksService, ListsService],
})
export class TasksModule {}
