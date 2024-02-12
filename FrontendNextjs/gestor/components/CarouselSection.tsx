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
interface Props {
  data: any[];
}

export default function CarouselSection({ data }: Props) {
  return (
    <Carousel
      plugins={[
        Autoplay({
          delay: 4000,
        }),
      ]}
    >
      <CarouselContent>
        {data.map((d) => (
          <CarouselItem>
            <Badge
              className="flex gap-x-4 text-lg bg-red-900/70"
              variant={"outline"}
            >
              <span> 🍔</span>
              <h2> Total: 2000.00</h2>
            </Badge>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
