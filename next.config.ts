import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import basePathConfig from "./base-path.config.cjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  basePath: basePathConfig.APP_BASE_PATH,
};

export default withNextIntl(nextConfig);
