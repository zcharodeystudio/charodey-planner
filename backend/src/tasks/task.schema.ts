import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;

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

  @Prop({ type: Date, default: null })
  remindAt: Date | null;

  @Prop({ default: false })
  done: boolean;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ userId: 1, date: 1 });
