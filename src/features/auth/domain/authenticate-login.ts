export interface LoginUserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  isActive: boolean;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  sessionVersion: number;
  systemRole: "NONE" | "DEVELOPER";
  memberships: Array<{ status: "INVITED" | "ACTIVE" | "DISABLED"; companyActive: boolean }>;
}

export type LoginRejectionReason =
  | "USER_NOT_FOUND"
  | "PASSWORD_HASH_MISSING"
  | "PASSWORD_MISMATCH"
  | "USER_INACTIVE"
  | "MEMBERSHIP_NOT_FOUND"
  | "MEMBERSHIP_INACTIVE";

export type LoginAttemptResult =
  | { status: "AUTHENTICATED"; user: LoginUserRecord }
  | { status: "REJECTED"; reason: LoginRejectionReason };

export async function authenticateLoginAttempt(
  identifier: string,
  password: string,
  findUserByIdentifier: (identifier: string) => Promise<LoginUserRecord | null>,
  verifyPassword: (password: string, passwordHash: string) => Promise<boolean>,
): Promise<LoginAttemptResult> {
  const user = await findUserByIdentifier(identifier);
  if (!user) return { status: "REJECTED", reason: "USER_NOT_FOUND" };
  if (!user.passwordHash) return { status: "REJECTED", reason: "PASSWORD_HASH_MISSING" };
  if (!(await verifyPassword(password, user.passwordHash))) return { status: "REJECTED", reason: "PASSWORD_MISMATCH" };
  if (!user.isActive || user.status !== "ACTIVE") return { status: "REJECTED", reason: "USER_INACTIVE" };
  if (user.systemRole !== "DEVELOPER") {
    if (!user.memberships.length) return { status: "REJECTED", reason: "MEMBERSHIP_NOT_FOUND" };
    if (!user.memberships.some((membership) => membership.status === "ACTIVE" && membership.companyActive)) {
      return { status: "REJECTED", reason: "MEMBERSHIP_INACTIVE" };
    }
  }
  return { status: "AUTHENTICATED", user };
}
