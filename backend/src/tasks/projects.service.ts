import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Board } from './board.schema';
import { Project, ProjectBlock, ProjectDocument, ProjectPage } from './project.schema';
import { Task } from './task.schema';
import { TasksService } from './tasks.service';

const DEFAULT_COLUMNS = ['Не начато', 'В работе', 'Готово'];
const BLOCK_TYPES = ['heading', 'text', 'bullet', 'number', 'todo', 'divider', 'table', 'board', 'page'] as const;
export type ProjectBlockType = (typeof BLOCK_TYPES)[number];

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<Project>,
    @InjectModel(Board.name) private readonly boardModel: Model<Board>,
    @InjectModel(Task.name) private readonly taskModel: Model<Task>,
    private readonly tasksService: TasksService,
  ) {}

  async list(userId: string) {
    const projects = await this.projectModel.find({ userId }).sort({ createdAt: 1 }).exec();
    const boards = await this.boardModel.find({ userId }).sort({ createdAt: 1 }).exec();
    return projects.map((project) => ({
      ...this.toProject(project),
      boards: boards.filter((board) => board.projectId === project.id).map((board) => this.toBoard(board)),
    }));
  }

  async create(userId: string, name: string, color: string) {
    const project = await this.projectModel.create({ userId, name: name.trim(), color });
    return this.toProject(project);
  }

  async remove(userId: string, id: string) {
    this.assertId(id);
    const project = await this.projectModel.findOneAndDelete({ _id: id, userId }).exec();
    if (!project) throw new NotFoundException('Проект не найден');
    const boards = await this.boardModel.find({ userId, projectId: id }).exec();
    const boardIds = boards.map((board) => board.id);
    await this.boardModel.deleteMany({ userId, projectId: id }).exec();
    if (boardIds.length) {
      await this.taskModel.updateMany({ userId, boardId: { $in: boardIds } }, { $set: { boardId: null, statusId: null } }).exec();
    }
    return { ok: true };
  }

  async boards(userId: string, projectId: string) {
    this.assertId(projectId);
    const project = await this.projectModel.findOne({ _id: projectId, userId }).exec();
    if (!project) throw new NotFoundException('Проект не найден');
    const boards = await this.boardModel.find({ userId, projectId }).sort({ createdAt: 1 }).exec();
    const known = new Set((project.blocks ?? []).map((block) => block.boardId).filter(Boolean));
    const missing = boards.filter((board) => !known.has(board.id));
    if (missing.length) {
      project.blocks = [
        ...(project.blocks ?? []),
        ...missing.map((board) => this.emptyBlock('board', board.id)),
      ];
      project.markModified('blocks');
      await project.save();
    }
    return {
      project: this.toProject(project),
      boards: boards.map((board) => this.toBoard(board)),
      blocks: (project.blocks ?? []).map((block) => this.toBlock(block)),
      pages: this.toPages(project),
    };
  }

  async page(userId: string, projectId: string, pageId: string) {
    const project = await this.findProject(userId, projectId);
    const page = this.pageOf(project, pageId);
    const boards = await this.boardModel.find({ userId, projectId }).sort({ createdAt: 1 }).exec();
    return {
      project: this.toProject(project),
      page: { id: page.id, title: page.title ?? '' },
      boards: boards.map((board) => this.toBoard(board)),
      blocks: (page.blocks ?? []).map((block) => this.toBlock(block)),
      pages: this.toPages(project),
    };
  }

  async updatePage(userId: string, projectId: string, pageId: string, title: string) {
    const project = await this.findProject(userId, projectId);
    const page = this.pageOf(project, pageId);
    page.title = title.trim().slice(0, 80);
    project.markModified('pages');
    await project.save();
    return { id: page.id, title: page.title };
  }

  async removePage(userId: string, projectId: string, pageId: string) {
    const project = await this.findProject(userId, projectId);
    if (!(project.pages ?? []).some((page) => page.id === pageId)) throw new NotFoundException('Страница не найдена');
    const strip = (blocks: ProjectBlock[]) => (blocks ?? []).filter((block) => !(block.type === 'page' && block.pageId === pageId));
    project.blocks = strip(project.blocks ?? []);
    project.pages = (project.pages ?? []).filter((page) => page.id !== pageId);
    for (const page of project.pages) page.blocks = strip(page.blocks ?? []);
    project.markModified('blocks');
    project.markModified('pages');
    await project.save();
    return { ok: true };
  }

  async addBlock(
    userId: string,
    projectId: string,
    dto: { type: string; name?: string; parentPageId?: string; targetPageId?: string },
  ) {
    const type = dto.type;
    if (!BLOCK_TYPES.includes(type as ProjectBlockType)) throw new BadRequestException('Неизвестный блок');
    const parentPageId = dto.parentPageId?.trim() || undefined;
    const targetPageId = dto.targetPageId?.trim() || undefined;
    const project = await this.findProject(userId, projectId);
    if (type === 'board') {
      const title = dto.name?.trim();
      if (!title) throw new BadRequestException('Введите название');
      const board = await this.boardModel.create({
        userId,
        projectId,
        name: title,
        columns: DEFAULT_COLUMNS.map((column) => ({ id: randomUUID(), name: column })),
      });
      const block = this.emptyBlock('board', board.id);
      this.pushBlock(project, block, parentPageId);
      await project.save();
      return { block: this.toBlock(block), board: this.toBoard(board) };
    }
    if (type === 'page') {
      const label = dto.name?.trim() ?? '';
      let target = targetPageId;
      let created: { id: string; title: string } | undefined;
      if (target) {
        const page = this.pageOf(project, target);
        const block = this.emptyBlock('page');
        block.text = label || page.title || 'Страница';
        block.pageId = page.id;
        this.pushBlock(project, block, parentPageId);
        await project.save();
        return { block: this.toBlock(block) };
      }
      if (!label) throw new BadRequestException('Введите название');
      const page: ProjectPage = { id: randomUUID(), title: label, blocks: [] };
      project.pages = [...(project.pages ?? []), page];
      created = { id: page.id, title: page.title };
      target = page.id;
      const block = this.emptyBlock('page');
      block.text = label;
      block.pageId = target;
      this.pushBlock(project, block, parentPageId);
      await project.save();
      return { block: this.toBlock(block), page: created };
    }
    const block = this.emptyBlock(type as ProjectBlockType);
    this.pushBlock(project, block, parentPageId);
    await project.save();
    return { block: this.toBlock(block) };
  }

  async updateBlock(
    userId: string,
    projectId: string,
    blockId: string,
    patch: { text?: string; items?: { id: string; text: string; done?: boolean }[]; columns?: string[]; rows?: string[][] },
    parentPageId?: string,
  ) {
    const parent = parentPageId?.trim() || undefined;
    const project = await this.findProject(userId, projectId);
    const block = this.blocksOf(project, parent).find((item) => item.id === blockId);
    if (!block) throw new NotFoundException('Блок не найден');
    if (patch.text !== undefined) block.text = String(patch.text).slice(0, 2000);
    if (patch.items) {
      block.items = patch.items.slice(0, 40).map((item) => ({
        id: String(item.id).slice(0, 40),
        text: String(item.text ?? '').slice(0, 500),
        done: Boolean(item.done),
      }));
    }
    if (patch.columns) block.columns = patch.columns.slice(0, 8).map((column) => String(column ?? '').slice(0, 80));
    if (patch.rows) block.rows = this.cleanRows(patch.rows);
    project.markModified(parent ? 'pages' : 'blocks');
    await project.save();
    return this.toBlock(block);
  }

  async removeBlock(userId: string, projectId: string, blockId: string, parentPageId?: string) {
    const parent = parentPageId?.trim() || undefined;
    const project = await this.findProject(userId, projectId);
    const blocks = this.blocksOf(project, parent);
    const block = blocks.find((item) => item.id === blockId);
    if (!block) throw new NotFoundException('Блок не найден');
    const next = blocks.filter((item) => item.id !== blockId);
    if (parent) this.pageOf(project, parent).blocks = next;
    else project.blocks = next;
    project.markModified(parent ? 'pages' : 'blocks');
    await project.save();
    if (block.type === 'board' && block.boardId) await this.removeBoard(userId, block.boardId);
    return { ok: true };
  }

  async createBoard(userId: string, projectId: string, name: string) {
    this.assertId(projectId);
    const project = await this.projectModel.findOne({ _id: projectId, userId }).exec();
    if (!project) throw new NotFoundException('Проект не найден');
    const board = await this.boardModel.create({
      userId,
      projectId,
      name: name.trim(),
      columns: DEFAULT_COLUMNS.map((title) => ({ id: randomUUID(), name: title })),
    });
    return this.toBoard(board);
  }

  async getBoard(userId: string, id: string) {
    const board = await this.findBoard(userId, id);
    const tasks = await this.tasksService.byBoard(userId, id);
    return { board: this.toBoard(board), tasks };
  }

  async addColumn(userId: string, id: string, name: string) {
    const board = await this.findBoard(userId, id);
    board.columns.push({ id: randomUUID(), name: name.trim() });
    await board.save();
    return this.toBoard(board);
  }

  async removeBoard(userId: string, id: string) {
    this.assertId(id);
    const board = await this.boardModel.findOneAndDelete({ _id: id, userId }).exec();
    if (!board) throw new NotFoundException('Доска не найдена');
    await this.taskModel.updateMany({ userId, boardId: id }, { $set: { boardId: null, statusId: null } }).exec();
    return { ok: true };
  }

  private async findProject(userId: string, id: string) {
    this.assertId(id);
    const project = await this.projectModel.findOne({ _id: id, userId }).exec();
    if (!project) throw new NotFoundException('Проект не найден');
    return project;
  }

  private emptyBlock(type: ProjectBlockType, boardId: string | null = null): ProjectBlock {
    const item = () => ({ id: randomUUID(), text: '', done: false });
    return {
      id: randomUUID(),
      type,
      text: '',
      items: type === 'bullet' || type === 'number' || type === 'todo' ? [item()] : [],
      columns: type === 'table' ? ['', ''] : [],
      rows: type === 'table' ? [['', '']] : [],
      boardId,
      pageId: null,
    };
  }

  private pageOf(project: ProjectDocument, pageId: string) {
    const page = (project.pages ?? []).find((item) => item.id === pageId);
    if (!page) throw new NotFoundException('Страница не найдена');
    return page;
  }

  private blocksOf(project: ProjectDocument, parentPageId?: string) {
    if (!parentPageId) return project.blocks ?? [];
    return this.pageOf(project, parentPageId).blocks ?? [];
  }

  private pushBlock(project: ProjectDocument, block: ProjectBlock, parentPageId?: string) {
    if (parentPageId) {
      const page = this.pageOf(project, parentPageId);
      page.blocks = [...(page.blocks ?? []), block];
    } else {
      project.blocks = [...(project.blocks ?? []), block];
    }
    project.markModified('blocks');
    project.markModified('pages');
  }

  private toPages(project: ProjectDocument) {
    return (project.pages ?? []).map((page) => ({ id: page.id, title: page.title ?? '' }));
  }

  private cleanRows(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 20).map((row) => (Array.isArray(row) ? row.slice(0, 8).map((cell) => String(cell ?? '').slice(0, 200)) : []));
  }

  private toBlock(block: ProjectBlock) {
    return {
      id: block.id,
      type: block.type,
      text: block.text ?? '',
      items: (block.items ?? []).map((item) => ({ id: item.id, text: item.text ?? '', done: Boolean(item.done) })),
      columns: block.columns ?? [],
      rows: Array.isArray(block.rows) ? block.rows : [],
      boardId: block.boardId ?? null,
      pageId: block.pageId ?? null,
    };
  }

  private async findBoard(userId: string, id: string) {
    this.assertId(id);
    const board = await this.boardModel.findOne({ _id: id, userId }).exec();
    if (!board) throw new NotFoundException('Доска не найдена');
    return board;
  }

  private assertId(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Некорректный id');
  }

  private toProject(project: Project & { id: string }) {
    return { id: project.id, name: project.name, color: project.color };
  }

  private toBoard(board: Board & { id: string }) {
    return {
      id: board.id,
      projectId: board.projectId,
      name: board.name,
      columns: (board.columns ?? []).map((column) => ({ id: column.id, name: column.name })),
    };
  }
}
