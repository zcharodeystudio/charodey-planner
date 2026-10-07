import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TaskListDocument = HydratedDocument<TaskList>;

@Schema({ timestamps: true })
export class TaskList {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  color: string;
}

export const TaskListSchema = SchemaFactory.createForClass(TaskList);
