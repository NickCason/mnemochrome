#!/usr/bin/env node
// scripts/steeLL-v1.mjs
// Usage: node scripts/steeLL-v1.mjs <task-name> <output-file>
// Reads spec/prompt from stdin. Writes final code to <output-file>.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const HOST = process.env.OLLAMA_HOST || 'http://100.122.121.18:11434';
const MODEL = 'qwen2.5-coder:7b';
const [, , taskName, outFile] = process.argv;
if (!taskName || !outFile) {
  console.error('Usage: steeLL-v1.mjs <task-name> <output-file>');
  process.exit(2);
}
const spec = readFileSync(0, 'utf8');

async function generate(prompt) {
  const r = await fetch(`${HOST}/api/generate`, {
    method: 'POST',
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0.2 } }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!r.ok) throw new Error(`ollama ${r.status}: ${await r.text()}`);
  const d = await r.json();
  if (typeof d.response !== 'string') {
    throw new Error(`ollama: unexpected response shape: ${JSON.stringify(d).slice(0, 200)}`);
  }
  return d.response.trim();
}

function extractCode(s) {
  const lines = s.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^```[a-z]*\s*$/.test(lines[i])) { start = i + 1; break; }
  }
  if (start === -1) return s.trim();
  let end = lines.length;
  for (let i = lines.length - 1; i >= start; i--) {
    if (/^```\s*$/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n').trim();
}

const initialPrompt = `You are steeLL-v1, a careful junior engineer. Write the contents of \`${outFile}\` per this spec. Output ONLY the file contents inside one fenced code block. No commentary.

SPEC:
${spec}`;

console.error(`[steeLL-v1] ${taskName}: drafting ${outFile}...`);
let code = extractCode(await generate(initialPrompt));

for (let i = 1; i <= 2; i++) {
  const reviewPrompt = `Review the following code for defects against the spec. If you find issues, output a corrected version inside one fenced code block. If the code is correct, output exactly the same code inside one fenced code block. No commentary.

SPEC:
${spec}

CURRENT CODE:
\`\`\`
${code}
\`\`\``;
  console.error(`[steeLL-v1] ${taskName}: self-review pass ${i}/2...`);
  const next = extractCode(await generate(reviewPrompt));
  if (next === code) {
    console.error(`[steeLL-v1] ${taskName}: converged at pass ${i}`);
    break;
  }
  code = next;
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, code + '\n');
console.error(`[steeLL-v1] ${taskName}: wrote ${outFile}`);
