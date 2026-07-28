"use client";import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import { setRoomActiveAction } from "../room.actions";
import { Button } from "@/components/ui/button";
export function RoomActiveForm({ id, isActive }: {id: string;isActive: boolean;}) {const i18n = useTranslations();const [result, action, pending] = useActionState(setRoomActiveAction, INITIAL_ACTION_RESULT);return <form action={action} className="space-y-1"><input type="hidden" name="id" value={id} /><input type="hidden" name="isActive" value={String(!isActive)} /><Button type="submit" size="sm" variant={isActive ? "outline" : "secondary"} disabled={pending}>{pending ? i18n("auto.m0265") : isActive ? i18n("auto.m0266") : i18n("auto.m0267")}</Button>{!result.success && <p className="max-w-36 whitespace-normal text-xs text-destructive">{result.message}</p>}</form>;}
