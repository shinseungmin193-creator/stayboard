import { Prisma } from "@/lib/generated/prisma/client";

export function isPrismaUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function logServerError(context: string, error: unknown): void {
  if (process.env.NODE_ENV === "development") console.error(`[${context}]`, error);
}
