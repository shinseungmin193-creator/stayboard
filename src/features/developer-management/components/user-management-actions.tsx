"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  anonymizeDeletedUserAction,
  changeUserRoleAction,
  forceLogoutUserAction,
  restoreUserAction,
  softDeleteUserAction,
  suspendUserAction,
} from "../developer-management.actions";
import type { DeveloperMembershipDetail } from "../developer-management.types";
import { LastAdminResolutionFields, ManagementActionDialog } from "./management-action-dialog";
import { useTranslations } from "next-intl";

export function UserManagementActions({
  user,
  actorUserId,
}: {
  user: {
    id: string;
    email: string;
    username: string | null;
    systemRole: "NONE" | "DEVELOPER";
    status: "ACTIVE" | "SUSPENDED" | "DELETED";
    anonymizedAt: Date | null;
    memberships: DeveloperMembershipDetail[];
  };
  actorUserId: string;
}) {
  const i18n = useTranslations();
  const mutable = user.id !== actorUserId && user.systemRole !== "DEVELOPER";
  const candidates = [...new Map(user.memberships.flatMap((membership) => membership.replacementCandidates).map((candidate) => [candidate.id, candidate])).values()];

  if (!mutable) {
    return <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">{i18n("developerManagement.messages.protectedAccount")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {user.status === "ACTIVE" ? (
          <ManagementActionDialog action={suspendUserAction} titleKey="developerManagement.actions.suspendUser" descriptionKey="developerManagement.descriptions.suspendUser" triggerKey="developerManagement.actions.suspend" destructive>
            <input type="hidden" name="userId" value={user.id} />
            <LastAdminResolutionFields candidates={candidates} />
          </ManagementActionDialog>
        ) : null}
        {user.status === "SUSPENDED" ? (
          <ManagementActionDialog action={restoreUserAction} titleKey="developerManagement.actions.restoreUser" descriptionKey="developerManagement.descriptions.restoreUser" triggerKey="developerManagement.actions.restore" reasonRequired={false}>
            <input type="hidden" name="userId" value={user.id} />
          </ManagementActionDialog>
        ) : null}
        {user.status !== "DELETED" ? (
          <ManagementActionDialog action={forceLogoutUserAction} titleKey="developerManagement.actions.forceLogout" descriptionKey="developerManagement.descriptions.forceLogout" triggerKey="developerManagement.actions.forceLogout">
            <input type="hidden" name="userId" value={user.id} />
          </ManagementActionDialog>
        ) : null}
        {user.status !== "DELETED" ? (
          <ManagementActionDialog action={softDeleteUserAction} titleKey="developerManagement.actions.deleteUser" descriptionKey="developerManagement.descriptions.deleteUser" triggerKey="developerManagement.actions.delete" destructive>
            <input type="hidden" name="userId" value={user.id} />
            <div className="space-y-1.5">
              <Label>{i18n("developerManagement.fields.confirmIdentity")}</Label>
              <Input name="confirmation" placeholder={user.email} required autoComplete="off" />
            </div>
            <LastAdminResolutionFields candidates={candidates} />
          </ManagementActionDialog>
        ) : null}
        {user.status === "DELETED" && !user.anonymizedAt ? (
          <ManagementActionDialog action={anonymizeDeletedUserAction} titleKey="developerManagement.actions.anonymizeUser" descriptionKey="developerManagement.descriptions.anonymizeUser" triggerKey="developerManagement.actions.anonymize" destructive>
            <input type="hidden" name="userId" value={user.id} />
            <div className="space-y-1.5">
              <Label>{i18n("developerManagement.fields.confirmIdentity")}</Label>
              <Input name="confirmation" placeholder={user.email} required autoComplete="off" />
            </div>
          </ManagementActionDialog>
        ) : null}
      </div>

      {user.status === "ACTIVE" ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{i18n("developerManagement.sections.roleManagement")}</h3>
          {user.memberships.map((membership) => (
            <div key={membership.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{membership.companyName}</p>
                <p className="text-xs text-muted-foreground">{i18n(`roles.${membership.role}`)}</p>
              </div>
              <ManagementActionDialog action={changeUserRoleAction} titleKey="developerManagement.actions.changeRole" descriptionKey="developerManagement.descriptions.changeRole" triggerKey="developerManagement.actions.changeRole">
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="companyId" value={membership.companyId} />
                <div className="space-y-1.5">
                  <Label>{i18n("developerManagement.fields.nextRole")}</Label>
                  <select name="role" defaultValue={membership.role === "ADMIN" ? "STAFF" : "ADMIN"} className="h-9 w-full rounded-lg border bg-background px-2 text-sm">
                    <option value="ADMIN">{i18n("roles.ADMIN")}</option>
                    <option value="STAFF">{i18n("roles.STAFF")}</option>
                  </select>
                </div>
                <LastAdminResolutionFields candidates={membership.replacementCandidates} />
              </ManagementActionDialog>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
