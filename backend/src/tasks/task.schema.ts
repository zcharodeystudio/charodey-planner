import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;

@Schema({ _id: false })
export class TaskStep {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: false })
  done: boolean;
}

export const TaskStepSchema = SchemaFactory.createForClass(TaskStep);

@Schema({ _id: false })
export class TaskFile {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  data: string;
}

export const TaskFileSchema = SchemaFactory.createForClass(TaskFile);

@Schema({ timestamps: true })
export class Task {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '' })
  note: string;

  @Prop({ required: true, index: true })
  date: string;

  @Prop({ type: String, default: null })
  time: string | null;

  @Prop({ type: Date, default: null })
  remindAt: Date | null;

  @Prop({ default: false })
  done: boolean;

  @Prop({ default: false })
  important: boolean;

  @Prop({ default: false })
  isEvent: boolean;

  @Prop({ default: false, index: true })
  favorite: boolean;

  @Prop({ type: Number, default: null })
  position: number | null;

  @Prop({ default: 'none' })
  repeat: string;

  @Prop({ type: [Number], default: [] })
  repeatDays: number[];

  @Prop({ type: [TaskStepSchema], default: [] })
  steps: TaskStep[];

  @Prop({ type: [TaskFileSchema], default: [] })
  files: TaskFile[];

  @Prop({ type: String, default: null, index: true })
  listId: string | null;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ userId: 1, date: 1 });
