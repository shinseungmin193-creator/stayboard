import Link from "next/link";
import { SignupForm } from "@/features/auth/components/signup-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "무료 시작" };

export default function SignupPage() {
  return <Card className="mx-auto max-w-xl"><CardHeader><CardTitle>StayBoard 무료 시작</CardTitle></CardHeader><CardContent className="space-y-5"><SignupForm /><p className="text-center text-sm text-muted-foreground">이미 계정이 있나요? <Link href="/login" className="font-medium text-primary hover:underline">로그인</Link></p></CardContent></Card>;
}
