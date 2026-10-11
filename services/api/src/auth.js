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
import { ensureUserUsernameColumn } from './authSchema.js'
import { getOriginPolicy } from './authPolicy.js'

const databaseUrl = process.env.TURSO_DATABASE_URL || ''
const databaseToken = process.env.TURSO_AUTH_TOKEN || ''
const betterAuthSecret = process.env.BETTER_AUTH_SECRET || ''
const betterAuthUrl = process.env.BETTER_AUTH_URL || ''
const runtimeEnvironment = process.env.NODE_ENV === 'production' || process.env.RENDER_GIT_COMMIT
  ? 'production'
  : 'development'
const allowedOrigin = process.env.CORS_ORIGIN || (
  runtimeEnvironment === 'production' ? '' : 'http://localhost:5173'
)

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

const trustedOrigins = getOriginPolicy(allowedOrigin, runtimeEnvironment).allowedOrigins

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

  await ensureUserUsernameColumn(database)

  const adminUsername = 'maru_m4ru_maru'
  const adminUserStatement = await database.prepare(
    'SELECT id FROM "user" WHERE lower(email) = lower(?) LIMIT 1'
  )
  const adminUsers = await adminUserStatement.all(['code-maru@outlook.jp'])

  if (adminUsers.length) {
    const usernameConflictStatement = await database.prepare(
      'SELECT id FROM "user" WHERE lower(username) = lower(?) AND id != ? LIMIT 1'
    )
    const usernameConflicts = await usernameConflictStatement.all([
      adminUsername,
      adminUsers[0].id
    ])

    if (!usernameConflicts.length) {
      await database.batch([
        {
          sql: `UPDATE "user"
            SET username = ?
            WHERE id = ?
              AND (username IS NULL OR username = '')`,
          args: [adminUsername, adminUsers[0].id]
        }
      ], 'immediate')
    }
  }

  await database.batch([
    {
      sql: 'CREATE INDEX IF NOT EXISTS idx_user_bans_banned_at ON user_bans(banned_at)'
    },
    {
      sql: 'CREATE INDEX IF NOT EXISTS idx_announcements_active_created_at ON announcements(active, created_at)'
    },
    {
      sql: 'CREATE INDEX IF NOT EXISTS idx_announcements_target_user ON announcements(target_user_id)'
    },
    {
      sql: `CREATE TRIGGER IF NOT EXISTS trg_user_username_nocase_insert
        BEFORE INSERT ON "user"
        WHEN NEW.username IS NOT NULL AND NEW.username != ''
          AND EXISTS (
            SELECT 1 FROM "user"
            WHERE lower(username) = lower(NEW.username)
          )
        BEGIN
          SELECT RAISE(ABORT, 'username already exists');
        END`
    },
    {
      sql: `CREATE TRIGGER IF NOT EXISTS trg_user_username_nocase_update
        BEFORE UPDATE OF username ON "user"
        WHEN NEW.username IS NOT NULL AND NEW.username != ''
          AND EXISTS (
            SELECT 1 FROM "user"
            WHERE id != NEW.id AND lower(username) = lower(NEW.username)
          )
        BEGIN
          SELECT RAISE(ABORT, 'username already exists');
        END`
    },
    {
      sql: `CREATE TRIGGER IF NOT EXISTS trg_user_email_nocase_insert
        BEFORE INSERT ON "user"
        WHEN EXISTS (
          SELECT 1 FROM "user"
          WHERE lower(email) = lower(NEW.email)
        )
        BEGIN
          SELECT RAISE(ABORT, 'user email already exists');
        END`
    },
    {
      sql: `CREATE TRIGGER IF NOT EXISTS trg_user_email_nocase_update
        BEFORE UPDATE OF email ON "user"
        WHEN EXISTS (
          SELECT 1 FROM "user"
          WHERE id != NEW.id AND lower(email) = lower(NEW.email)
        )
        BEGIN
          SELECT RAISE(ABORT, 'user email already exists');
        END`
    }
  ], 'immediate')

  const duplicateUsernames = await database.prepare(
    `SELECT lower(username) AS normalized_username
     FROM "user"
     WHERE username IS NOT NULL AND username != ''
     GROUP BY lower(username)
     HAVING COUNT(*) > 1
     LIMIT 1`
  )
  const duplicateUsernameRows = await duplicateUsernames.all()

  if (duplicateUsernameRows.length) {
    console.warn('A case-insensitive username index was not created because duplicate usernames already exist.')
  } else {
    await database.batch([
      {
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_username_nocase
          ON "user"(username COLLATE NOCASE)
          WHERE username IS NOT NULL AND username != ''`
      }
    ], 'immediate')
  }

  const duplicateEmails = await database.prepare(
    `SELECT lower(email) AS normalized_email
     FROM "user"
     GROUP BY lower(email)
     HAVING COUNT(*) > 1
     LIMIT 1`
  )
  const duplicateEmailRows = await duplicateEmails.all()

  if (duplicateEmailRows.length) {
    console.warn('A case-insensitive email index was not created because duplicate email addresses already exist.')
  } else {
    await database.batch([
      {
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email_nocase
          ON "user"(email COLLATE NOCASE)`
      }
    ], 'immediate')
  }
}
