import { useMemo, useState } from 'react';
import type { Person } from '../types';

type Props = { people: Person[]; value: string; onChange: (value: string) => void; placeholder?: string };
const readStoredPeople = (): Person[] => { try { const raw = localStorage.getItem('ait_people_v2'); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : []; } catch { return []; } };

export default function EmployeeMentionInput({ people, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const availablePeople = useMemo(() => people.length ? people : readStoredPeople(), [people]);
  const matches = useMemo(() => {
    const m = value.match(/(?:^|\s)@([^\s]*)$/);
    if (!m) return [];
    const q = m[1].toLowerCase();
    return availablePeople.filter(p => (p.name || '').toLowerCase().includes(q)).slice(0, 8);
  }, [availablePeople, value]);
  const select = (person: Person) => {
    onChange(value.replace(/@[^\s]*$/, `@${person.name} `));
    setOpen(false);
  };
  return <div className="relative">
    <textarea value={value} onChange={e => { onChange(e.target.value); setOpen(/(?:^|\s)@[^\s]*$/.test(e.target.value)); }} onFocus={() => setOpen(/(?:^|\s)@[^\s]*$/.test(value))} placeholder={placeholder || '輸入訊息；使用 @員工 指派處理人員'} className="w-full rounded-xl border border-[#DDD8CE] bg-white px-3 py-2 text-sm outline-none" />
    {open && matches.length > 0 && <div className="absolute z-20 bottom-full left-0 mb-1 w-full max-h-52 overflow-auto rounded-xl border border-[#E5E2DC] bg-white shadow-lg">{matches.map(p => <button key={p.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => select(p)} className="block w-full px-3 py-2 text-left text-sm hover:bg-[#F3F5F2]"><b>@{p.name}</b>{p.role ? <span className="ml-2 text-xs text-[#7A837D]">{p.role}</span> : null}</button>)}</div>}
    {open && matches.length === 0 && /(?:^|\s)@[^\s]*$/.test(value) && <div className="absolute z-20 bottom-full left-0 mb-1 w-full rounded-xl border border-[#E5E2DC] bg-white p-3 text-xs text-[#8C938D] shadow-lg">找不到這個員工。請先在「人員」資料中建立，再使用 @ 指派。</div>}
  </div>;
}
