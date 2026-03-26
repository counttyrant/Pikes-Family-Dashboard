import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import type { ReactNode } from 'react';
import 'swiper/css';
import 'swiper/css/pagination';

interface SwipeContainerProps {
  children: ReactNode[];
}

export default function SwipeContainer({ children }: SwipeContainerProps) {
  return (
    <Swiper
      modules={[Pagination]}
      pagination={{ clickable: true }}
      spaceBetween={0}
      slidesPerView={1}
      threshold={20}
      resistance={true}
      resistanceRatio={0.65}
      touchStartPreventDefault={false}
      className="h-full w-full"
    >
      {children.map((child, index) => (
        <SwiperSlide key={index}>{child}</SwiperSlide>
      ))}
    </Swiper>
  );
}
