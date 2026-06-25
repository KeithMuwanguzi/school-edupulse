/** Parse simple CSV text (comma-separated, optional header row). */
export function parseCsv(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((line) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    cells.push(current.trim());
    return cells;
  });
}

export function csvHasHeader(firstRow: string[], expected: string[]): boolean {
  if (firstRow.length < expected.length) return false;
  return expected.every((col, i) => firstRow[i]?.toLowerCase() === col.toLowerCase());
}
