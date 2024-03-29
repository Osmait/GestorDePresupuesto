"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AuthRepository } from "@/app/repository/authRepository";
import { useRouter } from "next/navigation";
import { AuthStore } from "@/stores/authStore";

const formSchema = z
  .object({
    name: z
      .string()
      .min(2, {
        message: "name must be at least 2 characters.",
      })
      .max(50, {
        message: "name must be at max 50 characters.",
      }),

    lastName: z
      .string()
      .min(2, {
        message: "lastName must be at least 2 characters.",
      })
      .max(50, {
        message: "lastName must be at max 50 characters.",
      }),

    email: z
      .string()
      .min(2, {
        message: "email must be at least 2 characters.",
      })
      .email({ message: "it has to be an email" }),

    password: z.string().min(6, {
      message: "password must be at least 2 characters.",
    }),
    repeatPassword: z.string().min(6, {
      message: "password must be at least 2 characters.",
    }),
  })
  .refine((data) => data.password === data.repeatPassword, {
    path: ["repeatPassword"],
    message: "password and repeat Password dont equals ",
  });
export function RegisterForm() {
  const router = useRouter();
  const setAuth = AuthStore((state) => state.setUser);

  const authRepository = new AuthRepository();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      lastName: "",
      email: "",
      password: "",
      repeatPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    await authRepository.signUp(
      values.name,
      values.lastName,
      values.email,
      values.password,
    );
    const user = await authRepository.login(values.email, values.password);
    setAuth(user);
    form.reset();
    router.push("/app");
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-8 shadow-sm  shadow-primary rounded-md p-16 "
      >
        <h1 className="text-white text-lg">Register</h1>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="name"
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
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">Last Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="lastName"
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
        <FormField
          control={form.control}
          name="repeatPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-white">Repeat Password</FormLabel>
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

        <Button type="submit">Created</Button>
      </form>
    </Form>
  );
}
