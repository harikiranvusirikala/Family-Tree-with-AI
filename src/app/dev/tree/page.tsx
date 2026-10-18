import type { Metadata } from "next";
import { TreePlayground } from "./TreePlayground";

export const metadata: Metadata = { title: "Tree layout (dev)" };

export default function DevTreePage() {
  return <TreePlayground />;
}
