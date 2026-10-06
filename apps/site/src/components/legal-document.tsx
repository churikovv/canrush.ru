import Link from '@/components/navigation-progress';
import type { ReactNode } from 'react';

export interface LegalSection {
  content: ReactNode;
  id: string;
  title: string;
}

interface LegalDocumentProps {
  effectiveDate: string;
  effectiveDateIso: string;
  sections: LegalSection[];
  summary: string;
  title: string;
}

export function LegalDocument({
  effectiveDate,
  effectiveDateIso,
  sections,
  summary,
  title,
}: LegalDocumentProps) {
  return (
    <article className="legal-document">
      <header className="legal-document-header">
        <Link className="legal-return-link" href="/catalog">
          Вернуться в каталог
        </Link>
        <p className="section-label">Документы CanRush</p>
        <h1>{title}</h1>
        <p className="legal-document-summary">{summary}</p>
        <p className="legal-document-date">
          Редакция от <time dateTime={effectiveDateIso}>{effectiveDate}</time>
        </p>
      </header>

      <div className="legal-document-layout">
        <nav className="legal-contents" aria-label={`Оглавление документа «${title}»`}>
          <h2>Содержание</h2>
          <ol>
            {sections.map((section, index) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>
                  <span aria-hidden="true">{index + 1}.</span>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="legal-copy">
          {sections.map((section, index) => (
            <section id={section.id} key={section.id} aria-labelledby={`${section.id}-title`}>
              <h2 id={`${section.id}-title`}>
                {index + 1}. {section.title}
              </h2>
              <div className="legal-section-content">{section.content}</div>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
