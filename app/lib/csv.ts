// CSV that opens cleanly in Excel and Google Sheets.

type Cell = string | number | null | undefined

// Parents type the notes and names, so a leading = + - @ must not run as a formula.
function neutralize(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function quote(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

// Keeps leading zeros (09171234567) that Excel would otherwise strip.
export function asText(value: string | null | undefined): string {
  return value ? `="${value.replace(/"/g, '""')}"` : ''
}

export function toCsv(header: string[], rows: Cell[][], rawColumns: number[] = []): string {
  const raw = new Set(rawColumns)
  const line = (cells: Cell[]) =>
    cells
      .map((cell, i) => {
        const s = cell == null ? '' : String(cell)
        return quote(raw.has(i) ? s : neutralize(s))
      })
      .join(',')
  // BOM so Excel reads UTF-8 (ñ in names); CRLF is what Excel expects.
  return '﻿' + [line(header), ...rows.map(line)].join('\r\n') + '\r\n'
}
