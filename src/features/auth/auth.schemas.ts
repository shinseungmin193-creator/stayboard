import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

const email = z.string().trim().toLowerCase().email("올바른 이메일 주소를 입력해 주세요.");
const password = z.string().min(PASSWORD_MIN_LENGTH, `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`).max(128, "비밀번호는 128자 이하여야 합니다.");
const loginIdentifier = z.string().trim().toLowerCase().min(3, "아이디 또는 이메일을 입력해 주세요.").max(254);

export const loginSchema = z.object({ identifier: loginIdentifier, password });

export const signupSchema = z.object({
  signupType: z.enum(["new-company", "invitation-code"]),
  name: z.string().trim().min(2, "이름은 2자 이상 입력해 주세요.").max(50),
  email,
  password,
  passwordConfirm: z.string(),
  companyName: z.string().trim().max(100).optional(),
  invitationCode: z.string().trim().max(100).optional(),
}).superRefine((value, context) => {
  if (value.password !== value.passwordConfirm) context.addIssue({ code: "custom", message: "비밀번호가 일치하지 않습니다.", path: ["passwordConfirm"] });
  if (value.signupType === "new-company" && (!value.companyName || value.companyName.length < 2)) context.addIssue({ code: "custom", message: "회사명을 2자 이상 입력해 주세요.", path: ["companyName"] });
  if (value.signupType === "invitation-code" && (!value.invitationCode || value.invitationCode.length < 20)) context.addIssue({ code: "custom", message: "초대코드를 입력해 주세요.", path: ["invitationCode"] });
});
