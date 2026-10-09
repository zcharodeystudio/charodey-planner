import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';
import { Note } from './note.schema';

const DEFAULT_COLOR = '#FFF6D8';

@Injectable()
export class NotesService {
  constructor(@InjectModel(Note.name) private readonly noteModel: Model<Note>) {}

  async list(userId: string) {
    const notes = await this.noteModel.find({ userId }).sort({ pinned: -1, updatedAt: -1 }).exec();
    return notes.map((note) => this.toView(note));
  }

  async get(userId: string, id: string) {
    this.assertId(id);
    const note = await this.noteModel.findOne({ _id: id, userId }).exec();
    if (!note) throw new NotFoundException('Заметка не найдена');
    return this.toView(note);
  }

  async create(userId: string, dto: CreateNoteDto) {
    const note = await this.noteModel.create({
      userId,
      title: dto.title?.trim() ?? '',
      body: dto.body ?? '',
      color: dto.color ?? DEFAULT_COLOR,
      pinned: dto.pinned ?? false,
    });
    return this.toView(note);
  }

  async update(userId: string, id: string, dto: UpdateNoteDto) {
    this.assertId(id);
    const $set: Record<string, string | boolean> = {};
    if (dto.title !== undefined) $set.title = dto.title.trim();
    if (dto.body !== undefined) $set.body = dto.body;
    if (dto.color !== undefined) $set.color = dto.color;
    if (dto.pinned !== undefined) $set.pinned = dto.pinned;
    const note = await this.noteModel.findOneAndUpdate({ _id: id, userId }, { $set }, { new: true }).exec();
    if (!note) throw new NotFoundException('Заметка не найдена');
    return this.toView(note);
  }

  async remove(userId: string, id: string) {
    this.assertId(id);
    const note = await this.noteModel.findOneAndDelete({ _id: id, userId }).exec();
    if (!note) throw new NotFoundException('Заметка не найдена');
    return { ok: true };
  }

  private assertId(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Некорректный id');
  }

  private toView(note: Note & { id: string; updatedAt?: Date }) {
    return {
      id: note.id,
      title: note.title,
      body: note.body,
      color: note.color,
      pinned: note.pinned,
      updatedAt: note.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
