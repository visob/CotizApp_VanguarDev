export function activeReactivationSql(alias: string) {
  return `
    coalesce(
      case ${alias}.reactivacion_activa
        when 1 then ${alias}.fecha_reactivacion_1
        when 2 then ${alias}.fecha_reactivacion_2
        when 3 then ${alias}.fecha_reactivacion_3
        else null
      end,
      ${alias}.proxima_alerta,
      (
        select min(s.fecha_reactivacion_programada)
        from seguimiento s
        where s.id_cotizacion = ${alias}.id and s.fecha_reactivacion_programada is not null
      )
    )
  `;
}
