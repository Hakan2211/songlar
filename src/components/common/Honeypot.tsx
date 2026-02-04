/**
 * Honeypot Component for Bot Protection
 *
 * This component renders a hidden input field that bots will fill out.
 * Real users won't see it, but bots scanning for form fields will.
 *
 * Usage:
 * 1. Add <Honeypot /> inside your form
 * 2. Check for the hidden field value on the server
 * 3. If the field has a value, silently reject the submission
 */
export function Honeypot() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-9999px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    >
      <label htmlFor="_gotcha">Don't fill this out if you're human</label>
      <input
        type="text"
        id="_gotcha"
        name="_gotcha"
        tabIndex={-1}
        autoComplete="off"
      />
    </div>
  )
}

/**
 * Server-side honeypot check
 * Returns true if the submission should be rejected (bot detected)
 */
export function isHoneypotFilled(data: { _gotcha?: string }): boolean {
  return !!data._gotcha && data._gotcha.length > 0
}
