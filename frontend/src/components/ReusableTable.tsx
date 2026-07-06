import type { ReactNode } from "react";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
}

interface ReusableTableProps<T> {
  columns: Array<TableColumn<T>>;
  data: T[];
  emptyMessage: string;
}

export function ReusableTable<T>({ columns, data, emptyMessage }: ReusableTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3">{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3">{column.render(item)}</td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td className="px-4 py-10 text-center text-gray-500" colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

