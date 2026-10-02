export default function StudentCard({ label, value, helper, icon: Icon, tone = 'primary' }) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__icon">
        <Icon size={20} strokeWidth={2.1} />
      </div>
      <div className="stat-card__content">
        <span className="stat-card__label">{label}</span>
        <strong className="stat-card__value">{value}</strong>
        <span className="stat-card__helper">{helper}</span>
      </div>
    </article>
  );
}
