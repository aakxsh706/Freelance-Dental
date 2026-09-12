export interface Review {
  reviewerName: string
  rating: number
  text: string
}

/**
 * Sample placeholder content only — these are NOT real Google reviews.
 * Replace this file's export with data pulled from the Google Places/Business
 * Profile API once the clinic's Google Business listing and API credentials
 * are available; the <Reviews> component's props shape can stay the same.
 */
export const isGoogleReviewsConnected = false

export const sampleReviews: Review[] = [
  {
    reviewerName: 'Reviewer Name Placeholder',
    rating: 5,
    text: 'Real patient reviews will appear here once connected to Google Reviews.',
  },
  {
    reviewerName: 'Reviewer Name Placeholder',
    rating: 5,
    text: 'Sample review text — replace with authentic patient feedback.',
  },
  {
    reviewerName: 'Reviewer Name Placeholder',
    rating: 4,
    text: 'Sample review text — replace with authentic patient feedback.',
  },
]
