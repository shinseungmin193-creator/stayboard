import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import basePathConfig from "./base-path.config.cjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const escapeRegularExpression = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const nextConfig: NextConfig = {
  basePath: basePathConfig.APP_BASE_PATH,
  webpack(config, { dev }) {
    if (dev && process.platform === "win32") {
      const projectRoot = path.resolve(config.context ?? process.cwd()).replaceAll("\\", "/");
      const outsideProject = new RegExp(`^(?!${escapeRegularExpression(projectRoot)}(?:/|$))`, "i");
      const existingIgnored = config.watchOptions.ignored;

      // Webpack resolves package descriptions through every ancestor directory.
      // Keep those resolver dependencies from expanding Watchpack to the drive root.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: existingIgnored instanceof RegExp
          ? new RegExp(`(?:${existingIgnored.source})|(?:${outsideProject.source})`, "i")
          : outsideProject,
      };
    }

    return config;
  },
};

export default withNextIntl(nextConfig);
