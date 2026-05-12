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
  });
  if (!r.ok) throw new Error(`ollama ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.response.trim();
}

function extractCode(s) {
  const m = s.match(/```(?:[a-z]+)?\n([\s\S]*?)```/);
  return (m ? m[1] : s).trim();
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
