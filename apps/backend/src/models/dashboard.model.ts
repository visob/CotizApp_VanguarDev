import { pool } from "../config/database.js";
import { activeReactivationSql } from "../utils/reactivation-sql.js";

type DashboardMetricRow = {
  quotes_sent_current: string | number;
  quotes_sent_previous: string | number;
  clients_contacted_current: string | number;
  clients_contacted_previous: string | number;
  sales_won_current: string | number;
  sales_won_previous: string | number;
};

export type DashboardMetrics = {
  quotesSentCurrent: number;
  quotesSentPrevious: number;
  clientsContactedCurrent: number;
  clientsContactedPrevious: number;
  salesWonCurrent: number;
  salesWonPrevious: number;
};

type SalesMetricsKpiRow = {
  total_revenue: string | null;
  total_units: string | number | null;
  won_count: string | number | null;
  sent_count: string | number | null;
};

type SalesMetricsRevenueByCategoryRow = {
  month_start: string;
  categoria: string | null;
  amount: string | number;
};

type SalesMetricsSentByClientTypeRow = {
  client_type: string | null;
  sent_count: string | number;
};

type SalesMetricsSalesVsQuoteRow = {
  month_start: string;
  won_count: string | number;
  sent_count: string | number;
};

export type SalesMetricsKpis = {
  totalRevenue: string;
  closedWonCount: number;
  sentQuotesCount: number;
  closeRate: number;
  averageTicket: string;
};

export type SalesMetricsSnapshot = {
  kpis: SalesMetricsKpis;
  revenueByCategory: Array<{
    month_start: string;
    categoria: string | null;
    amount: string;
  }>;
  sentByClientType: Array<{
    client_type: string | null;
    sent_count: number;
  }>;
  salesVsQuotes: Array<{
    month_start: string;
    won_count: number;
    sent_count: number;
  }>;
};

export type DashboardReactivationRow = {
  id: string | number;
  id_cliente: string | number;
  id_usuario: string | number;
  fecha_emision: string;
  estado: string;
  cliente_nombre_empresa: string;
  cliente_clasificacion: string | null;
  fecha_reactivacion_activa: string;
};

