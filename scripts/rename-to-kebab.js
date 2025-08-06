import fs from "fs";
import path from "path";

const EXCLUDE_DIRS = ['node_modules', '.git', '.next', 'dist', 'build'];

function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function renameItem(fullPath) {
  const dir = path.dirname(fullPath);
  const ext = path.extname(fullPath);
  const base = path.basename(fullPath, ext);
  const kebabName = toKebabCase(base) + ext;
  const newPath = path.join(dir, kebabName);

  if (fullPath !== newPath) {
    console.log(`Renaming: ${fullPath} -> ${newPath}`);
    fs.renameSync(fullPath, newPath);
    return newPath;
  }
  return fullPath;
}

function renameRecursively(dir) {
  if (EXCLUDE_DIRS.includes(path.basename(dir))) {
    return;
  }

  let items = fs.readdirSync(dir);

  // Rename files first to avoid conflicts
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      renameItem(fullPath);
    }
  }

  // Then recurse and rename directories
  items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !EXCLUDE_DIRS.includes(item)) {
      renameRecursively(fullPath);
      renameItem(fullPath);
    }
  }
}

renameRecursively(process.cwd());
