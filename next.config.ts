import type { NextConfig } from "next";
import basePathConfig from "./base-path.config.cjs";

const nextConfig: NextConfig = {
  basePath: basePathConfig.APP_BASE_PATH,
};

export default nextConfig;
