import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Board, BoardSchema } from './board.schema';
import { TaskList, TaskListSchema } from './list.schema';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { Note, NoteSchema } from './note.schema';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { Project, ProjectSchema } from './project.schema';
import { BoardsController, ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { Task, TaskSchema } from './task.schema';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: TaskList.name, schema: TaskListSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Board.name, schema: BoardSchema },
      { name: Note.name, schema: NoteSchema },
    ]),
  ],
  controllers: [TasksController, ListsController, ProjectsController, BoardsController, NotesController],
  providers: [TasksService, ListsService, ProjectsService, NotesService],
})
export class TasksModule {}
