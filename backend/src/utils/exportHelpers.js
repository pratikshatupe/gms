'use strict';

const ExcelJS = require('exceljs');

async function toExcel(headers, rows, sheetName = 'Report') {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = headers.map((h) => ({
    header: h.label,
    key: h.key,
    width: h.width || 20,
  }));

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0284C7' },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  rows.forEach((row) => sheet.addRow(row));

  return workbook.xlsx.writeBuffer();
}

function toCsv(headers, rows) {
  const { Parser } = require('json2csv');
  const fields = headers.map((h) => ({ label: h.label, value: h.key }));
  const parser = new Parser({ fields });
  return parser.parse(rows);
}

module.exports = { toExcel, toCsv };
