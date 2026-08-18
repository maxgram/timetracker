import pdfMake from 'pdfmake/build/pdfmake'
import vfsFonts from 'pdfmake/build/vfs_fonts'
import { moneyAdd, moneyPct } from '@shared/money'
import type { SummaryData } from '@shared/types'

pdfMake.addVirtualFileSystem({ ...(vfsFonts as unknown as Record<string, string>) })

export type PdfTableRow = (string | number)[]

export interface PdfOptions {
  headerTitle: string
  subtitle?: string
  filters?: string[]
  columns: string[]
  columnWidths?: (number | string)[]
  rows: PdfTableRow[]
  totals?: { label: string; value: string }[]
  notes?: string
  generatedLabel?: string
}

const colors = {
  primary: '#4f46e5',
  text: '#1e293b',
  muted: '#64748b',
  border: '#e2e8f0',
  headerBg: '#eef2ff'
}

export function moneyStr(n: number | null | undefined, currency: string): string {
  if (n == null) return '—'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n)
  } catch {
    return `${currency} ${n.toFixed(2)}`
  }
}

export function buildReportDoc(opts: PdfOptions, currency: string): unknown {
  const widths = opts.columnWidths ?? opts.columns.map(() => '*')
  return {
    pageSize: 'A4',
    pageMargins: [44, 46, 44, 46],
    content: [
      {
        columns: [
          {
            text: opts.headerTitle,
            fontSize: 22,
            bold: true,
            color: colors.primary
          },
          {
            text: opts.generatedLabel ?? '',
            alignment: 'right',
            fontSize: 10,
            color: colors.muted,
            margin: [0, 6, 0, 0]
          }
        ],
        margin: [0, 0, 0, 4]
      },
      opts.subtitle
        ? { text: opts.subtitle, fontSize: 12, color: colors.muted, margin: [0, 0, 0, 8] }
        : {},
      ...(opts.filters && opts.filters.length
        ? [
            {
              text: opts.filters.join('   ·   '),
              fontSize: 9,
              color: colors.muted,
              margin: [0, 2, 0, 14],
              lineHeight: 1.5
            }
          ]
        : [{ text: '', margin: [0, 0, 0, 14] }]),
      {
        table: {
          headerRows: 1,
          widths,
          body: [
            [
              ...opts.columns.map((c) => ({
                text: c,
                bold: true,
                fontSize: 9.5,
                color: colors.primary,
                fillColor: colors.headerBg,
                margin: [6, 6, 6, 6]
              }))
            ],
            ...opts.rows.map((row, i) =>
              row.map((cell) => ({
                text: cell,
                fontSize: 9.5,
                color: i % 2 === 0 ? colors.text : colors.text,
                margin: [6, 5, 6, 5]
              }))
            )
          ]
        },
        layout: {
          hLineColor: () => colors.border,
          vLineColor: () => colors.border,
          hLineWidth: () => 0.6,
          vLineWidth: () => 0.6
        }
      },
      ...(opts.totals?.length
        ? [
            {
              table: {
                widths: ['*', 'auto'],
                body: opts.totals.map((t) => [
                  { text: t.label, alignment: 'right', fontSize: 10, color: colors.muted, margin: [0, 4, 8, 4] },
                  { text: t.value, alignment: 'right', bold: true, fontSize: 10, color: colors.text, margin: [0, 4, 0, 4] }
                ])
              },
              layout: 'noBorders',
              margin: [0, 12, 0, 0]
            }
          ]
        : []),
      opts.notes
        ? { text: opts.notes, fontSize: 9, color: colors.muted, margin: [0, 16, 0, 0], lineHeight: 1.4 }
        : {}
    ],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: colors.text }
  }
}

