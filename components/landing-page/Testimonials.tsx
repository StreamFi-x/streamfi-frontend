"use client";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { testimonial_content } from "@/data/landing-page/testimonial";
import Image from "next/image";
import "swiper/css";

export default function Testimonials() {
  return (
    <section className="xl:px-20 md:px-14 px-5 w-full max-w-5xl mx-auto mt-12 pb-8 flex flex-col gap-8 text-white">
      <header className="w-full flex flex-col gap-3  items-center justify-center">
        <h1 className="text-2xl sm:text-4xl xl:text-5xl font-extrabold font-pp-neue">
          Don&apos;t just take our word for it
        </h1>
        <p className="text-white/80">
          Hear from some of StreamFi amazing users{" "}
        </p>
      </header>
      <Swiper
        modules={[Autoplay]}
        slidesPerView={1}
        centeredSlides
        spaceBetween={60}
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
          },
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
