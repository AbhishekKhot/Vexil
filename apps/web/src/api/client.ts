// Always use relative paths so requests go through the Vite dev proxy.
// VITE_API_URL is used by vite.config.ts as the proxy *target*, not here.
const BASE = '';

function getToken() {
    return localStorage.getItem('vexil_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
        ...(options.body != null ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE}${path}`, { ...options, headers });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
}

export const api = {
    // Auth
    login: (email: string, password: string) =>
        request<{ token: string; user: unknown }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),
    register: (name: string, email: string, password: string, organizationName: string) =>
        request<{ token: string; user: unknown }>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, orgName: organizationName }),
        }),
    me: () => request<unknown>('/api/auth/me'),

    // Projects
    listProjects: () => request<unknown[]>('/api/projects'),
    createProject: (name: string, description?: string) =>
        request<unknown>('/api/projects', { method: 'POST', body: JSON.stringify({ name, description }) }),
    getProject: (id: string) => request<unknown>(`/api/projects/${id}`),
    updateProject: (id: string, data: unknown) =>
        request<unknown>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteProject: (id: string) =>
        request<void>(`/api/projects/${id}`, { method: 'DELETE' }),

    // Environments
    listEnvironments: (projectId: string) =>
        request<unknown[]>(`/api/projects/${projectId}/environments`),
    createEnvironment: (projectId: string, name: string) =>
        request<unknown>(`/api/projects/${projectId}/environments`, {
            method: 'POST',
            body: JSON.stringify({ name }),
        }),
    deleteEnvironment: (projectId: string, envId: string) =>
        request<void>(`/api/projects/${projectId}/environments/${envId}`, { method: 'DELETE' }),
    rotateApiKey: (projectId: string, envId: string) =>
        request<unknown>(`/api/projects/${projectId}/environments/${envId}/rotate-key`, { method: 'POST' }),

    // Flags
    listFlags: (projectId: string) =>
        request<unknown[]>(`/api/projects/${projectId}/flags`),
    createFlag: (projectId: string, data: unknown) =>
        request<unknown>(`/api/projects/${projectId}/flags`, { method: 'POST', body: JSON.stringify(data) }),
    getFlag: (projectId: string, flagId: string) =>
        request<unknown>(`/api/projects/${projectId}/flags/${flagId}`),
    updateFlag: (projectId: string, flagId: string, data: unknown) =>
        request<unknown>(`/api/projects/${projectId}/flags/${flagId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteFlag: (projectId: string, flagId: string) =>
        request<void>(`/api/projects/${projectId}/flags/${flagId}`, { method: 'DELETE' }),

    // Flag Config
    getFlagConfig: (projectId: string, envId: string, flagId: string) =>
        request<unknown>(`/api/projects/${projectId}/environments/${envId}/flags/${flagId}`),
    setFlagConfig: (projectId: string, envId: string, flagId: string, data: unknown) =>
        request<unknown>(`/api/projects/${projectId}/environments/${envId}/flags/${flagId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Segments
    listSegments: (projectId: string) =>
        request<unknown[]>(`/api/projects/${projectId}/segments`),
    createSegment: (projectId: string, data: unknown) =>
        request<unknown>(`/api/projects/${projectId}/segments`, { method: 'POST', body: JSON.stringify(data) }),
    updateSegment: (projectId: string, segmentId: string, data: unknown) =>
        request<unknown>(`/api/projects/${projectId}/segments/${segmentId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteSegment: (projectId: string, segmentId: string) =>
        request<void>(`/api/projects/${projectId}/segments/${segmentId}`, { method: 'DELETE' }),

    // Analytics
    getStats: (projectId: string, params?: { environmentId?: string; flagKey?: string }) => {
        const qs = new URLSearchParams(params as Record<string, string>).toString();
        return request<unknown[]>(`/api/projects/${projectId}/stats${qs ? `?${qs}` : ''}`);
    },

    // Audit Logs
    getAuditLogs: (projectId: string, params?: Record<string, string>) => {
        const qs = new URLSearchParams(params).toString();
        return request<unknown>(`/api/projects/${projectId}/audit-logs${qs ? `?${qs}` : ''}`);
    },
};
