// Браузърът съобщава, че потребителят е активен. Самото подновяване на сесията
// се прави в proxy.js; тук само потвърждаваме и връщаме актуалната настройка.
import { getCurrentUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const s = await getSettings();
  return Response.json({ ok: true, timeout: s.session_timeout_minutes * 60, warning: s.session_warning_seconds });
}
