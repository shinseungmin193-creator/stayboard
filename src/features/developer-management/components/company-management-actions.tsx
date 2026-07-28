"use client";

import { Label } from "@/components/ui/label";
import {
  restoreCompanyAction,
  suspendCompanyAction,
  transferCompanyAdminAction,
} from "../developer-management.actions";
import { ManagementActionDialog } from "./management-action-dialog";
import { useTranslations } from "next-intl";

export function CompanyManagementActions({
  companyId,
  isActive,
  candidates,
}: {
  companyId: string;
  isActive: boolean;
  candidates: Array<{ id: string; name: string; email: string }>;
}) {
  const i18n = useTranslations();
  return (
    <div className="flex flex-wrap gap-2">
      {isActive ? (
        <ManagementActionDialog action={suspendCompanyAction} titleKey="developerManagement.actions.suspendCompany" descriptionKey="developerManagement.descriptions.suspendCompany" triggerKey="developerManagement.actions.suspend" destructive>
          <input type="hidden" name="companyId" value={companyId} />
        </ManagementActionDialog>
      ) : (
        <ManagementActionDialog action={restoreCompanyAction} titleKey="developerManagement.actions.restoreCompany" descriptionKey="developerManagement.descriptions.restoreCompany" triggerKey="developerManagement.actions.restore">
          <input type="hidden" name="companyId" value={companyId} />
        </ManagementActionDialog>
      )}
      <ManagementActionDialog action={transferCompanyAdminAction} titleKey="developerManagement.actions.transferAdmin" descriptionKey="developerManagement.descriptions.transferAdmin" triggerKey="developerManagement.actions.transferAdmin">
        <input type="hidden" name="companyId" value={companyId} />
        <div className="space-y-1.5">
          <Label>{i18n("developerManagement.lastAdmin.replacement")}</Label>
          <select name="replacementUserId" defaultValue="" required className="h-9 w-full rounded-lg border bg-background px-2 text-sm">
            <option value="">{i18n("developerManagement.lastAdmin.selectReplacement")}</option>
            {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.email}</option>)}
          </select>
        </div>
      </ManagementActionDialog>
    </div>
  );
}
