import fetch from 'node-fetch'
import { refreshAccessToken } from '../helpers/security/google-tokens.js'

export function registerTaskRoutes(app) {
  app.get('/tasks', async (req, res) => {
    try {
      const accessToken = await refreshAccessToken()

      const lists = await fetchTaskLists(accessToken)

      const results = []

      for (const list of lists) {
        const tasks = await fetchTasksForList(list.id, accessToken)
        results.push({
          title: list.title,
          tasks
        })
      }

      res.render('tasks/index.njk', {
        lists: results
      })
    } catch (err) {
      console.error(err)
      res.send('Fehler: ' + err.message)
    }
  })
}

async function fetchTaskLists(accessToken) {
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  const data = await res.json()
  return data.items || []
}

function buildTaskTree(items = []) {
  const byId = new Map()
  const roots = []

  for (const task of items) {
    task.subtasks = []
    byId.set(task.id, task)
  }

  for (const task of items) {
    if (task.parent && byId.has(task.parent)) {
      const parent = byId.get(task.parent)
      parent.subtasks.push(task)
    } else {
      roots.push(task)
    }
  }

  return roots
}

async function fetchTasksForList(listId, accessToken) {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  const data = await res.json()

  const items = data.items || []
  const tree = buildTaskTree(items)

  return tree
}
