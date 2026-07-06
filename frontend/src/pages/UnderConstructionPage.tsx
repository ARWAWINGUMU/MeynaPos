export function UnderConstructionPage({ title }: { title: string }) {
  return (
    <section className="p-8">
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="mb-2 text-sm text-emerald-700">MeynaPOS</p>
        <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-gray-600">En construcción</p>
      </div>
    </section>
  );
}

