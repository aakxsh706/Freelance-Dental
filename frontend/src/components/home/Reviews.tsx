import { Star } from 'lucide-react'
import { isGoogleReviewsConnected, sampleReviews } from '../../data/reviews'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'

export function Reviews() {
  return (
    <section className="bg-(--color-surface) py-20 sm:py-24">
      <Container className="flex flex-col gap-12">
        <Reveal className="mx-auto">
          <SectionHeading
            eyebrow={isGoogleReviewsConnected ? 'Google Reviews' : 'Sample Reviews — Placeholder'}
            title="What Our Patients Say"
            description={
              isGoogleReviewsConnected
                ? undefined
                : 'Real patient reviews will appear here once this clinic connects its Google Business Profile.'
            }
          />
        </Reveal>

        {sampleReviews.length === 0 ? (
          <p className="text-center text-sm text-(--color-ink-soft)">
            Reviews are unavailable right now. Please check back later.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-3">
            {sampleReviews.map((review, index) => (
              <Reveal key={index} delay={index * 60} as="article">
                <div className="flex h-full flex-col gap-4 rounded-xl border border-(--color-border) bg-(--color-bg) p-6">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <Star
                        key={starIndex}
                        className={`h-4 w-4 ${
                          starIndex < review.rating
                            ? 'fill-(--color-accent) text-(--color-accent)'
                            : 'text-(--color-border)'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed text-(--color-ink-soft)">
                    &ldquo;{review.text}&rdquo;
                  </p>
                  <p className="text-sm font-medium text-(--color-ink)">{review.reviewerName}</p>
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </Container>
    </section>
  )
}
