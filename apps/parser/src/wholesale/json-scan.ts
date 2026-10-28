/**
 * Reads the JSON value that starts at `start` inside a larger text (a page's script): objects and arrays by bracket
 * matching with strings respected, primitives up to the next delimiter. Pages embed data this way without a clean
 * boundary, so `JSON.parse` of a slice is the only safe read.
 */
export function readJsonValue(text: string, start: number): unknown {
  const open = text[start];
  if (open !== '{' && open !== '[') {
    const end = text.slice(start).search(/[,;}\]\n]/);
    return JSON.parse(text.slice(start, end < 0 ? undefined : start + end).trim());
  }
  let depth = 0, inString = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) { if (char === '\\') index += 1; else if (char === '"') inString = false; continue; }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') depth += 1;
    else if (char === '}' || char === ']') { depth -= 1; if (depth === 0) return JSON.parse(text.slice(start, index + 1)); }
  }
  throw new Error('json-scan: the value is cut off');
}
