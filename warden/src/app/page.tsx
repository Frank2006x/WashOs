import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

const AUTH_COOKIE = "warden_auth";
const ROW_LIMIT = 100;

const TABLES = [
  "users",
  "students",
  "laundry_services",
  "laundry_staff",
  "bags",
  "bookings",
  "machines",
  "machine_runs",
  "workflow_events",
  "push_tokens",
  "notifications",
  "queries",
  "query_replies",
] as const;

type TableName = (typeof TABLES)[number];
type FilterOperator = "contains" | "equals";

type ColumnMeta = {
  name: string;
  dataType: string;
};

type TableFilter = {
  column: string;
  operator: FilterOperator;
  value: string;
};

type TableDump = {
  name: TableName;
  total: number;
  rows: Record<string, unknown>[];
  columns: ColumnMeta[];
  appliedFilter?: TableFilter;
  error?: string;
};

type StaleQueryAlert = {
  query_id: string;
  title: string;
  status: string;
  created_at: string;
  age_hours: number;
  laundry_staff_name: string | null;
  laundry_staff_phone: string | null;
  laundry_service_name: string | null;
};

function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function escapeLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

function toRows(result: unknown): Record<string, unknown>[] {
  if (result && typeof result === "object" && "rows" in result) {
    const maybeRows = (result as { rows?: unknown }).rows;
    if (Array.isArray(maybeRows)) {
      return maybeRows as Record<string, unknown>[];
    }
  }
  return [];
}

