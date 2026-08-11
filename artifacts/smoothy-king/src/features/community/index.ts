import { apiFetch } from "../api";

export interface CommunityCreation {
  id: number;
  name: string;
  authorName: string;
  authorInitials: string | null;
  goal: string;
  story: string | null;
  ingredients: { name: string; amount: string; unit: string; benefit?: string | null }[];
  likes: number;
  colorHex: string | null;
  createdAt: string;
  /** Present only for a published recipe made through the builder. */
  recipeId: number | null;
  likedByMe: boolean;
}

export const getCommunityCreations = (
  token: string | null,
  query: { sort: string; goal?: string },
): Promise<CommunityCreation[]> => {
  const params = new URLSearchParams({ sort: query.sort });
  if (query.goal) params.set("goal", query.goal);
  return apiFetch<CommunityCreation[]>(`/api/creations?${params.toString()}`, token);
};

export const setCommunityLike = (
  id: number,
  liked: boolean,
  token: string | null,
): Promise<CommunityCreation> =>
  apiFetch<CommunityCreation>(`/api/creations/${id}/${liked ? "like" : "unlike"}`, token, {
    method: "POST",
    body: {},
  });
