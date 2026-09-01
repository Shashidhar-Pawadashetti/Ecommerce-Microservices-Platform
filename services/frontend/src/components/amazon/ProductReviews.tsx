"use client";

import { useState } from "react";
import { Star, ThumbsUp, CheckCircle2, MessageSquarePlus, X } from "lucide-react";
import { Review } from "@/types";

interface ProductReviewsProps {
  productId: string;
  productName: string;
}

const INITIAL_REVIEWS: Review[] = [
  {
    id: "rev-1",
    author: "Alex Morgan",
    rating: 5,
    title: "Exceptional quality and lightning fast delivery!",
    comment:
      "Arrived the very next day with EcoPrime. The build quality exceeds expectations. The microservices backend integration is silky smooth and instant.",
    date: "August 28, 2026",
    verifiedPurchase: true,
    helpfulCount: 42,
  },
  {
    id: "rev-2",
    author: "Sarah Chen",
    rating: 5,
    title: "Worth every single penny - Best in class",
    comment:
      "I was skeptical at first, but after 2 weeks of heavy daily use, this product has held up phenomenally. Highly recommend to anyone looking for reliability.",
    date: "August 22, 2026",
    verifiedPurchase: true,
    helpfulCount: 18,
  },
  {
    id: "rev-3",
    author: "David Miller",
    rating: 4,
    title: "Solid product with great features",
    comment:
      "Great packaging, responsive controls, and good warranty coverage. Exactly as described in the tech specifications.",
    date: "August 15, 2026",
    verifiedPurchase: true,
    helpfulCount: 9,
  },
];

export function ProductReviews({ productId, productName }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newTitle, setNewTitle] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [votedReviews, setVotedReviews] = useState<{ [id: string]: boolean }>({});

  const handleVoteHelpful = (revId: string) => {
    if (votedReviews[revId]) return;
    setReviews((prev) =>
      prev.map((r) => (r.id === revId ? { ...r, helpfulCount: r.helpfulCount + 1 } : r))
    );
    setVotedReviews((prev) => ({ ...prev, [revId]: true }));
  };

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    const newRev: Review = {
      id: `rev-${Date.now()}`,
      author: newAuthor || "Verified Customer",
      rating: newRating,
      title: newTitle || "Verified Customer Review",
      comment: newComment,
      date: "Today",
      verifiedPurchase: true,
      helpfulCount: 0,
    };
    setReviews([newRev, ...reviews]);
    setIsModalOpen(false);
    setNewTitle("");
    setNewComment("");
    setNewAuthor("");
  };

  const starPercentages = [
    { stars: 5, pct: 76 },
    { stars: 4, pct: 16 },
    { stars: 3, pct: 5 },
    { stars: 2, pct: 2 },
    { stars: 1, pct: 1 },
  ];

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-10 border border-white/[0.08] shadow-xl my-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-white/10">
        <div>
          <h3 className="text-2xl font-black text-white">Customer Reviews</h3>
          <p className="text-xs text-slate-400 mt-1">
            Real feedback from verified purchasers of {productName}
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
        >
          <MessageSquarePlus className="h-4 w-4" /> Write a Customer Review
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Rating Breakdown Left Column */}
        <div className="lg:col-span-4 space-y-6">
          <div className="flex items-center gap-4">
            <span className="text-5xl font-black text-white">4.8</span>
            <div>
              <div className="flex items-center text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">1,248 global ratings</p>
            </div>
          </div>

          {/* Star Percentage Bars */}
          <div className="space-y-2.5 text-xs text-slate-400">
            {starPercentages.map((item) => (
              <div key={item.stars} className="flex items-center gap-3">
                <span className="w-12 font-medium">{item.stars} star</span>
                <div className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
                <span className="w-8 text-right font-semibold text-slate-300">{item.pct}%</span>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-xs text-slate-300">
            <p className="font-bold text-white mb-1">Review this product</p>
            <p className="text-slate-400 text-[11px] mb-3">
              Share your thoughts with other customers to help them make informed decisions.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors border border-white/10"
            >
              Write Review
            </button>
          </div>
        </div>

        {/* Customer Review List Right Column */}
        <div className="lg:col-span-8 space-y-6">
          {reviews.map((rev) => (
            <div key={rev.id} className="pb-6 border-b border-white/5 last:border-0 last:pb-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center font-bold text-xs text-white">
                  {rev.author[0]}
                </div>
                <div>
                  <p className="font-bold text-xs text-white">{rev.author}</p>
                  <p className="text-[10px] text-slate-400">{rev.date}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <div className="flex text-amber-400">
                  {[...Array(rev.rating)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400" />
                  ))}
                </div>
                <span className="font-bold text-xs text-white">{rev.title}</span>
              </div>

              {rev.verifiedPurchase && (
                <p className="text-[11px] font-bold text-amber-400/90 flex items-center gap-1 mb-2">
                  <CheckCircle2 className="h-3 w-3" /> Verified Purchase
                </p>
              )}

              <p className="text-xs text-slate-300 leading-relaxed mb-3">{rev.comment}</p>

              <button
                onClick={() => handleVoteHelpful(rev.id)}
                disabled={votedReviews[rev.id]}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/5 transition-colors disabled:opacity-60 cursor-pointer"
              >
                <ThumbsUp className="h-3 w-3" />
                <span>{votedReviews[rev.id] ? "Helpful (Voted)" : "Helpful"}</span>
                {rev.helpfulCount > 0 && <span className="text-slate-400">({rev.helpfulCount})</span>}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Write Review Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <h4 className="font-bold text-base text-white">Write a Customer Review</h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddReview} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Overall Rating
                </label>
                <div className="flex gap-1.5 text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setNewRating(star)}
                      className="p-1 hover:scale-125 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= newRating ? "fill-amber-400" : "text-slate-600"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  placeholder="e.g. Jordan S."
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-800 border border-white/10 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Review Headline
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Fantastic performance and build quality"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-800 border border-white/10 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Detailed Feedback
                </label>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="What did you like or dislike about this product?"
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-800 border border-white/10 text-white text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none resize-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs hover:brightness-110 transition-all shadow-md shadow-amber-500/20"
                >
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