export type DashboardNoteRow = {
  id: string | number;
  id_usuario: string | number;
  text: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

function buildSalesScope(input: {
  companyId?: number | null;
  category?: string | null;
  clientType?: string | null;
}) {
  const values: unknown[] = [];
  const quoteWhere = ["1=1"];

  if (input.companyId !== undefined && input.companyId !== null) {
    values.push(input.companyId);
    quoteWhere.push(`c.id_empresa = $${values.length}`);
  }

  if (input.clientType) {
    values.push(input.clientType);
    quoteWhere.push(`cl.clasificacion = $${values.length}`);
  }

  const categoryPlaceholder = input.category
    ? (() => {
        values.push(input.category);
        return `$${values.length}`;
      })()
    : null;

  const ctes = `
    quote_scope as (
      select
        c.id,
        case
          when c.moneda = 'USD' then (
            coalesce(c.total_final, 0)
            * coalesce(c.tipo_cambio, 1)
          )
          else coalesce(c.total_final, 0)
        end as total_final_ars,
        cl.clasificacion as client_type
      from cotizaciones c
      join clientes cl on cl.id = c.id_cliente
      where ${quoteWhere.join(" and ")}
    ),
    filtered_quote_ids as (
      select qs.id
      from quote_scope qs
      ${categoryPlaceholder
        ? `
      where exists (
        select 1
        from items_cotizacion i
        join productos p on p.id = i.id_producto
        where i.id_cotizacion = qs.id
          and p.tipo_producto = ${categoryPlaceholder}
      )`
        : ""}
    ),
    quote_all_line_totals as (
      select
        i.id_cotizacion as quote_id,
        coalesce(
          sum(coalesce(i.precio_unitario_momento, 0) * i.cantidad),
          0
        )::numeric as quote_line_total
      from items_cotizacion i
      join filtered_quote_ids fq on fq.id = i.id_cotizacion
      group by i.id_cotizacion
    ),
    line_scope as (
      select
        i.id_cotizacion as quote_id,
        p.tipo_producto as categoria,
        i.cantidad,
        (coalesce(i.precio_unitario_momento, 0) * i.cantidad)::numeric as line_subtotal
      from items_cotizacion i
      join productos p on p.id = i.id_producto
      join filtered_quote_ids fq on fq.id = i.id_cotizacion
      ${categoryPlaceholder ? `where p.tipo_producto = ${categoryPlaceholder}` : ""}
    ),
    sent_events as (
      select
        s.id_cotizacion as quote_id,
        min(s.fecha_accion) as sent_at
      from seguimiento s
      join filtered_quote_ids fq on fq.id = s.id_cotizacion
      where
        (
          s.tipo_accion = 'CREACION'
          and coalesce(s.metadata->>'estado', '') <> ''
          and s.metadata->>'estado' <> 'BORRADOR'
        )
        or (
          s.tipo_accion = 'CAMBIO_ESTADO'
          and coalesce(s.metadata->>'to', '') <> ''
          and s.metadata->>'to' <> 'BORRADOR'
        )
      group by s.id_cotizacion
    ),
    won_events as (
      select
        s.id_cotizacion as quote_id,
        min(s.fecha_accion) as won_at
      from seguimiento s
      join filtered_quote_ids fq on fq.id = s.id_cotizacion
      where
        (s.tipo_accion = 'CREACION' and s.metadata->>'estado' = 'CERRADA_GANADA')
        or (s.tipo_accion = 'CAMBIO_ESTADO' and s.metadata->>'to' = 'CERRADA_GANADA')
      group by s.id_cotizacion
    )
  `;

  return { values, ctes };
}

export async function getDashboardMetrics(input: {
  companyId?: number | null;
  userId: number;
  currentStartIso: string;
  currentEndIso: string;
  previousStartIso: string;
  previousEndIso: string;
}): Promise<DashboardMetrics> {
  const values: unknown[] = [
    input.userId,
    input.currentStartIso,
    input.currentEndIso,
    input.previousStartIso,
    input.previousEndIso
  ];

  const companyPlaceholder = input.companyId !== undefined && input.companyId !== null
    ? (() => {
        values.push(input.companyId);
        return `$${values.length}`;
      })()
    : null;

  const quoteCompanySql = companyPlaceholder ? ` and c.id_empresa = ${companyPlaceholder}` : "";
  const clientCompanySql = companyPlaceholder ? ` and cl.id_empresa = ${companyPlaceholder}` : "";

  const result = await pool.query<DashboardMetricRow>(
    `
      select
        (
          select count(*)
          from seguimiento s
          join cotizaciones c on c.id = s.id_cotizacion
          where c.id_usuario = $1
            ${quoteCompanySql}
            and s.fecha_accion >= $2::timestamptz
            and s.fecha_accion < $3::timestamptz
            and (
              (s.tipo_accion = 'CREACION' and s.metadata->>'estado' = 'ENVIADA')
              or (s.tipo_accion = 'CAMBIO_ESTADO' and s.metadata->>'to' = 'ENVIADA')
            )
        ) as quotes_sent_current,
        (
          select count(*)
          from seguimiento s
          join cotizaciones c on c.id = s.id_cotizacion
          where c.id_usuario = $1
            ${quoteCompanySql}
            and s.fecha_accion >= $4::timestamptz
            and s.fecha_accion < $5::timestamptz
            and (
              (s.tipo_accion = 'CREACION' and s.metadata->>'estado' = 'ENVIADA')
              or (s.tipo_accion = 'CAMBIO_ESTADO' and s.metadata->>'to' = 'ENVIADA')
            )
        ) as quotes_sent_previous,
        (
          select count(*)
          from clientes cl
          where cl.ult_contacto >= $2::timestamptz
            and cl.ult_contacto < $3::timestamptz
            ${clientCompanySql}
        ) as clients_contacted_current,
        (
          select count(*)
          from clientes cl
          where cl.ult_contacto >= $4::timestamptz
            and cl.ult_contacto < $5::timestamptz
            ${clientCompanySql}
        ) as clients_contacted_previous,
        (
          select count(*)
          from seguimiento s
          join cotizaciones c on c.id = s.id_cotizacion
          where c.id_usuario = $1
            ${quoteCompanySql}
            and s.fecha_accion >= $2::timestamptz
            and s.fecha_accion < $3::timestamptz
            and (
              (s.tipo_accion = 'CREACION' and s.metadata->>'estado' = 'CERRADA_GANADA')
              or (s.tipo_accion = 'CAMBIO_ESTADO' and s.metadata->>'to' = 'CERRADA_GANADA')
            )
        ) as sales_won_current,
        (
          select count(*)
          from seguimiento s
          join cotizaciones c on c.id = s.id_cotizacion
          where c.id_usuario = $1
            ${quoteCompanySql}
            and s.fecha_accion >= $4::timestamptz
            and s.fecha_accion < $5::timestamptz
            and (
              (s.tipo_accion = 'CREACION' and s.metadata->>'estado' = 'CERRADA_GANADA')
              or (s.tipo_accion = 'CAMBIO_ESTADO' and s.metadata->>'to' = 'CERRADA_GANADA')
            )
        ) as sales_won_previous
    `,
    values
  );

  const row = result.rows[0];
  return {
    quotesSentCurrent: Number(row?.quotes_sent_current ?? 0),
    quotesSentPrevious: Number(row?.quotes_sent_previous ?? 0),
    clientsContactedCurrent: Number(row?.clients_contacted_current ?? 0),
    clientsContactedPrevious: Number(row?.clients_contacted_previous ?? 0),
    salesWonCurrent: Number(row?.sales_won_current ?? 0),
    salesWonPrevious: Number(row?.sales_won_previous ?? 0)
  };
}

export async function listDashboardReactivations(input: {
  companyId?: number | null;
  userId: number;
  startIso: string;
  endIso: string;
}) {
  const values: unknown[] = [input.userId, input.startIso, input.endIso];
  const where = [
    `c.id_usuario = $1`,
    `c.estado not in ('CERRADA_GANADA', 'CERRADA_PERDIDA')`,
    `${activeReactivationSql("c")} is not null`,
    `${activeReactivationSql("c")} >= $2::timestamptz`,
    `${activeReactivationSql("c")} < $3::timestamptz`
  ];

  if (input.companyId !== undefined && input.companyId !== null) {
    values.push(input.companyId);
    where.push(`c.id_empresa = $${values.length}`);
  }

  const result = await pool.query<DashboardReactivationRow>(
    `
      select
        c.id,
        c.id_cliente,
        c.id_usuario,
        c.fecha_emision,
        c.estado,
        cl.nombre_empresa as cliente_nombre_empresa,
        cl.clasificacion as cliente_clasificacion,
        ${activeReactivationSql("c")} as fecha_reactivacion_activa
      from cotizaciones c
      join clientes cl on cl.id = c.id_cliente
      where ${where.join(" and ")}
      order by ${activeReactivationSql("c")} asc, c.id desc
    `,
    values
  );

  return result.rows;
}

export async function getSalesMetricsSnapshot(input: {
  companyId?: number | null;
  category?: string | null;
  clientType?: string | null;
  summaryStartIso: string;
  summaryEndIsoExclusive: string;
  chartsStartIso: string;
  chartsEndIsoExclusive: string;
}): Promise<SalesMetricsSnapshot> {
  const summaryScope = buildSalesScope(input);
  const summaryStartPlaceholder = `$${summaryScope.values.length + 1}`;
  const summaryEndPlaceholder = `$${summaryScope.values.length + 2}`;
  summaryScope.values.push(input.summaryStartIso, input.summaryEndIsoExclusive);

  const summaryPromise = pool.query<SalesMetricsKpiRow>(
    `
      with
      ${summaryScope.ctes},
      won_quotes_in_range as (
        select we.quote_id
        from won_events we
        where we.won_at >= ${summaryStartPlaceholder}::timestamptz
          and we.won_at < ${summaryEndPlaceholder}::timestamptz
      ),
      sent_quotes_in_range as (
        select se.quote_id
        from sent_events se
        where se.sent_at >= ${summaryStartPlaceholder}::timestamptz
          and se.sent_at < ${summaryEndPlaceholder}::timestamptz
      )
      select
        coalesce(
          sum(
            case
              when qalt.quote_line_total > 0
                then (qs.total_final_ars * ls.line_subtotal / qalt.quote_line_total)
              else 0::numeric
            end
          ),
          0
        )::text as total_revenue,
        coalesce(sum(ls.cantidad), 0) as total_units,
        (select count(*) from won_quotes_in_range)::bigint as won_count,
        (select count(*) from sent_quotes_in_range)::bigint as sent_count
      from won_quotes_in_range wq
      join quote_scope qs on qs.id = wq.quote_id
      join quote_all_line_totals qalt on qalt.quote_id = wq.quote_id
      join line_scope ls on ls.quote_id = wq.quote_id
    `,
    summaryScope.values
  );

  const chartScope = buildSalesScope(input);
  const chartsStartPlaceholder = `$${chartScope.values.length + 1}`;
  const chartsEndPlaceholder = `$${chartScope.values.length + 2}`;
  chartScope.values.push(input.chartsStartIso, input.chartsEndIsoExclusive);

  const revenueByCategoryPromise = pool.query<SalesMetricsRevenueByCategoryRow>(
    `
      with
      ${chartScope.ctes}
      select
        to_char(date_trunc('month', we.won_at), 'YYYY-MM-01') as month_start,
        ls.categoria,
        coalesce(
          sum(
            case
              when qalt.quote_line_total > 0
                then (qs.total_final_ars * ls.line_subtotal / qalt.quote_line_total)
              else 0::numeric
            end
          ),
          0
        )::text as amount
      from won_events we
      join quote_scope qs on qs.id = we.quote_id
      join quote_all_line_totals qalt on qalt.quote_id = we.quote_id
      join line_scope ls on ls.quote_id = we.quote_id
      where we.won_at >= ${chartsStartPlaceholder}::timestamptz
        and we.won_at < ${chartsEndPlaceholder}::timestamptz
      group by 1, 2
      order by 1 asc, 2 asc
    `,
    chartScope.values
  );

  const pieScope = buildSalesScope(input);
  const pieStartPlaceholder = `$${pieScope.values.length + 1}`;
  const pieEndPlaceholder = `$${pieScope.values.length + 2}`;
  pieScope.values.push(input.summaryStartIso, input.summaryEndIsoExclusive);

  const sentByClientTypePromise = pool.query<SalesMetricsSentByClientTypeRow>(
    `
      with
      ${pieScope.ctes}
      select
        nullif(trim(coalesce(qs.client_type, '')), '') as client_type,
        count(*)::bigint as sent_count
      from sent_events se
      join quote_scope qs on qs.id = se.quote_id
      where se.sent_at >= ${pieStartPlaceholder}::timestamptz
        and se.sent_at < ${pieEndPlaceholder}::timestamptz
      group by 1
      order by sent_count desc, client_type asc nulls last
    `,
    pieScope.values
  );

  const comparisonScope = buildSalesScope(input);
  const comparisonStartPlaceholder = `$${comparisonScope.values.length + 1}`;
  const comparisonEndPlaceholder = `$${comparisonScope.values.length + 2}`;
  comparisonScope.values.push(input.chartsStartIso, input.chartsEndIsoExclusive);

  const salesVsQuotesPromise = pool.query<SalesMetricsSalesVsQuoteRow>(
    `
      with
      ${comparisonScope.ctes}
      select
        month_start,
        sum(won_count)::bigint as won_count,
        sum(sent_count)::bigint as sent_count
      from (
        select
          to_char(date_trunc('month', se.sent_at), 'YYYY-MM-01') as month_start,
          0::bigint as won_count,
          count(*)::bigint as sent_count
        from sent_events se
        where se.sent_at >= ${comparisonStartPlaceholder}::timestamptz
          and se.sent_at < ${comparisonEndPlaceholder}::timestamptz
        group by 1

        union all

        select
          to_char(date_trunc('month', we.won_at), 'YYYY-MM-01') as month_start,
          count(*)::bigint as won_count,
          0::bigint as sent_count
        from won_events we
        where we.won_at >= ${comparisonStartPlaceholder}::timestamptz
          and we.won_at < ${comparisonEndPlaceholder}::timestamptz
        group by 1
      ) monthly
      group by month_start
      order by month_start asc
    `,
    comparisonScope.values
  );

  const [summaryResult, revenueByCategoryResult, sentByClientTypeResult, salesVsQuotesResult] = await Promise.all([
    summaryPromise,
    revenueByCategoryPromise,
    sentByClientTypePromise,
    salesVsQuotesPromise
  ]);

  const summary = summaryResult.rows[0];
  const totalRevenue = Number(summary?.total_revenue ?? 0);
  const totalUnits = Number(summary?.total_units ?? 0);
  const closedWonCount = Number(summary?.won_count ?? 0);
  const sentQuotesCount = Number(summary?.sent_count ?? 0);

  return {
    kpis: {
      totalRevenue: totalRevenue.toFixed(2),
      closedWonCount,
      sentQuotesCount,
      closeRate: sentQuotesCount > 0 ? (closedWonCount / sentQuotesCount) * 100 : 0,
      averageTicket: totalUnits > 0 ? (totalRevenue / totalUnits).toFixed(2) : "0.00"
    },
    revenueByCategory: revenueByCategoryResult.rows.map((row) => ({
      month_start: row.month_start,
      categoria: row.categoria,
      amount: Number(row.amount ?? 0).toFixed(2)
    })),
    sentByClientType: sentByClientTypeResult.rows.map((row) => ({
      client_type: row.client_type,
      sent_count: Number(row.sent_count ?? 0)
    })),
    salesVsQuotes: salesVsQuotesResult.rows.map((row) => ({
      month_start: row.month_start,
      won_count: Number(row.won_count ?? 0),
      sent_count: Number(row.sent_count ?? 0)
    }))
  };
}

export async function listDashboardNotes(userId: number) {
  const result = await pool.query<DashboardNoteRow>(
    `
      select id, id_usuario, text, completed, created_at, updated_at
      from dashboard_user_notes
      where id_usuario = $1
      order by completed asc, updated_at desc, id desc
    `,
    [userId]
  );

  return result.rows;
}

export async function createDashboardNote(userId: number, text: string) {
  const result = await pool.query<DashboardNoteRow>(
    `
      insert into dashboard_user_notes (id_usuario, text, completed)
      values ($1, $2, false)
      returning id, id_usuario, text, completed, created_at, updated_at
    `,
    [userId, text]
  );

  return result.rows[0];
}

export async function updateDashboardNote(
  userId: number,
  noteId: number,
  input: { text?: string; completed?: boolean }
) {
  const fields: string[] = [];
  const values: unknown[] = [noteId, userId];

  if (input.text !== undefined) {
    values.push(input.text);
    fields.push(`text = $${values.length}`);
  }

  if (input.completed !== undefined) {
    values.push(input.completed);
    fields.push(`completed = $${values.length}`);
  }

  if (!fields.length) {
    const existing = await pool.query<DashboardNoteRow>(
      `
        select id, id_usuario, text, completed, created_at, updated_at
        from dashboard_user_notes
        where id = $1 and id_usuario = $2
        limit 1
      `,
      [noteId, userId]
    );
    return existing.rows[0] ?? null;
  }

  const result = await pool.query<DashboardNoteRow>(
    `
      update dashboard_user_notes
      set ${fields.join(", ")}, updated_at = now()
      where id = $1 and id_usuario = $2
      returning id, id_usuario, text, completed, created_at, updated_at
    `,
    values
  );

  return result.rows[0] ?? null;
}

export async function deleteDashboardNote(userId: number, noteId: number) {
  const result = await pool.query<{ id: string | number }>(
    `delete from dashboard_user_notes where id = $1 and id_usuario = $2 returning id`,
    [noteId, userId]
  );
  return Boolean(result.rows[0]);
}
