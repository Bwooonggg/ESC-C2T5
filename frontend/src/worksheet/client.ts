import { Client } from "@langchain/langgraph-sdk";
import { getAccessToken } from "../api/auth";
import { API_PREFIXES } from "../config/api";

function absoluteApiUrl(url: string): string {
    if (/^https?:\/\//.test(url)) return url;
    return `${globalThis.location?.origin ?? "http://localhost"}${url.startsWith("/") ? url : `/${url}`}`;
}

/** A new client receives the latest worksheet JWT for every protected operation. */
export async function createWorksheetClient(): Promise<Client> {
    const token = await getAccessToken("worksheet");
    return new Client({
        apiUrl: absoluteApiUrl(API_PREFIXES.worksheet),
        defaultHeaders: { Authorization: `Bearer ${token}` },
    });
}
