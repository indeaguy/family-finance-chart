/**
 * Parse historical account balance files (CSV, OFX/QFX, QIF) into monthly ending balances.
 * Defines globals: parseHistoricalBalanceFile, aggregateBalancesByMonth,
 *   detectHistoricalBalanceFormat, HistoricalImportError
 * Depends on: none (pure text parsing)
 *
 * Aggregation: last dated observation in each calendar month wins (same-day: last in file order).
 * Balances are stored as non-negative absolute values for entity balanceOverrides.
 */

class HistoricalImportError extends Error {
    constructor(message) {
        super(message);
        this.name = 'HistoricalImportError';
    }
}

/**
 * @param {{ date: Date, balance: number }[]} observations
 * @returns {{ [yyyyMm: string]: number }}
 */
function aggregateBalancesByMonth(observations) {
    /** @type {Map<string, { day: number, balance: number, order: number }>} */
    const best = new Map();
    observations.forEach((obs, order) => {
        // Avoid instanceof Date — fails across vm/iframe realms in tests.
        const date = obs && obs.date;
        if (!date || typeof date.getFullYear !== 'function' || Number.isNaN(date.getTime())) return;
        if (!Number.isFinite(obs.balance)) return;
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        const day = date.getDate();
        const yyyyMm = `${y}-${String(m).padStart(2, '0')}`;
        const balance = Math.abs(obs.balance);
        const prev = best.get(yyyyMm);
        if (!prev || day > prev.day || (day === prev.day && order >= prev.order)) {
            best.set(yyyyMm, { day, balance, order });
        }
    });
    const monthly = {};
    [...best.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([key, value]) => {
            monthly[key] = value.balance;
        });
    return monthly;
}

/**
 * @param {string} filename
 * @param {string} text
 * @returns {'csv'|'ofx'|'qif'}
 */
function detectHistoricalBalanceFormat(filename, text) {
    const name = String(filename || '').toLowerCase();
    const sample = String(text || '').slice(0, 4000);
    if (name.endsWith('.ofx') || name.endsWith('.qfx')) return 'ofx';
    if (name.endsWith('.qif')) return 'qif';
    if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
        if (/^\s*OFXHEADER:|<\s*OFX\b/i.test(sample)) return 'ofx';
        if (/^\s*!Type:/m.test(sample) || /^\s*!Account/m.test(sample)) return 'qif';
        return 'csv';
    }
    if (/^\s*OFXHEADER:|<\s*OFX\b/i.test(sample)) return 'ofx';
    if (/^\s*!Type:/m.test(sample) || /^\s*!Account/m.test(sample)) return 'qif';
    return 'csv';
}

/**
 * @param {string} filename
 * @param {string} text
 * @returns {{ monthly: Object<string, number>, observations: {date:Date,balance:number}[], format: string, warnings: string[] }}
 */
function parseHistoricalBalanceFile(filename, text) {
    const format = detectHistoricalBalanceFormat(filename, text);
    const warnings = [];
    let observations;
    if (format === 'ofx') {
        observations = parseOfxBalances(text, warnings);
    } else if (format === 'qif') {
        observations = parseQifBalances(text, warnings);
    } else {
        observations = parseCsvBalances(text, warnings);
    }
    const monthly = aggregateBalancesByMonth(observations);
    const monthKeys = Object.keys(monthly);
    if (monthKeys.length === 0) {
        throw new HistoricalImportError(
            `No monthly balances found in ${format.toUpperCase()} file. ` +
            'Expected dated balance rows (CSV date+balance columns), OFX LEDGERBAL/BALAMT, ' +
            'or QIF opening balance + transactions.'
        );
    }
    return { monthly, observations, format, warnings };
}

// --- number / date helpers ---

function parseBalanceNumber(raw) {
    if (raw == null) return NaN;
    let s = String(raw).trim();
    if (!s) return NaN;
    let negative = false;
    if (/^\(.*\)$/.test(s)) {
        negative = true;
        s = s.slice(1, -1);
    }
    s = s.replace(/[$€£¥]/g, '').replace(/,/g, '').replace(/\s/g, '');
    if (s.endsWith('-')) {
        negative = true;
        s = s.slice(0, -1);
    }
    if (s.startsWith('+')) s = s.slice(1);
    const n = Number(s);
    if (!Number.isFinite(n)) return NaN;
    return negative ? -Math.abs(n) : n;
}

