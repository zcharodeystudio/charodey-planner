import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type ProjectDocument = HydratedDocument<Project>;

@Schema({ _id: false })
export class ProjectBlockItem {
  @Prop({ required: true })
  id: string;

  @Prop({ default: '' })
  text: string;

  @Prop({ default: false })
  done: boolean;
}

export const ProjectBlockItemSchema = SchemaFactory.createForClass(ProjectBlockItem);

@Schema({ _id: false })
export class ProjectBlock {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  type: string;

  @Prop({ default: '' })
  text: string;

  @Prop({ type: [ProjectBlockItemSchema], default: [] })
  items: ProjectBlockItem[];

  @Prop({ type: [String], default: [] })
  columns: string[];

  @Prop({ type: MongooseSchema.Types.Mixed, default: [] })
  rows: string[][];

  @Prop({ type: String, default: null })
  boardId: string | null;

  @Prop({ type: String, default: null })
  pageId: string | null;
}

export const ProjectBlockSchema = SchemaFactory.createForClass(ProjectBlock);

@Schema({ _id: false })
export class ProjectPage {
  @Prop({ required: true })
  id: string;

  @Prop({ default: '' })
  title: string;

  @Prop({ type: [ProjectBlockSchema], default: [] })
  blocks: ProjectBlock[];
}

export const ProjectPageSchema = SchemaFactory.createForClass(ProjectPage);

@Schema({ timestamps: true })
export class Project {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  color: string;

  @Prop({ type: [ProjectBlockSchema], default: [] })
  blocks: ProjectBlock[];

  @Prop({ type: [ProjectPageSchema], default: [] })
  pages: ProjectPage[];
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
