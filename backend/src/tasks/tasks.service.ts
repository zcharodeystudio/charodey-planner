import { occursOn } from '@charodey/validation';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, TaskFile, TaskStep } from './task.schema';

export type TaskView = {
  id: string;
  title: string;
  note: string;
  date: string;
  time: string | null;
  remindAt: string | null;
  done: boolean;
  important: boolean;
  isEvent: boolean;
  favorite: boolean;
  position: number;
  repeat: string;
  repeatDays: number[];
  steps: TaskStep[];
  files: TaskFile[];
  listId: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class TasksService {
  constructor(@InjectModel(Task.name) private readonly taskModel: Model<Task>) {}

  async list(userId: string, date: string) {
    this.assertRealDate(date);
    const tasks = await this.candidates(userId, date, date);
    return tasks.filter((task) => occursOn(task, date)).sort(compareTasks);
  }

  async range(userId: string, from: string, to: string) {
    this.assertSpan(from, to);
    const tasks = await this.candidates(userId, from, to);
    return tasks.sort(compareTasks);
  }

  async dates(userId: string, from: string, to: string) {
    this.assertSpan(from, to);
    const tasks = await this.candidates(userId, from, to);
    const dates: string[] = [];
    for (let cursor = from; cursor <= to; cursor = nextDay(cursor)) {
      if (tasks.some((task) => occursOn(task, cursor))) dates.push(cursor);
    }
    return { dates };
  }

  async get(userId: string, id: string) {
    this.assertId(id);
    const task = await this.taskModel.findOne({ _id: id, userId }).exec();
    if (!task) throw new NotFoundException('Задача не найдена');
    return this.toView(task, true);
  }

  async create(userId: string, dto: CreateTaskDto) {
    this.assertRealDate(dto.date);
    const task = await this.taskModel.create({
      userId,
      ...this.fieldsFromDto(dto),
      title: dto.title.trim(),
      date: dto.date,
    });
    return this.toView(task, true);
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    this.assertId(id);
    if (dto.date) this.assertRealDate(dto.date);
    const $set = this.fieldsFromDto(dto);
    if (dto.title !== undefined) $set.title = dto.title.trim();
    if (dto.date !== undefined) $set.date = dto.date;

    if (!Object.keys($set).length) {
      const current = await this.taskModel.findOne({ _id: id, userId }).exec();
      if (!current) throw new NotFoundException('Задача не найдена');
      return this.toView(current, true);
    }

    const task = await this.taskModel.findOneAndUpdate({ _id: id, userId }, { $set }, { new: true }).exec();
    if (!task) throw new NotFoundException('Задача не найдена');
    return this.toView(task, true);
  }

  async favorites(userId: string) {
    const tasks = await this.taskModel.find({ userId, favorite: true }).exec();
    return tasks
      .map((task) => this.toView(task, false))
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return a.position - b.position;
      });
  }

  async remove(userId: string, id: string) {
    this.assertId(id);
    const task = await this.taskModel.findOneAndDelete({ _id: id, userId }).exec();
    if (!task) throw new NotFoundException('Задача не найдена');
    return { ok: true };
  }

  private async candidates(userId: string, from: string, to: string) {
    const tasks = await this.taskModel
      .find({
        userId,
        $or: [
          { date: { $gte: from, $lte: to } },
          { repeat: { $nin: ['none', null] }, date: { $lte: to } },
        ],
      })
      .exec();
    return tasks.map((task) => this.toView(task, false));
  }

  private fieldsFromDto(dto: UpdateTaskDto) {
    const $set: Record<string, unknown> = {};
    if (dto.note !== undefined) $set.note = dto.note.trim();
    if (dto.time !== undefined) $set.time = dto.time;
    if (dto.remindAt !== undefined) $set.remindAt = dto.remindAt ? new Date(dto.remindAt) : null;
    if (dto.done !== undefined) $set.done = dto.done;
    if (dto.important !== undefined) $set.important = dto.important;
    if (dto.isEvent !== undefined) $set.isEvent = dto.isEvent;
    if (dto.favorite !== undefined) $set.favorite = dto.favorite;
    if (dto.position !== undefined) $set.position = dto.position;
    if (dto.repeat !== undefined) $set.repeat = dto.repeat;
    if (dto.repeatDays !== undefined) $set.repeatDays = dto.repeatDays;
    if (dto.steps !== undefined) $set.steps = dto.steps.map((step) => ({ ...step, title: step.title.trim() }));
    if (dto.files !== undefined) $set.files = dto.files;
    if (dto.listId !== undefined) $set.listId = dto.listId;
    return $set;
  }

  private assertId(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Некорректный id');
  }

  private assertSpan(from: string, to: string) {
    this.assertRealDate(from);
    this.assertRealDate(to);
    if (from > to) throw new BadRequestException('Начало периода позже конца');
  }

  private assertRealDate(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const real =
      date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    if (!real) throw new BadRequestException('Некорректная дата');
  }

  private toView(task: Task & { id: string; createdAt?: Date; updatedAt?: Date }, withFileData: boolean): TaskView {
    return {
      id: task.id,
      title: task.title,
      note: task.note ?? '',
      date: task.date,
      time: task.time ?? null,
      remindAt: task.remindAt ? new Date(task.remindAt).toISOString() : null,
      done: Boolean(task.done),
      important: Boolean(task.important),
      isEvent: Boolean(task.isEvent),
      favorite: Boolean(task.favorite),
      position: task.position ?? (task.createdAt ? new Date(task.createdAt).getTime() : 0),
      repeat: task.repeat || 'none',
      repeatDays: task.repeatDays ?? [],
      steps: task.steps ?? [],
      files: (task.files ?? []).map((file) => ({
        name: file.name,
        mimeType: file.mimeType,
        data: withFileData ? file.data : '',
      })),
      listId: task.listId ?? null,
      createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: task.updatedAt ? new Date(task.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}

function compareTasks(a: TaskView, b: TaskView) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.time && b.time) return a.time.localeCompare(b.time);
  if (a.time) return -1;
  if (b.time) return 1;
  if (a.remindAt && b.remindAt) return a.remindAt.localeCompare(b.remindAt);
  return a.createdAt.localeCompare(b.createdAt);
}

function nextDay(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextDayValue = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${nextMonth}-${nextDayValue}`;
}