/**
 * @param {string} raw
 * @returns {Date|null}
 */
function parseFlexibleDate(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;

    // YYYY-MM-DD or YYYY/MM/DD
    let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (m) {
        return makeDate(+m[1], +m[2], +m[3]);
    }
    // YYYY-MM (month-end style: use day 1; last-of-month aggregation still works for single point)
    m = s.match(/^(\d{4})[-/](\d{1,2})$/);
    if (m) {
        return makeDate(+m[1], +m[2], 1);
    }
    // Quicken D: M/D'YY or M/D/YY or M/D/YYYY
    m = s.match(/^(\d{1,2})\/(\d{1,2})(?:'|\/)(\d{2,4})$/);
    if (m) {
        let year = +m[3];
        if (year < 100) year += year >= 70 ? 1900 : 2000;
        return makeDate(year, +m[1], +m[2]);
    }
    // ISO-ish with time
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]/);
    if (m) {
        return makeDate(+m[1], +m[2], +m[3]);
    }
    return null;
}

function makeDate(year, month, day) {
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
}

function parseOfxDate(raw) {
    const s = String(raw || '').trim();
    const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    return makeDate(+m[1], +m[2], +m[3]);
}

// --- CSV ---

function sniffCsvDelimiter(text) {
    const firstLines = String(text).split(/\r?\n/).slice(0, 5).join('\n');
    const counts = {
        ',': (firstLines.match(/,/g) || []).length,
        ';': (firstLines.match(/;/g) || []).length,
        '\t': (firstLines.match(/\t/g) || []).length
    };
    let best = ',';
    let bestCount = -1;
    Object.entries(counts).forEach(([delim, count]) => {
        if (count > bestCount) {
            best = delim;
            bestCount = count;
        }
    });
    return best;
}

function parseCsvLine(line, delimiter) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === delimiter) {
            cells.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    cells.push(current.trim());
    return cells;
}

function normalizeHeader(h) {
    return String(h || '')
        .trim()
        .toLowerCase()
        .replace(/[_\-]+/g, ' ')
        .replace(/\s+/g, ' ');
}

function findCsvColumnIndexes(headers) {
    const normalized = headers.map(normalizeHeader);
    const dateAliases = [
        'date', 'as of', 'as of date', 'balance date', 'posted date',
        'transaction date', 'value date', 'statement date'
    ];
    const balanceAliases = [
        'balance', 'ending balance', 'end balance', 'ledger balance',
        'current balance', 'running balance', 'available balance',
        'account balance', 'closing balance', 'bal'
    ];
    let dateIdx = -1;
    let balanceIdx = -1;
    for (let i = 0; i < normalized.length; i++) {
        if (dateIdx < 0 && dateAliases.includes(normalized[i])) dateIdx = i;
        if (balanceIdx < 0 && balanceAliases.includes(normalized[i])) balanceIdx = i;
    }
    // Partial contains fallback
    if (dateIdx < 0) {
        dateIdx = normalized.findIndex((h) => h === 'date' || h.endsWith(' date') || h.startsWith('date '));
    }
    if (balanceIdx < 0) {
        balanceIdx = normalized.findIndex((h) => h.includes('balance') && !h.includes('available credit'));
    }
    return { dateIdx, balanceIdx };
}

