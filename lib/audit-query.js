import 'server-only';
import { query } from './db';

export const PAGE_SIZE = 50;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Построява WHERE от филтрите в адреса (общо за страницата и за експорта)
export function buildFilter(sp) {
  const where = [], params = [];
  const uid = Number(sp.u);
  if (uid) { where.push('a.user_id = ?'); params.push(uid); }
  else if (sp.u === 'none') where.push('a.user_id IS NULL');
  if (sp.e) { where.push('a.entity = ?'); params.push(String(sp.e)); }
  if (sp.act) { where.push('a.action = ?'); params.push(String(sp.act)); }
  if (ISO.test(sp.from || '')) { where.push('a.created_at >= ?'); params.push(sp.from + ' 00:00:00'); }
  if (ISO.test(sp.to || '')) { where.push('a.created_at <= ?'); params.push(sp.to + ' 23:59:59'); }
  const q = String(sp.q || '').trim();
  if (q) {
    where.push('(a.summary LIKE ? OR a.changes LIKE ? OR a.username LIKE ? OR a.full_name LIKE ? OR a.ip LIKE ?)');
    const like = `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
    params.push(like, like, like, like, like);
  }
  return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
}

export async function fetchLog(sp, { limit = PAGE_SIZE, offset = 0 } = {}) {
  const { sql, params } = buildFilter(sp);
  const rows = await query(
    `SELECT a.*, u.full_name current_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
     ${sql} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [{ total }] = await query(`SELECT COUNT(*) total FROM audit_log a ${sql}`, params);
  return { rows, total };
}

// Кратко описание на браузъра/устройството от User-Agent
export function device(ua) {
  if (!ua) return '';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : '';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  const mobile = /Mobi|Android|iPhone/i.test(ua) ? ' (мобилен)' : '';
  return [br, os].filter(Boolean).join(', ') + mobile || ua.slice(0, 40);
}
