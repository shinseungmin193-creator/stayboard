"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, LockKeyhole, Pencil, RotateCcw, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { findSidebarMenu, isSidebarMenuHideable, SIDEBAR_MENU_GROUPS, type SidebarMenuDefinition, type SidebarMenuId } from "../domain/sidebar-menu";
import { getSidebarMenuLabel } from "../domain/sidebar-preference";
import { useSidebarPreference } from "./sidebar-preference-provider";

const saveStatusLabel = { idle: "", pending: "저장 대기 중", saving: "저장 중", saved: "저장 완료", error: "저장 실패" } as const;

function SortableMenuCard({ menu, position, hidden, label, customized, onToggle, onRename, onResetLabel }: { menu: SidebarMenuDefinition; position: number; hidden: boolean; label: string; customized: boolean; onToggle(): void; onRename(label: string): void; onResetLabel(): void }) {
  const hideable = isSidebarMenuHideable(menu.id as SidebarMenuId);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: menu.id, disabled: !hideable });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const skipBlurRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const save = () => {
    const normalized = draft.trim();
    if (!normalized) {
      setValidationMessage("메뉴 이름을 입력해 주세요.");
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    setValidationMessage(null);
    setEditing(false);
    if (normalized !== label) onRename(normalized);
  };
  const cancel = () => {
    skipBlurRef.current = true;
    setDraft(label);
    setValidationMessage(null);
    setEditing(false);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") { event.preventDefault(); save(); }
    if (event.key === "Escape") { event.preventDefault(); cancel(); }
  };

  return <Card ref={setNodeRef} size="sm" style={style} className={cn("gap-0 py-0 transition-[opacity,box-shadow]", hidden && "opacity-55", isDragging && "z-10 shadow-md ring-2 ring-primary/30")}>
    <CardContent className="flex min-h-12 items-center gap-2 px-2.5 py-2">
      <span className="w-8 shrink-0 text-center font-mono text-sm tabular-nums text-muted-foreground" aria-label={`${position}번째`}>{String(position).padStart(2, "0")}</span>
      <button type="button" aria-label={`${label} 순서 이동`} disabled={!hideable} className={cn("grid size-8 shrink-0 touch-none place-items-center rounded-md text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", hideable ? "cursor-grab hover:bg-muted active:cursor-grabbing" : "cursor-not-allowed opacity-45")} {...attributes} {...listeners}><GripVertical className="size-4" /></button>
      <menu.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {editing ? <div className="flex min-w-0 items-center gap-1">
          <Input ref={inputRef} autoFocus value={draft} maxLength={20} aria-label={`${menu.label} 메뉴 이름`} aria-invalid={Boolean(validationMessage)} onChange={(event) => { setDraft(event.target.value); setValidationMessage(null); }} onKeyDown={handleKeyDown} onBlur={() => { if (skipBlurRef.current) { skipBlurRef.current = false; return; } save(); }} className="h-8 min-w-0" />
          {customized && <Button type="button" size="icon-sm" variant="ghost" aria-label={`${menu.label} 이름 초기화`} title="기본 이름으로 초기화" onMouseDown={(event) => event.preventDefault()} onClick={() => { setEditing(false); setValidationMessage(null); onResetLabel(); }}><Undo2 /></Button>}
        </div> : <div className="flex min-w-0 items-center gap-1"><span className="min-w-0 truncate text-sm font-medium">{label}</span><Button type="button" size="icon-sm" variant="ghost" aria-label={`${label} 이름 수정`} onClick={() => { skipBlurRef.current = false; setDraft(label); setValidationMessage(null); setEditing(true); }}><Pencil /></Button></div>}
        {validationMessage && <p className="mt-1 text-xs text-destructive">{validationMessage}</p>}
      </div>
      <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">{SIDEBAR_MENU_GROUPS[menu.group]}</Badge>
      {hideable ? <Button type="button" size="icon-sm" variant="ghost" aria-label={`${label} ${hidden ? "표시" : "숨김"}`} aria-pressed={hidden} onClick={onToggle}>{hidden ? <EyeOff /> : <Eye />}</Button> : <span className="grid size-7 shrink-0 place-items-center text-muted-foreground" title="항상 표시"><LockKeyhole className="size-3.5" /><span className="sr-only">항상 표시</span></span>}
    </CardContent>
  </Card>;
}

export function SidebarMenuOrderCard() {
  const { preference, saveStatus, errorMessage, moveMenu, toggleMenu, renameMenu, resetMenuLabel, resetPreference } = useSidebarPreference();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const menus = preference.menuOrder.map(findSidebarMenu).filter((menu): menu is NonNullable<typeof menu> => Boolean(menu));
  const handleDragEnd = ({ active, over }: DragEndEvent) => { if (over && active.id !== over.id) moveMenu(active.id as SidebarMenuId, over.id as SidebarMenuId); };
  const handleReset = () => { if (window.confirm("메뉴 순서, 표시 여부, 변경한 이름을 모두 기본 설정으로 복원할까요?")) resetPreference(); };

  return <Card>
    <CardHeader className="border-b"><div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1"><CardTitle className="text-base">사이드바 메뉴 순서</CardTitle><CardDescription>순서, 표시 여부와 사이드바 이름을 자동 저장합니다.</CardDescription></div><Button type="button" size="sm" variant="outline" onClick={handleReset}><RotateCcw />기본 설정 복원</Button></div></CardHeader>
    <CardContent className="space-y-3">
      <DndContext id="sidebar-menu-order" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={preference.menuOrder} strategy={verticalListSortingStrategy}><div className="grid grid-cols-1 gap-2">{menus.map((menu, index) => <SortableMenuCard key={menu.id} menu={menu} position={index + 1} hidden={preference.hiddenMenuIds.includes(menu.id as SidebarMenuId)} label={getSidebarMenuLabel(menu, preference)} customized={Boolean(preference.customLabels[menu.id as SidebarMenuId])} onToggle={() => toggleMenu(menu.id as SidebarMenuId)} onRename={(label) => renameMenu(menu.id as SidebarMenuId, label)} onResetLabel={() => resetMenuLabel(menu.id as SidebarMenuId)} />)}</div></SortableContext></DndContext>
      <div className="space-y-1 text-xs text-muted-foreground"><p>연필 아이콘으로 사이드바 표시 이름만 변경합니다. Enter 또는 바깥 클릭으로 저장하고 Esc로 취소합니다.</p><div className="flex min-h-5 items-center justify-between gap-3"><span>잠긴 메뉴도 이름은 변경할 수 있으며, 잠금은 이동과 숨김만 제한합니다.</span><span className={cn("shrink-0", saveStatus === "error" && "text-destructive")} aria-live="polite">{errorMessage ?? saveStatusLabel[saveStatus]}</span></div></div>
    </CardContent>
  </Card>;
}