function parseCsvBalances(text, warnings) {
    const lines = String(text || '')
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    if (lines.length === 0) {
        throw new HistoricalImportError('CSV file is empty');
    }
    const delimiter = sniffCsvDelimiter(text);
    const rows = lines.map((line) => parseCsvLine(line, delimiter));
    const first = rows[0];
    const headerProbe = findCsvColumnIndexes(first);
    const hasHeader = headerProbe.dateIdx >= 0 && headerProbe.balanceIdx >= 0;

    let dateIdx;
    let balanceIdx;
    let dataRows;
    if (hasHeader) {
        dateIdx = headerProbe.dateIdx;
        balanceIdx = headerProbe.balanceIdx;
        dataRows = rows.slice(1);
    } else {
        // Headerless: first col date, second balance — reject if first cell is not a date
        const probeDate = parseFlexibleDate(first[0]);
        if (!probeDate || first.length < 2) {
            throw new HistoricalImportError(
                'CSV needs a Date column and a Balance column ' +
                '(or headerless rows: date, balance).'
            );
        }
        dateIdx = 0;
        balanceIdx = 1;
        dataRows = rows;
        warnings.push('CSV had no recognized headers; used column 1 as date and column 2 as balance.');
    }

    const observations = [];
    dataRows.forEach((cells, i) => {
        if (!cells || cells.length === 0) return;
        const date = parseFlexibleDate(cells[dateIdx]);
        const balance = parseBalanceNumber(cells[balanceIdx]);
        if (!date || !Number.isFinite(balance)) {
            warnings.push(`Skipped CSV row ${i + (hasHeader ? 2 : 1)}: invalid date or balance.`);
            return;
        }
        observations.push({ date, balance });
    });
    return observations;
}

// --- OFX / QFX ---

function parseOfxBalances(text, warnings) {
    const raw = String(text || '');
    // Prefer SGML-ish tag extraction; also works for simple XML OFX
    const observations = [];

    // LEDGERBAL / AVAILBAL / BAL blocks: capture inner content then DTASOF + BALAMT
    const blockRe = /<(LEDGERBAL|AVAILBAL|BAL)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
    let blockMatch;
    let foundBlocks = false;
    while ((blockMatch = blockRe.exec(raw)) !== null) {
        foundBlocks = true;
        const body = blockMatch[2];
        const amt = tagValue(body, 'BALAMT');
        const dt = tagValue(body, 'DTASOF') || tagValue(body, 'DTPOSTED');
        const balance = parseBalanceNumber(amt);
        const date = parseOfxDate(dt);
        if (date && Number.isFinite(balance)) {
            observations.push({ date, balance });
        } else {
            warnings.push('Skipped incomplete OFX balance block (missing BALAMT or DTASOF).');
        }
    }

    // SGML OFX (no closing tags): <LEDGERBAL><BALAMT>1.00<DTASOF>20240131
    if (!foundBlocks) {
        const sgmlBlockRe = /<(LEDGERBAL|AVAILBAL|BAL)\s*>([\s\S]*?)(?=<(?:LEDGERBAL|AVAILBAL|BAL|BANKTRANLIST|CCACCTFROM|STOCKINFO|\/OFX|\/STMTRS|\/CCSTMTRS)\b|$)/gi;
        let sgmlMatch;
        while ((sgmlMatch = sgmlBlockRe.exec(raw)) !== null) {
            const body = sgmlMatch[2];
            const amt = sgmlTagValue(body, 'BALAMT');
            const dt = sgmlTagValue(body, 'DTASOF') || sgmlTagValue(body, 'DTPOSTED');
            const balance = parseBalanceNumber(amt);
            const date = parseOfxDate(dt);
            if (date && Number.isFinite(balance)) {
                observations.push({ date, balance });
            }
        }
    }

    // Standalone BALAMT + nearby DTASOF pairs (multi-snapshot exports)
    if (observations.length === 0) {
        const pairRe = /<BALAMT\s*>([^<\r\n]+)[\s\S]{0,120}?<DTASOF\s*>([^<\r\n]+)|<DTASOF\s*>([^<\r\n]+)[\s\S]{0,120}?<BALAMT\s*>([^<\r\n]+)/gi;
        let pairMatch;
        while ((pairMatch = pairRe.exec(raw)) !== null) {
            const amt = pairMatch[1] || pairMatch[4];
            const dt = pairMatch[2] || pairMatch[3];
            const balance = parseBalanceNumber(amt);
            const date = parseOfxDate(dt);
            if (date && Number.isFinite(balance)) {
                observations.push({ date, balance });
            }
        }
    }

    // Rare: per-transaction running balance <BALAMT> inside STMTTRN with DTPOSTED
    const txnRe = /<STMTTRN\b[^>]*>([\s\S]*?)<\/STMTTRN\s*>/gi;
    let txnMatch;
    while ((txnMatch = txnRe.exec(raw)) !== null) {
        const body = txnMatch[1];
        const amt = tagValue(body, 'BALAMT') || tagValue(body, 'BALANCE');
        if (amt == null) continue;
        const dt = tagValue(body, 'DTPOSTED') || tagValue(body, 'DTUSER');
        const balance = parseBalanceNumber(amt);
        const date = parseOfxDate(dt);
        if (date && Number.isFinite(balance)) {
            observations.push({ date, balance });
        }
    }

    if (observations.length === 0) {
        warnings.push('OFX contained no LEDGERBAL/AVAILBAL/BAL snapshots with BALAMT + date.');
    }
    return observations;
}

