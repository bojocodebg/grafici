// Инициализация на базата: създава таблиците и начални данни (админ, смени, аптека).
// Стартиране: npm run db:init
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

// Зареждане на .env.local (без външни зависимости)
for (const f of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const cfg = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
  charset: 'utf8mb4',
};

const conn = await mysql.createConnection(cfg);
const schema = fs.readFileSync(path.resolve(process.cwd(), 'sql/schema.sql'), 'utf8');
await conn.query(schema);
await conn.query(`USE \`${process.env.DB_NAME || 'grafici'}\``);
console.log('✔ Таблиците са създадени.');

const [[{ c: pc }]] = await conn.query('SELECT COUNT(*) c FROM pharmacies');
if (pc === 0) {
  await conn.query(
    'INSERT INTO pharmacies (name, address, phone) VALUES (?,?,?), (?,?,?)',
    ['Пулс – Център', 'ул. Примерна 1', '0888 000 001', 'Пулс – Младост', 'бул. Примерен 25', '0888 000 002']
  );
  console.log('✔ Добавени примерни аптеки.');
}

const [[{ c: sc }]] = await conn.query('SELECT COUNT(*) c FROM shift_types');
if (sc === 0) {
  await conn.query(
    `INSERT INTO shift_types (code, name, start_time, end_time, hours, color) VALUES
     ('Д', 'Дневна смяна', '08:00', '20:00', 12, '#4caf50'),
     ('Н', 'Нощна смяна', '20:00', '08:00', 12, '#3f51b5'),
     ('С', 'Сутрешна смяна', '08:00', '16:00', 8, '#8bc34a'),
     ('В', 'Вечерна смяна', '14:00', '22:00', 8, '#ff9800'),
     ('П', 'Почивка', NULL, NULL, 0, '#9e9e9e')`
  );
  console.log('✔ Добавени типове смени.');
}

const [[{ c: uc }]] = await conn.query('SELECT COUNT(*) c FROM users WHERE username = ?', ['admin']);
if (uc === 0) {
  const hash = await bcrypt.hash('admin123', 10);
  await conn.query(
    'INSERT INTO users (username, password_hash, full_name, position, is_admin) VALUES (?,?,?,?,1)',
    ['admin', hash, 'Администратор', 'Управител']
  );
  console.log('✔ Създаден администратор: admin / admin123 (сменете паролата след вход!)');
}

await conn.end();
console.log('Готово.');
