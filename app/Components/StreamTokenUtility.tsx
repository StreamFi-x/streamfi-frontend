import Image from "next/image"
const vpnKey =  "/Images/vpn_key.svg"
const token1 = "/Images/tokens/token1.svg"
const token2 = "/Images/tokens/token2.svg"
const token3 = "/Images/tokens/token3.svg"
const token4 = "/Images/tokens/token4.svg"
const token5 = "/Images/tokens/token5.svg"




export default function StreamTokenUtility() {


    const tokenUtilityData = [
        {
            title: "Staking",
            description: "Earn rewards by staking your tokens.",
        },
        {
            title: "Ad-Free Viewing",
            description: "Use tokens for a premium, ad-free experience.",
        },
        {
            title: "Tipping",
            description: "Support streamers directly with $STREAM tokens.",
        },
        {
            title: "Governance",
            description: "Vote on key decisions with your tokens.",
        },
    ]



    return(
        <section className="w-full py-10 px-4 md:p-20 flex flex-col items-center md:gap-[15px] relative  " >
<h1 className="text-[#F1F1F1] font-extrabold text-3xl md:text-[40px] text-center  m-0" >$Stream Token Utility</h1>   
<p className="text-[#FFFFFFCC] text-sm md:text-base font-normal text-center max-w-[844px] " >Lorem ipsum dolor sit amet consectetur. Dictum elementum malesuada sed a. Cursus sem pellentesque porttitor fringilla consectetur egestas  </p>         



<div className="md:w-[533.22px] z-10 w-[350px] md:h-[492px] ml-0 md:ml-auto mt-10 flex flex-col items-start justify-stretch gap-5 " >

{tokenUtilityData.map((item, index) => (
    <div key={index} className="  w-full h-[108px] border-[1px] border-[#FFFFFF1A] rounded-lg bg-[#FFFFFF0D] p-6 flex flex-row items-start justify-start gap-8 transition-transform duration-300 hover:-translate-y-2 cursor-pointer  " >

    <div className=" w-12 h-12 rounded bg-[#007BFF1A] flex items-center justify-center " >
        <Image src={vpnKey} alt="vpn_key" height={24} width={24}  /> 
    </div>
    <div className="flex flex-col items-start gap-1" >
        <h2 className=" font-bold text-[#FFFFFF] text-xl md:text-2xl " >{item.title} </h2>
        <p className="text-[#FFFFFF99] font-normal text-sm md:text-base " >{item.description} </p>
    </div>

</div>
))}

</div>









<div className="absolute top-[55%] left-[14%] flex items-center justify-center w-[200px] h-[150px] md:w-[449.8px] md:h-[304.2px] z-0  " >

    <Image src={token1} alt="token1" height={100} width={100} className="object-cover h-full w-full "  />

</div>
<div className="absolute top-[35%] left-[7%] flex items-center justify-center w-[150px] h-[120px] md:w-[306px] md:h-[206px] blur-[2px]  " > 

    <Image src={token2} alt="token2" height={100} width={100} className="object-cover h-full w-full "  />

</div>


<div className="absolute top-[20%] left-[28%] flex items-center justify-center w-[130px] h-[100px] md:w-[204px] md:h-[138px] blur-[3px]  " >

    <Image src={token3} alt="token3" height={100} width={100} className="object-cover h-full w-full "  />

</div>

<div className="absolute top-[19%] left-[3%] flex items-center justify-center w-[150px] h-[120px] md:w-[204px] md:h-[138px] blur-[2px]  " >

    <Image src={token4} alt="token4" height={100} width={100} className="object-cover h-full w-full "  />

</div>

<div className="absolute top-[5%] left-[10%] flex items-center justify-center w-[150px] h-[120px] md:w-[173px] md:h-[114px]  " >

    <Image src={token5} alt="token5" height={100} width={100} className="object-cover h-full w-full "  />

</div>


        </section>
    )
}