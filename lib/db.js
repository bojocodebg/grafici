import mysql from 'mysql2/promise';

const g = globalThis;
export const pool =
  g.__pulsPool ??
  (g.__pulsPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'grafici',
    connectionLimit: 10,
    dateStrings: true,
    charset: 'utf8mb4',
  }));

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}
