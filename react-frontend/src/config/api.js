const API_BASE_URL = process.env.REACT_APP_API_URL || '';

export const apiCall = async (endpoint) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export default API_BASE_URL;