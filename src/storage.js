import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

const sessionsPath = path.join(config.dataDir, "sessions.json");
const inquiriesPath = path.join(config.dataDir, "inquiries.json");
const processedMessagesPath = path.join(config.dataDir, "processed-messages.json");
const failuresPath = path.join(config.dataDir, "failures.json");

async function ensureDataDir() {
  await fs.mkdir(config.dataDir, { recursive: true });
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await ensureDataDir();
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function getSession(customerId) {
  await ensureDataDir();
  const sessions = await readJson(sessionsPath, {});
  return sessions[customerId] || null;
}

export async function saveSession(customerId, session) {
  const sessions = await readJson(sessionsPath, {});
  sessions[customerId] = {
    ...session,
    updatedAt: new Date().toISOString()
  };
  await writeJson(sessionsPath, sessions);
}

export async function clearSession(customerId) {
  const sessions = await readJson(sessionsPath, {});
  delete sessions[customerId];
  await writeJson(sessionsPath, sessions);
}

export async function saveInquiry(inquiry) {
  const inquiries = await readJson(inquiriesPath, []);
  inquiries.push({
    id: `${Date.now()}-${inquiry.customerId}`,
    ...inquiry,
    createdAt: new Date().toISOString()
  });
  await writeJson(inquiriesPath, inquiries);
}

export async function listInquiries() {
  return readJson(inquiriesPath, []);
}

export async function isMessageProcessed(messageId) {
  const processed = await readJson(processedMessagesPath, {});
  return Boolean(processed[messageId]);
}

export async function markMessageProcessed(messageId) {
  const processed = await readJson(processedMessagesPath, {});
  processed[messageId] = new Date().toISOString();

  const entries = Object.entries(processed).slice(-1000);
  await writeJson(processedMessagesPath, Object.fromEntries(entries));
}

export async function saveFailure(failure) {
  const failures = await readJson(failuresPath, []);
  failures.push({
    ...failure,
    createdAt: new Date().toISOString()
  });
  await writeJson(failuresPath, failures.slice(-200));
}

export async function listFailures() {
  return readJson(failuresPath, []);
}
