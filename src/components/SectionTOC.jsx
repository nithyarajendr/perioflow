import { useEffect, useState } from 'react'

/**
 * Sticky horizontal table-of-contents nav with scroll-spy.
 *
 * Pass `sections: [{ id, label }, ...]`. Each section's `id` should match an
 * element on the page (id="..."). Clicking a link smooth-scrolls to it; the
 * active link is highlighted as the user scrolls.
 *
 * Sticky positioning: `top-0`. The page should leave room for it (e.g. main
 * content has padding or the TOC has a cream background that masks content).
 */
export default function SectionTOC({ sections }) {
  const [active, setActive] = useState(sections[0]?.id || null)

  useEffect(() => {
    if (!sections?.length) return
    // The rootMargin pushes the "active line" down ~25% from the top of the
    // viewport; sections crossing that line become active. Tuned so the
    // section the user is reading (not the one they just scrolled past) wins.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActive(visible[0].target.id)
        }
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 }
    )

    const observed = []
    for (const s of sections) {
      const el = document.getElementById(s.id)
      if (el) {
        observer.observe(el)
        observed.push(el)
      }
    }
    return () => {
      observed.forEach(el => observer.unobserve(el))
      observer.disconnect()
    }
  }, [sections])

  const onClick = (e, id) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActive(id)
    }
  }

  return (
    <nav
      aria-label="Page sections"
      className="sticky top-0 z-20 -mx-2 px-2 py-3 bg-cream/90 backdrop-blur supports-[backdrop-filter]:bg-cream/75 border-b border-border-warm"
    >
      <ul className="flex flex-wrap gap-1.5 text-sm">
        {sections.map(s => {
          const isActive = active === s.id
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={e => onClick(e, s.id)}
                className={
                  'inline-block px-3 py-1.5 rounded-full transition-colors ' +
                  (isActive
                    ? 'bg-navy text-cream-light'
                    : 'text-text-muted hover:text-text-strong hover:bg-cream-light')
                }
                aria-current={isActive ? 'true' : undefined}
              >
                {s.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
