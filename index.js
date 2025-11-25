import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import express from 'express'
import cookieParser from 'cookie-parser'
import nunjucks from 'nunjucks'
import { createClient } from 'db-vendo-client'
import { profile as dbProfile } from 'db-vendo-client/p/dbnav/index.js'

import { registerHomeRoutes } from './apps/home.js'
import { registerJourneyRoutes } from './apps/journey.js'
import { registerWeatherRoutes } from './apps/weather.js'
import { registerDepartureRoutes } from './apps/departures.js'
import { registerTaskRoutes } from './apps/tasks.js'
import { registerNewsRoutes } from './apps/news.js'
import { registerPOIRoutes } from './apps/pois.js'
import { registerJoplinRoutes } from './apps/joplin.js'
import { registerBrowserRoutes } from './apps/browser.js'
import { types } from 'util'

function applyEnvPlaceholders(obj) {
  const clone = JSON.parse(JSON.stringify(obj))

  for (const key of Object.keys(clone)) {
    const value = clone[key]

    if (typeof value === 'string' && value.startsWith('ENV:')) {
      const envName = value.slice(4)
      clone[key] = process.env[envName]
    }

    if (typeof value === 'object' && value !== null) {
      clone[key] = applyEnvPlaceholders(value)
    }
  }

  return clone
}

dotenv.config({ path: path.resolve('.env') })

const configPath = path.join(process.cwd(), './config.json')
const raw = fs.readFileSync(configPath, 'utf8')
const config = JSON.parse(raw)
const resolvedConfig = applyEnvPlaceholders(config)
const app = express()

const nunjucksEnv = nunjucks.configure('views', {
  autoescape: true,
  express: app
})

nunjucksEnv.addFilter('formatDate', function (dateStr, locale = 'de-DE', options = {}) {
  try {
    const d = new Date(dateStr)
    return d.toLocaleString(locale, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      ...options
    })
  } catch {
    return dateStr
  }
})

app.set('view engine', 'njk')
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use('/public', express.static('public'))
app.use((req, res, next) => {
  const start = Date.now()
  const ua = req.headers['user-agent']

  res.on('finish', () => {
    const duration = Date.now() - start
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.url} → ${res.statusCode} (${duration}ms) - UA: ${ua}`
    )
  })

  next()
})

const client = createClient(dbProfile, 'DB-Multi')

registerHomeRoutes(app, {
  config: {
    bookmarks: resolvedConfig.bookmarks
  }
})
registerJourneyRoutes(app, {
  client: client,
  config: { favorites: resolvedConfig.transport.journey.favorites }
})
registerDepartureRoutes(app, {
  client: client,
  config: {
    labels: resolvedConfig.transport.labels,
    types: resolvedConfig.transport.types,
    favorites: resolvedConfig.transport.departures.favorites
  }
})
registerWeatherRoutes(app, { config: resolvedConfig.weather })
registerTaskRoutes(app)
registerNewsRoutes(app, { config: resolvedConfig.news })
registerPOIRoutes(app)
registerJoplinRoutes(app, { config: resolvedConfig.joplin })
registerBrowserRoutes(app, { config: resolvedConfig.browser })

app.listen(resolvedConfig.port, () => {
  console.log('Server läuft auf Port', resolvedConfig.port)

  config.routes.forEach(route => {
    console.log(
      `${route.label} (Simplified HTML): http://localhost:${resolvedConfig.port}${route.path}`
    )
  })
})
