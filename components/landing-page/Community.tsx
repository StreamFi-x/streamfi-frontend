import Image from "next/image";
import x from "../../public/Images/x.png";
import telegram from "../../public/Images/Telegram.png";
import key from "../../public/Images/key.png";
import bulb from "../../public/Images/bulb.png";
import podcast from "../../public/Images/podcast.png";
import folder from "../../public/Images/folder.png";
import Section from "../layout/Section";
import Discord  from "@/public/Images/discord.png";

const Community = () => {
  return (
    <Section id="community" className="pt-20 flex flex-col items-center">
      <div className="text-center flex flex-col justify-center items-center gap-4 max-w-4xl w-2/3">
        <h1 className="text-3xl md:text-5xl font-extrabold text-offWhite tracking-wide font-helvetica">
          Join Our Community - Be Part Of The Future Of Streaming
        </h1>
        <p className=" opacity-60 text-base font-normal text-white/80">
          StreamFi is more than just a platform, it&apos;s a movement. By joining our
          community, you become part of an ecosystem built for creators,
          viewers, and Web3 enthusiasts who believe in decentralized,
          creator-first streaming
        </p>
      </div>
      <div className="flex justify-center items-center gap-2 sm:gap-8 pt-10 max-w-4xl w-full">
        <button className="flex justify-center gap-2 border rounded-lg px-5 py-3">
          <Image src={x} alt="X icon" width={24} height={18} />
          <p>Join our community</p>
        </button>
        <button className="flex justify-center gap-2 border rounded-lg px-5 py-3">
          <Image src={telegram} alt="telegram icon" width={24} height={18} />
          <p>Join our community</p>
        </button>
        <button className="flex justify-center gap-2 border rounded-lg px-5 py-3">
          <Image src={Discord} alt="Discord icon" />
          <p>Join our community</p>
        </button>
      </div>
      <div className="sm:flex grid grid-cols-2 justify-center gap-[3.5rem] py-20 items-center text-center">
        <div>
          <p className="text-4xl font-bold font-helvetica">25k+</p>
          <p>Active Members</p>
        </div>
        <div>
          <p className="text-4xl font-bold font-helvetica">5K+</p>
          <p>Content Creators</p>
        </div>
        <div>
          <p className="text-4xl font-bold font-helvetica">5K+</p>
          <p>Web3 Projects Integrated</p>
        </div>
        <div>
          <p className="text-4xl font-bold font-helvetica">24/7</p>
          <p>Community Support</p>
        </div>
      </div>

      <div className="flex rid grid-cols-2 md:flex-row flex-col justify-center gap-4 xl:gap-8 items-center text-center flex-">
        <div className="flex flex-col gap-2 justify-center items-center border w-56 xl:w-72 h-56  xl:h-64 px-4 rounded-lg bg-gradient-to-r from-[#15375B] to-[#16062B]  border-[#2d1f3f]">
          <Image src={key} alt="x" width={50} height={30} />
          <p className="text-xl xl:text-2xl font-bold leading-normal text-center">
            Exclusive Beta Access
          </p>
          <p className="opacity-70 xl:text-base text-sm text-center">
            Be first to try out new features
          </p>
        </div>
        <div className="flex flex-col gap-2 justify-center items-center border w-56 xl:w-72 h-56  xl:h-64 px-4 rounded-lg bg-gradient-to-r from-[#15375B] to-[#16062B]  border-[#2d1f3f]">
          <Image src={bulb} alt="x" width={50} height={30} />
          <p className="text-xl xl:text-2xl font-bold leading-normal text-center">
            Knowledge Based & Resources
          </p>
          <p className="opacity-70 xl:text-base text-sm text-center">
            Learn everything about web3 streaming and monitization
          </p>
        </div>
        <div className="flex flex-col gap-2 justify-center items-center border w-56 xl:w-72 h-56  xl:h-64 px-4 rounded-lg bg-gradient-to-r from-[#15375B] to-[#16062B]  border-[#2d1f3f]">
          <Image src={podcast} alt="x" width={50} height={30} />
          <p className="text-xl xl:text-2xl font-bold leading-normal text-center">
            Networking Opportunities
          </p>
          <p className="opacity-70 xl:text-base text-sm text-center">
            Connect with top creators, investors andweb3 pioneers
          </p>
        </div>
        <div className="flex flex-col gap-2 justify-center items-center border w-56 xl:w-72 h-56  xl:h-64 px-4 rounded-lg bg-gradient-to-r from-[#15375B] to-[#16062B]  border-[#2d1f3f]">
          <Image src={folder} alt="x" width={50} height={30} />
          <p className="text-xl xl:text-2xl font-bold leading-normal text-center">
            Earining Potential
          </p>
          <p className="opacity-70 xl:text-base text-sm text-center">
            Unlock multiple revenue streams through decentralised streaming
          </p>
        </div>
      </div>
    </Section>
  );
};

export default Community;
