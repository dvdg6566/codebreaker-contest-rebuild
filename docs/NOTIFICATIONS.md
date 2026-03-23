# Notifications System

The Codebreaker notification system uses AWS WebSocket API Gateway with DynamoDB for connection tracking and Step Functions for parallel message broadcasting. The system supports real-time notifications delivered to connected clients.

---

## Architecture Components

### DynamoDB Table: `{judgeName}-websocket`

**Primary Key:** `connectionId` (String)

**Attributes:**
| Field | Type | Description |
|-------|------|-------------|
| `connectionId` | String | Unique WebSocket connection ID (PK) |
| `username` | String | Connected user's username |
| `accountRole` | String | 'admin' or 'member' |
| `contestId` | String | Current contest context |
| `expiryTime` | Number | TTL timestamp (5 hours from connection) |

**Global Secondary Indexes (GSI):**

1. **`accountRoleUsernameIndex`**
   - PK: `accountRole` | SK: `username`
   - Use: Query all admins for `postClarification` notifications, or specific user for `answerClarification`

2. **`contestIdUsernameIndex`**
   - PK: `contestId` | SK: `username`
   - Use: Query contest participants for `endContest` notifications

---

## Notification Types

| Type | Trigger | Recipients | Icon/Color |
|------|---------|------------|-----------|
| `announce` | Admin creates announcement | All connected users | Emerald/Megaphone |
| `postClarification` | User submits clarification question | All admins | Amber/MessageSquare |
| `answerClarification` | Admin answers a clarification | Specific user who asked | Blue/CheckCircle |
| `endContest` | EventBridge Scheduler at contest end time | Contest participants | Red/Timer |

---

## Lambda Functions

### 1. `websocket-connections` (Connection Lifecycle)
**Location:** `/auto/lambda-functions/websocket-connections/`

Handles WebSocket API Gateway routes:
- **`$connect`**: Creates DynamoDB entry with 5-hour TTL
- **`$disconnect`**: Removes connection from DynamoDB
- **`message`**: Updates user details (username, accountRole, contestId)

**Key Functions in `awstools.py`:**
```python
addConnection(connectionId, accountRole, username, contestId)  # Insert with TTL
removeConnection(connectionId)                                  # Delete entry
updateUserDetails(connectionId, username, accountRole, contestId)  # Update metadata
```

### 2. `websocket-invoke` (Message Delivery)
**Location:** `/auto/lambda-functions/websocket-invoke/`

Receives batched connectionIds from Step Function and sends messages via API Gateway:
- Accepts `notificationType` and `connectionIds` array
- Posts to each connection via `apigatewaymanagementapi.post_to_connection()`
- Silently ignores stale/disconnected connections

### 3. `contest-end-notifier` (Scheduled Contest End)
**Location:** `/auto/lambda-functions/contest-end-notifier/`

Triggered by EventBridge Scheduler when contests end:
- **Centralized mode**: Queries all participants via `contestIdUsernameIndex` GSI
- **Self-timer mode**: Queries specific user's connections
- Batches connectionIds (100 per batch)
- Invokes Step Function for parallel broadcast

---

## Step Function: `{judgeName}-websocket`

**Type:** EXPRESS (high-throughput, short-duration)

**Definition:** `/auto/state-machines/websocket.asl.json`

**Flow:**
```
Input: Array of batches
    ↓
Map State (MaxConcurrency: 1000)
    ↓
For each batch → Invoke websocket-invoke Lambda
    ↓
Retry with exponential backoff (2s → 4s → 8s, max 6 attempts)
```

**Input Format:**
```json
[
  {"notificationType": "announce", "connectionIds": ["id1", "id2", ...]},
  {"notificationType": "announce", "connectionIds": ["id100", "id101", ...]}
]
```

---

## Notification Triggers and Flow

### 1. Announcements (`announce`)

**Trigger:** Admin creates announcement in `/admin/announcements`

