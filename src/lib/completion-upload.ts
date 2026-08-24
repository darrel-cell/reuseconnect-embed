/** Keep in sync with reuseconnect-backend upload-document.middleware + MAX_COMPLETION_FILES */

export const MAX_COMPLETION_UPLOAD_FILES = 40;

export const COMPLETION_DOC_ACCEPT =
  ".pdf,.csv,.xlsx,.xls,.txt,.zip,application/pdf,image/jpeg,image/png,image/webp,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/zip,application/x-zip-compressed";

const ALLOWED_EXT = new Set([
  ".pdf",
  ".csv",
  ".xlsx",
  ".xls",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".txt",
  ".zip",
]);

export function isAllowedCompletionUploadFile(file: File): boolean {
  const name = file.name || "";
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  const ext = name.slice(dot).toLowerCase();
  return ALLOWED_EXT.has(ext);
}

/** Flatten folder picks: keep allowed files only (subfolders are walked by the browser). */
export function filterCompletionUploadFiles(files: FileList | File[]): File[] {
  return Array.from(files).filter(isAllowedCompletionUploadFile);
}
