// Съобщения, подадени през ?ok= / ?error= в адреса
export default function Flash({ sp }) {
  if (sp?.error) return <div className="alert error">{sp.error}</div>;
  if (sp?.ok) return <div className="alert ok">{sp.ok}</div>;
  return null;
}
