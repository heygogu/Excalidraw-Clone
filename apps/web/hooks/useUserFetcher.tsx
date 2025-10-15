import { useContext, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUser } from "@/actions/action";
import { Context } from "@/components/providers/ContextProvider";
import { parseCookies } from "nookies";

export function useFetchUser() {
  const { user, setUser } = useContext(Context);
  const queryClient = useQueryClient();
  const cookies = parseCookies();
  console.log(cookies);

  const query = useQuery({
    queryKey: ["user"],
    queryFn: async () => getUser(),
    retry: false,
    staleTime: Infinity,
  });

  // Sync React Query → Context

  const invalidateUser = async () => {
    await queryClient.invalidateQueries({ queryKey: ["rooms"] });
  };

  return { ...query, invalidateUser };
}
