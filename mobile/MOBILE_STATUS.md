# Mobile MVP Status

## Working slice

The current MVP covers login/signup, secure JWT storage, room create/join, persisted shape loading, freehand touch drawing, real-time freehand stroke sync, and collaborator cursor updates.

## Deliberately not ported

- Rectangle, circle, diamond, arrow, text, select, resize, and eraser tools.
- Undo/redo and canvas export/import.
- Chat UI.
- Room list browsing beyond the existing create/join API.
- Reconnect and offline replay. A socket error is shown, but unsent strokes are not queued.

The backend originally had no freehand shape type. This branch adds `FREEHAND` to the shared Prisma enum and updates the web renderer to consume its `points` array. Apply the Prisma migration before using persistence.

The existing server still does not enforce room membership during the WebSocket `join-room` event. The mobile client follows the current server behavior and does not claim to add access control.
