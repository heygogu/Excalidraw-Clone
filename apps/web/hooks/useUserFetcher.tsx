import { useContext, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUser } from "@/actions/action";
import { Context } from "@/components/providers/ContextProvider";

export function useFetchUser() {
  const { user, setUser } = useContext(Context);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["user"],
    queryFn: async () => getUser(),
    retry: false,
    staleTime: Infinity,
  });

  // Sync React Query → Context
  useEffect(() => {
    if (query.data && !user) setUser(query.data);
  }, [query.data]);

  const invalidateUser = async () => {
    await queryClient.invalidateQueries({ queryKey: ["rooms"] });
  };

  return { ...query, invalidateUser };
}