export function buildSummaryDoc(data: SummaryData, currency: string): unknown {
  const shortDate = (d: string): string => {
    const [y, m, dd] = d.split('-').map(Number)
    return new Date(y, m - 1, dd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const groups = new Map<string, { name: string; project: string; from: string; to: string; hours: number; amount: number | null }>()
  for (const row of data.rows) {
    const name = row.name || 'Untitled'
    const project = row.project_name ?? 'No project'
    const key = `${row.project_id ?? 'none'}\u0000${name}`
    let g = groups.get(key)
    if (!g) {
      g = { name, project, from: row.date, to: row.date, hours: 0, amount: null }
      groups.set(key, g)
    }
    if (row.date < g.from) g.from = row.date
    if (row.date > g.to) g.to = row.date
    g.hours += row.hours
    if (row.amount != null) g.amount = (g.amount ?? 0) + row.amount
  }
  const rows: PdfTableRow[] = [...groups.values()]
    .sort((a, b) => b.hours - a.hours)
    .map((g) => [
      g.from === g.to ? shortDate(g.from) : `${shortDate(g.from)} – ${shortDate(g.to)}`,
      g.name,
      g.project,
      g.hours.toFixed(2),
      moneyStr(g.amount, currency)
    ])
  const totals: { label: string; value: string }[] = [
    { label: 'Total hours', value: `${data.totals.hours.toFixed(2)}h` },
    ...(data.totals.amount != null ? [{ label: 'Total amount', value: moneyStr(data.totals.amount, currency) }] : [])
  ]
  return buildReportDoc(
    {
      headerTitle: 'Time Summary Report',
      columns: ['Date', 'Entry', 'Project', 'Hours', 'Amount'],
      columnWidths: ['auto', '*', 'auto', 'auto', 'auto'],
      rows,
      totals
    },
    currency
  )
}

export function buildInvoiceDoc(input: {
  number: string
  issueDate: string
  dueDate: string
  status: string
  currency: string
  issuer: {
    company_name: string
    address: string
    email: string
    phone: string
    tax_id: string
    bank_details: string
    logo: string | null
  }
  client: {
    name: string
    address: string
    email: string
    phone: string
    tax_id: string
  } | null
  items: { description: string; hours: number; unit_price: number; amount: number }[]
  taxRate: number
  notes: string
}): unknown {
  const subtotal = input.items.reduce((a, i) => moneyAdd(a, i.amount), 0)
  const tax = moneyPct(subtotal, input.taxRate)
  const total = moneyAdd(subtotal, tax)

  const issuerLines = [
    input.issuer.company_name,
    input.issuer.address,
    input.issuer.email,
    input.issuer.phone,
    input.issuer.tax_id ? `Tax ID: ${input.issuer.tax_id}` : ''
  ].filter(Boolean)

  const clientLines = [input.client?.name ?? '—', input.client?.address, input.client?.email, input.client?.phone, input.client?.tax_id ? `Tax ID: ${input.client.tax_id}` : ''].filter(
    Boolean
  )

  const headColumns: unknown[] = []
  if (input.issuer.logo) {
    headColumns.push({
      image: input.issuer.logo,
      width: 90,
      fit: [90, 90],
      margin: [0, 0, 0, 6]
    })
  }
  headColumns.push({
    stack: issuerLines.map((l, i) => ({
      text: l,
      fontSize: i === 0 ? 14 : 9.5,
      bold: i === 0,
      color: i === 0 ? colors.primary : colors.muted,
      margin: [0, i === 0 ? 0 : 1, 0, 0]
    })),
    margin: [0, 0, 0, 6]
  })

  return {
    pageSize: 'A4',
    pageMargins: [44, 46, 44, 46],
    content: [
      { columns: headColumns, margin: [0, 0, 0, 22] },
      {
        columns: [
          {
            stack: [
              { text: 'INVOICE', fontSize: 26, bold: true, color: colors.primary, margin: [0, 0, 0, 8] },
              { text: `Invoice #: ${input.number}`, fontSize: 11, bold: true, color: colors.text, margin: [0, 0, 0, 2] },
              { text: `Issue date: ${input.issueDate}`, fontSize: 10, color: colors.muted, margin: [0, 0, 0, 2] },
              { text: `Due date: ${input.dueDate}`, fontSize: 10, color: colors.muted, margin: [0, 0, 0, 2] },
              { text: `Status: ${input.status}`, fontSize: 10, color: colors.muted, margin: [0, 0, 0, 2] }
            ]
          },
          {
            stack: [
              { text: 'BILL TO', fontSize: 9.5, bold: true, color: colors.primary, margin: [0, 0, 0, 4] },
              ...clientLines.map((l) => ({
                text: l,
                fontSize: 10,
                color: colors.text,
                margin: [0, 1, 0, 0]
              }))
            ],
            alignment: 'right'
          }
        ],
        margin: [0, 0, 0, 24]
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Description', bold: true, fontSize: 10, color: colors.primary, fillColor: colors.headerBg, margin: [6, 7, 6, 7] },
              { text: 'Hours', bold: true, fontSize: 10, color: colors.primary, fillColor: colors.headerBg, margin: [6, 7, 6, 7], alignment: 'right' },
              { text: 'Rate', bold: true, fontSize: 10, color: colors.primary, fillColor: colors.headerBg, margin: [6, 7, 6, 7], alignment: 'right' },
              { text: 'Amount', bold: true, fontSize: 10, color: colors.primary, fillColor: colors.headerBg, margin: [6, 7, 6, 7], alignment: 'right' }
            ],
            ...input.items.map((item) => [
              { text: item.description, fontSize: 10, margin: [6, 6, 6, 6] },
              { text: item.hours.toFixed(2), fontSize: 10, alignment: 'right', margin: [6, 6, 6, 6] },
              { text: moneyStr(item.unit_price, input.currency), fontSize: 10, alignment: 'right', margin: [6, 6, 6, 6] },
              { text: moneyStr(item.amount, input.currency), fontSize: 10, alignment: 'right', margin: [6, 6, 6, 6] }
            ]),
            [
              { text: '', colSpan: 2, margin: [6, 6, 6, 6] },
              {},
              { text: 'Subtotal', alignment: 'right', fontSize: 10, margin: [6, 6, 6, 6], color: colors.muted },
              { text: moneyStr(subtotal, input.currency), alignment: 'right', fontSize: 10, bold: true, margin: [6, 6, 6, 6] }
            ],
            [
              { text: '', colSpan: 2, margin: [6, 6, 6, 6] },
              {},
              { text: `Tax (${input.taxRate}%)`, alignment: 'right', fontSize: 10, margin: [6, 6, 6, 6], color: colors.muted },
              { text: moneyStr(tax, input.currency), alignment: 'right', fontSize: 10, bold: true, margin: [6, 6, 6, 6] }
            ],
            [
              { text: '', colSpan: 2, margin: [6, 6, 6, 6] },
              {},
              { text: 'Total', alignment: 'right', fontSize: 11, bold: true, margin: [6, 6, 6, 6], color: colors.primary },
              { text: moneyStr(total, input.currency), alignment: 'right', fontSize: 11, bold: true, margin: [6, 6, 6, 6], color: colors.primary }
            ]
          ]
        },
        layout: {
          hLineColor: () => colors.border,
          vLineColor: () => colors.border,
          hLineWidth: () => 0.6,
          vLineWidth: () => 0.6
        }
      },
      ...(input.notes
        ? [
            {
              text: input.notes,
              fontSize: 9.5,
              color: colors.muted,
              margin: [0, 18, 0, 0],
              lineHeight: 1.4
            }
          ]
        : []),
      ...(input.issuer.bank_details
        ? [
            {
              stack: [
                { text: 'PAYMENT DETAILS', fontSize: 9.5, bold: true, color: colors.primary, margin: [0, 24, 0, 4] },
                { text: input.issuer.bank_details, fontSize: 10, color: colors.text, lineHeight: 1.4 }
              ]
            }
          ]
        : []),
      {
        text: 'Thank you for your business.',
        fontSize: 9.5,
        color: colors.muted,
        margin: [0, 28, 0, 0],
        alignment: 'center'
      }
    ],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: colors.text }
  }
}

export async function savePdf(doc: unknown, defaultName: string): Promise<void> {
  const blob = await pdfMake.createPdf(doc as Parameters<typeof pdfMake.createPdf>[0]).getBlob()
  const path = await window.api.dialog.savePdf(defaultName)
  if (!path) return
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  await window.api.fs.writeFile(path, btoa(binary))
}