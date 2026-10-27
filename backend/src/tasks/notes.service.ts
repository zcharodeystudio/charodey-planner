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
      blocks: parseBlocks(dto.blocksJson),
    });
    return this.toView(note);
  }

  async update(userId: string, id: string, dto: UpdateNoteDto) {
    this.assertId(id);
    const $set: Record<string, string | boolean | Record<string, unknown>[]> = {};
    if (dto.title !== undefined) $set.title = dto.title.trim();
    if (dto.body !== undefined) $set.body = dto.body;
    if (dto.color !== undefined) $set.color = dto.color;
    if (dto.pinned !== undefined) $set.pinned = dto.pinned;
    if (dto.blocksJson !== undefined) $set.blocks = parseBlocks(dto.blocksJson);
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
      blocks: Array.isArray(note.blocks) ? note.blocks : [],
      updatedAt: note.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}

function parseBlocks(raw?: string) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 80).flatMap((block) => {
      if (!block || typeof block !== 'object') return [];
      const source = block as Record<string, unknown>;
      const id = typeof source.id === 'string' ? source.id.slice(0, 40) : '';
      const type = typeof source.type === 'string' ? source.type : '';
      if (!id || !['heading', 'text', 'bullet', 'number', 'todo', 'table', 'divider'].includes(type)) return [];
      const items = Array.isArray(source.items)
        ? source.items.slice(0, 40).flatMap((item) => {
            if (!item || typeof item !== 'object') return [];
            const entry = item as Record<string, unknown>;
            const itemId = typeof entry.id === 'string' ? entry.id.slice(0, 40) : '';
            if (!itemId) return [];
            return [{ id: itemId, text: typeof entry.text === 'string' ? entry.text.slice(0, 500) : '', done: Boolean(entry.done) }];
          })
        : [];
      const columns = Array.isArray(source.columns) ? source.columns.filter((column) => typeof column === 'string').slice(0, 8).map((column) => column.slice(0, 80)) : [];
      const rows = Array.isArray(source.rows)
        ? source.rows.slice(0, 30).map((row) => (Array.isArray(row) ? row.filter((cell) => typeof cell === 'string').slice(0, 8).map((cell) => cell.slice(0, 200)) : []))
        : [];
      return [{ id, type, text: typeof source.text === 'string' ? source.text.slice(0, 4000) : '', items, columns, rows }];
    });
  } catch {
    return [];
  }
}
