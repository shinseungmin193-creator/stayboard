"use client";
import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
export function SubmitButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) { const { pending } = useFormStatus(); return <Button type="submit" disabled={disabled || pending}>{pending && <LoaderCircle className="animate-spin" />}{pending ? "처리 중" : children}</Button>; }
