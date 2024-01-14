"use client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Badge } from "./ui/badge";
import Autoplay from "embla-carousel-autoplay";

export default function AccountCarousel() {
  return (
    <Carousel
      plugins={[
        Autoplay({
          delay: 4000,
        }),
      ]}
    >
      <CarouselContent>
        <CarouselItem>
          <Badge
            className="flex gap-x-4 text-sm border-none"
            variant={"outline"}
          >
            <span>Popular</span>
            <h2> Total: 20000.00</h2>
          </Badge>
        </CarouselItem>
        <CarouselItem>
          <Badge
            className="flex gap-x-4 text-sm border-none"
            variant={"outline"}
          >
            <span>BanReservas</span>
            <h2> Total: 10000.00</h2>
          </Badge>
        </CarouselItem>
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
