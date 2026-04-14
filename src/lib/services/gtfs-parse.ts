import JSZip from 'jszip';

export async function parseGtfsZip(
	zipBuffer: Buffer
): Promise<Record<string, string>> {
	const zip = await JSZip.loadAsync(zipBuffer);
	const files: Record<string, string> = {};

	for (const [name, file] of Object.entries(zip.files)) {
		if (file.dir || name.startsWith('__MACOSX')) continue;
		const basename = name.split('/').pop() ?? name;
		if (basename.endsWith('.txt')) {
			files[basename] = await file.async('string');
		}
	}

	return files;
}

export function parseCsv(content: string): Record<string, string>[] {
	// Strip BOM
	const clean = content.replace(/^\ufeff/, '');
	const lines = clean.split(/\r?\n/).filter((line) => line.trim() !== '');

	if (lines.length < 2) return [];

	const headers = parseCsvLine(lines[0]);
	const rows: Record<string, string>[] = [];

	for (let i = 1; i < lines.length; i++) {
		const values = parseCsvLine(lines[i]);
		const row: Record<string, string> = {};
		for (let j = 0; j < headers.length; j++) {
			row[headers[j]] = values[j] ?? '';
		}
		rows.push(row);
	}

	return rows;
}

function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (inQuotes) {
			if (char === '"' && line[i + 1] === '"') {
				current += '"';
				i++;
			} else if (char === '"') {
				inQuotes = false;
			} else {
				current += char;
			}
		} else {
			if (char === '"') {
				inQuotes = true;
			} else if (char === ',') {
				fields.push(current.trim());
				current = '';
			} else {
				current += char;
			}
		}
	}
	fields.push(current.trim());
	return fields;
}
