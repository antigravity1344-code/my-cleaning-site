import { useCallback, useState } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { ServicesSection } from './components/ServicesSection';
import { CostCalculator } from './components/CostCalculator';
import { CleanersShowcase } from './components/CleanersShowcase';
import { WhyUs } from './components/WhyUs';
import { ReviewsSection } from './components/ReviewsSection';
import { FAQSection } from './components/FAQSection';
import { CleaningTipsSection } from './components/CleaningTipsSection';
import { Footer } from './components/Footer';
import { BookingModal } from './components/BookingModal';
import { OrderTrackerModal } from './components/OrderTrackerModal';
import { AiConsultantModal } from './components/AiConsultantModal';
import { OrderProvider, useOrders } from './context/OrderContext';
import { ServiceType, CleanerGender, BookingOrder, CleanerSpecialist } from './types';
import { SERVICES_LIST } from './data/mockData';
import { Bot } from 'lucide-react';
import { DemoModeBanner } from './components/DemoNotice';
import { BackgroundInertContext } from './context/BackgroundInertContext';

function PakshoAppContent() {
  const { orders, createOrder, submitOrderRating, cancelOrder, hasLegacyStoredData } = useOrders();

  // Modal States
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [isAiConsultantOpen, setIsAiConsultantOpen] = useState(false);
  // پنجره‌های داخل بخش‌ها (جزئیات خدمت، مطلب مجله، ثبت نظر) با BackgroundInertContext
  // باز بودن خود را اعلام می‌کنند.
  const [openPageModalCount, setOpenPageModalCount] = useState(0);
  const holdBackgroundInert = useCallback(() => {
    setOpenPageModalCount((count) => count + 1);
    return () => setOpenPageModalCount((count) => count - 1);
  }, []);
  const isAnyModalOpen = isBookingOpen || isTrackerOpen || isAiConsultantOpen || openPageModalCount > 0;

  // Booking Modal Pre-fill Params
  const [bookingParams, setBookingParams] = useState<{
    serviceId: ServiceType;
    cleanerGender: CleanerGender;
    hours: number;
    squareMeters?: number;
    roomsCount?: number;
    selectedAddons?: string[];
    hasDetergentPackage?: boolean;
    cityName?: string;
    cleanerId?: string;
  } | undefined>(undefined);

  // Open booking with specific service
  const handleOpenBooking = (serviceId?: string) => {
    if (serviceId) {
      // توجه: ساعت پیش‌فرض باید حداقل ساعت همان خدمت باشد، نه یک عدد ثابت ۴.
      // برخی خدمات (مثلاً «خانه‌تکانی عمیق» و «پس از بازسازی») حداقل ساعت
      // بالاتری دارند و ۴ ساعت ثابت باعث می‌شد فرم رزرو و فاکتور زیر حداقل
      // مجاز آن خدمت باز شوند.
      const service = SERVICES_LIST.find((s) => s.id === serviceId);
      setBookingParams({
        serviceId: serviceId as ServiceType,
        cleanerGender: 'no-pref',
        hours: service?.minHours ?? 4
      });
    } else {
      setBookingParams(undefined);
    }
    setIsBookingOpen(true);
  };

  // Open booking from Hero Quick Booking Form
  const handleStartBookingFromHero = (params: {
    serviceId: ServiceType;
    cleanerGender: CleanerGender;
    hours: number;
    cityName: string;
  }) => {
    setBookingParams({
      serviceId: params.serviceId,
      cleanerGender: params.cleanerGender,
      hours: params.hours,
      cityName: params.cityName
    });
    setIsBookingOpen(true);
  };

  // Open booking from Cost Calculator.
  // توجه: هیچ مبلغی منتقل نمی‌شود. فرم رزرو همان ورودی‌های خام را می‌گیرد و مبلغ را
  // با همان موتور مشترک قیمت‌گذاری بازمحاسبه می‌کند. این طراحی احتمال واگرایی نمایش
  // محاسبه‌گر و فاکتور را کم می‌کند (و در آزمون
  // src/App.bookingFlow.test.tsx برای ورودی‌های آزمون‌شده پوشش داده شده است)، اما
  // تضمین ریاضی برای همه ورودی‌های ممکن نیست. عدد محاسبه‌شده در مرورگر در هر حال
  // مبنای پرداخت نیست.
  const handleProceedFromCalculator = (calcData: {
    serviceId: ServiceType;
    hours: number;
    squareMeters: number;
    roomsCount: number;
    selectedAddons: string[];
    hasDetergentPackage: boolean;
    cleanerGender: CleanerGender;
  }) => {
    setBookingParams({
      serviceId: calcData.serviceId,
      hours: calcData.hours,
      squareMeters: calcData.squareMeters,
      roomsCount: calcData.roomsCount,
      selectedAddons: calcData.selectedAddons,
      hasDetergentPackage: calcData.hasDetergentPackage,
      cleanerGender: calcData.cleanerGender
    });
    setIsBookingOpen(true);
  };

  // Open booking requesting specific cleaner
  const handleSelectCleaner = (cleaner: CleanerSpecialist) => {
    setBookingParams({
      serviceId: 'home-standard',
      cleanerGender: cleaner.gender,
      cleanerId: cleaner.id,
      hours: 4
    });
    setIsBookingOpen(true);
  };

  // Apply AI recommendation
  const handleApplyAiRecommendation = (rec: {
    serviceId: ServiceType;
    hours: number;
    cleanerGender: CleanerGender;
    selectedAddons: string[];
    hasDetergentPackage: boolean;
  }) => {
    setIsAiConsultantOpen(false);
    setBookingParams({
      serviceId: rec.serviceId,
      hours: rec.hours,
      cleanerGender: rec.cleanerGender,
      selectedAddons: rec.selectedAddons,
      hasDetergentPackage: rec.hasDetergentPackage
    });
    setIsBookingOpen(true);
  };

  // Handle new order added
  const handleOrderCreated = (_newOrder: BookingOrder) => {
    // State is synchronized via OrderContext
  };

  // ثبت امتیاز عددی مشتری — وضعیت عملیاتی سفارش تغییر نمی‌کند و متن آزاد
  // بازخورد در حافظه مرورگر ذخیره نمی‌شود.
  // توجه: خطا عمداً اینجا بلعیده نمی‌شود؛ Promise رد‌شده به OrderTrackerModal برمی‌گردد
  // تا خطای قابل‌مشاهده نشان دهد و پیام موفقیت ساختگی نمایش داده نشود.
  const handleSubmitOrderRating = async (orderId: string, userRating: number) => {
    await submitOrderRating(orderId, userRating);
  };

  // لغو نمایشی رکورد محلی (هیچ اثر عملیاتی ندارد).
  const handleCancelOrder = async (orderId: string) => {
    await cancelOrder(orderId);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">

      {/*
        پس‌زمینه‌ی صفحه: تا وقتی هر پنجره‌ای باز است، inert می‌شود؛ یعنی از درخت
        دسترس‌پذیری (صفحه‌خوان) و از فوکوس/کلیک خارج می‌شود. پنجره‌ها عمداً بیرون از
        این بخش رندر می‌شوند تا خودشان هرگز زیر عنصر inert قرار نگیرند. چون شرط
        «هر پنجره‌ای باز است» در انتقال مشاور ← فرم رزرو true می‌ماند، پس‌زمینه
        در آن انتقال حتی یک لحظه هم فعال نمی‌شود. `contents` یعنی این div هیچ جعبه‌ی
        چیدمانی نمی‌سازد و چیدمان flex صفحه دست نمی‌خورد.
        ترتیب مهم است: این بخش باید پیش از پنجره‌ها بیاید.
      */}
      <BackgroundInertContext.Provider value={holdBackgroundInert}>
      <div className="contents" inert={isAnyModalOpen}>

      {/* Global demo-mode disclosure */}
      <DemoModeBanner />

      {/* Sticky Header */}
      <Header
        onOpenBooking={() => handleOpenBooking()}
        onOpenTracker={() => setIsTrackerOpen(true)}
        onOpenAiConsultant={() => setIsAiConsultantOpen(true)}
        ordersCount={orders.length}
      />

      {/* Main Landing Flow */}
      <main className="flex-1">
        
        {/* 1. Hero Section with Quick Estimator Widget */}
        <Hero
          onStartBookingWithParams={handleStartBookingFromHero}
          onOpenAiConsultant={() => setIsAiConsultantOpen(true)}
        />

        {/* 2. Specialized Services List */}
        <ServicesSection
          onSelectServiceForBooking={handleOpenBooking}
        />

        {/* 3. Interactive Cost Calculator */}
        <CostCalculator
          onProceedToBooking={handleProceedFromCalculator}
        />

        {/* 4. Verified Cleaners Showcase */}
        <CleanersShowcase
          onSelectCleaner={handleSelectCleaner}
        />

        {/* 5. Why Choose Us & Guarantees */}
        <WhyUs />

        {/* 6. Customer Testimonials & Reviews */}
        <ReviewsSection />

        {/* 7. Categorized FAQ Accordion */}
        <FAQSection />

        {/* 8. House Cleaning Tips & Blog */}
        <CleaningTipsSection />

      </main>

      {/* Comprehensive Footer */}
      <Footer
        onOpenBooking={() => handleOpenBooking()}
        onOpenTracker={() => setIsTrackerOpen(true)}
      />

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 left-6 z-30 flex flex-col gap-3">
        {/* AI advisor float button */}
        <button
          onClick={() => setIsAiConsultantOpen(true)}
          className="w-12 h-12 rounded-full bg-teal-800 text-white shadow-xl hover:bg-teal-900 flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
          title="مشاور هوشمند نظافت"
          aria-label="مشاور هوشمند نظافت"
        >
          <Bot className="w-6 h-6 text-amber-300 animate-pulse" />
        </button>

      </div>

      </div>
      </BackgroundInertContext.Provider>
      {/* پایان پس‌زمینه‌ی inert‌شونده */}

      {/* Booking Wizard Modal */}
      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        initialParams={bookingParams}
        onOrderCreated={handleOrderCreated}
        createOrderService={createOrder}
      />

      {/* Order Tracker Modal */}
      <OrderTrackerModal
        isOpen={isTrackerOpen}
        onClose={() => setIsTrackerOpen(false)}
        orders={orders}
        onSubmitOrderRating={handleSubmitOrderRating}
        onCancelOrder={handleCancelOrder}
        hasLegacyStoredData={hasLegacyStoredData}
      />

      {/* AI Consultant Modal */}
      <AiConsultantModal
        isOpen={isAiConsultantOpen}
        onClose={() => setIsAiConsultantOpen(false)}
        onApplyRecommendation={handleApplyAiRecommendation}
      />

    </div>
  );
}

export default function App() {
  return (
    <OrderProvider>
      <PakshoAppContent />
    </OrderProvider>
  );
}
