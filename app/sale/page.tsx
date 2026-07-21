import CarTable from "@/components/CarTable";

export default function SalePage() {
  return (
    <div>
      <header className="px-4 pt-4">
        <h1 className="font-display text-3xl tracking-wide text-ivory">
          YBC <span className="text-amber">Sale</span>
        </h1>
        <p className="mb-2 text-sm text-chrome">စျေးနှုန်းနှင့် အသေးစိတ်ကြည့်ရှုနိုင်သည်</p>
      </header>
      <CarTable />
    </div>
  );
}
