"use client";
import { createContext, useState } from "react";
import { useEffect, useContext } from "react";
import { api } from "@/lib/axios";

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
  const { setUser } = useContext(Context);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get("/me", { withCredentials: true });
        setUser({ ...res.data });
      } catch (err) {
        setUser({ id: "", name: "", email: "", photo: "", token: "" });
      }
    };

    fetchUser();
  }, []);

  return <>{children}</>;
}
