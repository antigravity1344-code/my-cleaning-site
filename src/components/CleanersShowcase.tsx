import React, { useState } from 'react';
import { 
  Users, 
  Star, 
  ShieldCheck, 
  Award, 
  CalendarCheck, 
  ThumbsUp, 
  CheckCircle,
  Clock
} from 'lucide-react';
import { CLEANERS_LIST } from '../data/mockData';
import { CleanerSpecialist } from '../types';

interface CleanersShowcaseProps {
  onSelectCleaner: (cleaner: CleanerSpecialist) => void;
}

export const CleanersShowcase: React.FC<CleanersShowcaseProps> = ({
  onSelectCleaner
}) => {
  const [filterGender, setFilterGender] = useState<'all' | 'female' | 'male'>('all');

  const filteredCleaners = CLEANERS_LIST.filter(c => {
    if (filterGender === 'all') return true;
    return c.gender === filterGender;
  });

  return (
    <section id="cleaners" className="py-16 sm:py-20 bg-slate-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>نیروهای گلچین‌شده و مجرب</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              برترین متخصصین و نیروهای خدماتی پاک‌شو
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              تمامی همکاران ما دارای گواهی معتبر عدم سوءپیشینه، احراز محل سکونت، بیمه حوادث و دوره‌های تخصصی استانداردهای بهداشتی و اخلاقی هستند.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs shrink-0 self-start md:self-auto">
            <button
              onClick={() => setFilterGender('all')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterGender === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              همه نیروها ({CLEANERS_LIST.length})
            </button>
            <button
              onClick={() => setFilterGender('female')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterGender === 'female'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              متخصصین خانم
            </button>
            <button
              onClick={() => setFilterGender('male')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterGender === 'male'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              متخصصین آقا
            </button>
          </div>
        </div>

        {/* Cleaners Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredCleaners.map((cleaner) => (
            <div
              key={cleaner.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 hover:border-emerald-500/50 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                
                {/* Top info: Avatar, badge, rating */}
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <img
                      src={cleaner.avatar}
                      alt={cleaner.name}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shadow-sm"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute -bottom-1.5 -right-1.5 bg-emerald-600 text-white p-0.5 rounded-full ring-2 ring-white">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-base text-slate-900">
                        {cleaner.name}
                      </h3>
                      <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                        <span className="text-xs font-bold font-mono text-amber-900">
                          {cleaner.rating}
                        </span>
                      </div>
                    </div>

                    <span className="inline-block bg-teal-50 text-teal-800 text-[11px] font-bold px-2 py-0.5 rounded-md">
                      {cleaner.badge}
                    </span>

                    <div className="flex items-center gap-3 text-xs text-slate-500 pt-0.5">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {cleaner.experienceYears} سال تجربه
                      </span>
                      <span>•</span>
                      <span className="font-mono">
                        {cleaner.completedOrders} سفارش موفق
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <p className="mt-4 text-xs text-slate-600 leading-relaxed">
                  {cleaner.bio}
                </p>

                {/* Specialties tags */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {cleaner.specialties.map((spec, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg"
                    >
                      {spec}
                    </span>
                  ))}
                </div>

              </div>

              {/* Bottom Card Footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    احراز هویت شده و دارای بیمه
                  </span>
                  <span className="text-emerald-700 font-bold font-mono">
                    رضایت {cleaner.satisfactionRate}٪
                  </span>
                </div>

                <button
                  onClick={() => onSelectCleaner(cleaner)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-200 hover:border-emerald-600 font-bold rounded-xl text-xs sm:text-sm transition-all cursor-pointer active:scale-95"
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span>درخواست این متخصص برای نظافت</span>
                </button>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
