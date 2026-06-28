import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatDateTimeInline } from "@/lib/formatDate";
import { CheckCircle2, XCircle, FileText, User, Calendar, ShieldAlert } from "lucide-react";

export default async function DocumentPrintVerificationPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;

  const docPrint = await prisma.documentPrint.findUnique({
    where: { token },
    include: {
      document: {
        include: {
          versions: {
            orderBy: { createdAt: "desc" },
            take: 1
          }
        }
      },
      version: true,
    },
  });

  if (!docPrint) {
    notFound();
  }

  const { document, version, operatorNombre, fechaImpresion } = docPrint;
  
  // Determine if this print is from the latest version and if the document is active
  const latestVersion = document.versions[0];
  const isLatestVersion = latestVersion && latestVersion.id === version.id;
  const isDocumentActive = document.estado === "vigente";
  
  const isObsolete = !isLatestVersion || !isDocumentActive;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card text-card-foreground rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
        
        {/* Header Status Bar */}
        <div className={`p-6 text-center text-white ${isObsolete ? 'bg-red-600' : 'bg-green-600'}`}>
          {isObsolete ? (
            <XCircle className="w-16 h-16 mx-auto mb-4 opacity-90" />
          ) : (
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-90" />
          )}
          <h1 className="text-3xl font-black tracking-tight uppercase">
            {isObsolete ? "Copia Obsoleta" : "Copia Vigente"}
          </h1>
          <p className="mt-2 text-sm font-medium opacity-90 uppercase tracking-wider">
            Verificación de Control Documental
          </p>
        </div>

        {/* Document Details */}
        <div className="p-6 space-y-6">
          <div className="text-center pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="inline-block px-3 py-1 bg-muted text-muted-foreground text-slate-600 dark:text-slate-300 font-bold text-xs rounded-full mb-3 uppercase tracking-wider">
              {document.codigoDocumental}
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight">
              {document.titulo}
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Impreso por</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{operatorNombre}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha y Hora de Impresión</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{formatDateTimeInline(fechaImpresion)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Versión Impresa</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  v{version.versionMayor}.{version.versionMenor}
                </p>
              </div>
            </div>
          </div>

          {isObsolete && (
            <div className="mt-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" />
              <div>
                <h3 className="font-bold text-red-800 dark:text-red-400 text-sm">ATENCIÓN</h3>
                <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                  Esta copia ya no es válida. 
                  {!isLatestVersion ? " Existe una versión más reciente del documento en el sistema." : " El documento ya no se encuentra vigente."}
                  Por favor, destruya esta copia y consulte la versión actual en el SGI.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-background text-foreground/50 p-4 text-center border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            HDB - Sistema de Gestión Integrado
          </p>
        </div>
      </div>
    </div>
  );
}
