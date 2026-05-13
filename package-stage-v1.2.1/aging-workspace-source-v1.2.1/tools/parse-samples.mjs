import fs from "node:fs/promises";
import { ParsingEngine } from "../parsing-engine/index.js";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node tools/parse-samples.mjs <workbooks.json> [asOfDate] [--output result.json]");
  process.exit(2);
}

const workbooks = JSON.parse(await fs.readFile(input, "utf8"));
const outputIndex = process.argv.indexOf("--output");
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
const asOfDate = process.argv[3] && process.argv[3] !== "--output" ? process.argv[3] : "2026-05-01";
const engine = new ParsingEngine({ asOfDate });
const result = await engine.process(workbooks);
const text = JSON.stringify(result, null, 2);
if (output) {
  await fs.writeFile(output, text, "utf8");
} else {
  console.log(text);
}
