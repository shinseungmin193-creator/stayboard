import type { NextConfig } from "next";
import { APP_BASE_PATH } from "./src/lib/base-path";

const nextConfig: NextConfig = {
  basePath: APP_BASE_PATH,
};

export default nextConfig;
