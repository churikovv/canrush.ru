'use client';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { CatalogReviewForm } from '@/components/catalog-review-form';
import { ReviewEditContext } from '@/components/review-edit-shortcut';
import type { ReviewData } from '@/lib/reviews';

/** Own review on the profile reviews page: the card's edit icon swaps it for the review form in place. */
export function ProfileReviewEditor({ review, children }: { review: ReviewData; children: ReactNode }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  if (editing) return <div className="profile-review-form">
    <CatalogReviewForm brand={review.brand} flavor={review.flavor} existing={review} authenticated initiallyEditing
      onClose={() => { setEditing(false); router.refresh(); }} />
  </div>;
  return <ReviewEditContext value={() => setEditing(true)}>{children}</ReviewEditContext>;
}
