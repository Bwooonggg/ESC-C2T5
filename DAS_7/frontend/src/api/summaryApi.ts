import {createApiUrl} from "../config/api";

export type SummaryResponse = {
    studentName: string;
    content: string;
};

export async function getSummary(studentId: string): Promise<SummaryResponse> {
    const response = await fetch(createApiUrl(`students/{studentId}/summary`));

    if (!response.ok) {
        throw new Error(`Unable to load users: ${response.status}`);
    }
    const data: SummaryResponse = await response.json();
    return data;
}