import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/lib/generated/prisma/client";
import { isNormalizedEmail, normalizeEmail } from "../src/features/auth/domain/identity";

async function main() {
  const rawEmail = process.argv[2];
  if (!rawEmail) {
    console.error("사용법: npm run diagnose:invitation-account -- user@example.com");
    process.exitCode = 1;
    return;
  }

  const email = normalizeEmail(rawEmail);
  if (!email.includes("@")) {
    console.error("[진단 실패] 올바른 이메일 주소를 입력해 주세요.");
    process.exitCode = 1;
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[진단 실패] DATABASE_URL 환경 변수가 설정되지 않았습니다.");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: {
        email: true,
        passwordHash: true,
        createdAt: true,
        memberships: {
          select: { companyId: true, role: true, status: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    console.info(JSON.stringify({
      userExists: Boolean(user),
      passwordHashPresent: Boolean(user?.passwordHash),
      membershipExists: Boolean(user?.memberships.length),
      createdAt: user?.createdAt ?? null,
      emailNormalized: user ? isNormalizedEmail(user.email) : null,
      memberships: user?.memberships.map((membership) => ({
        companyId: membership.companyId,
        role: membership.role,
        status: membership.status,
        createdAt: membership.createdAt,
      })) ?? [],
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(JSON.stringify({
    event: "INVITATION_ACCOUNT_DIAGNOSTIC_FAILED",
    errorName: error instanceof Error ? error.name : "UnknownError",
  }));
  process.exitCode = 1;
});
