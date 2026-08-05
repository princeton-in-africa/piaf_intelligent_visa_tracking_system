/* ============================================================================
   Logo
   ----------------------------------------------------------------------------
   Renders the Princeton in Africa mark from public/piaf-mark.png, which
   scripts/make_favicon.py cuts out of the full lockup.

   The mark is used rather than the whole lockup because the supplied logo
   stacks "PRINCETON IN AFRICA" beneath the artwork, and at sidebar size that
   type is unreadable. The sidebar prints the organisation name in real text
   next to it instead, which stays legible and is available to screen readers.

   If the file is missing the component falls back to a typographic mark, so a
   fresh checkout without the asset still renders.
   ========================================================================== */

import { useState } from 'react'
import './Logo.css'

const MARK_SRC = `${import.meta.env.BASE_URL}piaf-mark.png`

export default function Logo({ variant = 'plate' }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span className="logo-fallback" aria-hidden="true">
        PiAf
      </span>
    )
  }

  return (
    <span className={`logo logo--${variant}`}>
      <img
        src={MARK_SRC}
        alt=""
        className="logo__img"
        onError={() => setFailed(true)}
        loading="eager"
        decoding="async"
      />
    </span>
  )
}
