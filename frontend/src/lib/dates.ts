const MONTHS = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

export function todayISO() {
  return formatISODate(new Date());
}

export function formatISODate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseISODate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatLongDate(value: string) {
  const date = parseISODate(value);
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

export function formatMonthTitle(year: number, month: number) {
  return `${MONTHS[month]} ${year}`;
}

export function shiftDays(value: string, days: number) {
  const date = parseISODate(value);
  date.setDate(date.getDate() + days);
  return formatISODate(date);
}

export function startOfWeek(value: string) {
  const date = parseISODate(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return formatISODate(date);
}

export function weekDays(value: string) {
  const start = startOfWeek(value);
  return Array.from({ length: 7 }, (_, index) => shiftDays(start, index));
}

export function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const pad = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: Array<string | null> = Array.from({ length: pad }, () => null);
  for (let day = 1; day <= count; day += 1) {
    cells.push(formatISODate(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function formatTime(iso: string) {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function remindAtFromParts(date: string, hour: number, minute: number) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}
