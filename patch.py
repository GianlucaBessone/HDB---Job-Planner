import sys

with open('app/herramientas/page.tsx', 'r') as f:
    content = f.read()

rep1_old = """import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import SearchableSelect from '@/components/SearchableSelect';"""

rep1_new = """import { safeApiRequest } from '@/lib/offline';
import { showToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import SearchableSelect from '@/components/SearchableSelect';
import * as XLSX from 'xlsx';
import { FileSpreadsheet } from 'lucide-react';"""

rep2_old = """    const [selectedCarro, setSelectedCarro] = useState<Tool | null>(null);
    const [assigningToolId, setAssigningToolId] = useState('');
    const qrRef = useRef<HTMLDivElement>(null);"""

rep2_new = """    const [selectedCarro, setSelectedCarro] = useState<Tool | null>(null);
    const [assigningToolId, setAssigningToolId] = useState('');
    const [showPrintQROptions, setShowPrintQROptions] = useState(false);
    const qrRef = useRef<HTMLDivElement>(null);"""

rep3_old = """    const handlePrintAllQrs = () => {
        if (!selectedCarro?.herramientas?.length) return;
        const tools = selectedCarro.herramientas;
        const blocks = tools.map(t => {
            const canvas = document.getElementById(`qr-batch-${t.id}`) as HTMLCanvasElement;
            const dataUrl = canvas ? canvas.toDataURL('image/png') : '';
            return `<div class="card"><div class="qr"><img src="${dataUrl}"/></div><div class="info"><div class="nm">${t.nombre}</div><div class="id">${t.id}</div></div></div>`;
        }).join('');

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) { showToast('El navegador bloqueó la ventana emergente. Permitir pop-ups.', 'error'); return; }
        
        printWindow.document.write(`<!DOCTYPE html><html><head><title>QRs - ${selectedCarro.nombre}</title>
        <style>@page{margin:10mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Roboto,sans-serif}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm}.card{border:1px solid #e2e8f0;border-radius:8px;padding:4mm;display:flex;align-items:center;gap:4mm;break-inside:avoid}.qr img{width:25mm;height:25mm}.info{flex:1}.nm{font-size:11px;font-weight:900;color:#0f172a;text-transform:uppercase}.id{font-size:9px;color:#94a3b8;font-family:monospace;margin-top:2px}</style>
        </head><body><h1 style="font-size:16px;margin-bottom:6mm;color:#334155">${selectedCarro.nombre} — Herramientas</h1><div class="grid">${blocks}</div>
        <script>
        setTimeout(function() { window.focus(); window.print(); }, 300);
        <\\/script></body></html>`);
        printWindow.document.close();
    };"""

rep3_new = """    const handlePrintAllQrs = (soloConControl = false) => {
        setShowPrintQROptions(false);
        if (!selectedCarro?.herramientas?.length) return;
        const tools = soloConControl ? selectedCarro.herramientas.filter((t: any) => t.controlActivo) : selectedCarro.herramientas;
        if (tools.length === 0) { showToast('No hay herramientas para imprimir', 'info'); return; }

        const blocks = tools.map((t: any) => {
            const canvas = document.getElementById(`qr-batch-${t.id}`) as HTMLCanvasElement;
            const dataUrl = canvas ? canvas.toDataURL('image/png') : '';
            return `<div class="card"><div class="qr"><img src="${dataUrl}"/></div><div class="info"><div class="nm">${t.nombre}</div><div class="id">${t.id}</div></div></div>`;
        }).join('');

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) { showToast('El navegador bloqueó la ventana emergente. Permitir pop-ups.', 'error'); return; }
        
        printWindow.document.write(`<!DOCTYPE html><html><head><title>QRs - ${selectedCarro.nombre}</title>
        <style>@page{margin:10mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Roboto,sans-serif}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm}.card{border:1px solid #e2e8f0;border-radius:8px;padding:4mm;display:flex;align-items:center;gap:4mm;break-inside:avoid}.qr img{width:25mm;height:25mm}.info{flex:1}.nm{font-size:11px;font-weight:900;color:#0f172a;text-transform:uppercase}.id{font-size:9px;color:#94a3b8;font-family:monospace;margin-top:2px}</style>
        </head><body><h1 style="font-size:16px;margin-bottom:6mm;color:#334155">${selectedCarro.nombre} — Herramientas ${soloConControl ? '(Solo con control)' : ''}</h1><div class="grid">${blocks}</div>
        <script>
        setTimeout(function() { window.focus(); window.print(); }, 300);
        <\\/script></body></html>`);
        printWindow.document.close();
    };

    const handleExportExcel = () => {
        if (!selectedCarro?.herramientas?.length) return;
        const groupMap = new Map<string, { cantidad: number, descripcion: string, marca: string }>();
        selectedCarro.herramientas.forEach((h: any) => {
            const key = `${h.nombre}|${h.marca || ''}`;
            if (!groupMap.has(key)) {
                groupMap.set(key, { cantidad: 0, descripcion: h.nombre, marca: h.marca || '' });
            }
            groupMap.get(key)!.cantidad += 1;
        });
        const data = Array.from(groupMap.values()).map(row => ({
            'Cantidad': row.cantidad,
            'Descripción': row.descripcion,
            'Marca': row.marca
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Herramientas");
        XLSX.writeFile(wb, `Carro_${selectedCarro.nombre}_Herramientas.xlsx`);
    };"""

