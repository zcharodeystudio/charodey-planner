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

function parseStyle(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  const size: '12' | '14' | '16' | '18' | '22' | '28' | '36' | undefined =
    source.size === 's' || source.size === '14' ? '14' : source.size === 'l' || source.size === '22' ? '22' : source.size === '12' ? '12' : source.size === '18' ? '18' : source.size === '28' ? '28' : source.size === '36' ? '36' : source.size === 'm' || source.size === '16' ? '16' : undefined;
  const font: 'sans' | 'serif' | 'times' | 'script' | 'mono' | undefined =
    source.font === 'sans' || source.font === 'serif' || source.font === 'times' || source.font === 'script' || source.font === 'mono' ? source.font : undefined;
  const style = {
    bold: source.bold === true,
    italic: source.italic === true,
    underline: source.underline === true,
    ...(size ? { size } : {}),
    ...(font ? { font } : {}),
  };
  if (!style.bold && !style.italic && !style.underline && !size && !font) return undefined;
  return style;
}

function parseSpans(value: unknown) {
  if (!Array.isArray(value)) return [];
  const spans: { text: string; bold?: boolean; italic?: boolean; underline?: boolean; size?: '12' | '14' | '16' | '18' | '22' | '28' | '36'; font?: 'sans' | 'serif' | 'times' | 'script' | 'mono' }[] = [];
  let total = 0;
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const source = item as Record<string, unknown>;
    const text = typeof source.text === 'string' ? source.text : '';
    if (!text) continue;
    const room = 10_000 - total;
    if (room <= 0) break;
    const slice = text.slice(0, room);
    total += slice.length;
    const style = parseStyle(source);
    spans.push({ text: slice, ...(style ?? {}) });
  }
  return spans.slice(0, 400);
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
            return [{ id: itemId, text: typeof entry.text === 'string' ? entry.text.slice(0, 2_000) : '', done: Boolean(entry.done) }];
          })
        : [];
      const columns = Array.isArray(source.columns) ? source.columns.filter((column) => typeof column === 'string').slice(0, 8).map((column) => column.slice(0, 80)) : [];
      const rows = Array.isArray(source.rows)
        ? source.rows.slice(0, 30).map((row) => (Array.isArray(row) ? row.filter((cell) => typeof cell === 'string').slice(0, 8).map((cell) => cell.slice(0, 200)) : []))
        : [];
      const spans = parseSpans(source.spans);
      const text = spans.length ? spans.map((span) => span.text).join('').slice(0, 10_000) : typeof source.text === 'string' ? source.text.slice(0, 10_000) : '';
      const style = spans.length ? undefined : parseStyle(source.style);
      return [{ id, type, text, items, columns, rows, ...(spans.length ? { spans } : {}), ...(style ? { style } : {}) }];
    });
  } catch {
    return [];
  }
}
