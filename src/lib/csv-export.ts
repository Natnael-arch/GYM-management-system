export function exportToCSV(filename: string, headers: string[], rows: any[][]) {
  // 1. Build CSV content
  const csvContent = [
    headers.map(escapeCSVCell).join(','), // Header row
    ...rows.map(row => row.map(escapeCSVCell).join(',')) // Data rows
  ].join('\n');

  // 2. Create Blob and Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSVCell(cell: any): string {
  if (cell === null || cell === undefined) return '';
  const cellStr = String(cell);
  // Escape quotes and wrap in quotes if contains comma, newline or quotes
  if (/[",\n]/.test(cellStr)) {
    return `"${cellStr.replace(/"/g, '""')}"`;
  }
  return cellStr;
}
