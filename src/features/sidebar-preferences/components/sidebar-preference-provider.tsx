"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_SIDEBAR_PREFERENCE, moveSidebarMenu, normalizeSidebarPreference, type SidebarPreferenceValue } from "../domain/sidebar-preference";
import { isSidebarMenuHideable, type SidebarMenuId } from "../domain/sidebar-menu";
import { updateSidebarPreferenceAction } from "../sidebar-preference.actions";

export type SidebarPreferenceSaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

interface SidebarPreferenceContextValue {
  preference: SidebarPreferenceValue;
  saveStatus: SidebarPreferenceSaveStatus;
  errorMessage: string | null;
  moveMenu(activeId: SidebarMenuId, overId: SidebarMenuId): void;
  toggleMenu(menuId: SidebarMenuId): void;
  renameMenu(menuId: SidebarMenuId, label: string): void;
  resetMenuLabel(menuId: SidebarMenuId): void;
  resetPreference(): void;
}

const SidebarPreferenceContext = createContext<SidebarPreferenceContextValue | null>(null);
const SAVE_DEBOUNCE_MS = 400;

export function SidebarPreferenceProvider({ children, initialPreference }: { children: ReactNode; initialPreference: SidebarPreferenceValue }) {
  const [preference, setPreference] = useState(() => normalizeSidebarPreference(initialPreference));
  const [saveStatus, setSaveStatus] = useState<SidebarPreferenceSaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const persistedPreferenceRef = useRef(normalizeSidebarPreference(initialPreference));
  const revisionRef = useRef(0);
  const [revision, setRevision] = useState(0);

  const commit = useCallback((update: (current: SidebarPreferenceValue) => SidebarPreferenceValue) => {
    setPreference((current) => normalizeSidebarPreference(update(current)));
    revisionRef.current += 1;
    setRevision(revisionRef.current);
    setSaveStatus("pending");
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    if (revision === 0) return;
    const scheduledRevision = revision;
    const timeoutId = window.setTimeout(() => {
      setSaveStatus("saving");
      startTransition(async () => {
        const submittedPreference = preference;
        const result = await updateSidebarPreferenceAction(submittedPreference);
        if (result.success) {
          persistedPreferenceRef.current = normalizeSidebarPreference(result.data);
          if (revisionRef.current !== scheduledRevision) return;
          setPreference(persistedPreferenceRef.current);
          setSaveStatus("saved");
          setErrorMessage(null);
        } else {
          if (revisionRef.current !== scheduledRevision) return;
          setPreference(persistedPreferenceRef.current);
          setRevision(0);
          setSaveStatus("error");
          setErrorMessage(result.message);
        }
      });
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [preference, revision]);

  const value = useMemo<SidebarPreferenceContextValue>(() => ({
    preference,
    saveStatus,
    errorMessage,
    moveMenu: (activeId, overId) => commit((current) => {
      return { ...current, menuOrder: moveSidebarMenu(current.menuOrder, activeId, overId) };
    }),
    toggleMenu: (menuId) => {
      if (!isSidebarMenuHideable(menuId)) return;
      commit((current) => ({
        ...current,
        hiddenMenuIds: current.hiddenMenuIds.includes(menuId)
          ? current.hiddenMenuIds.filter((hiddenId) => hiddenId !== menuId)
          : [...current.hiddenMenuIds, menuId],
      }));
    },
    renameMenu: (menuId, label) => {
      const normalizedLabel = label.trim().slice(0, 20);
      if (!normalizedLabel) return;
      commit((current) => ({ ...current, customLabels: { ...current.customLabels, [menuId]: normalizedLabel } }));
    },
    resetMenuLabel: (menuId) => commit((current) => {
      const customLabels = { ...current.customLabels };
      delete customLabels[menuId];
      return { ...current, customLabels };
    }),
    resetPreference: () => commit(() => structuredClone(DEFAULT_SIDEBAR_PREFERENCE)),
  }), [commit, errorMessage, preference, saveStatus]);

  return <SidebarPreferenceContext.Provider value={value}>{children}</SidebarPreferenceContext.Provider>;
}

export function useSidebarPreference() {
  const context = useContext(SidebarPreferenceContext);
  if (!context) throw new Error("SidebarPreferenceProvider 안에서 사용해야 합니다.");
  return context;
}
