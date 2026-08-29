import React from "react";

// ─── Base Shimmer — gradient animation instead of simple pulse ─────
const shimmer = "animate-gradient-shimmer rounded-lg";

// ─── Menu Item Skeleton ──────────────────────────────────────
export function MenuItemSkeleton() {
  return (
    <div className="flex gap-4 p-4 bg-white rounded-2xl shadow-sm border border-stone-100 animate-fade-in">
      <div className="flex-1 space-y-3">
        <div className={`${shimmer} h-5 w-3/4`} />
        <div className={`${shimmer} h-4 w-1/4`} />
        <div className={`${shimmer} h-3 w-full`} />
        <div className={`${shimmer} h-3 w-2/3`} />
        <div className={`${shimmer} h-8 w-20 rounded-full mt-2`} />
      </div>
      <div className={`${shimmer} w-28 h-28 shrink-0 rounded-xl`} />
    </div>
  );
}

export function MenuSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      <div className={`${shimmer} h-7 w-32`} />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: count }).map((_, i) => (
          <MenuItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// ─── Order Card Skeleton ─────────────────────────────────────
export function OrderCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200/80 overflow-hidden animate-fade-in-up" style={{ animationDelay: `${Math.random() * 200}ms` }}>
      {/* Top accent bar shimmer */}
      <div className="h-1 animate-gradient-shimmer" />
      <div className="p-5 border-b bg-stone-50/50 border-stone-100 flex justify-between items-start">
        <div className="space-y-2">
          <div className={`${shimmer} h-8 w-16`} />
          <div className={`${shimmer} h-3 w-24`} />
          <div className={`${shimmer} h-4 w-16 rounded-full`} />
        </div>
        <div className={`${shimmer} h-7 w-22 rounded-full`} />
      </div>
      <div className="p-5 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex justify-between">
            <div className="flex items-center gap-2">
              <div className={`${shimmer} w-5 h-5 rounded-md`} />
              <div className={`${shimmer} h-4 w-28`} />
            </div>
            <div className={`${shimmer} h-4 w-12`} />
          </div>
        ))}
      </div>
      <div className="p-5 bg-stone-50/80 border-t border-stone-100 space-y-4">
        <div className="flex justify-between">
          <div className={`${shimmer} h-5 w-24`} />
          <div className={`${shimmer} h-6 w-16`} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`${shimmer} h-10 rounded-xl`} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function OrdersSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── Stat Card Skeleton ──────────────────────────────────────
export function StatCardSkeleton() {
  return (
    <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm space-y-4 relative overflow-hidden animate-fade-in-up">
      {/* Top accent bar shimmer */}
      <div className="absolute top-0 left-0 right-0 h-1 animate-gradient-shimmer" />
      <div className="flex items-start justify-between">
        <div className={`${shimmer} h-4 w-24`} />
        <div className={`${shimmer} w-11 h-11 rounded-xl`} />
      </div>
      <div className={`${shimmer} h-9 w-28`} />
      <div className={`${shimmer} h-3 w-32`} />
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map(i => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      {/* Chart skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm lg:col-span-2 animate-fade-in-up delay-200">
          <div className="flex items-center justify-between mb-6">
            <div className={`${shimmer} h-5 w-32`} />
            <div className="flex gap-1">
              <div className={`${shimmer} h-8 w-16 rounded-md`} />
              <div className={`${shimmer} h-8 w-16 rounded-md`} />
            </div>
          </div>
          <div className={`${shimmer} h-72 w-full rounded-xl`} />
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm animate-fade-in-up delay-300">
          <div className={`${shimmer} h-5 w-32 mb-6`} />
          <div className="flex items-center justify-center h-72">
            <div className={`${shimmer} w-40 h-40 rounded-full`} />
          </div>
        </div>
      </div>
    </div>
  );
}
