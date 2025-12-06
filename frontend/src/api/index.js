import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${API_URL}/api`;

const api = axios.create({
  baseURL: API,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth API
export const authApi = {
  getDiscordAuthUrl: () => api.get('/auth/discord'),
  discordCallback: (code, state) => api.get(`/auth/discord/callback?code=${code}&state=${state}`),
  getUser: (userId) => api.get(`/auth/user/${userId}`),
};

// Anime API
export const animeApi = {
  getList: (params) => api.get('/anime', { params }),
  getFeatured: () => api.get('/anime/featured'),
  getTrending: () => api.get('/anime/trending'),
  getRecent: () => api.get('/anime/recent'),
  getGenres: () => api.get('/anime/genres'),
  getById: (id) => api.get(`/anime/${id}`),
  create: (data) => api.post('/anime', data),
  update: (id, data) => api.put(`/anime/${id}`, data),
  delete: (id) => api.delete(`/anime/${id}`),
  addEpisode: (animeId, data) => api.post(`/anime/${animeId}/episodes`, data),
  getEpisodes: (animeId) => api.get(`/anime/${animeId}/episodes`),
  deleteEpisode: (animeId, episodeNumber) => api.delete(`/anime/${animeId}/episodes/${episodeNumber}`),
};

// User API
export const userApi = {
  getWatchlist: (userId) => api.get(`/user/${userId}/watchlist`),
  addToWatchlist: (userId, animeId) => api.post(`/user/${userId}/watchlist/${animeId}`),
  removeFromWatchlist: (userId, animeId) => api.delete(`/user/${userId}/watchlist/${animeId}`),
  checkWatchlist: (userId, animeId) => api.get(`/user/${userId}/watchlist/${animeId}/check`),
  
  getFavorites: (userId) => api.get(`/user/${userId}/favorites`),
  addToFavorites: (userId, animeId) => api.post(`/user/${userId}/favorites/${animeId}`),
  removeFromFavorites: (userId, animeId) => api.delete(`/user/${userId}/favorites/${animeId}`),
  checkFavorites: (userId, animeId) => api.get(`/user/${userId}/favorites/${animeId}/check`),
  
  getHistory: (userId) => api.get(`/user/${userId}/history`),
  updateHistory: (userId, animeId, episodeNumber, progress) => 
    api.post(`/user/${userId}/history?anime_id=${animeId}&episode_number=${episodeNumber}&progress=${progress}`),
};

// Jikan API
export const jikanApi = {
  search: (q, page = 1) => api.get('/jikan/search', { params: { q, page } }),
  import: (malId) => api.post(`/jikan/import/${malId}`),
};

// Seed API
export const seedApi = {
  seed: () => api.post('/seed'),
};

export default api;
