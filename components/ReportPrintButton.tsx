'use client';
import { Download } from 'lucide-react';

export default function ReportPrintButton() {
    return (
        <button
            onClick={() => window.print()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-xl transition-all"
        >
            <Download className="w-5 h-5" />
            Generar / Imprimir PDF
        </button>
    );
}
