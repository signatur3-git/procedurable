# Webhook System for Hot Reload Notifications

## Overview

The webhook system allows MCP servers to register with the authoring server and receive real-time notifications when builders are hot-reloaded. This provides better visibility into server state and helps agents understand when temporary unavailability is due to hot reloads rather than server failures.

## Architecture

```
┌─────────────────────┐
│  Authoring Server   │
│   (Port 4200)       │
│                     │
│  - File Watcher     │
│  - YAML Cache       │
│  - Webhook Registry │
└──────────┬──────────┘
           │
           │ Hot Reload Event
           │ POST /webhook/hot-reload
           ▼
┌─────────────────────┐
│   MCP HTTP Server   │
│   (Port 4242)       │
│                     │
│  - Webhook Handler  │
│  - Status Tracking  │
│  - Auto Registration│
└─────────────────────┘
```

## Authoring Server API

### Webhook Registration

**POST /api/webhooks/register**

Register a webhook to receive hot reload notifications.

Request:
```json
{
  "url": "http://127.0.0.1:4242/webhook/hot-reload",
  "name": "MCP HTTP Server"
}
```

Response:
```json
{
  "success": true,
  "id": "webhook_1234567890_abc123",
  "message": "Webhook registered successfully"
}
```

### Webhook Unregistration

**POST /api/webhooks/unregister**

Unregister a webhook.

Request:
```json
{
  "id": "webhook_1234567890_abc123"
}
```

Response:
```json
{
  "success": true,
  "message": "Webhook unregistered"
}
```

### List Webhooks

**GET /api/webhooks/list**

List all registered webhooks.

Response:
```json
{
  "webhooks": [
    {
      "id": "webhook_1234567890_abc123",
      "url": "http://127.0.0.1:4242/webhook/hot-reload",
      "name": "MCP HTTP Server",
      "registeredAt": "2026-01-16T12:00:00.000Z"
    }
  ]
}
```

## Hot Reload Event Format

When a builder file changes, the authoring server sends this event to all registered webhooks:

```json
{
  "type": "hot_reload",
  "builder": "ForestSlice",
  "event": "modified",
  "timestamp": "2026-01-16T12:00:00.000Z"
}
```

**Event types:**
- `created` - New builder file created
- `modified` - Builder file modified
- `deleted` - Builder file deleted

## MCP Server Integration

The MCP HTTP server automatically:

1. **Registers on startup** - Calls `/api/webhooks/register` when it starts
2. **Handles notifications** - Receives POST to `/webhook/hot-reload`
3. **Tracks status** - Sets `isReloading` flag for 2 seconds after notification
4. **Unregisters on shutdown** - Cleans up webhook on SIGINT/SIGTERM

### Status in Responses

When the server is reloading, tool responses include helpful context:

**Ping response during hot reload:**
```json
{
  "status": "ok",
  "transport": "sse",
  "timestamp": "2026-01-16T12:00:00.000Z",
  "hotReload": {
    "status": "reloading",
    "lastEvent": {
      "builder": "ForestSlice",
      "timestamp": "2026-01-16T11:59:58.000Z"
    }
  }
}
```

**Error response during hot reload:**
```json
{
  "error": "Connection refused",
  "hint": "The authoring server is currently reloading builder: ForestSlice. This should complete in a moment. The request will be automatically retried.",
  "hotReload": {
    "builder": "ForestSlice",
    "timestamp": "2026-01-16T11:59:58.000Z"
  }
}
```

## Retry Logic

Both MCP servers (`server.ts` and `http-server.ts`) now include automatic retry with exponential backoff:

- **3 retries** with delays of 100ms, 200ms, 400ms
- Handles brief unavailability during hot reloads
- Logs retry attempts for debugging

Example:
```typescript
const response = await fetchWithRetry(url, options);
```

## Health Checks

### Authoring Server Health

**GET /health**
```json
{
  "status": "ok",
  "server": "authoring",
  "port": 4200,
  "namespaces": ["builder", "measurement", ...],
  "wsClients": 1,
  "webhooks": 1
}
```

### MCP Server Health

**GET /health**
```json
{
  "status": "ok",
  "sessions": 0,
  "transport": "sse",
  "webhookRegistered": true,
  "hotReload": null
}
```

## Benefits

1. **Better User Experience** - Agents receive clear messages instead of cryptic timeouts
2. **Automatic Recovery** - Retry logic handles transient failures gracefully
3. **Transparency** - Users can see when hot reloads are happening
4. **No Manual Intervention** - Everything registers/unregisters automatically
5. **Debugging** - Logs show webhook notifications and retry attempts

## Testing

### Test webhook registration:
```bash
curl -X POST http://127.0.0.1:4200/api/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{"url": "http://127.0.0.1:4242/webhook/hot-reload", "name": "Test"}'
```

### List webhooks:
```bash
curl http://127.0.0.1:4200/api/webhooks/list
```

### Trigger hot reload (edit a builder):
```bash
# Edit a YAML file in builders/ directory
# Watch authoring server console for webhook notification
# Watch MCP server console for hot reload detection
```

### Check MCP server health:
```bash
curl http://127.0.0.1:4242/health
```

## Future Enhancements

- **Webhook authentication** - Add shared secret or token-based auth
- **Event filtering** - Let webhooks subscribe to specific builders or event types
- **Webhook retry** - Retry failed webhook notifications with backoff
- **Event history** - Store recent events for debugging
- **Dashboard integration** - Show hot reload status in web dashboard

