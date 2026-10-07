import { useRef, useState } from 'react'
import { AppointmentCTA } from '../components/home/AppointmentCTA'
import { ContactSection } from '../components/home/ContactSection'
import { CoreValues } from '../components/home/CoreValues'
import { DentistProfile } from '../components/home/DentistProfile'
import { FAQ } from '../components/home/FAQ'
import { Hero } from '../components/home/Hero'
import { LocationMap } from '../components/home/LocationMap'
import { Reviews } from '../components/home/Reviews'
import { Services } from '../components/home/Services'
import { WhyChooseUs } from '../components/home/WhyChooseUs'
import { DentalFlossIndicator } from '../components/navigation/DentalFlossIndicator'
import { SmileTour } from '../components/tour/SmileTour'
import { useScrollToHashOnMount } from '../hooks/useSectionNav'

export function HomePage() {
  useScrollToHashOnMount()
  const [isTourOpen, setIsTourOpen] = useState(false)
  const tourButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <Hero onStartTour={() => setIsTourOpen(true)} tourButtonRef={tourButtonRef} />
      <Services />
      <DentistProfile />
      <CoreValues />
      <WhyChooseUs />
      <AppointmentCTA />
      <Reviews />
      <LocationMap />
      <FAQ />
      <ContactSection />
      <DentalFlossIndicator hidden={isTourOpen} />
      {isTourOpen && (
        <SmileTour onClose={() => setIsTourOpen(false)} triggerRef={tourButtonRef} />
      )}
    </>
  )
}
