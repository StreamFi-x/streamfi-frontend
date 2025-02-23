"use client";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { testimonial_content } from "./_data";
import Image from "next/image";
import "swiper/css";

export default function Testimonials() {

  return (
    <section className="w-full max-w-5xl mx-auto mt-12 pb-8 flex flex-col gap-8">
      <header className="w-full flex flex-col gap-3 items-center justify-center">
        <h1 className="text-2xl md:text-5xl font-black">Don&apos;t just take our word for it</h1>
        <p className="text-white/80">Hear from some of StreamFi amazing users </p>
      </header>
      <Swiper
        modules={[Autoplay]}
        slidesPerView={1}
        centeredSlides
        spaceBetween={30}
        freeMode
        speed={1200}
        autoplay={{
          pauseOnMouseEnter: true,
          disableOnInteraction: false,
          delay: 2000,
        }}
        loop
        breakpoints={{
          768: {
            slidesPerView: 3,
          }
        }}
        className="w-full"
      >
        {testimonial_content.map((item, idx) => (
          <SwiperSlide key={idx}>
            <Image
              src={item.image}
              width={0}
              height={0}
              alt=""
              className="w-full h-full"
              style={{ objectFit: "cover" }}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}