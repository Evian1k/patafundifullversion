/**
 * API Client for FixIt Connect Backend
 * Uses custom REST API (no Supabase)
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (includeAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(options.includeAuth !== false),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message || 'API request failed');
    }

    return response.json();
  }

  // Auth endpoints
  async signup(email, password, fullName) {
    const data = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName }),
      includeAuth: false,
    });

    this.setToken(data.token);
    return data;
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      includeAuth: false,
    });

    this.setToken(data.token);
    return data;
  }

  async logout() {
    this.setToken(null);
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  // Fundi endpoints
  async submitFundiRegistration(formData) {
    const url = `${API_URL}/fundi/register`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message || 'Registration failed');
    }

    return response.json();
  }

  async getFundiProfile() {
    return this.request('/fundi/profile');
  }

  async updateFundiProfile(data) {
    return this.request('/fundi/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getFundi(fundiId) {
    return this.request(`/fundi/${fundiId}`, { includeAuth: false });
  }

  async searchFundis(latitude, longitude, skill = null) {
    let endpoint = `/fundi/search?latitude=${latitude}&longitude=${longitude}`;
    if (skill) {
      endpoint += `&skill=${encodeURIComponent(skill)}`;
    }
    return this.request(endpoint, { includeAuth: false });
  }

  // Job endpoints
  async createJob(jobData) {
    return this.request('/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  }

  async getUserJobs() {
    return this.request('/jobs');
  }

  async getJob(jobId) {
    return this.request(`/jobs/${jobId}`);
  }

  async updateJobStatus(jobId, status) {
    return this.request(`/jobs/${jobId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async uploadJobPhoto(jobId, file) {
    const formData = new FormData();
    formData.append('photo', file);

    const url = `${API_URL}/jobs/${jobId}/photos`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message || 'Photo upload failed');
    }

    return response.json();
  }

  async getJobPhotos(jobId) {
    return this.request(`/jobs/${jobId}/photos`);
  }

  // File upload
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${API_URL}/upload`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message || 'File upload failed');
    }

    return response.json();
  }
}

export const apiClient = new ApiClient();
