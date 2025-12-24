import { useEffect, useRef, useState } from 'react';
import CountUp, { CountUpProps } from 'react-countup';
import { cn } from '@/lib/utils';

interface AnimatedFlashNumberProps extends Omit<CountUpProps, 'end'> {
    value: number;
    className?: string; // The base class name
    inverse?: boolean; // If true: Increase=Red, Decrease=Green
}

export function AnimatedFlashNumber({ value, className, inverse = false, ...props }: AnimatedFlashNumberProps) {
    const [flashClass, setFlashClass] = useState<string | null>(null);
    const prevValueRef = useRef<number>(value);
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            prevValueRef.current = value;
            return;
        }

        if (value > prevValueRef.current) {
            // Increase
            setFlashClass(
                inverse
                    ? 'text-red-500 dark:text-red-400 scale-110 transition-transform duration-200'
                    : 'text-green-500 dark:text-green-400 scale-110 transition-transform duration-200'
            );
        } else if (value < prevValueRef.current) {
            // Decrease
            setFlashClass(
                inverse
                    ? 'text-green-500 dark:text-green-400 scale-110 transition-transform duration-200'
                    : 'text-red-500 dark:text-red-400 scale-110 transition-transform duration-200'
            );
        }

        const timer = setTimeout(() => {
            setFlashClass(null);
        }, 1000);

        prevValueRef.current = value;

        return () => clearTimeout(timer);
    }, [value, inverse]);

    return (
        <span
            className={cn(
                "inline-block transition-colors duration-500",
                flashClass ? flashClass : className
            )}
        >
            <CountUp end={value} {...props} />
        </span>
    );
}
