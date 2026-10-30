import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import type { CompanyOption } from "@/features/companies";
import type { PropertyListItem } from "../property.types";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PropertyActiveForm } from "./property-active-form";
import { PropertyDeleteDialog } from "./property-delete-dialog";
import { PropertyFormDialog } from "./property-form-dialog";

export function PropertyList({
  properties,
  companies,
  selectedPropertyId,
}: {
  properties: PropertyListItem[];
  companies: CompanyOption[];
  selectedPropertyId?: string;
}) {
  const i18n = useTranslations();
  if (!properties.length) {
    return (
      <Card>
        <CardContent className="flex min-h-72 items-center">
          <EmptyState
            icon={Building2}
            title={i18n("auto.m0370")}
            description={companies.length ? i18n("auto.m0371") : i18n("auto.m0372")}
          />
        </CardContent>
      </Card>
    );
  }
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {properties.map((property) => (
          <Card key={property.id} className={cn(selectedPropertyId === property.id && "border-primary/50 bg-primary/5")}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{property.name}</p>
                  <p className="text-xs text-muted-foreground">{property.companyName}</p>
                </div>
                <Badge variant={property.isActive ? "secondary" : "outline"}>
                  {property.isActive ? i18n("auto.m0210") : i18n("auto.m0115")}
                </Badge>
              </div>
              <p className="text-sm">{property.address}</p>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{property.timezone}</span>
                <span>{i18n("common.room")}{property.activeRooms}/{property.totalRooms}{i18n("auto.m0210")}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button nativeButton={false} render={<Link href={`/properties?propertyId=${encodeURIComponent(property.id)}#rooms`} />} variant={selectedPropertyId === property.id ? "default" : "outline"} size="sm">
                  {i18n("propertyRooms.viewRooms")} <ArrowRight />
                </Button>
                <PropertyFormDialog companies={companies} property={property} />
                <PropertyActiveForm id={property.id} isActive={property.isActive} />
                <PropertyDeleteDialog property={property} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{i18n("auto.m0373")}</TableHead>
              <TableHead>{i18n("auto.m0368")}</TableHead>
              <TableHead>{i18n("auto.m0369")}</TableHead>
              <TableHead>{i18n("common.room")}</TableHead>
              <TableHead>{i18n("common.status")}</TableHead>
              <TableHead className="text-right">{i18n("common.manage")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((property) => (
              <TableRow key={property.id} className={cn(selectedPropertyId === property.id && "bg-primary/5")}>
                <TableCell>
                  <p className="font-medium">{property.name}</p>
                  <p className="text-xs text-muted-foreground">{property.companyName}</p>
                </TableCell>
                <TableCell className="max-w-64 truncate">{property.address}</TableCell>
                <TableCell>{property.timezone}</TableCell>
                <TableCell>{property.activeRooms}/{property.totalRooms}{i18n("auto.m0210")}</TableCell>
                <TableCell>
                  <Badge variant={property.isActive ? "secondary" : "outline"}>
                    {property.isActive ? i18n("auto.m0210") : i18n("auto.m0115")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button nativeButton={false} render={<Link href={`/properties?propertyId=${encodeURIComponent(property.id)}#rooms`} />} variant={selectedPropertyId === property.id ? "default" : "outline"} size="sm">
                      {i18n("propertyRooms.viewRooms")} <ArrowRight />
                    </Button>
                    <PropertyFormDialog companies={companies} property={property} />
                    <PropertyActiveForm id={property.id} isActive={property.isActive} />
                    <PropertyDeleteDialog property={property} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
