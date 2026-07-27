"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

export function useTimelineScroll(input: {
  anchorIndex: number;
  columnWidth: number;
  roomColumnWidth: number;
  scrollRequest: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { anchorIndex, columnWidth, roomColumnWidth, scrollRequest } = input;

  const scrollToAnchor = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = containerRef.current;
    if (!container) return;
    const timelineViewportWidth = Math.max(0, container.clientWidth - roomColumnWidth);
    const centeredOffset = (timelineViewportWidth - columnWidth) / 2;
    const target = Math.max(0, anchorIndex * columnWidth - centeredOffset);
    container.scrollTo({ left: target, behavior });
  }, [anchorIndex, columnWidth, roomColumnWidth]);

  useLayoutEffect(() => {
    scrollToAnchor(scrollRequest > 0 ? "smooth" : "auto");
  }, [scrollRequest, scrollToAnchor]);

  return { containerRef, scrollToAnchor };
}
