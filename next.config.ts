import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  outputFileTracingRoot: root,
  transpilePackages: [
    "@proteus-ui/core",
    "@proteus-ui/tokens",
    "@proteus-ui/theme-default",
  ],
};

export default nextConfig;
