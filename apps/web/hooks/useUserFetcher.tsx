import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUser } from "@/actions/action";
import { parseCookies } from "nookies";

export function useFetchUser() {
  const queryClient = useQueryClient();
  const cookies = parseCookies();

  const query = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      // Only fetch if a token cookie exists — avoids a guaranteed 401 on public pages
      if (!cookies.token) return null;
      return getUser();
    },
    retry: false,
    staleTime: Infinity,
  });

  const invalidateRooms = async () => {
    await queryClient.invalidateQueries({ queryKey: ["rooms"] });
  };

  return { ...query, invalidateRooms };
}
