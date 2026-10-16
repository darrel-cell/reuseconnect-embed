// Documents Service
import { apiClient, type Paginated } from './api-client';
import { API_BASE_URL, apiTunnelHeaders } from '@/lib/config';
import { log } from '@/lib/log';
import { getAuthenticatedFileUrl } from '@/utils/file-url';

export interface Document {
  id: string;
  tenantId: string;
  jobId?: string;
  bookingId?: string;
  name: string;
  type: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  metadata?: string;
  createdAt: string;
  updatedAt: string;
  booking?: {
    bookingNumber: string;
    client?: {
      name: string;
      organisationName?: string;
    };
  };
  job?: {
    erpJobNumber: string;
    clientName: string;
    organisationName?: string;
  };
}

export type CompletionDocumentType = 'certificate' | 'grading-report' | 'other';

class DocumentsService {
  async getJobDocuments(jobId: string): Promise<Document[]> {
    try {
      const documents = await apiClient.get<Document[]>(`/documents/job/${jobId}`);
      return Array.isArray(documents) ? documents : [];
    } catch {
      return [];
    }
  }

  async getBookingDocuments(bookingId: string): Promise<Document[]> {
    try {
      const documents = await apiClient.get<Document[]>(`/documents/booking/${bookingId}`);
      return Array.isArray(documents) ? documents : [];
    } catch {
      return [];
    }
  }

  /**
   * Upload one or more completion documents (same type). Field name: files.
   */
  async uploadJobDocument(
    jobId: string,
    files: File | File[],
    documentType: CompletionDocumentType,
    displayName?: string
  ): Promise<Document[]> {
    const list = Array.isArray(files) ? files : [files];
    const formData = new FormData();
    for (const file of list) {
      formData.append('files', file);
    }
    formData.append('documentType', documentType);
    if (displayName?.trim()) {
      formData.append('name', displayName.trim());
    }
    return apiClient.postFormData<Document[]>(`/documents/job/${jobId}/upload`, formData);
  }

  /**
   * A page of the current user's documents, keeping the envelope.
   *
   * `/documents` had no `take`; Chain-of-Custody and grading paperwork
   * accumulates one or more rows per job, so this is the call the documents
   * screen uses.
   */
  async getDocumentsPage(filter?: { page?: number; limit?: number }): Promise<Paginated<Document>> {
    const params = new URLSearchParams();
    if (filter?.page) params.append('page', String(filter.page));
    if (filter?.limit) params.append('limit', String(filter.limit));
    const qs = params.toString();
    return apiClient.getPaginated<Document>(`/documents${qs ? `?${qs}` : ''}`);
  }

  async getDocuments(): Promise<Document[]> {
    try {
      const documents = await apiClient.get<Document[]>('/documents');
      // Ensure we always return an array, never undefined
      if (Array.isArray(documents)) {
        return documents;
      }
      // If documents is null or undefined, return empty array
      return [];
    } catch (error) {
      log.error('Failed to fetch documents:', error);
      // Always return an array, never undefined
      return [];
    }
  }

  getDownloadUrl(documentId: string): string {
    return `${API_BASE_URL}/documents/${documentId}/download`;
  }

  /**
   * Download a document file with authentication
   */
  async downloadDocument(documentId: string, fileName?: string): Promise<void> {
    try {
      await this.downloadWithAuth(
        `${API_BASE_URL}/documents/${documentId}/download`,
        fileName || `document-${documentId}.pdf`
      );
    } catch (error) {
      log.error('Failed to download document:', error);
      throw error;
    }
  }

  /**
   * Download a file the backend handed over as a URL (e.g. a job certificate's
   * `downloadUrl`).
   *
   * A plain `<a href>` sends no credentials from the embed, so a URL served by
   * our own API is fetched with the Bearer token instead. Anything on another
   * origin (S3 presigned links, Blancco) is opened directly — the token must
   * never be sent to a third party, and those links carry their own access.
   */
  async downloadFromUrl(rawUrl: string | null | undefined, fallbackFileName: string): Promise<void> {
    const trimmed = rawUrl?.trim();
    if (!trimmed || trimmed === '#') {
      throw new Error('This file is not available yet');
    }

    let resolved: string;
    if (/^(https?:|blob:|data:)/i.test(trimmed)) {
      resolved = trimmed;
    } else if (trimmed.startsWith('/api/')) {
      resolved = `${API_BASE_URL.replace(/\/$/, '')}${trimmed.slice('/api'.length)}`;
    } else {
      // Relative storage paths live under /uploads on the API host.
      resolved = getAuthenticatedFileUrl(trimmed);
      if (resolved === '#') {
        throw new Error('This file is not available yet');
      }
    }

    try {
      const target = new URL(resolved, window.location.href);
      const apiOrigin = new URL(API_BASE_URL, window.location.href).origin;
      if (/^https?:$/.test(target.protocol) && target.origin === apiOrigin) {
        await this.downloadWithAuth(target.href, fallbackFileName);
        return;
      }

      const link = document.createElement('a');
      link.href = target.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = fallbackFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      log.error('Failed to download file:', error);
      throw error;
    }
  }

  private async downloadWithAuth(url: string, fallbackFileName: string): Promise<void> {
    // The embed has no session cookie (the exchange returns the JWT in the body,
    // and the app's SameSite=strict cookies are not sent inside a partner
    // iframe), so this raw fetch must carry the same Bearer token as apiClient.
    const authToken = apiClient.getAuthToken();
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        ...apiTunnelHeaders(),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });

    if (!response.ok) {
      // Try to parse error message from JSON response
      let errorMessage = `Failed to download document: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // If response is not JSON, use statusText
      }
      throw new Error(errorMessage);
    }

    // Get the blob from the response
    const blob = await response.blob();

    // Get filename from Content-Disposition header or use provided/default name
    const contentDisposition = response.headers.get('Content-Disposition');
    let downloadFileName = fallbackFileName;

    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (fileNameMatch && fileNameMatch[1]) {
        downloadFileName = fileNameMatch[1].replace(/['"]/g, '');
      }
    }

    // Create a temporary URL and trigger download
    const urlObject = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = urlObject;
    link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(urlObject);
  }
}

export const documentsService = new DocumentsService();

