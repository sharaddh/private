import assert from "assert";
import { shouldResetSessionForError } from "./whatsapp";

function run(): void {
  assert.strictEqual(shouldResetSessionForError("Connection closed"), false);
  assert.strictEqual(shouldResetSessionForError("bad session"), true);
  assert.strictEqual(shouldResetSessionForError("logged out"), true);
  assert.strictEqual(shouldResetSessionForError("session expired"), true);
}

run();
console.log("whatsapp service regression checks passed");
