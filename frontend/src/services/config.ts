export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

/** When true, services use mock data only. Otherwise API first, mock on failure. */
export const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true'
