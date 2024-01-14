"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AuthRepository } from "@/app/repository/authRepository";
import { useRouter } from "next/navigation";
import { AuthStore } from "@/stores/authStore";
const formSchema = z.object({
  email: z
    .string()
    .min(2, {
      message: "email must be at least 2 characters.",
    })
    .email({ message: "it has to be an email" }),

  password: z.string().min(6, {
    message: "password must be at least 2 characters.",
  }),
});

export function LoginForm() {
  const router = useRouter();
  const setAuth = AuthStore((state) => state.setUser);
  const user = AuthStore((state) => state.user);

  const authRepository = new AuthRepository();
  // ...  // 1. Define your form.
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    const user = await authRepository.login(values.email, values.password);
    setAuth(user);
    form.reset();
    console.log(user);
    router.push("/app");
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-8 shadow-sm  shadow-primary rounded-md p-16 "
      >
        <h1 className="text-white text-lg">Login</h1>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">Email</FormLabel>
              <FormControl>
                <Input
                  placeholder="example@example.com"
                  className="bg-secondary-foreground border-none text-white focus-visible:ring-offset-0"
                  {...field}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">Password</FormLabel>
              <FormControl>
                <Input
                  placeholder="password"
                  type="password"
                  className="bg-secondary-foreground border-none focus:border-none text-white focus-visible:ring-offset-0 "
                  {...field}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Login</Button>
      </form>
    </Form>
  );
}
