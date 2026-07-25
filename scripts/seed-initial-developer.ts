import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/lib/generated/prisma/client";

const DEFAULT_DEVELOPER_USERNAME = "shinseungmin193";
const DEFAULT_DEVELOPER_EMAIL = "developer@staysync.local";
const DEFAULT_DEVELOPER_NAME = "StayBoard Developer";
const PASSWORD_HASH_ROUNDS = 12;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL 환경 변수가 설정되지 않았습니다.");

  const username = (process.env.INITIAL_DEVELOPER_USERNAME ?? DEFAULT_DEVELOPER_USERNAME).trim().toLowerCase();
  const email = (process.env.INITIAL_DEVELOPER_EMAIL ?? DEFAULT_DEVELOPER_EMAIL).trim().toLowerCase();
  const name = (process.env.INITIAL_DEVELOPER_NAME ?? DEFAULT_DEVELOPER_NAME).trim();
  const password = process.env.INITIAL_DEVELOPER_PASSWORD;

  if (!password) throw new Error("INITIAL_DEVELOPER_PASSWORD 환경 변수가 필요합니다.");
  if (password.length < 8) throw new Error("INITIAL_DEVELOPER_PASSWORD는 8자 이상이어야 합니다.");
  if (!username || !email || !name) throw new Error("초기 개발자 계정 식별 정보가 올바르지 않습니다.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { id: true, email: true, username: true, systemRole: true },
    });

    if (existing) {
      const isSameDeveloper = existing.email === email
        && (existing.username === null || existing.username === username)
        && existing.systemRole === "DEVELOPER";
      if (!isSameDeveloper) throw new Error("초기 개발자 식별자가 다른 기존 계정과 충돌합니다.");

      if (existing.username === null) {
        await prisma.user.update({ where: { id: existing.id }, data: { username } });
      }
      console.info("초기 개발자 계정이 이미 존재하여 생성을 건너뛰었습니다.");
      return;
    }

    await prisma.user.create({
      data: {
        username,
        email,
        name,
        passwordHash: await hash(password, PASSWORD_HASH_ROUNDS),
        systemRole: "DEVELOPER",
      },
      select: { id: true },
    });
    console.info("초기 개발자 계정을 생성했습니다.");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  console.error("초기 개발자 계정 Seed를 완료하지 못했습니다.");
  process.exitCode = 1;
});
