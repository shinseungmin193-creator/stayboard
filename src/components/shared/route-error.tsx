"use client";
import { useEffect } from "react";
import { DatabaseZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
export function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) { useEffect(() => { if (process.env.NODE_ENV === "development") console.error("Route data error", error); }, [error]); return <Card><CardContent className="flex min-h-72 flex-col items-center justify-center p-6 text-center"><DatabaseZap className="mb-4 size-8 text-muted-foreground" /><h2 className="text-lg font-semibold">데이터를 불러오지 못했습니다</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">PostgreSQL 서비스와 데이터베이스 연결 설정을 확인한 뒤 다시 시도해 주세요.</p><Button className="mt-5" variant="outline" onClick={retry}>다시 시도</Button></CardContent></Card>; }
