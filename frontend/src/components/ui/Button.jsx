export function Button({
  variant = 'primary',
  block = false,
  className = '',
  type = 'button',
  children,
  ...rest
}) {
  const classes = [
    'btn',
    variant !== 'primary' && `btn--${variant}`,
    block && 'btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
