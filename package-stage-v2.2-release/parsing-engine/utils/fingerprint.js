import { createHash, randomUUID } from "node:crypto";

export function makeUuid() {
  return randomUUID();
}

export function makeSourceIdentityKey(sourceType, internalId, fallbackParts = []) {
  if (internalId !== null && internalId !== undefined && internalId !== "") {
    return `${sourceType}|${internalId}`;
  }
  return `${sourceType}|${fallbackParts.map(cleanPart).join("|")}`;
}

export function makeSourceContentHash(parts) {
  return sha256(parts.map(cleanPart).join("|"));
}

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function cleanPart(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
