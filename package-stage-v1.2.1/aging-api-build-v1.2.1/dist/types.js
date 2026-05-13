// types.ts — API response shapes
export {};
// ParsingPreviewResult is intentionally not duplicated here — the baseline
// JSON itself carries the canonical shape (specVersion, schemaVersion,
// parserVersion, …) and is forwarded as-is to clients. The full TypeScript
// shape lives in aging-app/src/parsing-engine/types.ts.
