import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { armarDocumento, fmtFecha, fmtNum, type VersionDocumento, type SeccionDoc } from '@/lib/presupuestosServicio/documento';
import type { OpcionesDocumento } from '@/lib/presupuestosServicio/calculos';

Font.registerHyphenationCallback((word) => [word]);

const S = StyleSheet.create({
    page: { paddingTop: 22, paddingBottom: 36, paddingHorizontal: 30, fontFamily: 'Helvetica', fontSize: 8.5, color: '#1e293b', lineHeight: 1.3 },
    header: { flexDirection: 'row', borderWidth: 1, borderColor: '#0f172a', borderRadius: 4, marginBottom: 8 },
    headerLeft: { width: '58%', padding: 7, borderRightWidth: 1, borderRightColor: '#0f172a' },
    headerRight: { width: '42%', padding: 7, justifyContent: 'space-between' },
    logo: { width: 120, height: 34, objectFit: 'contain', marginBottom: 3 },
    company: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    tagline: { fontSize: 7, color: '#334155', marginTop: 1 },
    fiscal: { fontSize: 6.5, color: '#475569', marginTop: 2, lineHeight: 1.3 },
    docTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
    docNumber: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', marginTop: 2 },
    meta: { fontSize: 7.5, color: '#334155', marginTop: 2 },
    box: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, padding: 7, marginBottom: 8, flexDirection: 'row' },
    boxCol: { flex: 1 },
    label: { fontSize: 6.8, color: '#64748b', textTransform: 'uppercase' },
    value: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginTop: 1 },
    h3: { fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#0f172a', marginTop: 10, marginBottom: 4 },
    p: { fontSize: 8.5, lineHeight: 1.4 },
    li: { fontSize: 8.5, marginLeft: 8, marginBottom: 1 },
    tHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#94a3b8', paddingVertical: 3 },
    tRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', paddingVertical: 3 },
    tRowGroup: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', paddingVertical: 3, backgroundColor: '#f1f5f9' },
    th: { fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: '#475569', textTransform: 'uppercase' },
    td: { fontSize: 8 },
    num: { textAlign: 'right' },
    totals: { alignSelf: 'flex-end', width: 230, marginTop: 10 },
    totRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
    totBig: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1.5, borderTopColor: '#0f172a', marginTop: 2 },
    sigs: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 34 },
    sig: { width: '42%', borderTopWidth: 0.8, borderTopColor: '#64748b', paddingTop: 3, alignItems: 'center' },
    footer: { position: 'absolute', bottom: 14, left: 30, right: 30, flexDirection: 'row', justifyContent: 'space-between', fontSize: 6.5, color: '#64748b' },
});

