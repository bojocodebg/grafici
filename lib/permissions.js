// Права, които администраторът може да дава на всеки потребител поотделно.
// Всеки активен потребител (работник) по подразбиране може:
//  - да вижда графика на своята аптека (само за четене),
//  - да пише забележки,
//  - да подава заявки за отпуск.
export const PERMISSIONS = {
  'schedule.view_all': 'Преглед на графиците на всички аптеки',
  'schedule.edit': 'Създаване и редакция на графици',
  'leave.approve': 'Одобряване / отказ на заявки за отпуск',
  'notes.manage': 'Преглед и отговор на забележки на всички',
  'users.manage': 'Управление на потребители и права',
  'pharmacies.manage': 'Управление на аптеки и типове смени',
};

export const PERMISSION_KEYS = Object.keys(PERMISSIONS);

export function can(user, perm) {
  if (!user) return false;
  return !!user.is_admin || user.permissions.includes(perm);
}
