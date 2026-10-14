-- Disconnect the retired in-app AI integration. Preserve usage history and
-- every health, mailbox, task and delivery record; revoke no external keys.
DELETE FROM `ai_connections`;
