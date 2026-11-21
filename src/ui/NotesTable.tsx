import { Button } from './sakuga'
import type { Notes } from '../domain/schema'

export function NotesTable({ value, onChange }: { value: Notes; onChange: (n: Notes) => void }) {
  const addColumn = () =>
    onChange({
      columns: [...value.columns, `Column ${value.columns.length + 1}`],
      rows: value.rows.map((r) => [...r, '']),
    })

  const addRow = () =>
    onChange({ ...value, rows: [...value.rows, value.columns.map(() => '')] })

  const removeRow = (index: number) =>
    onChange({ ...value, rows: value.rows.filter((_, i) => i !== index) })

  const setColumn = (index: number, text: string) =>
    onChange({ ...value, columns: value.columns.map((c, i) => (i === index ? text : c)) })

  const setCell = (row: number, col: number, text: string) =>
    onChange({
      ...value,
      rows: value.rows.map((r, i) => (i === row ? r.map((c, j) => (j === col ? text : c)) : r)),
    })

  return (
    <div className="notes">
      <table>
        <thead>
          <tr>
            {value.columns.map((column, i) => (
              <th key={i} scope="col">
                <input
                  aria-label={`Column ${i + 1} name`}
                  value={column}
                  onChange={(e) => setColumn(i, e.target.value)}
                />
              </th>
            ))}
            {value.columns.length > 0 && <th scope="col" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {value.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, colIndex) => (
                <td key={colIndex}>
                  <input
                    aria-label={`${value.columns[colIndex]} for row ${rowIndex + 1}`}
                    value={cell}
                    onChange={(e) => setCell(rowIndex, colIndex, e.target.value)}
                  />
                </td>
              ))}
              <td>
                <Button onClick={() => removeRow(rowIndex)}>Remove row</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="notes__actions">
        <Button onClick={addColumn}>Add column</Button>
        <Button onClick={addRow} disabled={value.columns.length === 0}>Add row</Button>
      </div>
    </div>
  )
}
