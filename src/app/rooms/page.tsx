import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

export async function generateMetadata() {
  const i18n = await getTranslations();
  return { title: i18n("navigation.items.properties") };
}

export const dynamic = "force-dynamic";

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string | string[] }>;
}) {
  const params = await searchParams;
  const propertyId = typeof params.propertyId === "string" ? params.propertyId : undefined;
  redirect(propertyId ? `/properties?propertyId=${encodeURIComponent(propertyId)}#rooms` : "/properties");
}