function tagValue(body, tag) {
    const re = new RegExp(`<${tag}\\b[^>]*>([^<]*)`, 'i');
    const m = String(body).match(re);
    return m ? m[1].trim() : null;
}

function sgmlTagValue(body, tag) {
    return tagValue(body, tag);
}

// --- QIF ---

function parseQifBalances(text, warnings) {
    const records = String(text || '')
        .replace(/^\uFEFF/, '')
        .split(/^\^/m)
        .map((chunk) => chunk.trim())
        .filter(Boolean);

    /** @type {{ date: Date, balance: number }[]} */
    const explicit = [];
    /** @type {{ date: Date, amount: number, payee: string, memo: string }[]} */
    const txns = [];

    records.forEach((record) => {
        const lines = record.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        let date = null;
        let amount = NaN;
        let payee = '';
        let memo = '';
        let cleared = '';
        lines.forEach((line) => {
            const code = line.charAt(0);
            const value = line.slice(1).trim();
            switch (code) {
                case 'D':
                    date = parseFlexibleDate(value) || parseQifDate(value);
                    break;
                case 'T':
                case 'U':
                    amount = parseBalanceNumber(value);
                    break;
                case 'P':
                    payee = value;
                    break;
                case 'M':
                    memo = value;
                    break;
                case 'C':
                    cleared = value;
                    break;
                case '!':
                    // Type / Account headers — ignore for observations
                    break;
                default:
                    break;
            }
        });
        if (!date || !Number.isFinite(amount)) return;

        const blob = `${payee} ${memo} ${cleared}`.toLowerCase();
        if (/\bbalance\b/.test(blob) && !/opening balance/.test(blob)) {
            explicit.push({ date, balance: amount });
            return;
        }
        txns.push({ date, amount, payee, memo });
    });

    if (explicit.length > 0 && txns.length === 0) {
        return explicit;
    }

    if (txns.length === 0) {
        if (explicit.length > 0) return explicit;
        warnings.push('QIF contained no dated amount records.');
        return [];
    }

    // Sort chronologically; stable for equal dates by original order via index
    txns.sort((a, b) => a.date - b.date);

    let openingIdx = txns.findIndex((t) => /opening balance/i.test(t.payee) || /opening balance/i.test(t.memo));
    let running;
    let startIndex;
    if (openingIdx >= 0) {
        running = txns[openingIdx].amount;
        startIndex = openingIdx + 1;
        // Opening balance itself is an observation
        const observations = [{ date: txns[openingIdx].date, balance: running }];
        for (let i = startIndex; i < txns.length; i++) {
            running += txns[i].amount;
            observations.push({ date: txns[i].date, balance: running });
        }
        // Merge any explicit balance records too
        return observations.concat(explicit);
    }

    // No opening balance: treat first txn amount as starting balance if later amounts look like deltas
    // Safer heuristic: first record sets balance, subsequent are applied as deltas.
    running = txns[0].amount;
    const observations = [{ date: txns[0].date, balance: running }];
    for (let i = 1; i < txns.length; i++) {
        running += txns[i].amount;
        observations.push({ date: txns[i].date, balance: running });
    }
    warnings.push('QIF had no Opening Balance payee; used first amount as starting balance, then applied later amounts as deltas.');
    return observations.concat(explicit);
}

function parseQifDate(raw) {
    // Already covered by parseFlexibleDate for most; handle M/D'YY explicitly if needed
    return parseFlexibleDate(raw);
}
