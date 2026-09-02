export function Card({ title, variant, className = '', children, ...rest }) {
  const classes = ['card', variant && `card--${variant}`, className].filter(Boolean).join(' ');
  return (
    <section className={classes} {...rest}>
      {title && <h2 className="card__title">{title}</h2>}
      {children}
    </section>
  );
}
