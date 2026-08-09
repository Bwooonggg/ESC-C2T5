import { Client } from "@langchain/langgraph-sdk";

const configuredApiUrl =
  import.meta.env.VITE_LANGGRAPH_URL || "http://localhost:2024";
const LANGGRAPH_API_URL = configuredApiUrl.startsWith("/")
  ? `${globalThis.location?.origin || "http://localhost"}${configuredApiUrl}`
  : configuredApiUrl;

export const langgraphClient = new Client({
  apiUrl: LANGGRAPH_API_URL,
});

// Helper function to create a persistent user thread
export const createChatThread = async () => {
  try {
    const thread = await langgraphClient.threads.create();
    return thread.thread_id; 
  } catch (error) {
    console.error("Failed to create LangGraph thread:", error);
    throw error;
  }
};
