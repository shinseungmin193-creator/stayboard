import { createHash, randomBytes } from "node:crypto";
import { INVITATION_TOKEN_BYTES } from "./member-management.constants";

export function createInvitationToken() { return randomBytes(INVITATION_TOKEN_BYTES).toString("base64url"); }
export function hashInvitationToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
