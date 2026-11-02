'use client';

import type { ReactNode } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { OTPdfDocument } from './OTPdfDocument';

// Import estático de react-pdf: es un paquete solo-ESM y externo en el servidor
// (serverExternalPackages), así que no puede cargarse con import() dinámico.
// Las páginas cargan este componente con next/dynamic y ssr: false.
interface OTPdfDownloadLinkProps {
  ot: any;
  fileName: string;
  className?: string;
  children: ReactNode;
}

export default function OTPdfDownloadLink({ ot, fileName, className, children }: OTPdfDownloadLinkProps) {
  return (
    <PDFDownloadLink document={<OTPdfDocument ot={ot} />} fileName={fileName} className={className}>
      {children}
    </PDFDownloadLink>
  );
}
