import { GVRT_TERMS_SECTIONS } from "@/lib/legal/terms";

export default function TermsPage() {
  return (
    <main className="bg-white min-h-screen pb-20 pt-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-primary">Términos y Condiciones</h1>
          <p className="text-sm text-gray-600">GVRT Revisión Técnica</p>
        </header>

        <div className="space-y-6">
          {GVRT_TERMS_SECTIONS.map((section) => (
            <section key={section.title} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-6 text-gray-700">
                  {paragraph}
                </p>
              ))}
              {section.bullets && section.bullets.length > 0 ? (
                <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
