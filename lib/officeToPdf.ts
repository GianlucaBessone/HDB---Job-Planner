import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFile } from 'child_process';

const CACHE_DIR = path.join(process.cwd(), '.cache', 'pdf-previews');

function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

/**
 * Checks if a file name corresponds to an Office document that can be converted to PDF.
 */
export function isOfficeDocument(fileName: string): boolean {
    if (!fileName) return false;
    return /\.(docx?|pptx?|xlsx?)$/i.test(fileName);
}

/**
 * Converts an Office file (PPTX, DOCX, XLSX, etc.) to a PDF Buffer.
 * Uses native Windows COM automation (PowerPoint, Word, Excel) with disk caching.
 */
export async function convertOfficeToPdf(
    buffer: Buffer,
    fileName: string,
    fileId?: string
): Promise<{ pdfBuffer: Buffer; fromCache: boolean } | null> {
    const ext = path.extname(fileName).toLowerCase();
    if (!isOfficeDocument(fileName)) {
        return null;
    }

    ensureCacheDir();
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const cacheKey = fileId ? `${fileId}_${hash.slice(0, 16)}` : hash;
    const cachedPdfPath = path.join(CACHE_DIR, `${cacheKey}.pdf`);

    // Check disk cache first
    if (fs.existsSync(cachedPdfPath)) {
        try {
            const cachedBuffer = fs.readFileSync(cachedPdfPath);
            if (cachedBuffer.length > 0) {
                return { pdfBuffer: cachedBuffer, fromCache: true };
            }
        } catch (e) {
            console.error('Error reading cached PDF preview:', e);
        }
    }

    // Only Windows has Microsoft Office COM automation
    if (process.platform !== 'win32') {
        console.warn('Office COM to PDF conversion is only supported on Windows.');
        return null;
    }

    const tempDir = os.tmpdir();
    const tempInPath = path.join(tempDir, `hdb_in_${cacheKey}${ext}`);
    const tempOutPath = path.join(tempDir, `hdb_out_${cacheKey}.pdf`);

    try {
        fs.writeFileSync(tempInPath, buffer);

        let psScript = '';
        if (ext === '.pptx' || ext === '.ppt') {
            psScript = `
                $ppt = New-Object -ComObject PowerPoint.Application
                $in = '${tempInPath.replace(/'/g, "''")}'
                $out = '${tempOutPath.replace(/'/g, "''")}'
                $pres = $ppt.Presentations.Open($in, -1, 0, 0)
                $pres.SaveAs($out, 32)
                $pres.Close()
                $ppt.Quit()
                [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
            `;
        } else if (ext === '.docx' || ext === '.doc') {
            psScript = `
                $word = New-Object -ComObject Word.Application
                $word.Visible = $false
                $in = '${tempInPath.replace(/'/g, "''")}'
                $out = '${tempOutPath.replace(/'/g, "''")}'
                $doc = $word.Documents.Open($in, $false, $true)
                $doc.SaveAs([ref]$out, [ref]17)
                $doc.Close([ref]$false)
                $word.Quit()
                [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
            `;
        } else if (ext === '.xlsx' || ext === '.xls') {
            psScript = `
                $excel = New-Object -ComObject Excel.Application
                $excel.Visible = $false
                $in = '${tempInPath.replace(/'/g, "''")}'
                $out = '${tempOutPath.replace(/'/g, "''")}'
                $wb = $excel.Workbooks.Open($in, $false, $true)
                $wb.ExportAsFixedFormat(0, $out)
                $wb.Close($false)
                $excel.Quit()
                [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
            `;
        }

        await new Promise<void>((resolve, reject) => {
            execFile(
                'powershell.exe',
                ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
                { timeout: 20000 },
                (error, stdout, stderr) => {
                    if (error) {
                        return reject(error);
                    }
                    resolve();
                }
            );
        });

        if (fs.existsSync(tempOutPath)) {
            const pdfBuffer = fs.readFileSync(tempOutPath);
            if (pdfBuffer.length > 0) {
                // Save to cache
                try {
                    fs.writeFileSync(cachedPdfPath, pdfBuffer);
                } catch (cacheErr) {
                    console.error('Failed to write PDF preview cache:', cacheErr);
                }
                return { pdfBuffer, fromCache: false };
            }
        }
        return null;
    } catch (err) {
        console.error(`Error converting ${fileName} to PDF via Office COM:`, err);
        return null;
    } finally {
        // Cleanup temp files
        try {
            if (fs.existsSync(tempInPath)) fs.unlinkSync(tempInPath);
        } catch (_) {}
        try {
            if (fs.existsSync(tempOutPath)) fs.unlinkSync(tempOutPath);
        } catch (_) {}
    }
}
