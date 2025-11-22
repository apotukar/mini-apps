import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TOKENS_FILE = path.join(__dirname, '..', 'token.json')

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

function loadTokens() {
  if (!fs.existsSync(TOKENS_FILE)) {
    throw new Error('tokens.json nicht gefunden! Bitte OAuth einmal durchlaufen.')
  }
  const json = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'))
  return json
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2))
}

async function refreshAccessToken() {
  const tokens = loadTokens()

  const params = new URLSearchParams()
  params.append('client_id', tokens.client_id)
  params.append('client_secret', tokens.client_secret)
  params.append('refresh_token', tokens.refresh_token)
  params.append('grant_type', 'refresh_token')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  })
  const data = await res.json()

  if (!data.access_token) {
    console.error('Google returned:', data)
    throw new Error('Konnte kein Access Token erhalten')
  }

  tokens.access_token = data.access_token
  saveTokens(tokens)

  return data.access_token
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
