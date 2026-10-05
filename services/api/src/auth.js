import { betterAuth } from 'better-auth'
import { kyselyAdapter } from '@better-auth/kysely-adapter'
import { LibsqlDialect } from '@libsql/kysely-libsql'
import { Kysely } from 'kysely'
import { getMigrations } from 'better-auth/db/migration'

const databaseUrl = process.env.TURSO_DATABASE_URL || ''
const databaseToken = process.env.TURSO_AUTH_TOKEN || ''
const betterAuthSecret = process.env.BETTER_AUTH_SECRET || ''
const betterAuthUrl = process.env.BETTER_AUTH_URL || ''
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'

if (!databaseUrl || !databaseToken) {
  throw new Error('Turso is not configured')
}

if (!betterAuthSecret) {
  throw new Error('BETTER_AUTH_SECRET is not configured')
}

const database = new Kysely({
  dialect: new LibsqlDialect({
    url: databaseUrl,
    authToken: databaseToken
  })
})

const trustedOrigins = [
  allowedOrigin,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean)

export const auth = betterAuth({
  baseURL: betterAuthUrl || undefined,
  secret: betterAuthSecret,
  trustedOrigins,
  database: kyselyAdapter(database, {
    type: 'sqlite'
  }),
  emailAndPassword: {
    enabled: true
  }
})

export async function initializeAuthDatabase() {
  const { runMigrations } = await getMigrations(auth.options)
  await runMigrations()
}
