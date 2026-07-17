import mongoose from "mongoose";

let supportsTransactions: boolean | null = null;

function isTransactionUnsupportedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /transaction numbers are only allowed|transactions are not supported|replica set|mongos/i.test(message);
}

async function checkTransactionSupport(): Promise<boolean> {
  if (supportsTransactions !== null) return supportsTransactions;

  let session: mongoose.ClientSession | null = null;
  try {
    session = await mongoose.startSession();
    await session.startTransaction({
      readPreference: "primary",
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
    await mongoose.connection.db!.command({ ping: 1 }, { session });
    await session.commitTransaction();
    supportsTransactions = true;
  } catch {
    supportsTransactions = false;
  } finally {
    if (session) {
      try { await session.abortTransaction(); } catch {}
      try { await session.endSession(); } catch {}
    }
  }

  return supportsTransactions;
}

export async function withTransaction<T>(
  fn: (session: mongoose.ClientSession | null) => Promise<T>
): Promise<T> {
  const hasTxn = await checkTransactionSupport();

  if (!hasTxn) {
    return fn(null);
  }

  let session: mongoose.ClientSession | null = null;
  let transactionStarted = false;

  try {
    session = await mongoose.startSession();

    await session.startTransaction({
      readPreference: "primary",
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
    transactionStarted = true;

    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (transactionStarted && session?.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch {
        // Ignore abort errors during cleanup.
      }
    }

    if (isTransactionUnsupportedError(error)) {
      supportsTransactions = false;
      return fn(null);
    }

    throw error;
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch {
        // Ignore session cleanup errors.
      }
    }
  }
}
