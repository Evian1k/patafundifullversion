/**
 * API Client for FixIt Connect Backend
 * Uses custom REST API (no Supabase)
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiError extends Error {
  status: number;
  meta?: any;

  constructor(message: string, status = 0, meta?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.meta = meta;
  }
}

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

    // Auto-stringify body if it's an object
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    let response;
    try {
      response = await fetch(url, config);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Network error';
      throw new ApiError(msg || 'Network error', 0);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      const message = error?.message || response.statusText || 'API request failed';
      throw new ApiError(message, response.status, error?.meta);
    }

    return response.json();
  }

  // Auth endpoints
  async register(email, password, fullName, phone = null, role = 'customer') {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName, phone, role }),
      includeAuth: false,
    });
    return data;
  }

  async otpVerify(email, code, purpose = 'register') {
    const data = await this.request('/auth/otp-verify', {
      method: 'POST',
      body: JSON.stringify({ email, code, purpose }),
      includeAuth: false,
    });
    if (data?.token) this.setToken(data.token);
    return data;
  }

  async otpResend(email, purpose = 'register') {
    return this.request('/auth/otp-resend', {
      method: 'POST',
      body: JSON.stringify({ email, purpose }),
      includeAuth: false,
    });
  }

  async signup(email, password, fullName, role = 'customer') {
    const data = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName, role }),
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
    try {
      // Call backend logout endpoint to blacklist token
      await this.request('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Error calling logout endpoint:', error);
    }
    // Clear local token regardless of backend success
    this.setToken(null);
  }

  async getCurrentUser() {
    // Use /users/me so the frontend gets fullName + phone in one place.
    // Keep /auth/me for any legacy code paths or admin-only checks.
    return this.request('/users/me');
  }

  // User settings/profile
  async updateMe({ fullName = null, phone = null } = {}) {
    return this.request('/users/me', {
      method: 'PUT',
      body: JSON.stringify({ fullName, phone }),
    });
  }

  async getUserSettings() {
    return this.request('/users/settings');
  }

  async updateUserSettings(payload) {
    return this.request('/users/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getSavedPlaces() {
    return this.request('/users/saved-places');
  }

  async addSavedPlace(place) {
    return this.request('/users/saved-places', {
      method: 'POST',
      body: JSON.stringify(place),
    });
  }

  async updateSavedPlace(id, updates) {
    return this.request(`/users/saved-places/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteSavedPlace(id) {
    return this.request(`/users/saved-places/${id}`, {
      method: 'DELETE',
    });
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async deleteAccount(password) {
    return this.request('/users/delete-account', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  // Fundi endpoints
  async submitFundiRegistration(formData) {
    const url = `${API_URL}/fundi/register`;
    const controller = new AbortController();
    // Large uploads can take time; keep this generous but finite so UI doesn't hang forever.
    const timeoutMs = 90000;
    const t = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
        body: formData,
        signal: controller.signal,
      });
    } catch (e) {
      if (e?.name === 'AbortError') {
        throw new Error('Registration request timed out. Please try again.');
      }
      throw e;
    } finally {
      clearTimeout(t);
    }

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

  async getFundiApprovalStatus() {
    return this.request('/fundi/approval-status');
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

  // Fundi dashboard and wallet operations
  async getFundiDashboard() {
    return this.request('/fundi/dashboard');
  }

  async getFundiWalletTransactions(limit = 10, offset = 0) {
    return this.request(`/fundi/wallet/transactions?limit=${limit}&offset=${offset}`);
  }

  async submitWithdrawalRequest(amount) {
    return this.request('/fundi/wallet/withdraw-request', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async getFundiRatings(limit = 10, offset = 0) {
    return this.request(`/fundi/ratings?limit=${limit}&offset=${offset}`);
  }

  async goOnline(latitude, longitude, accuracy) {
    return this.request('/fundi/status/online', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, accuracy }),
    });
  }

  async goOffline() {
    return this.request('/fundi/status/offline', {
      method: 'POST',
    });
  }

  async updateLocation(latitude, longitude, accuracy) {
    return this.request('/fundi/location', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, accuracy }),
    });
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

  async getJobStatus(jobId) {
    return this.request(`/jobs/${jobId}/status`);
  }

  async getJobLocation(jobId) {
    return this.request(`/jobs/${jobId}/location`);
  }

  async getFundiActiveJob() {
    return this.request('/jobs/fundi/active');
  }

  async cancelJob(jobId, reason = null) {
    return this.request(`/jobs/${jobId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async updateJobStatus(jobId, status) {
    return this.request(`/jobs/${jobId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async acceptJob(jobId, estimatedPrice = null) {
    return this.request(`/jobs/${jobId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ estimatedPrice }),
    });
  }

  async checkInToJob(jobId, latitude, longitude, status = 'on_the_way') {
    return this.request(`/jobs/${jobId}/check-in`, {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, status }),
    });
  }

  async completeJob(jobId, finalPrice, photos = []) {
    const formData = new FormData();
    formData.append('finalPrice', finalPrice);
    if (photos && photos.length > 0) {
      photos.forEach((photo) => {
        formData.append('photos', photo);
      });
    }

    const url = `${API_URL}/jobs/${jobId}/complete`;
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
      throw new Error(error.message || 'Job completion failed');
    }

    return response.json();
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

  async confirmJobCompletion(jobId, code) {
    return this.request(`/jobs/${jobId}/confirm-completion`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  // Payment endpoints
  async getJobPayment(jobId) {
    return this.request(`/payments/job/${jobId}`);
  }

  async processPayment(jobId, paymentMethod = 'mpesa', mpesaNumber = null) {
    return this.request(`/payments/process/${jobId}`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod, mpesaNumber }),
    });
  }

  async getPaymentHistory(page = 1, limit = 10) {
    return this.request(`/payments/history?page=${page}&limit=${limit}`);
  }

  async getWithdrawals() {
    return this.request('/payments/withdrawals');
  }

  // Fundi endpoints (additions)
  async getFundiStatus() {
    return this.request('/fundi/status');
  }

  async getFundiEarnings() {
    return this.request('/fundi/earnings');
  }

  async getSubscriptionStatus() {
    return this.request('/fundi/subscription/status');
  }

  async activateSubscription(plan = 'monthly') {
    return this.request('/fundi/subscription/activate', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
  }

  // Admin endpoints
  async getAdminDashboardStats() {
    return this.request('/admin/dashboard-stats');
  }

  async getPendingFundis(page = 1, limit = 10) {
    return this.request(`/admin/pending-fundis?page=${page}&limit=${limit}`);
  }

  async getAllFundis(page = 1, limit = 10) {
    return this.request(`/admin/fundis?page=${page}&limit=${limit}`);
  }

  async approveFundi(fundiId, notes = '') {
    return this.request(`/admin/fundis/${fundiId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  async rejectFundi(fundiId, reason = '') {
    return this.request(`/admin/fundis/${fundiId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async suspendFundi(fundiId, reason = '') {
    return this.request(`/admin/fundis/${fundiId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getAdminActionLogs(limit = 50, offset = 0) {
    return this.request(`/admin/action-logs?limit=${limit}&offset=${offset}`);
  }

  // ============================================================================
  // FUNDI REGISTRATION STEP-BY-STEP ENDPOINTS
  // ============================================================================

  async startFundiRegistration() {
    return this.request('/fundi/registration/step/1/start', {
      method: 'POST',
      body: JSON.stringify({})
    });
  }

  async submitPersonalInfo(firstName, lastName, idNumber) {
    return this.request('/fundi/registration/step/2/personal-info', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName, idNumber })
    });
  }

  async uploadDocuments(idPhotoFront, idPhotoBack = null) {
    const formData = new FormData();
    formData.append('idPhotoFront', idPhotoFront);
    if (idPhotoBack) {
      formData.append('idPhotoBack', idPhotoBack);
    }

    const url = `${API_URL}/fundi/registration/step/3/upload-documents`;
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
      throw new Error(error.message || 'Document upload failed');
    }

    return response.json();
  }

  async submitSelfie(selfieBlob) {
    const formData = new FormData();
    formData.append('selfiePhoto', selfieBlob, 'selfie.jpg');

    const url = `${API_URL}/fundi/registration/step/4/selfie`;
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
      throw new Error(error.message || 'Selfie submission failed');
    }

    return response.json();
  }

  async submitLocation(latitude, longitude, accuracy) {
    return this.request('/fundi/registration/step/5/location', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, accuracy })
    });
  }

  async submitSkills(skills, experienceYears, certificates = []) {
    const formData = new FormData();
    
    // Append skills as array
    if (Array.isArray(skills)) {
      skills.forEach((skill, idx) => {
        formData.append('skills', skill);
      });
    } else {
      formData.append('skills', skills);
    }

    formData.append('experienceYears', experienceYears.toString());

    // Append certificate files
    certificates.forEach((cert, idx) => {
      formData.append('certificates', cert);
    });

    const url = `${API_URL}/fundi/registration/step/6/skills`;
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
      throw new Error(error.message || 'Skills submission failed');
    }

    return response.json();
  }

  async submitPaymentMethod(mpesaNumber) {
    return this.request('/fundi/registration/step/7/payment', {
      method: 'POST',
      body: JSON.stringify({ mpesaNumber })
    });
  }

  async getFundiRegistrationStatus() {
    return this.request('/fundi/registration/status');
  }

  // Enhanced fundi dashboard
  async getFundiDashboardV2() {
    return this.request('/fundi/dashboard/v2');
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
