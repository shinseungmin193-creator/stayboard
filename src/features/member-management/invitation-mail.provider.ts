import "server-only";

export interface SendInvitationInput { to: string; companyName: string; inviterName: string; invitationUrl: string; message?: string }
export interface InvitationMailProvider { sendInvitation(input: SendInvitationInput): Promise<void> }

class DevelopmentInvitationMailProvider implements InvitationMailProvider {
  async sendInvitation(input: SendInvitationInput) {
    console.info("[company-invitation.dev]", { to: input.to, companyName: input.companyName, invitationUrl: input.invitationUrl });
  }
}

class UnconfiguredInvitationMailProvider implements InvitationMailProvider {
  async sendInvitation() { throw new Error("운영 이메일 Provider가 설정되지 않았습니다."); }
}

export const invitationMailProvider: InvitationMailProvider = process.env.NODE_ENV === "production" ? new UnconfiguredInvitationMailProvider() : new DevelopmentInvitationMailProvider();
