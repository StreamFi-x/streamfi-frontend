import React from "react";
import Logo from "@/public/Images/streamFiLogo.svg";
import Image from "next/image";
import Mail from "@/public/Images/mail.svg"

const footer = () => {
  return (
    <div className="flex justify-between text-white px-[5em] mt-[2em] items-center  py-[1em]  ">
      <div>
        <Image src={Logo} alt="logo" width={128} height={50} />
      </div>
      <div className="flex flex-col text-white items-center  ">
        <div>
          <p className="text-[20px] font-[500]"><span>Terms of Service</span> | <span>Privacy Policy</span></p>
        </div>
        <div>
          <p className="font-[100] text-[18px]">Copyright © 2025. All Rights Reserved.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Image src={Mail} alt="mail"/>
        <p className="text-[20px] font-[500]  ">Contact Us</p>
      </div>
    </div>
  );
};

export default footer;
