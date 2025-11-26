import fs from 'fs'
import path from 'path'
import https from 'https'
import express from 'express'
import cookieParser from 'cookie-parser'

import { basicAuth } from './helpers/security/basic-auth.js'
import { setupNunjucks } from './helpers/nunjucks-setup.js'
import { loadConfig } from './helpers/config-loader.js'
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

// ────────────────────────────────────────────────────────────
// Bootstrap, Templating & DB Client
// ────────────────────────────────────────────────────────────

const config = loadConfig()
const app = express()
setupNunjucks(app)
const dbClient = createClient(dbProfile, 'DB-Multi')

// ────────────────────────────────────────────────────────────
// Middleware
// ────────────────────────────────────────────────────────────

app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use('/public', express.static('public'))

const basicAuthConfig = {
  expectedUser: process.env.BASIC_AUTH_USER,
  expectedPassword: process.env.BASIC_AUTH_PASS
}

config.routes
  .filter(r => r.isBasicAuth)
  .forEach(r => {
    app.use(r.path, basicAuth(basicAuthConfig))
  })

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

// ────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────

registerHomeRoutes(app, {
  config: { bookmarks: config.bookmarks }
})

registerJourneyRoutes(app, {
  client: dbClient,
  config: { favorites: config.transport.journey.favorites }
})

registerDepartureRoutes(app, {
  client: dbClient,
  config: {
    labels: config.transport.labels,
    types: config.transport.types,
    favorites: config.transport.departures.favorites
  }
})

registerWeatherRoutes(app, { config: config.weather })
registerTaskRoutes(app)
registerNewsRoutes(app, { config: config.news })
registerPOIRoutes(app, { config: config.poi })
registerJoplinRoutes(app, { config: config.joplin })
registerBrowserRoutes(app, { config: config.browser })

// ────────────────────────────────────────────────────────────
// HTTPS-Server
// ────────────────────────────────────────────────────────────

const ROOT_DIR = process.cwd()

const httpsOptions = {
  key: fs.readFileSync(path.join(ROOT_DIR, 'certs', 'server.key')),
  cert: fs.readFileSync(path.join(ROOT_DIR, 'certs', 'server.crt'))
}

https.createServer(httpsOptions, app).listen(config.port, () => {
  console.log('HTTPS-Server läuft auf Port', config.port)

  config.routes.forEach(route => {
    console.log(`${route.label} (Simplified HTML): https://localhost:${config.port}${route.path}`)
  })
})
