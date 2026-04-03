# Vexil API Reference

## Control Plane — `/api/*`

Authenticated with JWT (`Authorization: Bearer <token>`).

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET  | `/api/auth/me` | Get current user |
| GET  | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| DELETE | `/api/projects/:id` | Delete project |
| GET  | `/api/projects/:projectId/environments` | List environments |
| POST | `/api/projects/:projectId/environments` | Create environment |
| DELETE | `/api/projects/:projectId/environments/:id` | Delete environment |
| GET  | `/api/projects/:projectId/flags` | List flags |
| POST | `/api/projects/:projectId/flags` | Create flag |
| GET  | `/api/projects/:projectId/flags/:flagId` | Get flag |
| DELETE | `/api/projects/:projectId/flags/:id` | Delete flag |
| GET  | `/api/projects/:projectId/flags/:flagId/config` | Get flag config for env |
| POST | `/api/projects/:projectId/flags/:flagId/config` | Set flag config for env |
| GET  | `/api/projects/:projectId/segments` | List segments |
| POST | `/api/projects/:projectId/segments` | Create segment |
| DELETE | `/api/projects/:projectId/segments/:id` | Delete segment |
| GET  | `/api/projects/:projectId/audit-logs` | List audit log entries |
| GET  | `/api/projects/:projectId/stats` | Get analytics stats (per project) |

## Data Plane — `/v1/*`

Authenticated with environment API key (`Authorization: Bearer <vex_...>`).

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/eval` | Evaluate all flags for a context |
| POST | `/v1/events` | Ingest evaluation event batch (SDK analytics) |

## POST /v1/eval (Data Plane)

**Authentication:** `Authorization: Bearer <vex_...>`

**Request:**
```json
{
  "context": {
    "userId": "user_123",
    "country": "US",
    "tier": "premium"
  }
}
```

## POST /v1/events (Telemetry)

**Authentication:** `Authorization: Bearer <vex_...>`

**Request:**
```json
[
  { 
    "flagKey": "new-dashboard", 
    "result": true, 
    "context": { "userId": "user_123" },
    "timestamp": "2024-03-22T10:00:00Z"
  }
]
```