**Flow:**
1. Admin submits announcement form
2. Server action calls `announce()` in `/app/lib/websocket-broadcast.server.ts`
3. `scanTable()` does paginated DynamoDB scan of entire WebSocket table
4. ConnectionIds batched into groups of 100
5. Step Function invoked with batches
6. Each Lambda invocation sends message to batch of connections
7. All connected clients receive `{notificationType: "announce"}` message
8. Frontend shows notification bell badge + toast

**Navigation:** `/contests/{contestId}/announcements`

### 2. Post Clarification (`postClarification`)

**Trigger:** User submits clarification question in `/contests/$contestId/clarifications`

**Flow:**
1. User submits clarification form
2. Server action calls `postClarification()` in websocket-broadcast.server.ts
3. Queries `accountRoleUsernameIndex` GSI with `accountRole = 'admin'`
4. Batches admin connectionIds (100 per batch)
5. Step Function invoked
6. All admin clients receive `{notificationType: "postClarification"}` message
7. Admin dashboards show new clarification notification

**Navigation:** `/admin/clarifications`

### 3. Answer Clarification (`answerClarification`)

**Trigger:** Admin answers clarification in `/admin/clarifications`

**Flow:**
1. Admin submits answer
2. Server action calls `answerClarification(role, username)` twice:
   - Once with `role='member'`
   - Once with `role='admin'` (in case user has both roles)
3. Queries `accountRoleUsernameIndex` GSI for specific user
4. Batches user's connectionIds
5. Step Function invoked
6. Specific user receives `{notificationType: "answerClarification"}` message
7. User sees notification that their question was answered

**Navigation:** `/contests/{contestId}/clarifications`

### 4. Contest End (`endContest`)

**Trigger:** EventBridge Scheduler at contest `endTime`

**Flow:**
1. Scheduler triggers `contest-end-notifier` Lambda with contest details
2. Lambda determines mode:
   - **Centralized**: Queries `contestIdUsernameIndex` for all participants in contest
   - **Self-timer**: Queries for specific user who started timer
3. Batches connectionIds (100 per batch)
4. Step Function invoked with `{notificationType: "endContest", contestId, username}`
5. All contest participants receive end notification
6. Frontend filters by `currentContestId` to show relevant notifications only
7. Contest end callbacks triggered for UI updates (disable submissions, etc.)

**Navigation:** `/contests/{contestId}/scoreboard`

---

## Frontend Integration

### WebSocket Context (`/app/context/websocket-context.tsx`)

Central state management:
- Manages WebSocket connection via `useWebSocket` hook
- Converts raw messages to `Notification` objects
- Tracks notifications (max 50 stored)
- Provides `setContestId()` for contest-scoped filtering
- Exports `useNotifications()` hook for UI components

### WebSocket Hook (`/app/hooks/use-websocket.ts`)

Connection management:
- Exponential backoff reconnection (1s → 2s → 4s → ... → 32s max)
- Sends identity message on connect: `{action: "message", accountRole, username, contestId}`
- Automatic cleanup on unmount

### Contest WebSocket Hook (`/app/hooks/useContestWebSocket.ts`)

Contest scope registration:
- Called in all contest routes
- Registers `contestId` with WebSocket context on mount
- Clears on unmount

### Notification UI

**Notification Bell** (`/app/components/layout/notification-bell.tsx`):
- Dropdown in header showing notification history
- Unread count badge (capped at "9+")
- Connection status indicator
- Mark read/clear actions

**Notification Toast** (`/app/components/ui/notification-toast.tsx`):
- Auto-dismissing toasts (5 seconds)
- Fixed position bottom-right
- Max 3 simultaneous toasts

---

## Environment Configuration

| Variable | Value | Purpose |
|----------|-------|---------|
| `AWS_REGION` | ap-southeast-1 | AWS region |
| `JUDGE_NAME` | codebreakercontest01 | Resource naming prefix |
| `AWS_ACCOUNT_ID` | (your account ID) | Account for ARN construction |
| `API_GATEWAY_LINK` | wss://... | WebSocket endpoint URL |

