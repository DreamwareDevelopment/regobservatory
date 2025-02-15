import AgencyHistoryChart from "./components/agency-history-chart";
import BubbleChart from "./components/bubble-chart";
import AgencySearch from "./components/search";

export default function Home() {
  return (
    <div id="root" className="flex flex-col items-center justify-between min-h-screen p-4 pb-20 gap-8 sm:p-8 lg:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="container mx-auto flex flex-col gap-8 items-center w-full">
        <h1 className="text-2xl font-bold">RegObservatory</h1>
        <AgencyHistoryChart />
        <BubbleChart />
        <AgencySearch />
      </main>
    </div>
  );
}
