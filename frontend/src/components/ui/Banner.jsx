/* Inline notice. Never a modal - this app should not hand a fatigued user a
   dialog to dismiss before they can continue. */

export function Banner({ tone = 'info', title, children, action, role = 'status' }) {
  return (
    <div className={`banner banner--${tone}`} role={role}>
      <div className="banner__body">
        {title && <div className="banner__title">{title}</div>}
        {children}
      </div>
      {action}
    </div>
  );
}
