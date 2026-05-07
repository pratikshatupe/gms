const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const API = API_BASE;

// optional helper
export const getApiUrl = (path = '') => {
  return `${API_BASE}${path}`;
};