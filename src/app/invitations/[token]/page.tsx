import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getOptionalSession } from "@/features/auth/server/get-current-user";
import { hashInvitationToken } from "@/features/member-management/invitation-token";
import { AcceptInvitationForm } from "@/features/member-management/components/accept-invitation-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "회사 초대" };
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; const [session, invitation] = await Promise.all([getOptionalSession(), prisma.companyInvitation.findUnique({ where: { tokenHash: hashInvitationToken(token) }, select: { email: true, role: true, expiresAt: true, acceptedAt: true, cancelledAt: true, company: { select: { name: true } } } })]); const invalid = !invitation || invitation.acceptedAt || invitation.cancelledAt || invitation.expiresAt <= new Date(); return <main className="mx-auto flex min-h-screen max-w-lg items-center p-4"><Card className="w-full"><CardHeader><CardTitle>StayBoard 회사 초대</CardTitle></CardHeader><CardContent className="space-y-4">{invalid ? <p className="text-sm text-destructive">유효하지 않거나 만료·취소·사용된 초대입니다.</p> : <><div className="space-y-1 text-sm"><p><strong>{invitation.company.name}</strong>에 초대되었습니다.</p><p>이메일: {invitation.email}</p><p>권한: {invitation.role === "ADMIN" ? "관리자" : "직원"}</p></div>{session ? <AcceptInvitationForm token={token} authenticated /> : <><p className="text-sm text-muted-foreground">기존 계정이 있다면 먼저 로그인한 뒤 이 링크로 돌아오세요. 계정이 없다면 아래에서 가입할 수 있습니다.</p><Button nativeButton={false} render={<Link href={`/login?callbackUrl=${encodeURIComponent(`/invitations/${token}`)}`} />} variant="outline">기존 계정으로 로그인</Button><AcceptInvitationForm token={token} authenticated={false} /></>}</>}</CardContent></Card></main>; }
