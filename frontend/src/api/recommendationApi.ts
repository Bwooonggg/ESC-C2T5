import type { Recommendation } from "../types/domain";
import { request } from "./client";

export async function getRecommendation(studentId: string): Promise<Recommendation> {
    return request<Recommendation>(`students/${studentId}/recommendations`, {
        method: "POST",
    });
}
