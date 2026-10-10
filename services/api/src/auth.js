import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import {
  normalizeEmailAddress,
  normalizeUsername
} from './registrationPolicy.js'
import { kyselyAdapter } from '@better-auth/kysely-adapter'
import { LibsqlDialect } from '@libsql/kysely-libsql'
import { Kysely } from 'kysely'
import { getDatabase } from './turso.js'

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
  advanced: {
    ipAddress: {
      ipAddressHeaders: ['cf-connecting-ip']
    }
  },
  database: kyselyAdapter(database, {
    type: 'sqlite'
  }),
  emailAndPassword: {
    enabled: true
  },
  databaseHooks: {
    user: {
      create: {
        before: async user => {
          let name
          let email

          try {
            name = normalizeUsername(user.name)
            email = normalizeEmailAddress(user.email)
          } catch (error) {
            throw new APIError('BAD_REQUEST', {
              message: error instanceof Error
                ? error.message
                : '登録情報を確認してください。'
            })
          }

          const authDatabase = getDatabase()
          const emailMatches = await authDatabase.prepare(
            'SELECT id FROM "user" WHERE lower(email) = lower(?) LIMIT 1'
          )
          const existingEmails = await emailMatches.all([email])

          if (existingEmails.length) {
            throw new APIError('BAD_REQUEST', {
              message: 'このメールアドレスはすでに登録されています。'
            })
          }

          const nameMatches = await authDatabase.prepare(
            'SELECT id FROM "user" WHERE lower(name) = lower(?) LIMIT 1'
          )
          const existingNames = await nameMatches.all([name])

          if (existingNames.length) {
            throw new APIError('BAD_REQUEST', {
              message: 'このユーザー名はすでに使用されています。'
            })
          }

          return {
            data: {
              ...user,
              name,
              email
            }
          }
        }
      }
    },
    session: {
      create: {
        before: async session => {
          const authDatabase = getDatabase()
          const bannedStatement = await authDatabase.prepare(
            'SELECT user_id FROM user_bans WHERE user_id = ? LIMIT 1'
          )
          const bannedUsers = await bannedStatement.all([session.userId])

          if (bannedUsers.length) {
            throw new APIError('FORBIDDEN', {
              message: 'このアカウントは停止されています。運営へお問い合わせください。'
            })
          }

          return {
            data: session
          }
        }
      }
    }
  }
})

export async function initializeAuthDatabase() {
  const database = getDatabase()

  await database.batch([
    `CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      emailVerified BOOLEAN NOT NULL,
      image TEXT,
      createdAt TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "session" (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expiresAt TIMESTAMP NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      createdAt TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP NOT NULL,
      FOREIGN KEY (userId) REFERENCES "user"(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "account" (
      id TEXT PRIMARY KEY NOT NULL,
      userId TEXT NOT NULL,
      accountId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      accessToken TEXT,
      refreshToken TEXT,
      idToken TEXT,
      accessTokenExpiresAt TIMESTAMP,
      refreshTokenExpiresAt TIMESTAMP,
      scope TEXT,
      password TEXT,
      createdAt TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP NOT NULL,
      FOREIGN KEY (userId) REFERENCES "user"(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "verification" (
      id TEXT PRIMARY KEY NOT NULL,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expiresAt TIMESTAMP NOT NULL,
      createdAt TIMESTAMP,
      updatedAt TIMESTAMP
    )`
  ], 'immediate')
}
