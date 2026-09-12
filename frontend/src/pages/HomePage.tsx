import { AppointmentCTA } from '../components/home/AppointmentCTA'
import { ContactSection } from '../components/home/ContactSection'
import { CoreValues } from '../components/home/CoreValues'
import { DentistProfile } from '../components/home/DentistProfile'
import { FAQ } from '../components/home/FAQ'
import { Hero } from '../components/home/Hero'
import { LocationMap } from '../components/home/LocationMap'
import { Offers } from '../components/home/Offers'
import { Reviews } from '../components/home/Reviews'
import { Services } from '../components/home/Services'
import { WhyChooseUs } from '../components/home/WhyChooseUs'
import { useScrollToHashOnMount } from '../hooks/useSectionNav'

export function HomePage() {
  useScrollToHashOnMount()

  return (
    <>
      <Hero />
      <Services />
      <Offers />
      <DentistProfile />
      <CoreValues />
      <WhyChooseUs />
      <AppointmentCTA />
      <Reviews />
      <LocationMap />
      <FAQ />
      <ContactSection />
    </>
  )
}
