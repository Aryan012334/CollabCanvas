import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUser } from "@/actions/action";
import { parseCookies } from "nookies";

export function useFetchUser() {
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

  const invalidateRooms = async () => {
    await queryClient.invalidateQueries({ queryKey: ["rooms"] });
  };

  return { ...query, invalidateRooms };
}
