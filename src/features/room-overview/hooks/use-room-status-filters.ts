"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MobileRoomFilters } from "../domain/room-overview-mobile";

function setOrDelete(params: URLSearchParams, key: string, value: string, defaultValue = "") {
  if (!value || value === defaultValue) params.delete(key);
  else params.set(key, value);
}

function writeFilterParams(params: URLSearchParams, filters: MobileRoomFilters, propertyId?: string) {
  setOrDelete(params, "query", filters.query);
  setOrDelete(params, "mobileStatus", filters.status, "ALL");
  setOrDelete(params, "ota", filters.ota, "ALL");
  setOrDelete(params, "syncError", filters.sync, "ALL");
  setOrDelete(params, "propertyId", propertyId ?? "");
}

export function useRoomStatusFilters(input: {
  initialFilters: MobileRoomFilters;
  initialPropertyId?: string;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(input.initialFilters);

  const replaceLocalUrl = (next: MobileRoomFilters, propertyId = input.initialPropertyId) => {
    const params = new URLSearchParams(window.location.search);
    writeFilterParams(params, next, propertyId);
    window.history.replaceState(null, "", params.size ? `?${params.toString()}` : window.location.pathname);
  };

  const updateQuery = (query: string) => {
    const next = { ...filters, query };
    setFilters(next);
    replaceLocalUrl(next);
  };

  const updateStatus = (status: MobileRoomFilters["status"]) => {
    const next = { ...filters, status };
    setFilters(next);
    replaceLocalUrl(next);
  };

  const applyFilters = (next: MobileRoomFilters, propertyId?: string) => {
    setFilters(next);
    const params = new URLSearchParams(window.location.search);
    writeFilterParams(params, next, propertyId);
    if (propertyId !== input.initialPropertyId) {
      router.replace(params.size ? `/room-overview?${params.toString()}` : "/room-overview");
      return;
    }
    window.history.replaceState(null, "", params.size ? `?${params.toString()}` : window.location.pathname);
  };

  const resetFilters = () => {
    const next: MobileRoomFilters = { query: "", status: "ALL", ota: "ALL", sync: "ALL" };
    applyFilters(next, undefined);
  };

  return { filters, updateQuery, updateStatus, applyFilters, resetFilters };
}
