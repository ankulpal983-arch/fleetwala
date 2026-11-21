import { formatDistanceToNow } from 'date-fns';
import type { Job } from './types';

export const inr = (n: number) => '\u20B9' + n.toLocaleString('en-IN');
export const salaryRange = (j: Pick<Job, 'min_salary' | 'max_salary'>) =>
  `${inr(j.min_salary)} – ${j.max_salary.toLocaleString('en-IN')}`;

export { istDay } from './rules';

export const istStamp = (d: string) =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(d));

export const istDate = (d: string) =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(d));

export const ago = (d: string) => formatDistanceToNow(new Date(d), { addSuffix: true });

export const daysLeft = (d: string) =>
  Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

export function initials(name: string) {
  const parts = name.replace(/[^A-Za-z\s-]/g, '').split(/[\s-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase();
}

export function hashNum(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
