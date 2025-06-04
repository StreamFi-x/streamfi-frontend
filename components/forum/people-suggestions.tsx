import { Button } from "@/components/ui/Button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Suggestion {
  username: string;
  pubPercentage: string;
  role: string;
  roleColor: string;
  tier: string;
}

export default function PeopleSuggestions() {
  const suggestions: Suggestion[] = [
    {
      username: "@christmascassandra",
      pubPercentage: "78%",
      role: "Early contributor",
      roleColor: "text-green-400",
      tier: "T&R 7",
    },
    {
      username: "@christmascassandra",
      pubPercentage: "30%",
      role: "Verified Booster",
      roleColor: "text-blue-400",
      tier: "T&R 4",
    },
    {
      username: "@christmascassandra",
      pubPercentage: "15%",
      role: "VIP Supporter",
      roleColor: "text-purple-400",
      tier: "T&R 1",
    },
  ];

  return (
    <div className=" bg-[#111111] border border-white/50  rounded-lg  w-full">
      <h3 className="text-sm p-5 bg-[#17191A4D] font-medium text-gray-300 mb-4">
        &quot;People Like You&quot; suggestion
      </h3>

      <div className="space-y-4">
        {suggestions.map((suggestion, index) => (
          <div key={index} className="flex p-4 items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src="/placeholder.svg?height=32&width=32" />
                <AvatarFallback className="bg-purple-600 text-xs">
                  CC
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">
                  {suggestion.username}
                </span>
                <div className="flex items-center space-x-1 text-xs">
                  <span className="text-gray-400">Pub:</span>
                  <span className="text-white font-medium">
                    {suggestion.pubPercentage}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className={suggestion.roleColor}>
                    {suggestion.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-400">{suggestion.tier}</div>
          </div>
        ))}
      </div>

      <Button className="w-[90%] mt-4 px-6 mx-auto mb-2 bg-purple-600 hover:bg-purple-700 text-white font-medium">
        See more
      </Button>
    </div>
  );
}
