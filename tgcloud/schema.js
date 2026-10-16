import { integer, table, text } from "sdk/db";
const keyValueEntries = table("key_value_entries", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at")
});
export {
  keyValueEntries
};
