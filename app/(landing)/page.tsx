import About from "@/components/landing-page/about";
import Benefits from "@/components/landing-page/Benefits";
import Community from "@/components/landing-page/Community";
import Footer from "@/components/landing-page/footer";
import FrequentlyAskedQuestions from "@/components/landing-page/frequently-asked-questions";
import HeroSection from "@/components/landing-page/hero-section";
import Navbar from "@/components/landing-page/Navbar";
import StreamTokenUtility from "@/components/landing-page/stream-token-utility";
import Testimonials from "@/components/landing-page/Testimonials";
import Waitlist from "@/components/landing-page/Waitlist";

export default function Home() {
  return (
    <div className="relative w-full bg-[#07060f] min-h-screen overflow-x-hidden">
      {/* Subtle noise texture */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none z-0"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <Navbar />
      <HeroSection />
      <Benefits />
      <About />
      <Community />
      <StreamTokenUtility />
      <Testimonials />
      <FrequentlyAskedQuestions />
      <Waitlist />
      <Footer />
    </div>
  );
}
