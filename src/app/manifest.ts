import type { MetadataRoute } from "next";
import { PWA_PATHS } from "@/features/pwa/domain/pwa";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StayBoard",
    short_name: "StayBoard",
    description: "숙소 운영과 예약, 객실, 청소 현황을 한곳에서 관리합니다.",
    start_url: PWA_PATHS.startUrl,
    scope: PWA_PATHS.scope,
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    icons: [
      {
        src: PWA_PATHS.icon192Url,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: PWA_PATHS.icon512Url,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: PWA_PATHS.maskableIcon512Url,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
