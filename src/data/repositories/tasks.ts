/** Dépôt des tâches : boîte « À planifier », sous-tâches, placement sur la timeline. */
import type { Table } from 'dexie';
import type { Subtask, Task } from '../../domain/models';
import { newTaskSchema, taskSchema, type NewTask } from '../schema';
import { newId, nowIso } from '../ids';
import type { DateKey } from '../../domain/time/dateKey';

export class TaskRepository {
  constructor(private readonly table: Table<Task, string>) {}

  /** Tâches actives, prioritaires d'abord puis les plus anciennes. */
  async list(): Promise<Task[]> {
    const rows = await this.table.orderBy('priority').reverse().toArray();
    return rows
      .filter((row) => row.deletedAt === null)
      .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
  }

  async listOpen(): Promise<Task[]> {
    return (await this.list()).filter((task) => !task.done);
  }

  async get(id: string): Promise<Task | null> {
    const row = await this.table.get(id);
    if (row === undefined || row.deletedAt !== null) return null;
    return row;
  }

  async create(input: NewTask): Promise<Task> {
    const parsed = newTaskSchema.parse(input);
    const stamp = nowIso();
    const task = taskSchema.parse({
      id: newId(),
      title: parsed.title,
      priority: parsed.priority ?? 0,
      done: parsed.done ?? false,
      doneAt: parsed.doneAt ?? null,
      dueDate: parsed.dueDate ?? null,
      blockId: parsed.blockId ?? null,
      subtasks: parsed.subtasks ?? [],
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    });
    await this.table.add(task);
    return task;
  }

  async update(id: string, patch: Partial<NewTask>): Promise<Task> {
    const parsed = newTaskSchema.partial().parse(patch);
    const current = await this.table.get(id);
    if (current === undefined) throw new Error(`Tâche inconnue : ${id}`);
    const updated = taskSchema.parse({ ...current, ...parsed, updatedAt: nowIso() });
    await this.table.put(updated);
    return updated;
  }

  async setDone(id: string, done: boolean): Promise<Task> {
    return this.update(id, { done, doneAt: done ? nowIso() : null });
  }

  /** Place la tâche sur la timeline (ou l'en retire) : tâche liée à un bloc. */
  async placeOnTimeline(
    id: string,
    blockId: string | null,
    dueDate: DateKey | null,
  ): Promise<Task> {
    return this.update(id, { blockId, dueDate });
  }

  async addSubtask(id: string, title: string): Promise<Task> {
    const current = await this.table.get(id);
    if (current === undefined) throw new Error(`Tâche inconnue : ${id}`);
    const subtask: Subtask = { id: newId(), title, done: false };
    return this.update(id, { subtasks: [...current.subtasks, subtask] });
  }

  async toggleSubtask(id: string, subtaskId: string): Promise<Task> {
    const current = await this.table.get(id);
    if (current === undefined) throw new Error(`Tâche inconnue : ${id}`);
    const subtasks = current.subtasks.map((subtask) =>
      subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask,
    );
    return this.update(id, { subtasks });
  }

  /** Reporte à une date les tâches non terminées d'une autre date. */
  async rescheduleOpenTasks(from: DateKey, to: DateKey): Promise<Task[]> {
    const candidates = (await this.list()).filter((task) => !task.done && task.dueDate === from);
    const stamp = nowIso();
    await this.table.db.transaction('rw', this.table, async () => {
      for (const task of candidates) {
        await this.table.put({ ...task, dueDate: to, updatedAt: stamp });
      }
    });
    return candidates.map((task) => ({ ...task, dueDate: to, updatedAt: stamp }));
  }

  async softDelete(id: string): Promise<void> {
    const current = await this.table.get(id);
    if (current === undefined) return;
    const stamp = nowIso();
    await this.table.put({ ...current, deletedAt: stamp, updatedAt: stamp });
  }
}
