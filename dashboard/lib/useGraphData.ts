'use client';

import { useState, useEffect, useCallback } from 'react';
import { GraphNode, GraphEdge, GraphData, GraphResponse } from '../types/graph';

interface UseGraphDataOptions {
  predefined?: string;
  query?: string;
  params?: Record<string, any>;
  autoFetch?: boolean;
  refreshInterval?: number; // in milliseconds
}

interface UseGraphDataReturn {
  data: GraphData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  executeQuery: (query: string, params?: Record<string, any>) => Promise<void>;
}

/**
 * Custom hook for fetching and managing graph data from Neo4j
 * 
 * @param options Configuration options for the hook
 * @returns Graph data, loading state, error state, and refetch function
 */
export function useGraphData(options: UseGraphDataOptions = {}): UseGraphDataReturn {
  const {
    predefined,
    query,
    params,
    autoFetch = true,
    refreshInterval,
  } = options;

  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch graph data from the API
   */
  const fetchGraphData = useCallback(async (
    customQuery?: string,
    customParams?: Record<string, any>
  ) => {
    setLoading(true);
    setError(null);

    try {
      let url = '/api/graph';
      const queryToUse = customQuery || query;
      const paramsToUse = customParams || params;

      // Build query string for GET request
      if (predefined && !queryToUse) {
        url += `?predefined=${encodeURIComponent(predefined)}`;
        if (paramsToUse) {
          url += `&params=${encodeURIComponent(JSON.stringify(paramsToUse))}`;
        }
      } else if (queryToUse) {
        // Use POST for custom queries
        const response = await fetch('/api/graph', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: queryToUse,
            params: paramsToUse,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: GraphResponse = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch graph data');
        }

        setData(result.data);
        setLoading(false);
        return;
      }

      // GET request for predefined queries
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: GraphResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch graph data');
      }

      setData(result.data);
    } catch (err: any) {
      console.error('Error fetching graph data:', err);
      setError(err.message || 'An error occurred while fetching graph data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [predefined, query, params]);

  /**
   * Execute a custom Cypher query
   */
  const executeQuery = useCallback(async (
    customQuery: string,
    customParams?: Record<string, any>
  ) => {
    await fetchGraphData(customQuery, customParams);
  }, [fetchGraphData]);

  /**
   * Refetch the current query
   */
  const refetch = useCallback(async () => {
    await fetchGraphData();
  }, [fetchGraphData]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchGraphData();
    }
  }, [autoFetch, fetchGraphData]);

  // Set up refresh interval if specified
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const intervalId = setInterval(() => {
        fetchGraphData();
      }, refreshInterval);

      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, fetchGraphData]);

  return {
    data,
    loading,
    error,
    refetch,
    executeQuery,
  };
}

/**
 * Predefined query names available in the API
 */
export const PREDEFINED_QUERIES = {
  FULL_AUDIT: 'full-audit',
  USER_POLICIES: 'user-policies',
  RECENT_DECISIONS: 'recent-decisions',
  TRANSACTION_FLOW: 'transaction-flow',
  POLICY_VIOLATIONS: 'policy-violations',
} as const;

/**
 * Helper function to fetch graph data without using the hook
 * Useful for one-off queries or server-side usage
 */
export async function fetchGraphData(
  options: {
    predefined?: string;
    query?: string;
    params?: Record<string, any>;
  }
): Promise<GraphData> {
  const { predefined, query, params } = options;

  let url = '/api/graph';

  if (predefined && !query) {
    url += `?predefined=${encodeURIComponent(predefined)}`;
    if (params) {
      url += `&params=${encodeURIComponent(JSON.stringify(params))}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: GraphResponse = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch graph data');
    }

    return result.data;
  } else if (query) {
    const response = await fetch('/api/graph', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, params }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: GraphResponse = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch graph data');
    }

    return result.data;
  }

  throw new Error('Either predefined or query must be provided');
}
