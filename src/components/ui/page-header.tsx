import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions, back }: { eyebrow: string; title: ReactNode; description: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return <>{back ? <Link className="page-back" href={back.href}><span aria-hidden="true">←</span>{back.label}</Link> : null}<header className="page-heading product-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lead">{description}</p></div>{actions ? <div className="page-header-actions">{actions}</div> : null}</header></>;
}
