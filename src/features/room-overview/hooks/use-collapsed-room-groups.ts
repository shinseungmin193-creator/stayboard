"use client";

import { useState } from "react";

export function useCollapsedRoomGroups() {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());

  const toggleGroup = (groupId: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return { collapsedIds, toggleGroup };
}
