export interface LoginUserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  isActive: boolean;
}

export type LoginAttemptResult =
  | { status: "AUTHENTICATED"; user: LoginUserRecord }
  | { status: "INVALID_CREDENTIALS" }
  | { status: "ACCOUNT_DISABLED" };

export async function authenticateLoginAttempt(
  identifier: string,
  password: string,
  findUserByIdentifier: (identifier: string) => Promise<LoginUserRecord | null>,
  verifyPassword: (password: string, passwordHash: string) => Promise<boolean>,
): Promise<LoginAttemptResult> {
  const user = await findUserByIdentifier(identifier);
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { status: "INVALID_CREDENTIALS" };
  if (!user.isActive) return { status: "ACCOUNT_DISABLED" };
  return { status: "AUTHENTICATED", user };
}
