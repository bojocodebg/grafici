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

// --- Миграции за бази, създадени с по-стара версия ---
const hasCol = async (table, col) => {
  const [r] = await conn.query(
    'SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, col]
  );
  return r[0].c > 0;
};
if (!(await hasCol('users', 'position_id'))) {
  await conn.query('ALTER TABLE users ADD COLUMN position_id INT NULL AFTER full_name');
  await conn.query('ALTER TABLE users ADD CONSTRAINT fk_users_position FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL');
  console.log('✔ Миграция: добавена колона users.position_id');
}
if (!(await hasCol('shift_types', 'sort_order'))) {
  await conn.query('ALTER TABLE shift_types ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER color');
  await conn.query('UPDATE shift_types SET sort_order = id'); // запазва досегашната подредба
  console.log('✔ Миграция: добавена подредба (sort_order) на типовете смени');
}
if (!(await hasCol('positions', 'all_pharmacies'))) {
  await conn.query('ALTER TABLE positions ADD COLUMN all_pharmacies TINYINT(1) NOT NULL DEFAULT 0 AFTER sort_order');
  await conn.query("UPDATE positions SET all_pharmacies = 1 WHERE name = 'Управител'");
  console.log('✔ Миграция: длъжностите могат да работят във всички аптеки („Управител“ – включено)');
}
if (!(await hasCol('users', 'show_in_schedule'))) {
  await conn.query('ALTER TABLE users ADD COLUMN show_in_schedule TINYINT(1) NOT NULL DEFAULT 1 AFTER is_admin');
  await conn.query("UPDATE users SET show_in_schedule = 0 WHERE username = 'admin'");
  console.log('✔ Миграция: служебният акаунт admin вече не се показва в графиците');
}
if (await hasCol('users', 'position')) {
  // Старите текстови длъжности стават записи в таблицата "positions"
  await conn.query("INSERT IGNORE INTO positions (name) SELECT DISTINCT TRIM(position) FROM users WHERE position IS NOT NULL AND TRIM(position) <> ''");
  await conn.query('UPDATE users u JOIN positions p ON p.name = TRIM(u.position) SET u.position_id = p.id WHERE u.position_id IS NULL');
  await conn.query('ALTER TABLE users DROP COLUMN position');
  console.log('✔ Миграция: длъжностите са преместени в таблица positions');
}

const [[{ c: pc }]] = await conn.query('SELECT COUNT(*) c FROM pharmacies');
if (pc === 0) {
  await conn.query(
    'INSERT INTO pharmacies (name, address, phone) VALUES (?,?,?), (?,?,?)',
    ['Пулс – Център', 'ул. Примерна 1', '0888 000 001', 'Пулс – Младост', 'бул. Примерен 25', '0888 000 002']
  );
  console.log('✔ Добавени примерни аптеки.');
}

const [[{ c: posc }]] = await conn.query('SELECT COUNT(*) c FROM positions');
if (posc === 0) {
  await conn.query(
    `INSERT INTO positions (name, sort_order, all_pharmacies) VALUES
     ('Управител', 1, 1), ('Магистър фармацевт', 2, 0), ('Помощник-фармацевт', 3, 0), ('Санитар', 4, 0)`
  );
  console.log('✔ Добавени длъжности.');
}

const [[{ c: sc }]] = await conn.query('SELECT COUNT(*) c FROM shift_types');
if (sc === 0) {
  await conn.query(
    `INSERT INTO shift_types (code, name, start_time, end_time, hours, color, sort_order) VALUES
     ('Д', 'Дневна смяна', '08:00', '20:00', 12, '#4caf50', 1),
     ('Н', 'Нощна смяна', '20:00', '08:00', 12, '#3f51b5', 2),
     ('С', 'Сутрешна смяна', '08:00', '16:00', 8, '#8bc34a', 3),
     ('В', 'Вечерна смяна', '14:00', '22:00', 8, '#ff9800', 4),
     ('П', 'Почивка', NULL, NULL, 0, '#9e9e9e', 5)`
  );
  console.log('✔ Добавени типове смени.');
}

const [[{ c: uc }]] = await conn.query('SELECT COUNT(*) c FROM users WHERE username = ?', ['admin']);
if (uc === 0) {
  const hash = await bcrypt.hash('admin123', 10);
  await conn.query(
    "INSERT INTO users (username, password_hash, full_name, position_id, is_admin, show_in_schedule) VALUES (?,?,?,(SELECT id FROM positions WHERE name = 'Управител'),1,0)",
    ['admin', hash, 'Администратор']
  );
  console.log('✔ Създаден администратор: admin / admin123 (сменете паролата след вход!)');
}

await conn.end();
console.log('Готово.');
