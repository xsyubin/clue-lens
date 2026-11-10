import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 是原生模块，不能被打包进 bundle
  serverExternalPackages: ["better-sqlite3"],
  // 支持构建目录隔离，防止门禁构建清空开发服运行缓存
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
