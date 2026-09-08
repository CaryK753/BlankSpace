import {asc, eq} from 'drizzle-orm';
import {drizzle} from 'drizzle-orm/node-postgres';
import {integer, pgSchema, text, uuid} from 'drizzle-orm/pg-core';
import {Kysely, PostgresDialect} from 'kysely';
import {FIXTURE} from './constants.mjs';

const alpha = pgSchema('kit_alpha');
const items = alpha.table('items', {
  itemId: uuid('item_id').primaryKey(),
  label: text('label').notNull(),
  revision: integer('revision').notNull(),
});

export async function createFixture(pool) {
  await pool.query(`
    CREATE SCHEMA kit_alpha;
    CREATE SCHEMA kit_beta;
    CREATE SCHEMA blankspace_migrations;
    CREATE TABLE kit_alpha.items (
      item_id uuid PRIMARY KEY,
      label text NOT NULL,
      revision integer NOT NULL CHECK (revision >= 0)
    );
    CREATE TABLE kit_beta.links (
      link_id uuid PRIMARY KEY,
      alpha_item_id uuid NOT NULL,
      kind text NOT NULL
    );
  `);
}

async function resetAlpha(pool) {
  await pool.query('TRUNCATE kit_alpha.items');
  for (const row of FIXTURE.alphaRows) {
    await pool.query(
      'INSERT INTO kit_alpha.items (item_id, label, revision) VALUES ($1, $2, $3)',
      [row.itemId, row.label, row.revision],
    );
  }
}

function wireRow(row) {
  return {itemId: row.itemId, label: row.label, revision: row.revision};
}

export async function runDirect(pool) {
  await resetAlpha(pool);
  const statements = [
    {text: 'INSERT INTO kit_alpha.items (item_id, label, revision) VALUES ($1, $2, $3)', values: [
      '00000000-0000-4000-8000-000000000003', 'alpha-three', 0,
    ]},
    {text: 'UPDATE kit_alpha.items SET revision = revision + $1 WHERE item_id = $2', values: [
      1, '00000000-0000-4000-8000-000000000001',
    ]},
    {text: 'SELECT item_id AS "itemId", label, revision FROM kit_alpha.items ORDER BY item_id', values: []},
  ];
  await pool.query(statements[0]);
  await pool.query(statements[1]);
  const result = await pool.query(statements[2]);
  return candidateResult('direct', result.rows.map(wireRow), statements);
}

export async function runKysely(pool) {
  await resetAlpha(pool);
  const db = new Kysely({dialect: new PostgresDialect({pool})}).withSchema('kit_alpha');
  const insert = db.insertInto('items').values({
    item_id: '00000000-0000-4000-8000-000000000003', label: 'alpha-three', revision: 0,
  });
  const update = db.updateTable('items').set(({eb}) => ({revision: eb('revision', '+', 1)}))
    .where('item_id', '=', '00000000-0000-4000-8000-000000000001');
  const select = db.selectFrom('items').select([
    'item_id as itemId', 'label', 'revision',
  ]).orderBy('item_id');
  const statements = [insert.compile(), update.compile(), select.compile()];
  await insert.execute();
  await update.execute();
  const rows = await select.execute();
  return candidateResult('kysely', rows.map(wireRow), statements);
}

export async function runDrizzle(pool) {
  await resetAlpha(pool);
  const db = drizzle(pool);
  const insert = db.insert(items).values({
    itemId: '00000000-0000-4000-8000-000000000003', label: 'alpha-three', revision: 0,
  });
  const firstId = '00000000-0000-4000-8000-000000000001';
  const update = db.update(items).set({revision: 1}).where(eq(items.itemId, firstId));
  const select = db.select({
    itemId: items.itemId, label: items.label, revision: items.revision,
  }).from(items).orderBy(asc(items.itemId));
  const statements = [insert.toSQL(), update.toSQL(), select.toSQL()];
  await insert;
  await update;
  const rows = await select;
  return candidateResult('drizzle', rows.map(wireRow), statements);
}

function candidateResult(candidate, rows, statements) {
  const operations = ['insert', 'update', 'select'];
  return {
    candidate,
    rows,
    sqlIntent: statements.map((statement, index) => {
      const parameters = statement.parameters ?? statement.params ?? statement.values;
      return {
        operation: operations[index],
        parameterCount: parameters.length,
        parameterized: parameters.length === 0 || /\$1\b/.test(statement.sql ?? statement.text),
        schema: 'kit_alpha',
      };
    }),
  };
}
