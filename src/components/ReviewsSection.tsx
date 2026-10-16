import React, { useEffect, useId, useRef, useState } from 'react';
import { Star, MessageSquareHeart, CheckCircle, PlusCircle } from 'lucide-react';
import { CUSTOMER_REVIEWS, SERVICES_LIST } from '../data/mockData';
import { CustomerReview } from '../types';
import { DemoInlineNotice, DemoSampleBadge } from './DemoNotice';
import { PageModal } from './PageModal';

export const ReviewsSection: React.FC = () => {
  const [reviews, setReviews] = useState<CustomerReview[]>(CUSTOMER_REVIEWS);
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);
  
  // New review form states
  const [newAuthor, setNewAuthor] = useState('');
  const [newService, setNewService] = useState('نظافت استاندارد منزل');
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const reviewFormId = useId();
  // زمان‌سنج بستن خودکار پس از ثبت؛ با بستن دستی یا unmount پاک می‌شود تا پنجره‌ای را که
  // دوباره باز شده نبندد و پیام موفقیتِ کهنه نشان ندهد.
  const autoCloseTimerRef = useRef<number | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);

  const clearAutoCloseTimer = () => {
    if (autoCloseTimerRef.current !== null) {
      window.clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
  };

  const closeReviewModal = () => {
    clearAutoCloseTimer();
    setSubmittedSuccess(false);
    setShowAddReviewModal(false);
  };

  useEffect(() => clearAutoCloseTimer, []);

  // دکمه‌ی ثبت پس از موفقیت حذف می‌شود؛ فوکوس به پیام موفقیت می‌رود تا گم نشود و
  // صفحه‌خوان همان پیام را بخواند.
  useEffect(() => {
    if (submittedSuccess) successRef.current?.focus();
  }, [submittedSuccess]);

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthor.trim() || !newComment.trim()) return;

    const newRev: CustomerReview = {
      id: `rev-${Date.now()}`,
      authorName: newAuthor.trim(),
      serviceType: newService,
      rating: newRating,
      date: 'همین الان',
      comment: newComment.trim(),
      // احراز سفارش نیازمند سرور است و بدون آن این نشان داده نمی‌شود.
      verifiedBooking: false,
      recordType: 'demo'
    };

    setReviews([newRev, ...reviews]);
    setSubmittedSuccess(true);
    clearAutoCloseTimer();
    autoCloseTimerRef.current = window.setTimeout(() => {
      autoCloseTimerRef.current = null;
      setSubmittedSuccess(false);
      setShowAddReviewModal(false);
      setNewAuthor('');
      setNewComment('');
    }, 1500);
  };

  return (
    <section id="reviews" className="py-16 sm:py-20 bg-slate-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
              <MessageSquareHeart className="w-3.5 h-3.5 text-emerald-600" />
              <span>نمونه نظرات (نمایشی)</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              نظرات (داده‌های نمونه)
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              نظرات این بخش نمونه هستند و بازخورد واقعی مشتریان پاک‌شو محسوب نمی‌شوند. بازخورد واقعی تنها پس از اتصال سایت به سرور پاک‌شو نمایش داده می‌شود.
            </p>
          </div>

          <button
            onClick={() => setShowAddReviewModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold rounded-2xl shadow-xs transition-all cursor-pointer text-xs sm:text-sm self-start md:self-auto"
          >
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>ثبت نظر و تجربه شما</span>
          </button>
        </div>
        <DemoInlineNotice
          className="mb-6"
          text={'همه نظرات این صفحه «نمونه» هستند. برچسب «سفارش احرازشده» فقط برای بازخوردهای متصل به سفارش تأییدشده سرور نمایش داده می‌شود.'}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                
                {/* Header: Author, Rating, Date */}
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <span>{rev.authorName}</span>
                      {rev.recordType === 'sample' && <DemoSampleBadge />}
                      {rev.verifiedBooking && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          سفارش احرازشده
                        </span>
                      )}
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      {rev.serviceType}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Comment Text */}
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  «{rev.comment}»
                </p>

              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>{rev.date}</span>
                {rev.cleanerName && (
                  <span className="text-emerald-700 font-medium">
                    متخصص: {rev.cleanerName}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Add Review Modal */}
      {showAddReviewModal && (
        <PageModal
          onClose={closeReviewModal}
          labelledBy={`${reviewFormId}-title`}
          overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
          panelClassName="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 relative"
        >
            <button
              type="button"
              onClick={closeReviewModal}
              aria-label="بستن"
              className="absolute top-5 left-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
            >
              <span aria-hidden="true">✕</span>
            </button>

            <h3 id={`${reviewFormId}-title`} className="text-lg font-black text-slate-900 mb-1">
              ثبت نظر و تجربه نظافت
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              در نسخه آزمایشی، نظر شما ارسال نمی‌شود و فقط تا زمان بستن صفحه در همین مرورگر نمایش داده می‌شود.
            </p>

            {submittedSuccess ? (
              <div ref={successRef} tabIndex={-1} className="text-center py-8 space-y-3 outline-none">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">
                  نظر آزمایشی شما ثبت شد
                </h4>
                <p className="text-xs text-slate-500">
                  از اینکه با ما در اشتراک‌گذاری تجربه خود همراه شدید متشکریم.
                </p>
              </div>
            ) : (
              <form onSubmit={handleAddReview} className="space-y-4">
                <div>
                  <label htmlFor={`${reviewFormId}-author`} className="block text-xs font-bold text-slate-700 mb-1">
                    نام و نام خانوادگی
                  </label>
                  <input
                    id={`${reviewFormId}-author`}
                    type="text"
                    required
                    placeholder="مثال: علی اکبری"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor={`${reviewFormId}-service`} className="block text-xs font-bold text-slate-700 mb-1">
                    نوع خدمت دریافت شده
                  </label>
                  <select
                    id={`${reviewFormId}-service`}
                    value={newService}
                    onChange={(e) => setNewService(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    {SERVICES_LIST.map(s => (
                      <option key={s.id} value={s.title}>{s.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span id={`${reviewFormId}-rating`} className="block text-xs font-bold text-slate-700 mb-1">
                    میزان رضایت و امتیاز شما
                  </span>
                  <div role="group" aria-labelledby={`${reviewFormId}-rating`} className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewRating(star)}
                        aria-label={`${star.toLocaleString('fa-IR')} ستاره`}
                        aria-pressed={star === newRating}
                        className="p-1 text-amber-400 hover:scale-110 transition-transform cursor-pointer"
                      >
                        <Star aria-hidden="true" className={`w-6 h-6 ${star <= newRating ? 'fill-amber-400' : 'text-slate-300'}`} />
                      </button>
                    ))}
                    <span className="text-xs text-slate-500 font-bold mr-2">
                      ({newRating} از ۵ ستاره)
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor={`${reviewFormId}-comment`} className="block text-xs font-bold text-slate-700 mb-1">
                    متن نظر و جزئیات تجربه
                  </label>
                  <textarea
                    id={`${reviewFormId}-comment`}
                    rows={4}
                    required
                    placeholder="کیفیت کار نیرو، وقت‌شناسی، دقت در جزئیات..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/30 text-sm transition-all cursor-pointer"
                >
                  ارسال و ثبت نظر
                </button>
              </form>
            )}

        </PageModal>
      )}

    </section>
  );
};
