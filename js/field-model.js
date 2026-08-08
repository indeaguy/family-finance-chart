/**
 * Reusable field-schema helpers: filter by surface, format/parse, serialize/hydrate,
 * and render form / table / detail markup from a field array.
 * Defines globals: filterFields, formatFieldValue, readFormValue, getFieldDisplayValue,
 *   serializeEntity, hydrateEntity, formFieldDomId, renderFormFields, renderTable, renderDetailRows
 * Depends on: none (schemas + compute ctx are provided by callers)
 *
 * Field shape (per entity schema, e.g. LOAN_FIELDS):
 *   key, label, type ('number'|'month'|'currency'|'percent'|'years'|'boolean'|'text'),
 *   form, table, detail, export, import,
 *   optional: domId, default, formLabel, tableLabel, formOrder/tableOrder/detailOrder, inputAttrs,
 *   optional: computed + compute(entity, ctx), display(entity, ctx), format(value, entity, ctx),
 *   optional: exportValue(entity), detailLabel(entity), parse(raw)
 */

function filterFields(fields, surface) {
    const orderKey = surface + 'Order';
    return (fields || [])
        .map((field, index) => ({ field, index }))
        .filter(({ field }) => field[surface])
        .sort((a, b) => {
            const ao = a.field[orderKey];
            const bo = b.field[orderKey];
            if (ao !== undefined || bo !== undefined) {
                return (ao !== undefined ? ao : a.index) - (bo !== undefined ? bo : b.index);
            }
            return a.index - b.index;
        })
        .map(({ field }) => field);
}

function formatFieldValue(field, value) {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    switch (field.type) {
        case 'currency': {
            const n = Number(value);
            if (!Number.isFinite(n)) return '—';
            return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
        }
        case 'percent':
            return `${value}%`;
        case 'years':
            return `${value}yr`;
        case 'boolean':
            return value ? 'Yes' : 'No';
        case 'month': {
            if (typeof value !== 'string' || !value) return '—';
            const d = new Date(value + '-01');
            if (Number.isNaN(d.getTime())) return value;
            return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        }
        default:
            return String(value);
    }
}

function getFieldDisplayValue(field, entity, ctx) {
    if (typeof field.display === 'function') {
        return field.display(entity, ctx);
    }

    let value;
    if (field.computed && typeof field.compute === 'function') {
        value = field.compute(entity, ctx);
    } else {
        value = entity[field.key];
    }

    if (typeof field.format === 'function') {
        return field.format(value, entity, ctx);
    }

    return formatFieldValue(field, value);
}

function readFormValue(field, el) {
    if (!el) {
        return field.default !== undefined ? field.default : null;
    }

    const raw = el.value;
    if (typeof field.parse === 'function') {
        return field.parse(raw);
    }

    switch (field.type) {
        case 'currency':
        case 'number':
        case 'percent':
        case 'years': {
            if (raw === '' || raw === null || raw === undefined) return null;
            const n = field.type === 'years' ? parseInt(raw, 10) : parseFloat(raw);
            return Number.isFinite(n) ? n : null;
        }
        case 'boolean':
            return !!el.checked;
        case 'month':
        case 'text':
        default:
            return raw;
    }
}

function serializeEntity(entity, fields) {
    const out = {};
    filterFields(fields, 'export').forEach(field => {
        if (typeof field.exportValue === 'function') {
            out[field.key] = field.exportValue(entity);
        } else {
            out[field.key] = entity[field.key];
        }
    });
    return out;
}

function hydrateEntity(raw, fields) {
    const out = {};
    filterFields(fields, 'import').forEach(field => {
        if (raw && Object.prototype.hasOwnProperty.call(raw, field.key)) {
            out[field.key] = raw[field.key];
        } else if (field.default !== undefined) {
            out[field.key] = field.default;
        }
    });
    return out;
}

function inputTypeForField(field) {
    switch (field.type) {
        case 'month':
            return 'month';
        case 'boolean':
            return 'checkbox';
        case 'currency':
        case 'number':
        case 'percent':
        case 'years':
            return 'number';
        default:
            return 'text';
    }
}

/** DOM id for a form field; optional idPrefix scopes inputs (e.g. account cards). */
function formFieldDomId(field, idPrefix = '') {
    return `${idPrefix || ''}${field.domId || field.key}`;
}

function renderFormFields(container, fields, options = {}) {
    if (!container) return;

    const idPrefix = options.idPrefix || '';
    const formFields = filterFields(fields, 'form');
    container.innerHTML = formFields.map(field => {
        const id = formFieldDomId(field, idPrefix);
        const label = field.formLabel || field.label;
        const inputType = inputTypeForField(field);
        const attrs = field.inputAttrs || {};
        const attrStr = Object.entries(attrs)
            .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
            .join(' ');
        const defaultVal = field.default !== undefined && field.default !== null ? field.default : '';
        const valueAttr = inputType === 'checkbox'
            ? (defaultVal ? 'checked' : '')
            : `value="${String(defaultVal).replace(/"/g, '&quot;')}"`;

        return `
            <div class="sheet-ruled-row input-row">
                <label for="${id}">${label}</label>
                <input type="${inputType}" id="${id}" ${valueAttr} ${attrStr}>
            </div>
        `;
    }).join('');
}

function renderTable(container, entities, fields, rowOpts = {}) {
    if (!container) return;

    const tableFields = filterFields(fields, 'table');
    const ariaLabel = rowOpts.ariaLabel || 'Data table';
    const rowClass = rowOpts.rowClass || '';
    const ctx = rowOpts.ctx || {};

    if (!entities || entities.length === 0) {
        container.innerHTML = `<div class="sheet-ruled-row loans-empty">${rowOpts.emptyMessage || 'None yet…'}</div>`;
        return;
    }

    const header = tableFields.map(field =>
        `<span role="columnheader">${field.tableLabel || field.label}</span>`
    ).join('');

    const rows = entities.map(entity => {
        const cells = tableFields.map(field =>
            `<span role="cell">${getFieldDisplayValue(field, entity, ctx)}</span>`
        ).join('');
        const extraAttrs = typeof rowOpts.getRowAttrs === 'function'
            ? rowOpts.getRowAttrs(entity)
            : '';
        return `
            <div class="sheet-ruled-row ${rowClass}" role="row" ${extraAttrs}>
                ${cells}
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="loans-table" role="table" aria-label="${ariaLabel}">
            <div class="sheet-ruled-row loans-table-header" role="row">
                ${header}
            </div>
            ${rows}
        </div>
    `;
}

function renderDetailRows(fields, entity, ctx) {
    return filterFields(fields, 'detail').map(field => {
        const label = typeof field.detailLabel === 'function'
            ? field.detailLabel(entity, ctx)
            : (field.detailLabel || field.label);
        const value = getFieldDisplayValue(field, entity, ctx);
        return `<div class="sheet-ruled-row"><span class="detail-label">${label}</span><span class="detail-value">${value}</span></div>`;
    }).join('');
}
