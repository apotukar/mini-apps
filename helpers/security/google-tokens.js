// tokens.js
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import fetch from 'node-fetch'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TOKEN_FILE = path.join(__dirname, '..', '..', 'token.json')

function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) {
    throw new Error('tokens.json nicht gefunden! Bitte OAuth einmal durchlaufen.')
  }
  const json = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'))
  return json
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2))
}

export async function refreshAccessToken() {
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

    if (data.error === 'invalid_grant') {
      throw new Error(
        'Refresh Token ist abgelaufen oder wurde widerrufen. Bitte OAuth erneut durchlaufen und token.json aktualisieren.'
      )
    }

    throw new Error('Konnte kein Access Token erhalten')
  }

  tokens.access_token = data.access_token
  saveTokens(tokens)

  return data.access_token
}
