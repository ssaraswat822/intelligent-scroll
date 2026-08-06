export default function Skeleton({ lines = 3 }) {
  return (
    <div className="skeleton">
      <div className="skeleton__avatar" />
      <div className="skeleton__body">
        <div className="skeleton__row">
          <span className="skeleton__bar w-28" />
          <span className="skeleton__bar w-20" />
        </div>
        {Array.from({ length: lines }).map((_, i) => (
          <span key={i} className={`skeleton__bar ${["w-100", "w-92", "w-64", "w-80"][i % 4]}`} />
        ))}
        <div className="skeleton__row skeleton__row--actions">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="skeleton__pill" />
          ))}
        </div>
      </div>
    </div>
  );
}
