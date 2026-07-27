"use client";

import { useEffect, useRef, useState } from "react";

const RESERVATION_SEARCH_DEBOUNCE_MS = 350;

export function useReservationSearch(value: string, onSearch: (value: string) => void) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const update = (next: string) => {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(next), RESERVATION_SEARCH_DEBOUNCE_MS);
  };
  const submit = () => {
    if (timer.current) clearTimeout(timer.current);
    onSearch(draft);
  };
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    setDraft("");
    onSearch("");
  };
  return { draft, update, submit, clear };
}
