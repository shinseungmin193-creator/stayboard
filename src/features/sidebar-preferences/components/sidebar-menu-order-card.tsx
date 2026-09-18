"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, LockKeyhole, Pencil, Plus, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { USER_ROLES, type UserRole } from "@/features/access-control/domain/access-control";
import { canConfigureSidebarMenuRole, getSidebarOrderItemId, type SidebarOrderItemId } from "../domain/sidebar-preference";
import { findSidebarMenu, isSidebarMenuHideable, type SidebarMenuDefinition, type SidebarMenuId } from "../domain/sidebar-menu";
import { useSidebarPreference } from "./sidebar-preference-provider";

function SortableMenuCard({ menu, position, hidden, label, customized, allowedRoles, onToggle, onRename, onResetLabel, onRoleChange }: {
  menu: SidebarMenuDefinition;
  position: number;
  hidden: boolean;
  label: string;
  customized: boolean;
  allowedRoles: readonly UserRole[];
  onToggle(): void;
  onRename(label: string): void;
  onResetLabel(): void;
  onRoleChange(role: UserRole, allowed: boolean): void;
}) {
  const i18n = useTranslations();
  const hideable = isSidebarMenuHideable(menu.id as SidebarMenuId);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: menu.id });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const skipBlurRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const save = () => {
    const normalized = draft.trim();
    if (!normalized) {
      setValidationMessage(i18n("auto.m0593"));
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
      <span className="w-8 shrink-0 text-center font-mono text-sm tabular-nums text-muted-foreground" aria-label={i18n("auto.m0594", { value0: position })}>{String(position).padStart(2, "0")}</span>
      <button type="button" aria-label={i18n("auto.m0595", { value0: label })} className="grid size-8 shrink-0 touch-none cursor-grab place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring" {...attributes} {...listeners}><GripVertical className="size-4" /></button>
      <menu.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1.5">
        {editing ? <div className="flex min-w-0 items-center gap-1">
          <Input ref={inputRef} autoFocus value={draft} maxLength={20} aria-label={i18n("auto.m0596", { value0: menu.label })} aria-invalid={Boolean(validationMessage)} onChange={(event) => { setDraft(event.target.value); setValidationMessage(null); }} onKeyDown={handleKeyDown} onBlur={() => { if (skipBlurRef.current) { skipBlurRef.current = false; return; } save(); }} className="h-8 min-w-0" />
          {customized && <Button type="button" size="icon-sm" variant="ghost" aria-label={i18n("auto.m0597", { value0: menu.label })} title={i18n("auto.m0598")} onMouseDown={(event) => event.preventDefault()} onClick={() => { setEditing(false); setValidationMessage(null); onResetLabel(); }}><Undo2 /></Button>}
        </div> : <div className="flex min-w-0 items-center gap-1"><span className="min-w-0 truncate text-sm font-medium">{label}</span><Button type="button" size="icon-sm" variant="ghost" aria-label={i18n("auto.m0599", { value0: label })} onClick={() => { skipBlurRef.current = false; setDraft(label); setValidationMessage(null); setEditing(true); }}><Pencil /></Button></div>}
        {validationMessage && <p className="mt-1 text-xs text-destructive">{validationMessage}</p>}
        <fieldset className="flex flex-wrap gap-x-3 gap-y-1" aria-label={i18n("sidebarPreferences.allowedRoles")}>
          <legend className="sr-only">{i18n("sidebarPreferences.allowedRoles")}</legend>
          {USER_ROLES.map((role) => {
            const configurable = canConfigureSidebarMenuRole(menu.id as SidebarMenuId, role);
            const checked = allowedRoles.includes(role);
            return <label key={role} className={cn("inline-flex min-h-7 items-center gap-1.5 text-xs", configurable ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground")} title={!configurable ? (checked ? i18n("sidebarPreferences.requiredRole") : i18n("sidebarPreferences.unavailableRole")) : undefined}>
              <input type="checkbox" checked={checked} disabled={!configurable} onChange={(event) => onRoleChange(role, event.target.checked)} className="size-3.5 accent-primary" />
              <span>{i18n(`roles.${role}`)}</span>
            </label>;
          })}
        </fieldset>
      </div>
      {hideable ? <Button type="button" size="icon-sm" variant="ghost" aria-label={`${label} ${hidden ? i18n("auto.m0600") : i18n("auto.m0601")}`} aria-pressed={hidden} onClick={onToggle}>{hidden ? <EyeOff /> : <Eye />}</Button> : <span className="grid size-7 shrink-0 place-items-center text-muted-foreground" title={i18n("auto.m0602")}><LockKeyhole className="size-3.5" /><span className="sr-only">{i18n("auto.m0602")}</span></span>}
    </CardContent>
  </Card>;
}

function SortableDividerCard({ id, position, onRemove }: { id: string; position: number; onRemove(): void }) {
  const i18n = useTranslations();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  return <Card ref={setNodeRef} size="sm" style={style} className={cn("gap-0 border-dashed py-0 transition-[box-shadow]", isDragging && "z-10 shadow-md ring-2 ring-primary/30")}>
    <CardContent className="flex min-h-12 items-center gap-2 px-2.5 py-2">
      <span className="w-8 shrink-0 text-center font-mono text-sm tabular-nums text-muted-foreground" aria-label={i18n("auto.m0594", { value0: position })}>{String(position).padStart(2, "0")}</span>
      <button type="button" aria-label={i18n("sidebarPreferences.moveDivider")} className="grid size-8 shrink-0 touch-none cursor-grab place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring" {...attributes} {...listeners}><GripVertical className="size-4" /></button>
      <div className="h-px min-w-8 flex-1 bg-border" aria-hidden="true" />
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{i18n("sidebarPreferences.divider")}</span>
      <div className="h-px min-w-8 flex-1 bg-border" aria-hidden="true" />
      <Button type="button" size="icon-sm" variant="ghost" aria-label={i18n("sidebarPreferences.deleteDivider")} onClick={onRemove}><Trash2 /></Button>
    </CardContent>
  </Card>;
}

export function SidebarMenuOrderCard() {
  const i18n = useTranslations();
  const saveStatusLabel = { idle: "", pending: i18n("auto.m0659"), saving: i18n("auto.m0587"), saved: i18n("auto.m0660"), error: i18n("auto.m0661") } as const;
  const { preference, saveStatus, errorMessage, moveItem, addDivider, removeDivider, toggleMenu, renameMenu, resetMenuLabel, setMenuRole, resetPreference } = useSidebarPreference();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const sortableIds = preference.menuOrder.map(getSidebarOrderItemId);
  const handleDragEnd = ({ active, over }: DragEndEvent) => { if (over && active.id !== over.id) moveItem(active.id as SidebarOrderItemId, over.id as SidebarOrderItemId); };
  const handleReset = () => { if (window.confirm(i18n("auto.m0603"))) resetPreference(); };

  return <Card>
    <CardHeader className="border-b"><div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1"><CardTitle className="text-base">{i18n("auto.m0604")}</CardTitle><CardDescription>{i18n("auto.m0605")}</CardDescription></div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={addDivider}><Plus />{i18n("sidebarPreferences.addDivider")}</Button><Button type="button" size="sm" variant="outline" onClick={handleReset}><RotateCcw />{i18n("auto.m0606")}</Button></div></div></CardHeader>
    <CardContent className="space-y-3">
      <DndContext id="sidebar-menu-order" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={sortableIds} strategy={verticalListSortingStrategy}><div className="grid grid-cols-1 gap-2">{preference.menuOrder.map((item, index) => {
        if (item.type === "DIVIDER") return <SortableDividerCard key={item.id} id={item.id} position={index + 1} onRemove={() => removeDivider(item.id)} />;
        const menu = findSidebarMenu(item.key);
        if (!menu) return null;
        return <SortableMenuCard key={menu.id} menu={menu} position={index + 1} hidden={preference.hiddenMenuIds.includes(item.key)} label={preference.customLabels[item.key] ?? i18n(`navigation.items.${menu.id}`)} customized={Boolean(preference.customLabels[item.key])} allowedRoles={preference.allowedRoles[item.key]} onToggle={() => toggleMenu(item.key)} onRename={(label) => renameMenu(item.key, label)} onResetLabel={() => resetMenuLabel(item.key)} onRoleChange={(role, allowed) => setMenuRole(item.key, role, allowed)} />;
      })}</div></SortableContext></DndContext>
      <div className="space-y-1 text-xs text-muted-foreground"><p>{i18n("auto.m0607")}</p><p>{i18n("sidebarPreferences.permissionBoundary")}</p><div className="flex min-h-5 items-center justify-between gap-3"><span>{i18n("auto.m0608")}</span><span className={cn("shrink-0", saveStatus === "error" && "text-destructive")} aria-live="polite">{errorMessage ?? saveStatusLabel[saveStatus]}</span></div></div>
    </CardContent>
  </Card>;
}
