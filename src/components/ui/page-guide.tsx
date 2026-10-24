import Link from "next/link";
import type { ReactNode } from "react";

export function PageGuide({ items, label = "How this workspace works" }: { items: readonly { title: string; text: string }[]; label?: string }) {
  return <section className="page-guide" aria-label={label}><ol>{items.map((item, index) => <li key={item.title}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div><h2>{item.title}</h2><p>{item.text}</p></div></li>)}</ol></section>;
}

export function WorkspaceNotes({ title, children, link }: { title: string; children: ReactNode; link?: { href: string; label: string } }) {
  return <aside className="workspace-notes"><div><h2>{title}</h2><div className="workspace-notes-copy">{children}</div></div>{link ? <Link className="text-link" href={link.href}>{link.label}<span aria-hidden="true">↗</span></Link> : null}</aside>;
}

export function ReadingLayout({ children, sections }: { children: ReactNode; sections: readonly { id: string; label: string }[] }) {
  return <div className="reading-layout"><nav className="reading-index" aria-label="On this page"><p>On this page</p><ol>{sections.map((section, index) => <li key={section.id}><a href={`#${section.id}`}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{section.label}</a></li>)}</ol></nav><article className="reading-article">{children}</article></div>;
}