const money = (n: number) => `$ ${(Math.round(n * 100) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface PresupuestoPdfProps {
    numero: string;
    titulo: string;
    cliente: { nombre: string; direccion?: string | null; telefono?: string | null; email?: string | null };
    version: VersionDocumento;
    opciones: OpcionesDocumento;
    fechaEmision: string; // YYYY-MM-DD
    fechaVencimiento: string | null;
    logoBase64?: string | null;
    borrador?: boolean;
}

function Tabla({ s }: { s: SeccionDoc }) {
    const c = s.columnas;
    const w = {
        codigo: c.codigo ? 46 : 0,
        cantidad: c.cantidad ? 64 : 0,
        horas: c.horas ? 40 : 0,
        unitario: c.unitario ? 66 : 0,
        importe: c.importe ? 74 : 0,
    };
    return (
        <View wrap>
            <View style={S.tHead} fixed>
                {c.codigo ? <Text style={[S.th, { width: w.codigo }]}>Código</Text> : null}
                <Text style={[S.th, { flex: 1 }]}>{s.titulo === 'Mano de obra' ? 'Tarea / categoría' : 'Descripción'}</Text>
                {c.horas ? <Text style={[S.th, S.num, { width: w.horas }]}>Horas</Text> : null}
                {c.cantidad ? <Text style={[S.th, S.num, { width: w.cantidad }]}>Cantidad</Text> : null}
                {c.unitario ? <Text style={[S.th, S.num, { width: w.unitario }]}>{c.horas ? 'Valor hora' : 'Precio unit.'}</Text> : null}
                {c.importe ? <Text style={[S.th, S.num, { width: w.importe }]}>Importe</Text> : null}
            </View>
            {s.filas.map((f, i) => (
                <View key={i} style={f.nivel === 0 && s.titulo === 'Mano de obra' && s.columnas.unitario ? S.tRowGroup : S.tRow} wrap={false}>
                    {c.codigo ? <Text style={[S.td, { width: w.codigo, fontSize: 7 }]}>{f.codigo || ''}</Text> : null}
                    <Text style={[S.td, { flex: 1, paddingLeft: f.nivel === 1 ? 10 : 0, fontFamily: f.nivel === 0 && s.columnas.unitario && s.titulo === 'Mano de obra' ? 'Helvetica-Bold' : 'Helvetica' }]}>
                        {f.descripcion}
                    </Text>
                    {c.horas ? <Text style={[S.td, S.num, { width: w.horas }]}>{f.horas != null ? fmtNum(f.horas) : ''}</Text> : null}
                    {c.cantidad ? <Text style={[S.td, S.num, { width: w.cantidad }]}>{f.cantidad != null ? `${fmtNum(f.cantidad)} ${f.unidad || ''}` : ''}</Text> : null}
                    {c.unitario ? <Text style={[S.td, S.num, { width: w.unitario }]}>{f.unitario != null ? money(f.unitario) : ''}</Text> : null}
                    {c.importe ? <Text style={[S.td, S.num, { width: w.importe }]}>{f.importe != null ? money(f.importe) : ''}</Text> : null}
                </View>
            ))}
        </View>
    );
}

export function PresupuestoPdfDocument(props: PresupuestoPdfProps) {
    const doc = armarDocumento(props.version, props.opciones);
    const v = props.version;
    return (
        <Document title={`Presupuesto_${props.numero}_rev${v.version}`} author="HDB Servicios Eléctricos" subject={`Presupuesto de servicio ${props.numero}`}>
            <Page size="A4" style={S.page}>
                <View style={S.header}>
                    <View style={S.headerLeft}>
                        {props.logoBase64 ? <Image style={S.logo} src={props.logoBase64} /> : null}
                        <Text style={S.company}>HDB SERVICIOS ELÉCTRICOS</Text>
                        <Text style={S.tagline}>Materiales Eléctricos • Tableros • Obras e Ingeniería</Text>
                        <Text style={S.fiscal}>
                            Razón Social: Bassignana Hernán David{'\n'}
                            C.U.I.T.: 20-26566944-2{'\n'}
                            Dirección: Juan Bautista Alberdi 448, Arroyito (2434), Córdoba
                        </Text>
                    </View>
                    <View style={S.headerRight}>
                        <View>
                            <Text style={S.docTitle}>PRESUPUESTO DE SERVICIO</Text>
                            <Text style={S.docNumber}>Nº {props.numero} · Rev. {v.version}</Text>
                            {props.borrador ? <Text style={[S.meta, { color: '#b45309', fontFamily: 'Helvetica-Bold' }]}>BORRADOR — NO ENVIADO</Text> : null}
                        </View>
                        <View>
                            <Text style={S.meta}>Fecha: {fmtFecha(props.fechaEmision)}</Text>
                            {props.fechaVencimiento ? <Text style={S.meta}>Válido hasta: {fmtFecha(props.fechaVencimiento)}</Text> : <Text style={S.meta}>Validez: {v.validezDias} días</Text>}
                            <Text style={S.meta}>Documento no válido como factura</Text>
                        </View>
                    </View>
                </View>

                <View style={S.box}>
                    <View style={S.boxCol}>
                        <Text style={S.label}>Cliente</Text>
                        <Text style={S.value}>{props.cliente.nombre}</Text>
                        {props.cliente.direccion ? <Text style={S.meta}>{props.cliente.direccion}</Text> : null}
                        {props.cliente.telefono || props.cliente.email ? (
                            <Text style={S.meta}>{[props.cliente.telefono, props.cliente.email].filter(Boolean).join(' · ')}</Text>
                        ) : null}
                    </View>
                    <View style={S.boxCol}>
                        <Text style={S.label}>Obra</Text>
                        <Text style={S.value}>{props.titulo}</Text>
                    </View>
                </View>

                {v.alcance ? (
                    <View>
                        <Text style={S.h3}>Alcance</Text>
                        <Text style={S.p}>{v.alcance}</Text>
                    </View>
                ) : null}

                {doc.listaTareas.length ? (
                    <View style={{ marginTop: 4 }}>
                        {doc.listaTareas.map((t, i) => (
                            <Text key={i} style={S.li}>• {t.descripcion}{t.horas != null ? ` · ${fmtNum(t.horas)} h` : ''}</Text>
                        ))}
                    </View>
                ) : null}

                {doc.secciones.map((s, i) => (
                    <View key={i}>
                        <Text style={S.h3}>{s.titulo}</Text>
                        <Tabla s={s} />
                    </View>
                ))}

                {doc.resumen.length ? (
                    <View>
                        <Text style={S.h3}>Resumen</Text>
                        {doc.resumen.map((r, i) => (
                            <View key={i} style={S.tRow}>
                                <Text style={[S.td, { flex: 1 }]}>{r.descripcion}</Text>
                                <Text style={[S.td, S.num, { width: 90 }]}>{money(r.importe)}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                <View style={S.totals} wrap={false}>
                    {doc.totales.map((t, i) => (
                        <View key={i} style={t.destacado ? S.totBig : S.totRow}>
                            <Text style={t.destacado ? { fontFamily: 'Helvetica-Bold', fontSize: 10 } : { color: '#475569' }}>{t.etiqueta}</Text>
                            <Text style={t.destacado ? { fontFamily: 'Helvetica-Bold', fontSize: 10 } : undefined}>{money(t.importe)}</Text>
                        </View>
                    ))}
                    {v.listaPrecioNombre ? <Text style={[S.meta, { textAlign: 'right' }]}>Lista de precios: {v.listaPrecioNombre}</Text> : null}
                </View>

                {doc.plazo ? (
                    <View wrap={false}>
                        <Text style={S.h3}>Plazo de ejecución</Text>
                        <Text style={S.p}>{doc.plazo}</Text>
                    </View>
                ) : null}

                {props.opciones.condiciones ? (
                    <View wrap={false}>
                        <Text style={S.h3}>Condiciones</Text>
                        <Text style={S.p}>
                            Oferta válida por {doc.validezDias} días. Precios en pesos argentinos{doc.ivaDiscriminado ? ', IVA discriminado' : ', IVA incluido'}.
                            {doc.condiciones ? `\n${doc.condiciones}` : ''}
                        </Text>
                    </View>
                ) : null}

                <View style={S.sigs} wrap={false}>
                    <View style={S.sig}>
                        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5 }}>HDB SERVICIOS ELÉCTRICOS</Text>
                        <Text style={{ fontSize: 6.8, color: '#64748b' }}>Firma y sello</Text>
                    </View>
                    <View style={S.sig}>
                        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5 }}>{props.cliente.nombre}</Text>
                        <Text style={{ fontSize: 6.8, color: '#64748b' }}>Conformidad: firma, aclaración y DNI/CUIT</Text>
                    </View>
                </View>

                <View style={S.footer} fixed>
                    <Text>HDB Servicios Eléctricos · Juan Bautista Alberdi 448, Arroyito (Cba) · CUIT 20-26566944-2 · SGI</Text>
                    <Text render={({ pageNumber, totalPages }) => `Presupuesto ${props.numero} rev. ${v.version} — Pág. ${pageNumber} de ${totalPages}`} />
                </View>
            </Page>
        </Document>
    );
}

export default PresupuestoPdfDocument;
