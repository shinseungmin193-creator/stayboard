import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./src/lib/generated/prisma/client";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const user = await prisma.user.findUnique({
  where: { email: "codex-cleaning-qa@local.test" },
  select: {
    id: true,
    email: true,
    username: true,
    name: true,
    status: true,
    isActive: true,
    systemRole: true,
    passwordHash: true,
  },
});

console.log(JSON.stringify({
  ...user,
  passwordHash: user?.passwordHash ? "present" : "missing",
  passwordMatches: user?.passwordHash
    ? await bcrypt.compare("CodexCleaningQA!2026", user.passwordHash)
    : false,
}));

const tasks = await prisma.cleaningTask.findMany({
  orderBy: { scheduledDate: "desc" },
  take: 10,
  select: { scheduledDate: true, status: true, roomId: true },
});
console.log(JSON.stringify(tasks));

await prisma.$disconnect();
