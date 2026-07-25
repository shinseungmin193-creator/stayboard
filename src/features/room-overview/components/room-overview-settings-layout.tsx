"use client";

import type { ReactNode } from "react";
import { useDeveloperSettings } from "@/features/developer-settings";
import styles from "./room-overview-visuals.module.css";

interface RoomOverviewSettingsLayoutProps {
  children: ReactNode;
  schedulePanel: ReactNode;
}

export function RoomOverviewSettingsLayout({ children, schedulePanel }: RoomOverviewSettingsLayoutProps) {
  const { settings } = useDeveloperSettings();
  const schedulePanelVisible = settings.roomOverview.schedulePanelVisible;

  return (
    <div className={styles.overviewLayout} data-schedule-visible={schedulePanelVisible}>
      {children}
      {schedulePanelVisible ? (
        <aside data-room-overview-schedule-panel>
          {schedulePanel}
        </aside>
      ) : null}
    </div>
  );
}
