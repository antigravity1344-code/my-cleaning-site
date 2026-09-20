import React, { useState } from 'react';
import { 
  Search, 
  X, 
  MapPin, 
  Phone, 
  AlertCircle, 
  Star, 
  PhoneCall, 
  RefreshCw,
  Ban
} from 'lucide-react';
import { BookingOrder, OrderStatus } from '../types';

interface OrderTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: BookingOrder[];
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus, userRating?: number, userFeedback?: string) => void;
}

export const OrderTrackerModal: React.FC<OrderTrackerModalProps> = ({
  isOpen,
  onClose,
  orders,
  onUpdateOrderStatus
}) => {
  const [searchCode, setSearchCode] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<BookingOrder | null>(orders[0] || null);
  const [userStarRating, setUserStarRating] = useState(5);
  const [userFeedbackText, setUserFeedbackText] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchCode.trim().toUpperCase();
    if (!query) return;

    const found = orders.find(o => 
      o.trackingCode.toUpperCase() === query || 
      o.customerPhone.includes(query) ||
      o.id === query
    );
    if (found) {
      setSelectedOrder(found);
    } else {
      alert('سفارشی با این کد پیگیری یا شماره تماس یافت نشد.');
    }
  };

  const getStatusStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 0;
      case 'assigned': return 1;
      case 'on_the_way': return 2;
      case 'in_progress': return 3;
      case 'completed': return 4;
      case 'cancelled': return -1;
      default: return 0;
    }
  };

  const statusSteps = [
    { title: 'ثبت سفارش', desc: 'درخواست شما ثبت شد' },
    { title: 'تخصیص متخصص', desc: 'نیروی خدماتی تایید شد' },
    { title: 'در مسیر اعزام', desc: 'نیرو در راه آدرس شماست' },
    { title: 'در حال نظافت', desc: 'عملیات تمیزکاری فعال است' },
    { title: 'پایان کار و رضایت', desc: 'نظافت با موفقیت پایان یافت' }
  ];

  const handleAdvanceStatusDemo = () => {
    if (!selectedOrder) return;
    const currentIdx = getStatusStepIndex(selectedOrder.status);
    const statuses: OrderStatus[] = ['pending', 'assigned', 'on_the_way', 'in_progress', 'completed'];
    if (currentIdx < statuses.length - 1) {
      const nextStatus = statuses[currentIdx + 1];
      onUpdateOrderStatus(selectedOrder.id, nextStatus);
      setSelectedOrder({ ...selectedOrder, status: nextStatus });
    }
  };

  const handleCancelOrder = () => {
    if (!selectedOrder) return;
    if (confirm('آیا از لغو این سفارش اطمینان دارید؟ (لغو تا ۲ ساعت قبل از شروع کاملاً رایگان است)')) {
      onUpdateOrderStatus(selectedOrder.id, 'cancelled');
      setSelectedOrder({ ...selectedOrder, status: 'cancelled' });
    }
  };

  const handleSubmitRating = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    onUpdateOrderStatus(selectedOrder.id, selectedOrder.status, userStarRating, userFeedbackText);
    setSelectedOrder({ ...selectedOrder, userRating: userStarRating, userFeedback: userFeedbackText });
    setRatingSubmitted(true);
    setTimeout(() => setRatingSubmitted(false), 2500);
  };

  const currentStepIdx = selectedOrder ? getStatusStepIndex(selectedOrder.status) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 sm:px-8 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div>
            <span className="text-xs font-bold text-emerald-600 block">
              سامانه رهگیری لحظه‌ای
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900">
              پیگیری و مدیریت وضعیت سفارشات
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-8 overflow-y-auto flex-1 space-y-6 text-slate-800">
          
          {/* Search by tracking code */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="کد پیگیری (مثلا PAK-84920) یا شماره موبایل..."
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pr-10 pl-3 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all cursor-pointer shrink-0"
            >
              جستجو
            </button>
          </form>

          {/* Quick Select from existing orders list */}
          {orders.length > 1 && (
            <div>
              <span className="text-xs font-bold text-slate-500 block mb-2">
                سفارشات اخیر شما:
              </span>
              <div className="flex flex-wrap gap-2">
                {orders.map((ord) => (
                  <button
                    key={ord.id}
                    onClick={() => setSelectedOrder(ord)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold font-mono transition-all cursor-pointer ${
                      selectedOrder?.id === ord.id
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {ord.trackingCode} ({ord.serviceTitle.slice(0, 15)}...)
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedOrder ? (
            <div className="space-y-6">
              
              {/* Order Info Card */}
              <div className="p-5 rounded-3xl bg-slate-900 text-white space-y-4 shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs text-slate-400 block">کد پیگیری سفارش:</span>
                    <strong className="text-xl font-black font-mono text-emerald-400">
                      {selectedOrder.trackingCode}
                    </strong>
                  </div>
                  <div className="text-left">
                    <span className="text-xs text-slate-400 block">زمان ثبت:</span>
                    <span className="text-xs font-medium text-slate-200">{selectedOrder.createdAt}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">نوع خدمت:</span>
                    <strong className="text-white">{selectedOrder.serviceTitle}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">مدت زمان:</span>
                    <strong className="text-white font-mono">{selectedOrder.hours} ساعت</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">تاریخ مراجعه:</span>
                    <strong className="text-white">{selectedOrder.date}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">مبلغ سفارش:</span>
                    <strong className="text-emerald-400 font-mono">{selectedOrder.totalPrice.toLocaleString('fa-IR')} ت</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    {selectedOrder.cityName}، {selectedOrder.district}، {selectedOrder.address} {selectedOrder.unit && `(${selectedOrder.unit})`}
                  </span>
                </div>
              </div>

              {/* Progress Tracker Steps */}
              {selectedOrder.status !== 'cancelled' ? (
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900">
                      مراحل اجرای سفارش
                    </h4>
                    <span className="text-xs text-emerald-700 bg-emerald-100 font-bold px-2.5 py-0.5 rounded-full">
                      وضعیت زنده
                    </span>
                  </div>

                  <div className="relative pt-2 pb-2">
                    <div className="grid grid-cols-5 gap-1 relative text-center">
                      {statusSteps.map((step, idx) => {
                        const isDone = currentStepIdx >= idx;
                        const isCurrent = currentStepIdx === idx;
                        return (
                          <div key={idx} className="space-y-1.5 flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                              isCurrent
                                ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-md animate-pulse'
                                : isDone
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-200 text-slate-500'
                            }`}>
                              {isDone ? '✓' : idx + 1}
                            </div>
                            <span className={`text-[11px] font-bold block ${isCurrent ? 'text-emerald-800' : isDone ? 'text-slate-800' : 'text-slate-400'}`}>
                              {step.title}
                            </span>
                            <span className="hidden sm:block text-[9px] text-slate-400 leading-tight">
                              {step.desc}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Simulator button for previewing state progression */}
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleAdvanceStatusDemo}
                      className="text-[11px] text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>شبیه‌سازی گام بعدی وضعیت</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
                  <Ban className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>این سفارش لغو شده است. در صورت نیاز به هماهنگی با پشتیبانی تماس حاصل فرمایید.</span>
                </div>
              )}

              {/* Assigned Cleaner Profile Card */}
              {selectedOrder.cleanerName && (
                <div className="p-5 rounded-3xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 text-right">
                    <img
                      src={selectedOrder.cleanerAvatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80'}
                      alt={selectedOrder.cleanerName}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500 shadow-sm shrink-0"
                    />
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-emerald-800 font-medium">متخصص اختصاص‌یافته برای شما:</span>
                      <h4 className="text-base font-bold text-slate-900">{selectedOrder.cleanerName}</h4>
                      <span className="text-xs text-slate-600 block">احراز هویت شده • تحت پوشش بیمه حوادث</span>
                    </div>
                  </div>

                  <a
                    href={`tel:${selectedOrder.cleanerPhone}`}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all shrink-0"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>تماس: {selectedOrder.cleanerPhone}</span>
                  </a>
                </div>
              )}

              {/* Review & Rating Form (if completed or finished) */}
              {selectedOrder.status === 'completed' && (
                <div className="p-5 rounded-3xl bg-amber-50/70 border border-amber-200 space-y-3">
                  <h4 className="font-bold text-sm text-amber-950 flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                    نظرسنجی کیفیت خدمت انجام شده
                  </h4>
                  
                  {ratingSubmitted || selectedOrder.userRating ? (
                    <div className="p-3 bg-white rounded-2xl border border-amber-200 text-xs text-emerald-800 font-bold text-center">
                      ✓ امتیاز {selectedOrder.userRating || userStarRating} ستاره با موفقیت ثبت شد. از همکاری شما متشکریم!
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitRating} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-700 font-bold">امتیاز شما به متخصص:</span>
                        <div className="flex items-center gap-1 text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setUserStarRating(s)}
                              className="p-1 cursor-pointer"
                            >
                              <Star className={`w-5 h-5 ${s <= userStarRating ? 'fill-amber-400' : 'text-slate-300'}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        placeholder="نظر شما درباره دقت، سرعت و برخورد متخصص..."
                        value={userFeedbackText}
                        onChange={(e) => setUserFeedbackText(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-800"
                      />

                      <button
                        type="submit"
                        className="py-2 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        ثبت امتیاز و بازخورد
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Order Actions */}
              {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <button
                    onClick={handleCancelOrder}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>لغو سفارش</span>
                  </button>

                  <a
                    href="tel:02188990011"
                    className="text-xs text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>پشتیبانی پاک‌شو: ۰۲۱-۸۸۹۹۰۰۱۱</span>
                  </a>
                </div>
              )}

            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs">سفارشی برای نمایش انتخاب نشده است.</p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
