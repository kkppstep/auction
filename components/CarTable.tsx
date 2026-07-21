"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabase/client";

type Car = {
  id: string;
  title: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  power: string | null;
  price: number | null;
  mileage: string | null;
  transmission: string | null;
  fuel_type: string | null;
  color: string | null;
  cover_image_url: string | null;
  description: string | null;
};

function formatPrice(price: number | null) {
  if (price == null) return "ဆက်သွယ်မေးမြန်းပါ";
  return `${price.toLocaleString("en-US")} ကျပ်`;
}

export default function CarTable() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabaseBrowser
        .from("cars")
        .select("*")
        .eq("status", "for_sale")
        .order("created_at", { ascending: false });
      if (active) {
        setCars((data as Car[]) ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="px-4 py-8 text-center text-chrome">တင်နေသည်…</p>;
  }

  if (cars.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-chrome">
        ဆိုင်တွင် ရောင်းရန် ကားများ မရှိသေးပါ။
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-3 pb-4">
      {cars.map((car) => (
        <article
          key={car.id}
          className="overflow-hidden rounded-2xl border border-white/10 bg-surface"
        >
          {car.cover_image_url && (
            <div className="relative h-44 w-full">
              <Image
                src={car.cover_image_url}
                alt={car.title}
                fill
                className="object-cover"
                sizes="(max-width: 480px) 100vw, 448px"
              />
            </div>
          )}
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-2xl tracking-wide text-ivory">
                {car.title}
              </h3>
              <span className="gauge-ring shrink-0 rounded-full bg-amber/10 px-3 py-1 font-display text-sm text-amber">
                {formatPrice(car.price)}
              </span>
            </div>

            {car.description && (
              <p className="mt-1 text-sm text-chrome">{car.description}</p>
            )}

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/10 pt-3 text-sm">
              <Spec label="Brand" value={car.brand} />
              <Spec label="Model" value={car.model} />
              <Spec label="Year" value={car.year?.toString() ?? null} />
              <Spec label="Power" value={car.power} />
              <Spec label="Mileage" value={car.mileage} />
              <Spec label="Transmission" value={car.transmission} />
              <Spec label="Fuel type" value={car.fuel_type} />
              <Spec label="Color" value={car.color} />
            </dl>
          </div>
        </article>
      ))}
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-chrome">{label}</dt>
      <dd className="text-right text-ivory">{value}</dd>
    </div>
  );
}
