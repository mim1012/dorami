import * as ExcelJS from 'exceljs';

export type ImportField = 'productName' | 'option' | 'price' | 'stock';

export interface ParsedExcelSheet {
  sheetName: string;
  headerRowIndex: number;
  headers: string[];
  rows: Array<Record<string, string>>;
  rawPreviewRows: string[][];
}

export interface ImportColumnMapping {
  productName: string;
  option: string;
  price: string;
  stock: string;
}

export interface NormalizedImportProduct {
  key: string;
  name: string;
  price: number;
  stock: number;
  optionValues: string[];
  rowCount: number;
  sourceRows: number[];
}

export interface ImportPreviewResult {
  products: NormalizedImportProduct[];
  warnings: string[];
  errors: string[];
}

export const UNMAPPED_COLUMN = '__UNMAPPED__';

const HEADER_CANDIDATES: Record<ImportField, string[]> = {
  productName: ['품명', '상품명', '상품', 'product', 'product_name', 'name', 'item'],
  option: ['옵션', '컬러', '색상', 'option', 'color', 'size', '사이즈'],
  price: ['판매가', '단가', '가격', '금액', 'price', 'sale_price', '판매가격'],
  stock: ['재고', '수량', 'stock', 'qty', 'quantity', '합계 : 수량', '수량합계'],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && value && 'text' in (value as Record<string, unknown>)) {
    return String((value as { text?: unknown }).text ?? '').trim();
  }
  return String(value).trim();
}

function isMeaningfulValue(value: string): boolean {
  const normalized = value.trim();
  return !!normalized && normalized !== '-' && normalized !== '(비어 있음)' && normalized !== '없음';
}

function parseNumber(value: string): number | null {
  const cleaned = value.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function scoreHeaderRow(cells: string[]): number {
  let score = 0;
  for (const cell of cells) {
    const normalized = normalizeHeader(cell);
    if (!normalized) continue;
    for (const candidates of Object.values(HEADER_CANDIDATES)) {
      if (candidates.some((candidate) => normalizeHeader(candidate) === normalized)) {
        score += 3;
      }
    }
    if (/[가-힣a-z]/i.test(cell)) score += 1;
  }
  return score;
}

export function inferColumnMapping(headers: string[]): ImportColumnMapping {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));

  const resolveField = (field: ImportField): string => {
    const found = normalizedHeaders.find((header) =>
      HEADER_CANDIDATES[field].some((candidate) => normalizeHeader(candidate) === header.normalized),
    );
    return found?.original ?? UNMAPPED_COLUMN;
  };

  return {
    productName: resolveField('productName'),
    option: resolveField('option'),
    price: resolveField('price'),
    stock: resolveField('stock'),
  };
}

function extractRowValues(row: ExcelJS.Row): string[] {
  const values = Array.isArray(row.values) ? row.values.slice(1) : [];
  return values.map((value) => normalizeCell(value));
}

export async function parseExcelFile(file: File): Promise<ParsedExcelSheet> {
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  let bestSheet: ParsedExcelSheet | null = null;

  workbook.eachSheet((worksheet) => {
    const firstRows: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > 20) return;
      firstRows.push(extractRowValues(row));
    });

    if (firstRows.length === 0) return;

    let bestHeaderIndex = 0;
    let bestHeaderScore = -1;
    firstRows.forEach((cells, index) => {
      const score = scoreHeaderRow(cells);
      if (score > bestHeaderScore) {
        bestHeaderScore = score;
        bestHeaderIndex = index;
      }
    });

    const headers = firstRows[bestHeaderIndex]?.map((value, idx) => value || `column_${idx + 1}`) ?? [];
    const rows: Array<Record<string, string>> = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= bestHeaderIndex + 1) return;
      const values = extractRowValues(row);
      if (values.every((value) => !value)) return;
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = values[index] ?? '';
      });
      record.__rowNumber = String(rowNumber);
      rows.push(record);
    });

    const candidate: ParsedExcelSheet = {
      sheetName: worksheet.name,
      headerRowIndex: bestHeaderIndex + 1,
      headers,
      rows,
      rawPreviewRows: firstRows.slice(0, 8),
    };

    if (!bestSheet || candidate.rows.length > bestSheet.rows.length) {
      bestSheet = candidate;
    }
  });

  if (!bestSheet) {
    throw new Error('엑셀에서 읽을 수 있는 시트를 찾지 못했습니다.');
  }

  return bestSheet;
}

export function buildImportPreview(params: {
  parsed: ParsedExcelSheet;
  mapping: ImportColumnMapping;
  defaultStock: string;
  defaultPrice?: string;
}): ImportPreviewResult {
  const { parsed, mapping, defaultStock, defaultPrice } = params;
  const products = new Map<string, NormalizedImportProduct>();
  const warnings: string[] = [];
  const errors: string[] = [];

  const fallbackStock = parseNumber(defaultStock);
  const fallbackPrice = parseNumber(defaultPrice ?? '');

  if (mapping.productName === UNMAPPED_COLUMN) {
    errors.push('상품명 컬럼을 선택해야 합니다.');
  }
  if (mapping.price === UNMAPPED_COLUMN && fallbackPrice === null) {
    errors.push('가격 컬럼이 없으면 기본 가격을 입력해야 합니다.');
  }
  if (mapping.stock === UNMAPPED_COLUMN && fallbackStock === null) {
    errors.push('재고 컬럼이 없으면 기본 재고를 입력해야 합니다.');
  }
  if (errors.length > 0) {
    return { products: [], warnings, errors };
  }

  for (const row of parsed.rows) {
    const rowNumber = Number(row.__rowNumber || 0);
    const productName = row[mapping.productName]?.trim() ?? '';
    if (!productName) {
      warnings.push(`${rowNumber}행: 상품명이 비어 있어 제외했습니다.`);
      continue;
    }

    const optionRaw = mapping.option !== UNMAPPED_COLUMN ? row[mapping.option]?.trim() ?? '' : '';
    const priceValue =
      mapping.price !== UNMAPPED_COLUMN
        ? parseNumber(row[mapping.price] ?? '')
        : fallbackPrice;
    const stockValue =
      mapping.stock !== UNMAPPED_COLUMN
        ? parseNumber(row[mapping.stock] ?? '')
        : fallbackStock;

    if (priceValue === null || priceValue <= 0) {
      warnings.push(`${rowNumber}행: 가격을 읽지 못해 제외했습니다.`);
      continue;
    }
    if (stockValue === null || stockValue <= 0) {
      warnings.push(`${rowNumber}행: 재고를 읽지 못해 제외했습니다.`);
      continue;
    }

    const key = `${productName}::${priceValue}`;
    const existing = products.get(key);

    if (!existing) {
      products.set(key, {
        key,
        name: productName,
        price: priceValue,
        stock: stockValue,
        optionValues: isMeaningfulValue(optionRaw) ? [optionRaw] : [],
        rowCount: 1,
        sourceRows: rowNumber ? [rowNumber] : [],
      });
      continue;
    }

    existing.stock += stockValue;
    existing.rowCount += 1;
    if (rowNumber) existing.sourceRows.push(rowNumber);
    if (isMeaningfulValue(optionRaw) && !existing.optionValues.includes(optionRaw)) {
      existing.optionValues.push(optionRaw);
    }
  }

  return {
    products: Array.from(products.values()),
    warnings,
    errors,
  };
}
