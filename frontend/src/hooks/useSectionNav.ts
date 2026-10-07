import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Nav links (Services/About/Contact/etc.) need to scroll to a section on
 * the home page. From the home page that's a plain smooth scroll; from any
 * other route (e.g. /login) it first navigates home, then this same hook's
 * effect (mounted on the home page) picks up the hash and scrolls once the
 * section actually exists in the DOM. */
export function useSectionNav() {
  const location = useLocation()
  const navigate = useNavigate()

  const goToSection = useCallback(
    (id: string) => {
      if (location.pathname === '/') {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        navigate(`/#${id}`)
      }
    },
    [location.pathname, navigate],
  )

  return { goToSection }
}

export function useScrollToHashOnMount() {
  const location = useLocation()

  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.replace('#', '')
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => clearTimeout(timer)
  }, [location.hash])
}
