import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateListDto, UpdateListDto } from './dto/create-list.dto';
import { TaskList } from './list.schema';
import { Task } from './task.schema';

@Injectable()
export class ListsService {
  constructor(
    @InjectModel(TaskList.name) private readonly listModel: Model<TaskList>,
    @InjectModel(Task.name) private readonly taskModel: Model<Task>,
  ) {}

  async list(userId: string) {
    const lists = await this.listModel.find({ userId }).sort({ createdAt: 1 }).exec();
    return lists.map((list) => this.toView(list));
  }

  async create(userId: string, dto: CreateListDto) {
    const list = await this.listModel.create({
      userId,
      name: dto.name.trim(),
      color: dto.color,
    });
    return this.toView(list);
  }

  async update(userId: string, id: string, dto: UpdateListDto) {
    this.assertId(id);
    const $set: Record<string, string> = {};
    if (dto.name !== undefined) $set.name = dto.name.trim();
    if (dto.color !== undefined) $set.color = dto.color;
    const list = await this.listModel.findOneAndUpdate({ _id: id, userId }, { $set }, { new: true }).exec();
    if (!list) throw new NotFoundException('Список не найден');
    return this.toView(list);
  }

  async remove(userId: string, id: string) {
    this.assertId(id);
    const list = await this.listModel.findOneAndDelete({ _id: id, userId }).exec();
    if (!list) throw new NotFoundException('Список не найден');
    await this.taskModel.updateMany({ userId, listId: id }, { $set: { listId: null } }).exec();
    return { ok: true };
  }

  private assertId(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Некорректный id');
  }

  private toView(list: TaskList & { id: string }) {
    return { id: list.id, name: list.name, color: list.color };
  }
}
