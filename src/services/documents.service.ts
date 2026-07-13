// Documents Service
import { apiClient } from './api-client';
import { API_BASE_URL, apiTunnelHeaders } from '@/lib/config';

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
    };
  };
  job?: {
    erpJobNumber: string;
    clientName: string;
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
      console.error('Failed to fetch documents:', error);
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
      const url = `${API_BASE_URL}/documents/${documentId}/download`;
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include', // Include httpOnly cookie (auth_token) automatically
        headers: {
          ...apiTunnelHeaders(),
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
      let downloadFileName = fileName || `document-${documentId}.pdf`;
      
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
    } catch (error) {
      console.error('Failed to download document:', error);
      throw error;
    }
  }
}

export const documentsService = new DocumentsService();

