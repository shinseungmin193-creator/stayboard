const NEXTAUTH_SECRET_MIN_LENGTH = 32;

export function requireNextAuthSecret(value: string | undefined) {
  const secret = value?.trim();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET 환경 변수가 필요합니다. 고정된 32자 이상의 값을 설정해 주세요.");
  }
  if (secret.length < NEXTAUTH_SECRET_MIN_LENGTH) {
    throw new Error(`NEXTAUTH_SECRET는 ${NEXTAUTH_SECRET_MIN_LENGTH}자 이상이어야 합니다.`);
  }
  return secret;
}
