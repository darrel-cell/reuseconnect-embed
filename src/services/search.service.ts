// Global Search Service
import { apiClient } from './api-client';
import type { User } from '@/types/auth';
import { transformJobs } from './data-transform';

export interface SearchResult {
  type: 'job' | 'client' | 'booking';
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
}

class SearchService {
  async search(query: string, user?: User | null): Promise<SearchResponse> {
    if (!query || query.trim().length < 2) {
      return { results: [], total: 0 };
    }

    const results: SearchResult[] = [];

    try {
      // Search Jobs (backend supports searchQuery parameter)
      const jobsParams = new URLSearchParams();
      jobsParams.append('searchQuery', query);
      jobsParams.append('limit', '5');
      const jobsResponse = await apiClient.get<any[]>(`/jobs?${jobsParams.toString()}`);
      const jobs = transformJobs(jobsResponse || []);

      jobs.slice(0, 5).forEach(job => {
        results.push({
          type: 'job',
          id: job.id,
          title: job.organisationName,
          subtitle: `${job.erpJobNumber} • ${job.siteName}`,
          url: `/jobs/${job.id}`,
        });
      });

      // Search Clients (backend supports searchQuery parameter)
      const clientsParams = new URLSearchParams();
      clientsParams.append('searchQuery', query);
      clientsParams.append('limit', '5');
      const clientsResponse = await apiClient.get<any[] | null>(`/clients?${clientsParams.toString()}`);
      const clients = clientsResponse || [];

      clients.slice(0, 5).forEach((client: any) => {
        results.push({
          type: 'client',
          id: client.id,
          title: client.organisationName || client.name,
          subtitle: client.email || client.contactName || 'Client',
          url: `/clients`,
        });
      });

      // Search Bookings (backend supports searchQuery parameter)
      const bookingsParams = new URLSearchParams();
      bookingsParams.append('searchQuery', query);
      bookingsParams.append('limit', '5');
      const bookingsResponse = await apiClient.get<any[] | null>(`/bookings?${bookingsParams.toString()}`);
      const bookings = bookingsResponse || [];

      bookings.slice(0, 5).forEach((booking: any) => {
        results.push({
          type: 'booking',
          id: booking.id,
          title: booking.organisationName || booking.clientName,
          subtitle: `${booking.bookingNumber} • ${booking.siteName}`,
          url: `/bookings/${booking.id}`,
        });
      });
    } catch (error) {
      console.error('Search error:', error);
      // Return empty results on error rather than throwing
      return { results: [], total: 0 };
    }

    return {
      results: results.slice(0, 10), // Limit total results
      total: results.length,
    };
  }
}

export const searchService = new SearchService();

