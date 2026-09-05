import JSZip from 'jszip';
import type { PlanDoc } from '@schematic/schema';

import { exportPlan, type ExportBundle, type ExportOptions } from './bundle.js';

/** Fixed so two exports of the same plan produce identical bytes. */
const FIXED_MTIME = new Date(0);

export async function bundleToZip(bundle: ExportBundle): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const file of bundle.files) {
    zip.file(file.path, file.content, { date: FIXED_MTIME });
  }
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export async function exportPlanToZip(
  doc: PlanDoc,
  options: ExportOptions = {},
): Promise<Uint8Array> {
  return bundleToZip(exportPlan(doc, options));
}

/** A safe download filename derived from the plan title. */
export function exportFileName(doc: Pick<PlanDoc, 'title'>): string {
  const base =
    doc.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'plan';
  return `${base}.zip`;
}
