/* `variant` takes one name or several - a feature card that is also the accented
   one on the page needs both, and nesting two Cards to get two treatments would
   put a second <section> in the tree for a purely visual reason. */

export function Card({ title, variant, className = '', children, ...rest }) {
  const variants = (Array.isArray(variant) ? variant : [variant]).filter(Boolean);
  const classes = ['card', ...variants.map((v) => `card--${v}`), className]
    .filter(Boolean)
    .join(' ');
  return (
    <section className={classes} {...rest}>
      {title && <h2 className="card__title">{title}</h2>}
      {children}
    </section>
  );
}
