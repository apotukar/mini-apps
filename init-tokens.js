import http from 'http'
import url from 'url'
import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Fehler: GOOGLE_CLIENT_ID oder GOOGLE_CLIENT_SECRET fehlen in der .env')
  process.exit(1)
}

const PORT = 3000
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`
const TOKENS_FILE = path.join(process.cwd(), 'token.json')

function buildAuthUrl() {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/tasks.readonly')
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  return authUrl.toString()
}

async function exchangeCodeForTokens(code) {
  const params = new URLSearchParams()
  params.append('code', code)
  params.append('client_id', CLIENT_ID)
  params.append('client_secret', CLIENT_SECRET)
  params.append('redirect_uri', REDIRECT_URI)
  params.append('grant_type', 'authorization_code')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  })

  const data = await res.json()

  if (!data.refresh_token || !data.access_token) {
    console.error('Antwort von Google:', data)
    throw new Error('Konnte kein refresh_token/access_token erhalten')
  }

  const out = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    access_token: data.access_token,
    refresh_token: data.refresh_token
  }

  fs.writeFileSync(TOKENS_FILE, JSON.stringify(out, null, 2), 'utf8')
  console.log('token.json gespeichert unter:', TOKENS_FILE)
}

function startServer() {
  const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true)

    if (parsed.pathname !== '/oauth2callback') {
      res.statusCode = 404
      res.end('Not found')
      return
    }

    const code = parsed.query.code
    if (!code) {
      res.statusCode = 400
      res.end('Kein "code" gefunden')
      return
    }

    try {
      await exchangeCodeForTokens(code)
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Token gespeichert. Du kannst dieses Fenster schließen.')
      server.close()
    } catch (err) {
      console.error(err)
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Fehler: ' + err.message)
    }
  })

  server.listen(PORT, () => {
    console.log('OAuth Callback Server:', REDIRECT_URI)
    console.log('Öffne diese URL im Browser:\n')
    console.log(buildAuthUrl())
    console.log('\nNach Login wird token.json geschrieben nach:\n' + TOKENS_FILE)
  })
}

startServer()
