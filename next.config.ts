import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  outputFileTracingRoot: root,
  serverExternalPackages: [
    "@libsql/client",
    "@libsql/hrana-client",
    "@libsql/isomorphic-ws",
    "@libsql/isomorphic-fetch",
  ],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@libsql/client/**/*",
      "./node_modules/@libsql/hrana-client/**/*",
      "./node_modules/@libsql/isomorphic-ws/**/*",
      "./node_modules/@libsql/isomorphic-fetch/**/*",
    ],
  },
  transpilePackages: [
    "@proteus-ui/core",
    "@proteus-ui/tokens",
    "@proteus-ui/theme-default",
  ],
};

export default nextConfig;
