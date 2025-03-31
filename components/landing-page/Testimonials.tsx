"use client";

import { motion } from "framer-motion";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { testimonial_content } from "@/data/landing-page/testimonial";
import Image from "next/image";
import "swiper/css";
import Section from "@/components/layout/Section";

export default function Testimonials() {
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <Section id="testimonials" className="flex flex-col gap-8 text-white">
      <motion.header
        className="flex flex-col items-center justify-center gap-3 w-full"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        transition={{ staggerChildren: 0.2 }}
      >
        <motion.h1
          className="font-pp-neue font-extrabold text-2xl sm:text-4xl xl:text-5xl"
          variants={fadeInUp}
          transition={{ duration: 0.5 }}
        >
          Don&apos;t just take our word for it
        </motion.h1>
        <motion.p
          className="text-white/80"
          variants={fadeInUp}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Hear from some of StreamFi amazing users
        </motion.p>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
      >
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
              <motion.div
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
              >
                <Image
                  src={item.image || "/placeholder.svg"}
                  width={0}
                  height={0}
                  alt=""
                  className="w-full h-full"
                  style={{ objectFit: "cover" }}
                />
              </motion.div>
            </SwiperSlide>
          ))}
        </Swiper>
      </motion.div>
    </Section>
  );
}
