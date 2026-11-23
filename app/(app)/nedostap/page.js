import Link from 'next/link';
export default function NoAccess() {
  return (
    <div className="card narrow">
      <h1>Нямате достъп</h1>
      <p>Нямате права за тази страница или действие. Ако смятате, че това е грешка, свържете се с администратор.</p>
      <Link className="btn" href="/grafik">Към графика</Link>
    </div>
  );
}
