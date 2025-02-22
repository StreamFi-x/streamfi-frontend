import Image from "next/image";
import x from "../../public/Images/x.png"
import telegram from "../../public/Images/Telegram.png"
import discord from "../../public/Images/discord.png";
import key from "../../public/Images/key.png";
import bulb from "../../public/Images/bulb.png";
import podcast from "../../public/Images/podcast.png";
import folder from "../../public/Images/folder.png";

const Community = () => {
    const starPositions = Array.from({ length: 25 }, () => ({
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 4}s`,
        size: `${Math.random() * 2 + 1}px`,
    }));


    return (
        <div className="bg-gradient-to-r from-[#16062B] from-[10%] via-[#0D0216] via-[50%] to-[#15375B] to-[88%] h-screen pt-20">
            <div className="stars-container absolute inset-0 w-full h-full"></div>
            {starPositions.map((pos, index) => (
                <div
                    key={index}
                    className={`absolute bg-white rounded-full ${index % 2 === 0 ? 'animate-twinkle' : 'animate-twinkle-slow'}`}
                    style={{
                        top: pos.top,
                        left: pos.left,
                        width: pos.size,
                        height: pos.size,
                        animationDelay: pos.animationDelay,
                    }}
                />
            ))}
            <div className="text-center flex flex-col justify-center items-center gap-4">
                <h1 className="text-3xl font-bold w-[27%] tracking-wide font-helvetica">Join Our Community - Be Part Of The Future Of Streaming</h1>
                <p className="w-[40%] opacity-60 text-sm">StreamFi is more than just a platform, it’s a movement. By joining our community, you become part of an ecosystem built for creators, viewers, and Web3 enthusiasts who believe in decentralized, creator-first streaming</p>
            </div>
            <div className="flex justify-center items-center gap-8 pt-10">
                <button className="flex justify-center gap-4 border rounded-lg px-3 py-1">
                    <Image src={x} alt="discord" width={30} height={30} />
                    <p>Join our community</p>
                </button>
                <button className="flex justify-center gap-4 border rounded-lg px-3 py-1">
                    <Image src={telegram} alt="telegram" width={30} height={30} />
                    <p>Join our community</p>
                </button>
                <button className="flex justify-center gap-4 border rounded-lg px-3 py-1">
                    <Image src={discord} alt="x" width={30} height={30} />
                    <p>Join our community</p>
                </button>
            </div>
            <div className="flex justify-center gap-[10rem] py-20 items-center text-center">
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

            <div className="flex justify-center gap-8 items-center text-center flex-wrap">
                <div className="flex flex-col gap-1 justify-center items-center border w-72 h-64 px-4 rounded-lg bg-gradient-to-r from-[#15375B] to-[#16062B]  border-[#2d1f3f]">
                    <Image src={key} alt="x" width={50} height={30} />
                    <p className="text-2xl font-bold leading-normal text-center">Exclusive Beta Access</p>
                    <p className="opacity-70 text-center">Be first to try out new features</p>
                </div>
                <div className="flex flex-col gap-1 justify-center items-center border w-72 h-64 px-4 rounded-lg bg-gradient-to-r from-[#15375B] to-[#16062B]  border-[#2d1f3f]">
                    <Image src={bulb} alt="x" width={50} height={30} />
                    <p className="text-2xl font-bold leading-normal text-center">Knowledge Based & Resources</p>
                    <p className="opacity-70 text-center">Learn everything about web3 streaming and monitization</p>
                </div>
                <div className="flex flex-col gap-1 justify-center items-center border w-72 h-64 px-4 rounded-lg bg-gradient-to-r from-[#15375B] to-[#16062B]  border-[#2d1f3f]">
                    <Image src={podcast} alt="x" width={50} height={30} />
                    <p className="text-2xl font-bold leading-normal text-center">Networking Opportunities</p>
                    <p className="opacity-70 text-center">Connect with top creators, investors andweb3 pioneers</p>
                </div>
                <div className="flex flex-col gap-1 justify-center items-center border w-72 h-64 px-4 rounded-lg bg-gradient-to-r from-[#15375B] to-[#16062B]  border-[#2d1f3f]">
                    <Image src={folder} alt="x" width={50} height={30} />
                    <p className="text-2xl font-bold leading-normal text-center">Earining Potential</p>
                    <p className="opacity-70 text-center">Unlock multiple revenue streams through decentralised streaming</p>
                </div>
            </div>
        </div>
    );
}

export default Community;