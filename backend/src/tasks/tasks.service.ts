import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './task.schema';

export type TaskView = {
  id: string;
  title: string;
  note: string;
  date: string;
  remindAt: string | null;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class TasksService {
  constructor(@InjectModel(Task.name) private readonly taskModel: Model<Task>) {}

  async list(userId: string, date: string) {
    this.assertRealDate(date);
    const tasks = await this.taskModel.find({ userId, date }).exec();
    return tasks.map((task) => this.toView(task)).sort(compareTasks);
  }

  async dates(userId: string, from: string, to: string) {
    this.assertRealDate(from);
    this.assertRealDate(to);
    if (from > to) {
      throw new BadRequestException('Начало периода позже конца');
    }
    const dates = await this.taskModel.distinct('date', {
      userId,
      date: { $gte: from, $lte: to },
    });
    return { dates: [...dates].sort() };
  }

  async get(userId: string, id: string) {
    this.assertId(id);
    const task = await this.taskModel.findOne({ _id: id, userId }).exec();
    if (!task) throw new NotFoundException('Задача не найдена');
    return this.toView(task);
  }

  async create(userId: string, dto: CreateTaskDto) {
    this.assertRealDate(dto.date);
    const task = await this.taskModel.create({
      userId,
      title: dto.title.trim(),
      note: dto.note?.trim() ?? '',
      date: dto.date,
      remindAt: dto.remindAt ? new Date(dto.remindAt) : null,
      done: dto.done ?? false,
    });
    return this.toView(task);
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    this.assertId(id);
    if (dto.date) this.assertRealDate(dto.date);

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};
    if (dto.title !== undefined) $set.title = dto.title.trim();
    if (dto.note !== undefined) $set.note = dto.note.trim();
    if (dto.date !== undefined) $set.date = dto.date;
    if (dto.done !== undefined) $set.done = dto.done;
    if (dto.remindAt === null) $unset.remindAt = 1;
    else if (dto.remindAt) $set.remindAt = new Date(dto.remindAt);

    const update: Record<string, unknown> = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    if (!Object.keys(update).length) {
      const current = await this.taskModel.findOne({ _id: id, userId }).exec();
      if (!current) throw new NotFoundException('Задача не найдена');
      return this.toView(current);
    }

    const task = await this.taskModel.findOneAndUpdate({ _id: id, userId }, update, { new: true }).exec();
    if (!task) throw new NotFoundException('Задача не найдена');
    return this.toView(task);
  }

  async remove(userId: string, id: string) {
    this.assertId(id);
    const task = await this.taskModel.findOneAndDelete({ _id: id, userId }).exec();
    if (!task) throw new NotFoundException('Задача не найдена');
    return { ok: true };
  }

  private assertId(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Некорректный id');
    }
  }

  private assertRealDate(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const real =
      date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    if (!real) throw new BadRequestException('Некорректная дата');
  }

  private toView(task: Task & { id: string; createdAt?: Date; updatedAt?: Date }): TaskView {
    return {
      id: task.id,
      title: task.title,
      note: task.note ?? '',
      date: task.date,
      remindAt: task.remindAt ? new Date(task.remindAt).toISOString() : null,
      done: task.done,
      createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: task.updatedAt ? new Date(task.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}

function compareTasks(a: TaskView, b: TaskView) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.remindAt && b.remindAt) return a.remindAt.localeCompare(b.remindAt);
  if (a.remindAt) return -1;
  if (b.remindAt) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}
