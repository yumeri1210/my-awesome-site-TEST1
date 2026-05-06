import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "../../data/users.json");

async function ensureDbFile() {
  const dbDir = path.dirname(dbPath);
  await fs.mkdir(dbDir, { recursive: true });
  try {
    await fs.access(dbPath);
  } catch {
    await fs.writeFile(dbPath, "[]", "utf8");
  }
}

export async function getUsers() {
  await ensureDbFile();
  const raw = await fs.readFile(dbPath, "utf8");
  return JSON.parse(raw);
}

export async function saveUsers(users) {
  await ensureDbFile();
  await fs.writeFile(dbPath, JSON.stringify(users, null, 2), "utf8");
}
