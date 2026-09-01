import React, { useState } from 'react';
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
import { ServiceType, CleanerGender, BookingOrder, CleanerSpecialist, OrderStatus } from './types';
import { PhoneCall, Bot } from 'lucide-react';

function PakshoAppContent() {
  const { orders, createOrder, updateOrderStatus } = useOrders();

  // Modal States
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [isAiConsultantOpen, setIsAiConsultantOpen] = useState(false);

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
      setBookingParams({
        serviceId: serviceId as ServiceType,
        cleanerGender: 'no-pref',
        hours: 4
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

  // Open booking from Cost Calculator
  const handleProceedFromCalculator = (calcData: {
    serviceId: ServiceType;
    hours: number;
    squareMeters: number;
    roomsCount: number;
    selectedAddons: string[];
    hasDetergentPackage: boolean;
    cleanerGender: CleanerGender;
    totalPrice: number;
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

  // Update order status (simulate progression / rating)
  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus, userRating?: number, userFeedback?: string) => {
    await updateOrderStatus({
      orderId,
      status: newStatus,
      userRating,
      userFeedback
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      
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

        {/* Direct Call hotline button */}
        <a
          href="tel:02188990011"
          className="w-12 h-12 rounded-full bg-emerald-600 text-white shadow-xl hover:bg-emerald-700 flex items-center justify-center transition-all hover:scale-110"
          title="تماس با پشتیبانی پاک‌شو"
          aria-label="تماس با پشتیبانی پاک‌شو"
        >
          <PhoneCall className="w-6 h-6" />
        </a>
      </div>

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
        onUpdateOrderStatus={handleUpdateOrderStatus}
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
