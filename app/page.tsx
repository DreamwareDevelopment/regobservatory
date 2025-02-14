import AgencyHistoryChart from "./components/agency-history-chart";
import BubbleChart from "./components/bubble-chart";
import AgencySearch from "./components/search";

export default function Home() {
  return (
    <div id="root" className="flex flex-col items-center justify-between min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="container mx-auto p-4 flex flex-col gap-4 items-center">
        <h1 className="text-2xl font-bold mb-4">RegObservatory</h1>
        <AgencyHistoryChart />
        <BubbleChart />
        <AgencySearch />
      </main>
    </div>
  );
}
