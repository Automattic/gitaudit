// A stand-in for a Spacefast space's env.DB, on a local MariaDB. It enforces the
// platform's limits, so a query that would fail there fails here first.
import mysql from 'mysql2/promise';

const MAX_PARAMETERS = 256;
const MAX_OPERATION_BYTES = 65536;

function assertWithinLimits(statements) {
  let bytes = 0;

  for (const { sql, params } of statements) {
    if (params.length > MAX_PARAMETERS) {
      throw new Error(
        `Database statement has ${params.length} bound parameters; the limit is ${MAX_PARAMETERS}.`
      );
    }
    if (params.includes(undefined)) {
      throw new Error('Database statement has an undefined bound parameter.');
    }
    bytes += Buffer.byteLength(sql) + params.reduce((sum, p) => sum + Buffer.byteLength(String(p)), 0);
  }

  if (bytes > MAX_OPERATION_BYTES) {
    throw new Error(`Database operation is ${bytes} bytes; the limit is ${MAX_OPERATION_BYTES}.`);
  }
}

export function createLocalDb(url) {
  const pool = mysql.createPool({ uri: url, decimalNumbers: true, supportBigNumbers: true });

  const prepared = (sql, params = []) => ({
    sql,
    params,
    bind: (...values) => prepared(sql, values),
    async run() {
      assertWithinLimits([{ sql, params }]);
      const [result] = await pool.query(sql, params);
      return result;
    },
    async all() {
      assertWithinLimits([{ sql, params }]);
      const [results] = await pool.query(sql, params);
      return { results };
    },
    async first() {
      assertWithinLimits([{ sql, params }]);
      const [rows] = await pool.query(sql, params);
      return rows[0] ?? null;
    },
  });

  return {
    prepare: (sql) => prepared(sql),

    async batch(statements) {
      assertWithinLimits(statements);
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();
        const results = [];
        for (const { sql, params } of statements) {
          results.push((await connection.query(sql, params))[0]);
        }
        await connection.commit();
        return results;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    query: (sql, params) => pool.query(sql, params),
    close: () => pool.end(),
  };
}