rep4_old = """                                    <button onClick={handlePrintAllQrs} disabled={!selectedCarro.herramientas?.length}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-xs hover:bg-indigo-100 transition-colors disabled:opacity-40">
                                        <Printer className="w-4 h-4" /> Imprimir QRs
                                    </button>"""

rep4_new = """                                    <div className="flex items-center gap-2">
                                        <button onClick={handleExportExcel} disabled={!selectedCarro.herramientas?.length}
                                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-colors disabled:opacity-40">
                                            <FileSpreadsheet className="w-4 h-4" /> Exportar
                                        </button>
                                        <button onClick={() => setShowPrintQROptions(true)} disabled={!selectedCarro.herramientas?.length}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-xs hover:bg-indigo-100 transition-colors disabled:opacity-40">
                                            <Printer className="w-4 h-4" /> Imprimir QRs
                                        </button>
                                    </div>"""

rep5_old = """                </div>
            </div>
        </div>"""

rep5_new = """                </div>
            </div>

            {/* Modal de opciones de impresión QR */}
            {showPrintQROptions && (
                <div className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPrintQROptions(false)}>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">Imprimir QRs</h3>
                        <p className="text-sm font-medium text-slate-500 mb-6">¿Qué herramientas deseas imprimir de este carro?</p>
                        <div className="space-y-3">
                            <button onClick={() => handlePrintAllQrs(false)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 transition-colors">
                                Todas las herramientas
                            </button>
                            <button onClick={() => handlePrintAllQrs(true)} className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                Solo sujetas a control
                            </button>
                            <button onClick={() => setShowPrintQROptions(false)} className="w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>"""

rep6_old = """    const handleVerify = async (estado: 'APROBADA' | 'RECHAZADA') => {
        if (!tool) return;
        try {
            const res = await safeApiRequest('/api/herramientas/verificar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toolId: tool.id, operadorId: user.id, operadorNombre: user.nombreCompleto, estado })
            });
            if (!res.ok) { const e = await res.json(); showToast(e.error || 'Error', 'error'); return; }
            showToast(`Herramienta ${estado.toLowerCase()}`, 'success');
            loadTool(tool.id);
            setVerifyMode(false);
        } catch (e) { showToast('Error de conexión', 'error'); }
    };"""

