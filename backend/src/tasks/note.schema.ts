import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NoteDocument = HydratedDocument<Note>;

@Schema({ timestamps: true })
export class Note {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ default: '', trim: true })
  title: string;

  @Prop({ default: '' })
  body: string;

  @Prop({ default: '#FFF6D8' })
  color: string;

  @Prop({ default: false })
  pinned: boolean;
}

export const NoteSchema = SchemaFactory.createForClass(Note);
