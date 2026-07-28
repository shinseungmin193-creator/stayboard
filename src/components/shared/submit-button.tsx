"use client";import { useTranslations } from "next-intl";
import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
export function SubmitButton({ children, disabled }: {children: React.ReactNode;disabled?: boolean;}) {const i18n = useTranslations();const { pending } = useFormStatus();return <Button type="submit" disabled={disabled || pending}>{pending && <LoaderCircle className="animate-spin" />}{pending ? i18n("auto.m0127") : children}</Button>;}