async function getTableColumns(table: TableName): Promise<ColumnMeta[]> {
  const result = await db.execute(
    sql.raw(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = '${escapeLiteral(table)}'
       ORDER BY ordinal_position ASC`,
    ),
  );

  const rows = toRows(result);
  return rows
    .map((row) => ({
      name: String(row.column_name || "").trim(),
      dataType: String(row.data_type || "").trim(),
    }))
    .filter((c) => c.name.length > 0);
}

async function dumpTable(
  table: TableName,
  filter?: TableFilter,
): Promise<TableDump> {
  try {
    const columns = await getTableColumns(table);
    const columnNames = columns.map((c) => c.name);

    let whereSql = "";
    let appliedFilter: TableFilter | undefined;

    if (
      filter &&
      filter.value.trim().length > 0 &&
      columnNames.includes(filter.column)
    ) {
      const quotedColumn = quoteIdent(filter.column);
      const escapedValue = escapeLiteral(filter.value.trim());

      if (filter.operator === "equals") {
        whereSql = ` WHERE CAST(${quotedColumn} AS TEXT) = '${escapedValue}'`;
      } else {
        whereSql = ` WHERE CAST(${quotedColumn} AS TEXT) ILIKE '%${escapedValue}%'`;
      }

      appliedFilter = {
        column: filter.column,
        operator: filter.operator,
        value: filter.value.trim(),
      };
    }

    const orderBy = columnNames.includes("created_at")
      ? `${quoteIdent("created_at")} DESC NULLS LAST`
      : columnNames.length > 0
        ? `${quoteIdent(columnNames[0])} ASC`
        : "1";

    const [rowsResult, countResult] = await Promise.all([
      db.execute(
        sql.raw(
          `SELECT * FROM ${quoteIdent(table)}${whereSql} ORDER BY ${orderBy} LIMIT ${ROW_LIMIT}`,
        ),
      ),
      db.execute(
        sql.raw(
          `SELECT COUNT(*)::bigint AS total FROM ${quoteIdent(table)}${whereSql}`,
        ),
      ),
    ]);

    const rows = toRows(rowsResult);
    const countRows = toRows(countResult);
    const totalRaw = countRows[0]?.total;
    const total = Number(totalRaw || 0);

    return {
      name: table,
      total: Number.isFinite(total) ? total : 0,
      rows,
      columns,
      appliedFilter,
    };
  } catch (error: unknown) {
    return {
      name: table,
      total: 0,
      rows: [],
      columns: [],
      error: error instanceof Error ? error.message : "Failed to query table",
    };
  }
}

async function getStaleQueryAlerts(): Promise<StaleQueryAlert[]> {
  const result = await db.execute(
    sql.raw(`
      SELECT
        q.id AS query_id,
        q.title,
        q.status::text AS status,
        q.created_at::text AS created_at,
        EXTRACT(EPOCH FROM (NOW() - q.created_at)) / 3600 AS age_hours,
        ls.name AS laundry_staff_name,
        ls.phone AS laundry_staff_phone,
        svc.name AS laundry_service_name
      FROM queries q
      LEFT JOIN laundry_staff ls ON ls.user_id = q.assigned_staff_user_id
      LEFT JOIN laundry_services svc ON svc.id = ls.laundry_service_id
      WHERE q.status <> 'closed'
        AND q.created_at <= NOW() - INTERVAL '1 day'
      ORDER BY q.created_at ASC
      LIMIT 200
    `),
  );

  return toRows(result).map((row) => ({
    query_id: String(row.query_id || ""),
    title: String(row.title || ""),
    status: String(row.status || ""),
    created_at: String(row.created_at || ""),
    age_hours: Number(row.age_hours || 0),
    laundry_staff_name:
      row.laundry_staff_name === null || row.laundry_staff_name === undefined
        ? null
        : String(row.laundry_staff_name),
    laundry_staff_phone:
      row.laundry_staff_phone === null || row.laundry_staff_phone === undefined
        ? null
        : String(row.laundry_staff_phone),
    laundry_service_name:
      row.laundry_service_name === null ||
      row.laundry_service_name === undefined
        ? null
        : String(row.laundry_service_name),
  }));
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function tableTitle(name: string): string {
  return name.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default async function Page({
  searchParams,
}: {
  searchParams?:
    | Promise<{ table?: string; column?: string; value?: string; op?: string }>
    | { table?: string; column?: string; value?: string; op?: string };
}) {
  const params = searchParams ? await searchParams : {};
  const selectedTable = TABLES.includes(params.table as TableName)
    ? (params.table as TableName)
    : TABLES[0];

  const requestedColumn = String(params.column || "").trim();
  const requestedValue = String(params.value || "").trim();
  const requestedOperator: FilterOperator =
    params.op === "equals" ? "equals" : "contains";

  const requestedFilter: TableFilter | undefined =
    requestedColumn && requestedValue
      ? {
          column: requestedColumn,
          operator: requestedOperator,
          value: requestedValue,
        }
      : undefined;

  const store = await cookies();
  const isAuthed = store.get(AUTH_COOKIE)?.value === "1";

  if (!isAuthed) {
    const missingPassword = !process.env.WARDEN_PASSWORD;

    return (
      <div className="min-h-screen bg-[linear-gradient(140deg,#e9f6f2_0%,#fdf7ec_55%,#eef3ff_100%)] text-zinc-900">
        <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-8">
          <section className="w-full rounded-3xl border border-zinc-200/80 bg-white/85 p-6 shadow-xl backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">
              Warden Access
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Superadmin Login
            </h1>
            <p className="mt-3 text-sm text-zinc-600">
              Enter the warden password to open the Neon database explorer.
            </p>

            {missingPassword ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                WARDEN_PASSWORD is not set in environment.
              </p>
            ) : null}

            <form
              action="/api/auth/login"
              method="post"
              className="mt-5 space-y-3"
            >
              <input
                name="password"
                type="password"
                className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-900"
                placeholder="Enter password"
                required
              />
              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-bold text-white transition hover:bg-zinc-700"
                disabled={missingPassword}
              >
                Unlock Console
              </button>
            </form>
          </section>
        </main>
      </div>
    );
  }

  const [tableDump, staleAlerts] = await Promise.all([
    dumpTable(selectedTable, requestedFilter),
    getStaleQueryAlerts(),
  ]);
  const columns = tableDump.columns.map((c) => c.name);

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#fef9ef_0%,#edf6f4_45%,#f4f8ff_100%)] text-zinc-900">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-zinc-200/80 bg-white/90 p-6 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <details className="mb-4 inline-block rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-zinc-800">
                  <span aria-hidden="true">🔔</span>
                  <span>Overdue Query Alerts</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      staleAlerts.length > 0
                        ? "bg-red-600 text-white"
                        : "bg-zinc-200 text-zinc-700"
                    }`}
                  >
                    {staleAlerts.length}
                  </span>
                </summary>

                <div className="mt-3 w-[min(90vw,760px)] space-y-2">
                  {staleAlerts.length === 0 ? (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      No notifications. No query is pending over 1 day.
                    </p>
                  ) : (
                    staleAlerts.map((alert) => (
                      <div
                        key={alert.query_id}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900"
                      >
                        <p className="font-bold">
                          {alert.title || "Untitled Query"} ({alert.status})
                        </p>
                        <p className="mt-1 text-red-800">
                          Open for {Math.max(24, Math.round(alert.age_hours))}h
                        </p>
                        <p className="mt-1 text-red-800">
                          Laundry details:{" "}
                          {alert.laundry_staff_name || "Unassigned"}
                          {alert.laundry_staff_phone
                            ? ` (${alert.laundry_staff_phone})`
                            : ""}
                          {alert.laundry_service_name
                            ? ` - ${alert.laundry_service_name}`
                            : ""}
                        </p>
                        <p className="mt-1 text-red-800">
                          Query ID: {alert.query_id}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </details>

              <h1 className="text-2xl text-black font-bold uppercase tracking-[0.24em] ">
                WashOs Warden Console
              </h1>

              <p className="mt-3 max-w-3xl text-sm text-zinc-600">
                Showing one table at a time with SELECT * style preview. Each
                preview is limited to the latest {ROW_LIMIT} rows.
              </p>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold transition hover:bg-zinc-50"
              >
                Logout
              </button>
            </form>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
            Select Table
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {TABLES.map((table) => {
              const active = table === selectedTable;
              return (
                <a
                  key={table}
                  href={`/?table=${table}`}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition ${
                    active
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
                  }`}
                >
                  {tableTitle(table)}
                </a>
              );
            })}
          </div>

          <form
            method="get"
            className="mt-4 grid gap-2 md:grid-cols-[1fr_160px_1fr_auto_auto]"
          >
            <input type="hidden" name="table" value={selectedTable} />

            <select
              name="column"
              defaultValue={requestedColumn}
              className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm"
            >
              <option value="">Select column</option>
              {tableDump.columns.map((column) => (
                <option key={column.name} value={column.name}>
                  {column.name}
                </option>
              ))}
            </select>

            <select
              name="op"
              defaultValue={requestedOperator}
              className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm"
            >
              <option value="contains">contains</option>
              <option value="equals">equals</option>
            </select>

            <input
              name="value"
              defaultValue={requestedValue}
              className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm"
              placeholder="Filter value"
            />

            <button
              type="submit"
              className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white"
            >
              Apply
            </button>

            <a
              href={`/?table=${selectedTable}`}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold"
            >
              Clear
            </a>
          </form>

          {tableDump.appliedFilter ? (
            <p className="mt-3 text-xs text-zinc-600">
              Active filter: <strong>{tableDump.appliedFilter.column}</strong>{" "}
              {tableDump.appliedFilter.operator} "
              {tableDump.appliedFilter.value}"
            </p>
          ) : null}
        </section>

        <section className="mt-6 space-y-6">
          <article className="rounded-3xl border border-zinc-200/70 bg-white p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-xl font-black tracking-tight">
                {tableTitle(tableDump.name)}
              </h2>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                preview {tableDump.rows.length} / {tableDump.total}
              </p>
            </div>

            {tableDump.error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {tableDump.error}
              </p>
            ) : tableDump.rows.length === 0 ? (
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                No rows available.
              </p>
            ) : (
              <div className="overflow-auto rounded-2xl border border-zinc-100">
                <table className="min-w-full border-collapse text-left text-xs sm:text-sm">
                  <thead className="sticky top-0 bg-zinc-100/95">
                    <tr>
                      {columns.map((column) => (
                        <th key={column} className="px-3 py-2 font-semibold">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableDump.rows.map((row, idx) => (
                      <tr
                        key={`${tableDump.name}-${idx}`}
                        className="border-t border-zinc-100 align-top"
                      >
                        {columns.map((column) => (
                          <td key={column} className="max-w-[360px] px-3 py-2">
                            <div className="line-clamp-3 break-all">
                              {renderCell(row[column])}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}
