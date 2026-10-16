export async function ensureUserUsernameColumn(database) {
  let columnsStatement = await database.prepare('PRAGMA table_info("user")')
  let columns = await columnsStatement.all()

  if (!columns.some(column => column.name === 'username')) {
    await database.batch([
      {
        sql: 'ALTER TABLE "user" ADD COLUMN username TEXT',
        args: []
      }
    ], 'immediate')

    columnsStatement = await database.prepare('PRAGMA table_info("user")')
    columns = await columnsStatement.all()
  }

  if (!columns.some(column => column.name === 'username')) {
    throw new Error('Database migration failed: user.username column is missing')
  }
}


export async function ensureUserPolicyColumns(database) {
  const requiredColumns = [
    ['termsAccepted', 'BOOLEAN NOT NULL DEFAULT 0'],
    ['privacyPolicyAccepted', 'BOOLEAN NOT NULL DEFAULT 0'],
    ['termsAcceptedAt', 'TEXT'],
    ['privacyPolicyAcceptedAt', 'TEXT'],
    ['termsVersion', 'TEXT'],
    ['privacyPolicyVersion', 'TEXT']
  ]

  let statement = await database.prepare('PRAGMA table_info("user")')
  let columns = await statement.all()
  const columnNames = new Set(columns.map(column => column.name))

  for (const [name, definition] of requiredColumns) {
    if (columnNames.has(name)) continue

    await database.batch([
      {
        sql: 'ALTER TABLE "user" ADD COLUMN ' + name + ' ' + definition,
        args: []
      }
    ], 'immediate')

    statement = await database.prepare('PRAGMA table_info("user")')
    columns = await statement.all()
    columns.forEach(column => columnNames.add(column.name))
  }

  const missingColumns = requiredColumns
    .map(([name]) => name)
    .filter(name => !columnNames.has(name))

  if (missingColumns.length) {
    throw new Error('Database migration failed: user consent columns are missing: ' + missingColumns.join(', '))
  }
}
