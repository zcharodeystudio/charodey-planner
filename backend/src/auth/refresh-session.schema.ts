import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RefreshSessionDocument = HydratedDocument<RefreshSession>;

@Schema({ timestamps: true })
export class RefreshSession {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;
}

export const RefreshSessionSchema = SchemaFactory.createForClass(RefreshSession);
