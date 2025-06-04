import { Button } from "@/components/ui/Button";

export default function PeopleLikeYou() {
  return (
    <div className="bg-[#121212] text-white p-4 rounded-lg max-w-[450px] w-full">
      <h3 className="text-sm font-medium mb-3 text-gray-300">
        &quot;People Like You&#34; suggestion
      </h3>

      <div className="space-y-3">
        {/* User suggestion 1 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">@Chilidima Cassandra</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-400">Pub: </span>
              <span className="text-white font-medium">78%</span>
              <span className="text-green-500">Early contributor</span>
            </div>
          </div>
          <div className="text-xs text-gray-400">TIER 7</div>
        </div>

        {/* User suggestion 2 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">@Chilidima Cassandra</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-400">Pub: </span>
              <span className="text-white font-medium">30%</span>
              <span className="text-purple-400">Skilled master</span>
            </div>
          </div>
          <div className="text-xs text-gray-400">TIER 4</div>
        </div>

        {/* User suggestion 3 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">@Chilidima Cassandra</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-400">Pub: </span>
              <span className="text-white font-medium">15%</span>
              <span className="text-pink-500">Art enthusiast</span>
            </div>
          </div>
          <div className="text-xs text-gray-400">TIER 1</div>
        </div>
      </div>

      <Button className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white rounded-md py-1 text-sm">
        See more
      </Button>
    </div>
  );
}
