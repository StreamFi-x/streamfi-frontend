import Link from "next/link";
import Image from "next/image";
import { Mail } from "lucide-react";
import Logo from "@/public/Images/streamFiLogo.svg";
import Section from "../layout/Section";

export default function Footer() {
  return (
    <footer className=" bg-background-2 ">
      <Section className="flex flex-col md:flex-row justify-between items-center">
        <div className="mb-4 md:mb-0">
          <Link href="/" className="flex items-center">
            <Image
              src={Logo || "/placeholder.svg"}
              alt="Streamfi logo"
              width={128}
              height={50}
            />
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center text-center mb-4 md:mb-0">
          <div className="flex items-center gap-2 text-white text-sm">
            <Link
              href="/terms"
              className="hover:text-gray-300 transition-colors"
            >
              Terms of Service
            </Link>
            <span className="text-white">|</span>
            <Link
              href="/privacy"
              className="hover:text-gray-300 transition-colors"
            >
              Privacy Policy
            </Link>
          </div>

          <div className="text-xs text-gray-400 mt-1">
            Copyright © 2025. All Rights Reserved.
          </div>
        </div>

        <div>
          <Link
            href="/contact"
            className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
          >
            <Mail size={18} />
            <span>Contact Us</span>
          </Link>
        </div>
      </Section>
    </footer>
  );
}
