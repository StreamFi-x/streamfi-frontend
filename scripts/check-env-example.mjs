import fs from "fs";
import path from "path";

/**
 * Audit .env.example against real process.env references in the codebase (#1712).
 */
export function auditEnvExample(projectRoot = process.cwd()) {
  const envExamplePath = path.join(projectRoot, ".env.example");
  if (!fs.existsSync(envExamplePath)) {
    throw new Error(`.env.example not found at ${envExamplePath}`);
  }

  const envContent = fs.readFileSync(envExamplePath, "utf-8");
  const documentedKeys = new Set();
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const key = trimmed.split("=")[0].trim();
    if (key) {
      documentedKeys.add(key);
    }
  }

  const usedKeys = new Set();
  const pattern = /process\.env\.([A-Z0-9_]+)/g;
  const targetDirs = ["app", "lib", "components", "contexts"];

  for (const dir of targetDirs) {
    const fullDir = path.join(projectRoot, dir);
    if (!fs.existsSync(fullDir)) continue;

    function walk(currentDir) {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== ".next") {
            walk(fullPath);
          }
        } else if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          let match;
          while ((match = pattern.exec(content)) !== null) {
            usedKeys.add(match[1]);
          }
        }
      }
    }
    walk(fullDir);
  }

  const missingFromExample = [...usedKeys].filter(k => !documentedKeys.has(k)).sort();
  return {
    documentedCount: documentedKeys.size,
    usedCount: usedKeys.size,
    missingFromExample,
  };
}

// Run directly from CLI
if (process.argv[1] && process.argv[1].endsWith("check-env-example.mjs")) {
  try {
    const result = auditEnvExample();
    console.log(`Documented: ${result.documentedCount}, Used in code: ${result.usedCount}`);
    if (result.missingFromExample.length > 0) {
      console.error("❌ Missing environment variables in .env.example:", result.missingFromExample);
      process.exit(1);
    }
    console.log("✅ .env.example is up to date with all process.env usages.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error running env audit:", err.message);
    process.exit(1);
  }
}
