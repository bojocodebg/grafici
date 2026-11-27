// Лога на Денонощни аптеки „Пулс“ (от pulsapteka.com), в /public
//  - FullLogo: сърцето + „Денонощни аптеки •Пулс•“
//  - HeartLogo: само сърцето (когато е нужна картинка без текст)
export function FullLogo({ height = 36, className = '' }) {
  return (
    <img
      src="/logo-puls-full.png"
      alt="Денонощни аптеки „Пулс“"
      width={Math.round((height * 800) / 207)}
      height={height}
      className={`logo-full ${className}`}
      decoding="async"
    />
  );
}

export default function HeartLogo({ size = 32, className = '' }) {
  return <img src="/logo-heart.png" alt="" aria-hidden="true" width={size} height={size} className={`logo-heart ${className}`} decoding="async" />;
}
