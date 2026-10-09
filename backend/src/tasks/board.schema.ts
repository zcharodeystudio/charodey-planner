import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BoardDocument = HydratedDocument<Board>;

@Schema({ _id: false })
export class BoardColumn {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, trim: true })
  name: string;
}

export const BoardColumnSchema = SchemaFactory.createForClass(BoardColumn);

@Schema({ timestamps: true })
export class Board {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  projectId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: [BoardColumnSchema], default: [] })
  columns: BoardColumn[];
}

export const BoardSchema = SchemaFactory.createForClass(Board);
