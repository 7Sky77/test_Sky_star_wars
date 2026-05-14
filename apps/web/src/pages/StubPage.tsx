export function StubPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="page-title">{title}</h1>
      <p className="stub">Раздел в разработке (MVP: постройки и галактика).</p>
    </div>
  );
}
