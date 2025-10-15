"use client";
import { createContext, useState } from "react";
import { useEffect, useContext } from "react";
import { api } from "@/lib/axios";
import { useFetchUser } from "@/hooks/useUserFetcher";
import { parseCookies } from "nookies";

interface User {
  name: string;
  email: string;
  photo: string;
  token: string;
  id: string;
}

export const Context = createContext<{
  user: User;
  setUser: (user: User) => void;
}>({
  user: {
    name: "",
    email: "",
    photo: "",
    token: "",
    id: "",
  },
  setUser: () => {},
});

export function ContextProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>({
    name: "",
    email: "",
    photo: "",
    token: "",
    id: "",
  });
  return (
    <Context.Provider
      value={{
        user,
        setUser,
      }}>
      {children}
    </Context.Provider>
  );
}

export function UserLoader({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useContext(Context);
  const cookies = parseCookies();

  const { data, isLoading } = useFetchUser();
  console.log(data, "dataaa");
  useEffect(() => {
    if (data) {
      //use user.token from cookies into setUser
      setUser({
        name: data.name,
        email: data.email,
        photo: data.photo,
        token: cookies.token!,
        id: data.id,
      });
    }
  }, [data]);

  console.log(user);

  return <>{children}</>;
}
