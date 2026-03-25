
/**
 * A safe wrapper for the native fetch API.
 * This ensures compatibility with restricted environments where window.fetch is read-only.
 * It also provides common error handling and request/response logging.
 */

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string>;
}

export async function apiRequest<T = any>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Construct URL with query parameters if provided
  let finalUrl = url;
  if (params) {
    const searchParams = new URLSearchParams(params);
    finalUrl += (finalUrl.includes('?') ? '&' : '?') + searchParams.toString();
  }

  try {
    // Call the original fetch without modifying global objects
    const response = await window.fetch(finalUrl, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `API Request failed with status ${response.status}`;
      try {
        const parsedError = JSON.parse(errorBody);
        errorMessage = parsedError.message || errorMessage;
      } catch (e) {
        // Not JSON, use default or raw text
        if (errorBody) errorMessage = errorBody;
      }
      throw new Error(errorMessage);
    }

    // Handle empty responses
    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    console.error(`[API Error] ${url}:`, error);
    throw error;
  }
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get: <T = any>(url: string, options?: ApiRequestOptions) => 
    apiRequest<T>(url, { ...options, method: 'GET' }),
  
  post: <T = any>(url: string, body?: any, options?: ApiRequestOptions) => 
    apiRequest<T>(url, { 
      ...options, 
      method: 'POST', 
      body: body ? JSON.stringify(body) : undefined 
    }),
  
  put: <T = any>(url: string, body?: any, options?: ApiRequestOptions) => 
    apiRequest<T>(url, { 
      ...options, 
      method: 'PUT', 
      body: body ? JSON.stringify(body) : undefined 
    }),
  
  delete: <T = any>(url: string, options?: ApiRequestOptions) => 
    apiRequest<T>(url, { ...options, method: 'DELETE' }),
};
