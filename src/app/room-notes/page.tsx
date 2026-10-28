import { redirect } from "next/navigation";

export default async function LegacyRoomNotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const roomId = typeof params.roomId === "string" ? params.roomId : null;
  const target = new URLSearchParams();
  if (roomId) {
    target.set("roomId", roomId);
    target.set("openMemo", "true");
  }
  redirect(`/room-overview${target.size ? `?${target.toString()}` : ""}`);
}
