import { randomBytes } from 'node:crypto'
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

async function createFallbackUsername(email) {
  const authDatabase = getDatabase()
  const emailPrefix = email.split('@')[0]
  const base = emailPrefix
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20) || 'user'

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = normalizeUsername(
      base + '_' + randomBytes(4).toString('hex')
    )
    const statement = await authDatabase.prepare(
      'SELECT id FROM "user" WHERE lower(username) = lower(?) LIMIT 1'
    )
    const rows = await statement.all([candidate])

    if (!rows.length) {
      return candidate
    }
  }

  throw new APIError('INTERNAL_SERVER_ERROR', {
    message: 'ユーザー名を発行できませんでした。もう一度お試しください。'
  })
}

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
  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: false,
        input: true
      }
    }
  },
  emailAndPassword: {
    enabled: true
  },
  databaseHooks: {
    user: {
      create: {
        before: async user => {
          let name
          let email
          let username

          try {
            email = normalizeEmailAddress(user.email)
            name = typeof user.name === 'string' ? user.name.trim() : ''

            if (
              !name ||
              name.length > 80 ||
              /[\u0000-\u001f\u007f]/.test(name)
            ) {
              throw new Error('表示名は1〜80文字で入力してください。')
            }

            username = user.username
              ? normalizeUsername(user.username)
              : await createFallbackUsername(email)
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

          const usernameMatches = await authDatabase.prepare(
            'SELECT id FROM "user" WHERE lower(username) = lower(?) LIMIT 1'
          )
          const existingUsernames = await usernameMatches.all([username])

          if (existingUsernames.length) {
            throw new APIError('BAD_REQUEST', {
              message: 'このユーザー名はすでに使用されています。'
            })
          }

          return {
            data: {
              ...user,
              name,
              username,
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
      username TEXT,
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
    )`,
    `CREATE TABLE IF NOT EXISTS user_bans (
      user_id TEXT PRIMARY KEY NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      banned_at INTEGER NOT NULL,
      banned_by TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      target_user_id TEXT,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    )`
  ], 'immediate')

  try {
    await database.execute({
      sql: 'ALTER TABLE "user" ADD COLUMN username TEXT',
      args: []
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (!/duplicate column name|already exists/i.test(message)) {
      throw error
    }
  }

  await database.batch([
    {
      sql: `UPDATE "user"
        SET username = 'maru_m4ru_maru'
        WHERE lower(email) = lower(?)
          AND (username IS NULL OR username = '')`,
      args: ['code-maru@outlook.jp']
    },
    {
      sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_username_nocase ON "user"(username COLLATE NOCASE) WHERE username IS NOT NULL AND username != ""'
    },
    {
      sql: 'CREATE INDEX IF NOT EXISTS idx_user_bans_banned_at ON user_bans(banned_at)'
    },
    {
      sql: 'CREATE INDEX IF NOT EXISTS idx_announcements_active_created_at ON announcements(active, created_at)'
    },
    {
      sql: 'CREATE INDEX IF NOT EXISTS idx_announcements_target_user ON announcements(target_user_id)'
    }
  ], 'immediate')
}
