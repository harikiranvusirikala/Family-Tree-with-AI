import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getDatabase } from "@/server/db";
import { loadGroupTree } from "@/server/repositories/family";
import { SAMPLE_GROUP_ID } from "@test/fixtures/seed";
import { DatabaseSheets } from "./DatabaseSheets";

export const metadata: Metadata = { title: "Tree from the database (dev)" };

/** The seeded sample family (`npm run seed`), loaded from MONGODB_DB and drawn sheet by sheet. */
export default function DevTreeFromDatabasePage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">Loading from the database…</p>}>
      <SampleGroup />
    </Suspense>
  );
}

async function SampleGroup() {
  await connection(); // read at request time, never during the build
  const tree = await loadGroupTree((await getDatabase()).db, SAMPLE_GROUP_ID);
  if (tree.persons.length === 0) {
    return <p className="p-4 text-sm">Nothing in the database yet. Run <code>npm run seed</code>.</p>;
  }
  return <DatabaseSheets tree={tree} />;
}
