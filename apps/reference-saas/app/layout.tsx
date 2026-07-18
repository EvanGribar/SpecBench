import type { Metadata } from "next";
import "./styles.css";
export const metadata: Metadata = { title: "Acme Teams", description: "SpecBench reference SaaS" };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
