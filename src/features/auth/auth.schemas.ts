import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

const email = z.string().trim().toLowerCase().email("올바른 이메일 주소를 입력해 주세요.");
const password = z.string().min(PASSWORD_MIN_LENGTH, `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`).max(128, "비밀번호는 128자 이하여야 합니다.");
const loginIdentifier = z.string().trim().toLowerCase().min(3, "아이디 또는 이메일을 입력해 주세요.").max(254);

export const loginSchema = z.object({ identifier: loginIdentifier, password });

export const signupSchema = z.object({
  name: z.string().trim().min(2, "이름은 2자 이상 입력해 주세요.").max(50),
  email,
  password,
  passwordConfirm: z.string(),
  companyName: z.string().trim().min(2, "회사명을 2자 이상 입력해 주세요.").max(100),
}).refine((value) => value.password === value.passwordConfirm, {
  message: "비밀번호가 일치하지 않습니다.",
  path: ["passwordConfirm"],
});
