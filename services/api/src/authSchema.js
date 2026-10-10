export async function ensureUserUsernameColumn(database) {
  let columnsStatement = await database.prepare('PRAGMA table_info("user")')
  let columns = await columnsStatement.all()

  if (!columns.some(column => column.name === 'username')) {
    await database.execute({
      sql: 'ALTER TABLE "user" ADD COLUMN username TEXT',
      args: []
    })

    columnsStatement = await database.prepare('PRAGMA table_info("user")')
    columns = await columnsStatement.all()
  }

  if (!columns.some(column => column.name === 'username')) {
    throw new Error('Database migration failed: user.username column is missing')
  }
}
