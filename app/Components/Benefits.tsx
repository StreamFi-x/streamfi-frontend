import React from "react";

export const Benefits = () => {
  return (
    <section className="relative mt-14 px-4 sm:px-6 md:px-12 lg:px-24 py-16 text-white">
      <div className="mb-12">
        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
          Why Choose StreamFi?
        </h2>
        <p className="text-gray-400 max-w-2xl">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque
          efficitur nisl eget.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Decentralized Monetization */}
        <div
          className="col-span-1 sm:col-span-2 lg:col-span-2 row-span-2 p-6 rounded-lg h-[380px] flex flex-col justify-between"
          style={{
            background:
              "linear-gradient(292.05deg, #0D0419 39.29%, #15375B 139.74%)",
          }}
        >
          <div className="leading-relaxed mt-auto">
            <h3 className="text-3xl sm:text-4xl font-bold text-white">
              Decentralized Monetization
            </h3>
            <p className="text-gray-300 text-base">
              No middlemen. You keep 100% of your earnings.{" "}
              <span className="text-purple-400 font-medium">StreamFi</span>{" "}
              enables direct, peer-to-peer transactions, ensuring creators
              receive 100% of tips and earnings with no corporate cuts.
            </p>
          </div>
        </div>

        {/* Ad-Free Experience */}
        <div
          className="col-span-1 sm:col-span-1 lg:col-span-1 row-span-2 p-6 rounded-lg h-[380px] flex flex-col justify-between"
          style={{
            background:
              "linear-gradient(291.43deg, #16062B 24.87%, #15375B 137.87%)",
          }}
        >
          <div className="leading-relaxed mt-auto">
            <div className="flex items-center gap-4 mb-4">
              <h3 className="text-3xl sm:text-4xl font-semibold">
                Ad-Free Experience
              </h3>
            </div>
            <p className="text-gray-300 text-base">
              Enjoy uninterrupted, high-quality streaming.{" "}
              <span className="text-purple-400">StreamFi</span> offers an
              ad-free environment where creators monetize directly through
              subscriptions, tips, and staking, not ads.
            </p>
          </div>
        </div>

        {/* Direct Fan Engagement */}
        <div
          className="col-span-1 sm:col-span-1 lg:col-span-1 row-span-2 p-6 rounded-lg h-[380px] flex flex-col justify-between"
          style={{
            background:
              "linear-gradient(291.43deg, #16062B 24.87%, #15375B 137.87%)",
          }}
        >
          <div className="leading-relaxed mt-auto">
            <div className="flex items-center gap-4 mb-4">
              <h3 className="text-3xl font-semibold">Direct Fan Engagement</h3>
            </div>
            <p className="text-gray-300 text-base">
              Build stronger communities with direct interactions. With
              traditional platforms, fans are just viewers; on{" "}
              <span className="text-purple-400">StreamFi</span>, they’re active
              supporters.
            </p>
          </div>
        </div>

        {/* Community-Driven Governance */}
        <div
          className="col-span-1 sm:col-span-2 lg:col-span-2 row-span-2 p-6 rounded-lg h-[380px] flex flex-col justify-between"
          style={{
            background:
              "linear-gradient(291.43deg, #16062B 24.87%, #15375B 137.87%)",
          }}
        >
          <div className="leading-relaxed mt-auto">
            <div className="flex items-center gap-4 mb-4">
              <h3 className="text-3xl sm:text-4xl font-semibold">
                Community-Driven Governance
              </h3>
            </div>
            <p className="text-gray-300 text-base">
              Have a say in the future of{" "}
              <span className="text-purple-400">StreamFi</span>. Unlike
              centralized platforms where policy changes hurt creators (e.g.,
              demonetization), StreamFi is community-owned.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