rep6_new = """    const handleVerify = async (estado: 'APROBADA' | 'RECHAZADA') => {
        if (!tool) return;
        try {
            const res = await safeApiRequest('/api/herramientas/verificar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toolId: tool.id, operadorId: user.id, operadorNombre: user.nombreCompleto, estado })
            });
            if (!res.ok) { const e = await res.json(); showToast(e.error || 'Error', 'error'); return; }
            showToast(`Herramienta ${estado.toLowerCase()}`, 'success');
            loadTool(tool.id);
            setVerifyMode(false);
        } catch (e) { showToast('Error de conexión', 'error'); }
    };

    const handlePrintPlanilla = () => {
        if (!tool) return;
        
        let itemsToPrint: any[] = [];
        if (tool.tipo === 'CARRO' && tool.herramientas) {
            itemsToPrint = tool.herramientas;
        } else {
            itemsToPrint = [tool];
        }

        const rows = itemsToPrint.map((h: any) => {
            const estadoActual = h.estadoHerramienta || '-';
            const fechaUltimo = h.ultimoControlFecha ? new Date(h.ultimoControlFecha).toLocaleDateString('es-AR') : '-';
            const respUltimo = h.ultimoControlOperador || '-';
            let estadoVerif = '-';
            if (h.estadoControl && ESTADO_CONTROL_STYLES[h.estadoControl as keyof typeof ESTADO_CONTROL_STYLES]) {
                estadoVerif = ESTADO_CONTROL_STYLES[h.estadoControl as keyof typeof ESTADO_CONTROL_STYLES].label;
                if (h.diasRestantes !== null && h.diasRestantes >= 0) estadoVerif += ` (${h.diasRestantes}D)`;
            }
            const fechaProx = h.proximoControlFecha ? new Date(h.proximoControlFecha).toLocaleDateString('es-AR') : '-';
            
            return `
                <tr>
                    <td style="font-family: monospace; font-size: 10px;">${h.id}</td>
                    <td><b>${h.nombre}</b></td>
                    <td style="color: ${estadoActual === 'APROBADA' ? '#16a34a' : (estadoActual === 'RECHAZADA' ? '#dc2626' : '#333')}">${estadoActual}</td>
                    <td>${fechaUltimo}</td>
                    <td>${respUltimo}</td>
                    <td>${estadoVerif}</td>
                    <td>${fechaProx}</td>
                </tr>
            `;
        }).join('');

        const printWindow = window.open('', '_blank');
        if (!printWindow) { showToast('El navegador bloqueó la ventana emergente. Permitir pop-ups.', 'error'); return; }
        
        const title = `Planilla de Verificación - ${tool.nombre}`;

        printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            @page { margin: 10mm; size: landscape; }
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
            h1 { font-size: 18px; margin-bottom: 5px; color: #0f172a; }
            p { font-size: 12px; color: #64748b; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background-color: #f8fafc; color: #475569; text-transform: uppercase; font-size: 10px; font-weight: 700; }
            tr:nth-child(even) { background-color: #f1f5f9; }
        </style>
        </head><body>
            <h1>${title}</h1>
            <p>Generado el: ${new Date().toLocaleString('es-AR')}</p>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Herramienta</th>
                        <th>Estado Actual</th>
                        <th>Fecha Último Control</th>
                        <th>Responsable Último Control</th>
                        <th>Estado Verificación</th>
                        <th>Próxima Verificación</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
            <script>
                setTimeout(function() { window.focus(); window.print(); }, 500);
            <\\/script>
        </body></html>`);
        printWindow.document.close();
    };"""

rep7_old = """                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{tool.nombre}</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono mt-1">ID: {tool.id}</p>
                        </div>
                        <button onClick={() => setTool(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400"><X className="w-5 h-5" /></button>
                    </div>"""

rep7_new = """                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{tool.nombre}</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono mt-1">ID: {tool.id}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handlePrintPlanilla} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors" title="Imprimir Planilla">
                                <Printer className="w-5 h-5" />
                            </button>
                            <button onClick={() => setTool(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400"><X className="w-5 h-5" /></button>
                        </div>
                    </div>"""

for i, (old, new) in enumerate([(rep1_old, rep1_new), (rep2_old, rep2_new), (rep3_old, rep3_new), (rep4_old, rep4_new), (rep5_old, rep5_new), (rep6_old, rep6_new), (rep7_old, rep7_new)]):
    if old not in content:
        print(f"Error: Could not find block {i+1}:\n{old[:100]}...")
        sys.exit(1)
    content = content.replace(old, new)

with open('app/herramientas/page.tsx', 'w') as f:
    f.write(content)
print("Success")
