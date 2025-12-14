import fetch from 'node-fetch';

export class TasksService {
  constructor(tokenReader) {
    if (!tokenReader) {
      throw new Error('tokenReader is required');
    }
    this.tokenReader = tokenReader;
  }

  async fetchTasksForUser(userName) {
    const accessToken = await this.tokenReader.refreshAccessToken(userName);
    const lists = await this.#fetchTaskLists(accessToken);

    const results = [];

    for (const list of lists) {
      const tasks = await this.#fetchTasksForList(list.id, accessToken);
      results.push({
        title: list.title,
        tasks
      });
    }

    return results;
  }

  async #fetchTaskLists(accessToken) {
    const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();
    return data.items || [];
  }

  async #fetchTasksForList(listId, accessToken) {
    const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();

    const items = data.items || [];
    const tree = this.#buildTaskTree(items);

    return tree;
  }

  #buildTaskTree(items = []) {
    const byId = new Map();
    const roots = [];

    for (const task of items) {
      task.subtasks = [];
      byId.set(task.id, task);
    }

    for (const task of items) {
      if (task.parent && byId.has(task.parent)) {
        const parent = byId.get(task.parent);
        parent.subtasks.push(task);
      } else {
        roots.push(task);
      }
    }

    return roots;
  }
}
