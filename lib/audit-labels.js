// Етикети за журнала (използват се и в страницата с филтрите)
export const ACTIONS = {
  login: 'Вход',
  login_failed: 'Неуспешен вход',
  logout: 'Изход',
  create: 'Добавяне',
  update: 'Редакция',
  delete: 'Изтриване',
  approve: 'Одобряване',
  reject: 'Отказ',
  reopen: 'Връщане за преглед',
  reply: 'Отговор',
  seen: 'Прегледана',
  copy: 'Копиране',
  clear: 'Изчистване',
  password: 'Смяна на парола',
  export: 'Експорт',
};

export const ENTITIES = {
  auth: 'Вход / изход',
  shift: 'Смяна в графика',
  schedule: 'График (масово)',
  note: 'Забележка',
  leave: 'Отпуск',
  user: 'Потребител',
  pharmacy: 'Аптека',
  shift_type: 'Тип смяна',
  position: 'Длъжност',
  profile: 'Профил',
  audit: 'Журнал',
};

// Цвят на значката по вид действие
export const ACTION_TONE = {
  login: 'ok', logout: '', login_failed: 'bad',
  create: 'ok', update: 'warn', delete: 'bad', clear: 'bad',
  approve: 'ok', reject: 'bad', reopen: 'warn', reply: '', seen: '', copy: '', password: 'warn', export: '',
};
