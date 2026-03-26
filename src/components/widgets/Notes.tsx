import { useState, useRef } from 'react';

const STORAGE_KEY = 'pfd-notes';

export function Notes() {
  const [text, setText] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleChange = (value: string) => {
    setText(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, value);
    }, 500);
  };

  return (
    <textarea
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Type notes here…"
      className="w-full h-full bg-transparent text-white/90 text-sm resize-none
                 focus:outline-none placeholder-white/30 leading-relaxed"
    />
  );
}
